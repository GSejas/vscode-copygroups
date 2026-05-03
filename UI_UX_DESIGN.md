# Copy Groups: UI/UX Design Specification

## Design Philosophy

**Principle**: Make power users' workflows frictionless while remaining intuitive for newcomers.

**Core Tenets**:
1. **One action = one concept** (clarity)
2. **Discoverable without documentation** (intuitiveness)
3. **Keyboard-first, but mouse-friendly** (accessibility)
4. **No unnecessary clicks** (efficiency)
5. **Immediate feedback** (responsiveness)

---

## Color & Theme

### Light Theme
```
Primary Blue:     #007ACC (VS Code blue)
Success Green:    #107C10
Warning Orange:   #FFB900
Error Red:        #F7630C
Neutral Gray:     #ECECEC

Text Primary:     #333333
Text Secondary:   #666666
Border:           #D0D0D0
```

### Dark Theme
```
Primary Blue:     #007ACC
Success Green:    #107C10
Warning Orange:   #FFB900
Error Red:        #F44747
Neutral Dark:     #1E1E1E

Text Primary:     #E0E0E0
Text Secondary:   #A0A0A0
Border:           #3E3E42
Background:       #252526
```

---

## Component Designs

### 1. Sidebar: Groups List View

```
┌────────────────────────────────────────┐
│ 📋 COPY GROUPS    [?]                  │
├────────────────────────────────────────┤
│ [Search... 🔍]                         │
├────────────────────────────────────────┤
│ ⭐ BOOKMARKED (3)                      │
│   ┌─ 🔐 Security Review                │
│   │   4 files • 2 tags • 5m ago       │
│   │   [⋮ menu]                        │
│   │                                    │
│   ├─ 🐛 Bug #1234 Fix                  │
│   │   2 files • 1 tag • 1h ago        │
│   │   [⋮ menu]                        │
│   │                                    │
│   └─ 👥 Onboarding Essential Files    │
│       6 files • 0 tags • 3d ago       │
│       [⋮ menu]                        │
├────────────────────────────────────────┤
│ 📁 RECENT (7)                          │
│   ├─ Backend Controllers               │
│   ├─ Payment Flow                      │
│   ├─ Auth Module                       │
│   ├─ Config Files                      │
│   ├─ Utilities                         │
│   ├─ Response Middleware               │
│   └─ Error Handlers                    │
│       [Show all...]                   │
├────────────────────────────────────────┤
│ 🏷️ TAGS (Quick Filter)                 │
│ [backend] [urgent] [frontend]          │
│ [docs] [refactor] [security]           │
│                                        │
│ [+ New Tag]                            │
├────────────────────────────────────────┤
│ [+ Create New Group]                   │
└────────────────────────────────────────┘
```

**Interactions**:
- **Left-click group**: Expands inline editor (see below)
- **Right-click group**: Context menu (Copy, Edit, Delete, Tag, Bookmark)
- **Click tag**: Filters groups to show only those with that tag
- **Drag file to group** (from explorer): Adds file
- **Double-click group name**: Inline rename

---

### 2. Inline Group Editor (Expanded in Sidebar)

```
┌────────────────────────────────────────┐
│ [^] Security Review          [×]       │  ← Collapse | Close
├────────────────────────────────────────┤
│ Description: (optional)                │
│ [Review authentication layer f...]    │
├────────────────────────────────────────┤
│ FILES (4)                              │
│ ☑ src/auth/guard.ts          [×]      │
│ ☑ src/auth/jwt.ts            [×]      │
│ ☑ src/config/secrets.ts      [×]      │
│ ☑ src/middleware/cors.ts     [×]      │
│                                        │
│ [+ Add Files...]  [Drag here]         │
├────────────────────────────────────────┤
│ CONTEXT MODE:                          │
│ ◉ Full Code                            │
│ ○ Docstrings Only                     │
│ ○ Headers (max 30 lines)              │
│ ○ Skeleton                            │
│ ○ Head-Tail (10↓, 5↑)                 │
│                                        │
│ [? Learn about modes]                 │
├────────────────────────────────────────┤
│ PREPROMPT:                             │
│ [Select preprompt ▼]                  │
│ 📝 "Security Review Template"         │
│ [✎ Edit] [× Remove]                   │
├────────────────────────────────────────┤
│ TAGS:                                  │
│ [backend] [urgent]  [x]               │
│ [+ Add tag]                           │
├────────────────────────────────────────┤
│ [★ Bookmark]  [Modified 5m ago]       │
├────────────────────────────────────────┤
│ [👁 Preview] [📋 Copy] [💾 Export]    │
└────────────────────────────────────────┘
```

