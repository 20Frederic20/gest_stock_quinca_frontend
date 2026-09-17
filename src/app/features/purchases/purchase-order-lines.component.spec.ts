import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { PurchaseOrder, PurchaseOrderLine } from '../../core/models/purchase-order.model';
import { PurchaseOrderLinesComponent } from './purchase-order-lines.component';

const line = {
  id: 'l1', articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
  unitLabel: 'Sac', quantity: 100, receivedQuantity: 40, remainingToReceive: 60, unitPrice: 4200,
  vatRate: 0.18, netAmount: 420000, vatAmount: 75600, totalAmount: 495600,
} as PurchaseOrderLine;

const updated = { id: 'o1', lines: [{ ...line, quantity: 120 }] } as PurchaseOrder;

describe('PurchaseOrderLinesComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(editable = true) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(PurchaseOrderLinesComponent);
    fixture.componentRef.setInput('orderId', 'o1');
    fixture.componentRef.setInput('lines', [line]);
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const changed = vi.fn();
    const failed = vi.fn();
    component.changed.subscribe(changed);
    component.failed.subscribe(failed);

    return { component, element: fixture.nativeElement as HTMLElement, changed, failed };
  }

  afterEach(() => httpTesting.verify());

  it('shows each line with its purchase price and what is still awaited', () => {
    const { element } = setup(false);
    const text = element.querySelector('tbody tr')?.textContent?.replace(/\s+/g, ' ') ?? '';

    expect(text).toContain('CIM-32R Ciment CIM II 32.5R');
    expect(text).toContain('4 200');
    expect(text).toContain('60');
  });

  it('offers no action on an order that is no longer a draft', () => {
    expect(setup(false).element.querySelectorAll('button').length).toBe(0);
  });

  it('saves a new quantity and a new price, keeping the packaging of the line', () => {
    const { component, changed } = setup();
    component.edit(line);
    component.form.setValue({ quantity: 120, unitPrice: 4300 });

    component.save(line);

    const request = httpTesting.expectOne('/api/v1/purchase-orders/o1/lines/l1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ packagingId: 'k1', quantity: 120, unitPrice: 4300 });
    request.flush(updated);

    expect(changed).toHaveBeenCalledWith(updated);
    expect(component.editingId()).toBeNull();
  });

  it('removes a line', () => {
    const { component, changed } = setup();

    component.remove(line);

    const request = httpTesting.expectOne('/api/v1/purchase-orders/o1/lines/l1');
    expect(request.request.method).toBe('DELETE');
    request.flush(updated);

    expect(changed).toHaveBeenCalledWith(updated);
  });

  it('hands the refusal of the backend to the page, keeping the line open', () => {
    const { component, failed } = setup();
    component.edit(line);

    component.save(line);
    httpTesting.expectOne('/api/v1/purchase-orders/o1/lines/l1').flush(
      { status: 400, message: 'Cette commande est confirmée : elle n’est plus modifiable', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(failed).toHaveBeenCalledWith('Cette commande est confirmée : elle n’est plus modifiable');
    expect(component.busy()).toBe(false);
  });
});
