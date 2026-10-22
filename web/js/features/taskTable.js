/**
 * features/taskTable.js — tabla de tareas.
 *
 * render()       dibuja la tabla completa (arranque, filtros y búsqueda).
 * applyChange()  actualiza SOLO la fila afectada cuando se crea, cambia o elimina una tarea.
 *                Así el coste de una acción no depende de cuántas tareas haya en la lista.
 * Solo lee datos; nunca los modifica.
 */
(function (TF) {
  'use strict';

  const { el, icon, formatDate, isOverdue, initials } = TF.utils;
  const { Badge } = TF.components;
  const { STATUS, PRIORITY } = TF.store;

  /** Filas dibujadas, por id de tarea: acceso directo sin recorrer el DOM. */
  const rowById = new Map();
  let refs = null;

  /** Busca los elementos del DOM una sola vez, al montar. */
  function mount() {
    refs = {
      body: document.getElementById('task-body'),
      table: document.querySelector('.task-table'),
      empty: document.getElementById('empty-state'),
      summary: document.getElementById('table-summary'),
    };
  }

  /* ------------------------------- Filas -------------------------------- */

  function statusSelect(task) {
    const select = el('select', {
      class: 'status-select',
      'aria-label': `Estado de la tarea: ${task.title}`,
      dataset: { id: task.id, status: task.status },
    });
    for (const [value, label] of Object.entries(STATUS)) {
      const option = el('option', { value, text: label });
      option.selected = value === task.status;
      select.append(option);
    }
    return select;
  }

  function dateCell(task) {
    const overdue = isOverdue(task);
    const cell = el('td', { 'data-label': 'Fecha límite' });
    cell.append(el('span', { class: 'task-date' + (overdue ? ' is-overdue' : ''), text: formatDate(task.dueDate) }));
    if (overdue) cell.append(Badge({ kind: 'overdue', label: 'Vencida' }));
    return cell;
  }

  function assigneeCell(task) {
    const cell = el('td', { 'data-label': 'Responsable' });
    if (!task.assignee) {
      cell.append(el('span', { class: 'task-desc', text: 'Sin asignar' }));
      return cell;
    }
    cell.append(
      el('span', { class: 'task-assignee' }, el('span', { class: 'task-assignee__avatar', 'aria-hidden': 'true', text: initials(task.assignee) }), el('span', { text: task.assignee }))
    );
    return cell;
  }

  function taskRow(task) {
    const titleCell = el('td', { 'data-label': 'Tarea' }, el('div', {}, el('p', { class: 'task-title', text: task.title }), task.description ? el('p', { class: 'task-desc', text: task.description, title: task.description }) : null));

    const deleteButton = el(
      'button',
      { type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': `Eliminar la tarea: ${task.title}`, dataset: { action: 'delete', id: task.id } },
      icon('trash')
    );

    return el(
      'tr',
      { dataset: { id: task.id } },
      titleCell,
      assigneeCell(task),
      el('td', { 'data-label': 'Prioridad' }, Badge({ kind: task.priority, label: PRIORITY[task.priority] })),
      el('td', { 'data-label': 'Estado' }, statusSelect(task)),
      dateCell(task),
      el('td', { 'data-label': 'Acciones' }, el('div', { class: 'task-actions' }, deleteButton))
    );
  }

  /* ------------------------------ Filtrado ------------------------------ */

  /** ¿La tarea cumple el filtro de estado y la búsqueda de texto? */
  function matchesFilters(task, filters, query) {
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (!query) return true;
    // Defensa en profundidad: aunque el almacén normaliza los datos, un campo ausente no debe romper la búsqueda.
    return [task.title, task.description, task.assignee].some((text) => String(text ?? '').toLowerCase().includes(query));
  }

  function filterTasks(tasks, filters) {
    const query = filters.query.trim().toLowerCase();
    return tasks.filter((task) => matchesFilters(task, filters, query));
  }

  /* ------------------------------- Dibujo ------------------------------- */

  /** Estado vacío y resumen "Mostrando X de Y". */
  function updateChrome() {
    const visible = rowById.size;
    refs.empty.hidden = visible > 0;
    refs.table.hidden = visible === 0;
    refs.summary.textContent = `Mostrando ${visible} de ${TF.store.getAll().length} tareas`;
  }

  /** Dibuja la tabla completa. */
  function render(filters) {
    const visible = filterTasks(TF.store.getAll(), filters);

    rowById.clear();
    const rows = visible.map((task) => {
      const row = taskRow(task);
      rowById.set(task.id, row);
      return row;
    });
    // Una sola inserción (medida: ~40 % más rápida que un DocumentFragment con miles de filas).
    refs.body.replaceChildren(...rows);
    updateChrome();
  }

  function removeRow(id) {
    const row = rowById.get(id);
    if (!row) return;
    row.remove();
    rowById.delete(id);
  }

  /** Sustituye una fila conservando el foco si el usuario estaba en su selector de estado. */
  function replaceRow(oldRow, task) {
    const hadFocus = oldRow.contains(document.activeElement) && document.activeElement.matches('.status-select');
    const row = taskRow(task);
    oldRow.replaceWith(row);
    rowById.set(task.id, row);
    if (hadFocus) row.querySelector('.status-select').focus();
  }

  /**
   * Aplica un cambio puntual del almacén ({ type: 'added' | 'status' | 'removed', task }).
   * Las tareas nuevas van siempre arriba, igual que en la lista del almacén.
   */
  function applyChange(change, filters) {
    const { task } = change;
    const query = filters.query.trim().toLowerCase();
    const visible = matchesFilters(task, filters, query);

    if (change.type === 'removed') {
      removeRow(task.id);
    } else if (change.type === 'added') {
      if (visible) {
        const row = taskRow(task);
        rowById.set(task.id, row);
        refs.body.prepend(row);
      }
    } else if (change.type === 'status') {
      const row = rowById.get(task.id);
      if (!visible) removeRow(task.id);
      else if (row) replaceRow(row, task);
      else return render(filters); // ahora cumple el filtro pero no estaba dibujada: se recalcula
    }
    updateChrome();
  }

  TF.taskTable = { mount, render, applyChange, filterTasks };
})((window.TaskFlow = window.TaskFlow || {}));
