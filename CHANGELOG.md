# Changelog

## [0.2.15] — 2026-05-23

### Added
- **Append to clipboard** — groups and history entries now have an `+` inline button (and right-click option) that appends to whatever is already on the clipboard, separated by `---`. Build up multi-group context incrementally without overwriting.
- **Add to group from editor title bar** — a file-add icon now appears in the editor toolbar for any open file, letting you add it to a group without switching to the explorer.
- **All settings now visible in VS Code Settings UI** — line numbers, file tree, size limits, patterns, neighbor files, and extraction mode are all configurable via the standard Settings editor. Previously only the default mode was exposed (and mapped to the wrong key, so it did nothing).
- **VS Code settings changes now refresh tree views immediately** — changing a language override or any other setting in the Settings UI no longer requires an extension restart to take effect.

### Fixed
- **Language override migration** — existing users who installed ≤0.2.13 had `python`, `markdown`, `robot`, and `robotfile` defaulting to `skeleton` baked into saved state. The extension now silently clears those stale defaults on startup so all files default to `full` mode as intended.
- **Settings keys were broken** — the two previously exposed settings (`copygroups.context.defaultMode`, `copygroups.context.languageOverrides`) never matched the keys ConfigRepository actually read, so they had no effect. Corrected to `copygroups.defaultContextMode` and `copygroups.languageOverrides`.

## [0.2.14] — 2026-05-07

### Fixed
- **Setting group mode now clears all file-level overrides** — previously, files with a per-file override would ignore a group mode change, silently staying on their old mode. Now, setting the group mode is a group-wide reset: all file overrides are cleared so every file uses the new mode. Files can still be individually overridden afterwards.

## [0.2.13] — 2026-05-07

### Fixed
- **Language overrides no longer ship with opinionated defaults** — `copygroups.context.languageOverrides` now defaults to `{}`. Previously, markdown, python, robot, and robotfile were all defaulting to `skeleton` mode, silently overriding the group's mode and producing empty output for robot files (whose syntax the generic skeleton extractor doesn't understand). The group mode is now authoritative by default. Language overrides remain available as an opt-in power-user setting.

## [0.2.11] — 2026-05-07

### Fixed
- **FileItem now shows the actual extraction mode, not "default"** — files without an override now display the group's mode (e.g. `full`) instead of the opaque `default` label
- **Language override visibility** — when a language config rule silently overrides the group mode (e.g. a Python file in a "full" group gets `skeleton` due to the default `python: skeleton` config), the file now shows `skeleton (lang)` with a tooltip explaining why and how to override it
- Group tooltip per-file list now shows the resolved mode and its source (file override / language override / group)

## [0.2.10] — 2026-05-06

### Added
- **Preview Group button** — `$(eye)` icon on each group item opens a named, read-only editor tab showing the exact markdown that would be copied. Re-clicking the button refreshes the same tab rather than opening a new one
- **Command palette preview** — `Preview Group Contents` prompts for a group when invoked without context
- **Preprompt indicator** — groups with an attached preprompt show `📝 <name>` next to the context mode in the tree description, e.g. `4 files · skeleton · 📝 Security Review`

### Fixed
- Preview tab now has a proper filename derived from the group name (and preprompt if set), not "Untitled-N"
- Preview re-uses the same tab per group via a virtual document provider; no more tab accumulation
- `expandedFolders` unused variable compile error from v0.2.9
- Removed dead `MODES` constant from GroupTreeProvider

## [0.2.9] — 2026-05-06

### Fixed
- **Multi-file selection add to group** — selecting multiple files in the explorer and right-clicking "Add to Group" now adds all selected files. Previously only the right-clicked file was added because the second `allSelectedUris` argument VS Code passes for multi-selection was ignored

## [0.2.8] — 2026-05-06

### Added
- **Open JSON file** option in Manage Preprompts quickpick — opens the custom preprompts storage file directly in the editor for manual editing

## [0.2.7] — 2026-05-06

