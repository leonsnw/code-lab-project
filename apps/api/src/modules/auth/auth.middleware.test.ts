import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { DomainError } from "../../common/domain-error.js";
import { InMemoryStore } from "../../database/in-memory-store.js";
import type { TokenService } from "./auth.contracts.js";
import { createRequireAuth, requireRole } from "./auth.middleware.js";

function makeApp() {
  const store = new InMemoryStore([
    {
      id: "student-1",
      name: "Estudante",
      email: "student@test.local",
      role: "student",
      passwordHash: "hash"
    },
    {
      id: "admin-1",
      name: "Administrador",
      email: "admin@test.local",
      role: "admin",
      passwordHash: "hash"
    }
  ]);
  const tokenService: TokenService = {
    issue: () => "token",
    verify: (token) => ({ userId: token === "admin-token" ? "admin-1" : "student-1" })
  };
  const requireAuth = createRequireAuth(store, tokenService);
  const app = express();
  app.get("/protected", requireAuth, (_request, response) => response.json({ allowed: true }));
  app.get("/admin", requireAuth, requireRole("admin"), (_request, response) =>
    response.json({ allowed: true })
  );
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof DomainError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }
    response.status(500).json({ error: "Erro inesperado." });
  });
  return app;
}

describe("middlewares de autorizacao", () => {
  it("bloqueia requisicao sem token", async () => {
    await request(makeApp()).get("/protected").expect(401);
  });

  it("permite usuario autenticado", async () => {
    await request(makeApp()).get("/protected").set("Authorization", "Bearer student-token").expect(200);
  });

  it("impede estudante de acessar rota administrativa", async () => {
    const response = await request(makeApp())
      .get("/admin")
      .set("Authorization", "Bearer student-token");
    expect(response.status).toBe(403);
  });

  it("permite administrador em rota administrativa", async () => {
    await request(makeApp()).get("/admin").set("Authorization", "Bearer admin-token").expect(200);
  });
});
