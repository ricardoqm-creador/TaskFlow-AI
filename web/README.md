# TaskFlow IA — Front-End v0.1

Dashboard para administrar tareas personales y de equipos. Solo HTML5, CSS3 y JavaScript:
**sin autenticación, sin base de datos y sin backend** (las tareas se guardan en `localStorage`).

## Cómo abrirlo
Doble clic en `index.html`. No necesita servidor ni instalación.

## Estructura
```
web/
├─ index.html          Estructura y accesibilidad
├─ assets/logo.svg     Logotipo (sol del amanecer)
├─ css/
│  ├─ variables.css    Paleta dorada/plateada/blanca, tipografía, espaciado
│  ├─ base.css         Reset, fondo y accesibilidad
│  ├─ layout.css       Barra lateral, encabezado, rejillas
│  ├─ components/      navigation · controls · stats · table · dialogs
│  ├─ simulation.css   Panel de simulación de automatizaciones
│  └─ responsive.css   Adaptación a tableta y móvil
└─ js/
   ├─ core/            Sin DOM: utils (helpers), storage (persistencia), store (estado y reglas)
   ├─ components/      Piezas reutilizables: Badge, StatCard, Dialog/ConfirmDialog, Toast
   ├─ features/        Funcionalidades: stats, taskTable, taskDialog, simulation
   └─ app.js           Arranque: monta las funcionalidades y conecta los eventos
```

## Decisiones de diseño
- **Scripts clásicos** con un solo espacio de nombres (`TaskFlow`): funcionan al abrir el archivo con doble clic.
- **Tres capas:** `core` no conoce el DOM (se prueba en Node), `components` no conocen la aplicación y `features` las combinan.
- **Actualización por fila:** el almacén avisa de *qué* cambió y la tabla modifica solo esa fila, de modo que una acción no cuesta más al crecer la lista.
- **Los módulos buscan el DOM al iniciar** (`init`/`mount`), no al cargarse: son más fáciles de probar.
- **Capa de datos aislada** (`core/storage.js`): al añadir un backend solo cambia ese archivo.
- **Seguridad:** el contenido de las tareas se inserta con `textContent`, nunca con `innerHTML`.
- **Accesibilidad:** HTML semántico, `<dialog>` nativo, etiquetas ARIA, foco visible y soporte de `prefers-reduced-motion`.

## Próximos pasos
Edición de tareas, vistas de Equipos y Calendario, autenticación, backend y base de datos.
