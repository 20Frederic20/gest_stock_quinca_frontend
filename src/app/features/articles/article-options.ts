import { Observable, map } from 'rxjs';
import { SelectOption } from '../../shared/select-search/select-search.component';
import { ArticlesService } from './articles.service';

/**
 * Feeds a select-search in remote mode: the article list is too long to load at once.
 * Without a term, the first page is shown so that the list is not empty when it opens.
 */
export function searchArticleOptions(service: ArticlesService, term: string): Observable<SelectOption[]> {
  const trimmed = term.trim();
  const request = trimmed ? service.search(trimmed) : service.getAll();

  return request.pipe(
    map(page => page.content.map(article => ({ id: article.id, label: `${article.code} — ${article.designation}` }))),
  );
}
