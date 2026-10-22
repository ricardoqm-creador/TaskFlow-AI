/**
 * features/taskDialog.js — formulario "Nueva tarea" (con validación).
 * El comportamiento común de los diálogos (cerrar, fondo, foco) vive en components/dialog.js.
 */
(function (TF) {
  'use strict';

  /** Busca los elementos una sola vez y devuelve la API del diálogo. */
  function init() {
    const dialog = TF.components.createDialog(document.getElementById('task-dialog'));
    const form = document.getElementById('task-form');
    const titleInput = document.getElementById('f-title');
    const titleError = document.getElementById('e-title');

    function setTitleError(message) {
      titleError.textContent = message;
      titleInput.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    /** @returns {boolean} true si el formulario es válido */
    function validate() {
      const problem = TF.store.titleError(titleInput.value); // misma regla que aplica el almacén
      if (problem) {
        setTitleError(problem);
        titleInput.focus();
        return false;
      }
      setTitleError('');
      return true;
    }

    function open() {
      form.reset();
      setTitleError('');
      dialog.open();
      titleInput.focus();
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!validate()) return;

      TF.store.add(Object.fromEntries(new FormData(form).entries()));
      dialog.close();
      TF.toast.show('Tarea creada correctamente');
    });

    titleInput.addEventListener('input', () => {
      if (titleError.textContent) setTitleError('');
    });

    return { open };
  }

  TF.taskDialog = { init };
})((window.TaskFlow = window.TaskFlow || {}));
