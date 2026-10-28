import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FamiliesService } from './families.service';

describe('FamiliesService', () => {
  let service: FamiliesService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FamiliesService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('gets all families', () => {
    service.getAll().subscribe();

    const req = httpTesting.expectOne('/api/v1/families');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets one family by id', () => {
    service.getById('f1').subscribe();

    const req = httpTesting.expectOne('/api/v1/families/f1');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates a family', () => {
    const body = { label: 'Plomberie', displayOrder: 31, parentId: 'f1' };
    service.create(body).subscribe();

    const req = httpTesting.expectOne('/api/v1/families');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('updates a family', () => {
    const body = { label: 'Plomberie', displayOrder: 31, parentId: null };
    service.update('f1', body).subscribe();

    const req = httpTesting.expectOne('/api/v1/families/f1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('deletes a family', () => {
    service.delete('f1').subscribe();

    const req = httpTesting.expectOne('/api/v1/families/f1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
