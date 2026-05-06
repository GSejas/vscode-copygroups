import { GroupEntity, validateGroup } from '../../../../src/domain/entities/Group';
import { Tag } from '../../../../src/domain/valueObjects/Tag';
import { FileReference } from '../../../../src/domain/valueObjects/FileReference';

describe('Group Entity', () => {
  describe('GroupEntity constructor', () => {
    it('creates a group with minimal data (happy path)', () => {
      const group = new GroupEntity({ name: 'My Files' });

      expect(group.name).toBe('My Files');
      expect(group.id).toBeTruthy();
      expect(group.id).toMatch(/^group-\d+-[a-z0-9]+$/);
      expect(group.fileReferences).toEqual([]);
      expect(group.tags).toEqual([]);
      expect(group.isBookmarked).toBe(false);
      expect(group.contextMode).toEqual({ type: 'full' });
      expect(group.createdAt).toBeInstanceOf(Date);
      expect(group.updatedAt).toBeInstanceOf(Date);
    });

    it('creates a group with full data (happy path)', () => {
      const fileRef: FileReference = { uri: 'file:///test.ts', relativePath: 'test.ts' };
      const tag: Tag = { id: 'tag-1', name: 'backend', color: '#FF0000' };
      const now = new Date();

      const group = new GroupEntity({
        id: 'group-123',
        name: 'Backend API',
        description: 'API services',
        fileReferences: [fileRef],
        tags: [tag],
        isBookmarked: true,
        contextMode: { type: 'skeleton' },
        createdAt: now,
        updatedAt: now,
        metadata: { owner: 'alice' },
      });

      expect(group.id).toBe('group-123');
      expect(group.name).toBe('Backend API');
      expect(group.description).toBe('API services');
      expect(group.fileReferences).toEqual([fileRef]);
      expect(group.tags).toEqual([tag]);
      expect(group.isBookmarked).toBe(true);
      expect(group.contextMode).toEqual({ type: 'skeleton' });
      expect(group.createdAt).toBe(now);
      expect(group.updatedAt).toBe(now);
      expect(group.metadata).toEqual({ owner: 'alice' });
    });

    it('generates unique IDs for groups created without explicit ID', () => {
      const group1 = new GroupEntity({ name: 'Group 1' });
      const group2 = new GroupEntity({ name: 'Group 2' });

      expect(group1.id).not.toBe(group2.id);
    });

    it('handles undefined optional fields gracefully', () => {
      const group = new GroupEntity({
        name: 'Test',
        description: undefined,
        preprompt: undefined,
        metadata: undefined,
      });

      expect(group.description).toBeUndefined();
      expect(group.preprompt).toBeUndefined();
      expect(group.metadata).toBeUndefined();
    });
  });

  describe('validateGroup', () => {
    it('validates a valid group (happy path)', () => {
      const group = new GroupEntity({ name: 'Valid Group' });

      expect(validateGroup(group)).toBe(true);
    });

    it('rejects null', () => {
      expect(validateGroup(null)).toBe(false);
    });

    it('rejects non-object', () => {
      expect(validateGroup('string')).toBe(false);
      expect(validateGroup(42)).toBe(false);
      expect(validateGroup(undefined)).toBe(false);
    });

    it('rejects missing required id', () => {
      const group = new GroupEntity({ name: 'Test' });
      const invalid = { ...group, id: undefined };

      expect(validateGroup(invalid)).toBe(false);
    });

    it('rejects missing required name', () => {
      const group = new GroupEntity({ name: 'Test' });
      const invalid = { ...group, name: undefined };

      expect(validateGroup(invalid)).toBe(false);
    });

    it('rejects non-array fileReferences', () => {
      const group = new GroupEntity({ name: 'Test' });
      const invalid = { ...group, fileReferences: 'not-array' };

      expect(validateGroup(invalid)).toBe(false);
    });

    it('rejects non-array tags', () => {
      const group = new GroupEntity({ name: 'Test' });
      const invalid = { ...group, tags: {} };

      expect(validateGroup(invalid)).toBe(false);
    });

    it('rejects non-boolean isBookmarked', () => {
      const group = new GroupEntity({ name: 'Test' });
      const invalid = { ...group, isBookmarked: 'yes' };

      expect(validateGroup(invalid)).toBe(false);
    });

    it('rejects missing or invalid contextMode', () => {
      const group = new GroupEntity({ name: 'Test' });

      expect(validateGroup({ ...group, contextMode: null })).toBe(false);
      expect(validateGroup({ ...group, contextMode: 'skeleton' })).toBe(false);
    });
  });
});
