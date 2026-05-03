import { ExportService } from '../../../src/application/services/ExportService';
import { ContextExtractionService } from '../../../src/application/services/ContextExtractionService';
import { CopyHistoryService } from '../../../src/application/services/CopyHistoryService';
import { IFileContentProvider } from '../../../src/domain/interfaces/IFileContentProvider';
import { ConfigRepository } from '../../../src/infrastructure/repositories/ConfigRepository';
import { DEFAULT_COPY_CONFIG } from '../../../src/domain/valueObjects/CopyConfig';
import { env, workspace, FileType } from 'vscode';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFileProvider(files: Record<string, string> = {}): IFileContentProvider {
  return {
    getContent: async (uri) => files[uri] ?? 'content',
    fileExists: async (uri) => uri in files,
    getRelativePath: async (uri) => uri.replace('file:///', ''),
    getFileLanguage: async () => 'typescript',
  };
}

function makeContextExtraction(fileProvider: IFileContentProvider): ContextExtractionService {
  return new ContextExtractionService(fileProvider);
}

function makeHistoryService(): { service: CopyHistoryService; recorded: unknown[] } {
  const recorded: unknown[] = [];
  const mockRepo: any = {
    getAll: async () => [],
    getById: async () => null,
    getByGroupId: async () => [],
    getFavourites: async () => [],
    save: async (e: unknown) => { recorded.push(e); },
    update: async () => {},
    delete: async () => {},
    clear: async () => {},
  };
  return { service: new CopyHistoryService(mockRepo), recorded };
}

function makeConfigRepo(overrides: Partial<typeof DEFAULT_COPY_CONFIG> = {}): ConfigRepository {
  const config = { ...DEFAULT_COPY_CONFIG, ...overrides };
  const mockMemento: any = {
    get: () => config,
    update: async () => {},
    keys: () => [],
  };
  const repo = new ConfigRepository(mockMemento);
  // Override get() to return config synchronously
  (repo as any).config = config;
  repo.get = async () => config;
  return repo;
}

function makeExportService(
  files: Record<string, string> = {},
  configOverrides: Partial<typeof DEFAULT_COPY_CONFIG> = {}
) {
  const fileProvider = makeFileProvider(files);
  const contextExtraction = makeContextExtraction(fileProvider);
  const { service: historyService, recorded } = makeHistoryService();
  const configRepo = makeConfigRepo(configOverrides);
  const exportService = new ExportService(contextExtraction, fileProvider, historyService, configRepo);
  return { exportService, historyService, recorded };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (workspace.fs.stat as jest.Mock).mockResolvedValue({ size: 100, type: FileType.File });
  });

  describe('copySelectedFiles', () => {
    it('writes output to clipboard', async () => {
      const { exportService } = makeExportService({ 'file:///src/foo.ts': 'const x = 1;' });
      await exportService.copySelectedFiles(['file:///src/foo.ts'], { type: 'full' });
      expect(env.clipboard.writeText).toHaveBeenCalledTimes(1);
    });

    it('output contains the file path as a heading', async () => {
      const { exportService } = makeExportService({ 'file:///src/foo.ts': 'const x = 1;' });
      await exportService.copySelectedFiles(['file:///src/foo.ts'], { type: 'full' });
      const output = (env.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
      expect(output).toContain('src/foo.ts');
    });

    it('uses typescript language tag in code fence', async () => {
      const { exportService } = makeExportService({ 'file:///src/foo.ts': 'const x = 1;' });
      await exportService.copySelectedFiles(['file:///src/foo.ts'], { type: 'full' });
      const output = (env.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
      expect(output).toContain('```typescript');
    });

    it('uses python language tag for .py files', async () => {
      const { exportService } = makeExportService({ 'file:///src/script.py': 'def foo(): pass' });
      await exportService.copySelectedFiles(['file:///src/script.py'], { type: 'full' });
      const output = (env.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
      expect(output).toContain('```python');
    });

    it('records a history entry', async () => {
      const { exportService, recorded } = makeExportService({ 'file:///src/foo.ts': 'const x = 1;' });
      await exportService.copySelectedFiles(['file:///src/foo.ts'], { type: 'full' });
      expect(recorded).toHaveLength(1);
    });

    it('uses filename as entry name for a single successful file', async () => {
      const { exportService, recorded } = makeExportService({ 'file:///src/foo.ts': 'const x = 1;' });
      await exportService.copySelectedFiles(['file:///src/foo.ts'], { type: 'full' });
      const entry = (recorded[0] as any);
      expect(entry.groupName).toBe('foo.ts');
    });

    it('uses count+timestamp for multi-file entry name', async () => {
      const files = {
        'file:///src/a.ts': 'a',
        'file:///src/b.ts': 'b',
      };
      const { exportService, recorded } = makeExportService(files);
      await exportService.copySelectedFiles(Object.keys(files), { type: 'full' });
      const entry = (recorded[0] as any);
      expect(entry.groupName).toMatch(/2 files/);
    });

    it('respects maxFileCount limit', async () => {
      const files = {
        'file:///a.ts': 'a',
        'file:///b.ts': 'b',
        'file:///c.ts': 'c',
      };
      const { exportService } = makeExportService(files, { maxFileCount: 2 });
      await exportService.copySelectedFiles(Object.keys(files), { type: 'full' });
      const output = (env.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
      expect(output).toContain('Skipped Files');
    });

    it('skips files that do not exist', async () => {
      const { exportService } = makeExportService({});
      await exportService.copySelectedFiles(['file:///missing.ts'], { type: 'full' });
      const output = (env.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
      expect(output).toContain('File not found');
    });

    it('skips binary files when skipBinaryFiles is true', async () => {
      const { exportService } = makeExportService({ 'file:///image.png': '' }, { skipBinaryFiles: true });
      await exportService.copySelectedFiles(['file:///image.png'], { type: 'full' });
      const output = (env.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
      expect(output).toContain('Binary file skipped');
    });
  });

  describe('copyGroup', () => {
    it('copies group files and records history', async () => {
      const { exportService, recorded } = makeExportService({ 'file:///src/a.ts': 'const a = 1;' });
      const group: any = {
        id: 'g1',
        name: 'My Group',
        description: undefined,
        fileReferences: [{ uri: 'file:///src/a.ts', relativePath: 'src/a.ts', contextMode: { type: 'full' } }],
        contextMode: { type: 'full' },
        tags: [],
        isBookmarked: false,
        preprompt: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await exportService.copyGroup(group);
      expect(env.clipboard.writeText).toHaveBeenCalledTimes(1);
      expect(recorded).toHaveLength(1);
      const output = (env.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
      expect(output).toContain('# Files from Group: My Group');
    });

    it('renders file-not-found error for missing files', async () => {
      const { exportService } = makeExportService({});
      const group: any = {
        id: 'g1', name: 'G', description: undefined,
        fileReferences: [{ uri: 'file:///gone.ts', relativePath: 'gone.ts', contextMode: { type: 'full' } }],
        contextMode: { type: 'full' }, tags: [], isBookmarked: false, preprompt: undefined,
        createdAt: new Date(), updatedAt: new Date(),
      };
      await exportService.copyGroup(group);
      const output = (env.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
      expect(output).toContain('File not found');
    });
  });
});
