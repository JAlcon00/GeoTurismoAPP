import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Review } from '../../shared/models/review.model';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly apiUrl = `${environment.apiUrl}/reviews`;

  private reviewsSubject = new BehaviorSubject<Review[]>([]);
  reviews$ = this.reviewsSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadAll(locationId?: string): Observable<ApiResponse<Review[]>> {
    const params = locationId ? `?location=${locationId}` : '';
    return this.http.get<ApiResponse<Review[]>>(`${this.apiUrl}${params}`).pipe(
      tap((res) => this.reviewsSubject.next(res.data))
    );
  }

  create(data: { location: string; rating: number; comment?: string }): Observable<ApiResponse<Review>> {
    return this.http.post<ApiResponse<Review>>(this.apiUrl, data).pipe(
      tap((res) => this.reviewsSubject.next([res.data, ...this.reviewsSubject.value]))
    );
  }

  update(id: string, data: { rating?: number; comment?: string }): Observable<ApiResponse<Review>> {
    return this.http.put<ApiResponse<Review>>(`${this.apiUrl}/${id}`, data).pipe(
      tap((res) => {
        const updated = this.reviewsSubject.value.map((r) => r._id === id ? res.data : r);
        this.reviewsSubject.next(updated);
      })
    );
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.reviewsSubject.next(this.reviewsSubject.value.filter((r) => r._id !== id));
      })
    );
  }
}
