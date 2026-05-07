/**
 * GroupTreeProvider
 *
 * Renders the Groups sidebar with two sections:
 *   ⭐ Bookmarked  — pinned groups
 *   📁 All Groups  — sorted by most-recently updated
 *
 * Each group is expandable to show individual files with per-file context modes.
 * Files can have different modes: full, skeleton, docstring, headers, head-tail, smart
 * Inline buttons to cycle mode (up/down) and remove files
 */

import * as vscode from 'vscode';
import { Group } from '../../domain/entities/Group';
import { FileReference } from '../../domain/valueObjects/FileReference';
import { ContextMode } from '../../domain/valueObjects/ContextMode';
import { CopyConfig } from '../../domain/valueObjects/CopyConfig';
import { GroupService } from '../../application/services/GroupService';
import { ConfigRepository } from '../../infrastructure/repositories/ConfigRepository';

type GroupTreeNode = SectionItem | GroupItem | FileItem;

// ─── Tree Items ───────────────────────────────────────────────────────────────

class SectionItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly sectionKey: 'bookmarked' | 'all',
    collapsible = vscode.TreeItemCollapsibleState.Expanded
  ) {
    super(label, collapsible);
    this.contextValue = 'groupSection';
  }
}

export class GroupItem extends vscode.TreeItem {
  constructor(public readonly group: Group) {
    super(group.name, vscode.TreeItemCollapsibleState.Collapsed);

    const fileCount = group.fileReferences.length;
    const modeStr = group.preprompt 
      ? `${group.contextMode.type} · 📝 ${group.preprompt.name}`
      : group.contextMode.type;
    const tagStr = group.tags.length > 0 ? ` · ${group.tags.map(t => t.name).join(', ')}` : '';
    this.description = `${fileCount} file${fileCount !== 1 ? 's' : ''} · ${modeStr}${tagStr}`;
    this.tooltip = buildGroupTooltip(group);

    this.iconPath = group.isBookmarked
      ? new vscode.ThemeIcon('bookmark', new vscode.ThemeColor('charts.yellow'))
      : new vscode.ThemeIcon('folder');

    this.contextValue = group.isBookmarked ? 'groupItemBookmarked' : 'groupItem';

    // Primary click → copy to clipboard
    this.command = {
      command: 'copygroups.copyGroup',
      title: 'Copy to Clipboard',
      arguments: [group.id],
    };
  }
}

export class FileItem extends vscode.TreeItem {
  constructor(
    public readonly groupId: string,
    public readonly file: FileReference,
    public readonly fileIndex: number,
    effectiveMode: string,
    modeSource: 'file' | 'language' | 'group'
  ) {
    super(file.relativePath, vscode.TreeItemCollapsibleState.None);

    const modeLabel = modeSource === 'language' ? `${effectiveMode} (lang)` : effectiveMode;
    this.description = `· ${modeLabel}`;
    this.tooltip = modeSource === 'language'
      ? `Extracting as ${effectiveMode} — language config override is active (set a file override to change)`
      : `Extracting as ${effectiveMode}`;
    this.iconPath = new vscode.ThemeIcon('file');
    this.contextValue = 'groupFileItem';

    this.command = {
      command: 'copygroups.openFile',
      title: 'Open File',
      arguments: [this],
    };
  }
}

function buildGroupTooltip(group: Group, config?: CopyConfig): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.appendMarkdown(`**${group.name}**\n\n`);
  if (group.description) {
    md.appendMarkdown(`${group.description}\n\n`);
  }
  md.appendMarkdown(`Context mode: \`${group.contextMode.type}\`\n\n`);
  if (group.tags.length > 0) {
    md.appendMarkdown(`Tags: ${group.tags.map(t => `\`${t.name}\``).join(' ')}\n\n`);
  }
  if (group.preprompt) {
    md.appendMarkdown(`Preprompt: *${group.preprompt.name}*\n\n`);
  }
  md.appendMarkdown(`**Files (${group.fileReferences.length}):**\n\n`);
  for (const f of group.fileReferences) {
    if (f.overrideContextMode) {
      md.appendMarkdown(`• \`${f.relativePath}\` \`${f.overrideContextMode.type}\` _(file override)_\n\n`);
    } else if (config) {
      const { mode, source } = resolveEffectiveMode(f, group.contextMode, config);
      const note = source === 'language' ? ' _(language override)_' : '';
      md.appendMarkdown(`• \`${f.relativePath}\` \`${mode}\`${note}\n\n`);
    } else {
      md.appendMarkdown(`• \`${f.relativePath}\` \`${group.contextMode.type}\`\n\n`);
    }
  }
  md.appendMarkdown(`\n_Last updated: ${group.updatedAt.toLocaleString()}_`);
  return md;
}

// Maps common extensions to VS Code language IDs (mirrors ExportService)
const EXT_TO_LANG_ID: Record<string, string> = {
  md: 'markdown', markdown: 'markdown',
  py: 'python', robot: 'robot', resource: 'robot',
  ts: 'typescript', tsx: 'typescriptreact',
  js: 'javascript', jsx: 'javascriptreact',
  json: 'json', yaml: 'yaml', yml: 'yaml',
  toml: 'toml', sh: 'shellscript', ps1: 'powershell',
};

function resolveEffectiveMode(
  file: FileReference,
  groupMode: ContextMode,
  config: CopyConfig
): { mode: string; source: 'file' | 'language' | 'group' } {
  if (file.overrideContextMode) {
    return { mode: file.overrideContextMode.type, source: 'file' };
  }
  const ext = file.relativePath.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (ext) {
    const langId = EXT_TO_LANG_ID[ext];
    if (langId && config.languageOverrides[langId]) {
      return { mode: config.languageOverrides[langId], source: 'language' };
    }
  }
  return { mode: groupMode.type, source: 'group' };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class GroupTreeProvider implements vscode.TreeDataProvider<GroupTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<GroupTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private groupService: GroupService,
    private configRepo: ConfigRepository
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: GroupTreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GroupTreeNode): Promise<GroupTreeNode[]> {
    if (!element) {
      const all = await this.groupService.getAllGroups();
      const bookmarkedCount = all.filter(g => g.isBookmarked).length;
      const unbookmarkedCount = all.length - bookmarkedCount;

      const bookmarkedSection = new SectionItem(
        `⭐ Bookmarked (${bookmarkedCount})`,
        'bookmarked'
      );
      const allSection = new SectionItem(
        `📁 All Groups (${unbookmarkedCount})`,
        'all',
        unbookmarkedCount > 0
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
      );
      return [bookmarkedSection, allSection];
    }

    if (element instanceof SectionItem) {
      const all = await this.groupService.getAllGroups();
      const sorted = [...all].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      if (element.sectionKey === 'bookmarked') {
        return sorted.filter(g => g.isBookmarked).map(g => new GroupItem(g));
      } else {
        return sorted.filter(g => !g.isBookmarked).map(g => new GroupItem(g));
      }
    }

    // Expand group to show files with their effective context modes
    if (element instanceof GroupItem) {
      const config = await this.configRepo.get();
      return element.group.fileReferences.map((file, index) => {
        const { mode, source } = resolveEffectiveMode(file, element.group.contextMode, config);
        return new FileItem(element.group.id, file, index, mode, source);
      });
    }

    return [];
  }
}
