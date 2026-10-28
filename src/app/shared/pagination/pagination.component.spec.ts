import { TestBed } from '@angular/core/testing';
import { PageInfo } from '../../core/models/page.model';
import { PaginationComponent, visiblePages } from './pagination.component';

describe('visiblePages', () => {
  it('returns every page when there are few', () => {
    expect(visiblePages(0, 3)).toEqual([0, 1, 2]);
  });

  it('returns an empty list when there is no page', () => {
    expect(visiblePages(0, 0)).toEqual([]);
  });

  it('centres a window of 5 pages on the current page', () => {
    expect(visiblePages(10, 40)).toEqual([8, 9, 10, 11, 12]);
  });

  it('pins the window to the start on the first pages', () => {
    expect(visiblePages(1, 40)).toEqual([0, 1, 2, 3, 4]);
  });

  it('pins the window to the end on the last pages', () => {
    expect(visiblePages(39, 40)).toEqual([35, 36, 37, 38, 39]);
  });
});

describe('PaginationComponent', () => {
  function setup(info: PageInfo | null) {
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('info', info);
    fixture.componentRef.setInput('itemsLabel', 'articles');
    fixture.detectChanges();

    const pageChange = vi.fn();
    fixture.componentInstance.pageChange.subscribe(pageChange);

    const element = fixture.nativeElement as HTMLElement;
    const button = (label: string) =>
      [...element.querySelectorAll<HTMLButtonElement>('button')].find(
        b => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
      )!;

    return { element, pageChange, button };
  }

  it('renders nothing for an endpoint that is not paginated', () => {
    const { element } = setup(null);

    expect(element.querySelector('nav')).toBeNull();
  });

  it('renders nothing when everything fits on one page', () => {
    const { element } = setup({ page: 0, totalPages: 1, totalElements: 12 });

    expect(element.querySelector('nav')).toBeNull();
  });

  it('shows the page numbers from 1 and the total', () => {
    const { element } = setup({ page: 4, totalPages: 93, totalElements: 1842 });

    const numbers = [...element.querySelectorAll('.page-number')].map(b => b.textContent?.trim());
    expect(numbers).toEqual(['3', '4', '5', '6', '7']);
    expect(element.querySelector('.current')?.textContent?.trim()).toBe('5');
    expect(element.textContent).toContain('1842 articles');
  });

  it('emits the clicked page, counted from 0', () => {
    const { button, pageChange } = setup({ page: 4, totalPages: 93, totalElements: 1842 });

    button('7').click();

    expect(pageChange).toHaveBeenCalledWith(6);
  });

  it('ignores a click on the current page', () => {
    const { button, pageChange } = setup({ page: 4, totalPages: 93, totalElements: 1842 });

    button('5').click();

    expect(pageChange).not.toHaveBeenCalled();
  });

  it('moves to the previous and next pages', () => {
    const { button, pageChange } = setup({ page: 4, totalPages: 93, totalElements: 1842 });

    button('Page précédente').click();
    button('Page suivante').click();

    expect(pageChange.mock.calls).toEqual([[3], [5]]);
  });

  it('disables previous on the first page and next on the last one', () => {
    expect(setup({ page: 0, totalPages: 3, totalElements: 50 }).button('Page précédente').disabled).toBe(true);
    expect(setup({ page: 2, totalPages: 3, totalElements: 50 }).button('Page suivante').disabled).toBe(true);
  });
});
