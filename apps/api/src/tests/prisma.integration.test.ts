import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaStore } from "../database/prisma-store.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { BcryptPasswordHasher } from "../modules/auth/bcrypt-password-hasher.js";
import { JwtTokenService } from "../modules/auth/jwt-token.service.js";
import { createApp } from "../server.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "1";
const prisma = new PrismaClient();
const store = new PrismaStore(prisma);

function makeAuthService() {
  return new AuthService(
    store,
    new BcryptPasswordHasher(),
    new JwtTokenService("segredo-de-integracao-com-32-caracteres")
  );
}

describe.skipIf(!runDatabaseTests)("autenticacao com PostgreSQL", () => {
  beforeAll(async () => {
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
  });

  afterAll(async () => prisma.$disconnect());

  it("persiste hash bcrypt e autentica sem expor credenciais", async () => {
    const id = randomUUID();
    const email = `${id}@codelab.local`;
    const service = makeAuthService();
    try {
      const registration = await service.register({
        name: "Teste PostgreSQL",
        email,
        password: "123456"
      });
      const persisted = await prisma.user.findUnique({ where: { email } });
      const login = await service.login({ email: email.toUpperCase(), password: "123456" });

      expect(registration.user).not.toHaveProperty("passwordHash");
      expect(persisted?.passwordHash).not.toBe("123456");
      expect(persisted?.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(login.user.email).toBe(email);
      expect(login.user).not.toHaveProperty("passwordHash");
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  it("resolve cadastros concorrentes do mesmo e-mail como conflito", async () => {
    const email = `${randomUUID()}@codelab.local`;
    const service = makeAuthService();
    try {
      const results = await Promise.allSettled([
        service.register({ name: "Primeiro Usuario", email, password: "123456" }),
        service.register({ name: "Segundo Usuario", email, password: "123456" })
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")).toEqual([
        expect.objectContaining({
          reason: expect.objectContaining({
            statusCode: 409,
            message: "E-mail ja cadastrado."
          })
        })
      ]);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  it("mantem sessao por cookie entre cadastro, perfil e logout", async () => {
    const email = `${randomUUID()}@codelab.local`;
    const app = createApp(store, {
      jwtSecret: "segredo-de-integracao-com-32-caracteres",
      environment: "test"
    });
    const agent = request.agent(app);
    try {
      const registration = await agent.post("/api/auth/register").send({
        name: "Teste HTTP PostgreSQL",
        email,
        password: "123456"
      });
      const profile = await agent.get("/api/me");
      const logout = await agent.post("/api/auth/logout");
      const afterLogout = await agent.get("/api/me");

      expect(registration.status).toBe(201);
      expect(registration.headers["set-cookie"]?.[0]).toContain("HttpOnly");
      expect(profile.status).toBe(200);
      expect(profile.body.user.email).toBe(email);
      expect(logout.status).toBe(200);
      expect(afterLogout.status).toBe(401);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });
});
