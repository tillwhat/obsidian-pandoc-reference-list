import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { CSLList, PartialCSLEntry } from './types';

// Use globalThis.fetch which is available in Electron 13+
const fetch = globalThis.fetch;
const execFileAsync = promisify(execFile);

export const DEFAULT_ZOTERO_PORT = '23119';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const zoteroFieldMap: Record<string, string> = {
  publicationTitle: 'container-title',
  journalAbbreviation: 'container-title-short',
  url: 'URL',
  archiveLocation: 'archive_location',
  callNumber: 'call-number',
  collectionTitle: 'collection-title',
  collectionNumber: 'collection-number',
  numPages: 'number-of-pages',
  pages: 'page',
  place: 'publisher-place',
  publisher: 'publisher',
  series: 'series',
  seriesNumber: 'number',
  volume: 'volume',
};

const zoteroTypeMap: Record<string, string> = {
  artwork: 'graphic',
  audioRecording: 'song',
  blogPost: 'post-weblog',
  bookSection: 'chapter',
  computerProgram: 'software',
  conferencePaper: 'paper-conference',
  dictionaryEntry: 'entry-dictionary',
  document: 'article',
  email: 'personal_communication',
  encyclopediaArticle: 'entry-encyclopedia',
  film: 'motion_picture',
  journalArticle: 'article-journal',
  magazineArticle: 'article-magazine',
  newspaperArticle: 'article-newspaper',
  podcast: 'speech',
  presentation: 'speech',
  report: 'report',
  thesis: 'thesis',
  tvBroadcast: 'broadcast',
  videoRecording: 'motion_picture',
  webpage: 'webpage',
};

function migrateCachedZoteroList(list: CSLList) {
  let changed = false;
  for (const item of list) {
    const entry = item as PartialCSLEntry & Record<string, unknown>;
    if ('version' in entry) {
      delete entry.version;
      changed = true;
    }
    for (const [zoteroField, cslField] of Object.entries(zoteroFieldMap)) {
      if (entry[cslField] === undefined && entry[zoteroField] !== undefined) {
        entry[cslField] = entry[zoteroField];
        changed = true;
      }
    }
    if (typeof entry.type === 'string' && zoteroTypeMap[entry.type]) {
      entry.type = zoteroTypeMap[entry.type];
      changed = true;
    }
    const dateParts = (
      entry.issued as { 'date-parts'?: number[][] } | undefined
    )?.['date-parts']?.[0];
    if (dateParts?.[0] < 1000 && dateParts?.[1] >= 1000) {
      entry.issued = {
        'date-parts': [[dateParts[1], dateParts[0]]],
      };
      changed = true;
    }
  }
  return changed;
}

export function getBibPath(bibPath: string, getVaultRoot?: () => string) {
  if (!fs.existsSync(bibPath)) {
    const orig = bibPath;
    if (getVaultRoot) {
      bibPath = path.join(getVaultRoot(), bibPath);
      if (!fs.existsSync(bibPath)) {
        throw new Error(
          `bibToCSL: cannot access bibliography file '${bibPath}'.`
        );
      }
    } else {
      throw new Error(`bibToCSL: cannot access bibliography file '${orig}'.`);
    }
  }

  return bibPath;
}

export async function bibToCSL(
  bibPath: string,
  pathToPandoc: string,
  getVaultRoot?: () => string
): Promise<PartialCSLEntry[]> {
  bibPath = getBibPath(bibPath, getVaultRoot);

  const parsed = path.parse(bibPath);
  if (parsed.ext === '.json') {
    return new Promise((res, rej) => {
      fs.readFile(bibPath, (err, data) => {
        if (err) return rej(err);
        try {
          res(JSON.parse(data.toString()));
        } catch (e) {
          rej(e);
        }
      });
    });
  }

  if (!pathToPandoc) {
    throw new Error('bibToCSL: path to pandoc is required for non CSL files.');
  }

  if (!fs.existsSync(pathToPandoc)) {
    throw new Error(`bibToCSL: cannot access pandoc at '${pathToPandoc}'.`);
  }

  const args = [bibPath, '-t', 'csljson', '--quiet'];

  const res = await execFileAsync(pathToPandoc, args, {
    maxBuffer: 100 * 1024 * 1024,
  });

  if (res.stderr) {
    throw new Error(`bibToCSL: ${res.stderr}`);
  }

  return JSON.parse(res.stdout);
}

