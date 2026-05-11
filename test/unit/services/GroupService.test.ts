import { GroupService } from '../../../src/application/services/GroupService';
import { IGroupRepository } from '../../../src/domain/interfaces/IGroupRepository';
import { Group } from '../../../src/domain/entities/Group';

function makeMockRepo(initial: Group[] = []): IGroupRepository {
  const store = new Map<string, Group>(initial.map(g => [g.id, g]));

  return {
    getById: async (id) => store.get(id) ?? null,
    getAll: async () => Array.from(store.values()),
    save: async (g) => { store.set(g.id, g); },
    delete: async (id) => { store.delete(id); },
    findByTag: async (tag) => Array.from(store.values()).filter(g => g.tags.some(t => t.name === tag)),
    search: async (q) => {
      const lower = q.toLowerCase();
      return Array.from(store.values()).filter(
        g => g.name.toLowerCase().includes(lower) || g.description?.toLowerCase().includes(lower)
      );
    },
  };
}

describe('GroupService', () => {
  describe('createGroup', () => {
    it('creates a group with required fields', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Auth');
      expect(g.name).toBe('Auth');
      expect(g.id).toBeTruthy();
      expect(g.fileReferences).toEqual([]);
      expect(g.tags).toEqual([]);
      expect(g.isBookmarked).toBe(false);
    });

    it('stores description when provided', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('API', 'REST endpoints');
      expect(g.description).toBe('REST endpoints');
    });
  });

  describe('getAllGroups', () => {
    it('returns empty array when no groups exist', async () => {
      const svc = new GroupService(makeMockRepo());
      expect(await svc.getAllGroups()).toEqual([]);
    });

    it('returns all groups', async () => {
      const svc = new GroupService(makeMockRepo());
      await svc.createGroup('A');
      await svc.createGroup('B');
      const all = await svc.getAllGroups();
      expect(all).toHaveLength(2);
    });
  });

  describe('addFileToGroup', () => {
    it('adds a file reference to the group', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Test');
      await svc.addFileToGroup(g.id, 'file:///src/foo.ts', 'src/foo.ts');
      const updated = await svc.getGroup(g.id);
      expect(updated!.fileReferences).toHaveLength(1);
      expect(updated!.fileReferences[0].relativePath).toBe('src/foo.ts');
    });

    it('does not add duplicate file URIs', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Test');
      await svc.addFileToGroup(g.id, 'file:///src/foo.ts', 'src/foo.ts');
      await svc.addFileToGroup(g.id, 'file:///src/foo.ts', 'src/foo.ts');
      const updated = await svc.getGroup(g.id);
      expect(updated!.fileReferences).toHaveLength(1);
    });

    it('throws when group does not exist', async () => {
      const svc = new GroupService(makeMockRepo());
      await expect(svc.addFileToGroup('nonexistent', 'file:///f.ts', 'f.ts')).rejects.toThrow();
    });
  });

  describe('removeFileFromGroup', () => {
    it('removes a file reference', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Test');
      await svc.addFileToGroup(g.id, 'file:///src/foo.ts', 'src/foo.ts');
      await svc.removeFileFromGroup(g.id, 'file:///src/foo.ts');
      const updated = await svc.getGroup(g.id);
      expect(updated!.fileReferences).toHaveLength(0);
    });
  });

  describe('renameGroup', () => {
    it('renames a group', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Old');
      await svc.renameGroup(g.id, 'New');
      const updated = await svc.getGroup(g.id);
      expect(updated!.name).toBe('New');
    });
  });

  describe('toggleBookmark', () => {
    it('bookmarks and unbookmarks', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Test');
      expect(g.isBookmarked).toBe(false);

      const bookmarked = await svc.toggleBookmark(g.id);
      expect(bookmarked.isBookmarked).toBe(true);

      const unbookmarked = await svc.toggleBookmark(g.id);
      expect(unbookmarked.isBookmarked).toBe(false);
    });
  });

  describe('setContextMode', () => {
    it('updates the context mode', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Test');
      await svc.setContextMode(g.id, { type: 'skeleton' });
      const updated = await svc.getGroup(g.id);
      expect(updated!.contextMode.type).toBe('skeleton');
    });

    it('clears all file-level overrides when group mode is set', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Test');
      await svc.addFileToGroup(g.id, 'file:///a.ts', 'a.ts');
      await svc.addFileToGroup(g.id, 'file:///b.ts', 'b.ts');
      // Set per-file overrides
      await svc.setFileMode(g.id, 0, { type: 'skeleton' });
      await svc.setFileMode(g.id, 1, { type: 'docstring' });
      // Now set the group mode — overrides should be wiped
      await svc.setContextMode(g.id, { type: 'full' });
      const updated = await svc.getGroup(g.id);
      expect(updated!.fileReferences[0].overrideContextMode).toBeUndefined();
      expect(updated!.fileReferences[1].overrideContextMode).toBeUndefined();
    });
  });

  describe('setPreprompt', () => {
    it('attaches and removes a preprompt', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Test');

      const now = new Date();
      const preprompt = { id: 'p1', name: 'Security', template: 'Review: {{context}}', mode: 'review' as const, createdAt: now, updatedAt: now };
      await svc.setPreprompt(g.id, preprompt);
      const withPreprompt = await svc.getGroup(g.id);
      expect(withPreprompt!.preprompt?.name).toBe('Security');

      await svc.setPreprompt(g.id, undefined);
      const withoutPreprompt = await svc.getGroup(g.id);
      expect(withoutPreprompt!.preprompt).toBeUndefined();
    });
  });

  describe('getRecentGroups', () => {
    it('returns the most recently updated groups up to the limit', async () => {
      const svc = new GroupService(makeMockRepo());
      const a = await svc.createGroup('A');
      await new Promise(r => setTimeout(r, 5));
      await svc.createGroup('B');
      await new Promise(r => setTimeout(r, 5));
      await svc.createGroup('C');

      const recent = await svc.getRecentGroups(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].name).toBe('C');
      // A should not be in the top 2
      expect(recent.map(g => g.name)).not.toContain(a.name);
    });
  });

  describe('getBookmarkedGroups', () => {
    it('returns only bookmarked groups', async () => {
      const svc = new GroupService(makeMockRepo());
      const a = await svc.createGroup('A');
      await svc.createGroup('B');
      await svc.toggleBookmark(a.id);

      const bookmarked = await svc.getBookmarkedGroups();
      expect(bookmarked).toHaveLength(1);
      expect(bookmarked[0].name).toBe('A');
    });
  });

  describe('searchGroups', () => {
    it('finds groups by name substring', async () => {
      const svc = new GroupService(makeMockRepo());
      await svc.createGroup('Auth Module');
      await svc.createGroup('Payment Flow');

      const results = await svc.searchGroups('auth');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Auth Module');
    });
  });

  describe('deleteGroup', () => {
    it('removes the group', async () => {
      const svc = new GroupService(makeMockRepo());
      const g = await svc.createGroup('Temp');
      await svc.deleteGroup(g.id);
      expect(await svc.getGroup(g.id)).toBeNull();
    });
  });
});
