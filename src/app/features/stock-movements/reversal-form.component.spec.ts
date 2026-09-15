import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { ReversalFormComponent } from './reversal-form.component';

const URL = '/api/v1/stock-movements/m1/reversal';

describe('ReversalFormComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(ReversalFormComponent);
    fixture.componentRef.setInput('movementId', 'm1');
    fixture.componentRef.setInput('summary', 'Inventaire du 15/09/2026 08:27 : +8 400 KG');
    fixture.detectChanges();

    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, saved };
  }

  afterEach(() => httpTesting.verify());

  it('recalls which movement is being cancelled', () => {
    const { element } = setup();

    expect(element.textContent).toContain('Inventaire du 15/09/2026 08:27 : +8 400 KG');
  });

  it('requires a reason of at most 255 characters', () => {
    const { component } = setup();
    const { reason } = component.form.controls;

    expect(reason.hasError('required')).toBe(true);

    reason.setValue('   ');
    expect(reason.hasError('blank')).toBe(true);

    reason.setValue('A'.repeat(256));
    expect(reason.hasError('maxlength')).toBe(true);
  });

  it('does not call the backend while the form is invalid', () => {
    const { component, saved } = setup();

    component.submit();

    httpTesting.expectNone(URL);
    expect(component.form.controls.reason.touched).toBe(true);
    expect(saved).not.toHaveBeenCalled();
  });

  it('records the reversal with a trimmed reason, then emits saved', () => {
    const { component, saved } = setup();
    component.form.setValue({ reason: '  Saisie en double ' });

    component.submit();

    const req = httpTesting.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Saisie en double' });
    req.flush({});
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('shows the backend refusal and does not emit saved', () => {
    const { component, saved } = setup();
    component.form.setValue({ reason: 'Erreur de saisie' });

    component.submit();
    httpTesting.expectOne(URL).flush(
      { status: 400, message: 'Ce mouvement a déjà été annulé', fieldErrors: null },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(component.formError()).toBe('Ce mouvement a déjà été annulé');
    expect(component.saving()).toBe(false);
    expect(saved).not.toHaveBeenCalled();
  });
});
