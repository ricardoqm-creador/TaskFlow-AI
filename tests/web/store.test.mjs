/**
 * Pruebas del almacén y del filtro de la web. Los scripts de la web son IIFE que cuelgan de
 * window.TaskFlow, así que se simula `window` y `localStorage` en Node antes de cargarlos.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const memory = new Map();
const KEY = 'taskflow.tasks.v1';

globalThis.window = globalThis;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  },
});

// Mismo orden que los <script> de web/index.html (solo los que no necesitan DOM al cargar).
for (const file of ['core/config', 'core/utils', 'core/storage', 'core/store', 'components/badge', 'features/taskTable']) {
  await import(`../../web/js/${file}.js`);
}
const { store, taskTable: render } = globalThis.TaskFlow;

const valid = { id: 'a1', title: 'Tarea válida', status: 'pending', priority: 'low' };
const load = (records) => {
  memory.set(KEY, JSON.stringify(records));
  store.init();
  return store.getAll();
};

beforeEach(() => memory.clear());

/* --------------------- E1: registros guardados incompletos --------------------- */

test('rellena description, assignee y dueDate que falten en un registro guardado', () => {
  const [task] = load([valid]);
  assert.equal(task.description, '');
  assert.equal(task.assignee, '');
  assert.equal(task.dueDate, '');
  assert.equal(typeof task.createdAt, 'string');
});

test('descarta los registros irrecuperables y conserva los válidos', () => {
  const tasks = load([
    valid,
    null,
    'texto',
    { ...valid, id: '' },
    { ...valid, id: 'b', title: '   ' },
    { ...valid, id: 'c', status: 'archivada' },
    { ...valid, id: 'd', priority: 'critica' },
  ]);
  assert.deepEqual(tasks.map((task) => task.id), ['a1']);
});

test('los campos con tipo incorrecto no llegan a la interfaz como objetos', () => {
  const [task] = load([{ ...valid, description: { x: 1 }, assignee: 42, dueDate: 'mañana' }]);
  assert.equal(task.description, '');
  assert.equal(task.assignee, '');
  assert.equal(task.dueDate, '');
});

test('JSON corrupto: vuelve a los datos de ejemplo en lugar de romper', () => {
  memory.set(KEY, '{esto no es json');
  store.init();
  assert.equal(store.getAll().length, 8);
});

test('una lista vacía guardada se respeta (no se vuelve a sembrar)', () => {
  assert.deepEqual(load([]), []);
});

test('el filtro no lanza aunque a una tarea le falten campos', () => {
  const crudas = [{ id: 'x', title: 'Registro antiguo', status: 'pending', priority: 'low' }];
  assert.doesNotThrow(() => render.filterTasks(crudas, { status: 'all', query: 'zzzz' }));
  assert.deepEqual(render.filterTasks(crudas, { status: 'all', query: 'zzzz' }), []);
  assert.equal(render.filterTasks(crudas, { status: 'all', query: 'antiguo' }).length, 1);
});

test('el filtro combina estado y texto', () => {
  const tasks = [
    { ...valid, id: '1', title: 'Pagar factura', description: '', assignee: 'Ana' },
    { ...valid, id: '2', title: 'Llamar a Ana', description: '', assignee: '', status: 'done' },
  ];
  assert.equal(render.filterTasks(tasks, { status: 'all', query: 'ana' }).length, 2);
  assert.equal(render.filterTasks(tasks, { status: 'done', query: 'ana' }).length, 1);
});

/* ------------------------ E5: validación del título ------------------------ */

test('add rechaza títulos vacíos, en blanco o demasiado cortos y no crea la tarea', () => {
  store.init();
  const before = store.getAll().length;
  for (const title of ['', '   ', 'ab', undefined, null, 123]) {
    assert.throws(() => store.add({ title }), RangeError);
  }
  assert.throws(() => store.add(undefined), RangeError);
  assert.equal(store.getAll().length, before);
});

test('titleError es la regla única que usa también el formulario', () => {
  assert.match(store.titleError('ab'), /al menos 3/);
  assert.equal(store.titleError('abc'), '');
  assert.equal(store.titleError('  abc  '), '');
});

test('add recorta a los límites y sanea prioridad, estado y fecha', () => {
  store.init();
  const task = store.add({
    title: 'x'.repeat(500),
    description: 'd'.repeat(999),
    assignee: 'a'.repeat(200),
    priority: 'inventada',
    status: 'inventado',
    dueDate: '30/10/2026',
  });
  assert.equal(task.title.length, store.LIMITS.title);
  assert.equal(task.description.length, store.LIMITS.description);
  assert.equal(task.assignee.length, store.LIMITS.assignee);
  assert.equal(task.priority, 'medium');
  assert.equal(task.status, 'pending');
  assert.equal(task.dueDate, '');
});

/* --------------------------- Eventos del almacén --------------------------- */

test('setStatus emite evento solo cuando el estado cambia de verdad', () => {
  const [task] = load([valid]);
  const events = [];
  const unsubscribe = store.onEvent((event) => events.push(event));

  store.setStatus(task.id, 'pending'); // mismo estado
  store.setStatus(task.id, 'inventado'); // estado inválido
  assert.equal(events.length, 0);

  store.setStatus(task.id, 'done');
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].action, events[0].from, events[0].to], ['status', 'pending', 'done']);
  unsubscribe();
});

/* ------------- Avisos de cambio (permiten actualizar solo una fila) ------------- */

test('subscribe recibe QUÉ cambió: added, status y removed', () => {
  load([valid]);
  const changes = [];
  const unsubscribe = store.subscribe((tasks, change) => changes.push(change));

  const nueva = store.add({ title: 'Nueva tarea' });
  store.setStatus(nueva.id, 'done');
  store.remove(nueva.id);
  unsubscribe();

  assert.deepEqual(changes.map((c) => c.type), ['added', 'status', 'removed']);
  assert.equal(changes[0].task.id, nueva.id);
  assert.equal(changes[1].task.status, 'done');
  assert.equal(changes[1].from, 'pending');
  assert.equal(changes[2].task.id, nueva.id);
});

test('un cambio de estado no avisa si el estado es el mismo', () => {
  const [task] = load([valid]);
  const changes = [];
  store.subscribe((tasks, change) => changes.push(change));
  store.setStatus(task.id, 'pending');
  assert.equal(changes.length, 0);
});

/* ------------------------- Conteo de estadísticas ------------------------- */

test('stats cuenta por estado, calcula el porcentaje y las vencidas en una pasada', () => {
  load([
    { ...valid, id: '1', status: 'pending', dueDate: '2000-01-01' }, // vencida
    { ...valid, id: '2', status: 'progress', dueDate: '2000-01-01' }, // vencida
    { ...valid, id: '3', status: 'done', dueDate: '2000-01-01' }, // completada: no cuenta como vencida
    { ...valid, id: '4', status: 'done' },
  ]);
  assert.deepEqual(store.stats(), { total: 4, pending: 1, progress: 1, done: 2, completion: 50, overdue: 2 });
});

test('stats con lista vacía no divide por cero', () => {
  load([]);
  assert.deepEqual(store.stats(), { total: 0, pending: 0, progress: 0, done: 0, completion: 0, overdue: 0 });
});
