/**
 * simulation.js — panel "Simulación de automatizaciones".
 *
 * Escucha las acciones del almacén (crear, cambiar estado, eliminar) y muestra,
 * paso a paso, lo que haría la arquitectura completa (backend, base de datos, n8n
 * y servicios externos). Es SOLO una simulación: no se envía nada a ningún servidor.
 *
 * Los escenarios son funciones puras: con los mismos datos devuelven siempre los mismos pasos.
 */
(function (TF) {
  'use strict';

  const { el, formatDate } = TF.utils;
  const { STATUS } = TF.store;

  const MAX_RUNS = 5;
  const AI_DAILY_LIMIT = 20;
  const STATE_LABEL = { ok: 'Hecho', skip: 'Omitido', fail: 'Fallo' };

  // Elementos del DOM: se buscan una sola vez en init(), no al cargar el archivo.
  let logEl;
  let emptyEl;
  let failToggle;
  let speedSelect;

  let aiRequestsToday = 2; // contador simulado de peticiones de IA del día

  /* ------------------------- Línea de tiempo -------------------------- */

  /**
   * Acumula los pasos de un escenario. `atMs` es el momento simulado del paso, en
   * milisegundos desde que el usuario actúa. Los pasos comunes a varios escenarios viven aquí.
   */
  function createTimeline() {
    const steps = [];
    const say = (atMs, who, text, state = 'ok') => steps.push({ atMs, who, text, state });

    return {
      steps,
      say,
      /** Separador: lo que sigue ocurre en paralelo, en segundo plano. */
      parallel: () => steps.push({ group: true, text: 'Se ejecutan en paralelo (los tiempos son relativos al inicio)' }),
      /** En esta demo ninguna tarea tiene un issue de GitHub vinculado. */
      noLinkedIssue: (atMs) => say(atMs, 'GitHub', 'Sin issue vinculado: se omite el cierre', 'skip'),
      /** Google Calendar con el token del usuario revocado (opción "Simular fallo"). */
      calendarFailure(atMs) {
        say(atMs, 'Google Calendar', 'Responde invalid_grant: el token del usuario fue revocado', 'fail');
        say(atMs + 40, 'n8n', 'Emite integration.reauth_required y pausa la sincronización del usuario');
        say(atMs + 300, 'Correo', 'Avisa al usuario: «Vuelve a conectar Google Calendar»');
        say(atMs + 340, 'n8n', 'El paso de Calendar queda pendiente de reintento; el resto continúa');
      },
    };
  }

  const dueText = (task) => (task.dueDate ? formatDate(task.dueDate) : 'sin fecha');

  /* -------------------------- Crear una tarea -------------------------- */

  function createdEvents(task) {
    return ['task.created', ...(task.assignee ? ['task.assigned'] : []), 'ai.suggestion_requested', 'ai.suggestion_ready'];
  }

  function addCreateRequest(timeline, task, events) {
    const storedEvents = events.slice(0, task.assignee ? 2 : 1).join(' y ');
    timeline.say(0, 'Interfaz', 'Valida el formulario (título de al menos 3 caracteres) y envía POST /tasks');
    timeline.say(50, 'Backend', 'Comprueba la sesión y que el usuario pertenece al espacio de trabajo');
    timeline.say(80, 'Base de datos', `Transacción: inserta «${task.title}» y registra los eventos ${storedEvents} como pendientes`);
    timeline.say(120, 'Interfaz', 'Recibe 201: la fila aparece y los contadores del dashboard se actualizan');
    timeline.say(150, 'Backend → n8n', 'Envía webhooks firmados sin esperar respuesta (el usuario ya tiene su respuesta)');
  }

  function addAssigneeNotice(timeline, task) {
    if (!task.assignee) {
      timeline.say(300, 'n8n', 'A · task.assigned omitido: la tarea no tiene responsable', 'skip');
      return;
    }
    timeline.say(300, 'n8n', 'A · task.assigned: valida el secreto del webhook y lee tarea y usuario');
    timeline.say(450, 'Base de datos', 'Comprueba las preferencias de notificación: activadas');
    timeline.say(900, 'Slack', `Mensaje directo a ${task.assignee}: «Te asignaron ${task.title} (vence: ${dueText(task)})»`);
    timeline.say(1000, 'Base de datos', 'Inserta en notifications y marca task.assigned como procesado');
  }

  function addCalendarSync(timeline, task, fail) {
    if (!task.dueDate) {
      timeline.say(350, 'n8n', 'B · Sin fecha límite: no se crea evento en el calendario', 'skip');
      return;
    }
    timeline.say(350, 'n8n', 'B · task.created: la tarea tiene fecha límite, se sincroniza con el calendario');
    if (fail) {
      timeline.calendarFailure(500);
      return;
    }
    // Mismo formato que eventIdForTask() del backend: "tf" + id numérico de la tarea.
    timeline.say(500, 'Google Calendar', `Crea el evento de día completo tf<id> para el ${dueText(task)}`);
    timeline.say(1200, 'Base de datos', 'Guarda el vínculo en task_calendar_events');
  }

  function addAiSuggestion(timeline, task, aiRequestNumber) {
    if (aiRequestNumber > AI_DAILY_LIMIT) {
      timeline.say(400, 'Base de datos', `C · Límite diario de IA alcanzado (${AI_DAILY_LIMIT} de ${AI_DAILY_LIMIT})`, 'fail');
      timeline.say(450, 'n8n', 'Emite ai.quota_exceeded y avisa al usuario');
      return;
    }
    timeline.say(400, 'Base de datos', `C · IA: ${aiRequestNumber} de ${AI_DAILY_LIMIT} peticiones hoy. Inserta ai_suggestions en estado pending`);
    timeline.say(600, 'Claude', 'Recibe la tarea como DATOS y devuelve JSON con subtareas y prioridad');
    timeline.say(4800, 'n8n', `Valida el JSON: 3 subtareas sugeridas, prioridad propuesta «${TF.store.PRIORITY[task.priority]}»`);
    timeline.say(4900, 'Base de datos', 'Guarda la respuesta y emite ai.suggestion_ready');
    timeline.say(5000, 'Interfaz', 'Avisa al usuario: «Tienes una sugerencia de IA». Solo se aplica si la acepta');
  }

  /** @param {{ fail: boolean, aiRequestNumber: number }} options */
  function createdScenario(task, { fail, aiRequestNumber }) {
    const timeline = createTimeline();
    const events = createdEvents(task);

    addCreateRequest(timeline, task, events);
    timeline.parallel();
    addAssigneeNotice(timeline, task);
    addCalendarSync(timeline, task, fail);
    addAiSuggestion(timeline, task, aiRequestNumber);
    timeline.say(5100, 'n8n', 'Marca los eventos como procesados en automation_events');

    return { events, steps: timeline.steps, title: task.title };
  }

  /* ------------------------- Cambiar el estado ------------------------- */

  function addStatusRequest(timeline, { from, to, events, completed }) {
    timeline.say(0, 'Interfaz', `Cambia el estado de «${STATUS[from]}» a «${STATUS[to]}» en el selector de la fila`);
    timeline.say(40, 'Backend', 'PATCH /tasks/:id y comprueba que el usuario puede modificar la tarea');
    timeline.say(70, 'Base de datos', `Transacción: actualiza el estado${completed ? ' y completed_at' : ''} y registra ${events.join(' y ')}`);
    timeline.say(100, 'Interfaz', 'Actualiza los contadores: Pendientes, En progreso y Completadas');
    timeline.say(120, 'Backend → n8n', 'Envía los webhooks firmados');
  }

  function addHistoryAndNotice(timeline, completed) {
    timeline.say(300, 'n8n', 'A · task.status_changed: lee la tarea y registra el cambio en el historial');
    if (completed) {
      timeline.say(800, 'Slack', 'Avisa a quien creó la tarea: «La tarea fue completada»');
      timeline.say(900, 'Base de datos', 'Inserta en notifications y marca el evento como procesado');
    } else {
      timeline.say(500, 'n8n', 'Sin aviso: solo las tareas completadas notifican al creador', 'skip');
    }
  }

  function addCompletionCleanup(timeline, task, fail) {
    timeline.say(350, 'n8n', 'B · task.completed: limpia las integraciones de la tarea');
    if (task.dueDate && fail) timeline.calendarFailure(700);
    else if (task.dueDate) timeline.say(1000, 'Google Calendar', 'Actualiza el evento: lo marca como completado');
    else timeline.say(700, 'Google Calendar', 'Sin evento vinculado: no hay nada que actualizar', 'skip');
    timeline.noLinkedIssue(1100);
    timeline.say(1200, 'n8n', 'Los recordatorios due_soon y overdue consultan solo tareas sin completar: dejan de afectarla');
  }

  function addReopenSync(timeline, fail) {
    timeline.say(350, 'n8n', 'B · La tarea se reabrió: reactiva su evento del calendario');
    if (fail) timeline.calendarFailure(700);
    else timeline.say(1000, 'Google Calendar', 'Restaura el evento como pendiente');
  }

  /** @param {{ from: string, to: string, fail: boolean }} options */
  function statusScenario(task, { from, to, fail }) {
    const timeline = createTimeline();
    const completed = to === 'done';
    const reopened = from === 'done';
    const events = completed ? ['task.status_changed', 'task.completed'] : ['task.status_changed'];

    addStatusRequest(timeline, { from, to, events, completed });
    timeline.parallel();
    addHistoryAndNotice(timeline, completed);
    if (completed) addCompletionCleanup(timeline, task, fail);
    else if (reopened && task.dueDate) addReopenSync(timeline, fail);
    timeline.say(completed ? 1300 : 1100, 'n8n', 'Marca los eventos como procesados en automation_events');

    return { events, steps: timeline.steps, title: task.title };
  }

  /* ------------------------- Eliminar una tarea ------------------------- */

  /** @param {{ fail: boolean }} options */
  function deletedScenario(task, { fail }) {
    const timeline = createTimeline();

    timeline.say(0, 'Interfaz', 'Muestra el diálogo de confirmación; el usuario confirma');
    timeline.say(50, 'Backend', 'DELETE /tasks/:id y comprueba que es el creador o un administrador');
    timeline.say(80, 'Base de datos', 'ANTES de borrar: lee el ID del evento de Calendar y el issue vinculado y los guarda en el payload');
    timeline.say(100, 'Base de datos', 'Borra la tarea: el borrado en cascada elimina comentarios, adjuntos, tiempos, subtareas y vínculos');
    timeline.say(120, 'Interfaz', 'La fila desaparece y los contadores bajan');
    timeline.say(160, 'Backend → n8n', 'Envía el webhook task.deleted con los datos guardados (los originales ya no existen)');

    timeline.parallel();

    timeline.say(400, 'n8n', 'Valida el secreto y lee el payload');
    if (task.dueDate && fail) timeline.calendarFailure(900);
    else if (task.dueDate) timeline.say(900, 'Google Calendar', 'Borra el evento (si ya no existe, un 404 se considera correcto)');
    else timeline.say(900, 'Google Calendar', 'Sin evento vinculado: se omite', 'skip');
    timeline.noLinkedIssue(1400);
    if (task.assignee) timeline.say(1800, 'Slack', `Avisa a ${task.assignee}: «La tarea ${task.title} fue eliminada»`);
    else timeline.say(1800, 'Slack', 'Sin responsable: no hay a quién avisar', 'skip');
    timeline.say(2000, 'n8n', 'Marca el evento como procesado. El archivo físico de adjuntos lo limpiará el mantenimiento del domingo');

    return { events: ['task.deleted'], steps: timeline.steps, title: task.title };
  }

  /* ------------------------------ Dibujo ------------------------------- */

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const toSeconds = (ms, decimals) => (ms / 1000).toFixed(decimals);

  function stepNode(step) {
    if (step.group) {
      return el('li', { class: 'sim-step sim-step--group', text: step.text });
    }
    return el(
      'li',
      { class: `sim-step sim-step--${step.state}` },
      el('span', { class: 'sim-step__time', text: `+${toSeconds(step.atMs, 2)} s` }),
      el('span', { class: 'sim-step__who', text: step.who }),
      el('span', { class: 'sim-step__text' }, step.text, step.state === 'ok' ? null : el('em', { class: 'sim-step__tag', text: ` · ${STATE_LABEL[step.state]}` }))
    );
  }

  /** Tarjeta vacía de una ejecución, añadida al principio del registro. */
  function createRunCard(scenario) {
    const badge = el('span', { class: 'sim-run__badge', text: 'En curso…' });
    const list = el('ol', { class: 'sim-steps' });
    const header = el(
      'header',
      { class: 'sim-run__head' },
      el('div', {}, el('h3', { class: 'sim-run__events', text: scenario.events.join(' · ') }), el('p', { class: 'sim-run__task', text: scenario.title })),
      badge
    );
    logEl.prepend(el('article', { class: 'sim-run' }, header, list));
    while (logEl.children.length > MAX_RUNS) logEl.lastElementChild.remove();
    return { list, badge };
  }

  /** Línea final con el resumen y estado de la insignia. */
  function finishRun({ list, badge }, scenario) {
    const realSteps = scenario.steps.filter((step) => !step.group);
    const failed = realSteps.some((step) => step.state === 'fail');
    const totalSeconds = toSeconds(Math.max(...realSteps.map((step) => step.atMs)), 1);
    list.append(
      el('li', { class: 'sim-step sim-step--end', text: `Proceso finalizado · ${scenario.events.length} evento(s) · ${totalSeconds} s simulados${failed ? ' · con incidencias' : ''}` })
    );
    badge.textContent = failed ? 'Con incidencias' : 'Finalizado';
    badge.classList.toggle('is-warn', failed);
  }

  async function play(scenario) {
    emptyEl.hidden = true;
    const run = createRunCard(scenario);

    const delay = Number(speedSelect.value);
    for (const step of scenario.steps) {
      if (delay) await sleep(step.group ? delay / 2 : delay);
      run.list.append(stepNode(step));
    }
    finishRun(run, scenario);
  }

  /* ------------------------------ Arranque ------------------------------ */

  /** Busca los elementos del DOM y empieza a escuchar las acciones del almacén. */
  function init() {
    logEl = document.getElementById('sim-log');
    emptyEl = document.getElementById('sim-empty');
    failToggle = document.getElementById('sim-fail');
    speedSelect = document.getElementById('sim-speed');

    TF.store.onEvent((event) => {
      const fail = failToggle.checked;
      if (event.action === 'created') {
        aiRequestsToday += 1; // el contador vive aquí: los escenarios no cambian estado
        play(createdScenario(event.task, { fail, aiRequestNumber: aiRequestsToday }));
      } else if (event.action === 'status') {
        play(statusScenario(event.task, { from: event.from, to: event.to, fail }));
      } else if (event.action === 'deleted') {
        play(deletedScenario(event.task, { fail }));
      }
    });

    document.getElementById('sim-clear').addEventListener('click', () => {
      logEl.replaceChildren();
      emptyEl.hidden = false;
    });
  }

  TF.simulation = { init, scenarios: { created: createdScenario, status: statusScenario, deleted: deletedScenario } };
})((window.TaskFlow = window.TaskFlow || {}));
