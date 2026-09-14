import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('turns a 400 with fieldErrors into an ApiError', async () => {
    const result = firstValueFrom(http.get('/api/v1/articles'));

    httpTesting.expectOne('/api/v1/articles').flush(
      { status: 400, message: 'Donnees invalides', fieldErrors: { code: 'Le code est obligatoire' } },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(result).rejects.toEqual({
      message: 'Données invalides',
      fieldErrors: { code: 'Le code est obligatoire' },
    });
  });

  it('keeps the backend message for a 404', async () => {
    const result = firstValueFrom(http.get('/api/v1/articles/1'));

    httpTesting.expectOne('/api/v1/articles/1').flush(
      { status: 404, message: 'Article introuvable', fieldErrors: null },
      { status: 404, statusText: 'Not Found' },
    );

    await expect(result).rejects.toEqual({ message: 'Article introuvable', fieldErrors: {} });
  });

  it('gives a clear message when the server is unreachable', async () => {
    const result = firstValueFrom(http.get('/api/v1/articles'));

    httpTesting.expectOne('/api/v1/articles').error(new ProgressEvent('error'), { status: 0 });

    await expect(result).rejects.toEqual({
      message: "Le serveur est injoignable. Vérifiez qu'il est démarré.",
      fieldErrors: {},
    });
  });

  it('gives a generic message with the status code when the body is unusable', async () => {
    const result = firstValueFrom(http.get('/api/v1/articles'));

    httpTesting.expectOne('/api/v1/articles').flush(null, { status: 500, statusText: 'Server Error' });

    await expect(result).rejects.toEqual({
      message: 'Une erreur est survenue (code 500).',
      fieldErrors: {},
    });
  });
});
