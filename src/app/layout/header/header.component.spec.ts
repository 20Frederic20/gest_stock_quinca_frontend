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

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const trigger = () => element.querySelector<HTMLButtonElement>('button.user')!;
    const menu = () => element.querySelector('.user-menu');

    return { fixture, auth, navigate, element, refresh, trigger, menu };
  }

  afterEach(() => httpTesting.verify());

  it('shows the agency of the day, and who is logged in behind a user button', () => {
    const { element, trigger } = setup();

    expect(element.querySelector('.agency')?.textContent).toContain('Cotonou — Siège');
    // Initials stand in for a picture, and the name is written next to them.
    expect(trigger().textContent).toContain('AD');
    expect(trigger().textContent).toContain('Awa Dossou');
  });

  it('keeps the menu closed until the user asks for it', () => {
    const { menu, trigger, refresh } = setup();

    expect(menu()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');

    trigger().click();
    refresh();

    expect(menu()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('tells the role and the agency inside the menu', () => {
    const { menu, trigger, refresh } = setup();

    trigger().click();
    refresh();

    const text = menu()?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(text).toContain('Awa Dossou');
    expect(text).toContain('Responsable d’agence');
    expect(text).toContain('Cotonou — Siège');
  });

  it('closes the menu on escape', () => {
    const { menu, trigger, refresh } = setup();

    trigger().click();
    refresh();
    expect(menu()).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    refresh();

    expect(menu()).toBeNull();
  });

  it('lets a logged-in user go back to the public site', () => {
    const { element, trigger, refresh } = setup();

    trigger().click();
    refresh();

    const link = element.querySelector<HTMLAnchorElement>('.user-menu a.site-link');
    expect(link?.textContent?.trim()).toBe('Voir le site');
    expect(link?.getAttribute('href')).toBe('/');
  });

  it('logs out from the menu and returns to the login page', async () => {
    const { fixture, auth, navigate, element, trigger, refresh } = setup();

    trigger().click();
    refresh();
    element.querySelector<HTMLButtonElement>('button.logout')!.click();

    httpTesting.expectOne('/api/v1/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
