import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../core/auth/auth.service';
import { PERMISSIONS_ENABLED } from '../../core/auth/permissions';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { Expense, ExpenseCategory } from '../../core/models/expense.model';
import { Role } from '../../core/models/user.model';
import { ExpenseListComponent } from './expense-list.component';
import { COMMON_OPTION_ID, ExpenseFormComponent } from './expense-form.component';

const at = '2026-09-16T08:00:00';
const agency = (id: string, label: string): Agency => ({
  id, code: id.toUpperCase(), label, address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at,
});
const category = (id: string, label: string, active = true): ExpenseCategory => ({ id, label, description: null, active });

const expense = (id: string, editable: boolean, agencyId: string | null = 'g1'): Expense => ({
  id, expenseDate: '2026-10-28', categoryId: 'c1', categoryLabel: 'Carburant', agencyId,
  agencyLabel: agencyId ? 'Cotonou' : null, label: 'Gasoil', amount: 45000, note: null,
  createdById: 'u1', createdByName: 'Gérant', createdAt: at, editable,
});
const page = (content: Expense[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 });

describe('ExpenseListComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(role: Role = 'ADMIN') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: true },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa', username: 'awa', role, agencyId: 'g1', agencyLabel: 'Cotonou',
    });

    const fixture = TestBed.createComponent(ExpenseListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([agency('g1', 'Cotonou'), agency('g2', 'Parakou')]);
    httpTesting.expectOne(r => r.url === '/api/v1/expense-categories').flush([category('c1', 'Carburant')]);
    const search = httpTesting.expectOne(r => r.url === '/api/v1/expenses');
    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, search };
  }

  afterEach(() => httpTesting.verify());

  it('fixes the agency filter to the manager agency', () => {
    const { component, element, search, fixture } = setup('MANAGER');
    expect(search.request.params.get('agencyId')).toBe('g1');
    search.flush(page([]));
    fixture.detectChanges();

    expect(component.canChooseAgency()).toBe(false);
    expect(element.querySelectorAll('.toolbar app-select-search').length).toBe(1);
  });

  it('shows edit and delete only on editable rows', () => {
    const { element, search, fixture } = setup('MANAGER');
    search.flush(page([expense('e1', true), expense('e2', false)]));
    fixture.detectChanges();

    const rows = element.querySelectorAll('tbody tr');
    expect(rows[0].querySelectorAll('.row-actions button').length).toBe(2);
    expect(rows[1].querySelectorAll('.row-actions button').length).toBe(0);
  });

  it('shows the Commune badge for a charge without agency', () => {
    const { element, search, fixture } = setup('ADMIN');
    search.flush(page([expense('e1', true, null)]));
    fixture.detectChanges();

    expect(element.querySelector('tbody')?.textContent).toContain('Commune');
  });

  it('shows the backend message when the categories fail to load', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: true },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa', username: 'awa', role: 'ADMIN', agencyId: 'g1', agencyLabel: 'Cotonou',
    });
    const fixture = TestBed.createComponent(ExpenseListComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/agencies/active').flush([]);
    httpTesting
      .expectOne(r => r.url === '/api/v1/expense-categories')
      .flush({ message: 'Catégories indisponibles.' }, { status: 500, statusText: 'Server Error' });
    httpTesting.expectOne(r => r.url === '/api/v1/expenses').flush(page([]));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.action-error')?.textContent).toContain(
      'Catégories indisponibles.',
    );
  });

  it('hides the Catégories tab for a manager', () => {
    const { element, search, fixture } = setup('MANAGER');
    search.flush(page([]));
    fixture.detectChanges();

    expect(element.querySelector('.tabs')).toBeNull();
  });

  it('shows the Catégories tab for the owner', () => {
    const { element, search, fixture } = setup('ADMIN');
    search.flush(page([]));
    fixture.detectChanges();

    expect(element.querySelector('.tabs')?.textContent).toContain('Catégories');
  });
});

describe('ExpenseFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(role: Role) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: true },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa', username: 'awa', role, agencyId: 'g1', agencyLabel: 'Cotonou',
    });
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.componentRef.setInput('agencies', [agency('g1', 'Cotonou'), agency('g2', 'Parakou')]);
    fixture.componentRef.setInput('categories', [category('c1', 'Carburant')]);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  afterEach(() => httpTesting.verify());

  it('hides the "Commune" option for a manager', () => {
    const { component } = setup('MANAGER');

    const ids = component.agencyOptions().map(o => o.id);
    expect(ids).toEqual(['g1']);
    expect(ids).not.toContain(COMMON_OPTION_ID);
    expect(component.form.controls.agencyId.value).toBe('g1');
  });

  it('keeps the deactivated category of the edited charge in the options', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: PERMISSIONS_ENABLED, useValue: true },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa', username: 'awa', role: 'ADMIN', agencyId: 'g1', agencyLabel: 'Cotonou',
    });
    const fixture = TestBed.createComponent(ExpenseFormComponent);
    fixture.componentRef.setInput('agencies', [agency('g1', 'Cotonou')]);
    fixture.componentRef.setInput('categories', [category('c2', 'Autre')]);
    fixture.componentRef.setInput('expense', { ...expense('e1', true), categoryId: 'c1', categoryLabel: 'Loyer' });
    fixture.detectChanges();

    expect(fixture.componentInstance.categoryLabel()).toBe('Loyer (désactivée)');
  });

  it('offers "Commune" to the owner', () => {
    const { component } = setup('ADMIN');
    expect(component.agencyOptions()[0].id).toBe(COMMON_OPTION_ID);
  });

  it('sends agencyId null when the owner picks "Commune"', () => {
    const { component } = setup('ADMIN');
    component.onCategorySelected({ id: 'c1', label: 'Carburant' });
    component.onAgencySelected({ id: COMMON_OPTION_ID, label: 'Commune (sans agence)' });
    component.form.patchValue({ label: 'Loyer', amount: 300000 });

    component.submit();

    const req = httpTesting.expectOne('/api/v1/expenses');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.agencyId).toBeNull();
    expect(req.request.body.categoryId).toBe('c1');
    req.flush({});
  });
});
