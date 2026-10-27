import { google, type calendar_v3 } from "googleapis";
import { isRealDate } from "../../dates.js";
import { CalendarError } from "./calendarErrors.js";
import { createOAuthClient } from "./googleAuth.js";

export interface TaskEventInput {
  taskId: number;
  title: string;
  description?: string | null;
  dueDate: string; // YYYY-MM-DD (columna tasks.due_date)
  appUrl?: string; // enlace de vuelta a la tarea
}

export interface TokenStore {
  refreshToken: string;
  accessToken?: string | null;
  expiryDate?: number | null;
  /** Google renueva el access_token solo; aquí se persiste el nuevo. */
  onRefresh(tokens: { accessToken: string; expiryDate: number | null }): Promise<void>;
  /** Se llama si `onRefresh` falla (p. ej. la base de datos no responde). Por defecto, registra el error. */
  onRefreshError?(error: unknown): void;
}

// ID determinista (alfabeto base32hex permitido por Google: a-v, 0-9): reintentos sin duplicados.
export const eventIdForTask = (taskId: number) => `tf${taskId}`;

const logRefreshError = (error: unknown) =>
  // Solo el mensaje: nunca se registran tokens.
  console.error("No se pudo guardar el token renovado de Google:", error instanceof Error ? error.message : "error desconocido");

/**
 * Guarda el access_token que Google acaba de renovar. NUNCA rechaza la promesa: un fallo al
 * guardar no debe convertirse en un "unhandled rejection" que tumbe el proceso.
 */
export async function persistRefreshedToken(
  store: TokenStore,
  tokens: { access_token?: string | null; expiry_date?: number | null },
): Promise<void> {
  if (!tokens.access_token) return;
  try {
    await store.onRefresh({ accessToken: tokens.access_token, expiryDate: tokens.expiry_date ?? null });
  } catch (error) {
    try {
      (store.onRefreshError ?? logRefreshError)(error);
    } catch {
      // El gestor de errores tampoco debe propagar fallos.
    }
  }
}

function calendarFor(store: TokenStore): calendar_v3.Calendar {
  const auth = createOAuthClient();
  auth.setCredentials({
    refresh_token: store.refreshToken,
    access_token: store.accessToken ?? undefined,
    expiry_date: store.expiryDate ?? undefined,
  });
  auth.on("tokens", (tokens) => {
    void persistRefreshedToken(store, tokens);
  });
  return google.calendar({ version: "v3", auth });
}

// Evento de día completo: en Google, `end.date` es exclusivo, por eso se suma un día.
export function toEvent(input: TaskEventInput): calendar_v3.Schema$Event {
  if (!isRealDate(input.dueDate)) {
    throw new CalendarError("BAD_REQUEST", "La fecha límite no es válida; se esperaba una fecha real YYYY-MM-DD.");
  }
  const start = input.dueDate;
  const end = new Date(`${start}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    id: eventIdForTask(input.taskId),
    summary: input.title.slice(0, 200),
    // Solo datos mínimos: no se envían comentarios, adjuntos ni correos.
    description: [input.description?.slice(0, 1000), input.appUrl].filter(Boolean).join("\n\n") || undefined,
    start: { date: start },
    end: { date: end.toISOString().slice(0, 10) },
    status: "confirmed",
    extendedProperties: { private: { taskflowTaskId: String(input.taskId) } },
  };
}

/** Crea el evento o lo actualiza si ya existe. Devuelve el id del evento y su enlace. */
export async function upsertTaskEvent(store: TokenStore, input: TaskEventInput) {
  // 1) Validar la entrada ANTES de tocar la red (lanza CalendarError BAD_REQUEST si es inválida).
  // 2) Crear el cliente fuera del try: un fallo de configuración debe verse como tal, no como "Google no disponible".
  const requestBody = toEvent(input);
  const eventId = requestBody.id!;
  const calendar = calendarFor(store);
  try {
    try {
      const res = await calendar.events.insert({ calendarId: "primary", requestBody });
      return { eventId: res.data.id ?? eventId, htmlLink: res.data.htmlLink ?? null };
    } catch (error) {
      // 409: ya existe (o fue borrado antes): se actualiza y se reactiva.
      if (statusOf(error) !== 409) throw error;
      const res = await calendar.events.patch({ calendarId: "primary", eventId, requestBody });
      return { eventId: res.data.id ?? eventId, htmlLink: res.data.htmlLink ?? null };
    }
  } catch (error) {
    throw toCalendarError(error);
  }
}

export async function deleteTaskEvent(store: TokenStore, taskId: number): Promise<void> {
  try {
    await calendarFor(store).events.delete({ calendarId: "primary", eventId: eventIdForTask(taskId) });
  } catch (error) {
    const err = toCalendarError(error);
    if (err.code !== "NOT_FOUND") throw err; // ya estaba borrado: no es un error
  }
}

function statusOf(error: unknown): number | undefined {
  // Los errores de Google traen el estado HTTP en `response.status` o en `code` (número o texto).
  const errorLike = error as { code?: number | string; response?: { status?: number } };
  const status = errorLike?.response?.status ?? (typeof errorLike?.code === "number" ? errorLike.code : Number(errorLike?.code));
  return Number.isFinite(status) ? status : undefined;
}

export function toCalendarError(error: unknown): CalendarError {
  if (error instanceof CalendarError) return error;
  const status = statusOf(error);
  const message = String((error as Error)?.message ?? "");
  // invalid_grant: el usuario revocó el acceso o el refresh_token caducó.
  if (message.includes("invalid_grant") || status === 401) {
    return new CalendarError("REAUTH_REQUIRED", "Debes volver a conectar Google Calendar.");
  }
  if (status === 404 || status === 410) return new CalendarError("NOT_FOUND", "El evento no existe.");
  if (status === 429) return new CalendarError("RATE_LIMIT", "Límite de Google excedido; reintenta luego.", true);
  if (status === 403) {
    // Google usa 403 también para rateLimitExceeded/userRateLimitExceeded.
    const limited = /rate ?limit|quota/i.test(message);
    return limited
      ? new CalendarError("RATE_LIMIT", "Límite de Google excedido; reintenta luego.", true)
      : new CalendarError("FORBIDDEN", "Permisos insuficientes en Google Calendar.");
  }
  if (status === 400) return new CalendarError("BAD_REQUEST", "Petición a Google Calendar inválida.");
  return new CalendarError("UNAVAILABLE", "Google Calendar no disponible.", true);
}
