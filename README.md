# TaskFlow IA

Aplicación para administrar tareas personales y de equipos de trabajo, con sugerencias de IA,
sincronización con Google Calendar y automatizaciones con n8n.

> **Estado:** en desarrollo. El front-end funciona de forma independiente (datos en el navegador).
> El backend y las integraciones están escritos y probados con pruebas unitarias, pero **todavía no
> hay un servidor HTTP** que los conecte con la web.

## Estructura

```
├─ web/                    Front-end (HTML, CSS y JavaScript, sin dependencias)
├─ src/                    Backend en TypeScript
│  ├─ env.ts / config.ts   Lectura de variables de entorno y configuración
│  ├─ errors.ts            Error base (AppError) y errores de la IA
│  ├─ integrations/        claude/ y google/ (clientes de APIs externas)
│  ├─ services/            Lógica de negocio (IA, sincronización con Calendar)
│  ├─ prompts/             Plantillas y esquemas de respuesta de la IA
│  └─ examples/            Scripts de demostración
├─ db/migrations/          Esquema PostgreSQL, en orden: 001, 002, 003…
├─ scripts/                Herramientas (verificación de migraciones)
├─ docs/                   Documentación (diagramas de secuencia)
├─ examples/n8n-webhook/   Prototipo de formulario que llama a un webhook de n8n
└─ .github/workflows/      Integración continua
```

## Puesta en marcha

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run check        # lint + tipos + pruebas + migraciones SQL
```

| Comando | Qué hace |
|---|---|
| `npm run lint` | Análisis estático con ESLint (errores reales y reglas de seguridad) |
| `npm run typecheck` | Comprueba los tipos de TypeScript |
| `npm test` | Ejecuta las pruebas unitarias |
| `npm run db:check` | Aplica `db/migrations/*.sql` en un PostgreSQL en memoria y verifica las restricciones |
| `npm run demo` | Prueba de la integración con Claude (necesita `.env`) |

**Front-end:** abre `web/index.html` con doble clic.
**Diagramas:** abre `docs/secuencias.html` (necesita internet para dibujarlos).

## Configuración

Copia `.env.example` a `.env` y completa los valores. **Nunca subas `.env` al repositorio**
(ya está en `.gitignore`). Las claves y tokens solo deben vivir en variables de entorno.

## Siguientes pasos

1. API HTTP: `POST/PATCH/DELETE /tasks` que escriba en PostgreSQL y en `automation_events`.
2. Migrar el front-end de `localStorage` a esa API (solo cambia `web/js/storage.js`).
3. Entorno reproducible con `docker-compose` (PostgreSQL, API y n8n).
4. Workflows de n8n exportados a `n8n/workflows/` y autenticación de webhooks.
