/**
 * Verifica las migraciones SQL contra un PostgreSQL real (PGlite, en memoria; no necesita
 * instalar nada) y comprueba con datos de prueba que las restricciones del diseño funcionan.
 *
 *   npm run db:check
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const db = new PGlite();

let failures = 0;
const report = (ok, message) => {
  console.log(`${ok ? '✔' : '✘'} ${message}`);
  if (!ok) failures += 1;
};

/** Ejecuta una sentencia que DEBE fallar (restricción violada). */
async function expectError(label, sql) {
  try {
    await db.exec(sql);
    report(false, `${label} (debía fallar y se aceptó)`);
  } catch {
    report(true, label);
  }
}

// 1. Aplicar las migraciones en orden.
for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
  try {
    await db.exec(readFileSync(join(dir, file), 'utf8'));
    report(true, `Migración aplicada: ${file}`);
  } catch (error) {
    report(false, `Migración ${file}: ${error.message}`);
    process.exit(1);
  }
}

const count = async (sql) => Number((await db.query(sql)).rows[0].n);

// 2. Datos de prueba.
await db.exec(`
  INSERT INTO users (name, email, password_hash) VALUES ('Aurora', 'aurora@example.com', 'x'), ('Leo', 'leo@example.com', 'x');
  INSERT INTO workspaces (name, owner_id) VALUES ('Equipo', 1);
  INSERT INTO projects (workspace_id, name, created_by) VALUES (1, 'A', 1), (1, 'B', 1);
  INSERT INTO task_statuses (project_id, name) VALUES (1, 'Por hacer'), (2, 'Por hacer');
  INSERT INTO tasks (project_id, status_id, title, created_by) VALUES (1, 1, 'Tarea 1', 1);
  INSERT INTO comments (task_id, user_id, body) VALUES (1, 2, 'Hola');
  INSERT INTO task_assignees (task_id, user_id) VALUES (1, 2);
`);

// 3. Restricciones del diseño.
await expectError('Email duplicado sin distinguir mayúsculas',
  `INSERT INTO users (name, email, password_hash) VALUES ('X', 'AURORA@example.com', 'x');`);
await expectError('Email con formato inválido',
  `INSERT INTO users (name, email, password_hash) VALUES ('X', 'no-es-email', 'x');`);
await expectError('Estado de OTRO proyecto en una tarea (FK compuesta)',
  `INSERT INTO tasks (project_id, status_id, title, created_by) VALUES (1, 2, 'Mal', 1);`);
await expectError('Prioridad fuera de catálogo',
  `INSERT INTO tasks (project_id, status_id, title, created_by, priority) VALUES (1, 1, 'Mal', 1, 'critica');`);
await expectError('Título en blanco',
  `INSERT INTO tasks (project_id, status_id, title, created_by) VALUES (1, 1, '   ', 1);`);
await expectError('Tarea que es su propio padre',
  `UPDATE tasks SET parent_task_id = id WHERE id = 1;`);
await expectError('Fin de tiempo anterior al inicio',
  `INSERT INTO time_entries (task_id, user_id, started_at, ended_at) VALUES (1, 1, now(), now() - interval '1 hour');`);
await expectError('Color de etiqueta inválido',
  `INSERT INTO labels (workspace_id, name, color) VALUES (1, 'x', 'rojo');`);
await expectError('Evento duplicado (dedupe_key único)',
  `INSERT INTO automation_events (event_type, entity_type, dedupe_key) VALUES ('task.created', 'task', 'k1'), ('task.created', 'task', 'k1');`);
await expectError('Estado de evento inválido',
  `INSERT INTO automation_events (event_type, entity_type, status) VALUES ('task.created', 'task', 'raro');`);
await expectError('No se puede borrar un usuario creador de tareas (RESTRICT)',
  `DELETE FROM users WHERE id = 1;`);

// 4. Comportamiento: updated_at, cascada y registro de auditoría que sobrevive.
const before = (await db.query(`SELECT updated_at FROM tasks WHERE id = 1`)).rows[0].updated_at;
await db.exec(`SELECT pg_sleep(0.05); UPDATE tasks SET title = 'Tarea 1 editada' WHERE id = 1;`);
const after = (await db.query(`SELECT updated_at FROM tasks WHERE id = 1`)).rows[0].updated_at;
report(after > before, 'El trigger actualiza updated_at');

await db.exec(`INSERT INTO automation_events (event_type, entity_type, entity_id) VALUES ('task.deleted', 'task', 1);`);
await db.exec(`DELETE FROM tasks WHERE id = 1;`);
report((await count(`SELECT count(*) AS n FROM comments`)) === 0, 'Borrar la tarea elimina sus comentarios (cascada)');
report((await count(`SELECT count(*) AS n FROM task_assignees`)) === 0, 'Borrar la tarea elimina sus responsables (cascada)');
report((await count(`SELECT count(*) AS n FROM automation_events WHERE entity_id = 1`)) === 1, 'El evento de auditoría sobrevive al borrado de la tarea');

const tables = await count(`SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'public'`);
console.log(`\n${tables} tablas creadas.`);

if (failures > 0) {
  console.error(`\n${failures} comprobación(es) fallida(s).`);
  process.exit(1);
}
console.log('Todas las comprobaciones pasaron.');
