# Copy Groups VS Code Extension

> **Status**: Pre-development design & specification phase  
> **Target Release**: v0.1.0 MVP in 1-2 weeks  
> **License**: MIT

## 🎯 Overview

**Copy Groups** is a VS Code extension that transforms how developers manage and share code context with AI assistants. Instead of manually copying individual files to ChatGPT/Claude repeatedly, users will:

- 📦 **Create logical file groups** (e.g., "Security Review", "Bug #1234 Fix")
- 🏷️ **Tag and organize** groups for discovery
- 🔍 **Filter context** (full code, headers only, docstrings, skeleton, head-tail)
- 💬 **Attach preprompts** ("Analyze for XSS vulnerabilities")
- 📋 **Copy everything in one click** ready for LLM analysis
- 🎯 **Reuse groups** across projects and sessions

### Problem Solved
Developers currently waste 5-15 minutes per analysis session:
- Manually selecting the same files repeatedly
- Copying & pasting code
- Rewriting analysis prompts
- Losing context between sessions

### Solution
One-click context preparation + bookmarkable file sets = 80% less friction.

---

## 📚 Documentation

This project includes **4 comprehensive design documents**:

### 1. [DESIGN_DOCUMENT.md](DESIGN_DOCUMENT.md) - Strategy & Debate
**Read this first** if you want to understand the **why** and **debate** around the extension.

- Executive summary & problem statement
- Proposed solution architecture (Clean Architecture)
- Complete feature specification (MVP + roadmap)
- SOLID principles & DRY implementation
- Core debate points (trade-offs)
- Technical risks & success metrics
- Example usage scenarios

**Best for**: Decision makers, architects, understanding the big picture

---

### 2. [ARCHITECTURE.md](ARCHITECTURE.md) - Technical Implementation
**Read this second** if you're **building the extension**.

- Detailed project structure
- Layer-by-layer breakdown with code examples
- Domain model & entities (Group, FileReference, ContextMode, Preprompt)
- Dependency injection setup
- Core algorithms (context extraction, export formatting)
- Testing strategy (Jest examples)
- Build & packaging setup
- Development workflow

**Best for**: Developers, architects, implementation

---

### 3. [UI_UX_DESIGN.md](UI_UX_DESIGN.md) - Visual & Interaction Design
**Read this for UI/UX decisions**.

- Design philosophy & principles
- Component designs with ASCII mockups
  - Sidebar groups list
  - Inline group editor
  - Preview panel
  - Context menus
  - Dialogs (create, edit, add files, tags, preprompts)
- Keyboard shortcuts (complete reference)
- Animations & feedback mechanisms
- Accessibility (WCAG 2.1 AA)
- Responsive behavior
- Onboarding flow
- Error recovery UX
- Design system components

**Best for**: UI/UX designers, frontend developers, anyone reviewing mockups

---

### 4. [README.md](README.md) - This File
Quick navigation, setup, and contribution guide.

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────┐
│    Presentation (Sidebar + Commands)│
│      - TreeView, WebView, Dialogs   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Application (Services)            │
│      - GroupService                 │
│      - ExportService                │
│      - ContextExtractionService     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Domain (Business Logic)           │
│      - Group entity                 │
│      - FileReference, Tag, Preprompt│
│      - ContextMode value object     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Infrastructure (Persistence)      │
│      - GroupRepository              │
│      - FileSystemAdapter            │
│      - StateManagementService       │
└─────────────────────────────────────┘
```

**Key Principles**: 
- ✅ Clean Architecture (separation of concerns)
- ✅ SOLID (maintainable, testable, extensible)
- ✅ DRY (no code duplication)
- ✅ Dependency Inversion (interfaces, not implementations)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- VS Code 1.70+
- TypeScript 4.7+

### Setup
```bash
# Clone and navigate
git clone <repository-url>
cd vscode-copygroups

# Install dependencies
npm install

# Watch for changes
npm run esbuild-watch

# Run tests
npm test

# Debug
# Press F5 in VS Code to launch extension in debug mode
```

### Project Structure
```
vscode-copygroups/
├── DESIGN_DOCUMENT.md          # Why, debate, strategy
├── ARCHITECTURE.md              # How, technical details
├── UI_UX_DESIGN.md             # Mockups, interactions
├── README.md                    # (this file)
├── package.json                 # Extension manifest
├── tsconfig.json
├── jest.config.js
├── src/
│   ├── extension.ts             # Entry point
│   ├── presentation/            # UI layer
│   ├── application/             # Services layer
│   ├── domain/                  # Business logic
│   ├── infrastructure/          # Persistence
│   ├── utils/                   # Shared utilities
│   └── constants/               # Constants
├── test/
│   ├── unit/
│   └── integration/
└── .vscode/
    ├── launch.json              # Debug config
    └── settings.json
