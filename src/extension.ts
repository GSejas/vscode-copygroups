/**
 * Extension entry point – wires dependency injection and registers all commands.
 */

import * as vscode from 'vscode';

// Infrastructure
import { GroupRepository } from './infrastructure/repositories/GroupRepository';
import { CopyHistoryRepository } from './infrastructure/repositories/CopyHistoryRepository';
import { ConfigRepository } from './infrastructure/repositories/ConfigRepository';
import { PrepromptRepository } from './infrastructure/repositories/PrepromptRepository';
import { VSCodeFileProvider } from './infrastructure/adapters/VSCodeFileProvider';

// Application
import { GroupService } from './application/services/GroupService';
import { ContextExtractionService } from './application/services/ContextExtractionService';
import { ExportService } from './application/services/ExportService';
import { CopyHistoryService } from './application/services/CopyHistoryService';
import { PrepromptService } from './application/services/PrepromptService';

// Domain
import { ContextModeType } from './domain/valueObjects/ContextMode';
import { RepositoryMetadata } from './domain/valueObjects/FileReference';

// Presentation
import { GroupTreeProvider, GroupItem, FileItem as GroupFileItem } from './presentation/treeview/GroupTreeProvider';
import { HistoryTreeProvider, HistoryItem, FileItem as HistoryFileItem } from './presentation/treeview/HistoryTreeProvider';
// Utils
import { PatternMatcher } from './utils/patternMatcher';

