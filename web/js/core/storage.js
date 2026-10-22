/**
 * storage.js — persistencia local (localStorage).
 * Es la única capa que sabe dónde se guardan los datos: cuando exista un
 * backend, solo habrá que sustituir este archivo.
 */
(function (TF) {
  'use strict';

  const KEY = 'taskflow.tasks.v1';

  /** @returns {Array|null} null si no hay datos guardados o no se pueden leer. */
  function load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('No se pudieron leer las tareas guardadas:', error);
      return null;
    }
  }

  function save(tasks) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(tasks));
      return true;
    } catch (error) {
      // Modo privado, almacenamiento lleno o bloqueado: la app sigue funcionando en memoria.
      console.warn('No se pudieron guardar las tareas:', error);
      return false;
    }
  }

  TF.storage = { load, save };
})((window.TaskFlow = window.TaskFlow || {}));
