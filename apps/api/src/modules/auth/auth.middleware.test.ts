import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { DomainError } from "../../common/domain-error.js";
import { InMemoryStore } from "../../database/in-memory-store.js";
import type { TokenService } from "./auth.contracts.js";
import { createRequireAuth, requireRole } from "./auth.middleware.js";

function makeApp() {
  const store = new InMemoryStore();
  const tokenService: TokenService = {
    issue: () => "token",
    verify: (token) => ({
      userId: token === "admin-token" ? "user-admin" : "user-marina"
    })
  };
  const requireAuth = createRequireAuth(store, tokenService);
  const app = express();

  app.get("/protected", requireAuth, (_request, response) => {
    response.json({ allowed: true });
  });
  app.get(
    "/admin",
    requireAuth,
    requireRole("admin"),
    (_request, response) => {
      response.json({ allowed: true });
    }
  );
  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction
    ) => {
      if (error instanceof DomainError) {
        response.status(error.statusCode).json({ error: error.message });
        return;
      }
      response.status(500).json({ error: "Erro inesperado." });
    }
  );

  return app;
}

describe("middlewares de autorizacao", () => {
  it("bloqueia requisicao sem Bearer token", async () => {
    const response = await request(makeApp()).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Faça login para continuar.");
  });

  it("permite usuário autenticado em rota protegida comum", async () => {
    const response = await request(makeApp())
      .get("/protected")
      .set("Authorization", "Bearer student-token");

    expect(response.status).toBe(200);
  });

  it("impede estudante de acessar rota administrativa", async () => {
    const response = await request(makeApp())
      .get("/admin")
      .set("Authorization", "Bearer student-token");

    expect(response.status).toBe(403);
    expect(response.body.error).toBe(
      "Você não possui permissão para esta ação."
    );
  });

  it("permite administrador em rota administrativa", async () => {
    const response = await request(makeApp())
      .get("/admin")
      .set("Authorization", "Bearer admin-token");

    expect(response.status).toBe(200);
  });
});
