import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Dashboard } from '../../core/models/dashboard.model';

/** Calls to the backend DashboardController: one call, every figure of the agency. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  getForAgency(agencyId: string) {
    return this.http.get<Dashboard>(`${this.url}/agencies/${agencyId}/dashboard`);
  }
}
