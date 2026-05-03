# Copy Groups Extension: Architecture & Implementation Guide

## Quick Start Reference

### Project Structure
```
vscode-copygroups/
├── README.md                          # User-facing documentation
├── DESIGN_DOCUMENT.md                 # This strategic doc
├── ARCHITECTURE.md                    # (This file) - Technical implementation guide
├── package.json                       # Extension manifest
├── tsconfig.json
├── jest.config.js
├── src/
│   ├── extension.ts                   # Entry point, DI container
│   ├── presentation/
│   │   ├── webview/
│   │   │   ├── index.html
│   │   │   ├── styles.css
│   │   │   ├── main.ts
│   │   │   └── components/
│   │   │       ├── GroupList.ts
│   │   │       ├── GroupEditor.ts
│   │   │       └── TagFilter.ts
│   │   ├── commands/
│   │   │   ├── CreateGroupCommand.ts
│   │   │   ├── AddFileCommand.ts
│   │   │   └── CopyGroupCommand.ts
│   │   └── treeview/
│   │       ├── GroupTreeProvider.ts
│   │       └── TreeItems.ts
│   ├── application/
│   │   ├── services/
│   │   │   ├── GroupService.ts
│   │   │   ├── ExportService.ts
│   │   │   ├── ContextExtractionService.ts
│   │   │   ├── PrepromptService.ts
│   │   │   └── ValidationService.ts
│   │   ├── dto/
│   │   │   ├── GroupDTO.ts
│   │   │   └── ExportDTO.ts
│   │   └── middleware/
│   │       ├── ErrorHandler.ts
│   │       └── Logger.ts
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Group.ts
│   │   │   ├── Preprompt.ts
│   │   │   └── index.ts
│   │   ├── valueObjects/
│   │   │   ├── ContextMode.ts
│   │   │   ├── FileReference.ts
│   │   │   ├── Tag.ts
│   │   │   └── index.ts
│   │   └── interfaces/
│   │       ├── IGroupRepository.ts
│   │       ├── IFileContentProvider.ts
│   │       ├── IContextExtractor.ts
│   │       └── index.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── GroupRepository.ts
│   │   │   ├── PrepromptRepository.ts
│   │   │   └── index.ts
│   │   ├── adapters/
│   │   │   ├── VSCodeFileProvider.ts
│   │   │   ├── FileSystemAdapter.ts
│   │   │   └── index.ts
│   │   └── storage/
│   │       ├── StateManagementService.ts
│   │       └── SchemaValidator.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   ├── pathResolver.ts
│   │   └── index.ts
│   └── constants/
│       ├── ContextModes.ts
│       └── Commands.ts
├── test/
│   ├── unit/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── utils/
│   └── integration/
│       ├── workspace/
│       └── e2e/
└── .vscode/
    ├── launch.json                    # Debug config
    └── settings.json
```

---

## Layer Breakdown & Key Files

### 1. Presentation Layer

#### **commands/CreateGroupCommand.ts**
```typescript
import * as vscode from 'vscode';
import { GroupService } from '../../application/services/GroupService';
import { v4 as uuidv4 } from 'uuid';

export class CreateGroupCommand implements vscode.Disposable {
  private disposable: vscode.Disposable;

  constructor(private groupService: GroupService) {
    this.disposable = vscode.commands.registerCommand(
      'copygroups.createGroup',
      () => this.execute()
    );
  }

  private async execute(): Promise<void> {
    const name = await vscode.window.showInputBox({
      prompt: 'Group name',
      validateInput: (value) => !value.trim() ? 'Name cannot be empty' : null,
    });

    if (!name) return;

    try {
      const group = await this.groupService.createGroup({
        id: uuidv4(),
        name: name.trim(),
        fileReferences: [],
        tags: [],
        isBookmarked: false,
        contextMode: { type: 'full' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vscode.window.showInformationMessage(`Group "${group.name}" created`);
      vscode.commands.executeCommand('copygroups.refreshView');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create group: ${error}`);
    }
  }

  dispose(): void {
    this.disposable.dispose();
  }
}
```

#### **treeview/GroupTreeProvider.ts**
```typescript
import * as vscode from 'vscode';
import { Group } from '../../domain/entities/Group';
import { GroupService } from '../../application/services/GroupService';

