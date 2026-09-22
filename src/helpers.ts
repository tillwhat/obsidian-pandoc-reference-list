import { FileSystemAdapter, htmlToMarkdown } from 'obsidian';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const shellEnvironmentCommand =
  'printf "\\n__OBSIDIAN_SHELL_ENV__\\n"; command env; printf "\\n__OBSIDIAN_SHELL_ENV__\\n"; exit';

export function findExecutable(name: string) {
  const extensions =
    process.platform === 'win32'
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
      : [''];

  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, name + extension);
      try {
        fs.accessSync(
          candidate,
          process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK
        );
        return candidate;
      } catch {
        // Try the next PATH entry.
      }
    }
  }

  return null;
}

export function getVaultRoot() {
  // This is a desktop only plugin, so assume adapter is FileSystemAdapter
  return (app.vault.adapter as FileSystemAdapter).getBasePath();
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

export async function fixPath() {
  if (process.platform === 'win32') {
    return;
  }

  try {
    const shellPath = process.env.SHELL || '/bin/sh';
    const result = await execFileAsync(
      shellPath,
      ['-ilc', shellEnvironmentCommand],
      {
        env: {
          ...process.env,
          DISABLE_AUTO_UPDATE: 'true',
          ZSH_TMUX_AUTOSTARTED: 'true',
          ZSH_TMUX_AUTOSTART: 'false',
        },
      }
    );
    const shellEnvironment = result.stdout.split('__OBSIDIAN_SHELL_ENV__')[1];
    const path = shellEnvironment
      ?.split('\n')
      .find((line) => line.startsWith('PATH='))
      ?.slice('PATH='.length);

    process.env.PATH =
      path ||
      [
        './node_modules/.bin',
        '/.nodebrew/current/bin',
        '/usr/local/bin',
        process.env.PATH,
      ].join(':');
  } catch (e) {
    console.error(e);
  }
}

export function areSetsEqual<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) return false;
  for (const a of as) if (!bs.has(a)) return false;
  return true;
}
