// ============================================================
// SMOKE TESTS — Vista de Login
// Verifican que la página carga, muestra los elementos esperados
// y que las validaciones de formulario funcionan correctamente.
// El backend está mockeado con cy.intercept().
// ============================================================

describe('Smoke — Página de Login', () => {
  beforeEach(() => {
    cy.logoutMock();
    cy.visit('/auth/login');
  });

  it('carga la página con el título GeoTurismo', () => {
    cy.contains('GeoTurismo').should('be.visible');
    cy.contains('Inicia sesión para continuar').should('be.visible');
  });

  it('muestra el campo de email', () => {
    cy.get('input[type="email"]').should('be.visible');
  });

  it('muestra el campo de contraseña', () => {
    cy.get('input[type="password"]').should('be.visible');
  });

  it('muestra el botón "Iniciar sesión"', () => {
    cy.get('button[type="submit"]').contains('Iniciar sesión').should('be.visible');
  });

  it('muestra el enlace para registrarse', () => {
    cy.contains('Regístrate').should('be.visible').and('have.attr', 'href', '/auth/register');
  });

  it('el botón está deshabilitado mientras el formulario esté vacío', () => {
    // Con ambos campos vacíos el formulario es inválido → botón disabled
    cy.get('button[type="submit"]').should('be.disabled');
  });

  it('muestra mensaje de error cuando el email tiene formato inválido', () => {
    cy.get('input[type="email"]').type('no-es-un-email');
    cy.get('input[type="password"]').click(); // blur para activar validación
    cy.contains('Ingresa un correo válido').should('be.visible');
  });

  it('el botón está habilitado cuando ambos campos tienen valores válidos', () => {
    cy.get('input[type="email"]').type('usuario@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').should('not.be.disabled');
  });

  it('muestra error de servidor cuando el backend responde 401', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { error: true, message: 'Credenciales inválidas', statusCode: 401 },
    }).as('loginFailed');

    cy.get('input[type="email"]').type('wrong@example.com');
    cy.get('input[type="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginFailed');
    cy.contains('Credenciales inválidas').should('be.visible');
  });

  it('redirige al dashboard cuando el login es exitoso', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          token: 'fake-jwt-token.valid.signature',
          user: { id: 'uid123', name: 'Demo User', email: 'demo@example.com' },
        },
      },
    }).as('loginOk');

    // Mock para que el dashboard no cargue datos reales
    cy.intercept('GET', '/api/locations*', { success: true, data: [] }).as('getLocations');
    cy.intercept('GET', '/api/zones*', { success: true, data: [] }).as('getZones');

    cy.get('input[type="email"]').type('demo@example.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.wait('@loginOk');
    cy.url().should('include', '/dashboard');
  });
});
