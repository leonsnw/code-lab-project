import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { errorHandler } from "./common/http/error-handler.js";
import type { CodeLabStore } from "./database/codelab-store.js";
import { PrismaStore } from "./database/prisma-store.js";
import { createRequireAuth } from "./modules/auth/auth.middleware.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { BcryptPasswordHasher } from "./modules/auth/bcrypt-password-hasher.js";
import { JwtTokenService } from "./modules/auth/jwt-token.service.js";
import { createUserRouter } from "./modules/users/user.routes.js";

const DEVELOPMENT_JWT_SECRET = "codelab-local-secret-change-before-production";

export interface AppOptions {
  jwtSecret?: string;
  environment?: "development" | "test" | "production";
  allowedOrigins?: string[];
}

export function createApp(store: CodeLabStore = new PrismaStore(), options: AppOptions = {}) {
  const app = express();
  const environment = options.environment ??
    (process.env.NODE_ENV === "production" ? "production" : "development");
  const production = environment === "production";
  const secret = options.jwtSecret ?? process.env.JWT_SECRET;
  if (!secret && production) {
    throw new Error("JWT_SECRET e obrigatorio em ambiente de producao.");
  }
  const tokenService = new JwtTokenService(secret ?? DEVELOPMENT_JWT_SECRET);
  const requireAuth = createRequireAuth(store, tokenService);
  const authService = new AuthService(store, new BcryptPasswordHasher(), tokenService);

  app.disable("x-powered-by");
  app.use(
    cors({
      credentials: true,
      origin: createOriginValidator(
        options.allowedOrigins ?? resolveAllowedOrigins(production)
      )
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "64kb" }));

  const webDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/public");
  app.use(express.static(webDir));
  app.get("/health", (_request, response) =>
    response.json({ status: "ok", service: "codelab-api" })
  );
  app.use("/api/auth", createAuthRouter({ authService, requireAuth, production }));
  app.use("/api", createUserRouter(requireAuth));
  app.use(errorHandler);
  return app;
}

function createOriginValidator(allowedOrigins: string[]) {
  return (
    origin: string | undefined,
    callback: (error: Error | null, allowed?: boolean) => void
  ) => callback(null, !origin || allowedOrigins.includes(origin));
}

function resolveAllowedOrigins(production: boolean): string[] {
  const configured = process.env.WEB_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured?.length) return configured;
  return production ? [] : ["http://localhost:3000", "http://localhost:3334"];
}
