// ============================================================
// SMOKE TESTS — Dashboard y navegación protegida
// ============================================================

const mockLocations = [
  { _id: 'loc1', name: 'Plaza Mayor', description: 'Centro histórico', latitude: 4.711, longitude: -74.072, createdAt: new Date().toISOString() },
  { _id: 'loc2', name: 'Parque Simón Bolívar', description: 'Parque urbano', latitude: 4.658, longitude: -74.093, createdAt: new Date().toISOString() },
];

describe('Smoke — Guard de autenticación', () => {
  it('redirige a /auth/login si el usuario no está autenticado', () => {
    cy.logoutMock();
    cy.visit('/dashboard');
    cy.url().should('include', '/auth/login');
  });

  it('redirige a /auth/login si intenta acceder a /manage sin auth', () => {
    cy.logoutMock();
    cy.visit('/manage');
    cy.url().should('include', '/auth/login');
  });
});

describe('Smoke — Dashboard (autenticado)', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/locations*', { success: true, data: mockLocations }).as('getLocations');
    cy.intercept('GET', '/api/zones*', { success: true, data: [] }).as('getZones');
    cy.loginMock();
    cy.visit('/dashboard');
    cy.wait('@getLocations');
  });

  it('carga el navbar con el nombre de la app', () => {
    cy.contains('GeoTurismo').should('be.visible');
  });

  it('muestra el enlace al mapa en el navbar', () => {
    cy.contains('Mapa').should('be.visible');
  });

  it('muestra el enlace a gestión en el navbar', () => {
    cy.contains('Gestión').should('be.visible');
  });

  it('muestra el nombre del usuario logueado en el navbar', () => {
    cy.contains('Demo User').should('be.visible');
  });

  it('muestra el botón de cerrar sesión', () => {
    cy.contains('Cerrar sesión').should('be.visible');
  });

  it('muestra el input de búsqueda', () => {
    cy.get('input[placeholder*="Buscar"]').should('be.visible');
  });

  it('muestra el contenedor del mapa Leaflet', () => {
    cy.get('#map').should('exist');
  });

  it('muestra la tabla con las ubicaciones cargadas', () => {
    cy.contains('Plaza Mayor').should('be.visible');
    cy.contains('Parque Simón Bolívar').should('be.visible');
  });

  it('muestra el contador de ubicaciones', () => {
    cy.contains('2 ubicaciones').should('be.visible');
  });

  it('al buscar filtra las ubicaciones en tiempo real', () => {
    // Interceptar TODAS las peticiones de locations con ?name= para devolver 1 resultado
    cy.intercept('GET', '/api/locations?name=*', {
      success: true,
      data: [mockLocations[0]],
    }).as('searchAny');

    cy.get('input[placeholder*="Buscar"]').clear().type('plaza');
    cy.wait('@searchAny');
    cy.contains('1 ubicaciones').should('be.visible');
  });

  it('cierra sesión y redirige al login', () => {
    cy.contains('Cerrar sesión').click();
    cy.url().should('include', '/auth/login');
  });

  it('navega a /manage al hacer clic en Gestión', () => {
    cy.intercept('GET', '/api/categories*', { success: true, data: [] });
    cy.intercept('GET', '/api/reviews*', { success: true, data: [] });
    cy.intercept('GET', '/api/locations*', { success: true, data: [] });
    cy.contains('Gestión').click();
    cy.url().should('include', '/manage');
  });
});
