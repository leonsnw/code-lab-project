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

describe("configuracao de seguranca HTTP", () => {
  it("exige JWT_SECRET explicito em producao", () => {
    delete process.env.JWT_SECRET;

    expect(() =>
      createApp(new InMemoryStore(), { environment: "production" })
    ).toThrow("JWT_SECRET e obrigatorio");
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
});
