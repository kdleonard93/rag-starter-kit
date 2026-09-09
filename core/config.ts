// tsx doesn't load .env files, and process.env is read when rag.config is
// imported — this must run before that import below.
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import cfg from '../rag.config.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type RagConfig = typeof cfg;
export default cfg;

export { repoRoot };
