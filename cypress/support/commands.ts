// Comandos personalizados de Cypress para GeoTurismo

/**
 * Simula un login completo usando cy.intercept para no depender del backend.
 * Guarda el token falso en localStorage tal como lo haría la app real.
 */
Cypress.Commands.add('loginMock', () => {
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
    'eyJpZCI6IjY0YTFiMmMzZDRlNWY2YTdiOGM5ZDBhMSIsImVtYWlsIjoiZGVtb0BleGFtcGxlLmNvbSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ.' +
    'dummysignature';
  const fakeUser = { id: '64a1b2c3d4e5f6a7b8c9d0a1', name: 'Demo User', email: 'demo@example.com' };

  localStorage.setItem('token', fakeToken);
  localStorage.setItem('user', JSON.stringify(fakeUser));
});

/** Limpia el localStorage (logout). */
Cypress.Commands.add('logoutMock', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
});

// Extender el tipado de Cypress para los comandos personalizados
declare global {
  namespace Cypress {
    interface Chainable {
      loginMock(): Chainable<void>;
      logoutMock(): Chainable<void>;
    }
  }
}
