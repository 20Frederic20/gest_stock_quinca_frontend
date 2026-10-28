import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { PageInfo, toPageInfo } from '../../core/models/page.model';
import { Transfer, TransferSummary } from '../../core/models/transfer.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PaginationComponent } from '../../shared/pagination/pagination.component';
import { SelectOption, SelectSearchComponent } from '../../shared/select-search/select-search.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatDate } from '../articles/article-format';
import { TRANSFER_STATUS_LABELS, TRANSFER_STATUS_TONES } from './transfer-format';
import { TransferFormComponent } from './transfer-form.component';
import { TransfersService } from './transfers.service';

/** Stock > Transferts : the transfers of one agency, sent or received, newest first. A row opens it. */
@Component({
  selector: 'app-transfer-list',
  imports: [
    PageHeaderComponent,
    SelectSearchComponent,
    StateViewComponent,
    PaginationComponent,
    BadgeComponent,
    DrawerComponent,
    TransferFormComponent,
  ],
  templateUrl: './transfer-list.component.html',
  styleUrl: './transfer-list.component.css',
})
export class TransferListComponent implements OnInit {
  private auth = inject(AuthService);
  private service = inject(TransfersService);
  private agenciesService = inject(AgenciesService);
  private router = inject(Router);

  agencies = signal<Agency[]>([]);
  agencyOptions = computed<SelectOption[]>(() =>
    this.agencies().map(agency => ({ id: agency.id, label: agency.label })),
  );
  agencyId = signal(this.auth.user()?.agencyId ?? '');
  agencyLabel = computed(
    () => this.agencies().find(a => a.id === this.agencyId())?.label ?? this.auth.user()?.agencyLabel ?? '',
  );

  /** The backend only lets an admin consult another agency's transfers: everyone else sees their own. */
  canChooseAgency = computed(() => this.auth.user()?.role === 'ADMIN');
  canCreate = computed(() => this.auth.can('transfer.ship', this.agencyId()));

  transfers = signal<TransferSummary[]>([]);
  pageInfo = signal<PageInfo | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  formOpen = signal(false);

  protected statusLabels = TRANSFER_STATUS_LABELS;
  protected statusTones = TRANSFER_STATUS_TONES;
  protected formatDate = formatDate;

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
        this.transfers.set(response.content);
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

  open(transfer: TransferSummary): void {
    this.router.navigate(['/transfers', transfer.id]);
  }

  openCreate(): void {
    this.formOpen.set(true);
  }

  closeCreate(): void {
    this.formOpen.set(false);
  }

  /** The transfer exists but has no line yet: its own page is where it gets filled. */
  onCreated(transfer: Transfer): void {
    this.formOpen.set(false);
    this.router.navigate(['/transfers', transfer.id]);
  }

  /** Whether the goods leave from here or arrive here, the other side is what matters to read. */
  otherAgencyLabel(transfer: TransferSummary): string {
    return transfer.sourceAgencyId === this.agencyId() ? transfer.destinationAgencyLabel : transfer.sourceAgencyLabel;
  }

  direction(transfer: TransferSummary): 'out' | 'in' {
    return transfer.sourceAgencyId === this.agencyId() ? 'out' : 'in';
  }
}
