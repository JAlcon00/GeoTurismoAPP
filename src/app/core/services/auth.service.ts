import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, User } from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  /** Signal con el usuario actualmente autenticado */
  currentUser = signal<User | null>(this.loadUserFromStorage());

  constructor(private http: HttpClient, private router: Router) {}

  register(name: string, email: string, password: string): Observable<{ success: boolean; data: User }> {
    return this.http.post<{ success: boolean; data: User }>(`${this.apiUrl}/register`, { name, email, password });
  }

  login(email: string, password: string): Observable<{ success: boolean; data: AuthResponse }> {
    return this.http.post<{ success: boolean; data: AuthResponse }>(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((res) => {
        sessionStorage.setItem('token', res.data.token);
        sessionStorage.setItem('user', JSON.stringify(res.data.user));
        this.currentUser.set(res.data.user);
      })
    );
  }

  logout(): void {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    this.currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return sessionStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private loadUserFromStorage(): User | null {
    const raw = sessionStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  }
}
