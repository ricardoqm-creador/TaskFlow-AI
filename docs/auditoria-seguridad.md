# Informe técnico de auditoría de seguridad — TaskFlow AI v0.1

**Fecha:** 22 de octubre de 2026
**Tipo:** auditoría básica (revisión estática, pruebas dirigidas y comprobación de la configuración local)
**Alcance:** código del repositorio (52 archivos publicables), dependencias, configuración del proyecto y del entorno de desarrollo (n8n, variables de entorno, conectores).
**Fuera de alcance:** infraestructura de producción (no existe), pruebas de penetración, revisión legal.

---

## 1. Veredicto

| Escenario de publicación | ¿Listo? | Condición |
|---|---|---|
| **A. Repositorio público con el código** | ⚠️ **Condicional** | Rotar la credencial expuesta y elegir una licencia. No hay secretos ni datos personales en los archivos |
| **B. Demo estática del front-end** (`web/`, solo HTML/CSS/JS) | ✅ **Casi listo** | Sin servidor ni secretos. Recomendado: aviso de que los datos viven solo en el navegador, fuentes locales y CSP |
| **C. Aplicación completa en producción** | ❌ **No preparada** | No existen backend, autenticación, acceso a base de datos ni despliegue. Ver sección 4 |

**Conclusión:** el código es seguro de publicar; el riesgo actual está en el **entorno del propietario** (una credencial expuesta y un servicio local accesible desde la red), no en los archivos. Antes de publicar, resolver los **bloqueantes** de la sección 2.

---

## 2. Bloqueantes antes de publicar el repositorio

| # | Bloqueante | Estado | Solución |
|---|---|---|---|
| B1 | **Credencial personal de GitHub expuesta fuera de un gestor de secretos y todavía activa** | ❌ Abierto | Revocarla en GitHub, revisar el *Security log*, crear una nueva con permisos mínimos para un solo repositorio y caducidad corta, y guardarla sin mostrarla en pantalla |
| B2 | **Sin licencia** (`LICENSE`) | ❌ Abierto | Elegir una (por ejemplo MIT o Apache-2.0) o declarar expresamente que el código es propietario. Sin licencia, legalmente nadie puede reutilizarlo |
| B3 | **El proyecto aún no es un repositorio git** | ❌ Abierto | `git init`, revisar `git status` antes del primer *commit*, subir en una rama y fusionar con *pull request* |
| B4 | **Protección de secretos del repositorio sin activar** | ❌ Abierto | Activar *secret scanning* y *push protection* en la configuración del repositorio de GitHub |

Cuando B1 a B4 estén resueltos, el escenario A pasa a **listo**.

---

## 3. Hallazgos

### 🔴 Crítico

| ID | Hallazgo | Evidencia | Solución |
|---|---|---|---|
| S1 | Credencial de GitHub expuesta y vigente | La variable de entorno del usuario coincide con la credencial mostrada fuera de un gestor de secretos, y el conector sigue autenticándose con ella | Ver B1 |

### 🟠 Alto

| ID | Hallazgo | Evidencia | Solución |
|---|---|---|---|
| S2 | **n8n accesible desde la red local** | Escucha en todas las interfaces y responde por la dirección de red del equipo; no hay variables de seguridad definidas | `N8N_LISTEN_ADDRESS=127.0.0.1` y `N8N_DIAGNOSTICS_ENABLED=false`; reiniciar y verificar que ya no responde por la red |
| S3 | **Sin autenticación ni autorización** | El esquema incluye `password_hash`, pero no hay servidor ni control de acceso | Autenticación con `argon2` y sesiones seguras; comprobar `workspace_members` y rol en cada ruta |
| S4 | **Webhooks sin autenticación y con CORS `*`** | Configuración del workflow de n8n (hoy inactivo) | Secreto compartido o firma HMAC emitida por el backend, CORS limitado al origen propio, límite de tamaño y de peticiones |

### 🟡 Medio

| ID | Hallazgo | Evidencia | Solución |
|---|---|---|---|
| S5 | El delimitador `<task>` del prompt de IA se puede evadir | Reproducido con `</task >`, `</ task>`, `<task attr>`; `currentPriority` y `dueDate` se insertan sin limpiar | Escapar `<` y `>` en todos los campos, validar los que no son texto libre, añadir pruebas de evasión |
| S6 | Desconectar Google no revoca el token | `disconnect` solo borra el registro local | Llamar a `revokeToken` |
| S7 | El `state` de OAuth no se verifica dentro del servicio | Se delega a quien llama | Verificarlo en el servicio: de un solo uso, con caducidad y atado a la sesión |
| S8 | Clave de cifrado única, sin versión ni rotación | `TOKEN_ENCRYPTION_KEY` | Prefijo de versión y soporte de varias claves |
| S9 | Datos personales sin cifrar y envío a terceros | `localStorage` en claro; textos a Claude, Google Calendar y Slack; fuentes de Google; telemetría de n8n por defecto | Aviso de privacidad, minimización, fuentes locales, telemetría desactivada, política de retención |
| S10 | Sin CSP, cabeceras de seguridad ni SRI | `web/index.html` | CSP estricta tras alojar las fuentes; `helmet`; SRI en recursos externos |
| S11 | Sin límite de coste de IA implementado | Solo diseñado | Cuota por usuario y día, concurrencia máxima, presupuesto y alertas |
| S12 | Cadena de suministro | 4 vulnerabilidades moderadas (`googleapis` → `uuid`); 0 acciones de GitHub fijadas por SHA; `npx --yes` sin versión | `googleapis` 187 con pruebas, Dependabot, `npm audit` en CI, acciones por SHA |
| S13 | **Sin `SECURITY.md`, sin Dependabot, sin `CODEOWNERS`** | No existen | Añadirlos antes de publicar: canal de reporte, actualizaciones automáticas y revisores obligatorios |

