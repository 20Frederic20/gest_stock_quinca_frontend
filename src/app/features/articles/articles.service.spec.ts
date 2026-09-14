import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ArticleRequest } from '../../core/models/article.model';
import { PageResponse } from '../../core/models/page.model';
import { ArticlesService } from './articles.service';

const URL = '/api/v1/articles';

const emptyPage = (number = 0): PageResponse<never> => ({
  content: [], totalElements: 0, totalPages: 0, number, size: 20,
});

const body: ArticleRequest = {
  code: 'CIM-32R', barcode: null, designation: 'Ciment CIM II 32.5R', alertThreshold: 2000,
  vatRate: 18, familyId: 'f1', stockUnitId: 'u1',
};

describe('ArticlesService', () => {
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

  it('gets the first page by default', () => {
    service.getAll().subscribe();

    const req = httpTesting.expectOne(r => r.url === URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(emptyPage());
  });

  it('gets the requested page', () => {
    service.getAll(3).subscribe();

    const req = httpTesting.expectOne(r => r.url === URL);
    expect(req.request.params.get('page')).toBe('3');
    req.flush(emptyPage(3));
  });

  it('searches by term, page included', () => {
    service.search('ciment', 2).subscribe();

    const req = httpTesting.expectOne(r => r.url === `${URL}/search`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('term')).toBe('ciment');
    expect(req.request.params.get('page')).toBe('2');
    req.flush(emptyPage(2));
  });

  it('gets the articles of a family', () => {
    service.getByFamily('f1').subscribe();

    const req = httpTesting.expectOne(r => r.url === `${URL}/by-family/f1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    req.flush(emptyPage());
  });

  it('gets one article by id', () => {
    service.getById('a1').subscribe();

    const req = httpTesting.expectOne(`${URL}/a1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates an article', () => {
    service.create(body).subscribe();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('updates an article', () => {
    service.update('a1', body).subscribe();

    const req = httpTesting.expectOne(`${URL}/a1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('activates an article', () => {
    service.activate('a1').subscribe();

    const req = httpTesting.expectOne(`${URL}/a1/activate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deactivates an article', () => {
    service.deactivate('a1').subscribe();

    const req = httpTesting.expectOne(`${URL}/a1/deactivate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deletes an article', () => {
    service.delete('a1').subscribe();

    const req = httpTesting.expectOne(`${URL}/a1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
