/**
 * ExportService
 * Handles exporting groups in various formats.
 * Every copy/export is automatically recorded in CopyHistoryService
 * so users can review, favourite, and re-copy past operations.
 */

import * as vscode from 'vscode';
import { Group } from '../../domain/entities/Group';
import { CopiedFileSnapshot } from '../../domain/entities/CopyHistoryEntry';
import { ContextMode, ContextModeType } from '../../domain/valueObjects/ContextMode';
import { CopyConfig } from '../../domain/valueObjects/CopyConfig';
import { ContextExtractionService } from './ContextExtractionService';
import { CopyHistoryService, CopySource } from './CopyHistoryService';
import { IFileContentProvider } from '../../domain/interfaces/IFileContentProvider';
import { ConfigRepository } from '../../infrastructure/repositories/ConfigRepository';
import { PatternMatcher, isBinaryFile } from '../../utils/patternMatcher';
import { addLineNumbers } from '../../utils/lineNumberer';

export interface ExportOptions {
  includePreprompt?: boolean;
}

interface ProcessResult {
  snapshots: CopiedFileSnapshot[];
  relativePaths: string[];
  skippedReasons: Map<string, string>;
  totalSize: number;
  fileCount: number;
}

export class ExportService {
  constructor(
    private contextExtraction: ContextExtractionService,
    private fileProvider: IFileContentProvider,
    private historyService: CopyHistoryService,
    private configRepo: ConfigRepository
  ) {}

  // ─── Shared file processing ───────────────────────────────────────────────

