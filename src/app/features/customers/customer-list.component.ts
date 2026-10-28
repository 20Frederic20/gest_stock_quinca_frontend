import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { CUSTOMER_TYPE_LABELS, Customer, CustomerCredit } from '../../core/models/customer.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { Privilege } from '../../core/models/privilege.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SearchBarComponent } from '../../shared/search-bar/search-bar.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { PrivilegesService } from '../pricing/privileges.service';
import { formatMoney } from '../pricing/price-rules';
import { CustomerDetailComponent } from './customer-detail.component';
import { CustomerFormComponent } from './customer-form.component';
import { CustomersService } from './customers.service';

type DrawerMode = 'detail' | 'form';

/** Ventes > Clients et créances. Everybody reads them; creating, editing and deleting depend on the role. */
@Component({
  selector: 'app-customer-list',
  imports: [
    PageHeaderComponent,
    SearchBarComponent,
    StateViewComponent,
    PaginationComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    CustomerDetailComponent,
    CustomerFormComponent,
  ],
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.css',
})
export class CustomerListComponent implements OnInit {
  private service = inject(CustomersService);
  private privilegesService = inject(PrivilegesService);
  private auth = inject(AuthService);

  /** Sellers register customers, managers change them, only administrators delete them. */
  canCreate = computed(() => this.auth.can('customers.create'));
  canEdit = computed(() => this.auth.can('customers.write'));
  canDelete = computed(() => this.auth.can('customers.delete'));

  customers = signal<Customer[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (status change, deletion…): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);

  /** Price grids for the form, loaded once. */
  privileges = signal<Privilege[]>([]);

  term = signal('');
  emptyMessage = computed(() =>
    this.term() ? 'Aucun client ne correspond à cette recherche.' : 'Aucun client enregistré.',
  );

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  /** null while creating a new customer. */
  selectedCustomer = signal<Customer | null>(null);
  drawerHeading = computed(() => {
    const customer = this.selectedCustomer();
    if (this.drawerMode() === 'detail') return customer?.name ?? '';
    return customer ? 'Modifier le client' : 'Nouveau client';
  });

  /** Credit situation of the selected customer, asked when its sheet opens. */
  credit = signal<CustomerCredit | null>(null);
  creditLoading = signal(false);
  creditError = signal<string | null>(null);

  /** The confirmation box is open while this is not null. */
  customerToDelete = signal<Customer | null>(null);
  deleteMessage = computed(
    () => `Le client « ${this.customerToDelete()?.name ?? ''} » sera définitivement supprimé.`,
  );

  protected typeLabels = CUSTOMER_TYPE_LABELS;
  protected formatMoney = formatMoney;

  private listRequest?: Subscription;
  private creditRequest?: Subscription;

  ngOnInit(): void {
    this.privilegesService.getAll().subscribe({
      next: privileges => this.privileges.set(privileges),
      error: (error: ApiError) => this.actionError.set(`Grilles tarifaires indisponibles : ${error.message}`),
    });
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
        this.customers.set(response.content);
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

  openDetail(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.drawerMode.set('detail');
    this.drawerOpen.set(true);
    this.loadCredit(customer.id);
  }

  openCreate(): void {
    this.selectedCustomer.set(null);
    this.drawerMode.set('form');
    this.drawerOpen.set(true);
  }

  openEdit(): void {
    this.drawerMode.set('form');
  }

  /** Cancelling an edit goes back to the sheet; cancelling a creation closes the panel. */
  onFormCancelled(): void {
    if (this.selectedCustomer()) this.drawerMode.set('detail');
    else this.closeDrawer();
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedCustomer.set(null);
    this.creditRequest?.unsubscribe();
    this.credit.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.reload();
  }

  /** No confirmation: the action is reversible. */
  toggleActive(): void {
    const customer = this.selectedCustomer();
    if (!customer) return;

    this.actionError.set(null);
    const request = customer.active ? this.service.deactivate(customer.id) : this.service.activate(customer.id);

    request.subscribe({
      next: updated => {
        this.selectedCustomer.set(updated);
        // Updated in place: reloading would only move the page under the user's eyes.
        this.customers.update(list => list.map(c => (c.id === updated.id ? updated : c)));
        // An inactive customer may no longer buy on credit.
        this.loadCredit(updated.id);
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  askDelete(): void {
    this.customerToDelete.set(this.selectedCustomer());
  }

  cancelDelete(): void {
    this.customerToDelete.set(null);
  }

  confirmDelete(): void {
    const customer = this.customerToDelete();
    if (!customer) return;

    this.customerToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(customer.id).subscribe({
      next: () => {
        this.closeDrawer();
        // The last customer of a page is gone: that page no longer exists.
        const info = this.pageInfo();
        const page = info && info.page > 0 && this.customers().length === 1 ? info.page - 1 : (info?.page ?? 0);
        this.load(page);
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  private loadCredit(customerId: string): void {
    this.creditRequest?.unsubscribe();
    this.credit.set(null);
    this.creditError.set(null);
    this.creditLoading.set(true);

    this.creditRequest = this.service.getCredit(customerId).subscribe({
      next: credit => {
        this.credit.set(credit);
        this.creditLoading.set(false);
      },
      error: (error: ApiError) => {
        this.creditError.set(error.message);
        this.creditLoading.set(false);
      },
    });
  }
}
