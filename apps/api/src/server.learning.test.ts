import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { buildSeedData } from "./database/seed.js";
import { createApp } from "./server.js";

const SOLUTION = "function somar(a, b) { return a + b; }";
const WRONG = "function somar() { return 0; }";

/** Catálogo real com uma lição e uma solução comentada extras na "Soma". */
function makeApp() {
  const seed = buildSeedData();
  const entrada = seed.tracks[0].modules[0];
  entrada.lessons = [
    {
      id: "lesson-teste",
      moduleId: entrada.id,
      slug: "teste-operadores",
      title: "Operadores",
      summary: "Resumo",
      content: "# Operadores\n\nTexto da lição.",
      estimatedMinutes: 5,
      position: 0
    }
  ];
  seed.challenges = seed.challenges.map((challenge) =>
    challenge.slug === "soma-de-dois-numeros"
      ? { ...challenge, editorial: "Basta retornar a + b.", hints: ["Use o operador +.", "Não imprima: retorne."], followUps: ["E com números enormes?"] }
      : challenge
  );
  return createApp(new InMemoryStore(seed), { jwtSecret: "segredo-de-trilhas-com-32-caracteres!", environment: "test" });
}

async function student(app: ReturnType<typeof createApp>, email = "trilha@codelab.local") {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ name: "Estudante Trilha", email, password: "123456" });
  return agent;
}

describe("trilhas e lições", () => {
  it("publica as trilhas com módulos, lições e desafios em ordem", async () => {
    const response = await request(makeApp()).get("/api/tracks");
    const [fundamentos] = response.body.tracks;

    expect(response.status).toBe(200);
    expect(response.body.tracks.map((track: { slug: string }) => track.slug)).toEqual([
      "fundamentos",
      "estrutura-de-dados",
      "algoritmos",
      "entrevistas"
    ]);
    expect(fundamentos.modules[0].lessons[0]).not.toHaveProperty("content");
    expect(fundamentos.modules[0].challenges[0].slug).toBe("soma-de-dois-numeros");
    expect(fundamentos.modules[1].challenges.map((challenge: { slug: string }) => challenge.slug).slice(0, 2)).toEqual([
      "par-ou-impar",
      "maior-de-tres-numeros"
    ]);
  });

  it("indica o próximo passo e avanca conforme o estudante conclui itens", async () => {
    const app = makeApp();
    const agent = await student(app);

    const start = await agent.get("/api/tracks/progress");
    expect(start.body.next).toMatchObject({ type: "lesson", slug: "teste-operadores", trackSlug: "fundamentos" });

    const lesson = await agent.get("/api/lessons/teste-operadores");
    expect(lesson.body.lesson.content).toContain("Texto da lição.");
    expect(lesson.body.next).toMatchObject({ type: "challenge", slug: "soma-de-dois-numeros" });

    await agent.post("/api/lessons/teste-operadores/complete").expect(200);
    const afterLesson = await agent.get("/api/tracks/progress");
    expect(afterLesson.body.next).toMatchObject({ type: "challenge", slug: "soma-de-dois-numeros" });

    await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "python", sourceCode: "def somar(a, b):\n    return a + b" });
    const afterChallenge = await agent.get("/api/tracks/progress");
    // Próximo passo: o desafio seguinte do mesmo módulo (posição 1).
    const entrada = buildSeedData().challenges.filter((challenge) => challenge.moduleId === "mod-entrada-saida").sort((a, b) => a.position - b.position);
    expect(afterChallenge.body.next).toMatchObject({ type: "challenge", slug: entrada[1].slug });
    expect(afterChallenge.body.modules["mod-entrada-saida"]).toEqual({ done: 2, total: entrada.length + 1 });
  });

  it("exige login para registrar progresso e responde 404 para lição inexistente", async () => {
    const app = makeApp();
    await request(app).post("/api/lessons/teste-operadores/complete").expect(401);
    await request(app).get("/api/lessons/nao-existe").expect(404);
  });
});

describe("dicas e solução comentada", () => {
  it("revela as dicas uma por vez", async () => {
    const agent = await student(makeApp(), "dicas@codelab.local");

    const detail = await agent.get("/api/challenges/soma-de-dois-numeros");
    expect(detail.body.challenge.help).toMatchObject({ hints: [], hintsTotal: 2, editorial: null, canRevealSolution: false });

    const first = await agent.post("/api/challenges/soma-de-dois-numeros/hints");
    expect(first.body.help.hints).toEqual(["Use o operador +."]);
    const second = await agent.post("/api/challenges/soma-de-dois-numeros/hints");
    expect(second.body.help.hints).toHaveLength(2);
    await agent.post("/api/challenges/soma-de-dois-numeros/hints").expect(409);
  });

  it("libera a solução apos 3 tentativas e zera os pontos de quem a revela", async () => {
    const app = makeApp();
    const agent = await student(app, "solucao@codelab.local");

    await agent.post("/api/challenges/soma-de-dois-numeros/solution").expect(403);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "javascript", sourceCode: WRONG });
    }
    const revealed = await agent.post("/api/challenges/soma-de-dois-numeros/solution");
    expect(revealed.status).toBe(200);
    expect(revealed.body.help).toMatchObject({ editorial: "Basta retornar a + b.", solutionRevealed: true });

    const accepted = await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "javascript", sourceCode: SOLUTION });
    expect(accepted.body.submission.status).toBe("accepted");
    expect(accepted.body.submission.scoreAwarded).toBe(0);
    expect(accepted.body.score.solvedChallengeIds).toContain("challenge-soma");
    expect(accepted.body.score.totalPoints).toBe(0);
  });

  it("mostra solução e perguntas de acompanhamento para quem resolveu, com pontos", async () => {
    const agent = await student(makeApp(), "resolveu@codelab.local");

    const accepted = await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "c", sourceCode: "int somar(int a, int b) { return a + b; }" });
    expect(accepted.body.submission.scoreAwarded).toBe(100);

    const detail = await agent.get("/api/challenges/soma-de-dois-numeros");
    expect(detail.body.challenge.help).toMatchObject({
      editorial: "Basta retornar a + b.",
      solutionRevealed: false,
      followUps: ["E com números enormes?"]
    });
  });

  it("recusa linguagem que o desafio não aceita", async () => {
    const agent = await student(makeApp(), "linguagem@codelab.local");
    const response = await agent
      .post("/api/challenges/ed-pilha-de-numeros/submissions")
      .send({ language: "python", sourceCode: "print(1)" });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain("C");
  });
});
