import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { HeaderComponent } from './header.component';

const at = '2026-09-15T08:00:00';
const cotonou: Agency = { id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null, active: true, createdAt: at, updatedAt: at };
const porto: Agency = { ...cotonou, id: 'g2', code: 'PTN-SIEGE', label: 'Porto-Novo — Siège' };

describe('HeaderComponent', () => {
  let httpTesting: HttpTestingController;

  /** `agencies` defaults to just the user's own: no switch to offer, same as before the navbar switcher existed. */
  function setup(agencies: Agency[] = [cotonou]) {
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
    httpTesting.expectOne('/api/v1/agencies/active').flush(agencies);

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

  it('shows a plain tag, not a switch, when there is only one agency', () => {
    const { element } = setup([cotonou]);

    expect(element.querySelector('.agency-switch')).toBeNull();
    expect(element.querySelector('.agency .tag')?.textContent).toContain('Cotonou — Siège');
  });

  it('offers a switch once there is more than one agency, and it changes what is viewed', () => {
    const { fixture, element } = setup([cotonou, porto]);

    expect(element.querySelector('.agency .tag')).toBeNull();
    expect(element.querySelector('.agency-switch app-select-search')).not.toBeNull();

    const component = fixture.componentInstance;
    expect(component.viewedAgencyId()).toBe('g1');

    component.onAgencySelected({ id: 'g2', label: 'Porto-Novo — Siège' });

    expect(component.viewedAgencyId()).toBe('g2');
    expect(component.viewedAgencyLabel()).toBe('Porto-Novo — Siège');
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
