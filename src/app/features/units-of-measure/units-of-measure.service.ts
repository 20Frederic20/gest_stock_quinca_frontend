import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { UnitOfMeasure, UnitOfMeasureRequest } from '../../core/models/unit-of-measure.model';

/** Calls to the backend UnitOfMeasureController, in the same order. */
@Injectable({ providedIn: 'root' })
export class UnitsOfMeasureService {
  private http = inject(HttpClient);
  private url = '/api/v1/units-of-measure';

  getAll() {
    return this.http.get<UnitOfMeasure[]>(this.url);
  }

  getById(id: string) {
    return this.http.get<UnitOfMeasure>(`${this.url}/${id}`);
  }

  create(body: UnitOfMeasureRequest) {
    return this.http.post<UnitOfMeasure>(this.url, body);
  }

  update(id: string, body: UnitOfMeasureRequest) {
    return this.http.put<UnitOfMeasure>(`${this.url}/${id}`, body);
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