export async function getCSLLocale(
  localeCache: Map<string, string>,
  cacheDir: string,
  lang: string
) {
  if (localeCache.has(lang)) {
    return localeCache.get(lang);
  }

  const url = `https://raw.githubusercontent.com/citation-style-language/locales/master/locales-${lang}.xml`;
  const outpath = path.join(cacheDir, `locales-${lang}.xml`);

  ensureDir(cacheDir);
  if (fs.existsSync(outpath)) {
    const localeData = fs.readFileSync(outpath).toString();
    localeCache.set(lang, localeData);
    return localeData;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const localeData = await response.text();
    fs.writeFileSync(outpath, localeData);
    localeCache.set(lang, localeData);
    return localeData;
  } catch (e) {
    console.error('Error downloading locale:', e);
    throw e;
  }
}

export async function getCSLStyle(
  styleCache: Map<string, string>,
  cacheDir: string,
  url: string,
  explicitPath?: string
) {
  if (explicitPath) {
    if (styleCache.has(explicitPath)) {
      return styleCache.get(explicitPath);
    }

    if (!fs.existsSync(explicitPath)) {
      throw new Error(
        `Error: retrieving citation style; Cannot find file '${explicitPath}'.`
      );
    }

    const styleData = fs.readFileSync(explicitPath).toString();
    styleCache.set(explicitPath, styleData);
    return styleData;
  }

  if (styleCache.has(url)) {
    return styleCache.get(url);
  }

  const fileFromURL = url.split('/').pop();
  const outpath = path.join(cacheDir, fileFromURL);

  ensureDir(cacheDir);
  if (fs.existsSync(outpath)) {
    const styleData = fs.readFileSync(outpath).toString();
    styleCache.set(url, styleData);
    return styleData;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const styleData = await response.text();
    fs.writeFileSync(outpath, styleData);
    styleCache.set(url, styleData);
    return styleData;
  } catch (e) {
    console.error('Error downloading CSL style:', e);
    throw e;
  }
}

export const defaultHeaders = {
  'Content-Type': 'application/json',
  'User-Agent': 'obsidian/zotero',
  Accept: 'application/json',
  Connection: 'keep-alive',
};

function isExpectedZoteroConnectionError(error: unknown) {
  return (
    error instanceof Error &&
    /timed out|ECONNREFUSED|ECONNRESET/.test(error.message)
  );
}

