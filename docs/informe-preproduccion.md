# Informe de preparación para producción — TaskFlow IA v0.1.0

**Fecha:** 27 de octubre de 2026
**Versión analizada:** etiqueta `v0.1.0` (publicada en GitHub, rama `main` sincronizada)
**Método:** análisis estático automatizado (clases, variables, identificadores, iconos y exportaciones sin uso; bloques duplicados; recursos), puertas de calidad (`eslint`, `tsc` estricto, 52 pruebas, verificación de migraciones), `npm audit`, `npm outdated` y revisión del repositorio remoto.

---

## 1. Veredicto

| Escenario | ¿Preparado? |
|---|---|
| **Producción con usuarios reales** | ❌ **No.** No existen backend, autenticación ni base de datos conectada |
| **Demostración pública del front-end** (sitio estático) | ⚠️ **Casi**, tras las mejoras de prioridad alta de la sección 9 |
| **Repositorio público como base de desarrollo** | ✅ **Sí.** Publicado, sin secretos y con las puertas de calidad en verde |

La calidad del código es alta; lo que separa el proyecto de la producción es **funcionalidad que aún no existe** y **configuración de despliegue**, no defectos del código actual.

---

## 2. Estado de las puertas de calidad

| Comprobación | Resultado |
|---|---|
| ESLint | ✅ 0 errores, 0 avisos |
| TypeScript estricto (incluye variables y parámetros sin usar) | ✅ 0 errores |
| Pruebas | ✅ 52 de 52 |
| Migraciones SQL (17 tablas, 14 restricciones) | ✅ Todas pasan |
| Cobertura de líneas | 82,6 % |
| `npm audit` | ⚠️ 4 vulnerabilidades moderadas |
| Repositorio remoto | ✅ Publicado, con etiqueta `v0.1.0` |

---

## 3. Organización de archivos

**Bien resuelto:** web en `core/` · `components/` · `features/`; backend por responsabilidad; migraciones numeradas; pruebas junto al código y en `tests/`; documentación en `docs/`.

| Hallazgo | Recomendación |
|---|---|
| Código de producto, de demostración y de herramientas conviven sin separación de despliegue (`examples/`, `src/examples/`, panel de simulación) | Definir qué se despliega: un paso de compilación que publique solo `web/` sin la simulación, o mover la simulación detrás de una bandera de desarrollo |
| `tsconfig.json` incluye todo `src/`: **`npm run build` emite 6 archivos de prueba** (19 en total) a `dist/` | Añadir `"exclude": ["src/**/*.test.ts", "src/examples/**"]` en un `tsconfig.build.json` |
| No hay estructura de despliegue (`Dockerfile`, `docker-compose.yml`, `.nvmrc`) | Añadirla cuando exista el backend; `.nvmrc` ya (Node 22 LTS) |

---

## 4. Código duplicado

| Hallazgo | Estado | Recomendación |
|---|---|---|
| Bloques CSS idénticos | ✅ Ninguno | — |
| `requireEnv` y clases de error duplicadas | ✅ Resuelto (`env.ts`, `AppError`) | — |
| **Catálogos y límites repetidos** en web, Zod y SQL (prioridades, estados, longitud del título: 120 en la web, 200 en SQL y TypeScript) | ⚠️ Abierto | Un módulo compartido como única fuente; prueba que compare los tres |
| 29 colores escritos a mano fuera de `variables.css` (sobre todo sombras `rgba`) | ⚠️ Menor | Convertirlos en variables (`--shadow-gold`, etc.) |
| 125 textos de interfaz dentro del JS | ⚠️ Menor | Módulo de textos (`i18n/es.js`) |

---

## 5. Archivos innecesarios en producción

| Archivo | Motivo | Recomendación |
|---|---|---|
| `examples/n8n-webhook/` (`app.js`, `nueva-tarea.html`) | Prototipo que llama a un webhook **sin autenticación y con CORS abierto** | Excluir del despliegue; mantener solo como documentación |
| `web/js/features/simulation.js` + `web/css/simulation.css` (≈ 15 KB, 16 % de la web) | Herramienta didáctica que no ejecuta nada real | Bandera de desarrollo o compilación sin ellos |
| `src/examples/demo.ts` | Script de prueba manual | Excluir de la compilación |
| `.claude/launch.json` | Configuración del entorno de desarrollo (usa `npx --yes` sin versión) | Mantener en el repositorio si es útil, nunca desplegar; fijar la versión de `serve` |
| `.mcp.json` | Configuración de herramientas de desarrollo (sin secretos) | Igual: no desplegar |
| `docs/secuencias.html` | Carga Mermaid desde una CDN sin SRI | Documentación, no producción |

