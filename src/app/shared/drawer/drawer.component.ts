import { Component, input, output } from '@angular/core';

/** Right-side panel used for details and forms. Its content is projected. */
@Component({
  selector: 'app-drawer',
  templateUrl: './drawer.component.html',
  styleUrl: './drawer.component.css',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class DrawerComponent {
  open = input(false);
  heading = input('');
  closed = output<void>();

  onEscape(): void {
    if (this.open()) this.closed.emit();
  }
}