export class GroupTreeProvider implements vscode.TreeDataProvider<GroupTreeItem> {
  private onDidChangeTreeData = new vscode.EventEmitter<GroupTreeItem | undefined>();
  readonly onDidChangeTreeDataEmitter = this.onDidChangeTreeData.onDidChangeTreeData;

  constructor(private groupService: GroupService) {}

  async getTreeItem(element: GroupTreeItem): Promise<vscode.TreeItem> {
    return element;
  }

  async getChildren(element?: GroupTreeItem): Promise<GroupTreeItem[]> {
    if (!element) {
      // Root: show bookmarks and recent
      const groups = await this.groupService.getAllGroups();
      const bookmarked = groups.filter(g => g.isBookmarked);
      return bookmarked.map(g => new GroupTreeItem(g, vscode.TreeItemCollapsibleState.None));
    }

    return [];
  }

  refresh(): void {
    this.onDidChangeTreeData.fire(undefined);
  }
}

class GroupTreeItem extends vscode.TreeItem {
  constructor(
    private group: Group,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(group.name, collapsibleState);
    this.description = `${group.fileReferences.length} files`;
    this.contextValue = 'group';
    this.command = {
      command: 'copygroups.copyGroup',
      title: 'Copy Group',
      arguments: [group.id],
    };
  }
}
```

---

### 2. Application Layer

#### **services/GroupService.ts** (Orchestration)
```typescript
import { Group, FileReference } from '../../domain/entities';
import { IGroupRepository } from '../../domain/interfaces';
import { ValidationService } from './ValidationService';
import { ContextExtractionService } from './ContextExtractionService';

export class GroupService {
  constructor(
    private repository: IGroupRepository,
    private validationService: ValidationService,
    private contextExtraction: ContextExtractionService
  ) {}

  async createGroup(groupData: Partial<Group>): Promise<Group> {
    // Validate input
    this.validationService.validateGroup(groupData);

    // Create entity
    const group = new Group(groupData);

    // Persist
    await this.repository.save(group);

    return group;
  }

  async addFileToGroup(groupId: string, fileUri: string): Promise<Group> {
    const group = await this.repository.getById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    // Create file reference
    const fileRef = new FileReference(fileUri);
    group.addFile(fileRef);

    // Persist
    await this.repository.save(group);

    return group;
  }

  async getAllGroups(): Promise<Group[]> {
    return this.repository.getAll();
  }

  async deleteGroup(groupId: string): Promise<void> {
    await this.repository.delete(groupId);
  }
}
```

#### **services/ContextExtractionService.ts**
```typescript
import { ContextMode } from '../../domain/valueObjects/ContextMode';
import { IFileContentProvider } from '../../domain/interfaces';

export class ContextExtractionService {
  constructor(private fileProvider: IFileContentProvider) {}

  async extract(
    fileUri: string,
    mode: ContextMode
  ): Promise<string> {
    const content = await this.fileProvider.getContent(fileUri);

    switch (mode.type) {
      case 'full':
        return content;

      case 'headers':
        return this.extractHeaders(content, mode.maxLines);

      case 'docstring':
        return this.extractDocstrings(content);

      case 'skeleton':
        return this.extractSkeleton(content);

      case 'head-tail':
        return this.extractHeadTail(
          content,
          mode.headLines,
          mode.tailLines
        );

      default:
        return content;
    }
  }

  private extractHeaders(content: string, maxLines: number): string {
    return content.split('\n').slice(0, maxLines).join('\n');
  }

