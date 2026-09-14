import { Component, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';

/** Search field emitting once typing pauses. Filters are projected next to it. */
@Component({
  selector: 'app-search-bar',
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.css',
})
export class SearchBarComponent {
  placeholder = input('Rechercher…');

  /** Trimmed term, 300 ms after the last keystroke. Empty when the field is cleared. */
  termChange = output<string>();

  private keystrokes = new Subject<string>();

  constructor() {
    this.keystrokes
      .pipe(
        map(text => text.trim()),
        debounceTime(300),
        // Adding a trailing space must not reload the list.
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(term => this.termChange.emit(term));
  }

  onInput(event: Event): void {
    this.keystrokes.next((event.target as HTMLInputElement).value);
  }
}
