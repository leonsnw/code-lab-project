import { spawnSync } from "node:child_process";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { runCaseGenerator } from "./modules/admin/admin-tools.service.js";
import { createApp } from "./server.js";

const hasBwrap = spawnSync("bwrap", ["--version"]).status === 0;

function makeApp() {
  return createApp(new InMemoryStore(), { jwtSecret: "segredo-do-professor-com-32-caracteres!", environment: "test" });
}

async function login(app: ReturnType<typeof createApp>, email: string, password: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return agent;
}

async function student(app: ReturnType<typeof createApp>, name: string, email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({ name, email, password: "123456" }).expect(201);
  return agent;
}

const draftPayload = {
  title: "Dobro do número",
  slug: "dobro-rascunho",
  description: "Implemente a função dobro(n), que retorna o dobro do inteiro recebido.",
  difficulty: "easy",
  points: 50,
  tags: ["Operadores"],
  constraints: ["-1000 <= n <= 1000"],
  examples: [{ input: "[2]", output: "4" }],
  languages: [{ language: "javascript", sourceRules: [] }],
  mode: "function",
  functionSpec: { name: "dobro", params: [{ name: "n", type: "int" }], returns: "int" },
  isPublished: false,
  testCases: [
    { input: "[2]", expectedOutput: "4", isPublic: true, weight: 1 },
    { input: "[-7]", expectedOutput: "-14", isPublic: false, weight: 1 }
  ]
};

describe("turmas", () => {
  it("professor cria a turma, estudantes entram pelo codigo e o CSV traz o progresso", async () => {
    const app = makeApp();
    const admin = await login(app, "admin@codelab.local", "admin123");
    const created = await admin.post("/api/admin/classes").send({ name: "ED 2026/2 — Noite" }).expect(201);
    const { id, code } = created.body.classGroup;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const ana = await student(app, "Ana Turma", "ana.turma@codelab.local");
    const bruno = await student(app, "=Bruno Formula", "bruno.turma@codelab.local");
    await ana.post("/api/classes/join").send({ code: code.toLowerCase() }).expect(200);
    await bruno.post("/api/classes/join").send({ code }).expect(200);
    await ana.post("/api/classes/join").send({ code: "ZZZZZZ" }).expect(404);
    await ana.post("/api/classes/join").send({ code: "abc" }).expect(400);
    await ana.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "javascript", sourceCode: "function somar(a, b) { return a + b; }" });

    expect((await ana.get("/api/me/classes")).body.classes).toEqual([expect.objectContaining({ id, name: "ED 2026/2 — Noite" })]);

    const report = await admin.get(`/api/admin/classes/${id}`).expect(200);
    expect(report.body.students.map((row: { name: string }) => row.name)).toEqual(["Ana Turma", "=Bruno Formula"]);
    expect(report.body.students[0]).toMatchObject({ totalPoints: 100, solvedChallenges: 1, submissions: 1, acceptanceRate: 100, byTrack: { fundamentos: 1 } });

    const csv = await admin.get(`/api/admin/classes/${id}/export.csv`).expect(200);
    expect(csv.headers["content-type"]).toContain("text/csv");
    expect(csv.headers["content-disposition"]).toMatch(/turma-ed-2026-2-noite-\d{4}-\d{2}-\d{2}\.csv/);
    const lines = csv.text.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toContain("Nome;E-mail;Entrou em;Pontos");
    expect(lines[1]).toMatch(/^Ana Turma;ana\.turma@codelab\.local;\d{4}-\d{2}-\d{2};100;1;1;100;/);
    // Célula que começa com "=" vira texto, para não executar fórmula no Excel.
    expect(lines[2].startsWith("'=Bruno Formula;")).toBe(true);

    await ana.get("/api/admin/classes").expect(403);
    await ana.delete(`/api/me/classes/${id}`).expect(200);
    expect((await ana.get("/api/me/classes")).body.classes).toEqual([]);
    await admin.delete(`/api/admin/classes/${id}`).expect(200);
    await admin.get(`/api/admin/classes/${id}`).expect(404);
  });
});

