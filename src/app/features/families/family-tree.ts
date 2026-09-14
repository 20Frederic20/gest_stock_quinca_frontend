import { Family } from '../../core/models/family.model';

export interface FamilyRow {
  family: Family;
  /** 0 = root, 1 = child, 2 = grandchild… */
  depth: number;
}

const byDisplayOrder = (a: Family, b: Family) =>
  a.displayOrder - b.displayOrder || a.label.localeCompare(b.label);

/** Children of each family, keyed by parent id. Parents missing from the list are ignored. */
function groupByParent(families: Family[]): Map<string, Family[]> {
  const ids = new Set(families.map(f => f.id));
  const children = new Map<string, Family[]>();

  for (const family of families) {
    if (family.parentId && ids.has(family.parentId)) {
      children.set(family.parentId, [...(children.get(family.parentId) ?? []), family]);
    }
  }
  return children;
}

/**
 * Flattens the families in display order: each family is followed by its children.
 * The backend only forbids cycles, so any depth is handled.
 */
export function buildFamilyTree(families: Family[]): FamilyRow[] {
  const children = groupByParent(families);
  const ids = new Set(families.map(f => f.id));
  const rows: FamilyRow[] = [];
  const visited = new Set<string>();

  const visit = (family: Family, depth: number) => {
    if (visited.has(family.id)) return;
    visited.add(family.id);
    rows.push({ family, depth });
    for (const child of [...(children.get(family.id) ?? [])].sort(byDisplayOrder)) {
      visit(child, depth + 1);
    }
  };

  // A family whose parent is not in the list is shown as a root, otherwise it would vanish.
  families
    .filter(f => !f.parentId || !ids.has(f.parentId))
    .sort(byDisplayOrder)
    .forEach(f => visit(f, 0));

  // Families caught in a cycle have no root above them: still show them.
  families
    .filter(f => !visited.has(f.id))
    .sort(byDisplayOrder)
    .forEach(f => visit(f, 0));

  return rows;
}

/** The family and everything below it: none of them can become its parent. */
export function descendantIds(families: Family[], id: string): Set<string> {
  const children = groupByParent(families);
  const result = new Set<string>([id]);
  const pending = [id];

  while (pending.length > 0) {
    for (const child of children.get(pending.pop()!) ?? []) {
      if (!result.has(child.id)) {
        result.add(child.id);
        pending.push(child.id);
      }
    }
  }
  return result;
}
