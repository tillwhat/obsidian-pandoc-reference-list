import { CSLList, PartialCSLEntry } from './bib/types';

export const MOBILE_CACHE_PATH = '.pandoc/mobile-cache.json';
const MOBILE_CACHE_VERSION = 1;

export interface MobileCache {
  version: number;
  updatedAt: number;
  bibliography: CSLList;
  styles: Record<string, string>;
  locales: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

function isEntry(value: unknown): value is PartialCSLEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string'
  );
}

export function validateMobileCache(value: unknown): MobileCache {
  if (
    !isRecord(value) ||
    value.version !== MOBILE_CACHE_VERSION ||
    typeof value.updatedAt !== 'number' ||
    !Array.isArray(value.bibliography) ||
    !value.bibliography.every(isEntry) ||
    !isStringRecord(value.styles) ||
    !isStringRecord(value.locales)
  ) {
    throw new Error('The mobile bibliography cache is invalid or unsupported.');
  }

  return value as unknown as MobileCache;
}

export async function readMobileCache(): Promise<MobileCache | null> {
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(MOBILE_CACHE_PATH))) return null;

  const raw = await adapter.read(MOBILE_CACHE_PATH);
  return validateMobileCache(JSON.parse(raw));
}

export async function writeMobileCache(
  bibliography: CSLList,
  styles: Map<string, string>,
  locales: Map<string, string>
) {
  const adapter = app.vault.adapter;
  const folder = MOBILE_CACHE_PATH.slice(
    0,
    MOBILE_CACHE_PATH.lastIndexOf('/')
  );

  if (!(await adapter.exists(folder))) {
    await adapter.mkdir(folder);
  }

  const cache: MobileCache = {
    version: MOBILE_CACHE_VERSION,
    updatedAt: Date.now(),
    bibliography,
    styles: Object.fromEntries(styles),
    locales: Object.fromEntries(locales),
  };

  await adapter.write(MOBILE_CACHE_PATH, JSON.stringify(cache));
}
