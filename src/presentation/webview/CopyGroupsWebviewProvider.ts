/**
 * CopyGroupsWebviewProvider
 * Unified sidebar webview for Copy Groups
 * Manages: Copy (preview), History, Groups, Settings tabs
 */

import * as vscode from 'vscode';
import { GroupService } from '../../application/services/GroupService';
import { CopyHistoryService } from '../../application/services/CopyHistoryService';
import { ExportService } from '../../application/services/ExportService';
import { ConfigRepository } from '../../infrastructure/repositories/ConfigRepository';
import { Group } from '../../domain/entities/Group';
import { CopyHistoryEntry } from '../../domain/entities/CopyHistoryEntry';

export interface WebviewState {
  activeTab: 'copy' | 'history' | 'groups' | 'settings';
  previewSelection?: {
    type: 'group' | 'entry';
    id: string;
  };
  historyFilters: {
    repoName?: string;
    searchQuery?: string;
    favorites?: boolean;
  };
  historyPage: number; // For pagination
}

export interface WebviewMessage {
  command: string;
  payload?: any;
}

export interface WebviewResponse {
  type: 'success' | 'error' | 'update';
  data?: any;
  error?: string;
}

export class CopyGroupsWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'copygroups.sidebar';
  
  private webviewView?: vscode.WebviewView;
  private state: WebviewState = {
    activeTab: 'copy',
    historyFilters: {},
    historyPage: 0,
  };

  constructor(
    private context: vscode.ExtensionContext,
    private groupService: GroupService,
    private historyService: CopyHistoryService,
    private exportService: ExportService,
    private configRepo: ConfigRepository
  ) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): Promise<void> {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourcesRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.context.extensionUri, 'resources'),
      ],
    };

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        await this.handleWebviewMessage(message, webviewView.webview);
      }
    );
  }

  private async handleWebviewMessage(message: WebviewMessage, webview: vscode.Webview): Promise<void> {
    try {
      let response: WebviewResponse;

      switch (message.command) {
        case 'loadCopyTab':
          response = await this.handleLoadCopyTab(message.payload);
          break;
        case 'loadHistoryTab':
          response = await this.handleLoadHistoryTab(message.payload);
          break;
        case 'loadGroupsTab':
          response = await this.handleLoadGroupsTab();
          break;
        case 'loadSettingsTab':
          response = await this.handleLoadSettingsTab();
          break;
        case 'copyToClipboard':
          response = await this.handleCopyToClipboard(message.payload);
          break;
        case 'previewGroup':
          response = await this.handlePreviewGroup(message.payload);
          break;
        case 'previewHistoryEntry':
          response = await this.handlePreviewHistoryEntry(message.payload);
          break;
        case 'searchHistory':
          response = await this.handleSearchHistory(message.payload);
          break;
        case 'filterHistoryByRepo':
          response = await this.handleFilterHistoryByRepo(message.payload);
          break;
        case 'toggleFavorite':
          response = await this.handleToggleFavorite(message.payload);
          break;
        case 'deleteHistoryEntry':
          response = await this.handleDeleteHistoryEntry(message.payload);
          break;
        case 'switchTab':
          response = this.handleSwitchTab(message.payload);
          break;
        case 'newGroup':
          // Open create group dialog
          await vscode.commands.executeCommand('copygroups.createGroup');
          response = { type: 'success', data: { action: 'newGroup' } };
          break;
        case 'editGroup':
          // Open edit group dialog
          await vscode.commands.executeCommand('copygroups.editGroup', message.payload?.groupId);
          response = { type: 'success', data: { action: 'editGroup' } };
          break;
        case 'updateSetting':
          // Update a setting value
          const config = await this.configRepo.get();
          for (const [key, value] of Object.entries(message.payload || {})) {
            (config as any)[key] = value;
          }
          await this.configRepo.save(config);
          response = { type: 'success', data: { updated: true } };
          break;
        default:
          response = { type: 'error', error: `Unknown command: ${message.command}` };
      }

      webview.postMessage(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      webview.postMessage({ type: 'error', error: errorMessage });
    }
  }

  private async handleLoadCopyTab(payload: { groupId?: string; historyEntryId?: string }): Promise<WebviewResponse> {
    let group: Group | undefined;
    let output: string = '';

    if (payload.groupId) {
      group = await this.groupService.getGroup(payload.groupId);
      if (!group) {
        return { type: 'error', error: 'Group not found' };
      }
      output = await this.exportService.buildGroupOutput(group);
    } else if (payload.historyEntryId) {
      const entry = await this.historyService.getById(payload.historyEntryId);
      if (!entry) {
        return { type: 'error', error: 'History entry not found' };
      }
      output = entry.output;
    }

    const lines = output.split('\n');
    const preview = lines.slice(0, 50).join('\n'); // First 50 lines

    return {
      type: 'success',
      data: {
        selected: payload.groupId ? { type: 'group', id: payload.groupId } : { type: 'entry', id: payload.historyEntryId },
        preview,
        fullOutput: output,
        lineCount: lines.length,
        byteSize: new Blob([output]).size,
      },
    };
  }

  private async handleLoadHistoryTab(payload: { page?: number; filters?: any }): Promise<WebviewResponse> {
    const page = payload.page || 0;
    const pageSize = 50;
    const skip = page * pageSize;

    // Get all history entries (ensure it's an array)
    const allEntries = (await this.historyService.getAll()) || [];
    
    // Apply filters
    let filtered = allEntries;
    if (payload.filters?.repoName) {
      filtered = filtered.filter(e => 
        e.snapshots.some(s => s.repositoryMetadata?.repoName === payload.filters.repoName)
      );
    }
    if (payload.filters?.searchQuery) {
      const query = payload.filters.searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.output.toLowerCase().includes(query) ||
        e.name.toLowerCase().includes(query)
      );
    }
    if (payload.filters?.favorites) {
      filtered = filtered.filter(e => e.isFavourite);
    }

    // Paginate
    const total = filtered.length;
    const entries = filtered.slice(skip, skip + pageSize).map(e => ({
      id: e.id,
      name: e.name,
      timestamp: e.copiedAt.toISOString(),
      fileCount: e.snapshots.length,
      size: new Blob([e.output]).size,
      repos: [...new Set(e.snapshots.map(s => s.repositoryMetadata?.repoName || 'unknown'))],
      isFavourite: e.isFavourite,
    }));

    // Get unique repos for filter dropdown
    const allRepos = [...new Set(
      allEntries.flatMap(e => e.snapshots.map(s => s.repositoryMetadata?.repoName).filter(Boolean) as string[])
    )];

    return {
      type: 'success',
      data: {
        entries,
        total,
        page,
        pageSize,
        hasMore: skip + pageSize < total,
        repos: allRepos,
      },
    };
  }

  private async handleLoadGroupsTab(): Promise<WebviewResponse> {
    const groups = await this.groupService.getAllGroups();
    
    const groupsList = groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      fileCount: g.fileReferences.length,
      isBookmarked: g.isBookmarked,
      tags: g.tags,
      repos: [...new Set(
        g.fileReferences.map(f => f.repositoryMetadata?.repoName || 'unknown')
      )],
    }));

    return {
      type: 'success',
      data: { groups: groupsList },
    };
  }

  private async handleLoadSettingsTab(): Promise<WebviewResponse> {
    const config = await this.configRepo.get();
    
    return {
      type: 'success',
      data: {
        skipBinaryFiles: config.skipBinaryFiles,
        addLineNumbers: config.addLineNumbers,
        maxFileSize: config.maxFileSizeBytes,
        maxTotalSize: config.maxTotalSizeBytes,
        maxFileCount: config.maxFileCount,
        maxDepth: config.maxDirectoryDepth,
        includePatterns: config.includePatterns,
        excludePatterns: config.excludePatterns,
      },
    };
  }

  private async handleCopyToClipboard(payload: { groupId?: string; historyEntryId?: string }): Promise<WebviewResponse> {
    if (payload.groupId) {
      const group = await this.groupService.getGroup(payload.groupId);
      if (!group) {
        return { type: 'error', error: 'Group not found' };
      }
      const output = await this.exportService.buildGroupOutput(group);
      await vscode.env.clipboard.writeText(output);
      return { type: 'success', data: { copied: true } };
    } else if (payload.historyEntryId) {
      const entry = await this.historyService.getById(payload.historyEntryId);
      if (!entry) {
        return { type: 'error', error: 'History entry not found' };
      }
      await vscode.env.clipboard.writeText(entry.output);
      return { type: 'success', data: { copied: true } };
    }
    return { type: 'error', error: 'No source selected' };
  }

  private async handlePreviewGroup(payload: { groupId: string }): Promise<WebviewResponse> {
    return this.handleLoadCopyTab({ groupId: payload.groupId });
  }

  private async handlePreviewHistoryEntry(payload: { entryId: string }): Promise<WebviewResponse> {
    return this.handleLoadCopyTab({ historyEntryId: payload.entryId });
  }

  private async handleSearchHistory(payload: { query: string; page?: number }): Promise<WebviewResponse> {
    this.state.historyFilters.searchQuery = payload.query;
    this.state.historyPage = payload.page || 0;
    return this.handleLoadHistoryTab({ page: this.state.historyPage, filters: this.state.historyFilters });
  }

  private async handleFilterHistoryByRepo(payload: { repoName?: string; page?: number }): Promise<WebviewResponse> {
    this.state.historyFilters.repoName = payload.repoName;
    this.state.historyPage = payload.page || 0;
    return this.handleLoadHistoryTab({ page: this.state.historyPage, filters: this.state.historyFilters });
  }

  private async handleToggleFavorite(payload: { entryId: string }): Promise<WebviewResponse> {
    const entry = await this.historyService.getById(payload.entryId);
    if (!entry) {
      return { type: 'error', error: 'Entry not found' };
    }
    await this.historyService.toggleFavourite(payload.entryId);
    return { type: 'success', data: { isFavourite: !entry.isFavourite } };
  }

  private async handleDeleteHistoryEntry(payload: { entryId: string }): Promise<WebviewResponse> {
    await this.historyService.deleteEntry(payload.entryId);
    return { type: 'success', data: { deleted: true } };
  }

  private handleSwitchTab(payload: { tab: 'copy' | 'history' | 'groups' | 'settings' }): WebviewResponse {
    this.state.activeTab = payload.tab;
    return { type: 'success', data: { activeTab: this.state.activeTab } };
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webview.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webview.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource};">
    <title>Copy Groups</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="app" class="copy-groups-sidebar">
        <div class="tabs">
            <button class="tab-button active" data-tab="copy">📋 Copy</button>
            <button class="tab-button" data-tab="history">📜 History</button>
            <button class="tab-button" data-tab="groups">📁 Groups</button>
            <button class="tab-button" data-tab="settings">⚙️ Settings</button>
        </div>
        
        <div class="tab-content">
            <!-- Copy Tab -->
            <div class="tab-pane active" id="tab-copy">
                <div class="copy-pane">
                    <div class="section-header">Select to Copy</div>
                    <div id="copy-content" class="copy-content">
                        <p class="placeholder">Select a group or history entry to preview</p>
                    </div>
                </div>
            </div>
            
            <!-- History Tab -->
            <div class="tab-pane" id="tab-history">
                <div class="history-pane">
                    <div class="search-box">
                        <input type="text" id="history-search" placeholder="🔍 Search history..." class="search-input">
                    </div>
                    <div class="filter-box">
                        <select id="history-repo-filter" class="repo-filter">
                            <option value="">All Repos</option>
                        </select>
                        <label class="favorite-toggle">
                            <input type="checkbox" id="favorite-filter">
                            Favorites only
                        </label>
                    </div>
                    <div id="history-results" class="history-results">
                        <p class="placeholder">Loading...</p>
                    </div>
                    <div id="history-pagination" class="pagination"></div>
                </div>
            </div>
            
            <!-- Groups Tab -->
            <div class="tab-pane" id="tab-groups">
                <div class="groups-pane">
                    <button id="new-group-btn" class="btn-primary">+ New Group</button>
                    <div id="groups-list" class="groups-list">
                        <p class="placeholder">Loading...</p>
                    </div>
                </div>
            </div>
            
            <!-- Settings Tab -->
            <div class="tab-pane" id="tab-settings">
                <div class="settings-pane">
                    <div id="settings-content" class="settings-content">
                        <p class="placeholder">Loading...</p>
                    </div>
                    
                    <!-- Debug Section -->
                    <div style="border-top: 1px solid #2d2d2d; margin-top: 24px; padding-top: 16px;">
                        <div class="section-header">Communication Test</div>
                        <button class="btn-secondary" style="width: 100%; margin-bottom: 8px;" onclick="testLoadGroups()">🧪 Test: Load Groups</button>
                        <button class="btn-secondary" style="width: 100%; margin-bottom: 8px;" onclick="testLoadHistory()">🧪 Test: Load History</button>
                        <button class="btn-secondary" style="width: 100%; margin-bottom: 8px;" onclick="testLoadSettings()">🧪 Test: Load Settings</button>
                        <div id="debug-log" style="background: #000; border: 1px solid #333; border-radius: 4px; padding: 8px; margin-top: 8px; font-family: Monaco, monospace; font-size: 10px; color: #0e0; max-height: 150px; overflow-y: auto;">
                            <div style="color: #666;">Ready for testing...</div>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
