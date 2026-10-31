import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { ExpenseCategoriesComponent } from './expense-categories.component';

describe('ExpenseCategoriesComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('shows the backend message when deleting a used category', () => {
    const fixture = TestBed.createComponent(ExpenseCategoriesComponent);
    fixture.detectChanges();
    httpTesting
      .expectOne(r => r.url === '/api/v1/expense-categories')
      .flush([{ id: 'c1', label: 'Carburant', description: null, active: true }]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.askDelete(component.categories()[0]);
    component.confirmDelete();
    httpTesting
      .expectOne('/api/v1/expense-categories/c1')
      .flush({ message: 'Cette catégorie est utilisée par des charges.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.action-error')?.textContent).toContain(
      'Cette catégorie est utilisée par des charges.',
    );
  });
});
