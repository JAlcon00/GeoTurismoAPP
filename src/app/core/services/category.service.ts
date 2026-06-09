import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category } from '../../shared/models/location.model';

interface ApiResponse<T> { success: boolean; data: T; }

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly apiUrl = `${environment.apiUrl}/categories`;

  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  categories$ = this.categoriesSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadAll(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>(this.apiUrl).pipe(
      tap((res) => this.categoriesSubject.next(res.data))
    );
  }

  create(data: { name: string; description?: string; icon?: string }): Observable<ApiResponse<Category>> {
    return this.http.post<ApiResponse<Category>>(this.apiUrl, data).pipe(
      tap((res) => this.categoriesSubject.next([...this.categoriesSubject.value, res.data]))
    );
  }

  update(id: string, data: Partial<{ name: string; description: string; icon: string }>): Observable<ApiResponse<Category>> {
    return this.http.put<ApiResponse<Category>>(`${this.apiUrl}/${id}`, data).pipe(
      tap((res) => {
        const updated = this.categoriesSubject.value.map((c) => c._id === id ? res.data : c);
        this.categoriesSubject.next(updated);
      })
    );
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.categoriesSubject.next(this.categoriesSubject.value.filter((c) => c._id !== id));
      })
    );
  }
}