```

---

## 💡 Core Concepts

### Group
A collection of files with metadata and settings.
```typescript
{
  id: "uuid-123",
  name: "Security Review",
  description: "Review auth layer for vulnerabilities",
  fileReferences: [ { uri: "file:///.../auth/guard.ts" } ],
  contextMode: { type: "docstring" },
  preprompt: { name: "Security Review Template", template: "..." },
  tags: ["backend", "urgent"],
  isBookmarked: true,
  createdAt: "2026-05-03T...",
  updatedAt: "2026-05-03T..."
}
```

### Context Modes
Control what code is extracted:
- **`full`**: Entire file
- **`docstring`**: Comments & docs only
- **`headers`**: First N lines (e.g., file header + imports)
- **`skeleton`**: Function signatures, class defs (structure only)
- **`head-tail`**: First N + last M lines (context without middle)

### Preprompts
Reusable LLM instruction templates with variable substitution.
```
"Analyze these files for {{mode}}:\n{{context}}"
// Vars: {{groupName}}, {{fileCount}}, {{timestamp}}, {{mode}}, {{context}}
```

### Persistence
Groups stored in workspace-local JSON (`.vscode/copygroups.json`):
```json
{
  "version": 1,
  "groups": [ { Group objects } ],
  "preprompts": [ { Preprompt objects } ]
}
```

---

## 📋 MVP Feature Set

### Phase 1 (v0.1.0) - Core
- [x] Create, edit, delete groups
- [x] Add/remove files from groups
- [x] Context mode selection (full, headers, docstring, skeleton, head-tail)
- [x] Copy group to clipboard (formatted markdown)
- [x] Sidebar tree view + basic commands
- [x] Keyboard shortcuts
- [x] Persistence (workspace-local JSON)

### Phase 2 (v0.2.0) - Polish
- [ ] Tagging & filtering
- [ ] Group search
- [ ] Bookmarks/favorites
- [ ] Export as JSON, Markdown
- [ ] Preprompt system
- [ ] Preview panel
- [ ] Performance optimizations

### Phase 3 (v0.3.0+) - Advanced
- [ ] Cloud sync (optional premium)
- [ ] Team collaboration
- [ ] ChatGPT/Claude integration
- [ ] AST-based skeleton extraction
- [ ] Usage analytics

---

## 🧪 Testing Strategy

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm test -- --coverage
```