  private extractDocstrings(content: string): string {
    // Remove code, keep comments
    return content
      .split('\n')
      .filter(line => 
        line.trim().startsWith('//') || 
        line.trim().startsWith('/*') ||
        line.trim().startsWith('*') ||
        line.trim().startsWith('/**') ||
        line.trim().startsWith('"""')
      )
      .join('\n');
  }

  private extractSkeleton(content: string): string {
    // Regex-based skeleton (function signatures, class defs)
    const functionRegex = /^(async\s+)?(function|const|let|var)\s+\w+\s*\([^)]*\)/gm;
    const classRegex = /^class\s+\w+/gm;
    const interfaceRegex = /^interface\s+\w+/gm;

    const matches = content.match(
      new RegExp(
        `(${functionRegex.source})|(${classRegex.source})|(${interfaceRegex.source})`,
        'gm'
      )
    );

    return matches?.join('\n') || '';
  }

  private extractHeadTail(
    content: string,
    headLines: number,
    tailLines: number
  ): string {
    const lines = content.split('\n');
    const head = lines.slice(0, headLines);
    const tail = lines.slice(-tailLines);
    const omittedCount = Math.max(0, lines.length - headLines - tailLines);

    return [
      ...head,
      omittedCount > 0 ? `\n... (${omittedCount} lines omitted) ...\n` : '',
      ...tail,
    ].join('\n');
  }
}
```

#### **services/ExportService.ts**
```typescript
import { Group } from '../../domain/entities/Group';
import { ContextExtractionService } from './ContextExtractionService';

export class ExportService {
  constructor(private contextExtraction: ContextExtractionService) {}

  async exportToMarkdown(group: Group): Promise<string> {
    const parts: string[] = [];

    // Add preprompt if exists
    if (group.preprompt) {
      parts.push(`# ${group.preprompt.name}\n`);
      parts.push(group.preprompt.template);
      parts.push('\n---\n\n');
    }

    // Add files
    for (const fileRef of group.fileReferences) {
      const context = await this.contextExtraction.extract(
        fileRef.uri,
        fileRef.overrideContextMode || group.contextMode
      );

      parts.push(`## ${fileRef.relativePath}\n`);
      parts.push('```\n' + context + '\n```\n\n');
    }

    return parts.join('\n');
  }

  async exportToJSON(group: Group): Promise<string> {
    return JSON.stringify(group, null, 2);
  }

  async copyToClipboard(group: Group): Promise<void> {
    const markdown = await this.exportToMarkdown(group);
    // VS Code API call
    return vscode.env.clipboard.writeText(markdown);
  }
}
```

---

### 3. Domain Layer

#### **entities/Group.ts** (Business Logic)
```typescript
import { FileReference } from './FileReference';
import { ContextMode } from '../valueObjects/ContextMode';
import { Tag } from '../valueObjects/Tag';
import { Preprompt } from './Preprompt';

export class Group {
  id: string;
  name: string;
  description?: string;
  fileReferences: FileReference[];
  preprompt?: Preprompt;
  tags: Tag[];
  isBookmarked: boolean;
  contextMode: ContextMode;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;

  constructor(data: Partial<Group>) {
    Object.assign(this, data);
    this.fileReferences = data.fileReferences || [];
    this.tags = data.tags || [];
    this.isBookmarked = data.isBookmarked ?? false;
  }

  addFile(fileRef: FileReference): void {
    if (!this.fileReferences.some(f => f.uri === fileRef.uri)) {
      this.fileReferences.push(fileRef);
      this.updatedAt = new Date();
    }
  }

  removeFile(fileUri: string): void {
    this.fileReferences = this.fileReferences.filter(f => f.uri !== fileUri);
    this.updatedAt = new Date();
  }

  addTag(tag: Tag): void {
    if (!this.tags.some(t => t.id === tag.id)) {
      this.tags.push(tag);
      this.updatedAt = new Date();
    }
  }

  toggleBookmark(): void {
    this.isBookmarked = !this.isBookmarked;
    this.updatedAt = new Date();
  }

  getFileCount(): number {
    return this.fileReferences.length;
  }

