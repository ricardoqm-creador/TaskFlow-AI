/**
 * simulation.js — panel "Simulación de automatizaciones".
 *
 * Escucha las acciones del almacén (crear, cambiar estado, eliminar) y muestra,
 * paso a paso, lo que haría la arquitectura completa (backend, base de datos, n8n
 * y servicios externos). Es SOLO una simulación: no se envía nada a ningún servidor.
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

  /* ----------------------- Constructor de pasos ----------------------- */

  /** Acumula los pasos de un escenario. Los pasos comunes a varios escenarios viven aquí. */
  function builder() {
    const steps = [];
    const say = (t, who, text, state = 'ok') => steps.push({ t, who, text, state });
    return {
      steps,
      say,
      /** Separador: lo que sigue ocurre en paralelo, en segundo plano. */
      parallel: () => steps.push({ group: true, text: 'Se ejecutan en paralelo (los tiempos son relativos al inicio)' }),
      /** En esta demo ninguna tarea tiene un issue de GitHub vinculado. */
      noLinkedIssue: (t) => say(t, 'GitHub', 'Sin issue vinculado: se omite el cierre', 'skip'),
    };
  }

  const dueText = (task) => (task.dueDate ? formatDate(task.dueDate) : 'sin fecha');

  /** Rama de Google Calendar; con el fallo activado simula un token revocado. */
  function calendarFailure(b, t) {
    b.say(t, 'Google Calendar', 'Responde invalid_grant: el token del usuario fue revocado', 'fail');
    b.say(t + 40, 'n8n', 'Emite integration.reauth_required y pausa la sincronización del usuario');
    b.say(t + 300, 'Correo', 'Avisa al usuario: «Vuelve a conectar Google Calendar»');
    b.say(t + 340, 'n8n', 'El paso de Calendar queda pendiente de reintento; el resto continúa');
  }

  /* ------------------------------ Escenarios ---------------------------- */

  function createdScenario(task, fail) {
    const b = builder();
    const events = ['task.created'];
    if (task.assignee) events.push('task.assigned');
    events.push('ai.suggestion_requested', 'ai.suggestion_ready');

    b.say(0, 'Interfaz', 'Valida el formulario (título de al menos 3 caracteres) y envía POST /tasks');
    b.say(50, 'Backend', 'Comprueba la sesión y que el usuario pertenece al espacio de trabajo');
    b.say(80, 'Base de datos', `Transacción: inserta «${task.title}» y registra los eventos ${events.slice(0, task.assignee ? 2 : 1).join(' y ')} como pendientes`);
    b.say(120, 'Interfaz', 'Recibe 201: la fila aparece y los contadores del dashboard se actualizan');
    b.say(150, 'Backend → n8n', 'Envía webhooks firmados sin esperar respuesta (el usuario ya tiene su respuesta)');

    b.parallel();

    if (task.assignee) {
      b.say(300, 'n8n', 'A · task.assigned: valida el secreto del webhook y lee tarea y usuario');
      b.say(450, 'Base de datos', 'Comprueba las preferencias de notificación: activadas');
      b.say(900, 'Slack', `Mensaje directo a ${task.assignee}: «Te asignaron ${task.title} (vence: ${dueText(task)})»`);
      b.say(1000, 'Base de datos', 'Inserta en notifications y marca task.assigned como procesado');
    } else {
      b.say(300, 'n8n', 'A · task.assigned omitido: la tarea no tiene responsable', 'skip');
    }

    if (task.dueDate) {
      b.say(350, 'n8n', 'B · task.created: la tarea tiene fecha límite, se sincroniza con el calendario');
      if (fail) {
        calendarFailure(b, 500);
      } else {
        // Mismo formato que eventIdForTask() del backend: "tf" + id numérico de la tarea.
        b.say(500, 'Google Calendar', `Crea el evento de día completo tf<id> para el ${dueText(task)}`);
        b.say(1200, 'Base de datos', 'Guarda el vínculo en task_calendar_events');
      }
    } else {
      b.say(350, 'n8n', 'B · Sin fecha límite: no se crea evento en el calendario', 'skip');
    }

    aiRequestsToday += 1;
    if (aiRequestsToday > AI_DAILY_LIMIT) {
      b.say(400, 'Base de datos', `C · Límite diario de IA alcanzado (${AI_DAILY_LIMIT} de ${AI_DAILY_LIMIT})`, 'fail');
      b.say(450, 'n8n', 'Emite ai.quota_exceeded y avisa al usuario');
    } else {
      b.say(400, 'Base de datos', `C · IA: ${aiRequestsToday} de ${AI_DAILY_LIMIT} peticiones hoy. Inserta ai_suggestions en estado pending`);
      b.say(600, 'Claude', 'Recibe la tarea como DATOS y devuelve JSON con subtareas y prioridad');
      b.say(4800, 'n8n', `Valida el JSON: 3 subtareas sugeridas, prioridad propuesta «${TF.store.PRIORITY[task.priority]}»`);
      b.say(4900, 'Base de datos', 'Guarda la respuesta y emite ai.suggestion_ready');
      b.say(5000, 'Interfaz', 'Avisa al usuario: «Tienes una sugerencia de IA». Solo se aplica si la acepta');
    }

    b.say(5100, 'n8n', 'Marca los eventos como procesados en automation_events');
    return { events, steps: b.steps, title: task.title };
  }

  function statusScenario(task, from, to, fail) {
    const b = builder();
    const completed = to === 'done';
    const reopened = from === 'done';
    const events = ['task.status_changed'];
    if (completed) events.push('task.completed');

    b.say(0, 'Interfaz', `Cambia el estado de «${STATUS[from]}» a «${STATUS[to]}» en el selector de la fila`);
    b.say(40, 'Backend', 'PATCH /tasks/:id y comprueba que el usuario puede modificar la tarea');
    b.say(70, 'Base de datos', `Transacción: actualiza el estado${completed ? ' y completed_at' : ''} y registra ${events.join(' y ')}`);
    b.say(100, 'Interfaz', 'Actualiza los contadores: Pendientes, En progreso y Completadas');
    b.say(120, 'Backend → n8n', 'Envía los webhooks firmados');

    b.parallel();

    b.say(300, 'n8n', 'A · task.status_changed: lee la tarea y registra el cambio en el historial');
    if (completed) {
      b.say(800, 'Slack', 'Avisa a quien creó la tarea: «La tarea fue completada»');
      b.say(900, 'Base de datos', 'Inserta en notifications y marca el evento como procesado');
    } else {
      b.say(500, 'n8n', 'Sin aviso: solo las tareas completadas notifican al creador', 'skip');
    }

    if (completed) {
      b.say(350, 'n8n', 'B · task.completed: limpia las integraciones de la tarea');
      if (task.dueDate && fail) {
        calendarFailure(b, 700);
      } else if (task.dueDate) {
        b.say(1000, 'Google Calendar', 'Actualiza el evento: lo marca como completado');
      } else {
        b.say(700, 'Google Calendar', 'Sin evento vinculado: no hay nada que actualizar', 'skip');
      }
      b.noLinkedIssue(1100);
      b.say(1200, 'n8n', 'Los recordatorios due_soon y overdue consultan solo tareas sin completar: dejan de afectarla');
    } else if (reopened && task.dueDate) {
      b.say(350, 'n8n', 'B · La tarea se reabrió: reactiva su evento del calendario');
      if (fail) calendarFailure(b, 700);
      else b.say(1000, 'Google Calendar', 'Restaura el evento como pendiente');
    }

    b.say(completed ? 1300 : 1100, 'n8n', 'Marca los eventos como procesados en automation_events');
    return { events, steps: b.steps, title: task.title };
  }

  function deletedScenario(task, fail) {
    const b = builder();
    const events = ['task.deleted'];

    b.say(0, 'Interfaz', 'Muestra el diálogo de confirmación; el usuario confirma');
    b.say(50, 'Backend', 'DELETE /tasks/:id y comprueba que es el creador o un administrador');
    b.say(80, 'Base de datos', 'ANTES de borrar: lee el ID del evento de Calendar y el issue vinculado y los guarda en el payload');
    b.say(100, 'Base de datos', 'Borra la tarea: el borrado en cascada elimina comentarios, adjuntos, tiempos, subtareas y vínculos');
    b.say(120, 'Interfaz', 'La fila desaparece y los contadores bajan');
    b.say(160, 'Backend → n8n', 'Envía el webhook task.deleted con los datos guardados (los originales ya no existen)');

    b.parallel();

    b.say(400, 'n8n', 'Valida el secreto y lee el payload');
    if (task.dueDate && fail) {
      calendarFailure(b, 900);
    } else if (task.dueDate) {
      b.say(900, 'Google Calendar', 'Borra el evento (si ya no existe, un 404 se considera correcto)');
    } else {
      b.say(900, 'Google Calendar', 'Sin evento vinculado: se omite', 'skip');
    }
    b.noLinkedIssue(1400);
    if (task.assignee) {
      b.say(1800, 'Slack', `Avisa a ${task.assignee}: «La tarea ${task.title} fue eliminada»`);
    } else {
      b.say(1800, 'Slack', 'Sin responsable: no hay a quién avisar', 'skip');
    }
    b.say(2000, 'n8n', 'Marca el evento como procesado. El archivo físico de adjuntos lo limpiará el mantenimiento del domingo');
    return { events, steps: b.steps, title: task.title };
  }

  /* ------------------------------ Dibujo ------------------------------- */

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function stepNode(step) {
    if (step.group) {
      return el('li', { class: 'sim-step sim-step--group', text: step.text });
    }
    return el(
      'li',
      { class: `sim-step sim-step--${step.state}` },
      el('span', { class: 'sim-step__time', text: `+${(step.t / 1000).toFixed(2)} s` }),
      el('span', { class: 'sim-step__who', text: step.who }),
      el('span', { class: 'sim-step__text' }, step.text, step.state === 'ok' ? null : el('em', { class: 'sim-step__tag', text: ` · ${STATE_LABEL[step.state]}` }))
    );
  }

  async function play(scenario) {
    emptyEl.hidden = true;

    const badge = el('span', { class: 'sim-run__badge', text: 'En curso…' });
    const list = el('ol', { class: 'sim-steps' });
    const card = el(
      'article',
      { class: 'sim-run' },
      el(
        'header',
        { class: 'sim-run__head' },
        el('div', {}, el('h3', { class: 'sim-run__events', text: scenario.events.join(' · ') }), el('p', { class: 'sim-run__task', text: scenario.title })),
        badge
      ),
      list
    );

    logEl.prepend(card);
    while (logEl.children.length > MAX_RUNS) logEl.lastElementChild.remove();

    const delay = Number(speedSelect.value);
    for (const step of scenario.steps) {
      if (delay) await sleep(step.group ? delay / 2 : delay);
      list.append(stepNode(step));
    }

    const real = scenario.steps.filter((step) => !step.group);
    const failed = real.some((step) => step.state === 'fail');
    const seconds = (Math.max(...real.map((step) => step.t)) / 1000).toFixed(1);
    list.append(
      el('li', { class: 'sim-step sim-step--end', text: `Proceso finalizado · ${scenario.events.length} evento(s) · ${seconds} s simulados${failed ? ' · con incidencias' : ''}` })
    );
    badge.textContent = failed ? 'Con incidencias' : 'Finalizado';
    badge.classList.toggle('is-warn', failed);
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
      if (event.action === 'created') play(createdScenario(event.task, fail));
      else if (event.action === 'status') play(statusScenario(event.task, event.from, event.to, fail));
      else if (event.action === 'deleted') play(deletedScenario(event.task, fail));
    });

    document.getElementById('sim-clear').addEventListener('click', () => {
      logEl.replaceChildren();
      emptyEl.hidden = false;
    });
  }

  TF.simulation = { init };
})((window.TaskFlow = window.TaskFlow || {}));
