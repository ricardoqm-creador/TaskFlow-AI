import assert from "node:assert/strict";
import { test } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { AiError } from "../../errors.js";
import { askStructured, readStructuredOutput, toAiError } from "./claudeClient.js";

/* -------------- E6: un fallo de configuración no se disfraza -------------- */

test("sin ANTHROPIC_API_KEY el error indica la variable que falta (no es 'servicio no disponible')", async () => {
  delete process.env.ANTHROPIC_API_KEY;

  await assert.rejects(
    () => askStructured({ system: "s", user: "u", schema: z.object({}) }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /ANTHROPIC_API_KEY/);
      assert.ok(!(error instanceof AiError), "no debe convertirse en AiError");
      return true;
    },
  );
});

/* ------------------- Traducción de errores del SDK ------------------- */

const apiError = (status: number) =>
  Anthropic.APIError.generate(status, { type: "error", error: { type: "x", message: "m" } }, "m", new Headers());

test("traduce cada error del SDK a un código propio", () => {
  assert.equal(toAiError(apiError(401)).code, "AUTH");
  assert.equal(toAiError(apiError(403)).code, "AUTH");
  assert.equal(toAiError(apiError(400)).code, "BAD_REQUEST");
  assert.equal(toAiError(apiError(404)).code, "BAD_REQUEST");
  assert.equal(toAiError(apiError(500)).code, "UNAVAILABLE");
});

test("429 y 5xx son reintentables; 401 y 400 no", () => {
  assert.equal(toAiError(apiError(429)).code, "RATE_LIMIT");
  assert.equal(toAiError(apiError(429)).retryable, true);
  assert.equal(toAiError(apiError(500)).retryable, true);
  assert.equal(toAiError(apiError(401)).retryable, false);
  assert.equal(toAiError(apiError(400)).retryable, false);
});

test("un AiError pasa sin cambios y un error desconocido es UNAVAILABLE no reintentable", () => {
  const propio = new AiError("REFUSED", "x");
  assert.equal(toAiError(propio), propio);
  assert.equal(toAiError(new Error("raro")).code, "UNAVAILABLE");
  assert.equal(toAiError(new Error("raro")).retryable, false);
});

/* ----------------- Lectura de la respuesta estructurada ----------------- */

const isCode = (code: string) => (error: unknown) => error instanceof AiError && error.code === code;

test("readStructuredOutput devuelve el dato cuando la respuesta es válida", () => {
  assert.deepEqual(readStructuredOutput({ stop_reason: "end_turn", parsed_output: { ok: true } }), { ok: true });
});

test("un rechazo del modelo es REFUSED y no se reintenta", () => {
  assert.throws(() => readStructuredOutput({ stop_reason: "refusal", parsed_output: { ok: true } }), isCode("REFUSED"));
  try { readStructuredOutput({ stop_reason: "refusal", parsed_output: null }); } catch (error) { assert.equal((error as AiError).retryable, false); }
});

test("una respuesta cortada por max_tokens es TRUNCATED y reintentable", () => {
  assert.throws(() => readStructuredOutput({ stop_reason: "max_tokens", parsed_output: null }), isCode("TRUNCATED"));
  try { readStructuredOutput({ stop_reason: "max_tokens", parsed_output: null }); } catch (error) { assert.equal((error as AiError).retryable, true); }
});

test("sin salida válida es INVALID_OUTPUT", () => {
  assert.throws(() => readStructuredOutput({ stop_reason: "end_turn", parsed_output: null }), isCode("INVALID_OUTPUT"));
  assert.throws(() => readStructuredOutput({ stop_reason: "end_turn", parsed_output: undefined }), isCode("INVALID_OUTPUT"));
});
