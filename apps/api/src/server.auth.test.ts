import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { createApp } from "./server.js";

function makeApp() {
  return createApp(new InMemoryStore(), {
    jwtSecret: "segredo-de-integracao-com-32-caracteres",
    environment: "test"
  });
}

async function register(app: ReturnType<typeof createApp>) {
  return request(app).post("/api/auth/register").send({
    name: "Ana Silva",
    email: "ana@email.com",
    password: "123456"
  });
}

describe("API de autenticacao", () => {
  it("cadastra, retorna usuario seguro e permite consultar a sessao", async () => {
    const app = makeApp();
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
  });

  it("faz login com credenciais validas", async () => {
    const app = makeApp();
    await register(app);
    const response = await request(app).post("/api/auth/login").send({
      email: "ANA@EMAIL.COM",
      password: "123456"
    });
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("accessToken");
    expect(response.headers["set-cookie"]?.[0]).toContain("codelab_session=");
  });

  it("marca o cookie como Secure em producao", async () => {
    const app = createApp(new InMemoryStore(), {
      jwtSecret: "segredo-de-producao-com-32-caracteres",
      environment: "production",
      allowedOrigins: ["https://codelab.example"]
    });
    const response = await request(app).post("/api/auth/register").send({
      name: "Ana Silva",
      email: "ana@email.com",
      password: "123456"
    });

    expect(response.status).toBe(201);
    expect(response.headers["set-cookie"]?.[0]).toContain("Secure");
  });

  it("rejeita e-mail duplicado e credenciais incorretas", async () => {
    const app = makeApp();
    await register(app);
    expect((await register(app)).status).toBe(409);
    const invalid = await request(app).post("/api/auth/login").send({
      email: "ana@email.com",
      password: "senha-errada"
    });
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({ error: "E-mail ou senha invalidos." });
  });

  it("protege o perfil sem sessao", async () => {
    await request(makeApp()).get("/api/me").expect(401);
  });

  it("encerra a sessao no logout", async () => {
    const app = makeApp();
    const agent = request.agent(app);
    await agent.post("/api/auth/register").send({
      name: "Ana Silva",
      email: "ana@email.com",
      password: "123456"
    });
    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(200);
    expect(logout.headers["set-cookie"]?.[0]).toContain("codelab_session=;");
    await agent.get("/api/me").expect(401);
  });
});
