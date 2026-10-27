/** Pruebas de los escenarios de la simulación (funciones puras, no necesitan DOM). */
import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null, setItem() {}, removeItem() {} },
});
for (const file of ['core/config', 'core/utils', 'core/storage', 'core/store', 'features/simulation']) {
  await import(`../../web/js/${file}.js`);
}
const { created, status, deleted } = globalThis.TaskFlow.simulation.scenarios;

const task = (overrides = {}) => ({ id: 'x', title: 'Tarea', assignee: 'Leo Marín', dueDate: '2026-10-30', priority: 'high', status: 'pending', ...overrides });
const texts = (scenario) => scenario.steps.map((step) => step.text);
const states = (scenario) => scenario.steps.map((step) => step.state).filter(Boolean);

test('los escenarios son puros: mismos datos, mismo resultado', () => {
  const options = { fail: false, aiRequestNumber: 3 };
  assert.deepEqual(created(task(), options), created(task(), options));
  assert.deepEqual(status(task(), { from: 'pending', to: 'done', fail: true }), status(task(), { from: 'pending', to: 'done', fail: true }));
});

test('crear: los eventos dependen de si hay responsable', () => {
  assert.deepEqual(created(task(), { fail: false, aiRequestNumber: 3 }).events, ['task.created', 'task.assigned', 'ai.suggestion_requested', 'ai.suggestion_ready']);
  assert.deepEqual(created(task({ assignee: '' }), { fail: false, aiRequestNumber: 3 }).events, ['task.created', 'ai.suggestion_requested', 'ai.suggestion_ready']);
});

test('crear: el límite diario de IA se respeta', () => {
  assert.ok(texts(created(task(), { fail: false, aiRequestNumber: 20 })).some((text) => text.includes('20 de 20 peticiones')));
  const overLimit = created(task(), { fail: false, aiRequestNumber: 21 });
  assert.ok(texts(overLimit).some((text) => text.includes('Límite diario de IA alcanzado')));
  assert.ok(!texts(overLimit).some((text) => text.includes('Claude') || text.includes('subtareas sugeridas')));
});

test('crear: el fallo de Calendar solo aparece con fecha límite y la opción activada', () => {
  assert.ok(states(created(task(), { fail: true, aiRequestNumber: 3 })).includes('fail'));
  assert.ok(!states(created(task(), { fail: false, aiRequestNumber: 3 })).includes('fail'));
  assert.ok(!states(created(task({ dueDate: '' }), { fail: true, aiRequestNumber: 3 })).includes('fail'));
});

test('cambiar estado: completar añade task.completed y limpia integraciones', () => {
  const done = status(task(), { from: 'pending', to: 'done', fail: false });
  assert.deepEqual(done.events, ['task.status_changed', 'task.completed']);
  assert.ok(texts(done).some((text) => text.includes('marca como completado')));
  assert.deepEqual(status(task(), { from: 'pending', to: 'progress', fail: false }).events, ['task.status_changed']);
});

test('cambiar estado: reabrir una tarea con fecha restaura su evento', () => {
  assert.ok(texts(status(task(), { from: 'done', to: 'pending', fail: false })).some((text) => text.includes('Restaura el evento')));
  assert.ok(!texts(status(task({ dueDate: '' }), { from: 'done', to: 'pending', fail: false })).some((text) => text.includes('reabrió')));
});

test('eliminar: avisa al responsable solo si existe', () => {
  assert.ok(texts(deleted(task(), { fail: false })).some((text) => text.includes('Avisa a Leo Marín')));
  assert.ok(texts(deleted(task({ assignee: '' }), { fail: false })).some((text) => text.includes('no hay a quién avisar')));
});

test('todos los pasos tienen un momento simulado válido', () => {
  for (const scenario of [created(task(), { fail: true, aiRequestNumber: 3 }), status(task(), { from: 'done', to: 'pending', fail: true }), deleted(task(), { fail: true })]) {
    for (const step of scenario.steps.filter((s) => !s.group)) {
      assert.ok(Number.isInteger(step.atMs) && step.atMs >= 0, `paso sin momento válido: ${step.text}`);
    }
  }
});
