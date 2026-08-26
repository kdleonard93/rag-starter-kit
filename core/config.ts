import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import cfg from '../rag.config.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type RagConfig = typeof cfg;
export default cfg;

export { repoRoot };
