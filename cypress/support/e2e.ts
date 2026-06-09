// Archivo de soporte de Cypress — se carga antes de cada spec
import './commands';

// Ignorar errores de Leaflet que no son relevantes para las pruebas de UI
Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver') || err.message.includes('leaflet')) {
    return false;
  }
  return true;
});
