/**
 * Extension entry point – wires dependency injection and registers all commands.
 */

import * as vscode from 'vscode';

// Infrastructure
import { GroupRepository } from './infrastructure/repositories/GroupRepository';
import { CopyHistoryRepository } from './infrastructure/repositories/CopyHistoryRepository';
import { ConfigRepository } from './infrastructure/repositories/ConfigRepository';
import { VSCodeFileProvider } from './infrastructure/adapters/VSCodeFileProvider';

// Application
import { GroupService } from './application/services/GroupService';
import { ContextExtractionService } from './application/services/ContextExtractionService';
import { ExportService } from './application/services/ExportService';
import { CopyHistoryService } from './application/services/CopyHistoryService';

// Domain
import { ContextModeType } from './domain/valueObjects/ContextMode';
import { SYSTEM_PREPROMPTS } from './domain/entities/Preprompt';

// Presentation
import { GroupTreeProvider, GroupItem } from './presentation/treeview/GroupTreeProvider';
import { HistoryTreeProvider, HistoryItem } from './presentation/treeview/HistoryTreeProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // ── Infrastructure ────────────────────────────────────────────────────────
  const fileProvider = new VSCodeFileProvider();

  // Enable global state syncing across VS Code instances and machines
  context.globalState.setKeysForSync(['copygroups.groups', 'copygroups.history', 'copygroups.config']);

  const groupRepo = new GroupRepository(context.globalState);
  await groupRepo.initialize();

  const historyRepo = new CopyHistoryRepository(context.globalState);
  await historyRepo.initialize();

  const configRepo = new ConfigRepository(context.globalState);
  await configRepo.initialize();

  // ── Application ───────────────────────────────────────────────────────────
  const groupService = new GroupService(groupRepo);
  const contextExtraction = new ContextExtractionService(fileProvider);
  const historyService = new CopyHistoryService(historyRepo);
  const exportService = new ExportService(contextExtraction, fileProvider, historyService, configRepo);

  // ── Presentation ──────────────────────────────────────────────────────────
  const groupProvider = new GroupTreeProvider(groupService);
  const historyProvider = new HistoryTreeProvider(historyService);

  const groupsView = vscode.window.createTreeView('copygroups.groups', {
    treeDataProvider: groupProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });
  context.subscriptions.push(groupsView);

  vscode.window.createTreeView('copygroups.history', {
    treeDataProvider: historyProvider,
    showCollapseAll: true,
  });

  // ── Group commands ────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.copySelectedFiles',
      async (clickedFile: vscode.Uri, selectedFiles?: vscode.Uri[]) => {
        // If user right-clicked one file but has multi-select, use selectedFiles
        // Otherwise fallback to clickedFile
        const files = selectedFiles && selectedFiles.length > 0 ? selectedFiles : [clickedFile];
        
        if (!files || files.length === 0) {
          vscode.window.showErrorMessage('No files selected.');
          return;
        }

        await exportService.copyContext(files);
        historyProvider.refresh();
        vscode.window.showInformationMessage(`Copied ${files.length} file${files.length !== 1 ? 's' : ''} to clipboard.`);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.copyFolder',
      async (folderUri: vscode.Uri) => {
        if (!folderUri) {
          vscode.window.showErrorMessage('No folder selected.');
          return;
        }

        try {
          await exportService.copyContext([folderUri]);
          historyProvider.refresh();
          const folderName = folderUri.fsPath.split(/[\\/]/).pop();
          vscode.window.showInformationMessage(`Copied folder "${folderName}" to clipboard.`);
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to copy folder: ${err}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.copyContext',
      async (clickedItem: vscode.Uri, selectedItems?: vscode.Uri[]) => {
        try {
          const items = selectedItems && selectedItems.length > 0 ? selectedItems : [clickedItem];
          if (!items || items.length === 0) {
            vscode.window.showErrorMessage('No files or folders selected.');
            return;
          }

          await exportService.copyContext(items);
          historyProvider.refresh();
          
          if (items.length === 1) {
            const name = items[0].fsPath.split(/[\\/]/).pop() || 'item';
            vscode.window.showInformationMessage(`Copied "${name}" to clipboard.`);
          } else {
            vscode.window.showInformationMessage(`Copied ${items.length} items to clipboard.`);
          }
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to copy context: ${String(err)}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.createGroup', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Group name',
        placeHolder: 'e.g. Auth Module',
        validateInput: v => v.trim() ? null : 'Name cannot be empty',
      });
      if (!name) return;

      const description = await vscode.window.showInputBox({
        prompt: 'Description (optional)',
        placeHolder: 'Short description…',
      });

      await groupService.createGroup(name.trim(), description?.trim() || undefined);
      groupProvider.refresh();
      vscode.window.showInformationMessage(`Group "${name.trim()}" created.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.addToGroup',
      async (contextUri?: vscode.Uri) => {
        // Resolve the file URI — could come from explorer context or be absent
        let fileUri: vscode.Uri | undefined = contextUri;
        if (!fileUri) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            fileUri = editor.document.uri;
          }
        }
        if (!fileUri) {
          vscode.window.showErrorMessage('No file selected. Open a file or right-click one in the explorer.');
          return;
        }

        const groups = await groupService.getAllGroups();
        if (groups.length === 0) {
          const create = await vscode.window.showWarningMessage(
            'No groups yet. Create one first?',
            'Create Group'
          );
          if (create) {
            await vscode.commands.executeCommand('copygroups.createGroup');
          }
          return;
        }

        const picks = groups
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .map(g => ({
            label: g.name,
            description: `${g.fileReferences.length} file(s)`,
            groupId: g.id,
          }));

        const chosen = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Add to which group?',
        });
        if (!chosen) return;

        const relativePath = await fileProvider.getRelativePath(fileUri.toString());
        await groupService.addFileToGroup(chosen.groupId, fileUri.toString(), relativePath);
        groupProvider.refresh();
        vscode.window.showInformationMessage(`Added to "${chosen.label}".`);
      }
    )
  );

  // ── Command: copy a group to clipboard ───────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.copyGroup', async (arg: GroupItem | string) => {
      const groupId = arg instanceof GroupItem ? arg.group.id : arg;
      const group = await groupService.getGroup(groupId);
      if (!group) {
        vscode.window.showErrorMessage('Group not found.');
        return;
      }
      await exportService.copyGroup(group);
      historyProvider.refresh();
      vscode.window.showInformationMessage(`Copied "${group.name}" to clipboard.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.deleteGroup',
      async (arg: GroupItem | string) => {
        const groupId = arg instanceof GroupItem ? arg.group.id : arg;
        const group = await groupService.getGroup(groupId);
        if (!group) return;

        const confirm = await vscode.window.showWarningMessage(
          `Delete group "${group.name}"?`,
          { modal: true },
          'Delete'
        );
        if (confirm !== 'Delete') return;

        await groupService.deleteGroup(groupId);
        groupProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.toggleBookmark',
      async (arg: GroupItem | string) => {
        const groupId = arg instanceof GroupItem ? arg.group.id : arg;
        const updated = await groupService.toggleBookmark(groupId);
        groupProvider.refresh();
        vscode.window.showInformationMessage(
          updated.isBookmarked ? `"${updated.name}" bookmarked.` : `"${updated.name}" unbookmarked.`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.renameGroup',
      async (arg: GroupItem | string) => {
        const groupId = arg instanceof GroupItem ? arg.group.id : arg;
        const group = await groupService.getGroup(groupId);
        if (!group) return;

        const newName = await vscode.window.showInputBox({
          prompt: 'New group name',
          value: group.name,
          validateInput: v => v.trim() ? null : 'Name cannot be empty',
        });
        if (!newName) return;

        await groupService.renameGroup(groupId, newName.trim());
        groupProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.removeFileFromGroup',
      async (groupId: string, fileUri: string) => {
        await groupService.removeFileFromGroup(groupId, fileUri);
        groupProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.setGroupMode',
      async (arg: GroupItem | string) => {
        const groupId = arg instanceof GroupItem ? arg.group.id : arg;
        const group = await groupService.getGroup(groupId);
        if (!group) return;

        const modes: ContextModeType[] = ['full', 'skeleton', 'docstring', 'headers', 'head-tail', 'smart'];
        const selected = await vscode.window.showQuickPick(
          modes.map(m => ({ label: m, description: m === group.contextMode.type ? '(current)' : '' })),
          { placeHolder: 'Select context mode for this group' }
        );
        if (!selected || selected.label === group.contextMode.type) return;

        await groupService.setContextMode(groupId, { type: selected.label as ContextModeType });
        groupProvider.refresh();
        vscode.window.showInformationMessage(`Context mode set to "${selected.label}".`);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.setGroupPreprompt',
      async (arg: GroupItem | string) => {
        const groupId = arg instanceof GroupItem ? arg.group.id : arg;
        const group = await groupService.getGroup(groupId);
        if (!group) return;

        const options = [
          { label: 'None', description: 'Remove preprompt', preprompt: undefined as typeof SYSTEM_PREPROMPTS[string] | undefined },
          ...Object.values(SYSTEM_PREPROMPTS).map(p => ({
            label: p.name,
            description: p.mode,
            preprompt: p,
          })),
        ];

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: group.preprompt ? `Current: ${group.preprompt.name}` : 'Attach a preprompt template',
        });
        if (selected === undefined) return;

        await groupService.setPreprompt(groupId, selected.preprompt);
        groupProvider.refresh();
        vscode.window.showInformationMessage(
          selected.preprompt ? `Preprompt "${selected.preprompt.name}" attached.` : 'Preprompt removed.'
        );
      }
    )
  );

  // ── History commands ──────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.history.recopy', async (entryId: string) => {
      try {
        await historyService.recopy(entryId);
        vscode.window.showInformationMessage('Re-copied to clipboard.');
      } catch {
        vscode.window.showErrorMessage('Failed to re-copy: entry not found.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.history.toggleFavourite',
      async (item: HistoryItem | string) => {
        const id = item instanceof HistoryItem ? item.entry.id : item;
        const updated = await historyService.toggleFavourite(id);
        historyProvider.refresh();
        vscode.window.showInformationMessage(
          updated.isFavourite ? 'Added to favourites.' : 'Removed from favourites.'
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.history.addNote',
      async (item: HistoryItem | string) => {
        const id = item instanceof HistoryItem ? item.entry.id : item;
        const entry = await historyService.getAll().then(all => all.find(e => e.id === id));
        const current = entry?.note ?? '';

        const note = await vscode.window.showInputBox({
          prompt: 'Note for this copy operation (leave blank to clear)',
          value: current,
        });

        if (note === undefined) return; // user cancelled
        await historyService.setNote(id, note.trim() || undefined);
        historyProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.history.delete',
      async (item: HistoryItem | string) => {
        const id = item instanceof HistoryItem ? item.entry.id : item;
        const confirm = await vscode.window.showWarningMessage(
          'Delete this history entry?',
          { modal: true },
          'Delete'
        );
        if (confirm !== 'Delete') return;
        await historyService.delete(id);
        historyProvider.refresh();
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.history.modifyMode',
      async (item: HistoryItem | string) => {
        const id = item instanceof HistoryItem ? item.entry.id : item;
        const entries = await historyService.getAll();
        const entry = entries.find(e => e.id === id);
        if (!entry) {
          vscode.window.showErrorMessage('Entry not found.');
          return;
        }

        const modes = ['full', 'docstring', 'skeleton', 'headers', 'head-tail', 'smart'];
        const selected = await vscode.window.showQuickPick(modes, {
          placeHolder: `Current mode: ${entry.contextMode.type}`,
        });

        if (!selected || selected === entry.contextMode.type) return;

        // Re-extract all files with new mode and copy as new entry
        const newMode = { type: selected as ContextModeType };
        try {
          await exportService.copyContext(
            entry.files
              .filter(f => !f.error)
              .map(f => vscode.Uri.parse(f.uri)),
            newMode
          );
          historyProvider.refresh();
          vscode.window.showInformationMessage(`Re-copied with mode: ${selected}`);
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to re-copy with new mode: ${String(err)}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.history.clear', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all history? Favourited entries will be kept.',
        { modal: true },
        'Clear'
      );
      if (confirm !== 'Clear') return;
      await historyService.clearHistory();
      historyProvider.refresh();
      vscode.window.showInformationMessage('History cleared (favourites kept).');
    })
  );
}

export function deactivate(): void {
  // Nothing to clean up
}
