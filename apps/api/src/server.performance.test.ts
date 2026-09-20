import { performance } from "node:perf_hooks";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { createApp } from "./server.js";

const MAX_COMMON_REQUEST_MS = 2000;

describe("RNF03 - tempo de resposta das requisicoes comuns", () => {
  it.each(["/health", "/api/challenges", "/api/ranking"])(
    "%s responde em menos de 2 segundos no ambiente controlado",
    async (path) => {
      const app = createApp(new InMemoryStore(), {
        jwtSecret: "segredo-de-performance-com-32-caracteres",
        environment: "test"
      });
      const startedAt = performance.now();

      const response = await request(app).get(path);
      const durationMs = performance.now() - startedAt;

      expect(response.status).toBe(200);
      expect(durationMs).toBeLessThan(MAX_COMMON_REQUEST_MS);
    }
  );

  it("cadastro e consulta de perfil respeitam o limite academico", async () => {
    const app = createApp(new InMemoryStore(), {
      jwtSecret: "segredo-de-performance-com-32-caracteres",
      environment: "test"
    });
    const agent = request.agent(app);
    const startedAt = performance.now();

    const registration = await agent.post("/api/auth/register").send({
      name: "Teste Performance",
      email: "performance@codelab.local",
      password: "123456"
    });
    const profile = await agent.get("/api/me");
    const durationMs = performance.now() - startedAt;

    expect(registration.status).toBe(201);
    expect(profile.status).toBe(200);
    expect(durationMs).toBeLessThan(MAX_COMMON_REQUEST_MS);
  });

  it("comentarios e avaliacoes respeitam o limite academico", async () => {
    const app = createApp(new InMemoryStore(), {
      jwtSecret: "segredo-de-performance-com-32-caracteres",
      environment: "test"
    });
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Teste Comunidade",
      email: "comunidade-performance@codelab.local",
      password: "123456"
    });
    const startedAt = performance.now();

    const comment = await agent
      .post("/api/challenges/soma-de-dois-numeros/comments")
      .send({ content: "Resposta rapida." });
    const rating = await agent
      .put("/api/challenges/soma-de-dois-numeros/rating")
      .send({ value: 5 });
    const [comments, summary] = await Promise.all([
      agent.get("/api/challenges/soma-de-dois-numeros/comments"),
      agent.get("/api/challenges/soma-de-dois-numeros/rating")
    ]);
    const durationMs = performance.now() - startedAt;

    expect(comment.status).toBe(201);
    expect(rating.status).toBe(200);
    expect(comments.status).toBe(200);
    expect(summary.status).toBe(200);
    expect(durationMs).toBeLessThan(MAX_COMMON_REQUEST_MS);
  });

  it("operacoes administrativas comuns respeitam o limite academico", async () => {
    const app = createApp(new InMemoryStore(), {
      jwtSecret: "segredo-de-performance-com-32-caracteres",
      environment: "test"
    });
    const admin = request.agent(app);
    await admin.post("/api/auth/login").send({
      email: "admin@codelab.local",
      password: "admin123"
    });
    const startedAt = performance.now();

    const creation = await admin.post("/api/admin/challenges").send({
      title: "Teste de Performance Administrativa",
      slug: "performance-administrativa",
      description: "Desafio usado para medir o fluxo administrativo.",
      difficulty: "easy",
      points: 50,
      constraints: [],
      tags: ["Performance"],
      examples: [],
      testCases: [
        {
          input: "1",
          expectedOutput: "1",
          isPublic: true,
          weight: 1
        },
        {
          input: "2",
          expectedOutput: "2",
          isPublic: false,
          weight: 1
        }
      ]
    });
    const challengeId = creation.body.challenge.id;
    const list = await admin.get("/api/admin/challenges");
    const statistics = await admin.get("/api/admin/statistics");
    const removal = await admin.delete(`/api/admin/challenges/${challengeId}`);
    const durationMs = performance.now() - startedAt;

    expect(creation.status).toBe(201);
    expect(list.status).toBe(200);
    expect(statistics.status).toBe(200);
    expect(removal.status).toBe(200);
    expect(durationMs).toBeLessThan(MAX_COMMON_REQUEST_MS);
  });
});
