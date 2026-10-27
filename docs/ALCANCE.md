# Alcance de la entrega — TaskFlow IA

**Fecha:** 27 de octubre de 2026
**Tipo de entrega:** demostración funcional (prototipo) y base técnica para continuar el desarrollo
**Demo publicada:** <https://taskflow-ai-opal.vercel.app>
**Licencia:** MIT (archivo [`LICENSE`](../LICENSE))

Este documento explica **qué incluye** la entrega, **qué está simulado** y **qué no está incluido todavía**, para que las expectativas sean claras desde el primer día.

---

## 1. Resumen

TaskFlow IA se entrega como **prototipo funcional**: una aplicación web para gestionar tareas que funciona de forma completa **para un usuario y en su propio navegador**, acompañada de la base técnica (código del servidor, base de datos e integraciones) preparada y probada para la siguiente fase.

> **No es todavía una aplicación de producción multiusuario.** No hay cuentas de usuario, ni servidor, ni base de datos en línea. Las tareas se guardan solo en el navegador de quien usa la demo.

---

## 2. Qué funciona hoy

| Funcionalidad | Detalle |
|---|---|
| Panel de control | Totales, pendientes, en progreso y completadas; aviso de tareas vencidas y porcentaje completado |
| Crear tareas | Título (obligatorio, mínimo 3 caracteres), descripción, prioridad (Urgente, Alta, Media, Baja), estado, responsable y fecha límite |
| Cambiar el estado | Pendiente, En progreso o Completada, desde la propia tabla |
| Eliminar tareas | Con confirmación previa |
| Buscar y filtrar | Por texto (título, descripción o responsable) y por estado |
| Tareas vencidas | Se marcan automáticamente si la fecha pasó y no están completadas |
| Diseño responsive | Escritorio, tableta y móvil |
| Accesibilidad | Navegación por teclado, contraste suficiente y respeto de la preferencia de reducir animaciones |

## 3. Qué está simulado

| Elemento | Qué muestra | Qué NO hace |
|---|---|---|
| **Panel "Simulación de automatizaciones"** | Paso a paso, lo que harían el servidor, la base de datos, n8n, la IA, Google Calendar y Slack al crear, completar o eliminar una tarea, incluido un caso de fallo | **No envía nada a ningún servicio.** Es una explicación visual de la arquitectura diseñada |

## 4. Qué no está incluido en esta entrega

| Pendiente | Situación actual |
|---|---|
| **Cuentas de usuario e inicio de sesión** | No existen. Cualquiera que abra la demo la usa como invitado |
| **Servidor y base de datos en línea** | El esquema de la base de datos (PostgreSQL, 17 tablas) está diseñado y verificado, pero **no conectado** |
| **Trabajo en equipo** | No se pueden compartir tareas entre personas ni dispositivos |
| **Sugerencias con IA (Claude)** | Módulo programado y probado; **no conectado** a la web |
| **Sincronización con Google Calendar** | Módulo programado y probado; **no conectado** a la web |
| **Automatizaciones con n8n** | Diseñadas y documentadas; solo existe un flujo de prueba **inactivo** |
| **Editar una tarea existente** | Solo se puede cambiar su estado; para corregir otros datos hay que eliminarla y crearla de nuevo |
| **Secciones Equipos, Calendario, Reportes y Configuración** | Visibles en el menú, pero aún sin contenido |

---

## 5. Datos y privacidad

- Las tareas se guardan **solo en el navegador** (almacenamiento local). No se envían a ningún servidor.
- **Si se borran los datos del navegador o se cambia de dispositivo, las tareas se pierden.** No hay copia de seguridad.
- **No se recomienda introducir información sensible o confidencial** en la demo.
- La página carga sus tipografías desde Google Fonts: el navegador del visitante se conecta a servidores de Google.
- La demo funciona con cabeceras de seguridad (Content-Security-Policy, protección contra incrustación en otras webs y HTTPS estricto).

---

## 6. Calidad verificada en esta entrega

| Indicador | Resultado |
|---|---|
| Pruebas automáticas | 71, todas correctas |
| Análisis estático y tipos | Sin errores |
| Esquema de base de datos | 17 tablas y 14 reglas de integridad verificadas contra PostgreSQL |
| Integración continua | Se ejecuta en cada cambio propuesto (análisis, tipos, pruebas, base de datos y compilación) |
| Publicación | Automática en Vercel; versión optimizada (2 archivos propios) con caché de un año |

---

## 7. Siguientes fases propuestas

| Fase | Contenido | Resultado para el cliente |
|---|---|---|
| **1. Núcleo de producción** | Servidor (API) con PostgreSQL, cuentas de usuario, permisos por espacio de trabajo y edición de tareas | Aplicación multiusuario con datos guardados de forma segura |
| **2. Integraciones** | IA, Google Calendar y automatizaciones de n8n conectadas, con webhooks firmados | Sugerencias reales, fechas en el calendario y avisos automáticos |
| **3. Operación** | Copias de seguridad, registros, alertas de errores, límites de uso y de coste de IA | Servicio estable y supervisado |

**Condición de la plataforma:** la publicación actual usa el plan gratuito de Vercel, que está pensado para uso personal no comercial. Para un uso comercial será necesario el plan de pago de Vercel u otra plataforma.

---

## 8. Criterios de aceptación de esta entrega

- [ ] La demo carga en <https://taskflow-ai-opal.vercel.app> en escritorio y en móvil.
- [ ] Se pueden crear, filtrar, buscar, cambiar de estado y eliminar tareas.
- [ ] El cliente ha leído las secciones 3, 4 y 5 (qué está simulado, qué no está incluido y cómo se guardan los datos).
- [ ] El código fuente está disponible en el repositorio con licencia MIT.
