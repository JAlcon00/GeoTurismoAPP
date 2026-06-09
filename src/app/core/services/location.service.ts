import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Location } from '../../shared/models/location.model';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly apiUrl = `${environment.apiUrl}/locations`;

  /** BehaviorSubject que mantiene la lista de ubicaciones en tiempo real */
  private locationsSubject = new BehaviorSubject<Location[]>([]);
  locations$ = this.locationsSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadAll(name?: string): Observable<ApiResponse<Location[]>> {
    const params = name ? `?name=${encodeURIComponent(name)}` : '';
    return this.http.get<ApiResponse<Location[]>>(`${this.apiUrl}${params}`).pipe(
      tap((res) => this.locationsSubject.next(res.data))
    );
  }

  create(data: { name: string; description?: string; latitude: number; longitude: number; category?: string }): Observable<ApiResponse<Location>> {
    return this.http.post<ApiResponse<Location>>(this.apiUrl, data).pipe(
      tap((res) => this.locationsSubject.next([res.data, ...this.locationsSubject.value]))
    );
  }

  update(id: string, data: Partial<{ name: string; description: string; latitude: number; longitude: number; category: string }>): Observable<ApiResponse<Location>> {
    return this.http.put<ApiResponse<Location>>(`${this.apiUrl}/${id}`, data).pipe(
      tap((res) => {
        const updated = this.locationsSubject.value.map((l) => l._id === id ? res.data : l);
        this.locationsSubject.next(updated);
      })
    );
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        const filtered = this.locationsSubject.value.filter((l) => l._id !== id);
        this.locationsSubject.next(filtered);
      })
    );
  }
}
