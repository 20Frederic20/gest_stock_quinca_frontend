import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Article } from '../../core/models/article.model';
import { PageResponse } from '../../core/models/page.model';
import { ArticleListComponent } from './article-list.component';

const URL = '/api/v1/articles';
const at = '2026-09-13T11:32:32.423855';

const cement: Article = {
  id: 'a1', code: 'CIM-32R', barcode: null, designation: 'Ciment CIM II 32.5R',
  alertThreshold: 2000, vatRate: 0.18, active: true,
  familyId: 'f2', familyLabel: 'Ciment et liants', stockUnitId: 'u1', stockUnitCode: 'KG',
  createdAt: at, updatedAt: at,
};
const rebar: Article = { ...cement, id: 'a2', code: 'FER-8', designation: 'Fer à béton Ø8 mm', familyId: 'f3' };

function page(content: Article[], number = 0, totalPages = 1, totalElements = content.length): PageResponse<Article> {
  return { content, number, totalPages, totalElements, size: 20 };
}

describe('ArticleListComponent', () => {
  let httpTesting: HttpTestingController;

  /** The list request, whatever the endpoint: the reference lists are answered separately. */
  const listRequest = (): TestRequest =>
    httpTesting.expectOne(r => r.url.startsWith(URL), 'article list request');

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(ArticleListComponent);
    fixture.detectChanges();

    // Reference lists for the selects, loaded once.
    httpTesting.expectOne('/api/v1/families').flush([]);
    httpTesting.expectOne('/api/v1/units-of-measure').flush([]);

    return fixture.componentInstance;
  }

  afterEach(() => httpTesting.verify());

  it('loads the first page when the screen opens', () => {
    const component = setup();
    expect(component.loading()).toBe(true);

    const req = listRequest();
    expect(req.request.url).toBe(URL);
    expect(req.request.params.get('page')).toBe('0');
    req.flush(page([cement, rebar], 0, 3, 45));

    expect(component.articles()).toEqual([cement, rebar]);
    expect(component.pageInfo()).toEqual({ page: 0, totalPages: 3, totalElements: 45 });
    expect(component.loading()).toBe(false);
  });

  it('loads the requested page', () => {
    const component = setup();
    listRequest().flush(page([cement], 0, 3));

    component.load(2);

    const req = listRequest();
    expect(req.request.params.get('page')).toBe('2');
  });

  it('searches from the first page when a term is typed', () => {
    const component = setup();
    listRequest().flush(page([cement], 0, 3));

    component.onSearch('cim');

    const req = listRequest();
    expect(req.request.url).toBe(`${URL}/search`);
    expect(req.request.params.get('term')).toBe('cim');
    expect(req.request.params.get('page')).toBe('0');
  });

  it('filters by family from the first page, and lists everything again when cleared', () => {
    const component = setup();
    listRequest().flush(page([cement, rebar]));

    component.onFamilyFilter({ id: 'f3', label: 'Fer à béton' });
    const filtered = listRequest();
    expect(filtered.request.url).toBe(`${URL}/by-family/f3`);
    expect(filtered.request.params.get('page')).toBe('0');
    filtered.flush(page([rebar]));

    component.onFamilyFilter(null);
    expect(listRequest().request.url).toBe(URL);
  });

  it('gives the search precedence over the family filter, which the backend cannot combine', () => {
    const component = setup();
    listRequest().flush(page([cement]));
    component.onFamilyFilter({ id: 'f3', label: 'Fer à béton' });
    listRequest().flush(page([rebar]));

    component.onSearch('cim');

    expect(listRequest().request.url).toBe(`${URL}/search`);
    expect(component.searchIgnoresFamily()).toBe(true);
  });

  it('ignores the answer of an outdated request', () => {
    const component = setup();
    const first = listRequest();

    component.onSearch('fer');
    const second = httpTesting.expectOne(r => r.url === `${URL}/search`);

    expect(first.cancelled).toBe(true);
    second.flush(page([rebar]));
    expect(component.articles()).toEqual([rebar]);
  });

  it('shows the error message when loading fails', () => {
    const component = setup();

    listRequest().flush(
      { status: 500, message: 'Erreur interne', fieldErrors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(component.error()).toBe('Erreur interne');
    expect(component.loading()).toBe(false);
  });

  it('opens the detail on a row, then switches to the form', () => {
    const component = setup();
    listRequest().flush(page([cement, rebar]));

    component.openDetail(rebar);
    expect(component.drawerOpen()).toBe(true);
    expect(component.drawerMode()).toBe('detail');
    expect(component.selectedArticle()).toBe(rebar);

    component.openEdit();
    expect(component.drawerMode()).toBe('form');
    expect(component.selectedArticle()).toBe(rebar);
  });

  it('opens an empty form to create an article', () => {
    const component = setup();
    listRequest().flush(page([cement]));

    component.openCreate();

    expect(component.drawerMode()).toBe('form');
    expect(component.selectedArticle()).toBeNull();
  });

  it('closes the drawer and reloads the current page after saving', () => {
    const component = setup();
    listRequest().flush(page([cement], 1, 3));
    component.openCreate();

    component.onSaved();

    expect(component.drawerOpen()).toBe(false);
    expect(listRequest().request.params.get('page')).toBe('1');
  });

  it('deactivates the article and updates both the detail and the row', () => {
    const component = setup();
    listRequest().flush(page([cement, rebar]));
    component.openDetail(cement);

    component.toggleActive();

    const req = httpTesting.expectOne(`${URL}/a1/deactivate`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...cement, active: false });

    expect(component.selectedArticle()?.active).toBe(false);
    expect(component.articles()[0].active).toBe(false);
  });

  it('activates an inactive article', () => {
    const component = setup();
    const inactive = { ...cement, active: false };
    listRequest().flush(page([inactive]));
    component.openDetail(inactive);

    component.toggleActive();

    httpTesting.expectOne(`${URL}/a1/activate`).flush(cement);
    expect(component.selectedArticle()?.active).toBe(true);
  });

  it('keeps the list visible when the status change fails', () => {
    const component = setup();
    listRequest().flush(page([cement]));
    component.openDetail(cement);

    component.toggleActive();
    httpTesting.expectOne(`${URL}/a1/deactivate`).flush(
      { status: 404, message: 'Article introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.actionError()).toBe('Article introuvable');
    expect(component.error()).toBeNull();
    expect(component.articles()).toEqual([cement]);
  });

  it('deletes only after confirmation, then closes the drawer and reloads', () => {
    const component = setup();
    listRequest().flush(page([cement, rebar]));
    component.openDetail(cement);

    component.askDelete();
    httpTesting.expectNone(`${URL}/a1`);
    expect(component.articleToDelete()).toBe(cement);

    component.confirmDelete();
    const req = httpTesting.expectOne(`${URL}/a1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    expect(component.drawerOpen()).toBe(false);
    expect(component.articleToDelete()).toBeNull();
    listRequest().flush(page([rebar]));
  });

  it('goes back one page when the last article of the last page is deleted', () => {
    const component = setup();
    listRequest().flush(page([cement], 2, 3, 41));
    component.openDetail(cement);

    component.askDelete();
    component.confirmDelete();
    httpTesting.expectOne(`${URL}/a1`).flush(null);

    expect(listRequest().request.params.get('page')).toBe('1');
  });

  it('does nothing when deletion is cancelled', () => {
    const component = setup();
    listRequest().flush(page([cement]));
    component.openDetail(cement);

    component.askDelete();
    component.cancelDelete();

    httpTesting.expectNone(`${URL}/a1`);
    expect(component.articleToDelete()).toBeNull();
    expect(component.drawerOpen()).toBe(true);
  });
});
