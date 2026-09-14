import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../core/http/api-error.model';
import { UnitOfMeasure } from '../../core/models/unit-of-measure.model';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { UnitOfMeasureFormComponent } from './unit-of-measure-form.component';
import { UnitsOfMeasureService } from './units-of-measure.service';

@Component({
  selector: 'app-unit-of-measure-list',
  imports: [
    PageHeaderComponent,
    StateViewComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    UnitOfMeasureFormComponent,
  ],
  templateUrl: './unit-of-measure-list.component.html',
  styleUrl: './unit-of-measure-list.component.css',
})
export class UnitOfMeasureListComponent implements OnInit {
  private service = inject(UnitsOfMeasureService);

  units = signal<UnitOfMeasure[]>([]);
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (e.g. deletion refused): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);

  drawerOpen = signal(false);
  /** null while creating a new unit. */
  selectedUnit = signal<UnitOfMeasure | null>(null);

  /** The confirmation box is open while this is not null. */
  unitToDelete = signal<UnitOfMeasure | null>(null);
  deleteMessage = computed(
    () => `L’unité « ${this.unitToDelete()?.label ?? ''} » sera définitivement supprimée.`,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getAll().subscribe({
      next: units => {
        this.units.set(units);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.selectedUnit.set(null);
    this.drawerOpen.set(true);
  }

  /** No detail view: the table already shows every field, so the form opens directly. */
  openEdit(unit: UnitOfMeasure): void {
    this.selectedUnit.set(unit);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedUnit.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.load();
  }

  askDelete(unit: UnitOfMeasure, event: Event): void {
    // Otherwise the click also reaches the row and opens the form.
    event.stopPropagation();
    this.unitToDelete.set(unit);
  }

  cancelDelete(): void {
    this.unitToDelete.set(null);
  }

  confirmDelete(): void {
    const unit = this.unitToDelete();
    if (!unit) return;

    this.unitToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(unit.id).subscribe({
      next: () => {
        if (this.selectedUnit()?.id === unit.id) this.closeDrawer();
        this.load();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
