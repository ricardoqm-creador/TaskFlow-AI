/**
 * store.js — estado de la aplicación (tareas) y reglas de datos.
 * La interfaz nunca modifica las tareas directamente: siempre pasa por aquí.
 */
(function (TF) {
  'use strict';

  const { generateId, addDaysISO } = TF.utils;

  const STATUS = Object.freeze({
    pending: 'Pendiente',
    progress: 'En progreso',
    done: 'Completada',
  });

  const PRIORITY = Object.freeze({
    high: 'Alta',
    medium: 'Media',
    low: 'Baja',
  });

  const LIMITS = Object.freeze({ title: 120, description: 300, assignee: 60 });

  let tasks = [];
  const listeners = new Set();
  const eventListeners = new Set();

  /** Avisa de una acción de negocio (la usa el panel de simulación). */
  function emitEvent(event) {
    eventListeners.forEach((listener) => listener(event));
  }

  /** Datos de ejemplo para la primera ejecución. */
  function seed() {
    return [
      { title: 'Diseñar la identidad visual del proyecto', description: 'Paleta dorada y plateada, logotipo y guía de estilos.', assignee: 'Aurora Vega', priority: 'high', status: 'done', dueDate: addDaysISO(-3) },
      { title: 'Preparar la reunión semanal del equipo', description: 'Agenda, métricas de la semana y puntos de bloqueo.', assignee: 'Leo Marín', priority: 'medium', status: 'progress', dueDate: addDaysISO(1) },
      { title: 'Redactar la documentación de la API', description: 'Endpoints, ejemplos de uso y códigos de error.', assignee: 'Sol Navarro', priority: 'high', status: 'progress', dueDate: addDaysISO(3) },
      { title: 'Revisar los permisos de los miembros', description: 'Confirmar roles de administrador y lector.', assignee: 'Aurora Vega', priority: 'low', status: 'pending', dueDate: addDaysISO(7) },
      { title: 'Organizar el backlog del trimestre', description: 'Priorizar historias y estimar esfuerzo.', assignee: 'Leo Marín', priority: 'medium', status: 'pending', dueDate: addDaysISO(-1) },
      { title: 'Probar el flujo de nueva tarea', description: 'Validaciones del formulario y casos límite.', assignee: 'Sol Navarro', priority: 'high', status: 'pending', dueDate: addDaysISO(2) },
      { title: 'Actualizar la lista de compras de la oficina', description: '', assignee: '', priority: 'low', status: 'done', dueDate: addDaysISO(-6) },
      { title: 'Planificar las vacaciones del equipo', description: 'Calendario de turnos para el próximo mes.', assignee: 'Aurora Vega', priority: 'low', status: 'pending', dueDate: addDaysISO(14) },
    ].map((task) => ({ id: generateId(), createdAt: new Date().toISOString(), ...task }));
  }

  const MIN_TITLE = 3;

  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const isIsoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

  /** Texto limpio y recortado; cualquier valor que no sea texto se convierte en ''. */
  function clean(value, max) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
  }

  /** Mensaje de error si el título no es válido, o '' si lo es. Única regla para toda la app. */
  function titleError(title) {
    return clean(title, LIMITS.title).length < MIN_TITLE ? `El título debe tener al menos ${MIN_TITLE} caracteres.` : '';
  }

  /**
   * Convierte un registro leído de localStorage en una tarea completa y segura.
   * Los datos externos no son de fiar: se descartan los irrecuperables (sin id, título,
   * estado o prioridad válidos) y a los demás se les rellenan los campos que falten,
   * para que el resto de la app pueda asumir que siempre existen.
   */
  function normalizeTask(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.id !== 'string' || raw.id === '') return null;
    if (typeof raw.title !== 'string' || raw.title.trim() === '') return null;
    if (!has(STATUS, raw.status) || !has(PRIORITY, raw.priority)) return null;
    return {
      id: raw.id,
      title: clean(raw.title, LIMITS.title),
      description: clean(raw.description, LIMITS.description),
      assignee: clean(raw.assignee, LIMITS.assignee),
      priority: raw.priority,
      status: raw.status,
      dueDate: isIsoDate(raw.dueDate) ? raw.dueDate : '',
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    };
  }

  /**
   * Guarda y avisa a los suscriptores. `change` describe QUÉ cambió
   * ({ type: 'added' | 'status' | 'removed', task }) para que la interfaz actualice
   * solo lo necesario en lugar de redibujarlo todo.
   */
  function commit(change) {
    TF.storage.save(tasks);
    listeners.forEach((listener) => listener(tasks, change));
  }

  const store = {
    STATUS,
    PRIORITY,
    LIMITS,
    titleError,

    init() {
      const saved = TF.storage.load();
      if (Array.isArray(saved)) {
        tasks = saved.map(normalizeTask).filter(Boolean);
      } else {
        tasks = seed();
        TF.storage.save(tasks);
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Suscripción a acciones: { action: 'created' | 'status' | 'deleted', task, from?, to? }. */
    onEvent(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },

    getAll() {
      return tasks.slice();
    },

    /** Crea una tarea. Lanza RangeError si el título no es válido. */
    add(data) {
      const input = data ?? {};
      const problem = titleError(input.title);
      if (problem) throw new RangeError(problem);

      const task = {
        id: generateId(),
        title: clean(input.title, LIMITS.title),
        description: clean(input.description, LIMITS.description),
        assignee: clean(input.assignee, LIMITS.assignee),
        priority: has(PRIORITY, input.priority) ? input.priority : 'medium',
        status: has(STATUS, input.status) ? input.status : 'pending',
        dueDate: isIsoDate(input.dueDate) ? input.dueDate : '',
        createdAt: new Date().toISOString(),
      };
      tasks = [task, ...tasks];
      commit({ type: 'added', task });
      emitEvent({ action: 'created', task });
      return task;
    },

    setStatus(id, status) {
      if (!has(STATUS, status)) return;
      const previous = tasks.find((task) => task.id === id);
      if (!previous || previous.status === status) return;
      const updated = { ...previous, status };
      tasks = tasks.map((task) => (task.id === id ? updated : task));
      commit({ type: 'status', task: updated, from: previous.status });
      emitEvent({ action: 'status', task: updated, from: previous.status, to: status });
    },

    remove(id) {
      const removed = tasks.find((task) => task.id === id);
      if (!removed) return;
      tasks = tasks.filter((task) => task.id !== id);
      commit({ type: 'removed', task: removed });
      emitEvent({ action: 'deleted', task: removed });
    },

    /** Conteos para las tarjetas del dashboard (una sola pasada por la lista). */
    stats() {
      const counts = { pending: 0, progress: 0, done: 0 };
      let overdue = 0;
      for (const task of tasks) {
        counts[task.status] += 1;
        if (TF.utils.isOverdue(task)) overdue += 1;
      }
      const total = tasks.length;
      return {
        total,
        ...counts,
        completion: total === 0 ? 0 : Math.round((counts.done / total) * 100),
        overdue,
      };
    },
  };

  TF.store = store;
})((window.TaskFlow = window.TaskFlow || {}));
