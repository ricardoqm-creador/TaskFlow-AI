import type { z } from "zod";
import { getConfig } from "../config.js";
import { askStructured } from "../integrations/claude/claudeClient.js";
import {
  PrioritySchema,
  SubtasksSchema,
  SYSTEM_PROMPT,
  priorityPrompt,
  subtasksPrompt,
  type TaskContext,
} from "../prompts/suggestionPrompts.js";

export type SuggestionKind = "subtasks" | "priority";

// Contrato con la capa de datos (tabla ai_suggestions). Impleméntalo con tu ORM o SQL.
export interface SuggestionRepository {
  createPending(input: { taskId: number; userId: number; kind: SuggestionKind; prompt: string }): Promise<number>;
  complete(id: number, input: { response: unknown; model: string }): Promise<void>;
  fail(id: number, reason: string): Promise<void>;
}

/** Función que consulta a la IA. Se inyecta para poder sustituirla en las pruebas. */
export type AskFn = (opts: { system: string; user: string; schema: z.ZodType }) => Promise<{ data: unknown; model: string }>;

export class AiSuggestionService {
  constructor(
    private readonly repo: SuggestionRepository,
    private readonly ask: AskFn = askStructured,
  ) {}

  async suggest(args: { taskId: number; userId: number; kind: SuggestionKind; task: TaskContext }) {
    // Limita el tamaño del contexto enviado (control de coste y de datos expuestos).
    const task: TaskContext = {
      ...args.task,
      title: args.task.title.slice(0, 200),
      description: args.task.description?.slice(0, getConfig().maxInputChars),
    };

    const prompt = args.kind === "subtasks" ? subtasksPrompt(task) : priorityPrompt(task);
    const id = await this.repo.createPending({ taskId: args.taskId, userId: args.userId, kind: args.kind, prompt });

    try {
      const schema = args.kind === "subtasks" ? SubtasksSchema : PrioritySchema;
      const result = await this.ask({ system: SYSTEM_PROMPT, user: prompt, schema });
      await this.repo.complete(id, { response: result.data, model: result.model });
      return { id, suggestion: result.data };
    } catch (error) {
      // Guardamos solo el código; nunca el mensaje crudo ni la clave.
      await this.repo.fail(id, error instanceof Error ? error.name : "UNKNOWN");
      throw error; // el controlador decide qué mostrar al usuario
    }
  }
}
