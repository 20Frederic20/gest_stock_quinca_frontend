import { Component, input, output } from '@angular/core';

/** Centered confirmation box, reserved for destructive actions such as deletion. */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class ConfirmDialogComponent {
  open = input(false);
  heading = input('Confirmer la suppression');
  message = input('Cette action est irréversible.');
  confirmLabel = input('Supprimer');

  confirmed = output<void>();
  cancelled = output<void>();

  onEscape(): void {
    if (this.open()) this.cancelled.emit();
  }
}
