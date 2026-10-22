import assert from "node:assert/strict";
import { test } from "node:test";
import { CalendarError } from "./calendarErrors.js";
import { eventIdForTask, persistRefreshedToken, toCalendarError, toEvent, upsertTaskEvent, type TokenStore } from "./calendarClient.js";

const tokens = (overrides: Partial<TokenStore> = {}): TokenStore => ({
  refreshToken: "r",
  onRefresh: async () => {},
  ...overrides,
});

test("el ID del evento cumple el alfabeto que exige Google (a-v y 0-9)", () => {
  assert.match(eventIdForTask(128), /^[a-v0-9]{5,1024}$/);
  assert.equal(eventIdForTask(128), "tf128");
});

test("evento de día completo: la fecha de fin es exclusiva (día siguiente)", () => {
  const event = toEvent({ taskId: 1, title: "T", dueDate: "2026-10-22" });
  assert.deepEqual(event.start, { date: "2026-10-22" });
  assert.deepEqual(event.end, { date: "2026-10-23" });
});

test("la fecha de fin cruza correctamente fin de mes y fin de año", () => {
  assert.equal(toEvent({ taskId: 1, title: "T", dueDate: "2026-10-31" }).end?.date, "2026-11-01");
  assert.equal(toEvent({ taskId: 1, title: "T", dueDate: "2026-12-31" }).end?.date, "2027-01-01");
  assert.equal(toEvent({ taskId: 1, title: "T", dueDate: "2028-02-28" }).end?.date, "2028-02-29");
});

test("recorta título y descripción, y solo envía datos mínimos", () => {
  const event = toEvent({
    taskId: 7,
    title: "x".repeat(500),
    description: "d".repeat(5000),
    dueDate: "2026-10-22",
    appUrl: "https://app/t/7",
  });
  assert.equal(event.summary?.length, 200);
  assert.ok((event.description ?? "").startsWith("d".repeat(1000)));
  assert.ok((event.description ?? "").endsWith("https://app/t/7"));
  assert.deepEqual(event.extendedProperties?.private, { taskflowTaskId: "7" });
});

test("sin descripción ni enlace no se envía el campo", () => {
  assert.equal(toEvent({ taskId: 1, title: "T", dueDate: "2026-10-22" }).description, undefined);
});

test("traduce errores de Google a códigos propios", () => {
  assert.equal(toCalendarError({ message: "invalid_grant" }).code, "REAUTH_REQUIRED");
  assert.equal(toCalendarError({ code: 401 }).code, "REAUTH_REQUIRED");
  assert.equal(toCalendarError({ code: 404 }).code, "NOT_FOUND");
  assert.equal(toCalendarError({ response: { status: 410 } }).code, "NOT_FOUND");
  assert.equal(toCalendarError({ code: 400 }).code, "BAD_REQUEST");
  assert.equal(toCalendarError({ code: 500 }).code, "UNAVAILABLE");
});

test("429 y los 403 por cuota son reintentables; el resto de 403 no", () => {
  const rate = toCalendarError({ code: 429 });
  assert.equal(rate.code, "RATE_LIMIT");
  assert.equal(rate.retryable, true);
  assert.equal(toCalendarError({ code: 403, message: "Rate Limit Exceeded" }).code, "RATE_LIMIT");
  const forbidden = toCalendarError({ code: 403, message: "Insufficient permissions" });
  assert.equal(forbidden.code, "FORBIDDEN");
  assert.equal(forbidden.retryable, false);
});

/* ------------------- E3: validación de la fecha límite ------------------- */

const isBadRequest = (error: unknown) => error instanceof CalendarError && error.code === "BAD_REQUEST";

test("toEvent rechaza fechas inexistentes o mal formadas con CalendarError BAD_REQUEST", () => {
  for (const dueDate of ["no-es-fecha", "", "2026-02-30", "2026-13-01", "2026-00-10", "22/10/2026", "2026-1-5", "2027-02-29"]) {
    assert.throws(() => toEvent({ taskId: 1, title: "T", dueDate }), isBadRequest, `debía rechazar ${JSON.stringify(dueDate)}`);
  }
});

test("toEvent acepta el 29 de febrero solo en año bisiesto", () => {
  assert.doesNotThrow(() => toEvent({ taskId: 1, title: "T", dueDate: "2028-02-29" }));
  assert.throws(() => toEvent({ taskId: 1, title: "T", dueDate: "2026-02-29" }), isBadRequest);
});

test("upsertTaskEvent valida la fecha ANTES de usar la red ni la configuración", async () => {
  // Sin variables de Google definidas: si intentara crear el cliente fallaría con otro error.
  await assert.rejects(() => upsertTaskEvent(tokens(), { taskId: 1, title: "T", dueDate: "2026-02-30" }), isBadRequest);
});

/* ------------- E4: fallo al guardar el token renovado de Google ------------- */

test("si onRefresh falla, persistRefreshedToken NO rechaza y avisa a onRefreshError", async () => {
  const errors: unknown[] = [];
  const store = tokens({
    onRefresh: async () => {
      throw new Error("base de datos caída");
    },
    onRefreshError: (error) => errors.push(error),
  });

  await assert.doesNotReject(() => persistRefreshedToken(store, { access_token: "nuevo", expiry_date: 123 }));
  assert.equal(errors.length, 1);
  assert.equal((errors[0] as Error).message, "base de datos caída");
});

test("si el propio gestor de errores falla, tampoco se propaga", async () => {
  const store = tokens({
    onRefresh: async () => {
      throw new Error("x");
    },
    onRefreshError: () => {
      throw new Error("el gestor también falla");
    },
  });
  await assert.doesNotReject(() => persistRefreshedToken(store, { access_token: "nuevo" }));
});

test("sin gestor propio, el error se registra sin exponer el token", async () => {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void logged.push(args);
  try {
    await persistRefreshedToken(
      tokens({
        onRefresh: async () => {
          throw new Error("fallo al guardar");
        },
      }),
      { access_token: "TOKEN-SECRETO" },
    );
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1);
  assert.ok(!JSON.stringify(logged).includes("TOKEN-SECRETO"));
});

test("pasa expiry_date y guarda el token cuando todo va bien; sin access_token no hace nada", async () => {
  const saved: unknown[] = [];
  const store = tokens({ onRefresh: async (t) => void saved.push(t) });

  await persistRefreshedToken(store, { access_token: "abc", expiry_date: 99 });
  await persistRefreshedToken(store, { expiry_date: 99 });

  assert.deepEqual(saved, [{ accessToken: "abc", expiryDate: 99 }]);
});
