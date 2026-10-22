import { AiError } from "../errors.js";
import { AiSuggestionService, type SuggestionRepository } from "../services/aiSuggestion.service.js";

// Repositorio en memoria solo para probar sin base de datos.
const memoryRepo: SuggestionRepository = {
  async createPending() { return 1; },
  async complete(id, input) { console.log("guardado", id, input.model); },
  async fail(id, reason) { console.log("fallo", id, reason); },
};

try {
  const service = new AiSuggestionService(memoryRepo);
  const { suggestion } = await service.suggest({
    taskId: 1,
    userId: 1,
    kind: "subtasks",
    task: { title: "Lanzar la landing de TaskFlow AI", description: "Incluye diseño, texto y publicación." },
  });
  console.log(JSON.stringify(suggestion, null, 2));
} catch (error) {
  if (error instanceof AiError) {
    console.error(`[${error.code}] ${error.message} (reintentable: ${error.retryable})`);
  } else {
    console.error("Error inesperado:", error);
  }
  process.exitCode = 1;
}
