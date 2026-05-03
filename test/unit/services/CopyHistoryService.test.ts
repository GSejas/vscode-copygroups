/**
 * Unit tests for CopyHistoryService
 */

import { CopyHistoryService } from '../../../src/application/services/CopyHistoryService';
import { ICopyHistoryRepository } from '../../../src/domain/interfaces/ICopyHistoryRepository';
import { CopyHistoryEntry, createCopyHistoryEntry } from '../../../src/domain/entities/CopyHistoryEntry';

function makeEntry(overrides?: Partial<CopyHistoryEntry>): CopyHistoryEntry {
  return createCopyHistoryEntry(
    'group-1',
    'My Group',
    '# output',
    [{ uri: 'file:///src/foo.py', relativePath: 'src/foo.py', extractedContent: 'def foo(): ...', contextMode: { type: 'skeleton' } }],
    { type: 'skeleton' },
    'clipboard',
    undefined
  );
}

function makeMockRepo(initial: CopyHistoryEntry[] = []): ICopyHistoryRepository {
  const store = new Map<string, CopyHistoryEntry>(initial.map(e => [e.id, e]));

  return {
    getAll: async () =>
      Array.from(store.values()).sort((a, b) => b.copiedAt.getTime() - a.copiedAt.getTime()),
    getById: async (id) => store.get(id) ?? null,
    getByGroupId: async (groupId) =>
      Array.from(store.values()).filter(e => e.groupId === groupId),
    getFavourites: async () =>
      Array.from(store.values()).filter(e => e.isFavourite),
    save: async (e) => { store.set(e.id, e); },
    update: async (e) => {
      if (!store.has(e.id)) throw new Error('not found');
      store.set(e.id, e);
    },
    delete: async (id) => { store.delete(id); },
    clear: async () => {
      for (const [id, entry] of store) {
        if (!entry.isFavourite) store.delete(id);
      }
    },
  };
}

describe('CopyHistoryService', () => {
  it('records a copy and returns the saved entry', async () => {
    const repo = makeMockRepo();
    const svc = new CopyHistoryService(repo);

    const group: any = {
      id: 'g1',
      name: 'Group 1',
      contextMode: { type: 'full' },
      preprompt: undefined,
    };

    const entry = await svc.record(group, '# output', [], 'clipboard');

    expect(entry.groupId).toBe('g1');
    expect(entry.groupName).toBe('Group 1');
    expect(entry.trigger).toBe('clipboard');
    expect(entry.isFavourite).toBe(false);
  });

  it('toggles favourite on and off', async () => {
    const initial = makeEntry();
    const repo = makeMockRepo([initial]);
    const svc = new CopyHistoryService(repo);

    const favoured = await svc.toggleFavourite(initial.id);
    expect(favoured.isFavourite).toBe(true);

    const unfavoured = await svc.toggleFavourite(initial.id);
    expect(unfavoured.isFavourite).toBe(false);
  });

  it('sets and clears notes', async () => {
    const initial = makeEntry();
    const repo = makeMockRepo([initial]);
    const svc = new CopyHistoryService(repo);

    const withNote = await svc.setNote(initial.id, 'check auth');
    expect(withNote.note).toBe('check auth');

    const cleared = await svc.setNote(initial.id, undefined);
    expect(cleared.note).toBeUndefined();
  });

  it('clear() removes non-favourites and keeps favourites', async () => {
    const favEntry = { ...makeEntry(), isFavourite: true };
    const plainEntry = makeEntry();
    const repo = makeMockRepo([favEntry, plainEntry]);
    const svc = new CopyHistoryService(repo);

    await svc.clearHistory();

    const remaining = await svc.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].isFavourite).toBe(true);
  });

  it('counts copy operations per group', async () => {
    const repo = makeMockRepo([makeEntry(), makeEntry()]);
    const svc = new CopyHistoryService(repo);

    const count = await svc.getCopyCountForGroup('group-1');
    expect(count).toBe(2);
  });

  it('throws when toggling favourite on missing entry', async () => {
    const repo = makeMockRepo();
    const svc = new CopyHistoryService(repo);

    await expect(svc.toggleFavourite('nonexistent')).rejects.toThrow();
  });
});
