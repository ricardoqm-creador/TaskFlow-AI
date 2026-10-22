/**
 * app.js — punto de entrada: monta los módulos y conecta los eventos de la interfaz con el estado.
 */
(function (TF) {
  'use strict';

  const { debounce, prefersReducedMotion } = TF.utils;

  const filters = { status: 'all', query: '' };

  /* ------------------------ Estado -> interfaz ------------------------- */

  /** El almacén indica qué cambió: se actualiza solo esa fila. Sin `change`, se dibuja todo. */
  function refresh(tasks, change) {
    TF.stats.update();
    if (change) TF.taskTable.applyChange(change, filters);
    else TF.taskTable.render(filters);
  }

  /* --------------------------- Menú lateral ---------------------------- */

  function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('scrim');
    const menuToggle = document.getElementById('menu-toggle');

    function setOpen(open) {
      sidebar.classList.toggle('is-open', open);
      scrim.hidden = !open;
      document.body.classList.toggle('no-scroll', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    }

    menuToggle.addEventListener('click', () => setOpen(!sidebar.classList.contains('is-open')));
    scrim.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && sidebar.classList.contains('is-open')) setOpen(false);
    });

    return { close: () => setOpen(false) };
  }

  /* ---------------------------- Navegación ----------------------------- */

  // En esta versión solo existen estas secciones; el resto avisa de que llegará más adelante.
  const SECTIONS = { dashboard: 'dashboard', tasks: 'tareas', simulation: 'simulacion' };

  function initNavigation(sidebar) {
    const links = document.querySelectorAll('.nav-link');

    links.forEach((link) => {
      link.addEventListener('click', () => {
        const sectionId = SECTIONS[link.dataset.view];
        if (!sectionId) {
          TF.toast.show(`La sección «${link.textContent.trim()}» llegará en una próxima versión`);
          return;
        }

        links.forEach((item) => {
          item.classList.toggle('is-active', item === link);
          if (item === link) item.setAttribute('aria-current', 'page');
          else item.removeAttribute('aria-current');
        });

        document.getElementById(sectionId).scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        sidebar.close();
      });
    });

    document.getElementById('notifications-btn').addEventListener('click', () => {
      TF.toast.show('No tienes notificaciones nuevas');
    });
  }

  /* ------------------------- Filtros y búsqueda ------------------------- */

  function initFilters() {
    const chips = document.querySelectorAll('.chip');

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        filters.status = chip.dataset.filter;
        chips.forEach((item) => item.setAttribute('aria-pressed', String(item === chip)));
        TF.taskTable.render(filters);
      });
    });

    document.getElementById('search-input').addEventListener(
      'input',
      debounce((event) => {
        filters.query = event.target.value;
        TF.taskTable.render(filters);
      }, 180)
    );
  }

  /* ------------------------- Acciones de la tabla ------------------------ */

  function initTableActions(confirmDialog) {
    const tableBody = document.getElementById('task-body');

    // Delegación de eventos: un solo oyente para todas las filas.
    tableBody.addEventListener('change', (event) => {
      const select = event.target.closest('.status-select');
      if (!select) return;
      TF.store.setStatus(select.dataset.id, select.value);
      TF.toast.show('Estado actualizado');
    });

    tableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action="delete"]');
      if (!button) return;

      const task = TF.store.getAll().find((item) => item.id === button.dataset.id);
      if (!task) return;

      const confirmed = await confirmDialog.ask(`¿Eliminar la tarea «${task.title}»? Esta acción no se puede deshacer.`);
      if (confirmed) {
        TF.store.remove(task.id);
        TF.toast.show('Tarea eliminada');
      }
    });
  }

  /* ------------------------------ Arranque ------------------------------ */

  function init() {
    const today = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('today-label').textContent = today.charAt(0).toUpperCase() + today.slice(1);

    const sidebar = initSidebar();
    initNavigation(sidebar);
    initFilters();

    const taskDialog = TF.taskDialog.init();
    document.getElementById('new-task-btn').addEventListener('click', taskDialog.open);

    const confirmDialog = TF.components.createConfirmDialog(document.getElementById('confirm-dialog'), document.getElementById('confirm-message'));
    initTableActions(confirmDialog);

    TF.simulation.init();

    TF.stats.mount(document.getElementById('stats'));
    TF.taskTable.mount();
    TF.store.init();
    TF.store.subscribe(refresh);
    refresh();
  }

  init();
})((window.TaskFlow = window.TaskFlow || {}));
