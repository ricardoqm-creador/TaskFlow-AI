/**
 * utils.js — utilidades compartidas.
 * Todo el proyecto cuelga del espacio de nombres global `TaskFlow`.
 */
(function (TF) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /**
   * Crea un elemento DOM sin usar innerHTML (evita inyección de código).
   * @param {string} tag
   * @param {Object} [props] class, text, dataset, onXxx o cualquier atributo
   * @param {...(Node|string)} children
   */
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children.flat()) {
      if (child !== null && child !== undefined) node.append(child);
    }
    return node;
  }

  /** Icono del sprite SVG definido en index.html. */
  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', '#i-' + name);
    svg.append(use);
    return svg;
  }

  /** Fecha de hoy en formato ISO local (YYYY-MM-DD). */
  function todayISO() {
    return toISO(new Date());
  }

  function toISO(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  /** Fecha de hoy más `days` días, en formato ISO (YYYY-MM-DD). */
  function addDaysISO(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toISO(date);
  }

  // Crear un formateador de fechas es caro: se crea una sola vez y se recuerda el resultado
  // de cada fecha, que se repite mucho entre tareas.
  const DATE_FORMAT = new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedDates = new Map();

  /** '2026-10-22' → '22 oct 2026'. */
  function formatDate(iso) {
    if (!iso) return 'Sin fecha';
    let text = formattedDates.get(iso);
    if (text === undefined) {
      const date = new Date(iso + 'T00:00:00');
      text = Number.isNaN(date.getTime()) ? 'Sin fecha' : DATE_FORMAT.format(date);
      formattedDates.set(iso, text);
    }
    return text;
  }

  /** Una tarea está vencida si su fecha ya pasó y no está completada. */
  function isOverdue(task) {
    return Boolean(task.dueDate) && task.status !== 'done' && task.dueDate < todayISO();
  }

  /** 'María López' → 'ML'. */
  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '–';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  /** Ejecuta `fn` solo cuando han pasado `waitMs` sin nuevas llamadas. */
  function debounce(fn, waitMs) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), waitMs);
    };
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  TF.utils = {
    el,
    icon,
    addDaysISO,
    formatDate,
    isOverdue,
    initials,
    debounce,
    generateId,
    prefersReducedMotion,
  };
})((window.TaskFlow = window.TaskFlow || {}));