  hasTag(tagName: string): boolean {
    return this.tags.some(t => t.name === tagName);
  }
}
```

#### **valueObjects/ContextMode.ts**
```typescript
export type ContextMode =
  | { type: 'full' }
  | { type: 'docstring' }
  | { type: 'headers'; maxLines: number }
  | { type: 'skeleton' }
  | { type: 'head-tail'; headLines: number; tailLines: number }
  | { type: 'smart'; heuristic: 'main-exports' | 'public-api' };

export const CONTEXT_MODE_PRESETS: Record<string, ContextMode> = {
  FULL: { type: 'full' },
  DOCSTRING: { type: 'docstring' },
  HEADERS_20: { type: 'headers', maxLines: 20 },
  HEADERS_50: { type: 'headers', maxLines: 50 },
  SKELETON: { type: 'skeleton' },
  HEAD_TAIL: { type: 'head-tail', headLines: 10, tailLines: 5 },
};
```

#### **interfaces/IGroupRepository.ts**
```typescript
import { Group } from '../entities/Group';

export interface IGroupRepository {
  getById(id: string): Promise<Group | null>;
  getAll(): Promise<Group[]>;
  save(group: Group): Promise<void>;
  delete(id: string): Promise<void>;
  findByTag(tagName: string): Promise<Group[]>;
  search(query: string): Promise<Group[]>;
}
```

---

### 4. Infrastructure Layer

#### **repositories/GroupRepository.ts** (Persistence)
```typescript
import * as vscode from 'vscode';
import { Group } from '../../domain/entities/Group';
import { IGroupRepository } from '../../domain/interfaces/IGroupRepository';
import { StateManagementService } from '../storage/StateManagementService';
import { SchemaValidator } from '../storage/SchemaValidator';

export class GroupRepository implements IGroupRepository {
  private groups: Map<string, Group> = new Map();
  private validator: SchemaValidator;

  constructor(private stateManager: StateManagementService) {
    this.validator = new SchemaValidator();
    this.loadFromStorage();
  }

  async getById(id: string): Promise<Group | null> {
    return this.groups.get(id) || null;
  }

  async getAll(): Promise<Group[]> {
    return Array.from(this.groups.values());
  }

  async save(group: Group): Promise<void> {
    // Validate before saving
    if (!this.validator.validate(group)) {
      throw new Error(`Invalid group: ${this.validator.getErrors()}`);
    }

    this.groups.set(group.id, group);
    await this.persistToStorage();
  }

  async delete(id: string): Promise<void> {
    this.groups.delete(id);
    await this.persistToStorage();
  }

  async findByTag(tagName: string): Promise<Group[]> {
    return Array.from(this.groups.values()).filter(g =>
      g.tags.some(t => t.name === tagName)
    );
  }

  async search(query: string): Promise<Group[]> {
    const q = query.toLowerCase();
    return Array.from(this.groups.values()).filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.description?.toLowerCase().includes(q)
    );
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const data = await this.stateManager.load();
      if (data?.groups) {
        for (const groupData of data.groups) {
          const group = new Group(groupData);
          this.groups.set(group.id, group);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load groups: ${error}`);
    }
  }

  private async persistToStorage(): Promise<void> {
    try {
      const data = {
        version: 1,
        groups: Array.from(this.groups.values()),
        timestamp: new Date().toISOString(),
      };
      await this.stateManager.save(data);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save groups: ${error}`);
    }
  }
}
```

#### **adapters/VSCodeFileProvider.ts**
```typescript
import * as vscode from 'vscode';
import { IFileContentProvider } from '../../domain/interfaces';

export class VSCodeFileProvider implements IFileContentProvider {
  async getContent(fileUri: string): Promise<string> {
    try {
      const uri = vscode.Uri.parse(fileUri);
      const bytes = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder().decode(bytes);
    } catch (error) {
      throw new Error(`Cannot read file: ${fileUri}`);
    }
  }

