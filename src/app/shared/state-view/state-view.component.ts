import { Component, input, output } from '@angular/core';

/** Shows the loading, error or empty state of a list. Renders nothing when data is available. */
@Component({
  selector: 'app-state-view',
  templateUrl: './state-view.component.html',
  styleUrl: './state-view.component.css',
})
export class StateViewComponent {
  loading = input(false);
  error = input<string | null>(null);
  empty = input(false);
  emptyMessage = input('Aucun résultat.');

  retry = output<void>();
}
