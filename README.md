# GeoTurismo — Frontend

Aplicación web de turismo georeferenciado desarrollada con Angular 18. Permite visualizar y gestionar ubicaciones turísticas sobre un mapa interactivo, dibujar zonas geográficas, buscar lugares en tiempo real y administrar categorías y reseñas.

**Autor:** José de Jesús Almanza Contreras  
**Versión:** 1.0.0

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Framework | Angular 18 (componentes standalone) |
| Lenguaje | TypeScript (strict mode) |
| Estilos | Tailwind CSS 3 |
| Mapas | Leaflet 1.9 + @geoman-io/leaflet-geoman-free |
| HTTP | HttpClient con interceptor funcional JWT |
| Estado | RxJS BehaviorSubject + Angular Signals |
| Formularios | Angular Reactive Forms |
| Testing E2E | Cypress 13 |

---

## Requisitos previos

- Node.js 18 o superior
- npm 9 o superior
- Backend de GeoTurismo en ejecución (ver `../Backend/README.md`)

---

## Instalación

```bash
# Entrar al directorio
cd Frontend

# Instalar dependencias
npm install
```

---

## Configuración del entorno

La URL base de la API se configura en:

```
src/environments/environment.ts         (desarrollo)
src/environments/environment.prod.ts    (producción)
```

Por defecto apunta a `http://localhost:3000/api`. Modificar este valor si el backend corre en otro host o puerto.

---

## Scripts disponibles

```bash
# Servidor de desarrollo con recarga automática
npm start
# o bien
npx ng serve --port 4200

# Compilar para producción
npm run build

# Ejecutar tests E2E con interfaz gráfica
npx cypress open

# Ejecutar tests E2E en modo headless (CI)
npx cypress run
```

La aplicación queda disponible en `http://localhost:4200`.

---

## Arquitectura

```
src/
  app/
    app.config.ts           Configuración global — provideHttpClient, interceptores, rutas
    app.routes.ts           Definición de rutas con lazy loading y guards
    core/
      guards/
        auth.guard.ts       Guard funcional — redirige a /auth/login si no hay token
      interceptors/
        auth.interceptor.ts Adjunta el Bearer token a cada petición saliente
      services/
        auth.service.ts     Gestión de sesión (signal<User>, localStorage)
        location.service.ts Estado reactivo de ubicaciones (BehaviorSubject)
    pages/
      auth/
        login/              Formulario de inicio de sesión con validación reactiva
        register/           Formulario de registro con validador de contraseñas coincidentes
      dashboard/            Mapa Leaflet, tabla de ubicaciones, búsqueda en tiempo real
      manage/               CRUD de categorías y reseñas con tabs
    shared/
      models/               Interfaces TypeScript (Location, Zone, Category, Review, User)
  environments/             Variables de entorno por perfil
  assets/                   Iconos de marcadores Leaflet
```

---

## Vistas de la aplicación

**Autenticación (`/auth/login`, `/auth/register`)**  
Formularios reactivos con validación en tiempo real. El registro verifica que las contraseñas coincidan antes de habilitar el botón de envío. Ambas rutas son públicas.

**Dashboard (`/dashboard`)**  
Vista principal protegida por el guard de autenticación. Contiene el mapa Leaflet con marcadores de todas las ubicaciones y herramientas para dibujar polígonos y líneas mediante leaflet-geoman. En el panel lateral se muestra la tabla de ubicaciones con contador, campo de búsqueda que filtra en tiempo real contra el API, y acciones de edición y eliminación para usuarios autenticados.

**Gestión (`/manage`)**  
Panel administrativo protegido. Organizado en dos pestañas: Categorías (CRUD completo con nombre, descripción e ícono) y Reseñas (CRUD con calificación de 1 a 5 estrellas y comentario). Ambas tablas muestran el estado actual y permiten crear, editar y eliminar registros.

---

## Flujo de autenticación

1. El usuario inicia sesión en `/auth/login`. El servicio almacena el token JWT en `localStorage`.
2. El interceptor `auth.interceptor.ts` adjunta automáticamente el token a cada petición HTTP saliente mediante la cabecera `Authorization: Bearer <token>`.
3. El guard `auth.guard.ts` verifica la existencia del token antes de activar cualquier ruta protegida. Si no existe, redirige a `/auth/login`.
4. Al cerrar sesión, se eliminan el token y los datos del usuario de `localStorage` y se redirige al login.

---

## Tests E2E con Cypress

La suite contiene 44 tests distribuidos en 4 archivos:

| Archivo | Descripción | Tests |
|---|---|---|
| `smoke/01-login.cy.ts` | Validaciones del formulario de login y flujo completo | 10 |
| `smoke/02-register.cy.ts` | Validaciones del formulario de registro y coincidencia de contraseñas | 10 |
| `smoke/03-dashboard.cy.ts` | Guard de autenticación, carga del mapa, tabla y búsqueda | 14 |
| `security/nosql-injection.cy.ts` | Bloqueo de operadores BSON en la UI y verificación del payload enviado | 10 |

Todos los tests usan `cy.intercept()` para simular respuestas del backend, por lo que se pueden ejecutar sin que el backend esté en ejecución.

**Comandos personalizados:**

| Comando | Descripción |
|---|---|
| `cy.loginMock()` | Establece un token JWT falso en localStorage para simular sesión activa |
| `cy.logoutMock()` | Limpia localStorage para simular sesión cerrada |

```bash
# Abrir Cypress con interfaz gráfica
npx cypress open

# Ejecutar todos los specs en modo headless
npx cypress run
```

---

## Seguridad en la capa de presentación

**Validación de formularios**  
Los formularios reactivos de login y registro usan el validador `Validators.email` de Angular, que rechaza cadenas con operadores BSON como `{"$gt":""}` porque no tienen formato de correo electrónico válido. El botón de envío permanece deshabilitado mientras el formulario sea inválido.

**Payload limpio al API**  
Angular serializa el cuerpo de cada petición HTTP a partir de un objeto TypeScript. Los campos de tipo `string` nunca se convierten en objetos MongoDB, independientemente de lo que escriba el usuario en el formulario.

**Sin exposición de credenciales**  
La respuesta del API nunca contiene el campo `password`. La aplicación no almacena ni muestra contraseñas en ningún estado o vista.

---

## Notas de despliegue

Para una puesta en producción se deben considerar los siguientes puntos:

- Actualizar `src/environments/environment.prod.ts` con la URL real del backend.
- Compilar con `npm run build -- --configuration production`.
- Servir la carpeta `dist/` desde un servidor estático (Nginx, Apache, Firebase Hosting, Vercel, etc.).
- Configurar el servidor para redirigir todas las rutas al `index.html` y así soportar el enrutamiento de Angular (HTML5 history API).
