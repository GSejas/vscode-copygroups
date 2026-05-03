# Copy Groups Extension: Design & Implementation Debate

## Executive Summary

**Copy Groups** is a proposed VS Code extension that transforms file management and context sharing by introducing a **set-based, taggable file collection system** with AI-ready preprocessing. Instead of copying individual files to chatbots, users will create, track, bookmark, and reuse logical groupings of files with customizable context extraction modes.

**Core Value Proposition:**
- 🎯 **Reduced Cognitive Load**: Reusable file sets eliminate repetitive file selection
- 🔄 **Workflow Optimization**: One-click context preparation for LLM analysis
- 📊 **Context Control**: Granular filtering from docstrings to full code
- 🎨 **Smart Sharing**: Preprompts, analysis modes, and multi-destination export

---

## Problem Statement

### Current Workflow Friction

1. **Manual Repetition**: Users repeatedly select the same files for similar analysis tasks
2. **Context Management**: No standardized way to control what code context is shared (full files vs. headers only)
3. **AI Prep Work**: Manually formatting and explaining what code to analyze before pasting into ChatGPT/Claude
4. **Lost Context**: File relationships and analytical intent aren't preserved across sessions
5. **Scale Issues**: Large codebases require extensive copy-pasting; small selections lose important context

### Target Scenarios

- **Code Review Prep**: Gather related files, add "Review for security vulnerabilities", copy to Claude
- **Bug Analysis**: Bookmark files involved in a bug, reuse when regression appears 6 months later
- **Architecture Analysis**: Tag files by layer, analyze all "controller" files with specific prompts
- **Onboarding**: Save "essential files" collection to share with new team members
- **Documentation**: Extract headers only from files, combine with analysis prompt "Summarize architecture"

---

## Proposed Solution Architecture

### Domain Model (Clean Architecture)

```
┌─────────────────────────────────────────┐
│         Presentation Layer (UI)         │
│  - WebView/Sidebar                      │
│  - Commands & Palette Integration       │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│      Application Layer (Orchestration)   │
│  - GroupService                         │
│  - ExportService                        │
│  - ContextFilterService                 │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│        Domain Layer (Business Logic)    │
│  - Group (Entity)                       │
│  - FileReference (Value Object)         │
│  - ContextMode (Value Object)           │
│  - Preprompt (Entity)                   │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│     Infrastructure Layer (Persistence)  │
│  - GroupRepository                      │
│  - FileSystemAdapter                    │
│  - StateManagementService               │
└─────────────────────────────────────────┘
```

### Core Entities

#### Group
```typescript
interface Group {
  id: string;                    // UUID
  name: string;                  // "Backend Controllers", "Bug #1234"
  description?: string;
  fileReferences: FileReference[];
  preprompt?: Preprompt;
  tags: Tag[];
  isBookmarked: boolean;
  createdAt: Date;
  updatedAt: Date;
  contextMode: ContextMode;
  metadata?: Record<string, any>;
}
```

#### FileReference
```typescript
interface FileReference {
  uri: string;                   // vscode URI
  relativePath: string;          // For portability
  lines?: LineRange;            // Optional: specific section
  overrideContextMode?: ContextMode; // Per-file override
}

interface LineRange {
  start: number;
  end: number;
}
```

#### Preprompt
```typescript
interface Preprompt {
  id: string;
  name: string;                  // "Security Review", "Architecture Summary"
  template: string;              // "Analyze these files for {{mode}}: {{context}}"
  mode: 'analysis' | 'summary' | 'review' | 'custom';
  variables: Record<string, string>;
}
```

#### ContextMode (Value Object)
```typescript
type ContextMode = 
  | { type: 'full' }                        // Entire file
  | { type: 'docstring' }                   // Comments & docstrings only
  | { type: 'headers'; maxLines: number }   // First N lines
  | { type: 'skeleton' }                    // Structure: function signatures, class defs
  | { type: 'head-tail'; headLines: number; tailLines: number }
  | { type: 'smart'; heuristic: 'main-exports' | 'public-api' }; // LLM hints
```

#### Tag
```typescript
interface Tag {
  id: string;
  name: string;                  // "urgent", "architecture", "backend"
  color?: string;                // RGB for UI
}
```

---

## Feature Specification

### Core Features (MVP)

#### 1. Group Management
- ✅ Create/edit/delete groups
- ✅ Add/remove files from groups (via file explorer context menu)
- ✅ Drag-drop files into groups
- ✅ Rename and describe groups
- ✅ Duplicate groups (copy a set)

