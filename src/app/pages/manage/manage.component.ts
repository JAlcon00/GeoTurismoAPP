import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { CategoryService } from '../../core/services/category.service';
import { ReviewService } from '../../core/services/review.service';
import { LocationService } from '../../core/services/location.service';
import { ZoneService } from '../../core/services/zone.service';
import { AuthService } from '../../core/services/auth.service';
import { Category, Location } from '../../shared/models/location.model';
import { Review } from '../../shared/models/review.model';
import { Zone } from '../../shared/models/zone.model';

@Component({
  selector: 'app-manage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NavbarComponent],
  templateUrl: './manage.component.html',
})
export class ManageComponent implements OnInit {
  activeTab: 'categories' | 'reviews' | 'zones' = 'categories';

  readonly iconOptions = [
    '📍','🏛️','🏟️','🏰','🏯','⛪','🕌','🕍','⛩️',
    '🎡','🎢','🎠','🎪','🎭','🎨','🖼️','🎬','🎵',
    '🌳','🌲','🌴','🏞️','🏕️','⛺','🌋','🗻','🏔️',
    '🏖️','🏝️','🌊','⛵','🚢','✈️','🚂','🚌',
    '🍽️','☕','🍦','🍷','🍺','🛒','🏪','🏬','🏦',
    '🏥','🏫','🏗️','🏟️','⚽','🎾','🏊','🤸','🎿',
    '🦁','🐘','🦒','🦋','🌸','🌺','🌻','🌈',
  ];

  selectIcon(icon: string): void {
    this.categoryForm.patchValue({ icon });
  }

  categories: Category[] = [];
  reviews: Review[] = [];
  locations: Location[] = [];
  zones: Zone[] = [];

  editingCategory = signal<Category | null>(null);
  editingReview = signal<Review | null>(null);
  showCategoryModal = signal(false);
  showReviewModal = signal(false);

  successMsg = '';
  errorMsg = '';

  auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private reviewService = inject(ReviewService);
  private locationService = inject(LocationService);
  private zoneService = inject(ZoneService);

  categoryForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    icon: ['📍'],
  });

  reviewForm = this.fb.group({
    location: ['', Validators.required],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: [''],
  });

  ngOnInit(): void {
    this.categoryService.loadAll().subscribe((res) => (this.categories = res.data));
    this.reviewService.loadAll().subscribe((res) => (this.reviews = res.data));
    this.locationService.loadAll().subscribe((res) => (this.locations = res.data));
    this.zoneService.getAll().subscribe((res) => (this.zones = res.data));

    this.categoryService.categories$.subscribe((c) => (this.categories = c));
    this.reviewService.reviews$.subscribe((r) => (this.reviews = r));
  }

  // ── Categorías ────────────────────────────────────────────────────────────

  openCategoryModal(cat?: Category): void {
    this.editingCategory.set(cat ?? null);
    this.categoryForm.reset({ name: cat?.name ?? '', description: cat?.description ?? '', icon: cat?.icon ?? '📍' });
    this.showCategoryModal.set(true);
  }

  closeCategoryModal(): void {
    this.showCategoryModal.set(false);
    this.editingCategory.set(null);
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) return;
    const data = this.categoryForm.value as { name: string; description?: string; icon?: string };
    const editing = this.editingCategory();

    const obs = editing
      ? this.categoryService.update(editing._id, data)
      : this.categoryService.create(data);

    obs.subscribe({
      next: () => { this.closeCategoryModal(); this.flash('Categoría guardada'); },
      error: (err) => (this.errorMsg = err.error?.message ?? 'Error'),
    });
  }

  deleteCategory(id: string): void {
    if (!confirm('¿Eliminar esta categoría?')) return;
    this.categoryService.delete(id).subscribe({
      next: () => this.flash('Categoría eliminada'),
      error: (err) => (this.errorMsg = err.error?.message ?? 'Error'),
    });
  }

  // ── Reseñas ───────────────────────────────────────────────────────────────

  openReviewModal(rev?: Review): void {
    this.editingReview.set(rev ?? null);
    this.reviewForm.reset({
      location: rev?.location?._id ?? '',
      rating: rev?.rating ?? 5,
      comment: rev?.comment ?? '',
    });
    this.showReviewModal.set(true);
  }

  closeReviewModal(): void {
    this.showReviewModal.set(false);
    this.editingReview.set(null);
  }

  saveReview(): void {
    if (this.reviewForm.invalid) return;
    const data = this.reviewForm.value as { location: string; rating: number; comment?: string };
    const editing = this.editingReview();

    const obs = editing
      ? this.reviewService.update(editing._id, { rating: data.rating, comment: data.comment })
      : this.reviewService.create(data);

    obs.subscribe({
      next: () => { this.closeReviewModal(); this.flash('Reseña guardada'); },
      error: (err) => (this.errorMsg = err.error?.message ?? 'Error'),
    });
  }

  deleteReview(id: string): void {
    if (!confirm('¿Eliminar esta reseña?')) return;
    this.reviewService.delete(id).subscribe({
      next: () => this.flash('Reseña eliminada'),
      error: (err) => (this.errorMsg = err.error?.message ?? 'Error'),
    });
  }

  stars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  categoryOfReview(rev: Review): Category | null {
    if (!rev.location) return null;
    const loc = this.locations.find((l) => l._id === rev.location!._id);
    return (loc?.category as Category) ?? null;
  }

  // ── Zonas ─────────────────────────────────────────────────────────────────

  deleteZone(id: string): void {
    if (!confirm('¿Eliminar esta zona del mapa?')) return;
    this.zoneService.delete(id).subscribe({
      next: () => {
        this.zones = this.zones.filter((z) => z._id !== id);
        this.flash('Zona eliminada');
      },
      error: (err) => (this.errorMsg = err.error?.message ?? 'Error'),
    });
  }

  zoneTypeLabel(type: string): string {
    return type === 'polygon' ? 'Polígono' : 'Línea';
  }

  private flash(msg: string): void {
    this.successMsg = msg;
    this.errorMsg = '';
    setTimeout(() => (this.successMsg = ''), 3000);
  }
}
