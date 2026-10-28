/** Paginated response as Spring returns it (`Page<T>`). */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  /** Current page, starting at 0. */
  number: number;
  size: number;
}

/** What the pagination component needs, without the content. */
export interface PageInfo {
  page: number;
  totalPages: number;
  totalElements: number;
}

export function toPageInfo(response: PageResponse<unknown>): PageInfo {
  return {
    page: response.number,
    totalPages: response.totalPages,
    totalElements: response.totalElements,
  };
}