#### 2. Tagging & Organization
- ✅ Apply multiple tags to groups
- ✅ Filter groups by tag
- ✅ Bookmark favorite groups (pinned in sidebar)
- ✅ Search groups by name, tags, or content

#### 3. Context Modes
- ✅ Select context mode per group (or override per file)
- ✅ Preview what will be extracted before copying
- ✅ Real-time line counting for "headers" mode

#### 4. Preprompts
- ✅ Create/store preprompt templates
- ✅ Attach preprompt to group
- ✅ Variable substitution ({{groupName}}, {{timestamp}}, {{fileCount}})
- ✅ Copy preprompt + context to clipboard in one action

#### 5. Export & Sharing
- ✅ Copy to clipboard (markdown format)
- ✅ Export as JSON (for sharing with team)
- ✅ Direct integration with chatbot extensions (future)
- ✅ Share via URL (cloud persistence, future)

#### 6. Persistence
- ✅ Groups stored in workspace `.vscode/copygroups.json` (workspace-local)
- ✅ Optional: Cloud sync to user settings (future)
- ✅ Auto-save on changes

---

## UI/UX Design Philosophy

### Design Principles (Designer Instincts)

1. **Clarity Over Density**: One cognitive task per view
2. **Progressive Disclosure**: Advanced options hidden until needed
3. **Immediate Feedback**: See changes reflected instantly
4. **Keyboard-First**: Power users never leave keyboard
5. **Defaults That Work**: Smart suggestions reduce friction

### Proposed UI Layout

#### Sidebar Panel: "Copy Groups"
```
┌─────────────────────────────────┐
│ 📋 COPY GROUPS                  │
│ [+ New Group] [Search...]       │
├─────────────────────────────────┤
│ ⭐ Bookmarked (3)              │
│   ├─ Security Review            │
│   ├─ Bug #1234 Analysis         │
│   └─ Onboarding Essentials      │
├─────────────────────────────────┤
│ 📁 Recent (5)                   │
│   ├─ Backend Controllers        │
│   ├─ Payment Flow               │
│   └─ ...                        │
├─────────────────────────────────┤
│ 🏷️ Tags                         │
│   [backend] [urgent] [arch...] │
└─────────────────────────────────┘

⊕ Right-click: Copy to Clipboard, Edit, Delete, Tag
⊙ Click: Open Group Details
```

#### Group Details Panel
```
┌────────────────────────────────────┐
│ Security Review           [Close]  │
├────────────────────────────────────┤
│ Files (4)                          │
│ ☑ auth/guard.ts           [×]     │
│ ☑ auth/jwt.ts             [×]     │
│ ☑ config/secrets.ts       [×]     │
│ ☑ middleware/cors.ts      [×]     │
│                                    │
│ [+ Add Files]                      │
├────────────────────────────────────┤
│ Context Mode:                      │
│ ◉ Full Code                        │
│ ○ Headers Only (30 lines)         │
│ ○ Docstrings Only                 │
│ ○ Skeleton                        │
│ ○ Head-Tail (10 head, 5 tail)    │
├────────────────────────────────────┤
│ Preprompt:                         │
│ [Select: "Security Review"...] [×] │
├────────────────────────────────────┤
│ Tags: [backend] [urgent]           │
│ ☑ Bookmark this group             │
├────────────────────────────────────┤
│ [Preview] [Copy to Clipboard]     │
│           [Export as JSON]        │
│           [Share Link] (future)   │
└────────────────────────────────────┘
```

#### Quick Actions (Keyboard Shortcuts & Commands)
```
cmd+shift+g    → Quick Create Group
cmd+shift+c    → Copy Selected Group
cmd+shift+a    → Add Current File to Group
cmd+k cmd+shift+g → Show Copy Groups Panel
```

---

## SOLID Principles & Clean Architecture

### Single Responsibility Principle (SRP)
- `GroupService`: Group CRUD operations only
- `ContextExtractionService`: File content filtering
- `ExportService`: Format conversion (markdown, JSON, etc.)
- `PersistenceService`: Load/save to storage

### Open/Closed Principle (OCP)
```typescript
// Easy to add new context modes without modifying existing code
interface ContextExtractor {
  extract(filePath: string): Promise<string>;
}

class DocstringExtractor implements ContextExtractor { ... }
class SkeletonExtractor implements ContextExtractor { ... }
class CustomExtractor implements ContextExtractor { ... }

// Factory pattern
const extractors: Record<ContextMode['type'], ContextExtractor> = {
  docstring: new DocstringExtractor(),
  skeleton: new SkeletonExtractor(),
  // Easy to add more
};
```

