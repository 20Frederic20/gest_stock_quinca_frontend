import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { Supplier } from '../../core/models/supplier.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SearchBarComponent } from '../../shared/search-bar/search-bar.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { SupplierDetailComponent } from './supplier-detail.component';
import { SupplierFormComponent } from './supplier-form.component';
import { SuppliersService } from './suppliers.service';

type DrawerMode = 'detail' | 'form';

/** Achats > Fournisseurs. Everybody reads them; only a manager keeps them, only an admin removes one. */
@Component({
  selector: 'app-supplier-list',
  imports: [
    PageHeaderComponent,
    SearchBarComponent,
    StateViewComponent,
    PaginationComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    SupplierDetailComponent,
    SupplierFormComponent,
  ],
  templateUrl: './supplier-list.component.html',
  styleUrl: './supplier-list.component.css',
})
export class SupplierListComponent implements OnInit {
  private service = inject(SuppliersService);
  private auth = inject(AuthService);

  /** Creating and editing go together on the backend: both are for a manager. */
  canEdit = computed(() => this.auth.can('suppliers.write'));
  canDelete = computed(() => this.auth.can('suppliers.delete'));

  suppliers = signal<Supplier[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (status change, deletion…): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);

  term = signal('');
  emptyMessage = computed(() =>
    this.term() ? 'Aucun fournisseur ne correspond à cette recherche.' : 'Aucun fournisseur enregistré.',
  );

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  /** null while creating a new supplier. */
  selectedSupplier = signal<Supplier | null>(null);
  drawerHeading = computed(() => {
    const supplier = this.selectedSupplier();
    if (this.drawerMode() === 'detail') return supplier?.companyName ?? '';
    return supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur';
  });

  /** The confirmation box is open while this is not null. */
  supplierToDelete = signal<Supplier | null>(null);
  deleteMessage = computed(
    () => `Le fournisseur « ${this.supplierToDelete()?.companyName ?? ''} » sera définitivement supprimé.`,
  );

  private listRequest?: Subscription;

  ngOnInit(): void {
    this.load(0);
  }

  load(page: number): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.listRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    const term = this.term();
    const request = term ? this.service.search(term, page) : this.service.getAll(page);

    this.listRequest = request.subscribe({
      next: response => {
        this.suppliers.set(response.content);
        this.pageInfo.set(toPageInfo(response));
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  reload(): void {
    this.load(this.pageInfo()?.page ?? 0);
  }

  onSearch(term: string): void {
    this.term.set(term);
    this.load(0);
  }

  openDetail(supplier: Supplier): void {
    this.selectedSupplier.set(supplier);
    this.drawerMode.set('detail');
    this.drawerOpen.set(true);
  }

  openCreate(): void {
    this.selectedSupplier.set(null);
    this.drawerMode.set('form');
    this.drawerOpen.set(true);
  }

  openEdit(): void {
    this.drawerMode.set('form');
  }

  /** Cancelling an edit goes back to the sheet; cancelling a creation closes the panel. */
  onFormCancelled(): void {
    if (this.selectedSupplier()) this.drawerMode.set('detail');
    else this.closeDrawer();
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedSupplier.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.reload();
  }

  /** No confirmation: the action is reversible. */
  toggleActive(): void {
    const supplier = this.selectedSupplier();
    if (!supplier) return;

    this.actionError.set(null);
    const request = supplier.active ? this.service.deactivate(supplier.id) : this.service.activate(supplier.id);

    request.subscribe({
      next: updated => {
        this.selectedSupplier.set(updated);
        // Updated in place: reloading would only move the page under the user's eyes.
        this.suppliers.update(list => list.map(s => (s.id === updated.id ? updated : s)));
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  askDelete(): void {
    this.supplierToDelete.set(this.selectedSupplier());
  }

  cancelDelete(): void {
    this.supplierToDelete.set(null);
  }

  confirmDelete(): void {
    const supplier = this.supplierToDelete();
    if (!supplier) return;

    this.supplierToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(supplier.id).subscribe({
      next: () => {
        this.closeDrawer();
        this.reload();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
