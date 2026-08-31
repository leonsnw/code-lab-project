import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { createApp } from "./server.js";

const validSolution = `
const fs = require("fs");
const [a, b] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
console.log(a + b);
`;

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

describe("API de autenticacao", () => {
  it("cadastra, retorna usuario seguro e permite consultar a propria sessao", async () => {
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
      totalChallenges: 3,
      solvedChallenges: 0,
      pendingChallenges: 3
    });
    expect(profile.body.progress.byDifficulty).toEqual([
      { difficulty: "easy", total: 2, solved: 0, percentage: 0 },
      { difficulty: "medium", total: 1, solved: 0, percentage: 0 },
      { difficulty: "hard", total: 0, solved: 0, percentage: 0 }
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
    expect(invalidLogin.body).toEqual({ error: "E-mail ou senha invalidos." });
  });

  it("protege perfil, historico e submissao sem token", async () => {
    const { app } = makeApp();

    await request(app).get("/api/me").expect(401);
    await request(app).get("/api/submissions").expect(401);
    await request(app)
      .post("/api/challenges/soma-de-dois-numeros/submissions")
      .send({ language: "javascript", sourceCode: validSolution })
      .expect(401);
  });

  it("vincula submissao ao usuario do token, ignorando identidade enviada pelo cliente", async () => {
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
    expect(JSON.stringify(response.body)).not.toContain("-2 10");
    expect(JSON.stringify(response.body)).not.toContain("tc-soma-privado-1");

    const history = await agent.get("/api/submissions?userId=user-marina");
    expect(history.body.submissions).toHaveLength(1);
    expect(history.body.submissions[0].userId).toBe(registration.body.user.id);
  });

  it("aceita logout como encerramento da sessao no cliente", async () => {
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