  async fileExists(fileUri: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.parse(fileUri);
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async getRelativePath(fileUri: string): Promise<string> {
    const uri = vscode.Uri.parse(fileUri);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) return uri.fsPath;

    const relative = vscode.workspace.asRelativePath(uri);
    return relative;
  }
}
```

---

## Dependency Injection Setup

#### **extension.ts** (Main Entry Point)
```typescript
import * as vscode from 'vscode';
import { GroupService } from './application/services/GroupService';
import { GroupRepository } from './infrastructure/repositories/GroupRepository';
import { VSCodeFileProvider } from './infrastructure/adapters/VSCodeFileProvider';
import { StateManagementService } from './infrastructure/storage/StateManagementService';
import { ContextExtractionService } from './application/services/ContextExtractionService';
import { ExportService } from './application/services/ExportService';
import { ValidationService } from './application/services/ValidationService';
import { CreateGroupCommand } from './presentation/commands/CreateGroupCommand';
import { GroupTreeProvider } from './presentation/treeview/GroupTreeProvider';

let groupService: GroupService;

export async function activate(context: vscode.ExtensionContext) {
  // Initialize infrastructure
  const stateManager = new StateManagementService(context);
  const fileProvider = new VSCodeFileProvider();

  // Initialize domain
  const repository = new GroupRepository(stateManager);

  // Initialize application
  const validationService = new ValidationService();
  const contextExtraction = new ContextExtractionService(fileProvider);
  groupService = new GroupService(repository, validationService, contextExtraction);
  const exportService = new ExportService(contextExtraction);

  // Register UI
  const createGroupCmd = new CreateGroupCommand(groupService);
  context.subscriptions.push(createGroupCmd);

  const treeProvider = new GroupTreeProvider(groupService);
  vscode.window.createTreeView('copygroups.groups', {
    treeDataProvider: treeProvider,
  });

  // Register command to refresh view
  vscode.commands.registerCommand('copygroups.refreshView', () => {
    treeProvider.refresh();
  });

  console.log('Copy Groups extension activated');
}

export function deactivate() {}
```

---

## Testing Strategy

### Unit Tests Example
```typescript
// test/unit/services/ContextExtractionService.test.ts
import { ContextExtractionService } from '../../../src/application/services/ContextExtractionService';

