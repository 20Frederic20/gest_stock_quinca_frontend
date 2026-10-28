import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { PurchaseOrderLine } from '../../core/models/purchase-order.model';
import { Reception } from '../../core/models/reception.model';
import { ReceptionFormComponent } from './reception-form.component';

const CREATE = '/api/v1/purchase-orders/o1/receptions';
const ATTACH_INVOICE = '/api/v1/receptions/r1/supplier-invoice';
const CONFIRM = '/api/v1/receptions/r1/confirmation';

const cement = {
  id: 'l1', articleId: 'a1', articleCode: 'CIM-32R', designation: 'Ciment CIM II 32.5R', packagingId: 'k1',
  unitLabel: 'Sac', quantity: 100, receivedQuantity: 40, remainingToReceive: 60, unitPrice: 4200,
} as PurchaseOrderLine;

const iron = {
  ...cement, id: 'l2', articleId: 'a2', designation: 'Fer à béton 12 mm', unitLabel: 'Barre',
  quantity: 25, receivedQuantity: 25, remainingToReceive: 0,
} as PurchaseOrderLine;

const draft = { id: 'r1', number: 'REC-COT-2026-00001', status: 'DRAFT' } as Reception;
const invoiced = { ...draft, supplierInvoiceNumber: 'FA-2026-00874', supplierInvoiceFileName: 'facture.pdf' } as Reception;
const confirmed = { ...invoiced, status: 'CONFIRMED' } as Reception;

describe('ReceptionFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup(lines: PurchaseOrderLine[] = [cement, iron]) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(ReceptionFormComponent);
    fixture.componentRef.setInput('orderId', 'o1');
    fixture.componentRef.setInput('orderNumber', 'CDE-COT-2026-00001');
    fixture.componentRef.setInput('lines', lines);
    fixture.detectChanges();

    const received = vi.fn();
    const failed = vi.fn();
    fixture.componentInstance.received.subscribe(received);
    fixture.componentInstance.failed.subscribe(failed);

    return { component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, received, failed };
  }

  /** The file input is a plain DOM element, not part of the reactive form: simulated like a user pick. */
  function selectFile(component: ReceptionFormComponent, name = 'facture.pdf'): void {
    const file = new File(['contenu'], name, { type: 'application/pdf' });
    const input = { files: [file] } as unknown as HTMLInputElement;
    component.onFileSelected({ target: input } as unknown as Event);
  }

  afterEach(() => httpTesting.verify());

  it('offers the lines still waiting, filled with what is left to receive', () => {
    const { component, element } = setup();

    expect(component.pending().map(line => line.id)).toEqual(['l1']);
    expect(component.quantities.getRawValue()).toEqual({ l1: 60 });
    expect(element.textContent).toContain('Ciment CIM II 32.5R');
    expect(element.textContent).not.toContain('Fer à béton 12 mm');
  });

  it('refuses to receive more than what is left on a line', () => {
    const { component, received } = setup();
    component.quantities.controls['l1'].setValue(61);

    component.submit();

    httpTesting.expectNone(CREATE);
    expect(component.quantities.controls['l1'].hasError('max')).toBe(true);
    expect(received).not.toHaveBeenCalled();
  });

  it('requires a supplier invoice number before asking the backend', () => {
    const { component } = setup();
    selectFile(component);

    component.submit();

    httpTesting.expectNone(CREATE);
    expect(component.form.controls.invoiceNumber.hasError('required')).toBe(true);
  });

  it('requires the supplier invoice file before asking the backend', () => {
    const { component } = setup();
    component.form.controls.invoiceNumber.setValue('FA-2026-00874');

    component.submit();

    httpTesting.expectNone(CREATE);
    expect(component.fileError()).toContain('facture fournisseur');
  });

  it('refuses an empty reception without asking the backend', () => {
    const { component } = setup();
    component.quantities.controls['l1'].setValue(0);
    component.form.controls.invoiceNumber.setValue('FA-2026-00874');
    selectFile(component);

    component.submit();

    httpTesting.expectNone(CREATE);
    expect(component.formError()).toContain('au moins une quantité');
  });

  it('writes the reception, attaches the supplier invoice, then confirms it — three steps, one gesture', () => {
    const { component, received } = setup();
    component.quantities.controls['l1'].setValue(25);
    component.form.controls.comment.setValue('  Camion du matin  ');
    component.form.controls.invoiceNumber.setValue('FA-2026-00874');
    selectFile(component);

    component.submit();

    const create = httpTesting.expectOne(CREATE);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      comment: 'Camion du matin',
      lines: [{ purchaseOrderLineId: 'l1', quantity: 25 }],
    });
    create.flush(draft);

    // The supplier invoice (number + file) is attached right after, as a multipart request.
    const attach = httpTesting.expectOne(ATTACH_INVOICE);
    expect(attach.request.method).toBe('PUT');
    const body = attach.request.body as FormData;
    expect(body.get('invoiceNumber')).toBe('FA-2026-00874');
    expect((body.get('file') as File).name).toBe('facture.pdf');
    attach.flush(invoiced);

    // Only the confirmation moves the stock: it follows straight away.
    const confirmation = httpTesting.expectOne(CONFIRM);
    expect(confirmation.request.method).toBe('POST');
    confirmation.flush(confirmed);

    expect(received).toHaveBeenCalledWith(confirmed);
    expect(component.saving()).toBe(false);
  });

  it('says the draft exists when attaching the supplier invoice is refused', () => {
    const { component, received, failed } = setup();
    component.form.controls.invoiceNumber.setValue('FA-2026-00874');
    selectFile(component);

    component.submit();
    httpTesting.expectOne(CREATE).flush(draft);
    httpTesting.expectOne(ATTACH_INVOICE).flush(
      { status: 400, message: 'Type de fichier non autorisé', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('REC-COT-2026-00001');
    expect(component.formError()).toContain('Type de fichier non autorisé');
    expect(received).not.toHaveBeenCalled();
    // The section is told all the same: the draft must appear in its list.
    expect(failed).toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('says the draft exists when the confirmation is refused', () => {
    const { component, received, failed } = setup();
    component.form.controls.invoiceNumber.setValue('FA-2026-00874');
    selectFile(component);

    component.submit();
    httpTesting.expectOne(CREATE).flush(draft);
    httpTesting.expectOne(ATTACH_INVOICE).flush(invoiced);
    httpTesting.expectOne(CONFIRM).flush(
      { status: 400, message: 'Cette commande n’est plus en attente de réception', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('REC-COT-2026-00001');
    expect(component.formError()).toContain('plus en attente');
    expect(received).not.toHaveBeenCalled();
    // The section is told all the same: the draft must appear in its list.
    expect(failed).toHaveBeenCalled();
    expect(component.saving()).toBe(false);
  });

  it('shows the refusal of the creation and keeps what was typed', () => {
    const { component } = setup();
    component.form.controls.invoiceNumber.setValue('FA-2026-00874');
    selectFile(component);

    component.submit();
    httpTesting.expectOne(CREATE).flush(
      { status: 400, message: 'Cette commande n’est pas en attente de réception', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('pas en attente');
    expect(component.quantities.getRawValue()).toEqual({ l1: 60 });
  });
});
