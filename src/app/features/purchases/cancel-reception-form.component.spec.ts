import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Reception } from '../../core/models/reception.model';
import { CancelReceptionFormComponent } from './cancel-reception-form.component';

const URL = '/api/v1/receptions/r1/cancellation';
const cancelled = { id: 'r1', status: 'CANCELLED', cancellationReason: 'Marchandise refusée' } as Reception;

describe('CancelReceptionFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(CancelReceptionFormComponent);
    fixture.componentRef.setInput('receptionId', 'r1');
    fixture.componentRef.setInput('summary', 'REC-COT-2026-00001 du 16/09/2026');
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, saved };
  }

  afterEach(() => httpTesting.verify());

  it('recalls which reception is being cancelled', () => {
    expect(setup().element.textContent).toContain('REC-COT-2026-00001');
  });

  it('requires a reason of at most 255 characters', () => {
    const { component } = setup();
    const { reason } = component.form.controls;

    expect(reason.hasError('required')).toBe(true);
    reason.setValue('A'.repeat(256));
    expect(reason.hasError('maxlength')).toBe(true);
  });

  it('cancels the reception and hands it back', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('Marchandise refusée');

    component.submit();

    const request = httpTesting.expectOne(URL);
    expect(request.request.body).toEqual({ reason: 'Marchandise refusée' });
    request.flush(cancelled);

    expect(saved).toHaveBeenCalledWith(cancelled);
  });

  it('shows the refusal of the backend', () => {
    const { component, saved } = setup();
    component.form.controls.reason.setValue('Erreur de saisie');

    component.submit();
    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Seule une réception confirmée peut être annulée', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toContain('confirmée peut être annulée');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
