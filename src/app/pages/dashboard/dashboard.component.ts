import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { LocationService } from '../../core/services/location.service';
import { ZoneService } from '../../core/services/zone.service';
import { CategoryService } from '../../core/services/category.service';
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
  searchQuery = '';
  showModal = signal(false);
  editingLocation = signal<Location | null>(null);
  pendingLatLng: [number, number] | null = null;
  errorMsg = '';
  successMsg = '';

  private locationService = inject(LocationService);
  private zoneService = inject(ZoneService);
  private categoryService = inject(CategoryService);
  private fb = inject(FormBuilder);

  locationForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    category: [''],
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
    this.sub?.unsubscribe();
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map('map').setView([21.1236, -101.6822], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    this.zoneLayerGroup.addTo(this.map);

    // Clic en el mapa → abre modal para crear marcador
    this.map.on('click', (e: L.LeafletMouseEvent) => {
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

  deleteLocation(id: string): void {
    if (!confirm('¿Eliminar esta ubicación?')) return;
    this.locationService.delete(id).subscribe({
      next: () => { this.map.closePopup(); this.showSuccess('Ubicación eliminada'); },
      error: (err) => this.errorMsg = err.error?.message ?? 'Error al eliminar',
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
