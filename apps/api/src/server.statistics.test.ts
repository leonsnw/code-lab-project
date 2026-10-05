import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import type { Submission } from "./domain/types.js";
import { createApp } from "./server.js";
import { buildSeedData } from "./database/seed.js";

const CATALOG_SIZE = buildSeedData().challenges.length;

function makeApp(store = new InMemoryStore()) {
  return createApp(store, {
    jwtSecret: "segredo-das-estatisticas-com-32-caracteres",
    environment: "test"
  });
}

async function login(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string
) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return agent;
}

describe("API de estatisticas administrativas", () => {
  it("exige autenticacao e papel administrativo", async () => {
    const app = makeApp();

    await request(app).get("/api/admin/statistics").expect(401);
    const student = await login(app, "marina@codelab.local", "123456");
    await student.get("/api/admin/statistics").expect(403);
  });

  it("retorna indicadores gerais e por desafio", async () => {
    const app = makeApp();
    const admin = await login(app, "admin@codelab.local", "admin123");

    const response = await admin.get("/api/admin/statistics");

    expect(response.status).toBe(200);
    expect(response.body.generatedAt).toBeTypeOf("string");
    expect(response.body.overview).toMatchObject({
      totalUsers: 2,
      totalStudents: 1,
      totalAdmins: 1,
      totalChallenges: CATALOG_SIZE,
      activeChallenges: CATALOG_SIZE,
      inactiveChallenges: 0,
      totalSubmissions: 0,
      acceptanceRate: 0
    });
    expect(response.body.challenges).toHaveLength(CATALOG_SIZE);
    expect(response.body.difficulties).toHaveLength(3);
    expect(response.body.users).toHaveLength(2);
    expect(response.body.highlights).toEqual({
      mostSolvedChallenge: null,
      highestErrorRateChallenge: null
    });
  });

  it("nao expoe codigo-fonte nem detalhes de casos de teste", async () => {
    const store = new InMemoryStore();
    const submission: Submission = {
      id: "submission-sensitive",
      userId: "user-marina",
      challengeId: "challenge-soma",
      language: "javascript",
      sourceCode: "CODIGO-FONTE-SENSIVEL",
      status: "wrong_answer",
      scoreAwarded: 0,
      submittedAt: new Date(),
      evaluatedAt: new Date(),
      totalTests: 1,
      passedTests: 0,
      errorMessage: null,
      compileWarnings: null,
      testResults: [
        {
          testCaseId: "CASO-PRIVADO-SENSIVEL",
          position: 1,
          executionStatus: "completed",
          isPublic: false,
          passed: false,
          input: "ENTRADA-PRIVADA-SENSIVEL",
          expectedOutput: "SAIDA-PRIVADA-SENSIVEL",
          actualOutput: "0",
          durationMs: 1
        }
      ]
    };
    await store.addSubmission(submission);
    const app = makeApp(store);
    const admin = await login(app, "admin@codelab.local", "admin123");

    const response = await admin.get("/api/admin/statistics");
    const serialized = JSON.stringify(response.body);

    expect(response.status).toBe(200);
    expect(response.body.overview.totalSubmissions).toBe(1);
    expect(serialized).not.toContain("CODIGO-FONTE-SENSIVEL");
    expect(serialized).not.toContain("CASO-PRIVADO-SENSIVEL");
    expect(serialized).not.toContain("ENTRADA-PRIVADA-SENSIVEL");
  });
});
