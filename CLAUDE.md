# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run esbuild          # Development build with sourcemaps
npm run esbuild-watch    # Watch mode build
npm run vscode:prepublish # Minified production build
npm run lint             # ESLint on src/
npm test                 # Jest test suite
npm run package          # Create .vsix package
```

To run a single test file: `npx jest path/to/test.test.ts`

## Architecture

This is a VS Code extension that lets users create reusable file groups and copy them as markdown context for AI assistants, with configurable extraction modes (full, skeleton, docstring, headers, head-tail, smart).

The codebase follows Clean Architecture with four layers wired together via dependency injection in [extension.ts](src/extension.ts) — there are no singletons or global state.

**Domain Layer** (`src/domain/`) — entities (`Group`, `CopyHistoryEntry`, `Preprompt`), value objects (`ContextMode`, `FileReference`, `CopyConfig`), and repository interfaces. Value objects export `validate*()` type guard functions.

**Application Layer** (`src/application/`) — services orchestrate business logic:
- `ExportService`: the main "Copy Group" pipeline — filters files by glob patterns/size/binary, calls `ContextExtractionService` per file, formats markdown, writes clipboard, records history.
- `ContextExtractionService`: dispatches to extraction mode implementations; delegates Python-specific logic to `PythonContextExtractor` (which does AST-like class/function parsing), falls back to generic regex for other languages.
- `GroupService`, `CopyHistoryService`, `PrepromptService`: CRUD for their respective entities.

**Infrastructure Layer** (`src/infrastructure/`) — VS Code-specific adapters. Repositories persist to `context.globalState` (groups, history, config) or `~/.vscode-copygroups/` files (preprompts). `VSCodeFileProvider` wraps `workspace.fs`. All repositories extend `BaseObservable` and emit change events for UI sync across windows (via `setKeysForSync()`).

**Presentation Layer** (`src/presentation/`) — `GroupTreeProvider` and `HistoryTreeProvider` subscribe to repository change events and call `refresh()`. There is also an optional `CopyGroupsWebviewProvider`.

**Copy flow:**
```
User → copygroups.copyGroup command
  → ExportService.exportGroup()
    → pattern/binary/size filtering
    → ContextExtractionService.extract() per file
    → format markdown with preprompt ({{context}} placeholder)
    → clipboard.writeText()
    → CopyHistoryService.record()
  → HistoryTreeProvider refreshes
```

**Preprompts** use `{{context}}` as a placeholder; if omitted, context is appended at the end. Built-in templates are bundled; custom ones are stored as files in `~/.vscode-copygroups/`.

**File URIs** are always `vscode.Uri`; `FileReference.uri` is stored as a string for serialization portability.
