import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { Article } from '../../core/models/article.model';
import { PageResponse } from '../../core/models/page.model';
import { searchArticleOptions } from './article-options';
import { ArticlesService } from './articles.service';

const page = (content: Partial<Article>[]): PageResponse<Article> => ({
  content: content as Article[], totalElements: content.length, totalPages: 1, number: 0, size: 20,
});

describe('searchArticleOptions', () => {
  let service: ArticlesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ArticlesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('searches the backend with the trimmed term', () => {
    searchArticleOptions(service, '  cim ').subscribe();

    const req = httpTesting.expectOne(r => r.url === '/api/v1/articles/search');
    expect(req.request.params.get('term')).toBe('cim');
    req.flush(page([]));
  });

  it('shows the first page of articles before anything is typed', () => {
    searchArticleOptions(service, '   ').subscribe();

    httpTesting.expectOne(r => r.url === '/api/v1/articles').flush(page([]));
  });

  it('labels each article with its code and designation', async () => {
    const options = firstValueFrom(searchArticleOptions(service, 'cim'));

    httpTesting.expectOne(r => r.url === '/api/v1/articles/search').flush(
      page([{ id: 'a1', code: 'CIM-32R', designation: 'Ciment CIM II 32.5R' }]),
    );

    expect(await options).toEqual([{ id: 'a1', label: 'CIM-32R — Ciment CIM II 32.5R' }]);
  });
});
