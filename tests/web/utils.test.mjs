/** Pruebas de las utilidades puras de la web (no necesitan DOM). */
import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = globalThis;
await import('../../web/js/core/utils.js');
const { formatDate, initials, isOverdue, addDaysISO } = globalThis.TaskFlow.utils;

test('formatDate da el formato corto en español', () => {
  assert.equal(formatDate('2026-10-22'), new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date('2026-10-22T00:00:00')));
  assert.match(formatDate('2026-10-22'), /22.*oct.*2026/i);
});

test('formatDate devuelve "Sin fecha" para vacíos y fechas inválidas', () => {
  for (const value of ['', null, undefined, 'no-es-fecha']) assert.equal(formatDate(value), 'Sin fecha');
});

test('formatDate da siempre el mismo resultado al repetirse (caché)', () => {
  assert.equal(formatDate('2026-11-05'), formatDate('2026-11-05'));
  assert.equal(formatDate('no-es-fecha'), formatDate('no-es-fecha'));
});

test('initials toma la inicial de las dos primeras palabras', () => {
  assert.equal(initials('Leo Marín'), 'LM');
  assert.equal(initials('  sol  '), 'S');
  assert.equal(initials(''), '–');
  assert.equal(initials(undefined), '–');
});

test('isOverdue: solo las tareas con fecha pasada y sin completar', () => {
  assert.equal(isOverdue({ dueDate: addDaysISO(-1), status: 'pending' }), true);
  assert.equal(isOverdue({ dueDate: addDaysISO(-1), status: 'done' }), false);
  assert.equal(isOverdue({ dueDate: addDaysISO(1), status: 'pending' }), false);
  assert.equal(isOverdue({ dueDate: '', status: 'pending' }), false);
});
