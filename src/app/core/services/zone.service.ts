import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Zone, ZoneType } from '../../shared/models/zone.model';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class ZoneService {
  private readonly apiUrl = `${environment.apiUrl}/zones`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResponse<Zone[]>> {
    return this.http.get<ApiResponse<Zone[]>>(this.apiUrl);
  }

  create(data: { name: string; type: ZoneType; coordinates: [number, number][] }): Observable<ApiResponse<Zone>> {
    return this.http.post<ApiResponse<Zone>>(this.apiUrl, data);
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`);
  }
}
