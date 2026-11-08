import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { computeStreaks } from "./modules/stats/stats.service.js";
import { createApp } from "./server.js";

const SOMA = "function somar(a, b) { return a + b; }";

function makeApp() {
  return createApp(new InMemoryStore(), { jwtSecret: "segredo-da-comunidade-com-32-caracteres!", environment: "test" });
}

async function student(app: ReturnType<typeof createApp>, name: string, email: string) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/register").send({ name, email, password: "123456" });
  return { agent, id: response.body.user.id as string };
}

describe("sequencia de dias", () => {
  it("conta a sequencia atual ate hoje ou ontem e a maior sequencia", () => {
    const days = new Set(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-10", "2026-09-11"]);
    expect(computeStreaks(days, "2026-09-11")).toEqual({ current: 2, longest: 3 });
    expect(computeStreaks(days, "2026-09-12")).toEqual({ current: 2, longest: 3 });
    expect(computeStreaks(days, "2026-09-13")).toEqual({ current: 0, longest: 3 });
    expect(computeStreaks(new Set(["2026-02-28", "2026-03-01"]), "2026-03-01")).toEqual({ current: 2, longest: 2 });
  });
});

describe("atividade, conquistas, tempos, ranking e perfil publico", { timeout: 60000 }, () => {
  it("registra atividade do dia, sequencia e conquistas", async () => {
    const app = makeApp();
    const { agent } = await student(app, "Ana Atividade", "ana.atividade@codelab.local");

    await agent.get("/api/me/activity").expect(200);
    await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "javascript", sourceCode: SOMA });
    const { body } = await agent.get("/api/me/activity").expect(200);

    expect(body.activity.days).toHaveLength(365);
    expect(body.activity.days.at(-1)).toMatchObject({ submissions: 1, accepted: 1 });
    expect(body.activity.currentStreak).toBe(1);
    const earned = body.activity.badges.filter((badge: { earnedAt: string | null }) => badge.earnedAt).map((badge: { id: string }) => badge.id);
    expect(earned).toEqual(["primeiro-aceito"]);
    await request(app).get("/api/me/activity").expect(401);
  });

  it("compara o tempo com as outras solucoes aceitas", async () => {
    const app = makeApp();
    const first = await student(app, "Bia Tempo", "bia.tempo@codelab.local");
    const second = await student(app, "Caio Tempo", "caio.tempo@codelab.local");
    await first.agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "javascript", sourceCode: SOMA });
    await second.agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "javascript", sourceCode: SOMA });

    const { body } = await second.agent.get("/api/challenges/soma-de-dois-numeros/runtime?language=javascript&ms=0").expect(200);
    expect(body.runtime).toMatchObject({ language: "javascript", solutions: 2, runtimeMs: 0 });
    expect(body.runtime.beatsPercent).toBe(100);
    expect(body.runtime.buckets.reduce((sum: number, bucket: { count: number }) => sum + bucket.count, 0)).toBe(2);

    const empty = await second.agent.get("/api/challenges/soma-de-dois-numeros/runtime?language=c").expect(200);
    expect(empty.body.runtime).toMatchObject({ solutions: 0, runtimeMs: null, beatsPercent: null, buckets: [] });
    await second.agent.get("/api/challenges/soma-de-dois-numeros/runtime?language=cobol").expect(400);
  });

  it("filtra o ranking por periodo e por trilha", async () => {
    const app = makeApp();
    const { agent } = await student(app, "Davi Ranking", "davi.ranking@codelab.local");
    await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "javascript", sourceCode: SOMA });

    const week = await request(app).get("/api/ranking?periodo=semana").expect(200);
    expect(week.body.ranking).toEqual([expect.objectContaining({ name: "Davi Ranking", totalPoints: 100, solvedChallenges: 1 })]);

    const fundamentos = await request(app).get("/api/ranking?periodo=mes&trilha=fundamentos").expect(200);
    expect(fundamentos.body.ranking.map((entry: { name: string }) => entry.name)).toEqual(["Davi Ranking"]);
    const estruturas = await request(app).get("/api/ranking?trilha=estrutura-de-dados").expect(200);
    expect(estruturas.body.ranking).toEqual([]);

    await request(app).get("/api/ranking?trilha=nao-existe").expect(404);
    await request(app).get("/api/ranking?periodo=ano").expect(400);
  });

  it("mostra o perfil publico sem dados pessoais", async () => {
    const app = makeApp();
    const { agent, id } = await student(app, "Eva Perfil", "eva.perfil@codelab.local");
    await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "python", sourceCode: "def somar(a, b):\n    return a + b" });

    const { body } = await request(app).get(`/api/users/${id}/profile`).expect(200);
    expect(body.profile).toMatchObject({
      user: { id, name: "Eva Perfil" },
      totalPoints: 100,
      solvedChallenges: 1,
      byDifficulty: { easy: 1, medium: 0, hard: 0 },
      recent: [expect.objectContaining({ slug: "soma-de-dois-numeros", language: "python" })]
    });
    expect(JSON.stringify(body)).not.toContain("eva.perfil@codelab.local");
    await request(app).get("/api/users/nao-existe/profile").expect(404);
  });
});
