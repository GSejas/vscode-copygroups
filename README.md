*# Copy Groups

**Copy Groups** is a VS Code extension that prepares code context for AI assistants in one click. Organise files into named groups, control exactly how much code is extracted, attach prompt templates, and copy everything to your clipboard — ready for ChatGPT, Claude, or any LLM.

---

## Features

### File Groups
Create reusable collections of related files. Bookmark the ones you use most.

- **Create group** — `Ctrl+Shift+G` or the `+` button in the sidebar
- **Add files** — right-click any file in the explorer → *Add File to Group*, or use `Ctrl+Shift+A`
- **Copy group** — click the group name or press `Ctrl+Shift+C`; formatted markdown lands on your clipboard

### Context Modes
Control what gets copied for each group — without touching the files.

| Mode | What's included |
|------|-----------------|
| `full` | Entire file |
| `skeleton` | Class/function signatures, imports — no bodies |
| `docstring` | Comments and docstrings only |
| `headers` | First N lines (configurable) |
| `head-tail` | First N + last M lines, middle omitted |
| `smart` | Public API / main exports (Python-optimised) |

Right-click a group → **Set Context Mode** to change it any time.

**Per-File Context Modes** — fine-grain control within a group:
- Expand any group in the sidebar to see individual files, each showing its current mode
- **Hover** a file row to reveal inline icon buttons: `⌃` / `⌄` to cycle modes, `🗑` to remove
- **Right-click** a file for more options: *Set File Mode* (pick from a list), *Open File*, *Remove from Group*
- **Click** any file to open it in the editor
- Per-file modes are respected when copying and exporting

### Preprompt Templates
Attach an LLM instruction template to a group. When you copy, the template wraps your code context automatically.

Right-click a group → **Set Preprompt** to choose from built-in templates:
- **Security Review** — highlights vulnerabilities and security concerns
- **Architecture Analysis** — analyzes design patterns and structure
- **Performance Optimization** — reviews for performance opportunities
- **Documentation Generation** — drafts comprehensive documentation

**Custom Preprompts** — create, edit, and manage your own templates:
- Command palette: `Ctrl+Shift+P` → **Create Custom Preprompt**
- Define name, template text (with `{{variable}}` substitution), and mode
- Use `{{context}}` to position file content inside your template — if omitted, file content is appended automatically
- Stored in `~/.vscode-copygroups/` — shared across all VS Code instances
- Edit and delete custom templates via command palette

### Quick Copy (no groups needed)
- Right-click files in the explorer → **Copy Context** — copies selected files instantly
- Right-click a folder → **Copy Context** — recursively copies all files in the folder

### Project Tree & Neighbor Context
Give the LLM more awareness of what surrounds the code you copy.

- **Project file tree** — when enabled, an ASCII directory tree is prepended to every copy, showing the overall project layout
- **Neighbor files** — when enabled, each directory's un-copied siblings are listed (or included with extracted content) after the main file sections

Both are off by default and controlled via VS Code settings (see [Configuration](#configuration)).

### Copy History
Every copy is recorded in the *Copy History* panel. Re-copy, favourite, annotate, or delete past operations. Right-click a history entry to re-extract with a different context mode.

**Add history files to a group** — right-click any history entry or individual file within it:
- *Add All Files to Group* — adds every file from that snapshot to a group you pick
- *Add File to Group* — adds just that one file
- Duplicates are skipped automatically

---

## Getting Started

1. Install the extension
2. Open a project in VS Code
3. Click the **Copy Groups** icon in the Activity Bar
4. Press `Ctrl+Shift+G` to create your first group
5. Right-click files in the explorer → **Add File to Group**
6. Click the group to copy it to clipboard

---

## Multi-Window Synchronization

Your groups, settings, and custom preprompts sync automatically across all open VS Code instances:

- Create a group in Window A → instantly visible in Window B
- Edit context modes in any window → all windows update within ~100ms
- Custom preprompts stored in `~/.vscode-copygroups/` → shared globally
- Works without any manual intervention or configuration

---

## Keyboard Shortcuts

| Action | Windows / Linux | macOS |
|--------|----------------|-------|
| Create group | `Ctrl+Shift+G` | `Cmd+Shift+G` |
| Add file to group | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Copy active group | `Ctrl+Shift+C` | `Cmd+Shift+C` |

---

## Output Format

Copied content is formatted as markdown with syntax-tagged code fences, ready for any LLM:

````
# Files from Group: Auth Module

Context Mode: `skeleton`
Files: 3

---

## src/auth/guard.ts

```typescript
import { Injectable } from '@nestjs/common';
export class AuthGuard { ... }
```

## src/auth/service.ts

```typescript
export class AuthService {
  async validateToken(token: string): Promise<User> { ... }
}
```
````

---

## Configuration

All settings live under `copygroups.*` and can be edited in VS Code's **Settings UI** (`Ctrl+,`) or directly in `settings.json`. Defaults work out of the box — no setup required.

### Output enrichment

| Setting | Default | Description |
|---------|---------|-------------|
| `copygroups.includeFileTree` | `false` | Prepend an ASCII project tree to the copied output |
| `copygroups.fileTreeDepth` | `3` | How many directory levels to show in the tree (1–10) |
| `copygroups.includeNeighborFiles` | `false` | Append sibling files (not copied) for each directory |
| `copygroups.neighborFileMode` | `"names"` | `"names"` — list filenames only; `"content"` — include extracted code |

### Limits & filtering

| Setting | Default | Description |
|---------|---------|-------------|
| `copygroups.maxFileCount` | `100` | Hard cap on number of files per copy |
| `copygroups.maxTotalSizeBytes` | `5242880` | Stop adding files after this total (5 MB) |
| `copygroups.maxFileSizeBytes` | `1048576` | Skip individual files larger than this (1 MB) |
| `copygroups.maxDirectoryDepth` | `10` | Recursion depth for folder copy |
| `copygroups.skipBinaryFiles` | `true` | Ignore `.exe`, `.png`, etc. |
| `copygroups.addLineNumbers` | `true` | Prefix each line with a line number |
| `copygroups.excludePatterns` | `["node_modules/**", "dist/**", ".git/**", …]` | Glob patterns to skip |
| `copygroups.includePatterns` | `[]` | Glob allowlist — empty means include everything |

---

## License

MIT — see [LICENSE](LICENSE)
*