**Interactions**:
- **Click [×] next to file**: Remove from group
- **Click [+ Add Files...]**: File picker dialog
- **Drag files**: Visual feedback (highlight drop zone)
- **[? Learn about modes]**: Tooltip shows examples
- **[👁 Preview]**: Shows formatted output in webview panel
- **[📋 Copy]**: Copies to clipboard + success toast
- **[💾 Export]**: Dropdown menu (JSON, Markdown, etc.)

---

### 3. Preview Panel (WebView)

```
┌────────────────────────────────────────────────┐
│ 📋 Preview: Security Review    [Open in Editor]│
├────────────────────────────────────────────────┤
│ [Context Mode: Full]  [Preprompt: Attached]  │
│ [Copy All]  [Export]  [×]                     │
├────────────────────────────────────────────────┤
│                                                │
│ # Security Review Template                    │
│ Review authentication layer for security      │
│ vulnerabilities:                              │
│                                                │
│ ---                                           │
│                                                │
│ ## src/auth/guard.ts                          │
│ ````                                          │
│ // JWT validation middleware                 │
│ export const jwtGuard = (req, res, next) => {│
│   const token = req.headers.authorization;   │
│   if (!token) return res.status(401).json...  │
│ ````                                          │
│                                                │
│ ## src/auth/jwt.ts                            │
│ (content...)                                 │
│                                                │
│ ## src/config/secrets.ts                      │
│ (content...)                                 │
│                                                │
│ ## src/middleware/cors.ts                     │
│ (content...)                                 │
│                                                │
└────────────────────────────────────────────────┘
```

**Features**:
- **Syntax highlighting** for code blocks
- **Scroll-to-section** navigation (jump to specific file)
- **Copy individual sections** (right-click code block)
- **Live update** as group changes
- **Responsive layout** (responsive text, collapsible sections on small screens)

---

### 4. Context Menu (Right-Click Group)

```
📋 Security Review

┌──────────────────────────────────────┐
│ ✏️  Edit...              [Cmd+E]     │
│ 📋 Copy to Clipboard    [Cmd+Shift+C]│
│ 👁️  Preview             [Cmd+Shift+P]│
│ ────────────────────────────────────  │
│ 🏷️  Add Tag...                       │
│ ★ Bookmark              [Cmd+B]      │
│ ────────────────────────────────────  │
│ 📤 Export...                         │
│    └─ As Markdown                    │
│    └─ As JSON                        │
│    └─ Share (soon)                   │
│ ────────────────────────────────────  │
│ 📋 Duplicate            [Cmd+D]      │
│ 🗑️  Delete              [Cmd+Del]    │
└──────────────────────────────────────┘
```

---

### 5. Create/Edit Dialog

```
┌─────────────────────────────────────────────┐
│ Create New Group                    [×]     │
├─────────────────────────────────────────────┤
│ Group Name * (required)                     │
│ [Security Review________________]           │
│                                             │
│ Description (optional)                      │
│ [Analyze auth files for security...]       │
│                                             │
│ Context Mode:                               │
│ ◉ Full Code                                 │
│ ○ Docstrings Only                          │
│ ○ Headers (max lines: [30_])               │
│ ○ Skeleton                                 │
│ ○ Head-Tail (head: [10], tail: [5])        │
│                                             │
│ Initial Files:                              │
│ ☐ Add from current folder                  │
│ ☐ Add current file                         │
│                                             │
│                               [Cancel] [OK] │
└─────────────────────────────────────────────┘
```

---

### 6. Add Files Dialog

```
┌─────────────────────────────────────────────┐
│ Add Files to "Security Review"      [×]     │
├─────────────────────────────────────────────┤
│ [Search files... 🔍]                        │
│                                             │
│ [Root]                                      │
│  ├─ [⊕] src/                                │
│  │  ├─ [⊕] auth/                           │
│  │  │  ☐ guard.ts                          │
│  │  │  ☐ jwt.ts                            │
│  │  ├─ [⊖] config/                         │
│  │  │  ☑ secrets.ts  ← Selected            │
│  │  └─ [⊕] middleware/                    │
│  │     ☐ cors.ts                           │
│  └─ [⊕] test/                              │
│                                             │
│ (1 file selected)                          │
│ ☑ Include related files                    │
│                               [Cancel] [Add]│
└─────────────────────────────────────────────┘
```

**Smart Features**:
- **Include related files**: Checkboxes for `.test.ts`, `.types.ts`, etc.
- **Quick select patterns**: "All TypeScript in folder", "All tests", etc.

---

