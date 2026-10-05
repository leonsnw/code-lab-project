import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { createApp } from "./server.js";
import { buildSeedData } from "./database/seed.js";

// Totais esperados vêm do catálogo, que cresce sem exigir mudar os testes.
const catalogChallenges = buildSeedData().challenges;
const countBy = (difficulty: string) => catalogChallenges.filter((challenge) => challenge.difficulty === difficulty).length;


// "Soma de dois números" está no modo função: o aluno implementa somar(a, b).
const validSolution = "function somar(a, b) { return a + b; }";

function makeApp() {
  const store = new InMemoryStore();
  const app = createApp(store, {
    jwtSecret: "segredo-de-integracao-com-32-caracteres"
  });
  return { app, store };
}

async function register(app: ReturnType<typeof createApp>) {
  return request(app).post("/api/auth/register").send({
    name: "Ana Silva",
    email: "ana@email.com",
    password: "123456"
  });
}

describe("API de autenticação", () => {
  it("cadastra, retorna usuário seguro e permite consultar a propria sessão", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);

    const registration = await agent.post("/api/auth/register").send({
      name: "Ana Silva",
      email: "ana@email.com",
      password: "123456"
    });

    expect(registration.status).toBe(201);
    expect(registration.body.user).toMatchObject({
      name: "Ana Silva",
      email: "ana@email.com",
      role: "student"
    });
    expect(registration.body.user).not.toHaveProperty("passwordHash");
    expect(registration.body).not.toHaveProperty("accessToken");
    expect(registration.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(registration.headers["set-cookie"]?.[0]).toContain("SameSite=Strict");

    const profile = await agent.get("/api/me");

    expect(profile.status).toBe(200);
    expect(profile.body.user.email).toBe("ana@email.com");
    expect(profile.body.score.totalPoints).toBe(0);
    expect(profile.body.progress).toMatchObject({
      totalChallenges: catalogChallenges.length,
      solvedChallenges: 0,
      pendingChallenges: catalogChallenges.length
    });
    expect(profile.body.progress.byDifficulty).toEqual([
      { difficulty: "easy", total: countBy("easy"), solved: 0, percentage: 0 },
      { difficulty: "medium", total: countBy("medium"), solved: 0, percentage: 0 },
      { difficulty: "hard", total: countBy("hard"), solved: 0, percentage: 0 }
    ]);
  });

  it("faz login com credenciais validas", async () => {
    const { app } = makeApp();
    await register(app);

    const response = await request(app).post("/api/auth/login").send({
      email: "ANA@EMAIL.COM",
      password: "123456"
    });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Login realizado com sucesso.");
    expect(response.body).not.toHaveProperty("accessToken");
    expect(response.headers["set-cookie"]?.[0]).toContain("codelab_session=");
  });

  it("rejeita e-mail duplicado e credenciais incorretas com status coerentes", async () => {
    const { app } = makeApp();
    await register(app);

    const duplicate = await register(app);
    expect(duplicate.status).toBe(409);

    const invalidLogin = await request(app).post("/api/auth/login").send({
      email: "ana@email.com",
      password: "senha-errada"
    });
    expect(invalidLogin.status).toBe(401);
    expect(invalidLogin.body).toEqual({ error: "E-mail ou senha inválidos." });
  });

  it("protege perfil, historico e submissão sem token", async () => {
    const { app } = makeApp();

    await request(app).get("/api/me").expect(401);
    await request(app).get("/api/submissions").expect(401);
    await request(app)
      .post("/api/challenges/soma-de-dois-numeros/submissions")
      .send({ language: "javascript", sourceCode: validSolution })
      .expect(401);
  });

  it("vincula submissão ao usuário do token, ignorando identidade enviada pelo cliente", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    const registration = await agent.post("/api/auth/register").send({
      name: "Ana Silva",
      email: "ana@email.com",
      password: "123456"
    });

    const response = await agent
      .post("/api/challenges/soma-de-dois-numeros/submissions")
      .send({
        userId: "user-admin",
        language: "javascript",
        sourceCode: validSolution
      });

    expect(response.status).toBe(201);
    expect(response.body.submission.userId).toBe(registration.body.user.id);
    expect(response.body.submission.result).toMatchObject({
      passedTests: 24,
      totalTests: 24,
      failedTest: null
    });
    expect(response.body.submission.feedback.title).toBe("Aceito");
    expect(JSON.stringify(response.body)).not.toContain("[-2,10]");
    expect(JSON.stringify(response.body)).not.toContain("tc-soma-privado-1");

    const history = await agent.get("/api/submissions?userId=user-marina");
    expect(history.body.submissions).toHaveLength(1);
    expect(history.body.submissions[0].userId).toBe(registration.body.user.id);
  });

  it("mostra entrada, saída esperada e saída recebida do caso que falhou", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Ana Silva",
      email: "feedback@email.com",
      password: "123456"
    });

    const response = await agent
      .post("/api/challenges/soma-de-dois-numeros/submissions")
      .send({ language: "javascript", sourceCode: "function somar() { return 999; }" });

    expect(response.status).toBe(201);
    expect(response.body.submission.status).toBe("wrong_answer");
    expect(response.body.submission.result).toMatchObject({
      passedTests: 0,
      totalTests: 24,
      failedTest: {
        position: 1,
        isPublic: true,
        input: "[3,5]",
        expectedOutput: "8",
        actualOutput: "999"
      }
    });
    expect(response.body.submission.feedback.message).toContain("caso 1 de 24");
    expect(JSON.stringify(response.body)).not.toContain("[-2,10]");
  });

  it("revela somente o caso oculto que falhou, nunca os seguintes", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Ana Silva",
      email: "oculto@email.com",
      password: "123456"
    });
    const hardcoded = "function somar(a, b) { return a === 10 && b === -4 ? 6 : 8; }";

    const response = await agent
      .post("/api/challenges/soma-de-dois-numeros/submissions")
      .send({ language: "javascript", sourceCode: hardcoded });
    const serialized = JSON.stringify(response.body);

    expect(response.body.submission.status).toBe("wrong_answer");
    expect(response.body.submission.result.failedTest).toMatchObject({
      position: 4,
      isPublic: false,
      input: "[0,0]",
      expectedOutput: "0"
    });
    expect(response.body.submission.feedback.message).toContain("(oculto)");
    expect(serialized).not.toContain("[-2,10]");
    expect(serialized).not.toContain("[-1000,-1000]");
  });

  it("executa os casos publicos sem registrar submissão", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Ana Silva",
      email: "executar@email.com",
      password: "123456"
    });

    const response = await agent
      .post("/api/challenges/soma-de-dois-numeros/run")
      .send({
        language: "javascript",
        sourceCode: "function somar() { return 8; }",
        customInput: "[1, 1]"
      });
    const history = await agent.get("/api/submissions");

    expect(response.status).toBe(200);
    expect(response.body.run.compileError).toBeNull();
    expect(
      response.body.run.cases.map((runCase: { passed: boolean | null }) => runCase.passed)
    ).toEqual([true, false, null]);
    expect(JSON.stringify(response.body)).not.toContain("[-2,10]");
    expect(history.body.submissions).toHaveLength(0);
  });

  it("reporta erro de sintaxe como compile_error", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Ana Silva",
      email: "sintaxe@email.com",
      password: "123456"
    });

    const response = await agent
      .post("/api/challenges/soma-de-dois-numeros/submissions")
      .send({ language: "javascript", sourceCode: "console.log((1 + 2);" });

    expect(response.body.submission.status).toBe("compile_error");
    expect(response.body.submission.result.compileError).toContain("solucao.js:1");
    expect(response.body.submission.result.failedTest).toBeNull();
  });

  it("filtra o historico autenticado por status e rejeita status desconhecido", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Ana Silva",
      email: "historico@email.com",
      password: "123456"
    });

    await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({
      language: "javascript",
      sourceCode: validSolution
    });
    await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({
      language: "javascript",
      sourceCode: "function somar() { return 999; }"
    });

    const accepted = await agent.get("/api/submissions?status=accepted");
    const wrongAnswer = await agent.get("/api/submissions?status=wrong_answer");
    const all = await agent.get("/api/submissions");
    const invalid = await agent.get("/api/submissions?status=unknown");

    expect(accepted.status).toBe(200);
    expect(accepted.body.filters).toEqual({ status: "accepted" });
    expect(accepted.body.submissions).toHaveLength(1);
    expect(accepted.body.submissions[0].status).toBe("accepted");
    expect(wrongAnswer.body.submissions).toHaveLength(1);
    expect(wrongAnswer.body.submissions[0].status).toBe("wrong_answer");
    expect(all.body.filters).toEqual({ status: null });
    expect(all.body.submissions).toHaveLength(2);
    expect(invalid.status).toBe(400);
  });

  it("aceita logout como encerramento da sessão no cliente", async () => {
    const { app } = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Ana Silva",
      email: "ana@email.com",
      password: "123456"
    });

    const response = await agent.post("/api/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Logout realizado com sucesso." });
    expect(response.headers["set-cookie"]?.[0]).toContain(
      "codelab_session=;"
    );
    await agent.get("/api/me").expect(401);
  });
});
