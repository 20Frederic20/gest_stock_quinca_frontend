import { Component, input, output } from '@angular/core';
import { Supplier } from '../../core/models/supplier.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { formatDate } from '../articles/article-format';

/** Read-only sheet of a supplier, with its actions. The list decides what each action does. */
@Component({
  selector: 'app-supplier-detail',
  imports: [BadgeComponent],
  templateUrl: './supplier-detail.component.html',
  styleUrl: './supplier-detail.component.css',
})
export class SupplierDetailComponent {
  supplier = input.required<Supplier>();
  /** Edit and activate/deactivate. */
  canEdit = input(true);
  canDelete = input(true);

  edit = output<void>();
  toggleActive = output<void>();
  delete = output<void>();

  protected formatDate = formatDate;
}