  private async processFiles(
    fileUris: string[],
    contextMode: ContextMode,
    config: CopyConfig,
    skipPatternCheck = false
  ): Promise<ProcessResult> {
    const snapshots: CopiedFileSnapshot[] = [];
    const relativePaths: string[] = [];
    const skippedReasons = new Map<string, string>();
    let totalSize = 0;
    let fileCount = 0;

    for (const fileUri of fileUris) {
      if (fileCount >= config.maxFileCount) {
        skippedReasons.set(fileUri, `Max file count (${config.maxFileCount}) reached`);
        continue;
      }
      if (totalSize >= config.maxTotalSizeBytes) {
        skippedReasons.set(fileUri, 'Max total size reached');
        continue;
      }

      try {
        const exists = await this.fileProvider.fileExists(fileUri);
        if (!exists) {
          snapshots.push({ uri: fileUri, relativePath: fileUri, extractedContent: '', contextMode, error: 'File not found' });
          skippedReasons.set(fileUri, 'File not found');
          continue;
        }

        // Pattern + binary + size checks (pattern skipped when walkDirectory already filtered)
        if (!skipPatternCheck) {
          const relativePath = await this.fileProvider.getRelativePath(fileUri);
          const matcher = new PatternMatcher(config.includePatterns, config.excludePatterns);
          if (!matcher.shouldInclude(relativePath)) {
            skippedReasons.set(fileUri, 'Excluded by pattern');
            continue;
          }
        }

        if (config.skipBinaryFiles) {
          const rp = await this.fileProvider.getRelativePath(fileUri);
          if (isBinaryFile(rp)) {
            skippedReasons.set(fileUri, 'Binary file skipped');
            continue;
          }
        }

        const stat = await vscode.workspace.fs.stat(vscode.Uri.parse(fileUri));
        if (stat.size > config.maxFileSizeBytes) {
          skippedReasons.set(fileUri, `File too large (${(stat.size / 1024).toFixed(0)} KB)`);
          continue;
        }

        const relativePath = await this.fileProvider.getRelativePath(fileUri);
        const content = await this.contextExtraction.extract(fileUri, contextMode);
        const size = new Blob([content]).size;

        if (totalSize + size > config.maxTotalSizeBytes) {
          skippedReasons.set(fileUri, 'Would exceed total size limit');
          continue;
        }

        relativePaths.push(relativePath);
        snapshots.push({ uri: fileUri, relativePath, extractedContent: content, contextMode });
        totalSize += size;
        fileCount++;
      } catch (err) {
        snapshots.push({ uri: fileUri, relativePath: fileUri, extractedContent: '', contextMode, error: String(err) });
        skippedReasons.set(fileUri, String(err));
      }
    }

    return { snapshots, relativePaths, skippedReasons, totalSize, fileCount };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Unified copy context entry point.
   * - Single folder → recursive scan
   * - Single file or multiple items → multi-file copy
   */
  async copyContext(uris: vscode.Uri[], contextMode?: ContextMode): Promise<void> {
    if (!uris || uris.length === 0) {
      throw new Error('No files or folders selected');
    }

    const config = await this.configRepo.get();
    const mode: ContextMode = contextMode || { type: config.defaultContextMode as ContextModeType };

    if (uris.length === 1) {
      const uri = uris[0];
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          await this.copyFolder(uri.toString(), mode);
        } else {
          await this.copySelectedFiles([uri.toString()], mode);
        }
      } catch (err) {
        throw new Error(`Cannot access item: ${String(err)}`);
      }
    } else {
      await this.copySelectedFiles(uris.map(u => u.toString()), mode);
    }
  }

  async copySelectedFiles(
    fileUris: string[],
    contextMode: ContextMode = { type: 'full' }
  ): Promise<void> {
    const config = await this.configRepo.get();
    const { snapshots, relativePaths, skippedReasons, totalSize } =
      await this.processFiles(fileUris, contextMode, config);

    const output = this.renderMultiFileMarkdown(snapshots, relativePaths, skippedReasons, totalSize, config);
    await vscode.env.clipboard.writeText(output);

    const successCount = snapshots.filter(s => !s.error).length;
    let entryName: string;
    if (successCount === 1 && relativePaths[0]) {
      entryName = relativePaths[0].split(/[/\\]/).pop() || relativePaths[0];
    } else {
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      entryName = `${successCount} file${successCount !== 1 ? 's' : ''} • ${timestamp}`;
    }

    const source: CopySource = { id: `direct-${Date.now()}`, name: entryName, contextMode };
    await this.historyService.record(source, output, snapshots, 'direct-multi-file');
  }

  async copyFolder(
    folderUri: string,
    contextMode: ContextMode = { type: 'skeleton' },
    maxDepth = 10
  ): Promise<void> {
    const config = await this.configRepo.get();
    const folderVsCodeUri = vscode.Uri.parse(folderUri);
    const folderName = folderVsCodeUri.fsPath.split(/[\\/]/).pop() || 'folder';

    const fileUris: string[] = [];
    await this.walkDirectory(folderVsCodeUri, fileUris, Math.min(maxDepth, config.maxDirectoryDepth), 0, config);

    if (fileUris.length === 0) {
      throw new Error('No files found in folder');
    }

    // Pattern already applied by walkDirectory; skip it in processFiles
    const { snapshots, relativePaths, skippedReasons, totalSize, fileCount } =
      await this.processFiles(fileUris, contextMode, config, true);

    if (fileCount === 0) {
      throw new Error('No files matched after filtering');
    }

    const output = this.renderFolderMarkdown(folderName, snapshots, relativePaths, skippedReasons, totalSize, config);
    await vscode.env.clipboard.writeText(output);

    const entryName = `${folderName} (${fileCount} file${fileCount !== 1 ? 's' : ''})`;
    const source: CopySource = { id: `folder-${Date.now()}`, name: entryName, contextMode };
    await this.historyService.record(source, output, snapshots, 'folder-contents');
  }

  async copyGroup(group: Group): Promise<void> {
    const { output, snapshots } = await this.buildOutput(group);
    await vscode.env.clipboard.writeText(output);
    await this.historyService.record(group, output, snapshots, 'clipboard');
  }

  async exportToMarkdown(group: Group, options: ExportOptions = {}): Promise<string> {
    const { output, snapshots } = await this.buildOutput(group, options.includePreprompt);
    await this.historyService.record(group, output, snapshots, 'export-markdown');
    return output;
  }

  /**
   * Export to JSON string and log as an export operation.
   * The JSON export does not include extracted file content — it serialises
   * the group configuration only. History still records the event.
   */
  async exportToJSON(group: Group): Promise<string> {
    const json = JSON.stringify({ ...group, exportedAt: new Date().toISOString() }, null, 2);
    await this.historyService.record(group, json, [], 'export-json');
    return json;
  }

  // ─── Core group builder ───────────────────────────────────────────────────

  /**
   * Shared extraction path. Gathers per-file snapshots once so the same
   * pass is used both for rendering output and for the history record.
   */
  private async buildOutput(
    group: Group,
    includePreprompt = true
  ): Promise<{ output: string; snapshots: CopiedFileSnapshot[] }> {
    const config = await this.configRepo.get();
    const snapshots: CopiedFileSnapshot[] = [];

    for (const fileRef of group.fileReferences) {
      const effectiveMode = fileRef.overrideContextMode || group.contextMode;
      try {
        const exists = await this.fileProvider.fileExists(fileRef.uri);
        if (!exists) {
          snapshots.push({ uri: fileRef.uri, relativePath: fileRef.relativePath, extractedContent: '', contextMode: effectiveMode, error: 'File not found' });
          continue;
        }
        const extractedContent = await this.contextExtraction.extract(fileRef.uri, effectiveMode);
        snapshots.push({ uri: fileRef.uri, relativePath: fileRef.relativePath, extractedContent, contextMode: effectiveMode });
      } catch (err) {
        snapshots.push({ uri: fileRef.uri, relativePath: fileRef.relativePath, extractedContent: '', contextMode: effectiveMode, error: String(err) });
      }
    }

    const output = group.preprompt && includePreprompt
      ? this.renderWithPreprompt(group, snapshots, config)
      : this.renderMarkdown(group, snapshots, config);

    return { output, snapshots };
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  private renderMarkdown(group: Group, snapshots: CopiedFileSnapshot[], config?: CopyConfig): string {
    const parts: string[] = [];

    parts.push(`# Files from Group: ${group.name}\n`);
    if (group.description) {
      parts.push(`> ${group.description}\n`);
    }
    parts.push(`Context Mode: \`${group.contextMode.type}\`\n`);
    parts.push(`Files: ${group.fileReferences.length}\n`);
    if (group.tags.length > 0) {
      parts.push(`Tags: ${group.tags.map(t => `\`${t.name}\``).join(', ')}\n`);
    }
    parts.push('\n---\n\n');

    for (const snap of snapshots) {
      parts.push(`## ${snap.relativePath}\n\n`);
      if (snap.error) {
        parts.push(`> ⚠️ ${snap.error}\n\n`);
      } else {
        const lang = getLanguageTag(snap.relativePath);
        const content = config?.addLineNumbers ? addLineNumbers(snap.extractedContent) : snap.extractedContent;
        parts.push(`\`\`\`${lang}\n`);
        parts.push(content);
        parts.push('\n```\n\n');
      }
    }

    return parts.join('');
  }

  private renderMultiFileMarkdown(
    snapshots: CopiedFileSnapshot[],
    relativePaths: string[],
    skippedReasons: Map<string, string>,
    totalSize: number,
    config?: CopyConfig
  ): string {
    const parts: string[] = [];

    const successCount = snapshots.filter(s => !s.error).length;
    parts.push(`# Multi-File Copy\n`);
    parts.push(`Files: ${successCount} / ${snapshots.length}\n`);
    parts.push(`Size: ${(totalSize / 1024).toFixed(1)} KB\n`);
    parts.push(`Context Mode: \`${snapshots[0]?.contextMode.type || 'full'}\`\n`);

    if (relativePaths.length > 0) {
      parts.push(`\n## Included Files\n`);
      parts.push(`${relativePaths.map(p => `• \`${p}\``).join('\n')}\n`);
    }

    if (skippedReasons.size > 0) {
      parts.push(`\n## Skipped Files (${skippedReasons.size})\n`);
      skippedReasons.forEach((reason, path) => {
        parts.push(`• \`${path}\` — ${reason}\n`);
      });
    }

    parts.push('\n---\n\n');

    for (const snap of snapshots) {
      parts.push(`## ${snap.relativePath}\n\n`);
      if (snap.error) {
        parts.push(`> ⚠️ ${snap.error}\n\n`);
      } else {
        const lang = getLanguageTag(snap.relativePath);
        const content = config?.addLineNumbers ? addLineNumbers(snap.extractedContent) : snap.extractedContent;
        parts.push(`\`\`\`${lang}\n`);
        parts.push(content);
        parts.push('\n```\n\n');
      }
    }

    return parts.join('');
  }

  private renderFolderMarkdown(
    folderName: string,
    snapshots: CopiedFileSnapshot[],
    relativePaths: string[],
    skippedReasons: Map<string, string>,
    totalSize: number,
    config?: CopyConfig
  ): string {
    const parts: string[] = [];

    const successCount = snapshots.filter(s => !s.error).length;
    parts.push(`# Folder: ${folderName}\n`);
    parts.push(`Files: ${successCount} / ${snapshots.length}\n`);
    parts.push(`Size: ${(totalSize / 1024).toFixed(1)} KB\n`);
    parts.push(`Context Mode: \`${snapshots[0]?.contextMode.type || 'skeleton'}\`\n`);

    if (relativePaths.length > 0) {
      parts.push(`\n## Included Files (${relativePaths.length})\n`);
      parts.push(`${relativePaths.map(p => `• \`${p}\``).join('\n')}\n`);
    }

    if (skippedReasons.size > 0) {
      parts.push(`\n## Skipped Items (${skippedReasons.size})\n`);
      skippedReasons.forEach((reason, path) => {
        parts.push(`• \`${path}\` — ${reason}\n`);
      });
    }

    parts.push('\n---\n\n');

    for (const snap of snapshots) {
      parts.push(`## ${snap.relativePath}\n\n`);
      if (snap.error) {
        parts.push(`> ⚠️ ${snap.error}\n\n`);
      } else {
        const lang = getLanguageTag(snap.relativePath);
        const content = config?.addLineNumbers ? addLineNumbers(snap.extractedContent) : snap.extractedContent;
        parts.push(`\`\`\`${lang}\n`);
        parts.push(content);
        parts.push('\n```\n\n');
      }
    }

    return parts.join('');
  }

  private renderWithPreprompt(group: Group, snapshots: CopiedFileSnapshot[], config?: CopyConfig): string {
    if (!group.preprompt) {
      return this.renderMarkdown(group, snapshots, config);
    }

    const contextText = snapshots
      .filter(s => !s.error)
      .map(s => {
        const lang = getLanguageTag(s.relativePath);
        const content = config?.addLineNumbers ? addLineNumbers(s.extractedContent) : s.extractedContent;
        return `### ${s.relativePath}\n\`\`\`${lang}\n${content}\n\`\`\``;
      })
      .join('\n\n');

    const variables: Record<string, string> = {
      context: contextText,
      groupName: group.name,
      fileCount: String(group.fileReferences.length),
      timestamp: new Date().toISOString(),
      mode: group.contextMode.type,
      ...group.preprompt.variables,
    };

    let result = group.preprompt.template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  // ─── Directory walker ─────────────────────────────────────────────────────

  private async walkDirectory(
    dirUri: vscode.Uri,
    fileUris: string[],
    maxDepth: number,
    currentDepth: number,
    config?: CopyConfig
  ): Promise<void> {
    if (currentDepth >= maxDepth) return;

    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      const matcher = config ? new PatternMatcher(config.includePatterns, config.excludePatterns) : null;

      for (const [name, type] of entries) {
        if (name.startsWith('.') || name === 'node_modules') {
          continue;
        }

        const childUri = vscode.Uri.joinPath(dirUri, name);
        const relativePath = await this.fileProvider.getRelativePath(childUri.toString());

        if (matcher && !matcher.shouldInclude(relativePath)) {
          continue;
        }

        if (type === vscode.FileType.File) {
          fileUris.push(childUri.toString());
        } else if (type === vscode.FileType.Directory) {
          await this.walkDirectory(childUri, fileUris, maxDepth, currentDepth + 1, config);
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', hpp: 'cpp',
  php: 'php', swift: 'swift', kt: 'kotlin', scala: 'scala',
  sh: 'bash', bash: 'bash', zsh: 'bash', ps1: 'powershell',
  sql: 'sql', html: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml', xml: 'xml',
  md: 'markdown', mdx: 'markdown', txt: 'text',
  dockerfile: 'dockerfile', makefile: 'makefile',
};

function getLanguageTag(relativePath: string): string {
  const filename = relativePath.split(/[/\\]/).pop() || '';
  const lower = filename.toLowerCase();

  // Handle special filenames without extensions
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile' || lower === 'gnumakefile') return 'makefile';

  const ext = lower.split('.').pop() || '';
  return EXT_TO_LANG[ext] || '';
}
