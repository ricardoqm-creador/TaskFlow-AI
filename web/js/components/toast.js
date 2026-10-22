/**
 * components/toast.js — avisos breves en la esquina de la pantalla.
 */
(function (TF) {
  'use strict';

  const { el, icon } = TF.utils;

  function show(message, duration = 3200) {
    const container = document.getElementById('toasts');
    if (!container) return;

    const toast = el('div', { class: 'toast', role: 'status' }, icon('check'), el('span', { text: message }));
    container.append(toast);

    setTimeout(() => {
      toast.classList.add('is-leaving');
      setTimeout(() => toast.remove(), 260);
    }, duration);
  }

  TF.toast = { show };
})((window.TaskFlow = window.TaskFlow || {}));
