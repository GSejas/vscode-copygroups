# Copy Groups

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

### Preprompt Templates
Attach an LLM instruction template to a group. When you copy, the template wraps your code context automatically.

Right-click a group → **Set Preprompt** to choose from built-in templates:
- Security Review
- Architecture Analysis
- Performance Optimization
- Documentation Generation

### Quick Copy (no groups needed)
- Right-click files in the explorer → **Copy Context** — copies selected files instantly
- Right-click a folder → **Copy Context** — recursively copies all files in the folder

### Copy History
Every copy is recorded in the *Copy History* panel. Re-copy, favourite, annotate, or delete past operations. Right-click a history entry to re-extract with a different context mode.

---

## Getting Started

1. Install the extension
2. Open a project in VS Code
3. Click the **Copy Groups** icon in the Activity Bar
4. Press `Ctrl+Shift+G` to create your first group
5. Right-click files in the explorer → **Add File to Group**
6. Click the group to copy it to clipboard

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

Copy Groups respects workspace-level limits to keep clipboard output manageable. Defaults work out of the box — no setup required.

| Setting | Default | Description |
|---------|---------|-------------|
| Max files per copy | 100 | Hard cap on number of files |
| Max total size | 5 MB | Stop adding files after this |
| Max file size | 1 MB | Skip individual files larger than this |
| Max folder depth | 10 | Recursion depth for folder copy |
| Skip binary files | `true` | Ignore `.exe`, `.png`, etc. |
| Add line numbers | `true` | Prefix each line with a number |
| Exclude patterns | `node_modules/**`, `dist/**`, `.git/**`, … | Glob patterns to skip |

---

## License

MIT — see [LICENSE](LICENSE)
