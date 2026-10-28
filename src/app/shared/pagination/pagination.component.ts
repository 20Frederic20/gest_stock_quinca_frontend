import { Component, computed, input, output } from '@angular/core';
import { PageInfo } from '../../core/models/page.model';

const MAX_VISIBLE_PAGES = 5;

/** Sliding window of page indexes (from 0), centred on the current page. */
export function visiblePages(page: number, totalPages: number): number[] {
  if (totalPages <= 0) return [];

  const count = Math.min(MAX_VISIBLE_PAGES, totalPages);
  let start = page - Math.floor(count / 2);
  start = Math.max(0, Math.min(start, totalPages - count));

  return Array.from({ length: count }, (_, i) => start + i);
}

/** ‹ 1 2 3 4 5 › under a list. Hidden for endpoints that are not paginated yet. */
@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css',
})
export class PaginationComponent {
  /** null = endpoint not paginated: nothing is rendered. */
  info = input<PageInfo | null>(null);
  /** Noun shown after the total, e.g. "1842 articles". */
  itemsLabel = input('éléments');

  /** Requested page, counted from 0 like Spring. */
  pageChange = output<number>();

  pages = computed(() => {
    const info = this.info();
    return info ? visiblePages(info.page, info.totalPages) : [];
  });

  goTo(page: number): void {
    const info = this.info();
    if (!info || page < 0 || page >= info.totalPages || page === info.page) return;
    this.pageChange.emit(page);
  }
}
