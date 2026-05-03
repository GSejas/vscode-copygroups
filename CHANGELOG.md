# Changelog

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
