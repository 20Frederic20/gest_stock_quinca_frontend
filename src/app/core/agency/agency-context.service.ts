import { Injectable, computed, inject, signal } from '@angular/core';
import { AgenciesService } from '../../features/agencies/agencies.service';
import { SelectOption } from '../../shared/select-search/select-search.component';
import { AuthService } from '../auth/auth.service';

/**
 * The agency whose stock is currently being viewed, chosen from the navbar switcher
 * (or from the same picker on the stock and movements pages, which share this state).
 * Every authenticated role may look at another agency's stock (read-only, see
 * `stock.view` / `stock.viewAll` in permissions.ts); acting there stays checked
 * permission by permission, agency by agency, on the backend and in the front.
 */
@Injectable({ providedIn: 'root' })
export class AgencyContextService {
  private auth = inject(AuthService);
  private agenciesService = inject(AgenciesService);

  private agenciesList = signal<SelectOption[]>([]);
  private loaded = false;
  /** The user this context was last set up for; a different one means "back to their own agency". */
  private forUserId: string | null = null;

  /** '' until a user is known. */
  viewedAgencyId = signal('');

  agencyOptions = computed(() => this.agenciesList());

  viewedAgencyLabel = computed(
    () =>
      this.agenciesList().find(a => a.id === this.viewedAgencyId())?.label ??
      this.auth.user()?.agencyLabel ??
      '',
  );

  /** Nothing to switch to when there is only one agency (or none loaded yet). */
  canSwitch = computed(() => this.agenciesList().length > 1);

  /**
   * Called by any screen that offers the switcher (the navbar, the stock and movements
   * pages): loads the active agencies once, and puts the viewed agency back to the
   * signed-in user's own the first time it sees them (a fresh login, or a different
   * user in the same tab). Safe to call repeatedly.
   */
  ensureLoaded(): void {
    const user = this.auth.user();
    if (!user) {
      this.forUserId = null;
      this.viewedAgencyId.set('');
      return;
    }
    if (this.forUserId !== user.id) {
      this.forUserId = user.id;
      this.viewedAgencyId.set(user.agencyId);
    }

    if (this.loaded) return;
    this.loaded = true;
    this.agenciesService.getActive().subscribe({
      next: agencies => this.agenciesList.set(agencies.map(a => ({ id: a.id, label: a.label }))),
      // The own agency stays shown: only the choice of another one is missing.
      error: () => this.agenciesList.set([]),
    });
  }

  select(agencyId: string): void {
    if (agencyId) this.viewedAgencyId.set(agencyId);
  }

  /** Back to the user's own agency, e.g. leaving a screen that borrowed the context. */
  resetToHome(): void {
    const user = this.auth.user();
    if (user) this.viewedAgencyId.set(user.agencyId);
  }
}