### Liskov Substitution Principle (LSP)
- All `Preprompt` implementations work identically
- All `Repository` implementations expose same interface
- Swappable storage backends (local file, cloud, database)

### Interface Segregation Principle (ISP)
```typescript
// Don't force UI to know about storage details
interface GroupRepository {
  getGroup(id: string): Promise<Group>;
  saveGroup(group: Group): Promise<void>;
  deleteGroup(id: string): Promise<void>;
}

// Don't force business logic to know about VS Code API
interface FileContentProvider {
  getContent(uri: string): Promise<string>;
}
```

### Dependency Inversion Principle (DIP)
```typescript
class GroupService {
  constructor(
    private repo: GroupRepository,        // Abstraction
    private fileProvider: FileContentProvider, // Abstraction
    private contextExtractor: ContextExtractionService // Abstraction
  ) {}
}

// Inject concrete implementations
const service = new GroupService(
  new FileSystemGroupRepository(),
  new VSCodeFileProvider(),
  new ContextExtractionService(extractors)
);
```

### DRY (Don't Repeat Yourself)
- Shared utilities extracted to `/utils` folder
- Reusable UI components
- Common patterns abstracted (e.g., error handling middleware)

---

## Implementation Strategy

### Tech Stack
- **Language**: TypeScript (strong typing, scalability)
- **UI**: VS Code WebView API (native, no external frameworks for MVP)
- **Storage**: Workspace-local JSON + VS Code storage API
- **Testing**: Jest + ts-jest
- **Build**: esbuild (fast, minimal overhead)

### Folder Structure (Clean Architecture)
```
src/
├── presentation/          # UI Layer
│   ├── webview/
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── main.ts
│   ├── commands/          # Command palette handlers
│   └── treeview/          # Sidebar tree view
├── application/           # Orchestration Layer
│   ├── services/
│   │   ├── GroupService.ts
│   │   ├── ExportService.ts
│   │   └── ContextExtractionService.ts
│   └── dto/               # Data transfer objects
├── domain/                # Business Logic
│   ├── entities/
│   │   ├── Group.ts
│   │   ├── FileReference.ts
│   │   └── Preprompt.ts
│   ├── valueObjects/
│   │   ├── ContextMode.ts
│   │   └── Tag.ts
│   └── interfaces/        # Repository contracts
├── infrastructure/        # Persistence Layer
│   ├── repositories/
│   │   ├── GroupRepository.ts
│   │   └── PrepromptRepository.ts
│   ├── adapters/
│   │   ├── VSCodeFileProvider.ts
│   │   └── FileSystemAdapter.ts
│   └── storage/
│       └── StateManagementService.ts
├── utils/                 # Shared utilities
│   ├── logger.ts
│   ├── validators.ts
│   └── formatters.ts
└── extension.ts           # Entry point, DI setup
```

### Key Algorithms

#### ContextMode Extraction
```typescript
async extractContext(
  filePath: string, 
  mode: ContextMode
): Promise<string> {
  const content = await fileProvider.getContent(filePath);
  
  switch (mode.type) {
    case 'full':
      return content;
    
    case 'docstring':
      return extractDocstrings(content); // Regex/AST
    
    case 'headers':
      return content.split('\n').slice(0, mode.maxLines).join('\n');
    
    case 'skeleton':
      return extractFunctionSignatures(content); // AST parse
    
    case 'head-tail':
      const lines = content.split('\n');
      return [
        ...lines.slice(0, mode.headLines),
        '\n... (middle content omitted) ...\n',
        ...lines.slice(-mode.tailLines)
      ].join('\n');
  }
}
```

#### Smart Export Format
```typescript
async exportWithPreprompt(
  group: Group
): Promise<string> {
  const fileContents = await Promise.all(
    group.fileReferences.map(async (ref) => ({
      file: ref.relativePath,
      content: await extractContext(ref.uri, ref.overrideContextMode || group.contextMode)
    }))
  );

  if (group.preprompt) {
    const prompt = fillTemplate(group.preprompt.template, {
      groupName: group.name,
      fileCount: group.fileReferences.length,
      timestamp: new Date().toISOString(),
      mode: group.contextMode.type,
      context: fileContents.map(f => f.content).join('\n\n---\n\n')
    });
    return prompt;
  }

  return formatAsMarkdown(fileContents);
}
```

