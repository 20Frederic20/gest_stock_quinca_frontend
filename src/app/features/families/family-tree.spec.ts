import { Family } from '../../core/models/family.model';
import { buildFamilyTree, descendantIds } from './family-tree';

function family(id: string, displayOrder: number, parentId: string | null = null): Family {
  return {
    id, label: id, displayOrder, parentId, parentLabel: null, createdAt: '', updatedAt: '',
  };
}

describe('buildFamilyTree', () => {
  it('returns an empty list for no families', () => {
    expect(buildFamilyTree([])).toEqual([]);
  });

  it('sorts roots by display order', () => {
    const rows = buildFamilyTree([family('b', 20), family('a', 10)]);

    expect(rows.map(r => r.family.id)).toEqual(['a', 'b']);
  });

  it('puts each child right after its parent, one level deeper', () => {
    const rows = buildFamilyTree([
      family('a', 10),
      family('b', 20),
      family('a2', 12, 'a'),
      family('a1', 11, 'a'),
    ]);

    expect(rows.map(r => r.family.id)).toEqual(['a', 'a1', 'a2', 'b']);
    expect(rows.map(r => r.depth)).toEqual([0, 1, 1, 0]);
  });

  it('keeps grandchildren, since the backend allows more than two levels', () => {
    const rows = buildFamilyTree([family('a1x', 1, 'a1'), family('a1', 1, 'a'), family('a', 1)]);

    expect(rows.map(r => r.family.id)).toEqual(['a', 'a1', 'a1x']);
    expect(rows.map(r => r.depth)).toEqual([0, 1, 2]);
  });

  it('shows as a root a family whose parent is missing from the list', () => {
    const rows = buildFamilyTree([family('x', 5, 'unknown')]);

    expect(rows).toEqual([{ family: expect.objectContaining({ id: 'x' }), depth: 0 }]);
  });

  it('never loses a family, even in a corrupted cycle', () => {
    const rows = buildFamilyTree([family('p', 1, 'q'), family('q', 2, 'p')]);

    expect(rows.map(r => r.family.id).sort()).toEqual(['p', 'q']);
  });
});

describe('descendantIds', () => {
  const families = [
    family('a', 1),
    family('a1', 1, 'a'),
    family('a1x', 1, 'a1'),
    family('b', 2),
  ];

  it('includes the family itself and all its descendants', () => {
    expect([...descendantIds(families, 'a')].sort()).toEqual(['a', 'a1', 'a1x']);
  });

  it('contains only the family when it has no children', () => {
    expect([...descendantIds(families, 'b')]).toEqual(['b']);
  });
});
