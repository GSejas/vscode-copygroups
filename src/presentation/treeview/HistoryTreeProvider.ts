/**
 * HistoryTreeProvider
 *
 * Renders the Copy History sidebar. Top level shows recent / favourites.
 * Each entry shows: group name, time, file count, and favourite star.
 * Entries are expandable to show individual files.
 * Right-click context menu (wired via package.json menus) gives:
 *   – Re-copy, Toggle Favourite, Add Note, Delete, Add Files, Remove File, Modify Mode
 */

import * as vscode from 'vscode';
import { CopyHistoryEntry } from '../../domain/entities/CopyHistoryEntry';
import { CopyHistoryService } from '../../application/services/CopyHistoryService';

type HistoryTreeNode = SectionItem | HistoryItem | FileItem;

// ─── Tree items ──────────────────────────────────────────────────────────────

class SectionItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly sectionKey: 'favourites' | 'recent',
    collapsible = vscode.TreeItemCollapsibleState.Expanded
  ) {
    super(label, collapsible);
    this.contextValue = 'historySection';
  }
}

/**
 * File item within a history entry
 */
export class FileItem extends vscode.TreeItem {
  constructor(
    public readonly fileName: string,
    public readonly filePath: string,
    public readonly hasError: boolean
  ) {
    super(fileName, vscode.TreeItemCollapsibleState.None);
    this.description = filePath;
    this.iconPath = hasError
      ? new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'))
      : new vscode.ThemeIcon('file');
    this.contextValue = 'fileItem';
  }
}

export class HistoryItem extends vscode.TreeItem {
  constructor(public readonly entry: CopyHistoryEntry) {
    super(entry.groupName, vscode.TreeItemCollapsibleState.Collapsed);

    const timeAgo = formatTimeAgo(entry.copiedAt);
    const fileCount = entry.files.length;
    const modeLabel = entry.contextMode.type;

    this.description = `${timeAgo} · ${fileCount} file${fileCount !== 1 ? 's' : ''} · ${modeLabel}`;
    this.tooltip = this.buildTooltip(entry);
    this.iconPath = entry.isFavourite
      ? new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'))
      : new vscode.ThemeIcon('history');
    this.contextValue = 'historyEntry';

    // Clicking the item re-copies immediately
    this.command = {
      command: 'copygroups.history.recopy',
      title: 'Re-copy',
      arguments: [entry.id],
    };
  }

  private buildTooltip(entry: CopyHistoryEntry): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.appendMarkdown(`**${entry.groupName}**\n\n`);
    md.appendMarkdown(`Copied: ${entry.copiedAt.toLocaleString()}\n\n`);
    md.appendMarkdown(`Mode: \`${entry.contextMode.type}\`\n\n`);
    if (entry.prepromptName) {
      md.appendMarkdown(`Preprompt: *${entry.prepromptName}*\n\n`);
    }
    if (entry.note) {
      md.appendMarkdown(`Note: ${entry.note}\n\n`);
    }
    md.appendMarkdown('**Files included:**\n\n');
    for (const f of entry.files) {
      const icon = f.error ? '⚠️' : '✓';
      md.appendMarkdown(`${icon} \`${f.relativePath}\`\n\n`);
    }
    return md;
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<HistoryTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private historyService: CopyHistoryService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: HistoryTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HistoryTreeNode): Promise<HistoryTreeNode[]> {
    // Root level: two sections
    if (!element) {
      return [
        new SectionItem('⭐ Favourites', 'favourites'),
        new SectionItem('🕐 Recent', 'recent'),
      ];
    }

    // Section children: history entries
    if (element instanceof SectionItem) {
      if (element.sectionKey === 'favourites') {
        const favs = await this.historyService.getFavourites();
        return favs.map(e => new HistoryItem(e));
      } else {
        const all = await this.historyService.getAll();
        // Recent = last 50 non-favourites (favourites already shown above)
        return all
          .filter(e => !e.isFavourite)
          .slice(0, 50)
          .map(e => new HistoryItem(e));
      }
    }

    // History entry children: files in the entry
    if (element instanceof HistoryItem) {
      return element.entry.files.map(f => {
        const fileName = f.relativePath.split(/[\\/]/).pop() || f.relativePath;
        return new FileItem(fileName, f.relativePath, !!f.error);
      });
    }

    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