Test structure (see [ARCHITECTURE.md](ARCHITECTURE.md#testing-strategy)):
- `/test/unit/services` - Business logic
- `/test/unit/repositories` - Persistence
- `/test/unit/utils` - Utilities
- `/test/integration` - End-to-end

---

## 🎨 Design Highlights

### UI Philosophy
1. **Clarity**: One action = one concept
2. **Progressive Disclosure**: Hide advanced options
3. **Immediate Feedback**: Toast messages, live preview
4. **Keyboard-First**: Power users never use mouse
5. **Defaults That Work**: Smart presets reduce friction

### Key Shortcuts
| Action | Shortcut |
|--------|----------|
| Create Group | `Cmd+Shift+G` (Mac) / `Ctrl+Shift+G` (Win) |
| Add File | `Cmd+Shift+A` / `Ctrl+Shift+A` |
| Copy Group | `Cmd+Shift+C` / `Ctrl+Shift+C` |
| Preview | `Cmd+Shift+P` / `Ctrl+Shift+P` |
| Open Sidebar | `Cmd+K Cmd+G` / `Ctrl+K Ctrl+G` |

See [UI_UX_DESIGN.md](UI_UX_DESIGN.md#keyboard-shortcuts) for full reference.

---

## 🔧 Build & Release

```bash
# Development build (with sourcemaps)
npm run esbuild

# Production build (minified)
npm run vscode:prepublish

# Package for marketplace
vsce package

# Publish to VS Code Marketplace
vsce publish
```

---

## 📊 Success Metrics

### v0.1.0 Release Goals
- **Adoption**: 10% of active users create first group within 1 week
- **Engagement**: 30% create 3+ groups within first month
- **Frequency**: Average 1 group per week (recurring)
- **Satisfaction**: 4.5+ stars on marketplace
- **Performance**: 
  - Activation: < 100ms
  - Copy operation: < 500ms (for 10 files)
  - Memory: < 50MB with 100 groups

---

## 🎯 Design Principles

This project embodies:

### Clean Architecture
- **Separation of Concerns**: Each layer has single responsibility
- **Testability**: Mock implementations, dependency injection
- **Extensibility**: Add new context modes without changing existing code

### SOLID Principles
- **S**ingle Responsibility: Services do one thing well
- **O**pen/Closed: Easy to extend (new extractors), hard to break
- **L**iskov Substitution: All implementations swap seamlessly
- **I**nterface Segregation: Don't force callers to depend on unused methods
- **D**ependency Inversion: Depend on abstractions, not concrete classes

### DRY (Don't Repeat Yourself)
- Shared utilities extracted
- Reusable UI components
- Common patterns abstracted

---

## 🤝 Contributing

### Development Workflow
1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes, following [ARCHITECTURE.md](ARCHITECTURE.md) structure
3. Run tests: `npm test`
4. Commit with clear message: `git commit -m "feat: add X"`
5. Push and create pull request

### Code Style
- TypeScript strict mode enabled
- ESLint configuration for consistency
- Format with Prettier
- Follow VS Code extension guidelines

### Before You Start
1. Read [DESIGN_DOCUMENT.md](DESIGN_DOCUMENT.md) for context
2. Review [ARCHITECTURE.md](ARCHITECTURE.md) for structure
3. Check [UI_UX_DESIGN.md](UI_UX_DESIGN.md) for component specs

---

## 📈 Roadmap

```
Mar 2026 ─────┬─────── Apr 2026 ─────┬─────── May 2026 ─────┬───→
             │                      │                      │
        v0.0.1: Core Concepts    v0.1.0: MVP         v0.2.0: Polish
        - Architecture            - Groups              - Tags, Search
        - Domain Model            - Context Modes       - Preprompts
        - Basic UI                - Copy to Clipboard   - Preview

Jun 2026 ─────┬─────── Jul 2026+ ──────┬─────────────────────→
             │                      │
        v0.3.0: Advanced        v1.0.0: Stable Release
        - Cloud Sync            - Official Marketplace
        - Collaboration         - AI Integration
        - Analytics             - Team Features
```

---

## ❓ FAQ

### Why not just use copy-paste?
Because copy-paste doesn't scale. With 5-10 files, you're done in 2 minutes. With 50 files across multiple sessions, you waste hours. Groups + bookmarks + keyboard shortcuts = 80% less friction.

### Why workspace-local storage instead of cloud?
**MVP philosophy**: Start simple, zero infrastructure. Users can share `.vscode/copygroups.json` via git. Cloud sync comes in v0.3.0 as optional premium feature.

### Why preprompts?
AI performance depends heavily on prompt quality. By storing templates, users spend less time writing prompts and more time getting better analysis. Example: "Security Review Template" automatically guides the LLM toward security analysis.

### Is this open source?
Yes, MIT license. Contributions welcome.

### How does this compare to [Similar Extension]?
This is the first extension to combine:
1. **File grouping** (organize, don't lose context)
2. **Context filtering** (control what's sent to AI)
3. **Preprompts** (LLM-specific instructions)
4. **Reusability** (bookmarks, tags)

---

## 📞 Support

- **Issues**: GitHub Issues (bugs, feature requests)
- **Discussions**: GitHub Discussions (questions, ideas)
- **Docs**: See the 4 documents in this repo
- **Contact**: [Your contact info]

---

## 📝 License

MIT License - see LICENSE file

---

## 🙏 Acknowledgments

- Built with [VS Code Extension API](https://code.visualstudio.com/api)
- Inspired by real developer workflows
- Designed with AI-era use cases in mind

---

## Next Steps

1. **Validate**: Get feedback from 5-10 beta testers
2. **Build**: Implement core MVP (1-2 weeks)
3. **Test**: Unit + integration testing
4. **Release**: v0.1.0 to marketplace
5. **Iterate**: Gather feedback, plan v0.2.0

---

**Last Updated**: May 3, 2026  
**Version**: 0.0.1 (Pre-development)
