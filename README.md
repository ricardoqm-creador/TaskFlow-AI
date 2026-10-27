<div align="center">

<img src="web/assets/logo.svg" alt="Logotipo de TaskFlow IA" width="96" height="96">

# TaskFlow IA

**Gestión de tareas personales y de equipos, con asistencia de IA y automatizaciones.**

[![CI](https://github.com/ricardoqm-creador/TaskFlow-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/ricardoqm-creador/TaskFlow-AI/actions/workflows/ci.yml)
![Versión](https://img.shields.io/badge/versi%C3%B3n-0.1.0-d4af37)
![Node](https://img.shields.io/badge/node-24.x-3a4150)
![Estado](https://img.shields.io/badge/estado-prototipo-c4cad4)
![Licencia](https://img.shields.io/badge/licencia-MIT-d4af37)

[**Ver demo**](https://taskflow-ai-opal.vercel.app) · [Alcance de la entrega](docs/ALCANCE.md) · [Arquitectura](docs/secuencias.html) · [Informes técnicos](docs/)

</div>

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Características principales](#características-principales)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Requisitos](#requisitos)
- [Instalación y ejecución](#instalación-y-ejecución)
- [Estructura de carpetas](#estructura-de-carpetas)
- [Integraciones](#integraciones)
- [Despliegue](#despliegue)
- [Capturas sugeridas](#capturas-sugeridas)
- [Hoja de ruta](#hoja-de-ruta)
- [Autor](#autor)
- [Licencia](#licencia)

---

## Descripción

**TaskFlow IA** es una aplicación web para organizar tareas personales y de equipos de trabajo. Combina un panel de control con estadísticas en tiempo real, un registro de tareas con prioridades, responsables y fechas límite, y una arquitectura preparada para integrar **inteligencia artificial** (sugerencia de subtareas y prioridades), **Google Calendar** y **automatizaciones con n8n**.

Su identidad visual, de estilo futurista, se basa únicamente en **dorado, plateado y blanco**.

> **Estado del proyecto: prototipo (v0.1.0).** El front-end es funcional de forma independiente y guarda los datos en el navegador. El backend y las integraciones están implementados como módulos probados, pero todavía **no hay un servidor HTTP** que los conecte con la web. El detalle de lo incluido y lo pendiente está en el [documento de alcance](docs/ALCANCE.md) y en la [hoja de ruta](#hoja-de-ruta).

---

## Características principales

### Disponibles en la web

| Característica | Detalle |
|---|---|
| 📊 **Dashboard** | Tarjetas de Tareas totales, Pendientes, En progreso y Completadas, con contador de vencidas y porcentaje completado |
| ✅ **Gestión de tareas** | Crear (con validación), cambiar de estado y eliminar con confirmación |
| 🔎 **Búsqueda y filtros** | Por título, descripción o responsable, y por estado |
| ⏰ **Vencimientos** | Las tareas con fecha pasada y sin completar se marcan como "Vencida" |
| 🧪 **Simulación de automatizaciones** | Muestra, paso a paso, qué harían el backend, n8n y los servicios externos al crear, completar o eliminar una tarea (incluye un modo con fallo de Google Calendar) |
| 📱 **Diseño responsive** | Menú lateral deslizable en tableta y tabla convertida en tarjetas en móvil |
| ♿ **Accesibilidad** | HTML semántico, diálogos nativos, foco visible, contraste ≥ 4,5:1 y respeto de `prefers-reduced-motion` |
| ⚡ **Rendimiento** | Al cambiar una tarea solo se actualiza su fila; la compilación de producción carga 1 CSS y 1 JS minificados |

### Implementadas en el backend (módulos probados, sin servidor todavía)

- 🤖 **Sugerencias con IA** (Claude): subtareas, prioridad y estimación, con salida validada y revisión humana.
- 📅 **Sincronización con Google Calendar**: OAuth 2.0, eventos de día completo y tokens cifrados.
- 🗄️ **Esquema PostgreSQL** de 17 tablas con restricciones verificadas, incluida una cola de eventos para automatizaciones.

---

## Tecnologías utilizadas

| Capa | Tecnología |
|---|---|
| **Front-end** | HTML5, CSS3 (variables, Grid, Flexbox), JavaScript sin framework |
| **Backend** | Node.js 24, TypeScript (modo estricto) |
| **Validación** | Zod |
| **Base de datos** | PostgreSQL (verificado con PGlite en las pruebas) |
| **Inteligencia artificial** | API de Claude (`@anthropic-ai/sdk`) |
| **Integraciones** | Google Calendar API (`googleapis`), n8n |
| **Calidad** | ESLint, `node:test`, `tsx`, `.editorconfig` |
| **Compilación** | esbuild |
| **CI / despliegue** | GitHub Actions, Vercel |

---

## Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org/) | **24.x** (ver `.nvmrc`) | Pruebas, compilación y backend |
| npm | Incluido con Node.js | Dependencias |
| Navegador moderno | Chrome, Edge, Firefox o Safari recientes | Ejecutar la web |
| Git | Cualquier versión reciente | Clonar el repositorio |

Opcionales, para las integraciones:
- Una **clave de API de Anthropic** (sugerencias de IA).
- **Credenciales OAuth de Google Cloud** (Google Calendar).
- **n8n** (automatizaciones).

---

## Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/ricardoqm-creador/TaskFlow-AI.git
cd TaskFlow-AI
```

### 2. Ver la web (sin instalar nada)

Abre `web/index.html` con doble clic. La aplicación funciona directamente en el navegador.

### 3. Instalar dependencias

```bash
npm install
```

### 4. Comprobar que todo funciona

```bash
npm run check
```

Ejecuta el análisis estático, la comprobación de tipos, las pruebas y la verificación del esquema SQL.

### 5. Configurar las integraciones (opcional)

```bash
cp .env.example .env
```

Completa los valores en `.env`. **Nunca subas `.env` al repositorio**: está incluido en `.gitignore`.

| Variable | Uso |
|---|---|
| `ANTHROPIC_API_KEY` | Clave de la API de Claude |
| `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_MAX_OUTPUT_TOKENS`, `AI_MAX_INPUT_CHARS` | Ajustes de la IA (tienen valores por defecto) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | OAuth de Google Calendar |
| `TOKEN_ENCRYPTION_KEY` | Clave de 32 bytes en base64 para cifrar los tokens |

### Comandos disponibles

| Comando | Descripción |
|---|---|
| `npm run lint` | Análisis estático con ESLint |
| `npm run typecheck` | Comprobación de tipos de TypeScript |
| `npm test` | Pruebas unitarias del backend y de la web |
| `npm run db:check` | Aplica las migraciones en un PostgreSQL en memoria y verifica las restricciones |
| `npm run check` | Todo lo anterior |
| `npm run build:web` | Versión de producción de la web en `dist/web` |
| `npm run build` | Compila el backend en `dist/api` |
| `npm run demo` | Prueba manual de la integración con Claude (requiere `.env`) |

---

## Estructura de carpetas

```
TaskFlow-AI/
├── web/                         Aplicación web (sin dependencias)
│   ├── index.html
│   ├── assets/                  Logotipo
│   ├── css/
│   │   ├── variables.css        Paleta, tipografía y espaciado
│   │   ├── base.css · layout.css · responsive.css · simulation.css
│   │   └── components/          navigation · controls · stats · table · dialogs
│   └── js/
│       ├── core/                Utilidades, persistencia y estado (sin DOM)
│       ├── components/          Badge, StatCard, Dialog, Toast
│       ├── features/            stats, taskTable, taskDialog, simulation
│       └── app.js               Arranque
├── src/                         Backend en TypeScript
│   ├── env.ts · config.ts · errors.ts
│   ├── integrations/
│   │   ├── claude/              Cliente de la API de Claude
│   │   └── google/              OAuth, Calendar y cifrado de tokens
│   ├── services/                Sugerencias de IA y sincronización con Calendar
│   ├── prompts/                 Plantillas y esquemas de respuesta de la IA
│   └── examples/                Scripts de demostración
├── db/migrations/               Esquema PostgreSQL (001, 002, 003)
├── tests/web/                   Pruebas de la web
├── scripts/                     Compilación de la web y verificación del esquema
├── docs/                        Diagramas de secuencia e informes técnicos
├── examples/n8n-webhook/        Prototipo de formulario hacia un webhook de n8n
├── .github/workflows/ci.yml     Integración continua
└── vercel.json                  Configuración de despliegue
```

---

## Integraciones

| Integración | Estado | Descripción |
|---|---|---|
| **GitHub + GitHub Actions** | ✅ Activa | Repositorio, ramas con *pull requests* y CI con lint, tipos, pruebas, verificación SQL y compilación |
| **Vercel** | ✅ Activa | Despliegue automático en cada *push*: producción desde `main` y vista previa por rama |
| **Claude (Anthropic)** | 🧩 Módulo probado | Sugerencias de subtareas y prioridad con salida validada; errores traducidos a códigos propios |
| **Google Calendar** | 🧩 Módulo probado | OAuth 2.0 con permiso mínimo (`calendar.events`), eventos idempotentes y tokens cifrados con AES-256-GCM |
| **n8n** | 🧪 Prototipo | Flujo de webhook de ejemplo en `examples/n8n-webhook/`; automatizaciones diseñadas en [docs/secuencias.html](docs/secuencias.html) |
| **PostgreSQL** | 🧩 Esquema verificado | 17 tablas y cola `automation_events`; falta la capa de acceso desde la API |

**Leyenda:** ✅ en funcionamiento · 🧩 implementado y probado, pendiente de conectar · 🧪 prototipo

---

## Despliegue

La aplicación se publica en **Vercel**. La configuración está en `vercel.json`:

| Ajuste | Valor |
|---|---|
| Instalación | `npm ci` |
| Compilación | `npm run build:web` |
| Carpeta publicada | `dist/web` |
| Seguridad | Content-Security-Policy, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy` |
| Caché | Un año e `immutable` para los recursos con huella (`assets/app.*`) |

En el panel de Vercel, *Root Directory* debe quedar en la raíz del repositorio para que se lea `vercel.json`.

---

## Capturas sugeridas

Guarda las imágenes en `docs/capturas/` y enlázalas en esta sección:

| # | Captura | Qué debe mostrar |
|---|---|---|
| 1 | `dashboard-escritorio.png` | Vista completa en escritorio: menú lateral, tarjetas de estadísticas y tabla |
| 2 | `nueva-tarea.png` | Diálogo de nueva tarea, idealmente con el mensaje de validación del título |
| 3 | `filtros-busqueda.png` | Filtro "Completadas" activo y una búsqueda aplicada |
| 4 | `tarea-vencida.png` | Una fila con la insignia "Vencida" |
| 5 | `simulacion.png` | Panel de simulación tras crear una tarea, con el modo de fallo activado |
| 6 | `movil.png` | Vista en móvil: menú deslizable y tareas en formato de tarjeta |
| 7 | `diagrama-secuencia.png` | Uno de los diagramas de `docs/secuencias.html` |

```markdown
![Dashboard de TaskFlow IA](docs/capturas/dashboard-escritorio.png)
```

---

## Hoja de ruta

- [ ] Edición de tareas y opción de deshacer al eliminar
- [ ] API HTTP con PostgreSQL y autenticación
- [ ] Worker de eventos y webhooks firmados hacia n8n
- [ ] Conectar las sugerencias de IA y Google Calendar con la web
- [ ] Paginación, orden de columnas y vistas de Equipos y Calendario
- [ ] Fuentes alojadas localmente y mejoras de la vista móvil

Los detalles están en los informes de [`docs/`](docs/).

---

## Autor

**Ricardo** — [@ricardoqm-creador](https://github.com/ricardoqm-creador)

Proyecto desarrollado durante el curso de Claude Code.

---

## Licencia

Distribuido bajo la **licencia MIT**. Consulta el archivo [`LICENSE`](LICENSE).

Permite usar, copiar, modificar y distribuir el código, también con fines comerciales, siempre que se conserve el aviso de copyright. El software se entrega "tal cual", sin garantías.
