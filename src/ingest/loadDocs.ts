import { DirectoryLoader } from '@langchain/classic/document_loaders/fs/directory';
import { TextLoader } from '@langchain/classic/document_loaders/fs/text';
import type { Document } from '@langchain/core/documents';
import type { RagConfig } from '../config.js';
// later: CheerioWebBaseLoader, GoogleDriveLoader (community integrations for web/GDrive)

export async function loadDocs(sources: RagConfig['sources']): Promise<Document[]> {
  const all = [];
  for (const src of sources) {
    if (src.type === 'folder') {
      const loader = new DirectoryLoader(src.path, {
        '.md': (p) => new TextLoader(p),
        '.txt': (p) => new TextLoader(p),
      });
      all.push(...(await loader.load()));
    }
    // 'web' and 'gdrive' land in Phase 3
  }
  return all;
}
