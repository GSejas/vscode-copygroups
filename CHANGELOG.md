# Changelog

## [0.2.3] — 2026-05-05

### Added
- **Rich copy notifications** — after copying a group, notification now shows:
  - Final output size (in KB)
  - Number of successfully included files
  - ⚠ Count of files that failed/were excluded (if any)
  - Example: `Copied "Auth Module" (42.3 KB · 8 files) ⚠ 2 errors`

- **Error summaries in preprompt output** — when files fail to copy (too large, missing, binary, etc.), a warnings section is now appended to the bottom of the preprompt output:
  - Lists all excluded files with reasons
  - Format: `**⚠ Warnings (X files excluded):** - file.txt: File too large (2048 KB)`
  - Ensures users see exactly what was included/excluded

### Fixed
- **`copyGroup()` return value** — now returns `{ output: string; snapshots: CopiedFileSnapshot[] }` instead of `void`, enabling callers to inspect what was actually copied (success count, error count, size, etc.)

## [0.2.2] — 2026-05-05

### Fixed
- **Preprompt drops file context when `{{context}}` is missing** — if a custom preprompt template did not include the `{{context}}` placeholder, the copied output contained only the prompt text with no file content. File context is now automatically appended at the end of the output when the template omits `{{context}}`.

## [0.2.1] — 2026-05-05

### Fixed
- **Preprompt commands not in command palette** — 4 preprompt commands (`createCustomPreprompt`, `editPreprompt`, `deletePreprompt`, `managePreprompts`) were implemented in extension.ts but not registered in `contributes.commands`. Added command palette entries so users can access these features via `Ctrl+Shift+P`.

## [0.2.0] — 2026-05-05

### Added
- **Inline per-file mode buttons** — hovering a file row in the Groups tree now shows real clickable icon buttons:
  - `⌃` cycles the file's context mode backward
  - `⌄` cycles the file's context mode forward
  - `🗑` removes the file from the group (with confirmation)
  - Previously these were declared as `TreeItem.buttons` which VS Code does not support; now wired as proper `view/item/context` inline menu entries

- **Right-click menu for file items** — right-clicking any file in the Groups tree now shows:
  - **Set File Mode** — QuickPick to jump directly to any of the 6 modes (marks current)
  - **Open File** — opens the file in the editor
  - **Remove from Group** — same as the inline trash icon

- **Click-to-open on file rows** — single-clicking a file in the Groups tree now opens it in the editor

- **Add history files to a group** — two new right-click actions on the Copy History tree:
  - Right-click a **history entry** → *Add All Files to Group* — picks a group and adds every non-errored file from that copy snapshot
  - Right-click a **file within a history entry** → *Add File to Group* — adds just that one file
  - Both actions deduplicate against existing group files automatically

### Fixed
- **Binary files included in group copy** — `copyGroup` (the `buildOutput` path) was missing the `skipBinaryFiles` and `maxFileSizeBytes` guards that `copySelectedFiles` already had. PNG, SVG, and other binary files in a group were being read as raw bytes and injected into the clipboard output, truncating subsequent text files. Both copy paths now apply identical guards.

- **`removeFileFromGroup` error "Group [object Object] not found"** — a stale duplicate command registration (from the original inline-button attempt, taking `groupId: string`) was shadowing the correct handler. VS Code uses the first registration; the old handler received a `FileItem` object where it expected a string. Duplicate removed.

- **Remove button rendered as text instead of icon** — `removeFileFromGroup` was missing an `"icon"` field in `package.json`, so VS Code showed the full command title string as the inline button label. Added `"$(trash)"`.

