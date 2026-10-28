import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../../core/auth/auth.service';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: HomeComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
  });

  function root(): HTMLElement | null {
    return harness.routeNativeElement;
  }

  it('shows the brand and the hero title', () => {
    expect(root()?.querySelector('.brand .name')?.textContent?.trim()).toBe('TRINITY JJP');
    expect(root()?.querySelector('.hero h1')?.textContent?.trim())
      .toBe('Votre partenaire de confiance pour bâtir solide');
  });

  it('is shown without waiting for the session check', () => {
    // No request has been answered: the page is there anyway, with the visitor's link.
    expect(root()?.querySelector('.hero h1')).not.toBeNull();
    expect(root()?.querySelector('.utility-actions a')?.textContent?.trim()).toBe('Se connecter');
  });

  it('links to the login page to enter the management app', () => {
    const links = Array.from(root()?.querySelectorAll('a[href="/login"]') ?? []);

    expect(links.length).toBeGreaterThan(0);
  });

  it('stays open to a logged-in user, who gets a way into the application', async () => {
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'MANAGER',
      agencyId: 'g1', agencyLabel: 'Cotonou — Siège',
    });
    await harness.navigateByUrl('/');
    harness.detectChanges();

    const entry = root()?.querySelector<HTMLAnchorElement>('.utility-actions a');
    expect(entry?.textContent?.trim()).toBe('Mon espace');
    expect(entry?.getAttribute('href')).toBe('/dashboard');
    expect(root()?.querySelector('.hero h1')).not.toBeNull();
  });

  it('lists the five product categories', () => {
    expect(root()?.querySelectorAll('.cat-tile').length).toBe(5);
  });
});
