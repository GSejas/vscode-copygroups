/**
 * Copy Groups Webview Script
 * Handles UI interactions and communication with extension
 */

(function() {
  const vscode = acquireVsCodeApi();
  let currentTab = 'copy';
  let historyPage = 0;

  // Tab Management
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      switchTab(tab);
    });
  });

  function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `tab-${tab}`);
    });

    currentTab = tab;

    // Load tab content
    switch (tab) {
      case 'copy':
        // Copy tab loads on demand
        break;
      case 'history':
        loadHistoryTab(0);
        break;
      case 'groups':
        loadGroupsTab();
        break;
      case 'settings':
        loadSettingsTab();
        break;
    }
  }

  // Copy Tab
  function loadCopyTab(groupId, historyEntryId) {
    vscode.postMessage({
      command: 'loadCopyTab',
      payload: { groupId, historyEntryId },
    });
  }

  // History Tab
  function loadHistoryTab(page = 0) {
    historyPage = page;
    vscode.postMessage({
      command: 'loadHistoryTab',
      payload: {
        page,
        filters: getHistoryFilters(),
      },
    });
  }

  function getHistoryFilters() {
    const searchQuery = document.getElementById('history-search')?.value || '';
    const repoName = document.getElementById('history-repo-filter')?.value || '';
    const favorites = document.getElementById('favorite-filter')?.checked || false;

    return {
      searchQuery: searchQuery.trim() ? searchQuery : undefined,
      repoName: repoName ? repoName : undefined,
      favorites: favorites ? favorites : undefined,
    };
  }

  // Search History
  const searchInput = document.getElementById('history-search');
  if (searchInput) {
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadHistoryTab(0);
      }, 300);
    });
  }

  // Filter by Repo
  const repoFilter = document.getElementById('history-repo-filter');
  if (repoFilter) {
    repoFilter.addEventListener('change', () => {
      loadHistoryTab(0);
    });
  }

  // Favorite Filter
  const favoriteFilter = document.getElementById('favorite-filter');
  if (favoriteFilter) {
    favoriteFilter.addEventListener('change', () => {
      loadHistoryTab(0);
    });
  }

  // Groups Tab
  function loadGroupsTab() {
    vscode.postMessage({ command: 'loadGroupsTab' });
  }

  const newGroupBtn = document.getElementById('new-group-btn');
  if (newGroupBtn) {
    newGroupBtn.addEventListener('click', () => {
      // TODO: Open group editor
      vscode.postMessage({ command: 'newGroup' });
    });
  }

  // Settings Tab
  function loadSettingsTab() {
    vscode.postMessage({ command: 'loadSettingsTab' });
  }

  // Message Handler
  window.addEventListener('message', event => {
    const { type, data, error } = event.data;

    if (type === 'error') {
      console.error('Error:', error);
      showError(error);
      return;
    }

    if (type === 'success') {
      switch (lastCommand) {
        case 'loadCopyTab':
          renderCopyTab(data);
          break;
        case 'loadHistoryTab':
          renderHistoryTab(data);
          break;
        case 'loadGroupsTab':
          renderGroupsTab(data);
          break;
        case 'loadSettingsTab':
          renderSettingsTab(data);
          break;
        case 'copyToClipboard':
          showSuccess('Copied to clipboard!');
          break;
        case 'toggleFavorite':
          showSuccess('Favorite toggled');
          break;
        case 'deleteHistoryEntry':
          showSuccess('Entry deleted');
          loadHistoryTab(0);
          break;
      }
    }
  });

  let lastCommand = '';

  function hookCommand(command) {
    lastCommand = command;
  }

  // Render Functions
  function renderCopyTab(data) {
    const container = document.getElementById('copy-content');
    if (!data) {
      container.innerHTML = '<p class="placeholder">Select a group or history entry to preview</p>';
      return;
    }

    const repos = new Set();
    data.metadata?.forEach(m => {
      if (m.repoName) repos.add(m.repoName);
    });

    const html = `
      <div class="preview-section">
        <div class="section-header">Summary</div>
        <div class="preview-summary">
          <div class="summary-item">
            <span class="summary-label">Files:</span>
            <span class="summary-value">${data.fileCount || '?'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Size:</span>
            <span class="summary-value">${formatBytes(data.byteSize)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Lines:</span>
            <span class="summary-value">${data.lineCount}</span>
          </div>
          ${repos.size > 1 ? `
          <div class="summary-item">
            <span class="summary-label">Repos:</span>
            <span class="summary-value">${repos.size}</span>
          </div>
          ` : ''}
        </div>
      </div>

      <div class="preview-section">
        <div class="section-header">Preview</div>
        <div class="preview-code">${escapeHtml(data.preview)}</div>
        ${data.lineCount > 50 ? '<p class="placeholder" style="padding: var(--spacing-md) 0;">… (${data.lineCount - 50} more lines)</p>' : ''}
      </div>

      <div class="copy-actions">
        <button class="btn-primary" onclick="copyPreview()">📋 Copy to Clipboard</button>
        <button class="btn-secondary" onclick="openDetailedView()">👁️ Full Preview</button>
      </div>
    `;
    container.innerHTML = html;
  }

  function renderHistoryTab(data) {
    const resultsContainer = document.getElementById('history-results');
    const filterSelect = document.getElementById('history-repo-filter');

    // Update repo filter options
    if (filterSelect && data.repos) {
      const currentValue = filterSelect.value;
      filterSelect.innerHTML = '<option value="">All Repos</option>';
      data.repos.forEach(repo => {
        const option = document.createElement('option');
        option.value = repo;
        option.textContent = repo;
        filterSelect.appendChild(option);
      });
      filterSelect.value = currentValue;
    }

    // Render entries
    if (!data.entries || data.entries.length === 0) {
      resultsContainer.innerHTML = '<p class="placeholder">No entries found</p>';
    } else {
      const html = data.entries.map(entry => `
        <div class="history-entry" onclick="previewHistoryEntry('${entry.id}')">
          <div class="history-entry-title">${escapeHtml(entry.name)}</div>
          <div class="history-entry-meta">
            <span>${formatDate(entry.timestamp)}</span>
            <span>${entry.fileCount} file${entry.fileCount !== 1 ? 's' : ''} • ${formatBytes(entry.size)}</span>
          </div>
          ${entry.repos && entry.repos.length > 0 ? `
          <div class="history-entry-repos">
            ${entry.repos.map(repo => `<span class="repo-badge">${escapeHtml(repo)}</span>`).join('')}
          </div>
          ` : ''}
          <div class="history-entry-actions">
            <button class="action-btn" onclick="event.stopPropagation(); copyHistoryEntry('${entry.id}')">📋 Copy</button>
            <button class="action-btn" onclick="event.stopPropagation(); toggleFavorite('${entry.id}'); event.target.classList.toggle('favorited')">${entry.isFavourite ? '⭐' : '☆'}</button>
            <button class="action-btn" onclick="event.stopPropagation(); deleteHistoryEntry('${entry.id}')">🗑️ Delete</button>
          </div>
        </div>
      `).join('');
      resultsContainer.innerHTML = html;
    }

    // Render pagination
    const paginationContainer = document.getElementById('history-pagination');
    const paginationHtml = `
      ${data.page > 0 ? `<button class="pagination-btn" onclick="loadHistoryTab(${data.page - 1})">← Previous</button>` : ''}
      <span class="pagination-info">${data.page * data.pageSize + 1}-${Math.min((data.page + 1) * data.pageSize, data.total)} of ${data.total}</span>
      ${data.hasMore ? `<button class="pagination-btn" onclick="loadHistoryTab(${data.page + 1})">Next →</button>` : ''}
    `;
    paginationContainer.innerHTML = paginationHtml;
  }

  function renderGroupsTab(data) {
    const container = document.getElementById('groups-list');
    if (!data.groups || data.groups.length === 0) {
      container.innerHTML = '<p class="placeholder">No groups yet. Create one to get started!</p>';
    } else {
      const html = data.groups.map(group => `
        <div class="group-item">
          <div class="group-info">
            <div class="group-name">${escapeHtml(group.name)}</div>
            <div class="group-meta">
              <span>📄 ${group.fileCount} file${group.fileCount !== 1 ? 's' : ''}</span>
              ${group.repos && group.repos.length > 0 ? `<span>${group.repos.length} repo${group.repos.length !== 1 ? 's' : ''}</span>` : ''}
              ${group.isBookmarked ? '<span>📌 Bookmarked</span>' : ''}
            </div>
          </div>
          <div class="group-actions">
            <button class="action-btn" onclick="previewGroup('${group.id}'); switchTab('copy')">👁️</button>
            <button class="action-btn" onclick="copyGroup('${group.id}')">📋</button>
            <button class="action-btn" onclick="editGroup('${group.id}')">✎️</button>
          </div>
        </div>
      `).join('');
      container.innerHTML = html;
    }
  }

  function renderSettingsTab(data) {
    const container = document.getElementById('settings-content');
    const html = `
      <div class="settings-section">
        <div class="settings-section-title">File Processing</div>
        <div class="settings-item">
          <label class="settings-label">
            <input type="checkbox" ${data.skipBinaryFiles ? 'checked' : ''} onchange="updateSetting('skipBinaryFiles', this.checked)">
            Skip Binary Files
          </label>
        </div>
        <div class="settings-item">
          <label class="settings-label">
            <input type="checkbox" ${data.addLineNumbers ? 'checked' : ''} onchange="updateSetting('addLineNumbers', this.checked)">
            Add Line Numbers
          </label>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Size Limits</div>
        <div class="settings-item">
          <label class="settings-label">Max File Size (KB):</label>
          <input type="number" class="settings-input" value="${data.maxFileSize / 1024}" onchange="updateSetting('maxFileSize', this.value * 1024)">
        </div>
        <div class="settings-item">
          <label class="settings-label">Max Total Size (KB):</label>
          <input type="number" class="settings-input" value="${data.maxTotalSize / 1024}" onchange="updateSetting('maxTotalSize', this.value * 1024)">
        </div>
        <div class="settings-item">
          <label class="settings-label">Max File Count:</label>
          <input type="number" class="settings-input" value="${data.maxFileCount}" onchange="updateSetting('maxFileCount', this.value)">
        </div>
        <div class="settings-item">
          <label class="settings-label">Max Directory Depth:</label>
          <input type="number" class="settings-input" value="${data.maxDepth}" onchange="updateSetting('maxDepth', this.value)">
        </div>
      </div>
    `;
    container.innerHTML = html;
  }

  // Helper Functions
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
  }

  function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showError(message) {
    // TODO: Show error notification
    console.error(message);
  }

  function showSuccess(message) {
    // TODO: Show success notification
    console.log(message);
  }

  // Global Functions (called from HTML)
  window.switchTab = switchTab;
  window.loadHistoryTab = loadHistoryTab;
  window.loadGroupsTab = loadGroupsTab;
  window.loadSettingsTab = loadSettingsTab;
  window.previewGroup = (groupId) => {
    hookCommand('loadCopyTab');
    loadCopyTab(groupId);
  };
  window.previewHistoryEntry = (entryId) => {
    hookCommand('loadCopyTab');
    vscode.postMessage({
      command: 'previewHistoryEntry',
      payload: { entryId },
    });
  };
  window.copyPreview = () => {
    hookCommand('copyToClipboard');
    vscode.postMessage({ command: 'copyToClipboard' });
  };
  window.copyHistoryEntry = (entryId) => {
    hookCommand('copyToClipboard');
    vscode.postMessage({
      command: 'copyToClipboard',
      payload: { historyEntryId: entryId },
    });
  };
  window.copyGroup = (groupId) => {
    hookCommand('copyToClipboard');
    vscode.postMessage({
      command: 'copyToClipboard',
      payload: { groupId },
    });
  };
  window.toggleFavorite = (entryId) => {
    hookCommand('toggleFavorite');
    vscode.postMessage({
      command: 'toggleFavorite',
      payload: { entryId },
    });
  };
  window.deleteHistoryEntry = (entryId) => {
    hookCommand('deleteHistoryEntry');
    vscode.postMessage({
      command: 'deleteHistoryEntry',
      payload: { entryId },
    });
  };
  window.editGroup = (groupId) => {
    vscode.postMessage({
      command: 'editGroup',
      payload: { groupId },
    });
  };
  window.updateSetting = (key, value) => {
    vscode.postMessage({
      command: 'updateSetting',
      payload: { [key]: value },
    });
  };
  window.openDetailedView = () => {
    vscode.postMessage({
      command: 'openDetailedView',
    });
  };
})();
