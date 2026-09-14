import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchBarComponent } from './search-bar.component';

@Component({
  imports: [SearchBarComponent],
  template: `<app-search-bar><select class="filter"></select></app-search-bar>`,
})
class HostComponent {}

describe('SearchBarComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const fixture = TestBed.createComponent(SearchBarComponent);
    fixture.componentRef.setInput('placeholder', 'Code ou désignation');
    fixture.detectChanges();

    const termChange = vi.fn();
    fixture.componentInstance.termChange.subscribe(termChange);

    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    const type = (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
    };

    return { input, type, termChange };
  }

  it('shows the placeholder', () => {
    const { input } = setup();

    expect(input.placeholder).toBe('Code ou désignation');
  });

  it('emits only once typing has paused for 300 ms', () => {
    const { type, termChange } = setup();

    type('c');
    type('ci');
    type('cim');
    vi.advanceTimersByTime(299);
    expect(termChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(termChange.mock.calls).toEqual([['cim']]);
  });

  it('ignores surrounding spaces and does not emit the same term twice', () => {
    const { type, termChange } = setup();

    type('cim');
    vi.advanceTimersByTime(300);
    type('cim  ');
    vi.advanceTimersByTime(300);

    expect(termChange.mock.calls).toEqual([['cim']]);
  });

  it('emits an empty term when the field is cleared', () => {
    const { type, termChange } = setup();

    type('cim');
    vi.advanceTimersByTime(300);
    type('');
    vi.advanceTimersByTime(300);

    expect(termChange.mock.calls).toEqual([['cim'], ['']]);
  });

  it('displays the projected filters next to the field', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-search-bar .filter')).not.toBeNull();
  });
});