async function requestZotero(
  port: string,
  endpoint: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
  } = {},
  timeout = 5000
) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: String(port || DEFAULT_ZOTERO_PORT).trim(),
        path: endpoint,
        method: options.method ?? 'GET',
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, body })
        );
        response.on('error', reject);
      }
    );
    req.setTimeout(timeout, () => {
      req.destroy(new Error('Zotero request timed out.'));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export async function getZUserGroups(
  port: string = DEFAULT_ZOTERO_PORT
): Promise<Array<{ id: number; name: string }>> {
  try {
    const response = await requestZotero(port, '/api/users/0/groups');

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    const groups = JSON.parse(response.body) as Array<{
      id?: number;
      name?: string;
      data?: {
        id?: number;
        name?: string;
      };
    }>;
    if (!Array.isArray(groups)) {
      throw new Error('Zotero local API returned an invalid group list.');
    }

    const userGroups = groups.map((group) => ({
      id: group.data?.id ?? group.id,
      name: group.data?.name ?? group.name,
    }));
    if (
      userGroups.some(
        (group) =>
          typeof group.id !== 'number' || typeof group.name !== 'string'
      )
    ) {
      throw new Error('Zotero local API returned an invalid group.');
    }

    return [{ id: 1, name: 'My Library' }, ...userGroups];
  } catch (e) {
    if (!isExpectedZoteroConnectionError(e)) {
      console.error('Error connecting to Zotero:', e);
    }
    throw new Error(`Error connecting to Zotero: ${e}`);
  }
}

export async function getZModified(
  port: string = DEFAULT_ZOTERO_PORT,
  groupId: number,
  since: number
): Promise<CSLList> {
  if (!(await isZoteroRunning(port))) return null;

  const libraryPath =
    groupId === 1 ? '/api/users/0/items' : `/api/groups/${groupId}/items`;

  try {
    const response = await requestZotero(port, `${libraryPath}?format=json`);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    const allItems = JSON.parse(response.body) as ZoteroItem[];
    const modifiedItems = allItems.filter(
      (item) =>
        item.data?.dateModified && Date.parse(item.data.dateModified) > since
    );

    return modifiedItems
      .filter((item) => item.data?.citationKey && item.data.title)
      .map((item) => toCSLEntry(item.data, groupId, item.key));
  } catch (error) {
    if (
      !(
        error instanceof Error &&
        /timed out|ECONNREFUSED|ECONNRESET/.test(error.message)
      )
    ) {
      console.error('Error connecting to Zotero:', error);
    }
    return null;
  }
}

export async function getZBib(
  port: string = DEFAULT_ZOTERO_PORT,
  cacheDir: string,
  groupId: number,
  loadCached?: boolean
) {
  const isRunning = await isZoteroRunning(port);
  const cached = path.join(cacheDir, `zotero-library-${groupId}.json`);

  ensureDir(cacheDir);
  if (loadCached || !isRunning) {
    if (fs.existsSync(cached)) {
      const cachedList = JSON.parse(
        fs.readFileSync(cached).toString()
      ) as CSLList;
      const migrated = migrateCachedZoteroList(cachedList);
      if (migrated) {
        fs.writeFileSync(cached, JSON.stringify(cachedList));
      }
      if (
        cachedList.every(
          (item) =>
            typeof (item as ZoteroCSLEntry).zoteroKey === 'string' &&
            (item as ZoteroCSLEntry).zoteroAttachmentsLoaded === true
        )
      ) {
        return applyGroupID(cachedList, groupId);
      }
    }
    if (!isRunning) {
      return null;
    }
  }

  try {
    const list = await getZoteroItems(port, groupId);
    fs.writeFileSync(cached, JSON.stringify(list));
    return list;
  } catch (e) {
    console.error('Error fetching bibliography from Zotero:', e);
    return null;
  }
}

async function getZoteroItems(port: string, groupId: number): Promise<CSLList> {
  const items: CSLList = [];
  const firstAttachments = new Map<string, string>();
  const limit = 100;
  let start = 0;

  for (;;) {
    const libraryPath =
      groupId === 1 ? '/api/users/0/items' : `/api/groups/${groupId}/items`;
    const response = await requestZotero(
      port,
      `${libraryPath}?format=json&limit=${limit}&start=${start}`
    );
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    const page = JSON.parse(response.body) as ZoteroItem[];
    if (!Array.isArray(page)) {
      throw new Error('Zotero local API returned an invalid item list.');
    }

    for (const item of page) {
      const parentItem = item.data?.parentItem;
      if (
        item.key &&
        item.data?.itemType === 'attachment' &&
        typeof parentItem === 'string' &&
        !firstAttachments.has(parentItem)
      ) {
        firstAttachments.set(parentItem, item.key);
      }
    }

    for (const item of page) {
      if (!item.data?.citationKey || !item.data.title) continue;
      items.push(
        toCSLEntry(
          item.data,
          groupId,
          item.key,
          firstAttachments.get(item.key)
        )
      );
    }

    for (const entry of items) {
      const zoteroKey = (entry as ZoteroCSLEntry).zoteroKey;
      if (zoteroKey) {
        const attachmentKey = firstAttachments.get(zoteroKey);
        if (attachmentKey) {
          (entry as ZoteroCSLEntry).zoteroAttachmentKey = attachmentKey;
        }
      }
    }

    if (page.length < limit) break;
    start += page.length;
  }

  return items;
}

interface ZoteroItem {
  key?: string;
  data?: {
    citationKey?: string;
    title?: string;
    abstractNote?: string;
    itemType?: string;
    parentItem?: string;
    date?: string;
    dateModified?: string;
    creators?: Array<{
      creatorType?: string;
      firstName?: string;
      lastName?: string;
      name?: string;
    }>;
    [key: string]: unknown;
  };
}

interface ZoteroCSLEntry extends PartialCSLEntry {
  zoteroKey?: string;
  zoteroAttachmentKey?: string;
  zoteroAttachmentsLoaded?: boolean;
  [key: string]: unknown;
}

function toCSLEntry(
  data: NonNullable<ZoteroItem['data']>,
  groupId: number,
  zoteroKey?: string,
  zoteroAttachmentKey?: string
): ZoteroCSLEntry {
  const citationData = { ...data };
  delete citationData.version;

  const entry: ZoteroCSLEntry = {
    ...(citationData as unknown as Record<string, unknown>),
    id: data.citationKey,
    title: data.title,
    groupID: groupId,
    zoteroKey,
    zoteroAttachmentKey,
    zoteroAttachmentsLoaded: true,
  };

  for (const [zoteroField, cslField] of Object.entries(zoteroFieldMap)) {
    const value = data[zoteroField];
    if (value !== undefined && value !== null && value !== '') {
      entry[cslField] = value;
    }
  }

  if (data.DOI) entry.DOI = data.DOI;
  if (data.abstractNote) entry.abstract = data.abstractNote;
  if (data.itemType) {
    entry.type = zoteroTypeMap[data.itemType] ?? data.itemType;
  }
  if (data.date) {
    const date = data.date.trim();
    const year = date.match(/(?:^|[^\d])(\d{4})(?:$|[^\d])/);
    if (year) {
      const dateParts = [Number(year[1])];
      const beforeYear = date.slice(0, year.index).match(/\d{1,2}/);
      const afterYear = date.slice(year.index + year[0].length).match(/\d{1,2}/);
      const month = beforeYear?.[0] ?? afterYear?.[0];
      if (month && Number(month) >= 1 && Number(month) <= 12) {
        dateParts.push(Number(month));
      }
      entry.issued = { 'date-parts': [dateParts] };
    }
  }
  if (data.creators) {
    const creators = data.creators.map((creator) =>
      creator.name
        ? { literal: creator.name }
        : { family: creator.lastName, given: creator.firstName }
    );
    entry.author = creators.filter(
      (_, index) => data.creators[index].creatorType === 'author'
    );
    for (const role of ['editor', 'translator', 'director']) {
      const roleCreators = data.creators
        .map((creator, index) => ({ creator, value: creators[index] }))
        .filter(({ creator }) => creator.creatorType === role)
        .map(({ value }) => value);
      if (roleCreators.length) entry[role] = roleCreators;
    }
  }

  return entry;
}

export async function refreshZBib(
  port: string = DEFAULT_ZOTERO_PORT,
  cacheDir: string,
  groupId: number,
  since: number
) {
  const cached = path.join(cacheDir, `zotero-library-${groupId}.json`);
  ensureDir(cacheDir);
  if (!fs.existsSync(cached)) {
    return null;
  }

  const mList = (await getZModified(port, groupId, since)) as CSLList;

  if (!mList?.length) {
    return null;
  }

  const modified: Map<string, PartialCSLEntry> = new Map();
  const newKeys: Set<string> = new Set();

  for (const mod of mList) {
    mod.id = mod.id || (mod as any).citationKey;
    if (!mod.id) continue;
    modified.set(mod.id, mod);
    newKeys.add(mod.id);
  }

  const list = JSON.parse(fs.readFileSync(cached).toString()) as CSLList;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (modified.has(item.id)) {
      const replacement = modified.get(item.id);
      if (replacement) {
        const oldAttachment = (item as ZoteroCSLEntry).zoteroAttachmentKey;
        if (
          typeof oldAttachment === 'string' &&
          typeof (replacement as ZoteroCSLEntry).zoteroAttachmentKey !==
            'string'
        ) {
          (replacement as ZoteroCSLEntry).zoteroAttachmentKey = oldAttachment;
          (replacement as ZoteroCSLEntry).zoteroAttachmentsLoaded = true;
        }
        newKeys.delete(item.id);
        list[i] = replacement;
      }
    }
  }

  for (const key of newKeys) {
    list.push(modified.get(key));
  }

  fs.writeFileSync(cached, JSON.stringify(list));

  return {
    list: applyGroupID(list, groupId),
    modified,
  };
}

export async function isZoteroRunning(port: string = DEFAULT_ZOTERO_PORT) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await requestZotero(port, '/api/', {}, 2000);
      if (response.status >= 200 && response.status < 300) {
        return true;
      }
    } catch {
      // Connection may be briefly unavailable while Zotero is starting.
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return false;
}

function applyGroupID(list: CSLList, groupId: number) {
  return list.map((item) => {
    item.groupID = groupId;
    return item;
  });
}
