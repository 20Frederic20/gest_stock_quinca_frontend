import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';

export interface SelectOption {
  id: string;
  label: string;
}

/** Local filtering: case-insensitive, surrounding spaces ignored. */
export function filterOptions(options: SelectOption[], term: string): SelectOption[] {
  const t = term.trim().toLowerCase();
  if (!t) return options;
  return options.filter(o => o.label.toLowerCase().includes(t));
}

/**
 * Dropdown with a search field.
 * Local mode filters `options` in the browser; remote mode (`remoteSearch` set)
 * queries the backend, debounced by 300 ms.
 */
@Component({
  selector: 'app-select-search',
  templateUrl: './select-search.component.html',
  styleUrl: './select-search.component.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class SelectSearchComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private injector = inject(Injector);

  /** Local mode: every option, filtered in the browser. */
  options = input<SelectOption[]>([]);
  /** Remote mode: queries the backend. Takes precedence over `options`. */
  remoteSearch = input<((term: string) => Observable<SelectOption[]>) | null>(null);

  /** Id of the current choice. */
  value = input<string | null>(null);
  /** Text of the current choice, supplied by the parent so remote mode needs no lookup. */
  label = input('');
  placeholder = input('Choisir…');
  allowEmpty = input(false);

  selected = output<SelectOption | null>();

  isOpen = signal(false);
  term = signal('');
  remoteResults = signal<SelectOption[]>([]);
  loading = signal(false);
  highlighted = signal(-1);

  visible = computed(() =>
    this.remoteSearch() ? this.remoteResults() : filterOptions(this.options(), this.term()),
  );

  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private keystrokes = new Subject<string>();

  constructor() {
    this.keystrokes
      .pipe(
        tap(() => this.loading.set(true)),
        debounceTime(300),
        // switchMap drops the answer of an outdated query.
        switchMap(term =>
          // Caught here so that one failed call does not end the stream.
          this.remoteSearch()!(term).pipe(catchError(() => of<SelectOption[]>([]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(results => {
        this.remoteResults.set(results);
        this.loading.set(false);
      });
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
      return;
    }

    this.isOpen.set(true);
    this.term.set('');
    this.highlighted.set(-1);
    if (this.remoteSearch()) this.keystrokes.next('');

    // The field only exists once the list is rendered.
    afterNextRender(() => this.searchInput()?.nativeElement.focus(), { injector: this.injector });
  }

  onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.term.set(text);
    this.highlighted.set(-1);
    if (this.remoteSearch()) this.keystrokes.next(text);
  }

  select(option: SelectOption | null): void {
    this.selected.emit(option);
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.visible();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlighted.update(i => Math.min(i + 1, list.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlighted.update(i => Math.max(i - 1, 0));
        break;
      case 'Enter': {
        // Inside a form, Enter would otherwise submit it.
        event.preventDefault();
        const option = list[this.highlighted()];
        if (option) this.select(option);
        break;
      }
      case 'Escape':
        // Keeps an enclosing drawer from closing too.
        event.stopPropagation();
        this.close();
        break;
    }
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private close(): void {
    this.isOpen.set(false);
    this.term.set('');
  }
}
