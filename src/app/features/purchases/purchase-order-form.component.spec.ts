import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { PurchaseOrder } from '../../core/models/purchase-order.model';
import { Supplier } from '../../core/models/supplier.model';
import { PurchaseOrderFormComponent } from './purchase-order-form.component';

const cements = { id: 'f1', code: 'FOU-001', companyName: 'Ciments du Bénin', active: true } as Supplier;
const created = { id: 'o1', number: 'CDE-COT-2026-00001' } as PurchaseOrder;

describe('PurchaseOrderFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PurchaseOrderFormComponent);
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/suppliers/active').flush([cements]);
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { component: fixture.componentInstance, saved };
  }

  afterEach(() => httpTesting.verify());

  it('offers the suppliers still in use', () => {
    const { component } = setup();

    expect(component.supplierOptions()).toEqual([{ id: 'f1', label: 'FOU-001 — Ciments du Bénin' }]);
  });

  it('creates nothing without a supplier', () => {
    const { component } = setup();

    component.submit();

    httpTesting.expectNone('/api/v1/purchase-orders');
    expect(component.form.controls.supplierId.touched).toBe(true);
  });

  it('refuses a delivery date already past, without asking the backend', () => {
    const { component } = setup();
    component.onSupplierSelected({ id: 'f1', label: 'FOU-001 — Ciments du Bénin' });
    component.form.controls.expectedDeliveryDate.setValue('2020-01-01');

    component.submit();

    httpTesting.expectNone('/api/v1/purchase-orders');
    expect(component.form.controls.expectedDeliveryDate.hasError('past')).toBe(true);
  });

  it('creates the order and hands it back', () => {
    const { component, saved } = setup();
    component.onSupplierSelected({ id: 'f1', label: 'FOU-001 — Ciments du Bénin' });
    component.form.controls.comment.setValue('  Réassort ciment  ');

    component.submit();

    const request = httpTesting.expectOne('/api/v1/purchase-orders');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      supplierId: 'f1', expectedDeliveryDate: null, comment: 'Réassort ciment', lines: [],
    });
    request.flush(created);

    expect(saved).toHaveBeenCalledWith(created);
  });

  it('shows the refusal of the backend', () => {
    const { component, saved } = setup();
    component.onSupplierSelected({ id: 'f1', label: 'FOU-001 — Ciments du Bénin' });

    component.submit();
    httpTesting.expectOne('/api/v1/purchase-orders').flush(
      { status: 400, message: 'Le fournisseur « Ciments du Bénin » est désactivé', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('désactivé');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
