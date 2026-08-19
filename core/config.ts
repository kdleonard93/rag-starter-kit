import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import cfg from '../rag.config.js';

// Anchor the repo root so relative paths in rag.config.ts (e.g. './data')
// resolve from the repo root regardless of which process loads the config —
// the CLI (cwd = repo root) and the SvelteKit server (cwd = app/) both see the same files.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type RagConfig = typeof cfg;
export default cfg;

export { repoRoot };