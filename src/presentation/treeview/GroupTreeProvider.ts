/**
 * GroupTreeProvider
 *
 * Renders the Groups sidebar with two sections:
 *   ⭐ Bookmarked  — pinned groups
 *   📁 All Groups  — sorted by most-recently updated
 *
 * Each group item shows file count, tags, and context mode.
 * Inline toolbar: Copy ($(clippy)), Delete ($(trash))
 * Right-click context menu (wired via package.json) also exposes bookmark toggle and rename.
 */

import * as vscode from 'vscode';
import { Group } from '../../domain/entities/Group';
import { GroupService } from '../../application/services/GroupService';

type GroupTreeNode = SectionItem | GroupItem;

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
    super(group.name, vscode.TreeItemCollapsibleState.None);

    const fileCount = group.fileReferences.length;
    const tagStr = group.tags.length > 0 ? ` · ${group.tags.map(t => t.name).join(', ')}` : '';
    this.description = `${fileCount} file${fileCount !== 1 ? 's' : ''} · ${group.contextMode.type}${tagStr}`;
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

function buildGroupTooltip(group: Group): vscode.MarkdownString {
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
    md.appendMarkdown(`• \`${f.relativePath}\`\n\n`);
  }
  md.appendMarkdown(`\n_Last updated: ${group.updatedAt.toLocaleString()}_`);
  return md;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class GroupTreeProvider implements vscode.TreeDataProvider<GroupTreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<GroupTreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private groupService: GroupService) {}

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

    return [];
  }
}
