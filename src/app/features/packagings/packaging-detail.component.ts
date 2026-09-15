import { Component, input, output } from '@angular/core';
import { Packaging } from '../../core/models/packaging.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { formatDate, formatNumber } from '../articles/article-format';

/** Read-only sheet of a packaging, with its actions. The list decides what each action does. */
@Component({
  selector: 'app-packaging-detail',
  imports: [BadgeComponent],
  templateUrl: './packaging-detail.component.html',
  styleUrl: './packaging-detail.component.css',
})
export class PackagingDetailComponent {
  packaging = input.required<Packaging>();
  /** Unit the quantity is expressed in, e.g. "KG". */
  stockUnitCode = input('');
  /** false = read-only user: the sheet shows no action. */
  canEdit = input(true);

  edit = output<void>();
  setDefaultPurchase = output<void>();
  setDefaultSale = output<void>();
  delete = output<void>();

  protected formatDate = formatDate;
  protected formatNumber = formatNumber;
}
