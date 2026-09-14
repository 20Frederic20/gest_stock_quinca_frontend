import { toPageInfo } from './page.model';

describe('toPageInfo', () => {
  it('keeps the current page and the totals of the Spring response', () => {
    const info = toPageInfo({
      content: [],
      totalElements: 1842,
      totalPages: 93,
      number: 4,
      size: 20,
    });

    expect(info).toEqual({ page: 4, totalPages: 93, totalElements: 1842 });
  });
});