describe('ContextExtractionService', () => {
  let service: ContextExtractionService;
  let mockFileProvider: any;

  beforeEach(() => {
    mockFileProvider = {
      getContent: jest.fn(),
    };
    service = new ContextExtractionService(mockFileProvider);
  });

  it('should extract full content when mode is "full"', async () => {
    const content = 'line 1\nline 2\nline 3';
    mockFileProvider.getContent.mockResolvedValue(content);

    const result = await service.extract('file://test.ts', { type: 'full' });

    expect(result).toBe(content);
  });

  it('should extract headers only when maxLines is set', async () => {
    const content = 'line 1\nline 2\nline 3\nline 4';
    mockFileProvider.getContent.mockResolvedValue(content);

    const result = await service.extract('file://test.ts', {
      type: 'headers',
      maxLines: 2,
    });

    expect(result).toBe('line 1\nline 2');
  });
});
```

---

## Building & Packaging

### package.json
```json
{
  "name": "vscode-copygroups",
  "displayName": "Copy Groups",
  "description": "Manage and share reusable file sets with AI-ready context filtering",
  "version": "0.1.0",
  "publisher": "your-publisher",
  "license": "MIT",
  "engines": {
    "vscode": "^1.70.0"
  },
  "categories": [
    "Other"
  ],
  "keywords": [
    "clipboard",
    "file-management",
    "groups",
    "ai",
    "context"
  ],
  "main": "./dist/extension.js",
  "scripts": {
    "vscode:prepublish": "npm run esbuild-base -- --minify",
    "esbuild-base": "esbuild ./src/extension.ts --bundle --outfile=dist/extension.js --external:vscode --platform=node --target=node16",
    "esbuild": "npm run esbuild-base -- --sourcemap",
    "esbuild-watch": "npm run esbuild-base -- --sourcemap --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint src --ext ts"
  },
  "devDependencies": {
    "@types/node": "^18.0.0",
    "@types/vscode": "^1.70.0",
    "@typescript-eslint/eslint-plugin": "^5.30.0",
    "@typescript-eslint/parser": "^5.30.0",
    "esbuild": "^0.14.0",
    "eslint": "^8.18.0",
    "jest": "^28.1.0",
    "ts-jest": "^28.0.5",
    "typescript": "^4.7.4"
  },
  "dependencies": {
    "uuid": "^9.0.0"
  },
  "contributes": {
    "commands": [
      {
        "command": "copygroups.createGroup",
        "title": "Copy Groups: Create New Group"
      },
      {
        "command": "copygroups.addToGroup",
        "title": "Copy Groups: Add File to Group"
      },
      {
        "command": "copygroups.copyGroup",
        "title": "Copy Groups: Copy to Clipboard"
      }
    ],
    "viewsContainers": {
      "sidebar": [
        {
          "id": "copygroups",
          "title": "Copy Groups",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "copygroups": [
        {
          "id": "copygroups.groups",
          "name": "Groups",
          "when": "true"
        }
      ]
    },
    "menus": {
      "explorer/context": [
        {
          "command": "copygroups.addToGroup",
          "group": "1_modification",
          "when": "resourceScheme == file"
        }
      ]
    },
    "keybindings": [
      {
        "command": "copygroups.createGroup",
        "key": "ctrl+shift+g",
        "mac": "cmd+shift+g"
      },
      {
        "command": "copygroups.copyGroup",
        "key": "ctrl+shift+c",
        "mac": "cmd+shift+c"
      }
    ]
  }
}
```

---

## Development Workflow

### Setup
```bash
git clone <repo>
cd vscode-copygroups
npm install
```

### Debug
```bash
npm run esbuild-watch
# Open VSCode, press F5 to launch extension in debug mode
```

### Run Tests
```bash
npm test
npm run test:watch
```

### Build for Release
```bash
npm run vscode:prepublish
vsce package  # Creates .vsix file
```

---

## Performance Considerations

### Optimization Checklist
- [ ] Lazy load groups (don't load all on activate)
- [ ] Debounce file save (500ms max)
- [ ] Cache file content (TTL: 5 minutes)
- [ ] Use streaming for large exports (>5MB)
- [ ] Pagination for groups > 100 items
- [ ] Index groups by tag for fast filtering

### Monitoring
```typescript
class PerformanceMonitor {
  mark(operation: string): void;
  measure(operation: string): number;
  logSlowOperation(operation: string, duration: number): void;
}
```

---

## Error Handling Strategy

### Levels
1. **User-Facing**: Show friendly message in UI
2. **Logging**: Record to extension output channel
3. **Recovery**: Attempt graceful fallback

```typescript
try {
  await groupService.createGroup(data);
} catch (error) {
  if (error instanceof ValidationError) {
    vscode.window.showWarningMessage(`Invalid input: ${error.message}`);
  } else if (error instanceof FileNotFoundError) {
    vscode.window.showErrorMessage(`File no longer exists`);
  } else {
    vscode.window.showErrorMessage(`Unexpected error: ${error.message}`);
    logger.error(error);
  }
}
```

---

## Next Steps

1. **Scaffold Project**: Use Yeoman generator `yo code`
2. **Implement Core**: GroupRepository + GroupService (foundation)
3. **Build UI**: Sidebar tree view + basic commands
4. **Add Context Modes**: Start with 'full' + 'headers'
5. **Test Rigorously**: Unit + integration tests
6. **Gather Feedback**: Beta test with 5-10 users
7. **Polish & Release**: v0.1.0 on marketplace

---

**Estimated MVP Development Time: 1-2 weeks**
- Week 1: Core infrastructure (domain + application + basic UI)
- Week 2: UI polish + testing + documentation

