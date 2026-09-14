import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CurrentAgencyService } from '../../core/agency/current-agency.service';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { Agency } from '../../core/models/agency.model';
import { HeaderComponent } from './header.component';

const URL = '/api/v1/agencies/active';
const at = '2026-09-14T19:00:00';

const headOffice: Agency = {
  id: 'g1', code: 'COT-SIEGE', label: 'Cotonou — Siège', address: null, phone: null, taxId: null,
  active: true, createdAt: at, updatedAt: at,
};
const parakou: Agency = { ...headOffice, id: 'g2', code: 'PKO', label: 'Parakou' };

describe('HeaderComponent', () => {
  let httpTesting: HttpTestingController;

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = () => element.querySelector('.agency .trigger')?.textContent?.trim();

    return { fixture, component: fixture.componentInstance, element, trigger };
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => httpTesting.verify());

  it('loads the active agencies and shows the current one', async () => {
    const { fixture, trigger } = setup();

    httpTesting.expectOne(URL).flush([headOffice, parakou]);
    await fixture.whenStable();

    expect(trigger()).toContain('Cotonou — Siège');
  });

  it('offers every active agency and switches to the chosen one', async () => {
    const { fixture, component, trigger } = setup();
    httpTesting.expectOne(URL).flush([headOffice, parakou]);
    await fixture.whenStable();

    expect(component.agencyOptions()).toEqual([
      { id: 'g1', label: 'Cotonou — Siège' },
      { id: 'g2', label: 'Parakou' },
    ]);

    component.onAgencySelected({ id: 'g2', label: 'Parakou' });
    await fixture.whenStable();

    expect(TestBed.inject(CurrentAgencyService).current()).toEqual(parakou);
    expect(trigger()).toContain('Parakou');
  });

  it('says so when no agency is active', async () => {
    const { fixture, trigger } = setup();

    httpTesting.expectOne(URL).flush([]);
    await fixture.whenStable();

    expect(trigger()).toContain('Aucune agence');
  });
});
