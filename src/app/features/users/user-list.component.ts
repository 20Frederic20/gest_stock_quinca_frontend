import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error.model';
import { Agency } from '../../core/models/agency.model';
import { ROLE_LABELS, User } from '../../core/models/user.model';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { DrawerComponent } from '../../shared/drawer/drawer.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { StateViewComponent } from '../../shared/state-view/state-view.component';
import { AgenciesService } from '../agencies/agencies.service';
import { formatNumber } from '../articles/article-format';
import { PasswordResetFormComponent } from './password-reset-form.component';
import { UserDetailComponent } from './user-detail.component';
import { UserFormComponent } from './user-form.component';
import { UsersService } from './users.service';

type DrawerMode = 'detail' | 'form' | 'password';

/** Administration > Utilisateurs. The route is reserved to administrators. */
@Component({
  selector: 'app-user-list',
  imports: [
    PageHeaderComponent,
    StateViewComponent,
    BadgeComponent,
    DrawerComponent,
    ConfirmDialogComponent,
    UserDetailComponent,
    UserFormComponent,
    PasswordResetFormComponent,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css',
})
export class UserListComponent implements OnInit {
  private service = inject(UsersService);
  private agenciesService = inject(AgenciesService);
  private auth = inject(AuthService);

  users = signal<User[]>([]);
  /** Agencies a user can be attached to. */
  agencies = signal<Agency[]>([]);
  loading = signal(false);
  /** Loading failure: replaces the table. */
  error = signal<string | null>(null);
  /** Action failure (e.g. last administrator): shown above the table, which stays visible. */
  actionError = signal<string | null>(null);
  /** Confirmation shown in the sheet, e.g. after a password reset. */
  notice = signal<string | null>(null);

  drawerOpen = signal(false);
  drawerMode = signal<DrawerMode>('detail');
  /** null while creating a new user. */
  selectedUser = signal<User | null>(null);
  drawerHeading = computed(() => {
    const user = this.selectedUser();
    switch (this.drawerMode()) {
      case 'detail':
        return user?.name ?? '';
      case 'password':
        return 'Réinitialiser le mot de passe';
      case 'form':
        return user ? 'Modifier l’utilisateur' : 'Nouvel utilisateur';
    }
  });

  /** The confirmation box is open while this is not null. */
  userToDelete = signal<User | null>(null);
  deleteMessage = computed(
    () => `L’utilisateur « ${this.userToDelete()?.name ?? ''} » sera définitivement supprimé.`,
  );

  protected roleLabels = ROLE_LABELS;
  protected formatNumber = formatNumber;

  ngOnInit(): void {
    this.agenciesService.getActive().subscribe({
      next: agencies => this.agencies.set(agencies),
      error: (error: ApiError) => this.actionError.set(`Agences indisponibles : ${error.message}`),
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.service.getAll().subscribe({
      next: users => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  isSelf(user: User): boolean {
    return this.auth.user()?.id === user.id;
  }

  openCreate(): void {
    this.selectedUser.set(null);
    this.notice.set(null);
    this.drawerMode.set('form');
    this.drawerOpen.set(true);
  }

  openDetail(user: User): void {
    this.selectedUser.set(user);
    this.notice.set(null);
    this.drawerMode.set('detail');
    this.drawerOpen.set(true);
  }

  openEdit(): void {
    this.notice.set(null);
    this.drawerMode.set('form');
  }

  openPasswordReset(): void {
    this.notice.set(null);
    this.drawerMode.set('password');
  }

  /** Cancelling from an existing user goes back to the sheet; cancelling a creation closes the panel. */
  onFormCancelled(): void {
    if (this.selectedUser()) this.drawerMode.set('detail');
    else this.closeDrawer();
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.selectedUser.set(null);
    this.notice.set(null);
  }

  onSaved(): void {
    this.closeDrawer();
    this.load();
  }

  onPasswordReset(): void {
    this.drawerMode.set('detail');
    this.notice.set(`Le mot de passe de ${this.selectedUser()?.name ?? ''} a été réinitialisé.`);
  }

  /** No confirmation: the action is reversible. */
  toggleActive(): void {
    const user = this.selectedUser();
    if (!user) return;

    this.actionError.set(null);
    const request = user.active ? this.service.deactivate(user.id) : this.service.activate(user.id);

    request.subscribe({
      next: updated => {
        this.selectedUser.set(updated);
        this.users.update(list => list.map(u => (u.id === updated.id ? updated : u)));
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }

  askDelete(): void {
    this.userToDelete.set(this.selectedUser());
  }

  cancelDelete(): void {
    this.userToDelete.set(null);
  }

  confirmDelete(): void {
    const user = this.userToDelete();
    if (!user) return;

    this.userToDelete.set(null);
    this.actionError.set(null);

    this.service.delete(user.id).subscribe({
      next: () => {
        this.closeDrawer();
        this.load();
      },
      error: (error: ApiError) => this.actionError.set(error.message),
    });
  }
}
