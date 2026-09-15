import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Privilege } from '../../core/models/privilege.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { PrivilegeFormComponent } from './privilege-form.component';
import { PrivilegesService } from './privileges.service';

/** "Privilèges" section of the pricing screen: the price lists (Détail, Gros, Chantier…). */
@Component({
  selector: 'app-privilege-list',
  imports: [StateViewComponent, BadgeComponent, DrawerComponent, ConfirmDialogComponent, PrivilegeFormComponent],
  templateUrl: './privilege-list.component.html',
  styleUrl: './privilege-list.component.css',
})
export class PrivilegeListComponent implements OnInit {
  private service = inject(PrivilegesService);
  private auth = inject(AuthService);

  /** Read-only users see the section without its write actions. */
  canWrite = computed(() => this.auth.can('referential.write'));

  privileges = signal<Privilege[]>([]);
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (default change, deletion…): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);

  drawerOpen = signal(false);
  /** null while creating a new privilege. */
  selectedPrivilege = signal<Privilege | null>(null);

  /** The confirmation box is open while this is not null. */
  privilegeToDelete = signal<Privilege | null>(null);
  deleteMessage = computed(
    () => `Le privilège « ${this.privilegeToDelete()?.label ?? ''} » sera définitivement supprimé.`,
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getAll().subscribe({
      next: privileges => {
        this.privileges.set(privileges);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  openCreate(): void {
    this.selectedPrivilege.set(null);
    this.drawerOpen.set(true);
  }

  /** No detail view: a label and a flag fit in the table, so the form opens directly. */
  openEdit(privilege: Privilege): void {
    this.selectedPrivilege.set(privilege);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedPrivilege.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.load();
  }

  setDefault(privilege: Privilege, event: Event): void {
    // Otherwise the click also reaches the row and opens the form.
    event.stopPropagation();
    this.actionError.set(null);

    this.service.setDefault(privilege.id).subscribe({
      // The flag left the previous default privilege: only a reload shows both rows right.
      next: () => this.load(),
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  askDelete(privilege: Privilege, event: Event): void {
    event.stopPropagation();
    this.privilegeToDelete.set(privilege);
  }

  cancelDelete(): void {
    this.privilegeToDelete.set(null);
  }

  confirmDelete(): void {
    const privilege = this.privilegeToDelete();
    if (!privilege) return;

    this.privilegeToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(privilege.id).subscribe({
      next: () => {
        if (this.selectedPrivilege()?.id === privilege.id) this.closeDrawer();
        this.load();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
