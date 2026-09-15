import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { StockService } from './stock.service';

const emptyPage = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 };

describe('StockService', () => {
  let service: StockService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StockService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets a page of an agency stock, sorted by designation', () => {
    service.getByAgency('g1', 2).subscribe();

    const req = httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/stock');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('sort')).toBe('article.designation,asc');
    req.flush(emptyPage);
  });

  it('gets the lines of an agency below their alert threshold', () => {
    service.getAlerts('g1').subscribe();

    const req = httpTesting.expectOne('/api/v1/agencies/g1/stock/alerts');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets how an article is spread across the agencies', () => {
    service.getByArticle('a1').subscribe();

    const req = httpTesting.expectOne('/api/v1/articles/a1/stock');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets the stock line of one article in one agency', () => {
    service.getOne('g1', 'a1').subscribe();

    const req = httpTesting.expectOne('/api/v1/agencies/g1/stock/a1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('gets the movements of an agency, optionally for one article', () => {
    service.getMovements('g1', { page: 1 }).subscribe();
    const all = httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/stock-movements');
    expect(all.request.params.get('page')).toBe('1');
    expect(all.request.params.has('articleId')).toBe(false);
    all.flush(emptyPage);

    service.getMovements('g1', { articleId: 'a1', page: 0, size: 10 }).subscribe();
    const one = httpTesting.expectOne(r => r.url === '/api/v1/agencies/g1/stock-movements');
    expect(one.request.params.get('articleId')).toBe('a1');
    expect(one.request.params.get('size')).toBe('10');
    one.flush(emptyPage);
  });

  it('records an inventory count', () => {
    const body = { articleId: 'a1', countedQuantity: 132, reason: 'Inventaire de septembre' };
    service.adjust('g1', body).subscribe();

    const req = httpTesting.expectOne('/api/v1/agencies/g1/stock/adjustments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('reverses a movement', () => {
    service.reverse('m1', { reason: 'Saisie en double' }).subscribe();

    const req = httpTesting.expectOne('/api/v1/stock-movements/m1/reversal');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Saisie en double' });
    req.flush({});
  });
});
