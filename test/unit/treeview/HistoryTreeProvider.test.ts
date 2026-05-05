/**
 * Unit tests for HistoryTreeProvider
 *
 * Focuses on tree structure correctness and the FileItem.fileUri property
 * that enables the "Add File to Group" context menu action.
 */

import {
  HistoryTreeProvider,
  HistoryItem,
  FileItem,
} from '../../../src/presentation/treeview/HistoryTreeProvider';
import { ICopyHistoryRepository } from '../../../src/domain/interfaces/ICopyHistoryRepository';
import { CopyHistoryService } from '../../../src/application/services/CopyHistoryService';
import { CopyHistoryEntry, createCopyHistoryEntry } from '../../../src/domain/entities/CopyHistoryEntry';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<CopyHistoryEntry> = {}): CopyHistoryEntry {
  return {
    ...createCopyHistoryEntry(
      'group-1',
      'My Group',
      '# output',
      [
        {
          uri: 'file:///src/foo.ts',
          relativePath: 'src/foo.ts',
          extractedContent: 'export const foo = 1;',
          contextMode: { type: 'full' },
        },
        {
          uri: 'file:///src/bar.ts',
          relativePath: 'src/bar.ts',
          extractedContent: 'export const bar = 2;',
          contextMode: { type: 'full' },
          error: 'File not found',
        },
      ],
      { type: 'full' },
      'clipboard',
      undefined
    ),
    ...overrides,
  };
}

function makeMockRepo(entries: CopyHistoryEntry[] = []): ICopyHistoryRepository {
  const store = new Map<string, CopyHistoryEntry>(entries.map(e => [e.id, e]));
  return {
    getAll: async () =>
      Array.from(store.values()).sort((a, b) => b.copiedAt.getTime() - a.copiedAt.getTime()),
    getById: async id => store.get(id) ?? null,
    getByGroupId: async groupId =>
      Array.from(store.values()).filter(e => e.groupId === groupId),
    getFavourites: async () =>
      Array.from(store.values()).filter(e => e.isFavourite),
    save: async e => { store.set(e.id, e); },
    update: async e => {
      if (!store.has(e.id)) throw new Error('not found');
      store.set(e.id, e);
    },
    delete: async id => { store.delete(id); },
    clear: async () => {
      for (const [id, entry] of store) {
        if (!entry.isFavourite) store.delete(id);
      }
    },
  };
}

function makeProvider(entries: CopyHistoryEntry[] = []): HistoryTreeProvider {
  const repo = makeMockRepo(entries);
  const svc = new CopyHistoryService(repo);
  return new HistoryTreeProvider(svc);
}

// ─── Root sections ────────────────────────────────────────────────────────────

describe('HistoryTreeProvider – root sections', () => {
  it('returns two root sections', async () => {
    const provider = makeProvider();
    const roots = await provider.getChildren();

    expect(roots).toHaveLength(2);
    expect(roots[0].label).toBe('⭐ Favourites');
    expect(roots[1].label).toBe('🕐 Recent');
  });
});

// ─── Favourites section ───────────────────────────────────────────────────────

describe('HistoryTreeProvider – favourites section', () => {
  it('lists only favourite entries under the Favourites section', async () => {
    const fav = makeEntry({ isFavourite: true });
    const plain = makeEntry({ isFavourite: false });
    const provider = makeProvider([fav, plain]);

    const [favouritesSection] = await provider.getChildren();
    const children = await provider.getChildren(favouritesSection);

    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(HistoryItem);
    expect((children[0] as HistoryItem).entry.id).toBe(fav.id);
  });

  it('shows empty Favourites when none are starred', async () => {
    const provider = makeProvider([makeEntry()]);
    const [favouritesSection] = await provider.getChildren();
    const children = await provider.getChildren(favouritesSection);
    expect(children).toHaveLength(0);
  });
});

// ─── Recent section ───────────────────────────────────────────────────────────

