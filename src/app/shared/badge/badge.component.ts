import { Component, input } from '@angular/core';

export type BadgeTone = 'neutral' | 'accent' | 'muted';

/** Status pill (Actif, Inactif, Par défaut…). Its styles are the global `.tag` classes. */
@Component({
  selector: 'app-badge',
  templateUrl: './badge.component.html',
})
export class BadgeComponent {
  text = input.required<string>();
  tone = input<BadgeTone>('neutral');
}
