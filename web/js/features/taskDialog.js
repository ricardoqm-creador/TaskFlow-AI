/**
 * features/taskDialog.js — formulario "Nueva tarea" (con validación).
 * El comportamiento común de los diálogos (cerrar, fondo, foco) vive en components/dialog.js.
 */
(function (TF) {
  'use strict';

  /**
   * Valida el título con la misma regla que el almacén y muestra el error junto al campo.
   * Reutilizable por cualquier formulario que tenga un título (por ejemplo, la futura edición).
   */
  function createTitleValidator(input, errorElement) {
    function showError(message) {
      errorElement.textContent = message;
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    input.addEventListener('input', () => {
      if (errorElement.textContent) showError('');
    });

    return {
      /** @returns {boolean} true si el título es válido; si no, muestra el error y enfoca el campo */
      isValid() {
        const problem = TF.store.titleError(input.value);
        showError(problem);
        if (problem) input.focus();
        return !problem;
      },
      reset: () => showError(''),
    };
  }

  /** Busca los elementos una sola vez y devuelve la API del diálogo. */
  function init() {
    const dialog = TF.components.createDialog(document.getElementById('task-dialog'));
    const form = document.getElementById('task-form');
    const titleInput = document.getElementById('f-title');
    const title = createTitleValidator(titleInput, document.getElementById('e-title'));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!title.isValid()) return;

      TF.store.add(Object.fromEntries(new FormData(form).entries()));
      dialog.close();
      TF.toast.show('Tarea creada correctamente');
    });

    function open() {
      form.reset();
      title.reset();
      dialog.open();
      titleInput.focus();
    }

    return { open };
  }

  TF.taskDialog = { init, createTitleValidator };
})((window.TaskFlow = window.TaskFlow || {}));
