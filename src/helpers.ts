import { htmlToMarkdown } from 'obsidian';

export function getVaultRoot() {
  const adapter = app.vault.adapter as typeof app.vault.adapter & {
    getBasePath?: () => string;
  };
  return adapter.getBasePath?.() ?? '';
}

export async function copyElToClipboard(el: HTMLElement) {
  const html = el.outerHTML;
  const text = htmlToMarkdown(html);

  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Clipboard access is unavailable.');
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([text], { type: 'text/plain' }),
    }),
  ]);
}

export class PromiseCapability<T> {
  settled = false;
  promise: Promise<T>;
  resolve: (data: T) => void;
  reject: (reason?: any) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = (data) => {
        resolve(data);
        this.settled = true;
      };

      this.reject = (reason) => {
        reject(reason);
        this.settled = true;
      };
    });
  }
}

export function areSetsEqual<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) return false;
  for (const a of as) if (!bs.has(a)) return false;
  return true;
}
