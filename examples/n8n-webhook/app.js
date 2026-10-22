// Configuración local: cambia solo este bloque para apuntar a otro webhook.
const CONFIG = {
  webhookUrl: "http://localhost:5678/webhook-test/nueva-tarea",
  // Para producción (workflow activo) usa: "http://localhost:5678/webhook/nueva-tarea"
};

const formulario = document.getElementById("formulario");
const boton = document.getElementById("enviar");
const mensaje = document.getElementById("mensaje");

function mostrar(texto, clase = "") {
  mensaje.className = clase;
  mensaje.textContent = texto;
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const titulo = document.getElementById("titulo").value.trim();
  const prioridad = document.getElementById("prioridad").value;
  if (!titulo) return;

  boton.disabled = true;
  mostrar("Enviando...");

  try {
    const respuesta = await fetch(CONFIG.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        titulo,
        prioridad,
      }),
    });

    if (!respuesta.ok) throw new Error("El servidor respondió " + respuesta.status);

    mostrar("Tarea enviada correctamente.", "ok");
    formulario.reset();
  } catch (error) {
    // "Failed to fetch" suele indicar CORS no permitido o n8n sin escuchar.
    mostrar("No se pudo enviar: " + error.message, "error");
    console.error("Error al enviar la tarea:", error);
  } finally {
    boton.disabled = false;
  }
});