describe('HistoryTreeProvider – recent section', () => {
  it('lists non-favourite entries under Recent', async () => {
    const fav = makeEntry({ isFavourite: true });
    const plain = makeEntry({ isFavourite: false });
    const provider = makeProvider([fav, plain]);

    const [, recentSection] = await provider.getChildren();
    const children = await provider.getChildren(recentSection);

    expect(children).toHaveLength(1);
    expect((children[0] as HistoryItem).entry.id).toBe(plain.id);
  });

  it('caps Recent at 50 entries', async () => {
    const entries = Array.from({ length: 60 }, () => makeEntry());
    const provider = makeProvider(entries);

    const [, recentSection] = await provider.getChildren();
    const children = await provider.getChildren(recentSection);

    expect(children.length).toBeLessThanOrEqual(50);
  });
});

// ─── FileItem construction ────────────────────────────────────────────────────

describe('HistoryTreeProvider – FileItem children', () => {
  it('builds one FileItem per file in the entry', async () => {
    const entry = makeEntry();
    const provider = makeProvider([entry]);

    const [, recentSection] = await provider.getChildren();
    const [historyItem] = await provider.getChildren(recentSection);
    const fileItems = await provider.getChildren(historyItem);

    expect(fileItems).toHaveLength(entry.files.length);
    expect(fileItems.every(f => f instanceof FileItem)).toBe(true);
  });

  it('sets fileUri on FileItem from the snapshot URI — used by addFileToGroup command', async () => {
    const entry = makeEntry();
    const provider = makeProvider([entry]);

    const [, recentSection] = await provider.getChildren();
    const [historyItem] = await provider.getChildren(recentSection);
    const fileItems = (await provider.getChildren(historyItem)) as FileItem[];

    expect(fileItems[0].fileUri).toBe('file:///src/foo.ts');
    expect(fileItems[1].fileUri).toBe('file:///src/bar.ts');
  });

  it('sets filePath (relativePath) on FileItem', async () => {
    const entry = makeEntry();
    const provider = makeProvider([entry]);

    const [, recentSection] = await provider.getChildren();
    const [historyItem] = await provider.getChildren(recentSection);
    const fileItems = (await provider.getChildren(historyItem)) as FileItem[];

    expect(fileItems[0].filePath).toBe('src/foo.ts');
    expect(fileItems[1].filePath).toBe('src/bar.ts');
  });

  it('marks FileItem with error when snapshot has an error', async () => {
    const entry = makeEntry();
    const provider = makeProvider([entry]);

    const [, recentSection] = await provider.getChildren();
    const [historyItem] = await provider.getChildren(recentSection);
    const fileItems = (await provider.getChildren(historyItem)) as FileItem[];

    expect(fileItems[0].hasError).toBe(false);
    expect(fileItems[1].hasError).toBe(true);
  });

  it('derives fileName from the last path segment of relativePath', async () => {
    const entry = makeEntry();
    const provider = makeProvider([entry]);

    const [, recentSection] = await provider.getChildren();
    const [historyItem] = await provider.getChildren(recentSection);
    const fileItems = (await provider.getChildren(historyItem)) as FileItem[];

    expect(fileItems[0].fileName).toBe('foo.ts');
    expect(fileItems[1].fileName).toBe('bar.ts');
  });

  it('returns no children for a FileItem (leaf node)', async () => {
    const entry = makeEntry();
    const provider = makeProvider([entry]);

    const [, recentSection] = await provider.getChildren();
    const [historyItem] = await provider.getChildren(recentSection);
    const [fileItem] = (await provider.getChildren(historyItem)) as FileItem[];

    const leafChildren = await provider.getChildren(fileItem);
    expect(leafChildren).toHaveLength(0);
  });
});

// ─── refresh ─────────────────────────────────────────────────────────────────

describe('HistoryTreeProvider – refresh', () => {
  it('fires onDidChangeTreeData when refresh() is called', () => {
    const provider = makeProvider();
    let fired = false;
    provider.onDidChangeTreeData(() => { fired = true; });
    provider.refresh();
    expect(fired).toBe(true);
  });
});
