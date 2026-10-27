/**
 * features/stats.js — tarjetas de estadísticas del dashboard.
 * Define qué tarjetas existen (una sola lista) y las mantiene actualizadas.
 */
(function (TF) {
  'use strict';

  const { StatCard } = TF.components;
  const { prefersReducedMotion } = TF.utils;
  const { countUpMs } = TF.config.timing;

  const CARDS = [
    { key: 'total', label: 'Tareas totales', icon: 'layers' },
    { key: 'pending', label: 'Pendientes', icon: 'clock' },
    { key: 'progress', label: 'En progreso', icon: 'activity' },
    { key: 'done', label: 'Completadas', icon: 'check' },
  ];

  let container = null;

  /** Dibuja las tarjetas dentro de `root` (el <section class="stats">). */
  function mount(root) {
    container = root;
    container.replaceChildren(...CARDS.map(StatCard));
  }

  /** Anima el número desde su valor actual hasta el nuevo. */
  function animateNumber(node, to) {
    const from = Number(node.dataset.current || 0);
    node.dataset.current = String(to);

    if (prefersReducedMotion() || from === to) {
      node.textContent = String(to);
      return;
    }

    const start = performance.now();
    function frame(now) {
      const progress = Math.min((now - start) / countUpMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /** Recalcula los números y los textos de ayuda de cada tarjeta. */
  function update() {
    const stats = TF.store.stats();
    const hints = {
      total: stats.overdue > 0 ? `${stats.overdue} vencida${stats.overdue === 1 ? '' : 's'}` : 'Todo al día',
      pending: 'Esperando inicio',
      progress: 'En marcha',
      done: `${stats.completion}% del total`,
    };

    container.querySelectorAll('[data-stat]').forEach((card) => {
      const key = card.dataset.stat;
      animateNumber(card.querySelector('[data-role="value"]'), stats[key]);
      card.querySelector('[data-role="hint"]').textContent = hints[key];
    });
  }

  TF.stats = { mount, update };
})((window.TaskFlow = window.TaskFlow || {}));
