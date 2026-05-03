# Changelog

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
