/**
 * Error base de la aplicación: un código estable (para decidir qué hacer) y si conviene reintentar.
 * Cada integración define su propio conjunto de códigos extendiendo esta clase.
 */
export class AppError<Code extends string = string> extends Error {
  constructor(
    public readonly code: Code,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export type AiErrorCode =
  | "AUTH"          // clave inválida o sin permisos
  | "RATE_LIMIT"    // límite de uso excedido
  | "UNAVAILABLE"   // 5xx, red o timeout
  | "BAD_REQUEST"   // petición inválida (bug nuestro)
  | "REFUSED"       // el modelo rechazó la solicitud
  | "TRUNCATED"     // respuesta cortada por max_tokens
  | "INVALID_OUTPUT"; // la salida no cumple el esquema

export class AiError extends AppError<AiErrorCode> {}
