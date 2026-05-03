/**
 * ExportService
 * Handles exporting groups in various formats.
 * Every copy/export is automatically recorded in CopyHistoryService
 * so users can review, favourite, and re-copy past operations.
 */

import * as vscode from 'vscode';
import { Group } from '../../domain/entities/Group';
import { CopiedFileSnapshot } from '../../domain/entities/CopyHistoryEntry';
import { ContextMode } from '../../domain/valueObjects/ContextMode';
import { ContextExtractionService } from './ContextExtractionService';
import { CopyHistoryService } from './CopyHistoryService';
import { IFileContentProvider } from '../../domain/interfaces/IFileContentProvider';

export interface ExportOptions {
  includePreprompt?: boolean;
  format?: 'markdown' | 'json';
}

export class ExportService {
  constructor(
    private contextExtraction: ContextExtractionService,
    private fileProvider: IFileContentProvider,
    private historyService: CopyHistoryService
  ) {}

  /**
   * Copy multiple selected files directly to clipboard without creating a group.
   * Auto-generates a history entry name based on file count and timestamp.
   */
  async copySelectedFiles(
    fileUris: string[],
    contextMode: ContextMode = { type: 'full' }
  ): Promise<void> {
    const snapshots: CopiedFileSnapshot[] = [];
    const relativePaths: string[] = [];

    for (const fileUri of fileUris) {
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
          continue;
        }

        const relativePath = await this.fileProvider.getRelativePath(fileUri);
        relativePaths.push(relativePath);
        const extractedContent = await this.contextExtraction.extract(fileUri, contextMode);
        snapshots.push({
          uri: fileUri,
          relativePath,
          extractedContent,
          contextMode,
        });
      } catch (err) {
        snapshots.push({
          uri: fileUri,
          relativePath: fileUri,
          extractedContent: '',
          contextMode,
          error: String(err),
        });
      }
    }

    // Render output
    const output = this.renderMultiFileMarkdown(snapshots, relativePaths);
    await vscode.env.clipboard.writeText(output);

    // Auto-generate entry name
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const successCount = snapshots.filter(s => !s.error).length;
    const entryName = `${successCount} file${successCount !== 1 ? 's' : ''} • ${timestamp}`;

    // Create a synthetic group-like object for history recording
    const syntheticGroup: any = {
      id: `direct-${Date.now()}`,
      name: entryName,
      contextMode,
    };

    await this.historyService.record(syntheticGroup, output, snapshots, 'direct-multi-file');
  }

  private renderMultiFileMarkdown(snapshots: CopiedFileSnapshot[], relativePaths: string[]): string {
    const parts: string[] = [];

    const successCount = snapshots.filter(s => !s.error).length;
    parts.push(`# Multi-File Copy\n`);
    parts.push(`Files: ${successCount} / ${snapshots.length}\n`);
    parts.push(`Context Mode: \`${snapshots[0]?.contextMode.type || 'full'}\`\n`);
    if (relativePaths.length > 0) {
      parts.push(`\nIncluded:\n${relativePaths.map(p => `• \`${p}\``).join('\n')}\n`);
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
