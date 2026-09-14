import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiError } from '../http/api-error.model';
import { Agency } from '../models/agency.model';

export const CURRENT_AGENCY_STORAGE_KEY = 'geststock.currentAgencyId';

/**
 * The agency the user works in, chosen in the header and remembered by the browser.
 * No screen filters on it yet: it is ready for the stock and sales screens.
 */
@Injectable({ providedIn: 'root' })
export class CurrentAgencyService {
  private http = inject(HttpClient);

  /** Only active agencies can be chosen. */
  agencies = signal<Agency[]>([]);
  loaded = signal(false);
  error = signal<string | null>(null);

  private selectedId = signal<string | null>(readStoredId());

  /** The remembered agency, or the first active one if it was closed or deleted in the meantime. */
  current = computed(() => {
    const agencies = this.agencies();
    return agencies.find(agency => agency.id === this.selectedId()) ?? agencies[0] ?? null;
  });

  private request?: Subscription;

  /** Called at startup, and by the agencies screen after each change. */
  refresh(): void {
    this.request?.unsubscribe();
    this.request = this.http.get<Agency[]>('/api/v1/agencies/active').subscribe({
      next: agencies => {
        this.agencies.set(agencies);
        this.error.set(null);
        this.loaded.set(true);
      },
      // The previous list stays: the header keeps showing the agency the user was in.
      error: (error: ApiError) => {
        this.error.set(error.message);
        this.loaded.set(true);
      },
    });
  }

  select(id: string): void {
    this.selectedId.set(id);
    try {
      localStorage.setItem(CURRENT_AGENCY_STORAGE_KEY, id);
    } catch {
      // Private browsing or blocked storage: the choice lasts until the page is reloaded.
    }
  }
}

function readStoredId(): string | null {
  try {
    return localStorage.getItem(CURRENT_AGENCY_STORAGE_KEY);
  } catch {
    return null;
  }
}
