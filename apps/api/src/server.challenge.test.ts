import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { createApp } from "./server.js";
import { buildSeedData } from "./database/seed.js";

// Totais esperados vêm do catálogo, que cresce sem exigir mudar os testes.
const catalogChallenges = buildSeedData().challenges;
const countBy = (difficulty: string) => catalogChallenges.filter((challenge) => challenge.difficulty === difficulty).length;


function makeApp() {
  return createApp(new InMemoryStore(), {
    jwtSecret: "segredo-de-catalogo-com-32-caracteres",
    environment: "test"
  });
}

describe("API de desafios", () => {
  it("filtra desafios por dificuldade", async () => {
    const app = makeApp();

    const easy = await request(app).get("/api/challenges?difficulty=easy");
    const medium = await request(app).get("/api/challenges?difficulty=medium");

    expect(easy.status).toBe(200);
    expect(easy.body.challenges).toHaveLength(countBy("easy"));
    expect(
      easy.body.challenges.every(
        (challenge: { difficulty: string }) => challenge.difficulty === "easy"
      )
    ).toBe(true);
    expect(medium.body.challenges).toHaveLength(countBy("medium"));
    expect(
      medium.body.challenges.every((challenge: { difficulty: string }) => challenge.difficulty === "medium")
    ).toBe(true);
  });

  it("rejeita dificuldade desconhecida", async () => {
    const response = await request(makeApp()).get(
      "/api/challenges?difficulty=impossivel"
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Entrada inválida.");
  });

  it("entrega detalhe autenticado somente com casos publicos", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Teste Catalogo",
      email: "catalogo@codelab.local",
      password: "123456"
    });

    const response = await agent.get(
      "/api/challenges/soma-de-dois-numeros"
    );
    const serialized = JSON.stringify(response.body);

    expect(response.status).toBe(200);
    expect(response.body.challenge.publicTestCases).toHaveLength(2);
    expect(response.body.challenge.testCaseCount).toBe(24);
    expect(response.body.challenge.mode).toBe("function");
    expect(response.body.challenge.functionSpec.name).toBe("somar");
    expect(
      response.body.challenge.languageOptions.map((option: { language: string }) => option.language)
    ).toEqual(["javascript", "python", "c"]);
    expect(response.body.challenge.languageOptions[0].limits).toEqual({
      timeoutMs: 1500,
      memoryLimitMb: 64,
      maxOutputBytes: 65536
    });
    expect(response.body.challenge.languageOptions[1].limits.timeoutMs).toBe(3000);
    expect(response.body.challenge.languageOptions[2].signature).toBe("int somar(int a, int b)");
    expect(serialized).toContain("tc-soma-publico-1");
    expect(serialized).not.toContain("tc-soma-privado-1");
    expect(serialized).not.toContain("[-2,10]");
  });
});
