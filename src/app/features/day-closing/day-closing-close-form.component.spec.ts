import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DayClosing } from '../../core/models/day-closing.model';
import { DayClosingCloseFormComponent } from './day-closing-close-form.component';

describe('DayClosingCloseFormComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [DayClosingCloseFormComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(DayClosingCloseFormComponent);
    fixture.componentRef.setInput('dayClosing', { id: 'd1', startTime: '13:53:00', openingCashAmount: 20000, theoreticalTotal: 52680 } as DayClosing);
    fixture.detectChanges();
    return fixture;
  }

  it('updates the estimated variance as the counted amount is typed', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    expect(component.previewVariance()).toBe(-52680);

    component.form.controls.countedTotal.setValue(52680);
    fixture.detectChanges();
    expect(component.previewVariance()).toBe(0);

    component.form.controls.countedTotal.setValue(52000);
    fixture.detectChanges();
    expect(component.previewVariance()).toBe(-680);
    expect(fixture.nativeElement.textContent).toContain('Écart estimé');
  });
});
