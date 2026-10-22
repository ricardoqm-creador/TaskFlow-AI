/**
 * components/dialog.js — diálogos modales reutilizables sobre el <dialog> nativo.
 *
 * createDialog        comportamiento común: abrir, cerrar, botones [data-close] y clic en el fondo.
 * createConfirmDialog diálogo de confirmación que devuelve una promesa<boolean>.
 */
(function (TF) {
  'use strict';

  /**
   * @param {HTMLDialogElement} dialog
   * @returns {{ element: HTMLDialogElement, open(): void, close(value?: string): void }}
   */
  function createDialog(dialog) {
    // Solo se cierra si el clic EMPIEZA y TERMINA en el fondo: arrastrar el ratón desde
    // un campo hasta fuera del diálogo no debe cerrarlo ni hacer perder lo escrito.
    let pressedOnBackdrop = false;
    dialog.addEventListener('pointerdown', (event) => {
      pressedOnBackdrop = event.target === dialog;
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog && pressedOnBackdrop) dialog.close();
    });
    dialog.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => dialog.close());
    });

    return {
      element: dialog,
      open: () => dialog.showModal(),
      close: (value) => dialog.close(value),
    };
  }

  /**
   * El botón pulsado (`value="ok"` confirma, cualquier otro cancela) se lee del evento `submit`
   * y no solo de `close`: así el resultado no depende de un único evento del navegador.
   * @param {HTMLDialogElement} dialog
   * @param {HTMLElement} messageElement donde se escribe el texto de la pregunta
   */
  function createConfirmDialog(dialog, messageElement) {
    const base = createDialog(dialog);
    const form = dialog.querySelector('form');
    let settlePrevious = null;

    /** @returns {Promise<boolean>} true si el usuario confirma */
    function ask(message) {
      if (settlePrevious) settlePrevious(false); // una pregunta anterior sin resolver se descarta
      messageElement.textContent = message;
      dialog.returnValue = 'cancel';
      dialog.showModal();

      return new Promise((resolve) => {
        let done = false;
        const finish = (confirmed) => {
          if (done) return;
          done = true;
          form.removeEventListener('submit', onSubmit);
          dialog.removeEventListener('close', onClose);
          settlePrevious = null;
          resolve(confirmed);
        };
        const onSubmit = (event) => finish(event.submitter?.value === 'ok');
        const onClose = () => finish(dialog.returnValue === 'ok'); // Esc o cierre sin pulsar botón

        form.addEventListener('submit', onSubmit);
        dialog.addEventListener('close', onClose);
        settlePrevious = finish;
      });
    }

    return { ...base, ask };
  }

  TF.components = Object.assign(TF.components || {}, { createDialog, createConfirmDialog });
})((window.TaskFlow = window.TaskFlow || {}));
