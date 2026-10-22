/**
 * components/statCard.js — tarjeta de estadística del dashboard.
 * Genera el mismo marcado para todas, en lugar de repetirlo a mano en el HTML.
 */
(function (TF) {
  'use strict';

  const { el, icon } = TF.utils;

  /** @param {{ key: string, label: string, icon: string }} options */
  function StatCard({ key, label, icon: iconName }) {
    return el(
      'article',
      { class: `stat-card stat-card--${key}`, dataset: { stat: key } },
      el('div', { class: 'stat-card__icon' }, icon(iconName)),
      el(
        'div',
        {},
        el('p', { class: 'stat-card__label', text: label }),
        el('p', { class: 'stat-card__value', 'data-role': 'value', text: '0' }),
        el('p', { class: 'stat-card__hint', 'data-role': 'hint' })
      )
    );
  }

  TF.components = Object.assign(TF.components || {}, { StatCard });
})((window.TaskFlow = window.TaskFlow || {}));
