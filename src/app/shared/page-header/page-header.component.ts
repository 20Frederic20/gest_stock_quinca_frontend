import { Component, input, output } from '@angular/core';

/** Screen title, optional subtitle and main action button. */
@Component({
  selector: 'app-page-header',
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
})
export class PageHeaderComponent {
  heading = input.required<string>();
  subtitle = input('');
  /** No button is shown when empty. */
  actionLabel = input('');

  action = output<void>();
}
