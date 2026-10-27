/**
 * El catálogo de prioridades vive en tres sitios (web, IA y base de datos).
 * Esta prueba falla si alguno se desalinea, para que no vuelva a pasar en silencio.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

globalThis.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null, setItem() {}, removeItem() {} },
});
for (const file of ['core/config', 'core/utils', 'core/storage', 'core/store']) {
  await import(`../web/js/${file}.js`);
}
const { PRIORITIES } = await import('../src/prompts/suggestionPrompts.ts');

const sorted = (values) => [...values].sort();

function sqlPriorities() {
  const schema = readFileSync(new URL('../db/migrations/001_schema.sql', import.meta.url), 'utf8');
  const check = schema.match(/tasks_priority_check\s+CHECK \(priority IN \(([^)]+)\)\)/);
  assert.ok(check, 'no se encontró la restricción tasks_priority_check');
  return check[1].split(',').map((value) => value.trim().replace(/'/g, ''));
}

test('las prioridades de la web, la IA y la base de datos coinciden', () => {
  const web = Object.keys(globalThis.TaskFlow.store.PRIORITY);
  assert.deepEqual(sorted(web), sorted(PRIORITIES), 'web frente a IA');
  assert.deepEqual(sorted(web), sorted(sqlPriorities()), 'web frente a base de datos');
});

test('el formulario de la web ofrece todas las prioridades del catálogo', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const select = html.match(/<select[^>]*id="f-priority"[^>]*>([\s\S]*?)<\/select>/);
  const options = [...select[1].matchAll(/value="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sorted(options), sorted(PRIORITIES));
});

test('una tarea urgente se crea, se guarda y se recupera', () => {
  const { store } = globalThis.TaskFlow;
  store.init();
  const task = store.add({ title: 'Servidor caído', priority: 'urgent' });
  assert.equal(task.priority, 'urgent');
  assert.equal(store.PRIORITY[task.priority], 'Urgente');
});
