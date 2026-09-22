import { watch as nodeWatch, existsSync as nodeExistsSync } from 'node:fs';
import path from 'node:path';

export const existsSync = nodeExistsSync;
export const watch = nodeWatch;
export const join = path.join;
export const dirname = path.dirname;
