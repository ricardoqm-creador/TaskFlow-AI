import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { CalendarError } from "../integrations/google/calendarErrors.js";
import { CalendarSyncService, type IntegrationRepository } from "./calendarSync.service.js";

process.env.GOOGLE_CLIENT_ID = "id";
process.env.GOOGLE_CLIENT_SECRET = "secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost/cb";
process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");

const notConnected: IntegrationRepository = {
  get: async () => null,
  save: async () => {},
  updateAccessToken: async () => {},
  remove: async () => {},
  saveEventLink: async () => {},
  removeEventLink: async () => {},
};

test("sincronizar sin Google conectado devuelve NOT_CONNECTED", async () => {
  const service = new CalendarSyncService(notConnected);
  await assert.rejects(
    () => service.syncTask(1, { taskId: 1, title: "T", dueDate: "2026-10-22" }),
    (error: unknown) => error instanceof CalendarError && error.code === "NOT_CONNECTED",
  );
});

test("quitar la sincronización sin conexión también devuelve NOT_CONNECTED", async () => {
  await assert.rejects(
    () => new CalendarSyncService(notConnected).unsyncTask(1, 1),
    (error: unknown) => error instanceof CalendarError && error.code === "NOT_CONNECTED",
  );
});

test("startConnect genera un state aleatorio distinto cada vez y lo incluye en la URL", () => {
  const service = new CalendarSyncService(notConnected);
  const a = service.startConnect();
  const b = service.startConnect();
  assert.notEqual(a.state, b.state);
  assert.ok(a.state.length >= 32);
  const url = new URL(a.url);
  assert.equal(url.searchParams.get("state"), a.state);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/calendar.events");
});
