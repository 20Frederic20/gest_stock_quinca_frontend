import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ComingSoonComponent } from './coming-soon.component';

describe('ComingSoonComponent', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'invoices', component: ComingSoonComponent, data: { title: 'Factures' } },
          { path: 'customers', component: ComingSoonComponent, data: { title: 'Clients et créances' } },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  function heading(): string {
    return harness.routeNativeElement?.querySelector('h1')?.textContent?.trim() ?? '';
  }

  it('shows the title given by the route', async () => {
    await harness.navigateByUrl('/invoices');

    expect(heading()).toBe('Factures');
  });

  it('updates the title when navigating to another coming-soon screen', async () => {
    await harness.navigateByUrl('/invoices');
    await harness.navigateByUrl('/customers');

    expect(heading()).toBe('Clients et créances');
  });
});
