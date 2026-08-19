import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import { Document } from '@langchain/core/documents';
import { load as cheerioLoad } from 'cheerio';
import { resolve, isAbsolute } from 'node:path';
import cfg, { repoRoot } from '../config.js';
import type { RagConfig } from '../config.js';

async function loadWebPage(url: string): Promise<Document[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`web loader: ${res.status} ${res.statusText} for ${url}`);
  const html = await res.text();
  const $ = cheerioLoad(html);

  $('script, style, nav, footer, header, noscript').remove();
  const text = $('article, main, body').text().replace(/\s+\n/g, '\n').trim();

  return [new Document({ pageContent: text, metadata: { source: url } })];
}

export async function loadDocs(sources: RagConfig['sources']): Promise<Document[]> {
  const all: Document[] = [];
  for (const src of sources) {
    if (src.type === 'folder') {
      const path = isAbsolute(src.path) ? src.path : resolve(repoRoot, src.path);
      const loader = new DirectoryLoader(path, {
        '.md': (p) => new TextLoader(p),
        '.txt': (p) => new TextLoader(p),
      });
      all.push(...(await loader.load()));
    } else if (src.type === 'web') {
      for (const url of src.urls) {
        all.push(...(await loadWebPage(url)));
      }
    }
    // gdrive
  }
  return all;
}
