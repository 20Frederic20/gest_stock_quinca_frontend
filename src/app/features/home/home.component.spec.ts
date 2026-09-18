import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '', component: HomeComponent }])],
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

  it('links to the login page to enter the management app', () => {
    const links = Array.from(root()?.querySelectorAll('a[href="/login"]') ?? []);

    expect(links.length).toBeGreaterThan(0);
  });

  it('lists the five product categories', () => {
    expect(root()?.querySelectorAll('.cat-tile').length).toBe(5);
  });
});
