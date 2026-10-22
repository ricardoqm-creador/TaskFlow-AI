/**
 * components/badge.js — insignia de texto reutilizable.
 * El aspecto sale de la clase `badge--{kind}` (alta, media, baja, vencida...).
 */
(function (TF) {
  'use strict';

  const { el } = TF.utils;

  /** @param {{ kind: string, label: string, extraClass?: string }} options */
  function Badge({ kind, label, extraClass = '' }) {
    return el('span', { class: `badge badge--${kind}${extraClass ? ' ' + extraClass : ''}`, text: label });
  }

  TF.components = Object.assign(TF.components || {}, { Badge });
})((window.TaskFlow = window.TaskFlow || {}));
