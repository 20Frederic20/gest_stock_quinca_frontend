import { Role } from '../../core/models/user.model';
import { HelpBlock, HelpSection } from './help-content';

/** The sections a role may read, with the role-dependent bullets resolved. A section left empty is dropped. */
export function sectionsForRole(role: Role, all: HelpSection[]): HelpSection[] {
  return all
    .filter(section => section.roles.includes(role))
    .map(section => ({ ...section, blocks: resolveBlocks(section.blocks, role) }))
    .filter(section => section.blocks.length > 0);
}

function resolveBlocks(blocks: HelpBlock[], role: Role): HelpBlock[] {
  const resolved: HelpBlock[] = [];
  for (const block of blocks) {
    if (block.type !== 'role-bullets') {
      resolved.push(block);
      continue;
    }
    const items = block.byRole[role] ?? [];
    if (items.length > 0) resolved.push({ type: 'bullets', items });
  }
  return resolved;
}

/** Length of the matching route prefix, or -1. `/invoices` matches `/invoices/1`; `/invoices/` only `/invoices/…`. */
function matchLength(route: string, path: string): number {
  if (route.endsWith('/')) return path.startsWith(route) ? route.length : -1;
  return path === route || path.startsWith(route + '/') ? route.length : -1;
}

/**
 * The section to open for a URL: the longest route prefix wins (so `/invoices/abc` opens the section
 * listing `/invoices/`), the first listed wins a tie, and the first section is the fallback.
 */
export function sectionForUrl(sections: HelpSection[], url: string): HelpSection | undefined {
  const path = url.split(/[?#]/)[0];
  let best: HelpSection | undefined;
  let bestLength = -1;
  for (const section of sections) {
    for (const route of section.routes) {
      const length = matchLength(route, path);
      if (length > bestLength) {
        best = section;
        bestLength = length;
      }
    }
  }
  return best ?? sections[0];
}
