import { createCopyHistoryEntry, CopiedFileSnapshot } from '../../../../src/domain/entities/CopyHistoryEntry';
import { ContextMode } from '../../../../src/domain/valueObjects/ContextMode';

describe('CopyHistoryEntry Entity', () => {
  describe('createCopyHistoryEntry', () => {
    const mockFileSnapshot: CopiedFileSnapshot = {
      uri: 'file:///src/test.ts',
      relativePath: 'src/test.ts',
      extractedContent: 'const x = 1;',
      contextMode: { type: 'full' } as ContextMode,
    };

    it('creates a history entry with minimal data (happy path)', () => {
      const entry = createCopyHistoryEntry(
        'group-123',
        'My Group',
        'output content',
        [mockFileSnapshot],
        { type: 'skeleton' },
        'clipboard'
      );

      expect(entry.id).toBeTruthy();
      expect(entry.id).toMatch(/^copy-\d+-[a-z0-9]+$/);
      expect(entry.groupId).toBe('group-123');
      expect(entry.groupName).toBe('My Group');
      expect(entry.output).toBe('output content');
      expect(entry.files).toEqual([mockFileSnapshot]);
      expect(entry.contextMode).toEqual({ type: 'skeleton' });
      expect(entry.trigger).toBe('clipboard');
      expect(entry.isFavourite).toBe(false);
      expect(entry.prepromptName).toBeUndefined();
      expect(entry.note).toBeUndefined();
      expect(entry.copiedAt).toBeInstanceOf(Date);
    });

    it('creates a history entry with full data (happy path)', () => {
      const files: CopiedFileSnapshot[] = [
        mockFileSnapshot,
        {
          uri: 'file:///src/api.ts',
          relativePath: 'src/api.ts',
          extractedContent: 'export function api() {}',
          contextMode: { type: 'skeleton' },
          sizeBytes: 250,
        },
      ];

      const entry = createCopyHistoryEntry(
        'group-456',
        'Backend Services',
        'full markdown output',
        files,
        { type: 'full' },
        'export-markdown',
        'Security Review'
      );

      expect(entry.groupId).toBe('group-456');
      expect(entry.groupName).toBe('Backend Services');
      expect(entry.output).toBe('full markdown output');
      expect(entry.files).toEqual(files);
      expect(entry.contextMode).toEqual({ type: 'full' });
      expect(entry.trigger).toBe('export-markdown');
      expect(entry.prepromptName).toBe('Security Review');
      expect(entry.isFavourite).toBe(false);
      expect(entry.id).toBeTruthy();
      expect(entry.copiedAt).toBeInstanceOf(Date);
    });

    it('creates unique IDs for different entries', () => {
      const entry1 = createCopyHistoryEntry('g1', 'G1', 'out1', [], { type: 'full' }, 'clipboard');
      const entry2 = createCopyHistoryEntry('g2', 'G2', 'out2', [], { type: 'full' }, 'clipboard');

      expect(entry1.id).not.toBe(entry2.id);
    });

    it('defaults isFavourite to false', () => {
      const entry = createCopyHistoryEntry(
        'group-123',
        'Test',
        'output',
        [mockFileSnapshot],
        { type: 'full' },
        'clipboard'
      );

      expect(entry.isFavourite).toBe(false);
    });

    it('supports all valid copy triggers', () => {
      const triggers = ['clipboard', 'export-markdown', 'export-json', 'direct-multi-file', 'folder-contents'] as const;

      triggers.forEach((trigger) => {
        const entry = createCopyHistoryEntry('g', 'G', 'o', [], { type: 'full' }, trigger);
        expect(entry.trigger).toBe(trigger);
      });
    });

    it('sets copiedAt to current date', () => {
      const beforeCreate = new Date();
      const entry = createCopyHistoryEntry('g', 'G', 'o', [], { type: 'full' }, 'clipboard');
      const afterCreate = new Date();

      expect(entry.copiedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(entry.copiedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });

    it('preserves empty files array', () => {
      const entry = createCopyHistoryEntry('g', 'G', 'output', [], { type: 'full' }, 'clipboard');

      expect(entry.files).toEqual([]);
    });

    it('preserves multiple file snapshots with error info', () => {
      const files: CopiedFileSnapshot[] = [
        mockFileSnapshot,
        {
          uri: 'file:///src/error.ts',
          relativePath: 'src/error.ts',
          extractedContent: '',
          contextMode: { type: 'skeleton' },
          error: 'File not found',
        },
      ];

      const entry = createCopyHistoryEntry('g', 'G', 'output', files, { type: 'full' }, 'clipboard');

      expect(entry.files).toHaveLength(2);
      expect(entry.files[0].error).toBeUndefined();
      expect(entry.files[1].error).toBe('File not found');
    });

    it('supports optional prepromptName', () => {
      const entryWithoutPreprompt = createCopyHistoryEntry(
        'g',
        'G',
        'o',
        [],
        { type: 'full' },
        'clipboard'
      );

      const entryWithPreprompt = createCopyHistoryEntry(
        'g',
        'G',
        'o',
        [],
        { type: 'full' },
        'clipboard',
        'Architecture Review'
      );

      expect(entryWithoutPreprompt.prepromptName).toBeUndefined();
      expect(entryWithPreprompt.prepromptName).toBe('Architecture Review');
    });

    it('preserves all context mode types', () => {
      const modes: ContextMode[] = [
        { type: 'full' },
        { type: 'skeleton' },
        { type: 'docstring' },
        { type: 'headers', maxLines: 100 },
        { type: 'head-tail', headLines: 5, tailLines: 3 },
        { type: 'smart', heuristic: 'main-exports' },
      ];

      modes.forEach((mode) => {
        const entry = createCopyHistoryEntry('g', 'G', 'o', [], mode, 'clipboard');
        expect(entry.contextMode).toEqual(mode);
      });
    });
  });
});
