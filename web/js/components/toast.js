/**
 * components/toast.js — avisos breves en la esquina de la pantalla.
 */
(function (TF) {
  'use strict';

  const { el, icon } = TF.utils;
  const { toastVisibleMs, toastExitFallbackMs } = TF.config.timing;

  /** Retira el aviso cuando termina su transición de salida (definida en CSS). */
  function dismiss(toast) {
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), toastExitFallbackMs);
  }

  function show(message, duration = toastVisibleMs) {
    const container = document.getElementById('toasts');
    if (!container) return;

    const toast = el('div', { class: 'toast', role: 'status' }, icon('check'), el('span', { text: message }));
    container.append(toast);
    setTimeout(() => dismiss(toast), duration);
  }

  TF.toast = { show };
})((window.TaskFlow = window.TaskFlow || {}));
