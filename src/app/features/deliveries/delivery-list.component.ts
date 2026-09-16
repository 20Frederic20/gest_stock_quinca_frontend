import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { Delivery } from '../../core/models/delivery.model';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { formatNumber } from '../articles/article-format';
import { CancelDeliveryFormComponent } from './cancel-delivery-form.component';
import { DeliveriesService } from './deliveries.service';

/** Ventes > Livraisons: the delivery notes of an agency, newest first. A row opens its invoice. */
@Component({
  selector: 'app-delivery-list',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    DrawerComponent,
    CancelDeliveryFormComponent,
  ],
  templateUrl: './delivery-list.component.html',
  styleUrl: './delivery-list.component.css',
})
export class DeliveryListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(DeliveriesService);
  private agenciesService = inject(AgenciesService);
  private router = inject(Router);

  /** Other agencies are for managers and administrators. */
  canChooseAgency = computed(() => this.auth.can('sales.viewAll'));
  canCancelDelivery = computed(() => this.auth.can('deliveries.cancel'));

  agencies = signal<Agency[]>([]);
  agencyOptions = computed<SelectOption[]>(() =>
    this.agencies().map(agency => ({ id: agency.id, label: agency.label })),
  );
  agencyId = signal(this.auth.user()?.agencyId ?? '');
  agencyLabel = computed(
    () => this.agencies().find(a => a.id === this.agencyId())?.label ?? this.auth.user()?.agencyLabel ?? '',
  );

  deliveries = signal<Delivery[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  cancelling = signal<Delivery | null>(null);

  protected formatDate = formatDate;
  protected formatNumber = formatNumber;

  private request?: Subscription;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      // The own agency stays shown: only the choice of another one is missing.
      next: agencies => this.agencies.set(agencies),
      error: () => this.agencies.set([]),
    });
    this.load(0);
  }

  load(page: number): void {
    // A slower, older answer must not overwrite the one the user is waiting for.
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    this.request = this.service.getByAgency(this.agencyId(), page).subscribe({
      next: response => {
        this.deliveries.set(response.content);
        this.pageInfo.set(toPageInfo(response));
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  onAgencySelected(option: SelectOption | null): void {
    if (!option) return;
    this.agencyId.set(option.id);
    this.load(0);
  }

  openInvoice(delivery: Delivery): void {
    this.router.navigate(['/invoices', delivery.invoiceId]);
  }

  openCancel(delivery: Delivery): void {
    this.cancelling.set(delivery);
  }

  closeCancel(): void {
    this.cancelling.set(null);
  }

  onCancelled(delivery: Delivery): void {
    this.cancelling.set(null);
    this.deliveries.update(deliveries => deliveries.map(current => (current.id === delivery.id ? delivery : current)));
  }

  summaryOf(delivery: Delivery): string {
    return `${delivery.number} du ${formatDate(delivery.deliveryDate)}`;
  }
}
