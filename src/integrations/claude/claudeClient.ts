import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { getConfig } from "../../config.js";
import { AiError } from "../../errors.js";

// Un único cliente por proceso, creado al primer uso. El SDK reintenta solo
// 408/409/429/5xx con espera creciente.
let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) {
    const config = getConfig();
    client = new Anthropic({ apiKey: config.anthropicApiKey, timeout: config.timeoutMs, maxRetries: 2 });
  }
  return client;
}

export interface StructuredResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Envía una petición y devuelve la respuesta ya validada contra un esquema Zod. */
export async function askStructured<T extends z.ZodType>(opts: {
  system: string;
  user: string;
  schema: T;
}): Promise<StructuredResult<z.infer<T>>> {
  // Fuera del try a propósito: si falta la configuración (p. ej. ANTHROPIC_API_KEY) el error debe
  // llegar tal cual, no disfrazado de "servicio de IA no disponible".
  const config = getConfig();
  const anthropic = getClient();

  try {
    const response = await anthropic.messages.parse({
      model: config.model,
      max_tokens: config.maxOutputTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: { format: zodOutputFormat(opts.schema) },
    });

    if (response.stop_reason === "refusal") {
      throw new AiError("REFUSED", "El modelo rechazó la solicitud.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError("TRUNCATED", "La respuesta se cortó; aumenta AI_MAX_OUTPUT_TOKENS.", true);
    }
    if (!response.parsed_output) {
      throw new AiError("INVALID_OUTPUT", "La respuesta no cumple el esquema esperado.", true);
    }

    return {
      data: response.parsed_output,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (error) {
    throw toAiError(error);
  }
}

/** Traduce errores del SDK a errores propios, del más específico al más general. */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiError("AUTH", "Credenciales de IA inválidas o sin permisos.");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError("RATE_LIMIT", "Límite de uso de IA excedido; inténtalo más tarde.", true);
  }
  if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError) {
    return new AiError("BAD_REQUEST", "Petición a la IA inválida.");
  }
  if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.InternalServerError) {
    return new AiError("UNAVAILABLE", "Servicio de IA no disponible.", true);
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError("UNAVAILABLE", `Error de la API de IA (${error.status}).`, true);
  }
  return new AiError("UNAVAILABLE", "Error inesperado al llamar a la IA.");
}
