import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { createApp } from "./server.js";

const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});

describe("configuração de seguranca HTTP", () => {
  it("exige JWT_SECRET explicito em producao", () => {
    delete process.env.JWT_SECRET;

    expect(() =>
      createApp(new InMemoryStore(), { environment: "production" })
    ).toThrow("JWT_SECRET é obrigatório");
  });

  it("permite CORS apenas para origens configuradas", async () => {
    const app = createApp(new InMemoryStore(), {
      jwtSecret: "segredo-de-seguranca-com-32-caracteres",
      environment: "test",
      allowedOrigins: ["https://codelab.exemplo"]
    });

    const allowed = await request(app)
      .get("/health")
      .set("Origin", "https://codelab.exemplo");
    const denied = await request(app)
      .get("/health")
      .set("Origin", "https://origem-invalida.exemplo");

    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://codelab.exemplo"
    );
    expect(denied.headers).not.toHaveProperty("access-control-allow-origin");
    expect(allowed.headers).not.toHaveProperty("x-powered-by");
  });

  // Cada tentativa executa um bcrypt.compare, inclusive para e-mail inexistente,
  // para nao revelar a existencia da conta pelo tempo de resposta. As 21 tentativas
  // sequenciais ultrapassam o limite padrao de 5s do Vitest sob instrumentacao de cobertura.
  it("limita tentativas repetidas de login", async () => {
    const app = createApp(new InMemoryStore(), {
      jwtSecret: "segredo-de-rate-limit-com-32-caracteres",
      environment: "test"
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request(app).post("/api/auth/login").send({
        email: "inexistente@codelab.local",
        password: "123456"
      });
    }
    const blocked = await request(app).post("/api/auth/login").send({
      email: "inexistente@codelab.local",
      password: "123456"
    });

    expect(blocked.status).toBe(429);
  }, 30000);

  it("limita tentativas repetidas de submissão para proteger os casos ocultos", async () => {
    const app = createApp(new InMemoryStore(), {
      jwtSecret: "segredo-de-rate-limit-submissao-32-caracteres",
      environment: "test"
    });
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({
      email: "marina@codelab.local",
      password: "123456"
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({
        language: "javascript",
        sourceCode: "console.log(999);"
      });
    }

    await agent
      .post("/api/challenges/soma-de-dois-numeros/submissions")
      .send({ language: "javascript", sourceCode: "console.log(999);" })
      .expect(429);
  }, 30000);

  it("conta o limite de submissões por pessoa: quem esgota o seu não bloqueia o colega no mesmo IP", async () => {
    const app = createApp(new InMemoryStore(), {
      jwtSecret: "segredo-de-rate-limit-por-usuario-32-caracteres",
      environment: "test"
    });
    // No supertest todas as requisições saem do mesmo IP, como alunos de um laboratório.
    const ana = request.agent(app);
    const bruno = request.agent(app);
    await ana.post("/api/auth/register").send({ name: "Ana Silva", email: "ana@email.com", password: "12345678" }).expect(201);
    await bruno.post("/api/auth/register").send({ name: "Bruno Souza", email: "bruno@email.com", password: "12345678" }).expect(201);

    // Envios inválidos (400) também contam no limite e não rodam o juiz.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await ana.post("/api/challenges/soma-de-dois-numeros/submissions").send({}).expect(400);
    }
    await ana.post("/api/challenges/soma-de-dois-numeros/submissions").send({}).expect(429);

    // O colega continua com o limite inteiro.
    await bruno.post("/api/challenges/soma-de-dois-numeros/submissions").send({}).expect(400);
  }, 30000);

  it("o limite de execuções também é por pessoa", async () => {
    const app = createApp(new InMemoryStore(), {
      jwtSecret: "segredo-de-rate-limit-execucao-32-caracteres",
      environment: "test"
    });
    const ana = request.agent(app);
    const bruno = request.agent(app);
    await ana.post("/api/auth/register").send({ name: "Ana Silva", email: "ana@email.com", password: "12345678" }).expect(201);
    await bruno.post("/api/auth/register").send({ name: "Bruno Souza", email: "bruno@email.com", password: "12345678" }).expect(201);

    for (let attempt = 0; attempt < 60; attempt += 1) {
      await ana.post("/api/challenges/soma-de-dois-numeros/run").send({}).expect(400);
    }
    await ana.post("/api/challenges/soma-de-dois-numeros/run").send({}).expect(429);
    await bruno.post("/api/challenges/soma-de-dois-numeros/run").send({}).expect(400);
  }, 30000);
});
