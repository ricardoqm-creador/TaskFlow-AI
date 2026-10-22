import { AppError } from "../../errors.js";

export type CalendarErrorCode =
  | "NOT_CONNECTED"  // el usuario no conectó Google Calendar
  | "REAUTH_REQUIRED" // token revocado o caducado: hay que volver a autorizar
  | "FORBIDDEN"      // permisos insuficientes o cuota de Google
  | "NOT_FOUND"      // el evento ya no existe
  | "RATE_LIMIT"
  | "UNAVAILABLE"
  | "BAD_REQUEST";

export class CalendarError extends AppError<CalendarErrorCode> {}