### 🟢 Bajo

| ID | Hallazgo | Solución |
|---|---|---|
| S14 | La web valida la fecha solo con una expresión regular (`2026-02-30` pasa) | Comprobar que sea una fecha real |
| S15 | `eventIdForTask` no valida el ID | Exigir entero positivo seguro |
| S16 | Credencial en variable de entorno persistente | Credenciales del sistema o gestor de secretos |
| S17 | `automation_events.last_error` podría guardar datos sensibles | Guardar solo el código del error |
| S18 | Inyección SQL: no aplica hoy (0 consultas) | Consultas parametrizadas desde el primer repositorio |
| S19 | Sin `.editorconfig` ni linter con reglas de seguridad | ESLint (`no-floating-promises`, `eslint-plugin-security`) y Prettier en CI |

---

## 4. Requisitos para una publicación en producción (escenario C)

| Área | Falta |
|---|---|
| Backend | API HTTP con validación de entrada (Zod) y manejo central de errores |
| Datos | Repositorios con consultas parametrizadas, PostgreSQL gestionado, copias de seguridad y migraciones controladas |
| Identidad | Registro, inicio de sesión, recuperación de cuenta, sesiones seguras, autorización por espacio |
| Automatización | Webhooks firmados, *worker* para `automation_events`, workflows exportados y versionados |
| Plataforma | HTTPS obligatorio, cabeceras de seguridad, límites de uso, registros sin datos sensibles, gestor de secretos |
| Cumplimiento | Aviso de privacidad, política de retención, derecho de borrado (el flujo `user.deleted` está diseñado, no implementado) |
| Calidad | CI en verde y ejecutado en cada *pull request*, pruebas de autorización, prueba de carga |

---

## 5. Controles verificados (puntos fuertes)

- **0 patrones de credenciales** (GitHub, Anthropic, AWS, Google, claves privadas) en los 52 archivos publicables.
- **0 rutas locales, usuarios ni correos personales** en los archivos publicables.
- `.env` y `.claude/settings.local.json` están en `.gitignore`; `.mcp.json` no contiene secretos; `package.json` es `private`.
- El repositorio público remoto contiene únicamente el `README.md` inicial.
- Tokens OAuth cifrados con AES-256-GCM, con detección de manipulación (probado).
- Permiso mínimo en Google (`calendar.events`) y `state` aleatorio.
- Contenido de usuario insertado con `textContent` (probado contra `<img onerror>`); datos de `localStorage` normalizados al cargar.
- Errores de IA y de Calendar genéricos hacia el usuario; registros sin tokens.
- Salida de la IA validada con esquema y nunca ejecutada.
- CI con `permissions: contents: read`.
- Puertas de calidad en verde: `tsc` sin errores, 43 pruebas, 17 tablas con 14 restricciones comprobadas.

---

## 6. Lista de verificación previa a la publicación

**Repositorio (escenario A)**
- [ ] Credencial expuesta revocada y sustituida (B1)
- [ ] `LICENSE` elegida y añadida (B2)
- [ ] `git init`; revisar `git status` y `git ls-files` antes del primer *commit* (B3)
- [ ] *Secret scanning* y *push protection* activados (B4)
- [ ] `SECURITY.md`, `dependabot.yml` y `CODEOWNERS` añadidos (S13)
- [ ] El CI se ejecuta y pasa en el primer *pull request*
- [ ] Protección de la rama `main` (revisión obligatoria y CI en verde)
- [ ] n8n limitado a `127.0.0.1` y telemetría desactivada (S2)

**Demo estática (escenario B)**
- [ ] Aviso visible de que es una demostración y que los datos viven solo en el navegador
- [ ] Panel de simulación identificado como tal o detrás de una bandera
- [ ] Fuentes alojadas localmente y CSP básica
- [ ] No incluir `examples/n8n-webhook/` ni ningún flujo con CORS `*`

**Producción (escenario C)**
- [ ] Todos los requisitos de la sección 4

---

## 7. Limitaciones de esta auditoría

- No se evaluó desde otro dispositivo de la red; la exposición de n8n se comprobó contra la dirección de red del propio equipo.
- No hay historial git local que revisar; la revisión cubre los archivos actuales.
- La configuración de protección de ramas y de análisis de secretos del repositorio remoto no se pudo consultar.
- Las comprobaciones de rendimiento y carga están fuera del alcance.
- Las integraciones con Claude y Google Calendar no se probaron con credenciales reales.