### 7. Tag Management Dialog

```
┌─────────────────────────────────────────────┐
│ Manage Tags                         [×]     │
├─────────────────────────────────────────────┤
│ Current Tags in "Security Review":          │
│ [backend ×]  [urgent ×]                     │
│                                             │
│ [+ Add New Tag]                             │
│ ─────────────────────────────────────────── │
│ Available Tags (system-wide):                │
│ ☑ backend         (8 groups)               │
│ ☑ urgent          (3 groups)               │
│ ☐ frontend        (5 groups)               │
│ ☐ docs            (2 groups)               │
│ ☐ refactor        (1 group)                │
│                                             │
│ [Create new tag...]                        │
│                                             │
│                               [Cancel] [Done]│
└─────────────────────────────────────────────┘
```

---

### 8. Preprompt Management

```
┌────────────────────────────────────────────┐
│ Select or Create Preprompt          [×]    │
├────────────────────────────────────────────┤
│ [Search preprompts... 🔍]                   │
│                                            │
│ 📝 System Preprompts:                      │
│  ○ Security Review Template                │
│  ○ Architecture Analysis                   │
│  ○ Performance Optimization                │
│  ○ Documentation Generation                │
│                                            │
│ 📝 Your Preprompts:                        │
│  ● Review for XSS vulnerabilities          │
│    [✎ Edit]  [× Delete]                   │
│                                            │
│  ○ Summarize in bullet points             │
│    [✎ Edit]  [× Delete]                   │
│                                            │
│ [+ Create New Preprompt]                   │
│                          [Cancel] [Select] │
└────────────────────────────────────────────┘
```

**Preprompt Template Editor**:
```
┌────────────────────────────────────────────┐
│ Create Preprompt                    [×]    │
├────────────────────────────────────────────┤
│ Name:                                      │
│ [Security Review Template____________]    │
│                                            │
│ Mode:                                      │
│ [Analysis ▼]  (values: analysis, summary, 
│                        review, custom)     │
│                                            │
│ Template:                                  │
│ ┌────────────────────────────────────────┐ │
│ │Review the following code for security │ │
│ │vulnerabilities:                        │ │
│ │                                        │ │
│ │{{context}}                             │ │
│ │                                        │ │
│ │Focus areas:                            │ │
│ │- Authentication & authorization       │ │
│ │- Input validation                     │ │
│ │- Sensitive data exposure              │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ Available variables:                       │
│ {{context}}     - Extracted file content  │
│ {{groupName}}   - Group name              │
│ {{fileCount}}   - Number of files         │
│ {{timestamp}}   - Current date/time       │
│ {{mode}}        - Context mode name       │
│                                            │
│                       [Cancel] [Create]   │
└────────────────────────────────────────────┘
```

---

## Keyboard Shortcuts

| Shortcut | Command | Mac Alternative |
|----------|---------|-----------------|
| `Ctrl+Shift+G` | Create new group | `Cmd+Shift+G` |
| `Ctrl+Shift+A` | Add file to group | `Cmd+Shift+A` |
| `Ctrl+Shift+C` | Copy group | `Cmd+Shift+C` |
| `Ctrl+Shift+P` | Preview group | `Cmd+Shift+P` |
| `Ctrl+K Ctrl+G` | Open Copy Groups sidebar | `Cmd+K Cmd+G` |
| `Ctrl+B` | Toggle bookmark | `Cmd+B` |
| `Ctrl+D` | Duplicate group | `Cmd+D` |
| `Ctrl+E` | Edit group | `Cmd+E` |
| `Delete` | Delete group (with confirmation) | - |

---

## Animations & Feedback

### Success Toast (appears 3 seconds)
```
┌──────────────────────────────────────┐
│ ✓ Copied "Security Review" to clipboard│
└──────────────────────────────────────┘
```

### Error Toast (stays until dismissed)
```
┌──────────────────────────────────────┐
│ ✗ Failed to add file (file not found)│
│ [Dismiss] [Retry]                    │
└──────────────────────────────────────┘
```

### Loading Indicator (during large exports)
```
┌──────────────────────────────────────┐
│ Preparing 50 files...                │
│ ████████░░░░░░░░░░░░  45%           │
│ [Cancel]                             │
└──────────────────────────────────────┘
```

### Drag & Drop Feedback
- **Hover over group**: Background highlights (opacity +10%)
- **Drag in progress**: Group pulses gently
- **Valid drop**: Green border appears
- **Invalid drop**: Red border + ✗ icon

---

## Accessibility

### WCAG 2.1 AA Compliance

