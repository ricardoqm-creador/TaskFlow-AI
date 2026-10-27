/**
 * core/config.js — valores de configuración de la interfaz, en un solo lugar.
 * Se carga antes que el resto de módulos.
 */
(function (TF) {
  'use strict';

  TF.config = Object.freeze({
    timing: Object.freeze({
      /** Espera tras la última tecla antes de filtrar la tabla. */
      searchDebounceMs: 180,
      /** Tiempo que un aviso permanece visible. */
      toastVisibleMs: 3200,
      /** Retirada del aviso si el navegador no emite `transitionend` (sin animaciones, por ejemplo). */
      toastExitFallbackMs: 1000,
      /** Duración de la animación de los números de las tarjetas. */
      countUpMs: 600,
    }),
  });
})((window.TaskFlow = window.TaskFlow || {}));
