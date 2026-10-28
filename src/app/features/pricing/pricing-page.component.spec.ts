import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../core/auth/auth.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { PricingPageComponent } from './pricing-page.component';

describe('PricingPageComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).setUser({
      id: 'u1', name: 'Awa Dossou', username: 'awa.dossou', role: 'MANAGER', agencyId: 'g1',
      agencyLabel: 'Cotonou — Siège',
    });

    const fixture = TestBed.createComponent(PricingPageComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const refresh = () => fixture.detectChanges();
    const tabs = () => [...element.querySelectorAll('.tabs button')].map(b => b.textContent?.trim());
    const click = (label: string) =>
      [...element.querySelectorAll<HTMLButtonElement>('.tabs button')]
        .find(b => b.textContent?.trim() === label)
        ?.click();

    return { component: fixture.componentInstance, element, refresh, tabs, click };
  }

  afterEach(() => httpTesting.verify());

  it('opens on the price grids, the prices waiting behind their tab', () => {
    const { element, tabs } = setup();
    // The grids load themselves; the prices ask for nothing until their tab is opened.
    httpTesting.expectOne('/api/v1/privileges').flush([]);

    expect(tabs()).toEqual(['Grilles tarifaires', 'Prix des articles']);
    expect(element.querySelector('app-privilege-list')).not.toBeNull();
    expect(element.querySelector('app-price-list')).toBeNull();
  });

  it('shows the prices once their tab is chosen, and puts the grids away', () => {
    const { element, refresh, click } = setup();
    httpTesting.expectOne('/api/v1/privileges').flush([]);

    click('Prix des articles');
    refresh();

    expect(element.querySelector('app-price-list')).not.toBeNull();
    expect(element.querySelector('app-privilege-list')).toBeNull();
    // The price section loads the grids it needs to name them.
    httpTesting.match('/api/v1/privileges').forEach(request => request.flush([]));
  });
});
