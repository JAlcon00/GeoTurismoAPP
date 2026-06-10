import { Component, OnInit, OnDestroy, NgZone, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { LocationService } from '../../core/services/location.service';
import { ZoneService } from '../../core/services/zone.service';
import { CategoryService } from '../../core/services/category.service';
import { ReviewService } from '../../core/services/review.service';
import { Location, Category } from '../../shared/models/location.model';
import { Zone } from '../../shared/models/zone.model';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';

// Fix clásico para íconos faltantes de Leaflet en builds de Angular/Webpack
const iconDefault = L.icon({
  iconUrl: 'assets/marker-icon.png',
  iconRetinaUrl: 'assets/marker-icon-2x.png',
  shadowUrl: 'assets/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NavbarComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private map!: L.Map;
  private markers = new Map<string, L.Marker>();
  private zoneLayerGroup = L.layerGroup();

  locations: Location[] = [];
  categories: Category[] = [];
  zones: Zone[] = [];
  activePanel: 'locations' | 'zones' | 'routes' = 'locations';
  searchQuery = '';
  showModal = signal(false);
  editingLocation = signal<Location | null>(null);
  pendingLatLng: [number, number] | null = null;
  errorMsg = '';
  successMsg = '';

  panelOpen = signal(true);
  togglePanel(): void { this.panelOpen.update((v) => !v); }
  drawMode = signal(false);
  showZoneModal = signal(false);
  drawPointCount = signal(0);
  showReviewModal = signal(false);
  reviewingTarget = signal<{ _id: string; name: string } | null>(null);
  reviewTargetType = signal<'location' | 'zone'>('location');
  readonly starRange = [1, 2, 3, 4, 5];
  private drawPoints: L.LatLng[] = [];
  private drawPreview: L.Polyline | null = null;
  private waypoints: L.LatLng[] = [];
  private waypointDots: L.CircleMarker[] = [];
  private isRouting = false;

  private locationService = inject(LocationService);
  private zoneService = inject(ZoneService);
  private categoryService = inject(CategoryService);
  private reviewService = inject(ReviewService);
  private fb = inject(FormBuilder);
  private zone = inject(NgZone);

  locationForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    category: [''],
  });

  zoneForm = this.fb.group({
    name: ['', Validators.required],
    type: ['polygon'],
  });

  reviewForm = this.fb.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    comment: [''],
  });

  private sub!: Subscription;

  ngOnInit(): void {
    this.initMap();
    this.loadLocations();
    this.loadZones();
    this.categoryService.loadAll().subscribe((res) => (this.categories = res.data));
    this.sub = this.locationService.locations$.subscribe((locs) => {
      this.locations = locs;
      this.syncMarkers(locs);
    });
  }

  ngOnDestroy(): void {
    this.clearDrawLayers();
    this.sub?.unsubscribe();
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map('map').setView([21.1236, -101.6822], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    this.zoneLayerGroup.addTo(this.map);

    // Click: agrega waypoint con routing OSRM, o abre modal de ubicación
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.drawMode()) {
        if (!this.isRouting) { this.addWaypoint(e.latlng); }
        return;
      }
      this.pendingLatLng = [e.latlng.lat, e.latlng.lng];
      this.locationForm.reset();
      this.editingLocation.set(null);
      this.showModal.set(true);
    });

    // Integración de leaflet-geoman para dibujar zonas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapAny = this.map as any;
    if (mapAny.pm) {
      mapAny.pm.addControls({
        position: 'topleft',
        drawMarker: false,
        drawCircle: false,
        drawCircleMarker: false,
        drawRectangle: false,
        editMode: false,
        dragMode: false,
        cutPolygon: false,
        rotateMode: false,
      });

      this.map.on('pm:create', (e: any) => this.onZoneCreated(e));
    }
  }

  private loadLocations(): void {
    this.locationService.loadAll().subscribe();
  }

  private loadZones(): void {
    this.zoneService.getAll().subscribe((res) => {
      this.zones = res.data;
      res.data.forEach((zone) => this.renderZone(zone));
    });
  }

  private syncMarkers(locations: Location[]): void {
    // Eliminar marcadores que ya no existen
    this.markers.forEach((marker, id) => {
      if (!locations.find((l) => l._id === id)) {
        marker.remove();
        this.markers.delete(id);
      }
    });

    // Agregar/actualizar marcadores
    locations.forEach((loc) => {
      if (!this.markers.has(loc._id)) {
        this.addMarker(loc);
      }
    });
  }

  private addMarker(loc: Location): void {
    const marker = L.marker([loc.latitude, loc.longitude])
      .addTo(this.map)
      .bindPopup(this.buildPopupContent(loc));

    marker.on('popupopen', () => {
      document.getElementById(`edit-${loc._id}`)?.addEventListener('click', () => this.openEditModal(loc));
      document.getElementById(`delete-${loc._id}`)?.addEventListener('click', () => this.deleteLocation(loc._id));
    });

    this.markers.set(loc._id, marker);
  }

  private buildPopupContent(loc: Location): string {
    return `
      <div class="min-w-[180px]">
        <h3 class="font-bold text-base">${loc.name}</h3>
        <p class="text-sm text-gray-600 mt-1">${loc.description || 'Sin descripción'}</p>
        ${loc.category ? `<span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mt-1 inline-block">${(loc.category as any).icon ?? ''} ${(loc.category as any).name ?? ''}</span>` : ''}
        <div class="flex gap-2 mt-3">
          <button id="edit-${loc._id}" class="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Editar</button>
          <button id="delete-${loc._id}" class="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Eliminar</button>
        </div>
      </div>`;
  }

  private renderZone(zone: Zone): void {
    const latlngs = zone.coordinates.map(([lat, lng]) => L.latLng(lat, lng));
    const color = zone.type === 'polygon' ? '#3b82f6' : '#10b981';

    const layer = zone.type === 'polygon'
      ? L.polygon(latlngs, { color, fillOpacity: 0.2 })
      : L.polyline(latlngs, { color });

    layer.addTo(this.zoneLayerGroup).bindPopup(`<b>${zone.name}</b>`);
  }

  private onZoneCreated(e: any): void {
    const layer = e.layer;
    const name = prompt('Nombre de esta zona:');
    if (!name) { layer.remove(); return; }

    const type = e.shape === 'Polygon' ? 'polygon' : 'polyline';
    const latlngs: L.LatLng[] = type === 'polygon'
      ? layer.getLatLngs()[0] as L.LatLng[]
      : layer.getLatLngs() as L.LatLng[];

    const coordinates: [number, number][] = latlngs.map((ll) => [ll.lat, ll.lng]);

    this.zoneService.create({ name, type, coordinates }).subscribe({
      next: () => this.showSuccess('Zona guardada'),
      error: () => layer.remove(),
    });
  }

  // ── Dibujo de zonas (routing OSRM) ──────────────────────────────────────

  startDraw(): void {
    this.clearDrawLayers();
    this.drawMode.set(true);
    this.showModal.set(false);
    this.map.getContainer().style.cursor = 'crosshair';
    this.map.doubleClickZoom.disable();
  }

  cancelDraw(): void {
    this.clearDrawLayers();
    this.drawMode.set(false);
    this.map.getContainer().style.cursor = '';
    this.map.doubleClickZoom.enable();
  }

  openZoneModal(): void {
    if (this.waypoints.length < 2) {
      this.errorMsg = 'Agrega al menos 2 puntos en el mapa';
      setTimeout(() => (this.errorMsg = ''), 3000);
      return;
    }
    this.drawPointCount.set(this.drawPoints.length);
    this.zoneForm.reset({ name: '', type: 'polygon' });
    this.showZoneModal.set(true);
  }

  closeZoneModal(): void {
    this.showZoneModal.set(false);
  }

  saveZone(): void {
    if (this.zoneForm.invalid) return;
    const { name, type } = this.zoneForm.value;
    const coordinates: [number, number][] = this.drawPoints.map((ll) => [ll.lat, ll.lng]);
    this.zoneService.create({ name: name!, type: type as 'polygon' | 'polyline', coordinates }).subscribe({
      next: (res) => {
        this.zones = [...this.zones, res.data];
        this.renderZone(res.data);
        this.clearDrawLayers();
        this.drawMode.set(false);
        this.showZoneModal.set(false);
        this.map.getContainer().style.cursor = '';
        this.map.doubleClickZoom.enable();
        this.activePanel = res.data.type === 'polygon' ? 'zones' : 'routes';
        this.showSuccess('Zona guardada');
      },
      error: (err) => (this.errorMsg = err.error?.message ?? 'Error al guardar zona'),
    });
  }

  private addWaypoint(latlng: L.LatLng): void {
    const idx = this.waypoints.length;

    // Dot visual: verde para el primero, ámbar para los siguientes
    const dot = L.circleMarker(latlng, {
      radius: idx === 0 ? 8 : 6,
      color: idx === 0 ? '#10b981' : '#f59e0b',
      fillColor: idx === 0 ? '#10b981' : '#f59e0b',
      fillOpacity: 1,
      weight: 2,
      interactive: false,
    }).addTo(this.map);
    this.waypointDots.push(dot);

    if (idx === 0) {
      // Primer punto: solo guardarlo
      this.drawPoints.push(latlng);
      this.waypoints.push(latlng);
      this.drawPointCount.set(1);
    } else {
      // Puntos siguientes: buscar ruta OSRM desde el anterior
      const prev = this.waypoints[idx - 1];
      this.waypoints.push(latlng);
      this.isRouting = true;
      this.fetchOsrmRoute(prev, latlng).then((routePoints) => {
        this.zone.run(() => {
          routePoints.forEach((pt) => this.drawPoints.push(pt));
          this.drawPointCount.set(this.waypoints.length);
          this.updateDrawPreview();
          this.isRouting = false;
        });
      });
    }
  }

  private async fetchOsrmRoute(from: L.LatLng, to: L.LatLng): Promise<L.LatLng[]> {
    try {
      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${from.lng},${from.lat};${to.lng},${to.lat}` +
        `?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates;
      if (Array.isArray(coords)) {
        return coords.map(([lng, lat]) => L.latLng(lat, lng));
      }
    } catch {
      // OSRM no disponible — línea recta de respaldo
    }
    return [from, to];
  }

  private updateDrawPreview(): void {
    this.drawPreview?.remove();
    if (this.drawPoints.length < 2) return;
    this.drawPreview = L.polyline(this.drawPoints, {
      color: '#f59e0b', weight: 3, interactive: false,
    }).addTo(this.map);
  }

  private clearDrawLayers(): void {
    this.drawPreview?.remove();
    this.drawPreview = null;
    this.waypointDots.forEach((d) => d.remove());
    this.waypointDots = [];
    this.drawPoints = [];
    this.waypoints = [];
    this.isRouting = false;
    this.drawPointCount.set(0);
  }

  get polygonZones(): Zone[] { return this.zones.filter((z) => z.type === 'polygon'); }
  get polylineZones(): Zone[] { return this.zones.filter((z) => z.type === 'polyline'); }

  focusLocation(loc: Location): void {
    this.map.flyTo([loc.latitude, loc.longitude], 17, { duration: 0.8 });
    setTimeout(() => this.markers.get(loc._id)?.openPopup(), 900);
  }

  focusZone(zone: Zone): void {
    if (!zone.coordinates.length) return;
    const bounds = L.latLngBounds(zone.coordinates.map(([lat, lng]) => L.latLng(lat, lng)));
    this.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 17, duration: 0.8 });
  }

  openEditModal(loc: Location): void {
    this.editingLocation.set(loc);
    this.pendingLatLng = null;
    this.locationForm.patchValue({
      name: loc.name,
      description: loc.description,
      category: (loc.category as Category)?._id ?? '',
    });
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingLocation.set(null);
    this.pendingLatLng = null;
    this.locationForm.reset();
  }

  saveLocation(): void {
    if (this.locationForm.invalid) return;
    const { name, description, category } = this.locationForm.value;
    const editing = this.editingLocation();

    if (editing) {
      this.locationService.update(editing._id, {
        name: name!,
        description: description ?? '',
        ...(category ? { category } : {}),
      }).subscribe({
        next: (res) => {
          // Actualizar popup del marcador
          const marker = this.markers.get(editing._id);
          marker?.setPopupContent(this.buildPopupContent(res.data));
          this.closeModal();
          this.showSuccess('Ubicación actualizada');
        },
        error: (err) => this.errorMsg = err.error?.message ?? 'Error al actualizar',
      });
    } else if (this.pendingLatLng) {
      const [latitude, longitude] = this.pendingLatLng;
      this.locationService.create({
        name: name!,
        description: description ?? '',
        latitude,
        longitude,
        ...(category ? { category } : {}),
      }).subscribe({
        next: () => { this.closeModal(); this.showSuccess('Ubicación creada'); },
        error: (err) => this.errorMsg = err.error?.message ?? 'Error al crear',
      });
    }
  }

  // ── Reseñas ──────────────────────────────────────────────────────────────

  openReviewModal(target: { _id: string; name: string }, type: 'location' | 'zone'): void {
    this.reviewingTarget.set(target);
    this.reviewTargetType.set(type);
    this.reviewForm.reset({ rating: 5, comment: '' });
    this.showReviewModal.set(true);
  }

  closeReviewModal(): void {
    this.showReviewModal.set(false);
    this.reviewingTarget.set(null);
  }

  setReviewRating(n: number): void {
    this.reviewForm.patchValue({ rating: n });
  }

  saveReview(): void {
    if (this.reviewForm.invalid) return;
    const target = this.reviewingTarget();
    if (!target) return;
    const { rating, comment } = this.reviewForm.value;
    const type = this.reviewTargetType();
    const payload = type === 'location'
      ? { location: target._id, rating: rating!, comment: comment ?? '' }
      : { zone:     target._id, rating: rating!, comment: comment ?? '' };
    this.reviewService.create(payload).subscribe({
      next: () => {
        this.closeReviewModal();
        this.showSuccess('Reseña agregada');
      },
      error: (err) => (this.errorMsg = err.error?.message ?? 'Error al guardar reseña'),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────

  deleteLocation(id: string): void {
    if (!confirm('¿Eliminar esta ubicación?')) return;
    this.locationService.delete(id).subscribe({
      next: () => { this.map.closePopup(); this.showSuccess('Ubicación eliminada'); },
      error: (err) => (this.errorMsg = err.error?.message ?? 'Error al eliminar'),
    });
  }

  deleteZone(id: string): void {
    if (!confirm('¿Eliminar esta zona del mapa?')) return;
    this.zoneService.delete(id).subscribe({
      next: () => {
        this.zones = this.zones.filter((z) => z._id !== id);
        this.zoneLayerGroup.clearLayers();
        this.zones.forEach((z) => this.renderZone(z));
        this.showSuccess('Zona eliminada');
      },
      error: (err) => (this.errorMsg = err.error?.message ?? 'Error al eliminar zona'),
    });
  }

  onSearch(): void {
    this.locationService.loadAll(this.searchQuery || undefined).subscribe();
  }

  private showSuccess(msg: string): void {
    this.successMsg = msg;
    setTimeout(() => (this.successMsg = ''), 3000);
  }
}
