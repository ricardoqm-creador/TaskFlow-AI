import assert from "node:assert/strict";
import { test } from "node:test";

process.env.ANTHROPIC_API_KEY = "clave-de-prueba";
process.env.AI_MAX_INPUT_CHARS = "20";

const { AiSuggestionService } = await import("./aiSuggestion.service.js");
type Repo = ConstructorParameters<typeof AiSuggestionService>[0];

function fakeRepo() {
  const calls: Array<[string, unknown]> = [];
  const repo: Repo = {
    async createPending(input) {
      calls.push(["createPending", input]);
      return 42;
    },
    async complete(id, input) {
      calls.push(["complete", { id, ...input }]);
    },
    async fail(id, reason) {
      calls.push(["fail", { id, reason }]);
    },
  };
  return { repo, calls };
}

const base = { taskId: 1, userId: 2, kind: "subtasks" as const };

test("guarda la sugerencia como pending y la completa con la respuesta", async () => {
  const { repo, calls } = fakeRepo();
  const service = new AiSuggestionService(repo, async () => ({ data: { items: [] }, model: "modelo-x" }));

  const result = await service.suggest({ ...base, task: { title: "Tarea" } });

  assert.equal(result.id, 42);
  assert.deepEqual(calls.map(([name]) => name), ["createPending", "complete"]);
  assert.deepEqual(calls[1][1], { id: 42, response: { items: [] }, model: "modelo-x" });
});

test("si la IA falla marca la sugerencia como fallida (solo el tipo de error) y relanza", async () => {
  const { repo, calls } = fakeRepo();
  const service = new AiSuggestionService(repo, async () => {
    throw new Error("detalle interno con datos sensibles");
  });

  await assert.rejects(() => service.suggest({ ...base, task: { title: "Tarea" } }));

  assert.deepEqual(calls.map(([name]) => name), ["createPending", "fail"]);
  assert.deepEqual(calls[1][1], { id: 42, reason: "Error" });
});

test("recorta la descripción al límite configurado antes de enviarla", async () => {
  const { repo, calls } = fakeRepo();
  let sent = "";
  const service = new AiSuggestionService(repo, async (opts) => {
    sent = opts.user;
    return { data: {}, model: "m" };
  });

  await service.suggest({ ...base, task: { title: "T", description: "A".repeat(500) } });

  assert.ok(sent.includes("A".repeat(20)));
  assert.ok(!sent.includes("A".repeat(21)));
  assert.ok(!JSON.stringify(calls[0][1]).includes("A".repeat(21)));
});
