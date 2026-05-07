import { GroupItem } from '../../../src/presentation/treeview/GroupTreeProvider';
import { Group } from '../../../src/domain/entities/Group';
import { ContextMode } from '../../../src/domain/valueObjects/ContextMode';
import { FileReference } from '../../../src/domain/valueObjects/FileReference';
import { Preprompt } from '../../../src/domain/entities/Preprompt';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    name: 'My Group',
    description: undefined,
    fileReferences: [],
    contextMode: { type: 'full' } as ContextMode,
    tags: [],
    isBookmarked: false,
    preprompt: undefined,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makePreprompt(name: string): Preprompt {
  return {
    id: 'p1',
    name,
    template: 'Review: {{context}}',
    mode: 'review',
    isSystem: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

// ─── GroupItem description ────────────────────────────────────────────────────

describe('GroupItem description', () => {
  it('shows file count and context mode', () => {
    const ref = (uri: string): FileReference => ({ uri, relativePath: uri.split('/').pop()! });
    const group = makeGroup({ fileReferences: [ref('file:///a.ts'), ref('file:///b.ts')] });
    const item = new GroupItem(group);
    expect(item.description).toBe('2 files · full');
  });

  it('uses singular "file" for exactly one file', () => {
    const group = makeGroup({ fileReferences: [{ uri: 'file:///a.ts', relativePath: 'a.ts' }] });
    const item = new GroupItem(group);
    expect(item.description).toMatch(/^1 file ·/);
  });

  it('shows 0 files when group is empty', () => {
    const item = new GroupItem(makeGroup({ fileReferences: [] }));
    expect(item.description).toMatch(/^0 files ·/);
  });

  it('includes preprompt name in description when preprompt is set', () => {
    const group = makeGroup({ preprompt: makePreprompt('Security Review') });
    const item = new GroupItem(group);
    expect(item.description).toContain('Security Review');
    expect(item.description).toContain('📝');
  });

  it('does not include preprompt indicator when no preprompt', () => {
    const item = new GroupItem(makeGroup({ preprompt: undefined }));
    expect(item.description).not.toContain('📝');
  });

  it('shows mode before preprompt name', () => {
    const group = makeGroup({
      contextMode: { type: 'skeleton' } as ContextMode,
      preprompt: makePreprompt('Code Review'),
    });
    const item = new GroupItem(group);
    expect(item.description).toMatch(/skeleton.*Code Review/);
  });

  it('appends tags after mode', () => {
    const group = makeGroup({ tags: [{ id: 't1', name: 'backend' }, { id: 't2', name: 'api' }] });
    const item = new GroupItem(group);
    expect(item.description).toContain('backend');
    expect(item.description).toContain('api');
  });

  it('appends tags after preprompt name when both are set', () => {
    const group = makeGroup({
      preprompt: makePreprompt('Review'),
      tags: [{ id: 't1', name: 'auth' }],
    });
    const item = new GroupItem(group);
    const desc = item.description as string;
    const prepromptIdx = desc.indexOf('Review');
    const tagIdx = desc.indexOf('auth');
    expect(prepromptIdx).toBeGreaterThanOrEqual(0);
    expect(tagIdx).toBeGreaterThan(prepromptIdx);
  });
});

// ─── GroupItem tree properties ────────────────────────────────────────────────

describe('GroupItem tree properties', () => {
  it('sets contextValue to groupItem for non-bookmarked groups', () => {
    const item = new GroupItem(makeGroup({ isBookmarked: false }));
    expect(item.contextValue).toBe('groupItem');
  });

  it('sets contextValue to groupItemBookmarked for bookmarked groups', () => {
    const item = new GroupItem(makeGroup({ isBookmarked: true }));
    expect(item.contextValue).toBe('groupItemBookmarked');
  });

  it('primary click command is copygroups.copyGroup', () => {
    const item = new GroupItem(makeGroup());
    expect(item.command?.command).toBe('copygroups.copyGroup');
    expect(item.command?.arguments).toEqual(['g1']);
  });
});
