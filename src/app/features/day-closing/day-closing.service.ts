import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { PageResponse } from '../../core/models/page.model';
import { DayClosing, DayClosingCloseRequest, DayClosingOpenRequest } from '../../core/models/day-closing.model';

/** Calls to the backend DayClosingController. */
@Injectable({ providedIn: 'root' })
export class DayClosingService {
  private http = inject(HttpClient);
  private url = '/api/v1';

  /** Newest first, 20 per page. */
  getByAgency(agencyId: string, page = 0) {
    return this.http.get<PageResponse<DayClosing>>(`${this.url}/agencies/${agencyId}/day-closings`, {
      params: { page },
    });
  }

  /** The agency's open session, if it has one. The caller treats a 404 as "none open". */
  getCurrent(agencyId: string) {
    return this.http.get<DayClosing>(`${this.url}/agencies/${agencyId}/day-closings/current`);
  }

  /** Refused if a session is already open for this agency. */
  open(agencyId: string, body: DayClosingOpenRequest) {
    return this.http.post<DayClosing>(`${this.url}/agencies/${agencyId}/day-closings`, body);
  }

  /** The backend recomputes the theoretical total itself: only the counted amount is sent. */
  close(id: string, body: DayClosingCloseRequest) {
    return this.http.post<DayClosing>(`${this.url}/day-closings/${id}/closure`, body);
  }
}