describe("rascunhos", () => {
  it("rascunho fica visivel so para administradores ate ser publicado", async () => {
    const app = makeApp();
    const admin = await login(app, "admin@codelab.local", "admin123");
    const created = await admin.post("/api/admin/challenges").send(draftPayload).expect(201);
    const learner = await student(app, "Estudante Rascunho", "rascunho@codelab.local");

    const list = await request(app).get("/api/challenges").expect(200);
    expect(list.body.challenges.some((challenge: { slug: string }) => challenge.slug === "dobro-rascunho")).toBe(false);
    await learner.get("/api/challenges/dobro-rascunho").expect(404);
    await learner.post("/api/challenges/dobro-rascunho/submissions").send({ language: "javascript", sourceCode: "function dobro(n) { return 2 * n; }" }).expect(404);
    // O professor pré-visualiza como estudante.
    await admin.get("/api/challenges/dobro-rascunho").expect(200);

    await admin.put(`/api/admin/challenges/${created.body.challenge.id}`).send({ ...draftPayload, isPublished: true }).expect(200);
    await learner.get("/api/challenges/dobro-rascunho").expect(200);
  });
});

describe("ferramentas do professor", () => {
  it("gerador de casos roda isolado e devolve entradas deterministicas", () => {
    const code = "function gerar(i, aleatorio) { return [Math.floor(aleatorio() * 100), i]; }";
    expect(runCaseGenerator(code, 3, 7, "function")).toEqual(runCaseGenerator(code, 3, 7, "function"));
    expect(runCaseGenerator(code, 3, 7, "function")).toHaveLength(3);
    expect(() => runCaseGenerator("function gerar() { while (true) {} }", 1, 1, "function")).toThrow(/gerador falhou/);
    expect(() => runCaseGenerator("function gerar() { return require('fs'); }", 1, 1, "function")).toThrow(/gerador falhou/);
    expect(() => runCaseGenerator("function gerar() { return 5; }", 1, 1, "stdio")).toThrow(/texto/);
  });

  it("valida solucoes de referencia e gera o gabarito pelo juiz", async () => {
    const app = makeApp();
    const admin = await login(app, "admin@codelab.local", "admin123");

    const validation = await admin
      .post("/api/admin/challenges/validate")
      .send({
        challenge: draftPayload,
        solutions: [
          { language: "javascript", sourceCode: "function dobro(n) { return n * 2; }" },
          { language: "javascript", sourceCode: "function dobro(n) { return n === 2 ? 4 : n; }", expected: "wrong_answer" },
          { language: "python", sourceCode: "def dobro(n):\n    return 2 * n" }
        ]
      })
      .expect(200);
    expect(validation.body.results.map((result: { status: string; ok: boolean }) => [result.status, result.ok])).toEqual([
      ["accepted", true],
      ["wrong_answer", true],
      ["rule_violation", false]
    ]);
    expect(validation.body.ok).toBe(false);

    const generated = await admin
      .post("/api/admin/challenges/generate-cases")
      .send({
        mode: "function",
        functionSpec: draftPayload.functionSpec,
        language: "javascript",
        referenceSolution: "function dobro(n) { return n * 2; }",
        generator: "function gerar(i) { return [i * 10 - 5]; }",
        count: 3
      })
      .expect(200);
    expect(generated.body.cases.map((item: { input: string; expectedOutput: string }) => [item.input, item.expectedOutput])).toEqual([
      ["[-5]", "-10"],
      ["[5]", "10"],
      ["[15]", "30"]
    ]);
    expect(generated.body.failures).toBe(0);

    const learner = await student(app, "Sem Acesso", "sem.acesso@codelab.local");
    await learner.post("/api/admin/challenges/validate").send({}).expect(403);
  });

  it.skipIf(!hasBwrap)("gera casos com solucao em C", async () => {
    const app = makeApp();
    const admin = await login(app, "admin@codelab.local", "admin123");
    const generated = await admin
      .post("/api/admin/challenges/generate-cases")
      .send({ mode: "stdio", language: "c", referenceSolution: '#include <stdio.h>\nint main(void){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}', inputs: ["1 2", "10 -3"] })
      .expect(200);
    expect(generated.body.cases.map((item: { expectedOutput: string }) => item.expectedOutput.trim())).toEqual(["3", "7"]);
  });
});