---

## 6. Variables y código sin utilizar

| Elemento | Resultado |
|---|---|
| Clases CSS sin uso | ✅ Ninguna |
| Variables CSS sin uso | ✅ Ninguna |
| Identificadores del HTML sin referencia | ✅ Ninguno |
| Iconos del sprite sin uso | ✅ Ninguno (17 de 17 usados) |
| Variables y parámetros TS sin usar | ✅ Ninguno (`tsc --noUnusedLocals --noUnusedParameters`) |
| Funciones exportadas sin uso externo | ⚠️ `utils.todayISO` (solo se usa dentro de `utils.js`) |

**Recomendación:** dejar de exportar `todayISO`. Es el único resto detectado.

---

## 7. Errores potenciales

| # | Riesgo | Dónde | Recomendación |
|---|---|---|---|
| P1 | 🟠 **Catálogo de prioridades incoherente:** la IA puede devolver `urgent`, que la web no sabe mostrar | `src/prompts/suggestionPrompts.ts:18` vs `web/js/core/store.js:16` | Decidir si existe "urgente" y alinear web, Zod y SQL |
| P2 | 🟠 **Delimitador del prompt evadible** (`</task >`, `<task attr>`) y campos sin limpiar (`currentPriority`, `dueDate`) | `suggestionPrompts.ts` | Escapar `<` y `>` en todos los campos; validar los que no son texto libre |
| P3 | 🟡 La web acepta fechas inexistentes (`2026-02-30`): solo comprueba el formato | `web/js/core/store.js:50` | Validar fecha real, como hace el backend |
| P4 | 🟡 `eventIdForTask` no valida el ID (`NaN`, negativos o decimales generan IDs inválidos para Google) | `calendarClient.ts:24` | Exigir entero positivo seguro |
| P5 | 🟡 `replaceChildren(...filas)` lanza `RangeError` por encima de ~100.000 filas | `web/js/features/taskTable.js` | Paginación (resuelve también el rendimiento) |
| P6 | 🟡 Si `localStorage` no puede guardar, el usuario no se entera | `web/js/core/storage.js` | Aviso visible "No se pudo guardar" |
| P7 | 🟡 Desconectar Google no revoca el token; el `state` de OAuth no se verifica dentro del servicio | `calendarSync.service.ts` | `revokeToken` al desconectar; verificar `state` en el servicio |
| P8 | 🟢 La simulación muestra IDs de evento con formato distinto al real | `simulation.js` | Alinear con `eventIdForTask` |

---

## 8. Recursos no optimizados

| Hallazgo | Impacto | Recomendación |
|---|---|---|
| **23 peticiones** para cargar la página (11 CSS, 12 JS) **+ fuentes externas**, sin minificar ni empaquetar | Más latencia en redes lentas | Paso de compilación (por ejemplo Vite): empaquetar, minificar, nombres con huella y caché larga |
| Fuentes cargadas desde Google, sin SRI | Dependencia externa y privacidad (envía la IP del visitante) | Alojarlas localmente, solo los pesos usados, con `preload` |
| 10 reglas `backdrop-filter` y una animación continua de 760 px | Coste de GPU en móviles modestos (no medido) | Desenfoque solo en encabezado y diálogo; pausar la animación cuando la pestaña no está visible |
| Dibujado completo de la tabla sin paginar: ~170 ms con 2.000 tareas y ~1,3 s con 10.000 (navegador de pruebas) | Lentitud con listas grandes | Paginación de 25-50 filas |
| Sin compresión configurada | ~93 KB sin comprimir | `gzip`/`brotli` en el servidor o CDN |
| Un estilo en línea (sprite SVG) | Obliga a permitir `unsafe-inline` en una CSP | Moverlo a una clase CSS |

**Ya optimizado:** actualización por fila (cambiar una tarea con 2.000 tareas: ~3 ms), formateador de fechas reutilizado y estadísticas en una sola pasada.

---

## 9. Buenas prácticas de desarrollo