1. **Keyboard Navigation**
   - Tab through all interactive elements
   - Enter to activate, Esc to cancel
   - Arrow keys to navigate lists

2. **Color Contrast**
   - All text 4.5:1 minimum contrast ratio
   - Don't rely solely on color (icons + labels)

3. **Screen Reader**
   - Semantic HTML (`<button>`, `<label>`, ARIA roles)
   - Descriptive labels and alt text
   - Status announcements for dynamic updates

4. **Focus Management**
   - Visible focus indicator (1px solid border)
   - Logical tab order
   - Focus trap in modals (Enter cycles through buttons)

---

## Responsive Behavior

### Narrow Sidebar (< 250px)
- Hide descriptions, show icons only
- Collapse sections to headers
- Stack buttons vertically

### Full Sidebar (> 250px)
- Show full layout (default)

### Mobile/Tablet
- Not primary platform (VS Code is desktop-first)
- Ensure readable at 100% zoom minimum

---

## Dark Mode Considerations

```css
/* Example: Adjust colors for dark mode */
.group-item {
  background-color: var(--vscode-list-activeSelectionBackground);
  color: var(--vscode-list-activeSelectionForeground);
}

.group-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}
```

Use VS Code's built-in theme variables for consistency.

---

## Onboarding Experience

### First-Time User

1. **Welcome Overlay** (appears once)
```
┌────────────────────────────────────────┐
│ Welcome to Copy Groups! 👋             │
├────────────────────────────────────────┤
│                                        │
│ Organize your code for AI analysis     │
│                                        │
│ 1️⃣  Create a group of files           │
│ 2️⃣  Add a preprompt to explain        │
│ 3️⃣  Copy and paste into ChatGPT       │
│                                        │
│ [← Skip]  [Next →]                     │
└────────────────────────────────────────┘
```

2. **Interactive Tutorial**
   - Highlight sidebar with tooltip
   - Highlight "Create Group" button
   - Auto-create sample group ("Example: Review This Code")
   - Guide through adding a file
   - Show preview
   - Copy to clipboard

3. **Sample Preprompts Offered**
   - "Code Review"
   - "Security Analysis"
   - "Performance Analysis"
   - "Documentation"

---

## Performance Indicators

### Loading States
- Groups list: Skeleton placeholder for 200ms before showing
- File preview: Progressive rendering (header first, then code)
- Export: Progress bar for > 1MB output

### Empty States
```
┌────────────────────────────────────────┐
│                                        │
│         📋 No groups yet               │
│                                        │
│ Create your first group to get started │
│                                        │
│      [Create a Group]                  │
│                                        │
└────────────────────────────────────────┘
```

---

## Localization (Future)

- All hardcoded strings: `i18n.t('key')`
- Support RTL languages
- Date/time formatting per locale

---

## Design System: Reusable Components

```typescript
// ButtonGroup
<button primary>Copy</button>
<button secondary>Cancel</button>
<button danger>Delete</button>

// TagList
<tag color="blue">backend</tag>
<tag color="green">urgent</tag>

// FileList
<file-item icon="ts" path="src/auth/guard.ts" selected />

// ContextModeSelector
<radio-group>
  <option>Full Code</option>
  <option>Headers Only</option>
</radio-group>
```

---

## Error Recovery UX

### Scenario: File Not Found
```
┌────────────────────────────────────────┐
│ ⚠️ File not found                       │
├────────────────────────────────────────┤
│ src/auth/guard.ts was moved or deleted │
│                                        │
│ [Locate File]  [Remove from Group]    │
│ [Ignore]                               │
└────────────────────────────────────────┘
```

### Scenario: Corrupted Data
```
┌────────────────────────────────────────┐
│ ✗ Failed to load groups                │
├────────────────────────────────────────┤
│ Data may be corrupted.                 │
│                                        │
│ [Restore from Backup]  [Wipe & Start] │
│ [View Error Log]                       │
└────────────────────────────────────────┘
```

---

## Summary of Design Principles Applied

| Principle | Implementation |
|-----------|-----------------|
| **Clarity** | One interaction = one outcome (no mode switching) |
| **Progressive Disclosure** | Advanced options behind [⋮] menus or "Learn more" |
| **Immediate Feedback** | Toast messages, inline validation, live preview |
| **Keyboard-First** | Every UI action has a keyboard shortcut |
| **Defaults That Work** | Pre-selected "Full Code" context mode, sample preprompts |
| **Minimal Friction** | Auto-save, no "OK" dialogs unless necessary |
| **Accessible** | WCAG AA, screen reader support, high contrast |
| **Consistent** | Uses VS Code native components, theme colors |

