import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../core/http/api-error.model';
import { Family } from '../../core/models/family.model';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { FamiliesService } from './families.service';
import { FamilyFormComponent } from './family-form.component';
import { buildFamilyTree } from './family-tree';

@Component({
  selector: 'app-family-list',
  imports: [
    PageHeaderComponent,
    StateViewComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    FamilyFormComponent,
  ],
  templateUrl: './family-list.component.html',
  styleUrl: './family-list.component.css',
})
export class FamilyListComponent implements OnInit {
  private service = inject(FamiliesService);

  families = signal<Family[]>([]);
  rows = computed(() => buildFamilyTree(this.families()));
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (e.g. family with sub-families): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);

  drawerOpen = signal(false);
  /** null while creating a new family. */
  selectedFamily = signal<Family | null>(null);

  /** The confirmation box is open while this is not null. */
  familyToDelete = signal<Family | null>(null);
  deleteMessage = computed(
    () => `La famille « ${this.familyToDelete()?.label ?? ''} » sera définitivement supprimée.`,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getAll().subscribe({
      next: families => {
        this.families.set(families);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.selectedFamily.set(null);
    this.drawerOpen.set(true);
  }

  /** No detail view: the table already shows every field, so the form opens directly. */
  openEdit(family: Family): void {
    this.selectedFamily.set(family);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedFamily.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.load();
  }

  askDelete(family: Family, event: Event): void {
    // Otherwise the click also reaches the row and opens the form.
    event.stopPropagation();
    this.familyToDelete.set(family);
  }

  cancelDelete(): void {
    this.familyToDelete.set(null);
  }

  confirmDelete(): void {
    const family = this.familyToDelete();
    if (!family) return;

    this.familyToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(family.id).subscribe({
      next: () => {
        if (this.selectedFamily()?.id === family.id) this.closeDrawer();
        this.load();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