| Práctica | Estado |
|---|---|
| Control de versiones, etiqueta de versión, repositorio publicado | ✅ |
| ESLint, `.editorconfig`, TypeScript estricto | ✅ |
| Pruebas automáticas y verificación del esquema | ✅ |
| CI definido (lint, tipos, pruebas, migraciones) | ✅ Definido · ⚠️ confirmar que se ejecutó en verde en GitHub (pestaña *Actions*) |
| `LICENSE` | ❌ **Falta** (sin licencia, nadie puede reutilizar el código legalmente) |
| `SECURITY.md`, `CODEOWNERS`, `CONTRIBUTING.md`, `CHANGELOG.md` | ❌ Faltan |
| Dependabot y `npm audit` en CI | ❌ Faltan |
| Acciones de GitHub fijadas por SHA | ❌ Fijadas por etiqueta (`@v4`) |
| Protección de la rama `main` | ❌ Sin proteger |
| Formateador automático (Prettier) | ❌ Falta |
| Content-Security-Policy y cabeceras de seguridad | ❌ Faltan |
| Correo de autor en los *commits* | ⚠️ Los *commits* publicados usan un correo personal; para los siguientes conviene el correo `noreply` de GitHub |

**Dependencias desactualizadas**

| Paquete | Actual | Última | Comentario |
|---|---|---|---|
| `googleapis` | 144 | 188 | **Resuelve las 4 vulnerabilidades**; cambio mayor: probar antes |
| `@anthropic-ai/sdk` | 1.1.0 | 1.3.0 | Menor: actualización recomendada |
| `typescript-eslint` | 8.72.0 | 8.72.1 | Parche |
| `@electric-sql/pglite` | 0.3 | 0.5 | Solo desarrollo |
| `typescript` | 5.9 | 7.0 | Cambio mayor: evaluar aparte |
| `@types/node` | 22 | 26 | Mantener alineado con la versión de Node usada |

---

## 10. Mejoras recomendadas antes de publicar

### 🔴 Prioridad alta (bloqueantes)

| # | Mejora | Para qué |
|---|---|---|
| 1 | Añadir `LICENSE` | Permitir legalmente el uso del código |
| 2 | Excluir del despliegue `examples/`, la simulación y `src/examples/` | No publicar un webhook abierto ni código de demostración |
| 3 | Resolver P1 (prioridad `urgent`) y P2 (escapado del prompt) | Evitar datos que la interfaz no sabe mostrar y la manipulación de la IA |
| 4 | Content-Security-Policy y fuentes locales | Defensa frente a XSS y sin dependencias externas |
| 5 | `googleapis` 188 con pruebas, Dependabot y `npm audit` en CI | Cerrar las vulnerabilidades conocidas y vigilar las nuevas |
| 6 | Proteger `main` y confirmar el CI en verde | Ningún cambio sin revisión ni pruebas |

### 🟠 Prioridad media

| # | Mejora |
|---|---|
| 7 | Paso de compilación (empaquetar, minificar, caché larga) |
| 8 | Paginación de la tabla (P5 y rendimiento) |
| 9 | `tsconfig.build.json` sin pruebas ni ejemplos |
| 10 | Validación de fecha real en la web (P3) y del ID del evento (P4) |
| 11 | Aviso visible si falla el guardado (P6) |
| 12 | `SECURITY.md`, `CODEOWNERS` y `CHANGELOG.md` |

### 🟢 Prioridad baja

| # | Mejora |
|---|---|
| 13 | Catálogos y límites en un solo módulo compartido |
| 14 | Colores sueltos a variables, textos a un módulo de i18n |
| 15 | Menos `backdrop-filter`, pausar la animación en segundo plano |
| 16 | Prettier y acciones de GitHub fijadas por SHA |
| 17 | Dejar de exportar `todayISO`; alinear los IDs de la simulación |

### Requisitos para producción real (fuera del alcance de una demo)
API HTTP con validación y manejo central de errores, PostgreSQL conectado con copias de seguridad, autenticación y autorización por espacio de trabajo, webhooks firmados con *worker* de eventos, HTTPS, límites de uso, registros y métricas, aviso de privacidad y política de retención, y prueba de carga.

---

## 11. Limitaciones

- El rendimiento se midió en un navegador de pruebas; las cifras son orientativas.
- No se pudo consultar el estado del CI ni la protección de ramas del repositorio remoto desde las herramientas disponibles.
- No se hicieron pruebas de penetración ni de carga.
