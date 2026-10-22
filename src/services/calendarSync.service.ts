import { randomBytes } from "node:crypto";
import { CalendarError } from "../integrations/google/calendarErrors.js";
import { deleteTaskEvent, upsertTaskEvent, type TaskEventInput, type TokenStore } from "../integrations/google/calendarClient.js";
import { buildAuthUrl, exchangeCode } from "../integrations/google/googleAuth.js";
import { decryptToken, encryptToken } from "../integrations/google/tokenCrypto.js";

// Contrato con la base de datos (tablas `integrations` y `task_calendar_events`).
export interface IntegrationRepository {
  get(userId: number): Promise<{
    refreshTokenEnc: string;
    accessTokenEnc: string | null;
    expiryDate: number | null;
  } | null>;
  save(userId: number, v: { refreshTokenEnc: string; accessTokenEnc: string | null; expiryDate: number | null }): Promise<void>;
  updateAccessToken(userId: number, v: { accessTokenEnc: string; expiryDate: number | null }): Promise<void>;
  remove(userId: number): Promise<void>;
  saveEventLink(taskId: number, userId: number, eventId: string, htmlLink: string | null): Promise<void>;
  removeEventLink(taskId: number): Promise<void>;
}

export class CalendarSyncService {
  constructor(private readonly repo: IntegrationRepository) {}

  /** Paso 1 (ruta GET /integrations/google/connect): guarda `state` en la sesión y redirige a `url`. */
  startConnect() {
    const state = randomBytes(24).toString("hex");
    return { state, url: buildAuthUrl(state) };
  }

  /** Paso 2 (callback): compara `state` con el de la sesión ANTES de llamar aquí. */
  async finishConnect(userId: number, code: string) {
    const tokens = await exchangeCode(code);
    await this.repo.save(userId, {
      refreshTokenEnc: encryptToken(tokens.refresh_token!),
      accessTokenEnc: tokens.access_token ? encryptToken(tokens.access_token) : null,
      expiryDate: tokens.expiry_date ?? null,
    });
  }

  /** Crea o actualiza el evento de una tarea que tiene fecha límite. */
  async syncTask(userId: number, task: TaskEventInput) {
    const store = await this.tokenStore(userId);
    const { eventId, htmlLink } = await upsertTaskEvent(store, task);
    await this.repo.saveEventLink(task.taskId, userId, eventId, htmlLink);
  }

  /** Úsalo al borrar la tarea, completarla o quitarle la fecha límite. */
  async unsyncTask(userId: number, taskId: number) {
    await deleteTaskEvent(await this.tokenStore(userId), taskId);
    await this.repo.removeEventLink(taskId);
  }

  async disconnect(userId: number) {
    await this.repo.remove(userId);
  }

  private async tokenStore(userId: number): Promise<TokenStore> {
    const row = await this.repo.get(userId);
    if (!row) throw new CalendarError("NOT_CONNECTED", "El usuario no conectó Google Calendar.");
    return {
      refreshToken: decryptToken(row.refreshTokenEnc),
      accessToken: row.accessTokenEnc ? decryptToken(row.accessTokenEnc) : null,
      expiryDate: row.expiryDate,
      onRefresh: (t) => this.repo.updateAccessToken(userId, { accessTokenEnc: encryptToken(t.accessToken), expiryDate: t.expiryDate }),
    };
  }
}