### Persistence Strategy
```json
// .vscode/copygroups.json
{
  "version": 1,
  "groups": [
    {
      "id": "uuid-1",
      "name": "Security Review",
      "files": [
        { "relativePath": "src/auth/guard.ts", "lines": null },
        { "relativePath": "src/middleware/cors.ts", "lines": [1, 50] }
      ],
      "contextMode": { "type": "docstring" },
      "preprompt": "uuid-preprompt-1",
      "tags": ["backend", "urgent"],
      "isBookmarked": true,
      "createdAt": "2026-05-03T...",
      "updatedAt": "2026-05-03T..."
    }
  ],
  "preprompts": [
    {
      "id": "uuid-preprompt-1",
      "name": "Security Review",
      "template": "Review these files for security vulnerabilities:\n{{context}}",
      "mode": "review"
    }
  ]
}
```

---

## Design Debate: Pros vs. Cons

### ✅ PROS

| Aspect | Benefit | Impact |
|--------|---------|--------|
| **Productivity** | 1-click context sharing vs. 10 minutes of manual copying | High adoption, ROI in first week |
| **Workflow Efficiency** | Reusable groups eliminate repetition | Especially valuable for recurring analysis |
| **Context Control** | Granular filtering prevents data leaks | Enterprise security friendly |
| **AI Integration** | Preprompts reduce prompt engineering time | Better LLM output quality |
| **Portability** | Share `.vscode/copygroups.json` with team | Onboarding & collaboration |
| **Simple MVP** | Sidebar UI + keyboard shortcuts = quick initial release | Fast time-to-market |
| **SOLID Architecture** | Easy to extend (new extractors, storage backends) | Future-proof |
| **No Dependencies** | Built with VS Code API only | Minimal performance impact |

### ⚠️ CONS

| Aspect | Challenge | Mitigation |
|--------|-----------|-----------|
| **Learning Curve** | New concept users must understand | Onboarding guide + templates |
| **File Staleness** | Groups reference files; if files move/delete, UX breaks | Graceful degradation, smart path resolution |
| **Storage Conflicts** | Multiple users editing `.vscode/copygroups.json` simultaneously | Git-aware merge strategy (future) |
| **AST Parsing Overhead** | Skeleton extraction requires language-specific parsers | Start with regex, add AST later (PHP, Java, etc.) |
| **Cloud Sync Complexity** | Sharing groups across machines adds data consistency concerns | Optional feature (v2), use workspace settings first |
| **UI Complexity vs. Simplicity** | Balancing features with ease-of-use | Progressive disclosure, templates reduce friction |
| **Performance at Scale** | 500+ files in single group could be slow | Lazy loading, pagination, performance monitoring |

---

## Core Debate Questions

### 1. **File Copilot vs. Context Manager?**

**Argument A (File Copilot)**: Focus on "copying sets efficiently"
- Quick wins, immediate utility
- Minimal scope, faster delivery
- Risk: Feels like a "nice-to-have" not essential

**Argument B (Context Manager)**: Focus on "managing code context for AI"
- Deeper value proposition (AI era positioning)
- Attracts power users, better retention
- Risk: Requires more thought on preprompts/modes

**Recommendation**: Hybrid approach. Start with file copilot (MVP), gradually introduce AI context modes. Messaging emphasizes "AI-Ready Context" from day 1, but implementation is backwards compatible.

---

### 2. **Workspace-Local vs. Cloud Sync?**

**Argument A (Workspace-Local)**: `.vscode/copygroups.json` only
- ✅ Zero dependencies, zero infrastructure costs
- ✅ Git-friendly (share via repo)
- ❌ Can't sync across machines
- ❌ Team collaboration requires workarounds

**Argument B (Cloud Sync)**:
- ✅ Seamless cross-machine experience
- ✅ Team-level sharing native
- ❌ Privacy concerns, infrastructure cost
- ❌ More complex (auth, data retention)

**Recommendation**: MVP with workspace-local, architecture prepared for cloud as future plugin. Users can export/import JSON manually for now.

---

### 3. **AST Parsing vs. Regex-Based?**

**Argument A (Regex for MVP)**:
- ✅ No dependencies, instant
- ✅ Works for most languages
- ❌ Fragile (edge cases with comments, strings)

**Argument B (AST Parsing)**:
- ✅ Robust, language-aware
- ✅ True "skeleton" extraction
- ❌ Language-specific dependencies
- ❌ Slower, complex

**Recommendation**: Regex MVP (docstring, header extraction). Flag "skeleton" mode as experimental. Upgrade to AST for JS/TS only (built-in support). Other languages get regex.

