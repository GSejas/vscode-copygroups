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
import { CopyHistoryService } from './CopyHistoryService';
import { IFileContentProvider } from '../../domain/interfaces/IFileContentProvider';
import { ConfigRepository } from '../../infrastructure/repositories/ConfigRepository';
import { PatternMatcher, isBinaryFile } from '../../utils/patternMatcher';

export interface ExportOptions {
  includePreprompt?: boolean;
  format?: 'markdown' | 'json';
}

export interface CopyResult {
  snapshots: CopiedFileSnapshot[];
  totalSize: number;
  skippedCount: number;
  skippedReasons: Map<string, string>; // filePath -> reason
}

export class ExportService {
  constructor(
    private contextExtraction: ContextExtractionService,
    private fileProvider: IFileContentProvider,
    private historyService: CopyHistoryService,
    private configRepo: ConfigRepository
  ) {}

  /**
   * Check if a file should be processed based on config rules
   */
  private async shouldProcessFile(fileUri: string, config: CopyConfig): Promise<{ allowed: boolean; reason?: string }> {
    const relativePath = await this.fileProvider.getRelativePath(fileUri);

    // Check patterns
    const matcher = new PatternMatcher(config.includePatterns, config.excludePatterns);
    if (!matcher.shouldInclude(relativePath)) {
      return { allowed: false, reason: 'Excluded by pattern' };
    }

    // Check binary files
    if (config.skipBinaryFiles && isBinaryFile(relativePath)) {
      return { allowed: false, reason: 'Binary file skipped' };
    }

    // Check file size
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.parse(fileUri));
      if (stat.size > config.maxFileSizeBytes) {
        return { allowed: false, reason: `File too large (${(stat.size / 1024).toFixed(0)} KB)` };
      }
    } catch (err) {
      return { allowed: false, reason: 'Cannot read file size' };
    }

    return { allowed: true };
  }

  /**
   * Copy a single file with size tracking
   */
  private async extractFile(
    fileUri: string,
    contextMode: ContextMode,
    accumulatedSize: number,
    maxTotalSize: number
  ): Promise<{
    snapshot: CopiedFileSnapshot;
    size: number;
    withinLimit: boolean;
  }> {
    const relativePath = await this.fileProvider.getRelativePath(fileUri);

    try {
      const content = await this.contextExtraction.extract(fileUri, contextMode);
      const size = new Blob([content]).size;

      return {
        snapshot: {
          uri: fileUri,
          relativePath,
          extractedContent: content,
          contextMode,
        },
        size,
        withinLimit: accumulatedSize + size <= maxTotalSize,
      };
    } catch (err) {
      return {
        snapshot: {
          uri: fileUri,
          relativePath,
          extractedContent: '',
          contextMode,
          error: String(err),
        },
        size: 0,
        withinLimit: true,
      };
    }
  }

  /**
   * Unified copy context entry point.
   * Intelligently handles files, folders, or multi-file selections.
   * - Single file → extract with config limits
   * - Folder → recursive scan with config.maxDirectoryDepth
   * - Multiple files → direct multi-file copy
   */
  async copyContext(
    uris: vscode.Uri[],
    contextMode?: ContextMode
  ): Promise<void> {
    if (!uris || uris.length === 0) {
      throw new Error('No files or folders selected');
    }

    const config = await this.configRepo.get();
    const mode: ContextMode = contextMode || { type: config.defaultContextMode as ContextModeType };

    // Single item: check if file or folder
    if (uris.length === 1) {
      const uri = uris[0];
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          // It's a folder
          await this.copyFolder(uri.toString(), mode);
        } else {
          // Single file: wrap in array and copy as multi-file
          await this.copySelectedFiles([uri.toString()], mode);
        }
      } catch (err) {
        throw new Error(`Cannot access item: ${String(err)}`);
      }
    } else {
      // Multiple items: copy all as multi-file
      await this.copySelectedFiles(
        uris.map(uri => uri.toString()),
        mode
      );
    }
  }

  /**
   * Copy multiple selected files directly to clipboard without creating a group.
   * Auto-generates a history entry name based on file count and timestamp.
   * Respects config limits: max files, max total size, patterns, binary skip.
   */
  async copySelectedFiles(
    fileUris: string[],
    contextMode: ContextMode = { type: 'full' }
  ): Promise<void> {
    const config = await this.configRepo.get();
    const snapshots: CopiedFileSnapshot[] = [];
    const relativePaths: string[] = [];
    const skippedReasons = new Map<string, string>();
    let totalSize = 0;
    let fileCount = 0;

    for (const fileUri of fileUris) {
      // Check hard limits
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
          snapshots.push({
            uri: fileUri,
            relativePath: fileUri,
            extractedContent: '',
            contextMode,
            error: 'File not found',
          });
          skippedReasons.set(fileUri, 'File not found');
          continue;
        }

        // Check filtering rules
        const check = await this.shouldProcessFile(fileUri, config);
        if (!check.allowed) {
          skippedReasons.set(fileUri, check.reason || 'Filtered out');
          continue;
        }

        const relativePath = await this.fileProvider.getRelativePath(fileUri);
        const result = await this.extractFile(fileUri, contextMode, totalSize, config.maxTotalSizeBytes);

        if (!result.withinLimit) {
          skippedReasons.set(fileUri, 'Would exceed total size limit');
          continue;
        }

        relativePaths.push(relativePath);
        snapshots.push(result.snapshot);
        totalSize += result.size;
        fileCount++;
      } catch (err) {
        snapshots.push({
          uri: fileUri,
          relativePath: fileUri,
          extractedContent: '',
          contextMode,
          error: String(err),
        });
        skippedReasons.set(fileUri, String(err));
      }
    }

    // Render output
    const output = this.renderMultiFileMarkdown(snapshots, relativePaths, skippedReasons, totalSize);
    await vscode.env.clipboard.writeText(output);

    // Auto-generate entry name
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const successCount = snapshots.filter(s => !s.error).length;
    const entryName = `${successCount} file${successCount !== 1 ? 's' : ''} • ${timestamp}`;

    const syntheticGroup: any = {
      id: `direct-${Date.now()}`,
      name: entryName,
      contextMode,
    };

    await this.historyService.record(syntheticGroup, output, snapshots, 'direct-multi-file');
  }

  private renderMultiFileMarkdown(
    snapshots: CopiedFileSnapshot[],
    relativePaths: string[],
    skippedReasons: Map<string, string> = new Map(),
    totalSize = 0
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
        parts.push('```\n');
        parts.push(snap.extractedContent);
        parts.push('\n```\n\n');
      }
    }

    return parts.join('');
  }

  /**
   * Copy all files in a folder recursively to clipboard.
   * Auto-generates history entry name: "folder-name (N files)"
   * Respects config limits: max files, max total size, patterns, binary skip.
   */
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

    const snapshots: CopiedFileSnapshot[] = [];
    const relativePaths: string[] = [];
    const skippedReasons = new Map<string, string>();
    let totalSize = 0;
    let fileCount = 0;

    for (const fileUri of fileUris) {
      // Check hard limits
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
          skippedReasons.set(fileUri, 'File not found');
          continue;
        }

        // Check filtering rules
        const check = await this.shouldProcessFile(fileUri, config);
        if (!check.allowed) {
          skippedReasons.set(fileUri, check.reason || 'Filtered out');
          continue;
        }

        const relativePath = await this.fileProvider.getRelativePath(fileUri);
        const result = await this.extractFile(fileUri, contextMode, totalSize, config.maxTotalSizeBytes);

        if (!result.withinLimit) {
          skippedReasons.set(fileUri, 'Would exceed total size limit');
          continue;
        }

        relativePaths.push(relativePath);
        snapshots.push(result.snapshot);
        totalSize += result.size;
        fileCount++;
      } catch (err) {
        skippedReasons.set(fileUri, String(err));
      }
    }

    if (fileCount === 0) {
      throw new Error('No files matched after filtering');
    }

    // Render output
    const output = this.renderFolderMarkdown(folderName, snapshots, relativePaths, skippedReasons, totalSize);
    await vscode.env.clipboard.writeText(output);

    // Auto-generate entry name
    const entryName = `${folderName} (${fileCount} file${fileCount !== 1 ? 's' : ''})`;

    const syntheticGroup: any = {
      id: `folder-${Date.now()}`,
      name: entryName,
      contextMode,
    };

    await this.historyService.record(syntheticGroup, output, snapshots, 'folder-contents');
  }

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
        // Skip hidden files and common patterns
        if (name.startsWith('.') || name === 'node_modules') {
          continue;
        }

        const childUri = vscode.Uri.joinPath(dirUri, name);
        const relativePath = await this.fileProvider.getRelativePath(childUri.toString());

        // Skip if excluded by pattern
        if (matcher && !matcher.shouldInclude(relativePath)) {
          continue;
        }

        if (type === vscode.FileType.File) {
          fileUris.push(childUri.toString());
        } else if (type === vscode.FileType.Directory) {
          await this.walkDirectory(childUri, fileUris, maxDepth, currentDepth + 1, config);
        }
      }
    } catch (err) {
      // Skip inaccessible directories
    }
  }

  private renderFolderMarkdown(
    folderName: string,
    snapshots: CopiedFileSnapshot[],
    relativePaths: string[],
    skippedReasons: Map<string, string> = new Map(),
    totalSize = 0
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
        parts.push('```\n');
        parts.push(snap.extractedContent);
        parts.push('\n```\n\n');
      }
    }

    return parts.join('');
  }

  /**
   * Copy a group to clipboard and log the operation.
   */
  async copyGroup(group: Group): Promise<void> {
    const { output, snapshots } = await this.buildOutput(group);
    await vscode.env.clipboard.writeText(output);
    await this.historyService.record(group, output, snapshots, 'clipboard');
  }

  /**
   * Wipes non-favourite entries. Favourited entries are preserved.
   */
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
    // Pass empty snapshots — no content extraction happens for JSON config export
    await this.historyService.record(group, json, [], 'export-json');
    return json;
  }

  // ─── Core builder ────────────────────────────────────────────────────────

  /**
   * Shared extraction path. Gathers per-file snapshots once so the same
   * pass is used both for rendering output and for the history record.
   */
  private async buildOutput(
    group: Group,
    includePreprompt = true
  ): Promise<{ output: string; snapshots: CopiedFileSnapshot[] }> {
    const snapshots: CopiedFileSnapshot[] = [];

    // Gather file contents
    for (const fileRef of group.fileReferences) {
      const effectiveMode = fileRef.overrideContextMode || group.contextMode;
      try {
        const exists = await this.fileProvider.fileExists(fileRef.uri);
        if (!exists) {
          snapshots.push({
            uri: fileRef.uri,
            relativePath: fileRef.relativePath,
            extractedContent: '',
            contextMode: effectiveMode,
            error: 'File not found',
          });
          continue;
        }

        const extractedContent = await this.contextExtraction.extract(fileRef.uri, effectiveMode);
        snapshots.push({
          uri: fileRef.uri,
          relativePath: fileRef.relativePath,
          extractedContent,
          contextMode: effectiveMode,
        });
      } catch (err) {
        snapshots.push({
          uri: fileRef.uri,
          relativePath: fileRef.relativePath,
          extractedContent: '',
          contextMode: effectiveMode,
          error: String(err),
        });
      }
    }

    // Render output from snapshots
    const output = group.preprompt && includePreprompt
      ? this.renderWithPreprompt(group, snapshots)
      : this.renderMarkdown(group, snapshots);

    return { output, snapshots };
  }

  private renderMarkdown(group: Group, snapshots: CopiedFileSnapshot[]): string {
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
        parts.push('```\n');
        parts.push(snap.extractedContent);
        parts.push('\n```\n\n');
      }
    }

    return parts.join('');
  }

  private renderWithPreprompt(group: Group, snapshots: CopiedFileSnapshot[]): string {
    if (!group.preprompt) {
      return this.renderMarkdown(group, snapshots);
    }

    const contextText = snapshots
      .filter(s => !s.error)
      .map(s => `### ${s.relativePath}\n\`\`\`\n${s.extractedContent}\n\`\`\``)
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

  // ─── Utility ─────────────────────────────────────────────────────────────

  estimateExportSize(group: Group): number {
    let totalSize = 0;

    if (group.preprompt) {
      totalSize += group.preprompt.template.length;
    }

    totalSize += group.name.length + (group.description?.length || 0);
    totalSize += group.tags.reduce((sum, t) => sum + t.name.length, 0);

    return totalSize;
  }
}
