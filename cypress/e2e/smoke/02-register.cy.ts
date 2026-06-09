// ============================================================
// SMOKE TESTS — Vista de Registro
// ============================================================

describe('Smoke — Página de Registro', () => {
  beforeEach(() => {
    cy.logoutMock();
    cy.visit('/auth/register');
  });

  it('carga la página con el título GeoTurismo', () => {
    cy.contains('GeoTurismo').should('be.visible');
    cy.contains('Crea tu cuenta').should('be.visible');
  });

  it('muestra todos los campos del formulario', () => {
    cy.get('input[type="text"]').should('be.visible');    // nombre
    cy.get('input[type="email"]').should('be.visible');   // email
    cy.get('input[type="password"]').should('have.length', 2); // password + confirm
  });

  it('muestra el botón "Crear cuenta"', () => {
    cy.get('button[type="submit"]').contains('Crear cuenta').should('be.visible');
  });

  it('el botón está deshabilitado si el formulario está incompleto', () => {
    cy.get('input[type="email"]').type('solo@email.com');
    cy.get('button[type="submit"]').should('be.disabled');
  });

  it('muestra error si el nombre es demasiado corto', () => {
    cy.get('input[type="text"]').type('A');
    cy.get('input[type="email"]').click(); // blur
    cy.contains('al menos 2 caracteres').should('be.visible');
  });

  it('muestra error si la contraseña tiene menos de 6 caracteres', () => {
    cy.get('input[type="password"]').first().type('123');
    cy.get('input[type="email"]').click(); // blur
    cy.contains('al menos 6 caracteres').should('be.visible');
  });

  it('muestra error si las contraseñas no coinciden', () => {
    cy.get('input[type="text"]').type('Juan Pérez');
    cy.get('input[type="email"]').type('juan@example.com');
    cy.get('input[type="password"]').eq(0).type('password123');
    cy.get('input[type="password"]').eq(1).type('diferente456');
    // Blur el campo para activar el estado touched y mostrar el error
    cy.get('input[type="password"]').eq(1).blur();
    cy.contains('no coinciden').should('be.visible');
  });

  it('redirige a login tras un registro exitoso', () => {
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 201,
      body: { success: true, data: { id: 'abc', name: 'Juan', email: 'juan@test.com' } },
    }).as('registerOk');

    cy.get('input[type="text"]').type('Juan Pérez');
    cy.get('input[type="email"]').type('juan@test.com');
    cy.get('input[type="password"]').eq(0).type('password123');
    cy.get('input[type="password"]').eq(1).type('password123');
    cy.get('button[type="submit"]').click();

    cy.wait('@registerOk');
    cy.url().should('include', '/auth/login');
  });

  it('muestra error cuando el email ya está registrado', () => {
    cy.intercept('POST', '/api/auth/register', {
      statusCode: 409,
      body: { error: true, message: 'El correo ya está registrado', statusCode: 409 },
    }).as('registerConflict');

    cy.get('input[type="text"]').type('Otro Usuario');
    cy.get('input[type="email"]').type('existente@test.com');
    cy.get('input[type="password"]').eq(0).type('password123');
    cy.get('input[type="password"]').eq(1).type('password123');
    cy.get('button[type="submit"]').click();

    cy.wait('@registerConflict');
    cy.contains('ya está registrado').should('be.visible');
  });

  it('el enlace "Inicia sesión" navega al login', () => {
    cy.contains('Inicia sesión').click();
    cy.url().should('include', '/auth/login');
  });
});
