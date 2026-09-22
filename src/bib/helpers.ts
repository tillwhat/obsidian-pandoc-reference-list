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
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'user.groups',
  });

  try {
    const response = await requestZotero(port, '/better-bibtex/json-rpc', {
      method: 'POST',
      headers: { 'Content-Length': Buffer.byteLength(body).toString() },
      body,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = JSON.parse(response.body);
    return result.result as Array<{ id: number; name: string }>;
  } catch (e) {
    console.error('Error connecting to Zotero:', e);
    throw new Error(`Error connecting to Zotero: ${e}`);
  }
}

function panNum(n: number) {
  if (n < 10) return `0${n}`;
  return n.toString();
}

function timestampToZDate(ts: number) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${panNum(d.getUTCMonth() + 1)}-${panNum(
    d.getUTCDate()
  )} ${panNum(d.getUTCHours())}:${panNum(d.getUTCMinutes())}:${panNum(
    d.getUTCSeconds()
  )}`;
}

export async function getZModified(
  port: string = DEFAULT_ZOTERO_PORT,
  groupId: number,
  since: number
): Promise<CSLList> {
  if (!(await isZoteroRunning(port))) return null;

  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'item.search',
    params: [[['dateModified', 'isAfter', timestampToZDate(since)]], groupId],
  });

  try {
    const response = await requestZotero(port, '/better-bibtex/json-rpc', {
      method: 'POST',
      headers: { 'Content-Length': Buffer.byteLength(body).toString() },
      body,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = JSON.parse(response.body);
    return result.result as CSLList;
  } catch (e) {
    console.error('Error connecting to Zotero:', e);
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
      return applyGroupID(
        JSON.parse(fs.readFileSync(cached).toString()) as CSLList,
        groupId
      );
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
      if (!item.data?.citationKey || !item.data.title) continue;
      items.push(toCSLEntry(item.data, groupId));
    }

    if (page.length < limit) break;
    start += page.length;
  }

  return items;
}

interface ZoteroItem {
  data?: {
    citationKey?: string;
    title?: string;
    abstractNote?: string;
    itemType?: string;
    date?: string;
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
  [key: string]: unknown;
}

function toCSLEntry(
  data: NonNullable<ZoteroItem['data']>,
  groupId: number
): ZoteroCSLEntry {
  const entry: ZoteroCSLEntry = {
    ...(data as unknown as Record<string, unknown>),
    id: data.citationKey,
    title: data.title,
    groupID: groupId,
  };

  if (data.abstractNote) entry.abstract = data.abstractNote;
  if (data.itemType) entry.type = data.itemType;
  if (data.date) {
    const year = data.date.match(/\d{4}/)?.[0];
    if (year) entry.issued = { 'date-parts': [[Number(year)]] };
  }
  if (data.creators) {
    entry.author = data.creators
      .filter((creator) => creator.creatorType === 'author')
      .map((creator) =>
        creator.name
          ? { literal: creator.name }
          : { family: creator.lastName, given: creator.firstName }
      );
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
    mod.id = (mod as any).citekey || (mod as any)['citation-key'];
    if (!mod.id) continue;
    modified.set(mod.id, mod);
    newKeys.add(mod.id);
  }

  const list = JSON.parse(fs.readFileSync(cached).toString()) as CSLList;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (modified.has(item.id)) {
      newKeys.delete(item.id);
      list[i] = modified.get(item.id);
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
      const response = await requestZotero(
        port,
        '/better-bibtex/cayw?probe=true',
        {},
        2000
      );
      if (
        response.status >= 200 &&
        response.status < 300 &&
        response.body.trim() === 'ready'
      ) {
        return true;
      }
    } catch {
      // Better BibTeX can briefly close the probe connection while starting.
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return false;
}

export async function getItemJSONFromCiteKeys(
  port: string = DEFAULT_ZOTERO_PORT,
  citeKeys: string[],
  libraryID: number
) {
  if (!(await isZoteroRunning(port))) return null;

  let res: any;

  try {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'item.export',
      params: [citeKeys, '36a3b0b5-bad0-4a04-b79b-441c7cef77db', libraryID],
    });

    const response = await requestZotero(port, '/better-bibtex/json-rpc', {
      method: 'POST',
      headers: { 'Content-Length': Buffer.byteLength(body).toString() },
      body,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    res = JSON.parse(response.body);
  } catch (e) {
    console.error(e);
    return null;
  }

  try {
    if (res.error?.message) {
      console.error(new Error(res.error.message));
      return null;
    }

    return Array.isArray(res.result)
      ? JSON.parse(res.result[2]).items
      : JSON.parse(res.result).items;
  } catch (e) {
    console.error(e);
    return null;
  }
}

function applyGroupID(list: CSLList, groupId: number) {
  return list.map((item) => {
    item.groupID = groupId;
    return item;
  });
}
