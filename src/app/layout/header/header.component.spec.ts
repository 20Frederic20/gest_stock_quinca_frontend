import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    auth.setUser({
      id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'MANAGER',
      agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    return { fixture, auth, navigate, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => httpTesting.verify());

  it('shows who is logged in, their role and their agency', () => {
    const { element } = setup();

    expect(element.querySelector('.context')?.textContent).toContain('Awa Dossou');
    expect(element.querySelector('.context')?.textContent).toContain('Responsable d’agence');
    expect(element.querySelector('.agency')?.textContent).toContain('Cotonou — Siège');
  });

  it('logs out and returns to the login page', async () => {
    const { fixture, auth, navigate, element } = setup();

    element.querySelector<HTMLButtonElement>('button.logout')!.click();
    httpTesting.expectOne('/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
