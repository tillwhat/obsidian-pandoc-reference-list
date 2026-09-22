import { CSLList, PartialCSLEntry } from './types';

export const DEFAULT_ZOTERO_PORT = '23119';

export function getBibPath(bibPath: string, getVaultRoot?: () => string) {
  if (getVaultRoot && !bibPath.startsWith('/')) {
    return `${getVaultRoot()}/${bibPath}`;
  }
  return bibPath;
}

type DesktopBibHelpers = typeof import('./desktopBibHelpers');

const desktopHelpers = (): Promise<DesktopBibHelpers> =>
  import('./desktopBibHelpers');

export async function bibToCSL(
  bibPath: string,
  pathToPandoc: string,
  getVaultRoot?: () => string
) {
  return (await desktopHelpers()).bibToCSL(
    bibPath,
    pathToPandoc,
    getVaultRoot
  );
}

export async function getCSLLocale(
  localeCache: Map<string, string>,
  cacheDir: string,
  lang: string
) {
  return (await desktopHelpers()).getCSLLocale(localeCache, cacheDir, lang);
}

export async function getCSLStyle(
  styleCache: Map<string, string>,
  cacheDir: string,
  url: string,
  explicitPath?: string
) {
  return (await desktopHelpers()).getCSLStyle(
    styleCache,
    cacheDir,
    url,
    explicitPath
  );
}

export async function getZUserGroups(port = DEFAULT_ZOTERO_PORT) {
  return (await desktopHelpers()).getZUserGroups(port);
}

export async function getZBib(
  port: string,
  cacheDir: string,
  groupId: number,
  loadCached?: boolean
) {
  return (await desktopHelpers()).getZBib(
    port,
    cacheDir,
    groupId,
    loadCached
  );
}

export async function refreshZBib(
  port: string,
  cacheDir: string,
  groupId: number,
  since: number
) {
  return (await desktopHelpers()).refreshZBib(port, cacheDir, groupId, since);
}

export async function isZoteroRunning(port = DEFAULT_ZOTERO_PORT) {
  return (await desktopHelpers()).isZoteroRunning(port);
}

export type { CSLList, PartialCSLEntry };
