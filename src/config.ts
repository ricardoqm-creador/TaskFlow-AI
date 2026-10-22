// Configuración centralizada. Se lee de forma perezosa (al primer uso), no al importar:
// así los módulos se pueden importar y probar sin tener todas las variables definidas.
import { intEnv, requireEnv } from "./env.js";

export interface AppConfig {
  anthropicApiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
  maxInputChars: number;
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  cached ??= {
    anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
    model: process.env.AI_MODEL ?? "claude-opus-5-5",
    timeoutMs: intEnv("AI_TIMEOUT_MS", 60_000),
    maxOutputTokens: intEnv("AI_MAX_OUTPUT_TOKENS", 2000),
    maxInputChars: intEnv("AI_MAX_INPUT_CHARS", 8000),
  };
  return cached;
}
