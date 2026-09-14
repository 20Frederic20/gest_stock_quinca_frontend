import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SelectOption, SelectSearchComponent, filterOptions } from './select-search.component';

describe('filterOptions', () => {
  const options: SelectOption[] = [
    { id: '1', label: 'Ciments et liants' },
    { id: '2', label: 'Fers et aciers' },
    { id: '3', label: 'Ciment blanc' },
  ];

  it('returns everything when the term is empty', () => {
    expect(filterOptions(options, '')).toEqual(options);
  });

  it('ignores surrounding spaces', () => {
    expect(filterOptions(options, '   ')).toEqual(options);
  });

  it('is case-insensitive', () => {
    expect(filterOptions(options, 'CIM').map(o => o.id)).toEqual(['1', '3']);
  });

  it('matches anywhere in the label', () => {
    expect(filterOptions(options, 'aciers').map(o => o.id)).toEqual(['2']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterOptions(options, 'zzz')).toEqual([]);
  });
});

describe('SelectSearchComponent', () => {
  const options: SelectOption[] = [
    { id: '1', label: 'Mètre' },
    { id: '2', label: 'Kilogramme' },
  ];

  function setup(value: string | null = null) {
    const fixture = TestBed.createComponent(SelectSearchComponent);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('label', value ? 'Mètre' : '');
    fixture.componentRef.setInput('allowEmpty', true);
    fixture.detectChanges();

    const selected = vi.fn();
    fixture.componentInstance.selected.subscribe(selected);

    const element = fixture.nativeElement as HTMLElement;
    const open = () => {
      element.querySelector<HTMLElement>('.trigger')!.click();
      fixture.detectChanges();
    };
    const search = element.querySelector.bind(element, 'input.search') as () => HTMLInputElement;
    const press = (key: string) => {
      search().dispatchEvent(new KeyboardEvent('keydown', { key }));
      fixture.detectChanges();
    };

    return { fixture, element, selected, open, search, press };
  }

  it('shows the placeholder when no value is set', () => {
    const { element } = setup();

    expect(element.querySelector('.trigger')?.textContent).toContain('Choisir…');
  });

  it('shows the label of the current value', () => {
    const { element } = setup('1');

    expect(element.querySelector('.trigger')?.textContent).toContain('Mètre');
  });

  it('filters the list while typing', () => {
    const { element, fixture, open, search } = setup();
    open();

    search().value = 'kilo';
    search().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const labels = [...element.querySelectorAll('.option:not(.empty)')].map(b => b.textContent?.trim());
    expect(labels).toEqual(['Kilogramme']);
  });

  it('emits the clicked option and closes', () => {
    const { element, fixture, selected, open } = setup();
    open();

    element.querySelectorAll<HTMLElement>('.option:not(.empty)')[1].click();
    fixture.detectChanges();

    expect(selected).toHaveBeenCalledWith(options[1]);
    expect(element.querySelector('.list')).toBeNull();
  });

  it('emits null when the empty choice is clicked', () => {
    const { element, selected, open } = setup('1');
    open();

    element.querySelector<HTMLElement>('.option.empty')!.click();

    expect(selected).toHaveBeenCalledWith(null);
  });

  it('selects with the keyboard', () => {
    const { selected, open, press } = setup();
    open();

    press('ArrowDown');
    press('ArrowDown');
    press('Enter');

    expect(selected).toHaveBeenCalledWith(options[1]);
  });

  it('closes on Escape without emitting', () => {
    const { element, selected, open, press } = setup();
    open();

    press('Escape');

    expect(element.querySelector('.list')).toBeNull();
    expect(selected).not.toHaveBeenCalled();
  });

  it('queries the backend once typing pauses, and recovers after an error', () => {
    vi.useFakeTimers();
    try {
      const remote = vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('réseau')))
        .mockReturnValue(of([{ id: '9', label: 'Pointe 70 mm' }]));

      const fixture = TestBed.createComponent(SelectSearchComponent);
      fixture.componentRef.setInput('remoteSearch', remote);
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;

      element.querySelector<HTMLElement>('.trigger')!.click();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();
      expect(remote).toHaveBeenCalledWith('');
      expect(element.querySelector('.info')?.textContent).toContain('Aucun résultat');

      const search = element.querySelector<HTMLInputElement>('input.search')!;
      for (const text of ['p', 'po', 'poi']) {
        search.value = text;
        search.dispatchEvent(new Event('input'));
      }
      vi.advanceTimersByTime(299);
      expect(remote).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(remote).toHaveBeenLastCalledWith('poi');
      expect(remote).toHaveBeenCalledTimes(2);
      expect(element.querySelector('.option')?.textContent?.trim()).toBe('Pointe 70 mm');
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes when clicking outside', () => {
    const { element, fixture, open } = setup();
    open();

    document.body.click();
    fixture.detectChanges();

    expect(element.querySelector('.list')).toBeNull();
  });
});
