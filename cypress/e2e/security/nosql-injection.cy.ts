// ============================================================
// SECURITY TESTS — Inyección NoSQL (capas UI + payload)
//
// Estrategia de defensa por capas:
//   Capa 1 — Angular Validators rechaza operadores BSON como email
//   Capa 2 — El formulario no envía payload con objetos BSON
//   Capa 3 — Zod en el backend rechaza cualquier valor no-string
//             (cubierto por los tests Jest en Backend/src/__tests__)
//
// Estos tests verifican las capas 1 y 2 sin necesitar el backend.
// ============================================================

describe('Seguridad — Capa 1: Angular bloquea operadores BSON en el formulario', () => {
  beforeEach(() => {
    cy.logoutMock();
    cy.visit('/auth/login');
  });

  it('rechaza $gt como email: botón permanece deshabilitado', () => {
    cy.get('input[type="email"]').type('{"$gt":""}', { parseSpecialCharSequences: false });
    cy.get('input[type="password"]').type('password123').blur();
    cy.get('button[type="submit"]').should('be.disabled');
  });

  it('rechaza $regex como email: botón permanece deshabilitado', () => {
    cy.get('input[type="email"]').type('{"$regex":".*"}', { parseSpecialCharSequences: false });
    cy.get('input[type="password"]').type('password123').blur();
    cy.get('button[type="submit"]').should('be.disabled');
  });

  it('rechaza $where como email: botón permanece deshabilitado', () => {
    cy.get('input[type="email"]').type('{"$where":"sleep(1000)"}', { parseSpecialCharSequences: false });
    cy.get('input[type="password"]').type('password123').blur();
    cy.get('button[type="submit"]').should('be.disabled');
  });

  it('rechaza inyección estilo SQL (no es email válido): botón deshabilitado', () => {
    cy.get('input[type="email"]').type("admin'--");
    cy.get('input[type="password"]').type('pass').blur();
    cy.get('button[type="submit"]').should('be.disabled');
  });

  it('rechaza operador $ne como email', () => {
    cy.get('input[type="email"]').type('{"$ne":""}', { parseSpecialCharSequences: false });
    cy.get('input[type="password"]').type('password123').blur();
    cy.get('button[type="submit"]').should('be.disabled');
  });

  it('un email válido SÍ habilita el botón (no hay falsos positivos)', () => {
    cy.get('input[type="email"]').type('usuario@valid.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').should('not.be.disabled');
  });
});

describe('Seguridad — Capa 2: payload enviado al API es siempre un string limpio', () => {
  beforeEach(() => {
    cy.logoutMock();
    cy.visit('/auth/login');
  });

  it('el campo email viaja como string válido al API (nunca como objeto BSON)', () => {
    cy.intercept('POST', '/api/auth/login', (req) => {
      // Verificar que el body.email es string y tiene formato de email
      expect(typeof req.body.email).to.eq('string');
      expect(req.body.email).to.include('@'); // es un email real
      // Nunca llegan operadores MongoDB como objeto
      expect(req.body.email).to.not.be.an('object');
      req.reply({ statusCode: 401, body: { error: true, message: 'Test OK' } });
    }).as('loginReq');

    cy.get('input[type="email"]').type('usuario@test.com');
    cy.get('input[type="password"]').type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginReq');
  });

  it('el campo password viaja como string al API (nunca como objeto BSON)', () => {
    cy.intercept('POST', '/api/auth/login', (req) => {
      expect(typeof req.body.password).to.eq('string');
      expect(req.body.password).to.not.be.an('object');
      req.reply({ statusCode: 401, body: { error: true, message: 'Test OK' } });
    }).as('loginReq2');

    cy.get('input[type="email"]').type('usuario@test.com');
    cy.get('input[type="password"]').type('cualquierContraseña123');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginReq2');
  });

  it('la respuesta de error no expone detalles internos (mensaje genérico)', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: 401,
      body: { error: true, message: 'Credenciales inválidas', statusCode: 401 },
    }).as('loginErr');

    cy.get('input[type="email"]').type('x@x.com');
    cy.get('input[type="password"]').type('wrongpass');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginErr');

    // El UI muestra mensaje genérico, no detalles internos
    cy.contains('Credenciales inválidas').should('be.visible');
    cy.get('body').should('not.contain.text', 'MongoError');
    cy.get('body').should('not.contain.text', 'mongodb://');
    cy.get('body').should('not.contain.text', 'stack');
  });
});

describe('Seguridad — Capa 2: registro tampoco expone la contraseña', () => {
  beforeEach(() => {
    cy.logoutMock();
    cy.visit('/auth/register');
  });

  it('la respuesta de registro no devuelve la contraseña al UI', () => {
    cy.intercept('POST', '/api/auth/register', (req) => {
      // Verificar que el body tiene todos los campos esperados como strings
      expect(typeof req.body.name).to.eq('string');
      expect(typeof req.body.email).to.eq('string');
      expect(typeof req.body.password).to.eq('string');
      req.reply({
        statusCode: 201,
        body: { success: true, data: { id: 'abc', name: 'Juan', email: 'juan@test.com' } },
      });
    }).as('registerOk');

    cy.get('input[type="text"]').type('Juan Pérez');
    cy.get('input[type="email"]').type('juan@test.com');
    cy.get('input[type="password"]').eq(0).type('password123');
    cy.get('input[type="password"]').eq(1).type('password123');
    cy.get('button[type="submit"]').click();
    cy.wait('@registerOk');

    // La respuesta no tiene campo password — el UI no lo muestra
    cy.get('body').should('not.contain.text', 'password123');
  });
});
