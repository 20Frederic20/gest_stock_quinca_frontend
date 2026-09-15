import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from './agencies.service';
import { AgencyDetailComponent } from './agency-detail.component';
import { AgencyFormComponent } from './agency-form.component';

type DrawerMode = 'detail' | 'form';

@Component({
  selector: 'app-agency-list',
  imports: [
    PageHeaderComponent,
    StateViewComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    AgencyDetailComponent,
    AgencyFormComponent,
  ],
  templateUrl: './agency-list.component.html',
  styleUrl: './agency-list.component.css',
})
export class AgencyListComponent implements OnInit {
  private service = inject(AgenciesService);
  private auth = inject(AuthService);

  /** Only administrators edit agencies; everybody else reads them. */
  canWrite = computed(() => this.auth.can('agencies.write'));

  agencies = signal<Agency[]>([]);
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (status change, deletion…): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  /** null while creating a new agency. */
  selectedAgency = signal<Agency | null>(null);
  drawerHeading = computed(() => {
    const agency = this.selectedAgency();
    if (this.drawerMode() === 'detail') return agency?.label ?? '';
    return agency ? 'Modifier l’agence' : 'Nouvelle agence';
  });

  /** The confirmation box is open while this is not null. */
  agencyToDelete = signal<Agency | null>(null);
  deleteMessage = computed(
    () => `L’agence « ${this.agencyToDelete()?.label ?? ''} » sera définitivement supprimée.`,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getAll().subscribe({
      next: agencies => {
        this.agencies.set(agencies);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.selectedAgency.set(null);
    this.drawerMode.set('form');
    this.drawerOpen.set(true);
  }

  openDetail(agency: Agency): void {
    this.selectedAgency.set(agency);
    this.drawerMode.set('detail');
    this.drawerOpen.set(true);
  }

  openEdit(): void {
    this.drawerMode.set('form');
  }

  /** Cancelling an edit goes back to the sheet; cancelling a creation closes the panel. */
  onFormCancelled(): void {
    if (this.selectedAgency()) this.drawerMode.set('detail');
    else this.closeDrawer();
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedAgency.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.load();
  }

  /** No confirmation: the action is reversible. */
  toggleActive(): void {
    const agency = this.selectedAgency();
    if (!agency) return;

    this.actionError.set(null);
    const request = agency.active ? this.service.deactivate(agency.id) : this.service.activate(agency.id);

    request.subscribe({
      next: updated => {
        this.selectedAgency.set(updated);
        this.agencies.update(list => list.map(a => (a.id === updated.id ? updated : a)));
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  askDelete(): void {
    this.agencyToDelete.set(this.selectedAgency());
  }

  cancelDelete(): void {
    this.agencyToDelete.set(null);
  }

  confirmDelete(): void {
    const agency = this.agencyToDelete();
    if (!agency) return;

    this.agencyToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(agency.id).subscribe({
      next: () => {
        this.closeDrawer();
        this.load();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