### Changed
- `GroupTreeProvider.FileItem.contextValue` changed from `'fileItem'` to `'groupFileItem'` to avoid ambiguity with history tree file items (which remain `'fileItem'`). All `package.json` when-clauses updated accordingly.
- `cycleFileMode` command (positional args) replaced by `cycleFileModeUp` and `cycleFileModeDown` (accept `FileItem` directly, as required by VS Code's inline context menu API).

### Testing
- Added `test/unit/treeview/HistoryTreeProvider.test.ts` — 12 tests covering section structure, favourites/recent filtering, `FileItem` construction including `fileUri`, error marking, leaf node behaviour, and `refresh()` events
- All 88 unit tests passing

## [0.1.9] — 2026-05-05

### Added
- **Custom Preprompts** — users can now create, edit, and delete custom LLM instruction templates via commands:
  - `copygroups.createCustomPreprompt` — create new template with name, template text (with `{{variable}}` substitution), and mode selection
  - `copygroups.editPreprompt` — modify existing custom templates
  - `copygroups.deletePreprompt` — remove custom templates (system templates cannot be deleted)
  - `copygroups.managePreprompts` — central UI for all preprompt operations
  - Custom preprompts are stored in `~/.vscode-copygroups/copygroups-preprompts.json` and shared across all VS Code instances
  
- **Per-File Context Modes** — each file in a group can now have a different context mode:
  - Expand any group in the sidebar to see individual files with inline action buttons
  - **Up/Down arrows** cycle through modes: `full` → `skeleton` → `docstring` → `headers` → `head-tail` → `smart`
  - **Trash button** removes file from group with confirmation
  - Modes are stored per-file and respected when copying/exporting
  - UI integrated into Groups tree view with VS Code standard icons and patterns

- **Multi-Window State Syncing** — groups and configuration now automatically sync across all open VS Code instances:
  - Observer pattern decouples repositories from UI (GroupRepository, ConfigRepository extend `BaseObservable`)
  - File watchers detect globalState changes from other windows and auto-refresh tree views
  - State consistency achieved within ~100ms of external change
  - Fixes DI context leak issue across multiple windows

- **Infrastructure: Observer Pattern** — new base classes for reactive state management:
  - `BaseObservable<T>` — allows repositories to notify multiple subscribers
  - `IObservable<T>` interface for observable behavior
  - Applied to GroupRepository and ConfigRepository for multi-window coordination

- **Infrastructure: LocalFileStorage** — file-based storage in `~/.vscode-copygroups/`:
  - `get<T>(key)`, `update(key, value)`, `delete(key)`, `clear()`
  - Enables cross-instance data sharing (used by custom preprompts)
  - Foundation for future GroupRepository migration

### Changed
- **Preprompt interface** — added optional `isSystem?: boolean` property to distinguish system templates from custom ones
- **SYSTEM_PREPROMPTS** — marked all 4 system preprompts with `isSystem: true`
- **GroupItem tree collapsible state** — groups now open/close to reveal files (was previously leaf nodes)
- **GroupTreeProvider** — expanded to handle 3 node types: `SectionItem`, `GroupItem`, `FileItem`
- **ExportService** — already respects per-file `overrideContextMode` (no changes needed)

### Dependencies
- Added: `crypto.randomUUID()` for preprompt ID generation (replaces external `uuid` package)
- Build size: **67.1kb minified** (was 64.2kb in 0.1.8, +2.9kb for new features)

### Breaking Changes
None. Fully backward compatible.

### Testing
- ✅ All 76 unit tests passing
- ✅ No regressions detected
- ✅ Multi-window syncing verified
- ✅ File-based storage working

## [0.1.8] — 2026-05-04

### Removed
- **Webview sidebar panel** — the "Copy Groups (Webview)" panel has been removed from the sidebar. The extension now uses only the native tree views (Groups and Copy History), which are faster, more reliable, and integrate better with VS Code's UI.

## [0.1.3] — 2026-05-03

### Fixed
- **Global state persistence bug** — CopyHistoryRepository was calling `.update()` on `this.workspaceState` instead of `this.globalState`, causing "Cannot read properties of undefined (reading 'update')" errors. This prevented copy history from being persisted across VS Code instances. Bug fix ensures all repositories now consistently use globalState for cross-instance syncing.

## [0.1.1] — 2026-05-03

### Added
- **Project file tree** — optionally prepend an ASCII directory tree (from workspace root) to every copied output, so the LLM sees overall project structure at a glance. Enable with `copygroups.includeFileTree`; control depth with `copygroups.fileTreeDepth` (default 3)
- **Neighbor files** — optionally append a list (or full extracted content) of sibling files in the same directory that were not part of the copy. Enable with `copygroups.includeNeighborFiles`; set `copygroups.neighborFileMode` to `names` (list only) or `content` (include extracted code)
- **VS Code settings integration** — all configuration options are now exposed as proper workspace settings under `copygroups.*`, editable in VS Code's Settings UI or `settings.json`

## [0.1.0] — 2026-05-03

### Added
- **Groups panel** — create, rename, delete, and bookmark file groups in the sidebar
- **Copy to clipboard** — one-click copy of all group files as AI-ready markdown
- **Context modes** — choose how much of each file to send: `full`, `skeleton`, `docstring`, `headers`, `head-tail`, `smart`
- **Set context mode per group** — right-click any group → "Set Context Mode"
- **Preprompt templates** — attach built-in LLM instruction templates to groups (Security Review, Architecture Analysis, Performance Optimization, Documentation Generation); right-click any group → "Set Preprompt"
- **Copy Context** — explorer right-click to copy any file or folder directly to clipboard
- **Folder copy** — recursively copies all files in a folder with configurable depth
- **Multi-file copy** — select multiple files in the explorer and copy all at once
- **Copy History panel** — every copy operation is automatically recorded; re-copy, favourite, annotate, or delete entries
- **History: Change Context Mode** — re-extract history entries with a different mode
- **Bookmarks** — pin important groups to the top of the groups list
- **Language-tagged code fences** — copied markdown uses syntax-specific fences (` ```typescript `, ` ```python `, etc.)
- **Line numbers** — optional line number prefixes on extracted code (configurable)
- **Config system** — workspace-level limits: max file count, max total size, max file size, directory depth, include/exclude glob patterns, binary file skipping
- **Keyboard shortcuts**: `Ctrl+Shift+G` create group, `Ctrl+Shift+A` add file, `Ctrl+Shift+C` copy group
