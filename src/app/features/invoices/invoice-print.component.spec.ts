import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { InvoicePrintComponent } from './invoice-print.component';

describe('InvoicePrintComponent', () => {
  let httpTesting: HttpTestingController;
  let createObjectUrl: ReturnType<typeof vi.spyOn>;
  let revokeObjectUrl: ReturnType<typeof vi.spyOn>;

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(InvoicePrintComponent);
    fixture.componentRef.setInput('id', 'i1');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const flushPdf = (headers: Record<string, string> = { 'Content-Disposition': "inline; filename*=UTF-8''FAC-COT-2026-00001.pdf" }) => {
      const pdf = new Blob(['%PDF-1.4 …'], { type: 'application/pdf' });
      httpTesting.expectOne('/api/v1/invoices/i1/pdf').flush(pdf, { headers });
      fixture.detectChanges();
    };

    return { component: fixture.componentInstance, element, fixture, flushPdf };
  }

  beforeEach(() => {
    createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    httpTesting.verify();
    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
  });

  it('shows a loading message while the PDF is generated', () => {
    const { element } = setup();

    expect(element.textContent).toContain('Génération du PDF');
  });

  it('shows the real backend PDF in an embedded viewer once it arrives', () => {
    const { element, flushPdf } = setup();

    flushPdf();

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    const frame = element.querySelector('iframe.pdf-frame');
    expect(frame?.getAttribute('src')).toBe('blob:mock-url');
  });

  it('shows the error when the PDF cannot be generated', () => {
    const { component } = setup();

    httpTesting.expectOne('/api/v1/invoices/i1/pdf').flush(
      new Blob([JSON.stringify({ message: 'Document introuvable', fieldErrors: null })], { type: 'application/json' }),
      { status: 404, statusText: 'Not Found' },
    );

    expect(component.error()).toBe('Document introuvable');
    expect(component.pdfUrl()).toBeNull();
  });

  it('names the download after the file the backend suggested', () => {
    const { component, flushPdf } = setup();
    flushPdf();

    const link = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(link);

    component.download();

    expect(link.href).toBe('blob:mock-url');
    expect(link.download).toBe('FAC-COT-2026-00001.pdf');
    expect(link.click).toHaveBeenCalledTimes(1);
    createElement.mockRestore();
  });

  it('revokes the blob URL once a new document is loaded, so nothing piles up unused', () => {
    const { fixture, flushPdf } = setup();
    flushPdf();

    fixture.componentRef.setInput('id', 'i2');
    fixture.detectChanges();
    httpTesting.expectOne('/api/v1/invoices/i2/pdf').flush(new Blob(['%PDF'], { type: 'application/pdf' }));

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:mock-url');
  });
});