---

### 4. **WebView UI vs. Tree View Only?**

**Argument A (Tree View Sidebar Only)**:
- ✅ Lighter, simpler
- ✅ Follows VS Code patterns
- ❌ Limited editing capabilities
- ❌ Preview/search weak

**Argument B (Full WebView)**:
- ✅ Rich UI, good preview
- ✅ Better for discovery
- ❌ More code, slower development

**Recommendation**: Hybrid. Sidebar tree view (primary interaction), WebView panel opened on demand for editing/previewing. 80/20 rule.

---

### 5. **Real-Time Sync vs. Explicit Save?**

**Argument A (Real-Time Sync)**:
- ✅ Always up-to-date, "it just works"
- ❌ Risk of corrupting JSON mid-edit
- ❌ Can't have unsaved drafts

**Argument B (Explicit Save)**:
- ✅ User control, predictable
- ❌ Manual steps, friction
- ❌ Inconsistent state

**Recommendation**: Real-time sync with debouncing (500ms). Atomic writes, JSON schema validation before save. Undo/redo support in UI.

---

## Technical Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| File references become stale (moved/deleted) | Medium | Validate on load, show warnings, smart path resolution |
| Group JSON corruption | High | Strict schema validation, versioning, backup on save |
| Performance with large groups (1000+ files) | Medium | Lazy evaluation, streaming export, progress UI |
| Preprompt variable injection (security) | Low | Whitelist variables, escape output, no code execution |
| Cross-platform path issues (Windows vs. Mac/Linux) | Medium | Use VS Code URI abstraction, normalize paths |

---

## Success Metrics

### KPIs for v1 Release
1. **Adoption**: 10% of active users create first group within 1 week
2. **Engagement**: 30% of users create 3+ groups within first month
3. **Frequency**: Average user creates 1 group per week (recurring)
4. **Satisfaction**: 4.5+ stars on extension marketplace
5. **Sharing**: 5% of workspace-level adoption (teams sharing `.vscode/copygroups.json`)

### Technical Metrics
- Activation time: < 100ms
- Copy operation: < 500ms (10 files)
- Memory footprint: < 50MB even with 100 groups
- Zero crashes in first 10,000 sessions

---

## Roadmap

### Phase 1 (MVP): v0.1.0
- [ ] Basic CRUD for groups
- [ ] Context modes: full, headers, docstring
- [ ] Preprompt system
- [ ] Copy to clipboard
- [ ] Sidebar UI + commands

### Phase 2 (v0.2.0)
- [ ] Tagging & filtering
- [ ] Group templates (marketplace-like)
- [ ] Export as JSON/Markdown
- [ ] Search & bookmarks
- [ ] Performance optimizations

### Phase 3 (v0.3.0+)
- [ ] Cloud sync (optional premium)
- [ ] Team collaboration features
- [ ] Integration with ChatGPT/Claude extensions
- [ ] Analytics on group usage
- [ ] Skeleton mode with AST (JS/TS first)
- [ ] Scheduled analysis (cron-like)

---

## Conclusion

**Copy Groups** addresses a real pain point in the AI-assisted development era: **managing and sharing code context efficiently**. By combining clean architecture with thoughtful UI design, we can deliver a simple MVP that scales to enterprise needs.

**The extension succeeds if:**
1. ✅ Users adopt it because it saves real time
2. ✅ Architecture allows easy feature expansion
3. ✅ It becomes the "go-to" way to prepare code for LLM analysis
4. ✅ Teams naturally share groups via git

**Next steps:**
- Validate with 5-10 beta testers
- Build MVP (sidebar + copy functionality, ~1 week)
- Gather feedback on preprompt usefulness
- Iterate on context modes based on real usage

---

## Appendix: Example Usage Flow

### Scenario: Reviewing Authentication Security

**User's Mental Model:**
> "I want to audit all auth-related files, add a security prompt, and send to Claude"

**Actual Flow:**

1. `Cmd+Shift+G` → "Create Group"
2. Type: "Security Review: Auth"
3. Right-click auth files → "Add to Group"
4. Select `ContextMode: "Docstring"`
5. Choose Preprompt: "Security Review Template"
6. `Cmd+Shift+C` → Copy (includes preprompt + context)
7. Paste into Claude Chat
8. ⭐ Bookmark group for future use

**Result**: 30-second process vs. 5-10 minutes manual copying + prompt writing

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-03  
**Author**: Design Team  
**Status**: Ready for Community Feedback
