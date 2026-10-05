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
import { AdminToolsService } from "./modules/admin/admin-tools.service.js";
import { AdminStatisticsService } from "./modules/admin/admin-statistics.service.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { BcryptPasswordHasher } from "./modules/auth/bcrypt-password-hasher.js";
import { createAccountRouter } from "./modules/account/account.routes.js";
import { Metrics, metricsHandler, requestObservability } from "./modules/observability/metrics.js";
import { checkSandboxAvailability } from "./modules/submissions/submission-evaluation.service.js";
import { createAdminClassRouter, createStudentClassRouter } from "./modules/classes/class.routes.js";
import { ClassService } from "./modules/classes/class.service.js";
import { AccountService } from "./modules/account/account.service.js";
import { createMailer, type Mailer } from "./modules/mail/mailer.js";
import { createRequireAuth, requireRole } from "./modules/auth/auth.middleware.js";
import { JwtTokenService } from "./modules/auth/jwt-token.service.js";
import { createChallengeRouter } from "./modules/challenges/challenge.routes.js";
import { createCommentRouter } from "./modules/comments/comment.routes.js";
import { CommentService } from "./modules/comments/comment.service.js";
import { createRankingRouter } from "./modules/ranking/ranking.routes.js";
import { createStatsRouter } from "./modules/stats/stats.routes.js";
import { StatsService } from "./modules/stats/stats.service.js";
import { createRatingRouter } from "./modules/ratings/rating.routes.js";
import { RatingService } from "./modules/ratings/rating.service.js";
import { ScoreService } from "./modules/scoring/score.service.js";
import { SubmissionEvaluationService } from "./modules/submissions/submission-evaluation.service.js";
import { createSubmissionRouter } from "./modules/submissions/submission.routes.js";
import { SubmissionService } from "./modules/submissions/submission.service.js";
import { createUserRouter } from "./modules/users/user.routes.js";
import { LearningService } from "./modules/tracks/learning.service.js";
import { createTrackRouter } from "./modules/tracks/track.routes.js";

const DEVELOPMENT_JWT_SECRET =
  "codelab-local-secret-change-before-production";

export interface AppOptions {
  jwtSecret?: string;
  environment?: "development" | "test" | "production";
  allowedOrigins?: string[];
  /** Destino dos e-mails transacionais (padrão: log em dev, memória em teste). */
  mailer?: Mailer;
  /** Endereço público usado nos links dos e-mails. */
  appUrl?: string;
  metrics?: Metrics;
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
  const requireAuth = createRequireAuth(store, tokenService, { production });
  const passwordHasher = new BcryptPasswordHasher();
  const authService = new AuthService(store, passwordHasher, tokenService);
  const accountService = new AccountService(store, passwordHasher, options.mailer ?? createMailer(environment), {
    appUrl: (options.appUrl ?? process.env.APP_URL ?? "http://localhost:3333").replace(/\/$/, "")
  });
  const scoreService = new ScoreService(store);
  const evaluator = new SubmissionEvaluationService();
  const submissionService = new SubmissionService(store, evaluator, scoreService);
  submissionService.onEvaluated = (submission, durationMs) => metrics.recordSubmission(submission.language, submission.status, durationMs);
  const commentService = new CommentService(store);
  const ratingService = new RatingService(store);
  const adminChallengeService = new AdminChallengeService(store);
  const adminStatisticsService = new AdminStatisticsService(store);

  app.disable("x-powered-by");
  // Cabeçalhos de segurança (equivalente enxuto ao helmet, sem dependência nova).
  // O frontend não usa scripts inline; estilos inline vêm dos atributos style.
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join("; ")
    );
    if (production) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    next();
  });
  app.use(
    cors({
      credentials: true,
      origin: createOriginValidator(
        options.allowedOrigins ?? resolveAllowedOrigins(production)
      )
    })
  );
  const metrics = options.metrics ?? new Metrics();
  app.use(requestObservability(metrics, { log: environment !== "test" && !process.env.VITEST && process.env.LOG_REQUESTS !== "0" }));
  app.use(cookieParser());
  // Administração envia desafios inteiros (casos de teste e soluções): limite maior, só para quem é admin.
  app.use("/api/admin", requireAuth, requireRole("admin"), express.json({ limit: "4mb" }));
  app.use(express.json({ limit: "64kb" }));

  const webDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../web/public"
  );
  app.use(express.static(webDir));

  // Saúde para balanceador/orquestrador: o processo responde e o juiz está disponível.
  let sandboxStatus: Awaited<ReturnType<typeof checkSandboxAvailability>> | null = null;
  app.get("/health", async (request, response) => {
    if (request.query.detalhes === undefined) {
      response.json({ status: "ok", service: "codelab-api" });
      return;
    }
    sandboxStatus ??= await checkSandboxAvailability();
    response.json({
      status: sandboxStatus.available ? "ok" : "degraded",
      service: "codelab-api",
      uptimeSeconds: Math.round((Date.now() - metrics.startedAt) / 1000),
      judge: { languages: Object.fromEntries(Object.entries(sandboxStatus.languages).map(([language, item]) => [language, item.available])) }
    });
  });
  app.get("/metrics", metricsHandler(metrics, production));
  app.use(
    "/api/auth",
    createAuthRouter({ authService, onRegistered: (user) => accountService.sendVerification(user), requireAuth, production })
  );
  app.use("/api", createAccountRouter({ accountService, authService, requireAuth, production }));
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
  const statsService = new StatsService(store);
  app.use("/api/ranking", createRankingRouter(statsService));
  app.use("/api", createStatsRouter(store, statsService, requireAuth));
  app.use("/api", createTrackRouter(new LearningService(store), requireAuth));
  const classService = new ClassService(store);
  app.use("/api/admin/classes", createAdminClassRouter(classService, requireAuth));
  app.use("/api", createStudentClassRouter(classService, requireAuth));
  app.use(
    "/api/admin",
    createAdminRouter(adminChallengeService, adminStatisticsService, requireAuth, new AdminToolsService(evaluator))
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
    throw new Error("JWT_SECRET é obrigatório em ambiente de produção.");
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
