import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { errorHandler } from "./common/http/error-handler.js";
import type { CodeLabStore } from "./database/codelab-store.js";
import { PrismaStore } from "./database/prisma-store.js";
import { AdminChallengeService } from "./modules/admin/admin-challenge.service.js";
import { createAdminRouter } from "./modules/admin/admin.routes.js";
import { AdminStatisticsService } from "./modules/admin/admin-statistics.service.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { BcryptPasswordHasher } from "./modules/auth/bcrypt-password-hasher.js";
import { createRequireAuth } from "./modules/auth/auth.middleware.js";
import { JwtTokenService } from "./modules/auth/jwt-token.service.js";
import { createChallengeRouter } from "./modules/challenges/challenge.routes.js";
import { createCommentRouter } from "./modules/comments/comment.routes.js";
import { CommentService } from "./modules/comments/comment.service.js";
import { createRankingRouter } from "./modules/ranking/ranking.routes.js";
import { createRatingRouter } from "./modules/ratings/rating.routes.js";
import { RatingService } from "./modules/ratings/rating.service.js";
import { ScoreService } from "./modules/scoring/score.service.js";
import { SubmissionEvaluationService } from "./modules/submissions/submission-evaluation.service.js";
import { createSubmissionRouter } from "./modules/submissions/submission.routes.js";
import { SubmissionService } from "./modules/submissions/submission.service.js";
import { createUserRouter } from "./modules/users/user.routes.js";

const DEVELOPMENT_JWT_SECRET =
  "codelab-local-secret-change-before-production";

export interface AppOptions {
  jwtSecret?: string;
  environment?: "development" | "test" | "production";
  allowedOrigins?: string[];
}

export function createApp(
  store: CodeLabStore = new PrismaStore(),
  options: AppOptions = {}
) {
  const app = express();
  const environment = resolveEnvironment(options.environment);
  const production = environment === "production";
  const jwtSecret = resolveJwtSecret(options.jwtSecret, production);
  const tokenService = new JwtTokenService(jwtSecret);
  const requireAuth = createRequireAuth(store, tokenService);
  const authService = new AuthService(
    store,
    new BcryptPasswordHasher(),
    tokenService
  );
  const scoreService = new ScoreService(store);
  const submissionService = new SubmissionService(
    store,
    new SubmissionEvaluationService(),
    scoreService
  );
  const commentService = new CommentService(store);
  const ratingService = new RatingService(store);
  const adminChallengeService = new AdminChallengeService(store);
  const adminStatisticsService = new AdminStatisticsService(store);

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

  const webDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../web/public"
  );
  app.use(express.static(webDir));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: "codelab-api" });
  });
  app.use(
    "/api/auth",
    createAuthRouter({ authService, requireAuth, production })
  );
  app.use("/api", createUserRouter(store, requireAuth));
  app.use("/api/challenges", createChallengeRouter(store, requireAuth));
  app.use(
    "/api/challenges",
    createCommentRouter(commentService, requireAuth)
  );
  app.use(
    "/api/challenges",
    createRatingRouter(ratingService, requireAuth)
  );
  app.use(
    "/api",
    createSubmissionRouter({ store, submissionService, requireAuth })
  );
  app.use("/api/ranking", createRankingRouter(store));
  app.use(
    "/api/admin",
    createAdminRouter(adminChallengeService, adminStatisticsService, requireAuth)
  );

  app.use(errorHandler);
  return app;
}

function resolveEnvironment(
  configured?: AppOptions["environment"]
): NonNullable<AppOptions["environment"]> {
  if (configured) {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

function resolveJwtSecret(
  configured: string | undefined,
  production: boolean
): string {
  const secret = configured ?? process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }
  if (production) {
    throw new Error("JWT_SECRET e obrigatorio em ambiente de producao.");
  }
  return DEVELOPMENT_JWT_SECRET;
}

function createOriginValidator(allowedOrigins: string[]) {
  return (
    origin: string | undefined,
    callback: (error: Error | null, allowed?: boolean) => void
  ) => {
    callback(null, !origin || allowedOrigins.includes(origin));
  };
}

function resolveAllowedOrigins(production: boolean): string[] {
  const configured = process.env.WEB_ORIGIN?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured?.length) {
    return configured;
  }
  return production
    ? []
    : ["http://localhost:3000", "http://localhost:3333"];
}