// Helper to extract repository metadata from a file URI
function getRepositoryMetadata(fileUri: vscode.Uri): RepositoryMetadata {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
  if (!workspaceFolder) {
    return { rootPath: fileUri.fsPath.split(/[\\/]/).slice(0, -1).join('/') };
  }
  
  const rootPath = workspaceFolder.uri.fsPath;
  const workspaceName = workspaceFolder.name;
  
  // Try to infer repo name from path (last folder in the path, or workspace name)
  const repoName = workspaceName || rootPath.split(/[\\/]/).pop() || 'project';
  
  return {
    rootPath,
    workspaceName,
    repoName,
  };
}

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

  const prepromptRepo = new PrepromptRepository();
  await prepromptRepo.initialize();
  const prepromptService = new PrepromptService(prepromptRepo);

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
        // Resolve the file/folder URI — could come from explorer context or be absent
        let resourceUri: vscode.Uri | undefined = contextUri;
        if (!resourceUri) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            resourceUri = editor.document.uri;
          }
        }
        if (!resourceUri) {
          vscode.window.showErrorMessage('No file or folder selected. Open a file or right-click one in the explorer.');
          return;
        }

        // Check if it's a folder
        const stat = await vscode.workspace.fs.stat(resourceUri);
        const isFolder = (stat.type & vscode.FileType.Directory) !== 0;

        // If it's a folder, expand it to get all files
        let fileUris: string[] = [];
        if (isFolder) {
          const config = await configRepo.get();
          await (async function walkDir(dirUri: vscode.Uri, depth: number): Promise<void> {
            if (depth > config.maxDirectoryDepth) return;
            try {
              const entries = await vscode.workspace.fs.readDirectory(dirUri);
              for (const [name, type] of entries) {
                if (name.startsWith('.')) continue;
                const childUri = vscode.Uri.joinPath(dirUri, name);
                if ((type & vscode.FileType.Directory) !== 0) {
                  await walkDir(childUri, depth + 1);
                } else {
                  const relativePath = await fileProvider.getRelativePath(childUri.toString());
                  const matcher = new PatternMatcher(config.includePatterns, config.excludePatterns);
                  if (matcher.shouldInclude(relativePath)) {
                    fileUris.push(childUri.toString());
                  }
                }
              }
            } catch {
              // Folder read failed, skip
            }
          })(resourceUri, 0);
        } else {
          fileUris = [resourceUri.toString()];
        }

        if (fileUris.length === 0) {
          vscode.window.showErrorMessage('No files found' + (isFolder ? ' in folder' : '') + '.');
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

        // Add all files to the group
        let addedCount = 0;
        for (const fileUri of fileUris) {
          try {
            const relativePath = await fileProvider.getRelativePath(fileUri);
            const fileVscodeUri = vscode.Uri.parse(fileUri);
            const repoMetadata = getRepositoryMetadata(fileVscodeUri);
            await groupService.addFileToGroup(chosen.groupId, fileUri, relativePath, repoMetadata);
            addedCount++;
          } catch {
            // Skip files that can't be added
          }
        }

        groupProvider.refresh();
        const message = isFolder 
          ? `Added ${addedCount} file(s) to "${chosen.label}".`
          : `Added to "${chosen.label}".`;
        vscode.window.showInformationMessage(message);
      }
    )
  );

  // ── Command: copy a group to clipboard ───────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.copyGroup', async (arg?: GroupItem | string) => {
      let groupId: string | undefined;
      if (arg instanceof GroupItem) {
        groupId = arg.group.id;
      } else if (typeof arg === 'string') {
        groupId = arg;
      } else {
        // Keybinding with no context — show picker
        const groups = await groupService.getAllGroups();
        if (groups.length === 0) {
          vscode.window.showWarningMessage('No groups yet. Create one first with Ctrl+Shift+G.');
          return;
        }
        const picked = await vscode.window.showQuickPick(
          groups.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .map(g => ({ label: g.name, description: `${g.fileReferences.length} file(s) · ${g.contextMode.type}`, groupId: g.id })),
          { placeHolder: 'Copy which group to clipboard?' }
        );
        if (!picked) return;
        groupId = picked.groupId;
      }
      const group = await groupService.getGroup(groupId!);
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

        const allPreprompts = prepromptService.getAllPreprompts();
        const options = [
          { label: 'None', description: 'Remove preprompt', preprompt: undefined as any },
          ...allPreprompts.map(p => ({
            label: p.name,
            description: `${p.mode}${p.isSystem ? '' : ' (custom)'}`,
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

  // ── File-level commands ───────────────────────────────────────────────────

  const FILE_MODES = ['full', 'skeleton', 'docstring', 'headers', 'head-tail', 'smart'] as const;

  async function cycleFileMode(item: GroupFileItem, direction: number): Promise<void> {
    try {
      const { groupId, fileIndex } = item;
      const group = await groupService.getGroup(groupId);
      if (!group || !group.fileReferences[fileIndex]) return;
      const currentMode = group.fileReferences[fileIndex].overrideContextMode?.type || 'full';
      const currentIndex = FILE_MODES.indexOf(currentMode as typeof FILE_MODES[number]);
      const nextIndex = (currentIndex + direction + FILE_MODES.length) % FILE_MODES.length;
      await groupService.setFileMode(groupId, fileIndex, { type: FILE_MODES[nextIndex] });
      groupProvider.refresh();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to change file mode: ${err}`);
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.cycleFileModeUp',
      (item: GroupFileItem) => cycleFileMode(item, -1)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.cycleFileModeDown',
      (item: GroupFileItem) => cycleFileMode(item, 1)
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.setFileMode',
      async (item: GroupFileItem) => {
        const { groupId, fileIndex } = item;
        const group = await groupService.getGroup(groupId);
        if (!group || !group.fileReferences[fileIndex]) return;

        const currentMode = group.fileReferences[fileIndex].overrideContextMode?.type || 'full';
        const selected = await vscode.window.showQuickPick(
          FILE_MODES.map(m => ({ label: m, description: m === currentMode ? '(current)' : '' })),
          { placeHolder: `Mode for "${group.fileReferences[fileIndex].relativePath}"` }
        );
        if (!selected) return;

        await groupService.setFileMode(groupId, fileIndex, { type: selected.label as ContextModeType });
        groupProvider.refresh();
        vscode.window.showInformationMessage(`File mode set to "${selected.label}".`);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.openFile',
      async (item: GroupFileItem) => {
        try {
          const uri = vscode.Uri.parse(item.file.uri);
          await vscode.window.showTextDocument(uri);
        } catch {
          vscode.window.showErrorMessage(`Could not open file: ${item.file.relativePath}`);
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.removeFileFromGroup',
      async (item: GroupFileItem) => {
        try {
          const { groupId, fileIndex } = item;
          const group = await groupService.getGroup(groupId);
          if (!group || !group.fileReferences[fileIndex]) return;

          const fileName = group.fileReferences[fileIndex].relativePath;
          const confirm = await vscode.window.showWarningMessage(
            `Remove "${fileName}" from group?`,
            { modal: false },
            'Remove'
          );
          if (confirm !== 'Remove') return;

          await groupService.removeFileByIndex(groupId, fileIndex);
          groupProvider.refresh();
          vscode.window.showInformationMessage(`Removed "${fileName}" from group.`);
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to remove file: ${err}`);
        }
      }
    )
  );

  // ── Preprompt commands ───────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.createCustomPreprompt', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Preprompt name',
        placeHolder: 'e.g. Code Review Template',
        validateInput: v => v.trim() ? null : 'Name cannot be empty',
      });
      if (!name) return;

      const template = await vscode.window.showInputBox({
        prompt: 'Preprompt template (use {{context}}, {{groupName}}, {{fileCount}}, {{timestamp}}, {{mode}})',
        placeHolder: 'Review this code: {{context}}',
        validateInput: v => v.trim() ? null : 'Template cannot be empty',
      });
      if (!template) return;

      const mode = await vscode.window.showQuickPick(
        ['analysis', 'summary', 'review', 'custom'],
        { placeHolder: 'Select preprompt mode' }
      );
      if (!mode) return;

      try {
        await prepromptService.create(name.trim(), template.trim(), mode);
        vscode.window.showInformationMessage(`Custom preprompt "${name.trim()}" created.`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to create preprompt: ${err}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.editPreprompt', async () => {
      const customPreprompts = prepromptService.getCustomPreprompts();
      if (customPreprompts.length === 0) {
        vscode.window.showInformationMessage('No custom preprompts to edit. Create one first.');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        customPreprompts.map(p => ({ label: p.name, description: p.mode, prepromptId: p.id })),
        { placeHolder: 'Select a preprompt to edit' }
      );
      if (!selected) return;

      const preprompt = prepromptService.getById(selected.prepromptId);
      if (!preprompt) return;

      const newName = await vscode.window.showInputBox({
        prompt: 'Preprompt name',
        value: preprompt.name,
        validateInput: v => v.trim() ? null : 'Name cannot be empty',
      });
      if (newName === undefined) return;

      const newTemplate = await vscode.window.showInputBox({
        prompt: 'Preprompt template',
        value: preprompt.template,
        validateInput: v => v.trim() ? null : 'Template cannot be empty',
      });
      if (newTemplate === undefined) return;

      const newMode = await vscode.window.showQuickPick(
        ['analysis', 'summary', 'review', 'custom'],
        { placeHolder: `Current mode: ${preprompt.mode}` }
      );
      if (!newMode) return;

      try {
        await prepromptService.update(preprompt.id, newName.trim(), newTemplate.trim(), newMode);
        vscode.window.showInformationMessage(`Preprompt "${newName.trim()}" updated.`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to update preprompt: ${err}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.deletePreprompt', async () => {
      const customPreprompts = prepromptService.getCustomPreprompts();
      if (customPreprompts.length === 0) {
        vscode.window.showInformationMessage('No custom preprompts to delete.');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        customPreprompts.map(p => ({ label: p.name, description: p.mode, prepromptId: p.id })),
        { placeHolder: 'Select a preprompt to delete' }
      );
      if (!selected) return;

      const confirm = await vscode.window.showWarningMessage(
        `Delete preprompt "${selected.label}"?`,
        { modal: true },
        'Delete'
      );
      if (confirm !== 'Delete') return;

      try {
        await prepromptService.delete(selected.prepromptId);
        vscode.window.showInformationMessage(`Preprompt "${selected.label}" deleted.`);
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to delete preprompt: ${err}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.managePreprompts', async () => {
      const allPreprompts = prepromptService.getAllPreprompts();
      if (allPreprompts.length === 0) {
        vscode.window.showInformationMessage('No preprompts available.');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        [
          { label: '+ Create Custom', action: 'create' },
          { label: '─'.repeat(20), action: 'separator' },
          ...allPreprompts.map(p => ({
            label: p.name,
            description: `${p.mode}${p.isSystem ? '' : ' (custom)'}`,
            prepromptId: p.id,
            action: p.isSystem ? 'view' : 'edit',
          })),
        ],
        { placeHolder: 'Manage preprompts' }
      );
      if (!selected) return;

      if (selected.action === 'create') {
        await vscode.commands.executeCommand('copygroups.createCustomPreprompt');
      } else if (selected.action === 'edit' && 'prepromptId' in selected) {
        const action = await vscode.window.showQuickPick(
          ['Edit', 'Delete'],
          { placeHolder: `Options for "${selected.label}"` }
        );
        if (action === 'Edit') {
          await vscode.commands.executeCommand('copygroups.editPreprompt');
        } else if (action === 'Delete') {
          await vscode.commands.executeCommand('copygroups.deletePreprompt');
        }
      }
    })
  );

  // ── History commands ──────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.history.recopy', async (item: HistoryItem | string) => {
      const id = item instanceof HistoryItem ? item.entry.id : item;
      try {
        await historyService.recopy(id);
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

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.history.addFilesToGroup',
      async (item: HistoryItem) => {
        const groups = await groupService.getAllGroups();
        if (groups.length === 0) {
          const create = await vscode.window.showWarningMessage(
            'No groups yet. Create one first?',
            'Create Group'
          );
          if (create) await vscode.commands.executeCommand('copygroups.createGroup');
          return;
        }

        const picks = groups
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .map(g => ({ label: g.name, description: `${g.fileReferences.length} file(s)`, groupId: g.id }));

        const chosen = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Add all files to which group?',
        });
        if (!chosen) return;

        let addedCount = 0;
        for (const f of item.entry.files.filter(f => !f.error)) {
          try {
            const fileVscodeUri = vscode.Uri.parse(f.uri);
            const repoMetadata = getRepositoryMetadata(fileVscodeUri);
            await groupService.addFileToGroup(chosen.groupId, f.uri, f.relativePath, repoMetadata);
            addedCount++;
          } catch {
            // skip duplicates or unreachable files
          }
        }

        groupProvider.refresh();
        vscode.window.showInformationMessage(`Added ${addedCount} file(s) to "${chosen.label}".`);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'copygroups.history.addFileToGroup',
      async (item: HistoryFileItem) => {
        const groups = await groupService.getAllGroups();
        if (groups.length === 0) {
          const create = await vscode.window.showWarningMessage(
            'No groups yet. Create one first?',
            'Create Group'
          );
          if (create) await vscode.commands.executeCommand('copygroups.createGroup');
          return;
        }

        const picks = groups
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .map(g => ({ label: g.name, description: `${g.fileReferences.length} file(s)`, groupId: g.id }));

        const chosen = await vscode.window.showQuickPick(picks, {
          placeHolder: `Add "${item.fileName}" to which group?`,
        });
        if (!chosen) return;

        try {
          const fileVscodeUri = vscode.Uri.parse(item.fileUri);
          const repoMetadata = getRepositoryMetadata(fileVscodeUri);
          await groupService.addFileToGroup(chosen.groupId, item.fileUri, item.filePath, repoMetadata);
          groupProvider.refresh();
          vscode.window.showInformationMessage(`Added "${item.fileName}" to "${chosen.label}".`);
        } catch (err) {
          vscode.window.showErrorMessage(`Failed to add file: ${err}`);
        }
      }
    )
  );

  // ── Sync command ──────────────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.syncViews', () => {
      groupProvider.refresh();
      historyProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('copygroups.openWebviewInEditor', async () => {
      await vscode.commands.executeCommand('copygroups.sidebar.focus');
    })
  );

  // ── Multi-window state syncing ────────────────────────────────────────────

  // Set up file watcher for GroupRepository changes from other instances
  groupRepo.setupFileWatcher(context.extensionPath);

  // Subscribe to repository changes and refresh tree views
  const groupObserver = {
    onStateChanged: () => {
      console.log('[Extension] Groups changed, refreshing tree view...');
      groupProvider.refresh();
    },
  };

  const configObserver = {
    onStateChanged: () => {
      console.log('[Extension] Config changed');
    },
  };

  groupRepo.subscribe(groupObserver);
  configRepo.subscribe(configObserver);

  // Store references for cleanup
  const disposeResources = () => {
    groupRepo.unsubscribe(groupObserver);
    configRepo.unsubscribe(configObserver);
    groupRepo.dispose();
  };

  context.subscriptions.push({ dispose: disposeResources });

}

export function deactivate(): void {
  // Subscriptions are automatically disposed via context.subscriptions
  console.log('[Extension] Deactivating copygroups...');
}
