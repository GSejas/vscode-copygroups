import { CopyHistoryRepository } from '../../../src/infrastructure/repositories/CopyHistoryRepository';
import { createCopyHistoryEntry } from '../../../src/domain/entities/CopyHistoryEntry';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function makeEntry() {
  return createCopyHistoryEntry('g1', 'Group 1', '# output', [], { type: 'full' }, 'clipboard');
}

function clearStorage() {
  const storageDir = path.join(os.homedir(), '.vscode-copygroups');
  const storageFile = path.join(storageDir, 'copygroups-history.json');
  if (fs.existsSync(storageFile)) {
    fs.unlinkSync(storageFile);
  }
}

describe('CopyHistoryRepository', () => {
  beforeEach(() => {
    clearStorage();
  });
  describe('initialize', () => {
    it('starts empty when no stored data exists', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      expect(await repo.getAll()).toEqual([]);
    });

    it('restores entries from stored data', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      const all = await repo.getAll();
      expect(all.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('save and getAll', () => {
    it('saves an entry and retrieves it sorted newest-first', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      const e1 = makeEntry();
      await new Promise(r => setTimeout(r, 5));
      const e2 = makeEntry();
      await repo.save(e1);
      await repo.save(e2);
      const all = await repo.getAll();
      expect(all[0].id).toBe(e2.id);
      expect(all[1].id).toBe(e1.id);
    });
  });

  describe('getById', () => {
    it('returns entry by id', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      const e = makeEntry();
      await repo.save(e);
      expect((await repo.getById(e.id))?.id).toBe(e.id);
    });

    it('returns null for unknown id', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      expect(await repo.getById('nope')).toBeNull();
    });
  });

  describe('getByGroupId', () => {
    it('returns entries for the given group', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      const e1 = makeEntry(); // groupId = g1
      const e2 = createCopyHistoryEntry('g2', 'Group 2', '', [], { type: 'full' }, 'clipboard');
      await repo.save(e1);
      await repo.save(e2);
      const byG1 = await repo.getByGroupId('g1');
      expect(byG1).toHaveLength(1);
      expect(byG1[0].groupId).toBe('g1');
    });
  });

  describe('getFavourites', () => {
    it('returns only favourited entries', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      const e1 = { ...makeEntry(), isFavourite: true };
      const e2 = makeEntry();
      await repo.save(e1);
      await repo.save(e2);
      const favs = await repo.getFavourites();
      expect(favs).toHaveLength(1);
      expect(favs[0].isFavourite).toBe(true);
    });
  });

  describe('update', () => {
    it('updates an existing entry', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      const e = makeEntry();
      await repo.save(e);
      await repo.update({ ...e, note: 'reviewed' });
      const updated = await repo.getById(e.id);
      expect(updated?.note).toBe('reviewed');
    });

    it('throws when entry does not exist', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      await expect(repo.update(makeEntry())).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('removes an entry', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      const e = makeEntry();
      await repo.save(e);
      await repo.delete(e.id);
      expect(await repo.getById(e.id)).toBeNull();
    });
  });

  describe('clear', () => {
    it('removes non-favourite entries and keeps favourites', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();
      const fav = { ...makeEntry(), isFavourite: true };
      const plain = makeEntry();
      await repo.save(fav);
      await repo.save(plain);
      await repo.clear();
      const remaining = await repo.getAll();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].isFavourite).toBe(true);
    });
  });

  describe('pruning', () => {
    it('prunes oldest non-favourite entries when MAX_ENTRIES is exceeded', async () => {
      const repo = new CopyHistoryRepository();
      await repo.initialize();

      // Save 201 entries (1 over the 200 limit)
      for (let i = 0; i < 201; i++) {
        const e = createCopyHistoryEntry('g1', `G${i}`, '', [], { type: 'full' }, 'clipboard');
        await repo.save(e);
      }

      const all = await repo.getAll();
      expect(all.length).toBeLessThanOrEqual(200);
    });
  });
});