### Added
- **Copy metadata header** — every copied output now opens with a YAML frontmatter block containing `copied` timestamp, `workspace` path, `os` platform/version, and file count + size summary
- **Per-file annotations** — each file section now shows the absolute path, a `sha7` content hash (for drift detection), and file size
- **Manage Preprompts button** — `$(note)` icon added to the Groups panel title bar, next to Add and Refresh

### Fixed
- **Manage Preprompts double-selection bug** — selecting a preprompt then choosing Edit or Delete previously re-prompted for the preprompt selection. The action now operates directly on the already-selected preprompt
- **Removed webview panel** — the experimental sidebar webview (`copygroups.sidebar`) has been removed; the tree-view panel is the authoritative UI

### Changed
- `createCustomPreprompt`, `editPreprompt`, and `deletePreprompt` are no longer separate commands; all preprompt management flows through `Manage Preprompts`

## [0.2.6] — 2026-05-06

### Added
- **Comprehensive context mode documentation** — clear explanations that `skeleton` and other modes are extraction strategies, not empty files:
  - Added table in ContextMode.ts showing what each mode includes/omits
  - Created `CONTEXT_MODE_DESCRIPTIONS` constant for UI and AI agent reference
  - Each mode now has: title, description, token reduction estimate, use case
  - Added JSDoc in ContextExtractionService.extract() explaining all modes with token reduction percentages
  - Modes explained: **full** (0%), **skeleton** (~70% reduction), **docstring** (~80%), **headers** (variable), **head-tail** (~50%), **smart** (auto)
  - Language-specific notes: what markdown/Python/TypeScript skeleton mode extracts
  
**Why this matters:** When skeleton returns "headers + links", it's a targeted extraction, not an empty file. AI agents and users now understand the difference between "no content" and "structure-only content".

## [0.2.5] — 2026-05-06

### Fixed
- **Markdown skeleton extraction returned empty** — fixed genericExtractMarkdownSkeleton() to extract headers, links, lists instead of looking for code patterns
- **ConfigRepository not reading languageOverrides from settings** — the new `languageOverrides` field was added to CopyConfig but not included in ConfigRepository's keys array, preventing user settings from being read. Settings like `python: skeleton` were silently ignored.
- **getEffectiveContextMode() was unnecessarily async** — caused ~50 unnecessary await calls per group copy operation, adding latency. Now synchronous (pure logic, no I/O).
- **No validation on language override mode values** — users could set invalid modes in settings (e.g., `python: "invalid-mode"`) causing runtime failures. Now validates against allowed types.
- **Comment contradicted precedence order** — documented "language > file" but code actually did "file > language". Comment now matches implementation.
- **Dead code: Dockerfile mapping** — regex never matched `Dockerfile` (no extension), making this setting useless. Removed.

### Added
- **6 new unit tests** for language-aware context modes:
  - Markdown files respect `skeleton` mode override
  - Python files respect `skeleton` mode override
  - Robot files respect `skeleton` mode override
  - File-level overrides take precedence over language overrides
  - Invalid language override modes safely fall back to group mode
  - copyGroup() returns snapshots for building rich notifications

### Changed
- Test suite: 90 → 96 tests
- ExportService: getEffectiveContextMode removed async/Promise wrapper

## [0.2.4] — 2026-05-06

### Added
- **Language-aware context modes** — context mode now automatically adapts to file type:
  - **Default mode changed to `full`** — extract all file content by default
  - **Markdown, Python, and Robot files use `skeleton` mode** — directory structure only, no content extraction
  - Reduces token count for documentation files while preserving full context for code
  - New settings in VS Code preferences under "Copy Groups > Context":
    - `copygroups.context.defaultMode` — change global default (full/skeleton)
    - `copygroups.context.languageOverrides` — customize per-language (e.g., yaml, javascript)
  - Example: Adding markdown to a group uses skeleton; adding TypeScript still uses full mode
- **Language detection** — uses VS Code's built-in `TextDocument.languageId` (zero-cost, native support for 1000+ language IDs)

### Changed
- Default context mode: `skeleton` → `full`
- File-specific overrides > Language overrides > Group context mode (precedence order)

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
