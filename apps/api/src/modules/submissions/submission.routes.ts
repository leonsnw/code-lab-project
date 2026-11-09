import { Router, type Request, type RequestHandler, type Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { CodeLabStore } from "../../database/codelab-store.js";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import { presentSubmission } from "./submission.presenter.js";
import {
  createSubmissionSchema,
  runSolutionSchema,
  type SubmissionService
} from "./submission.service.js";

/** Tamanho padrão e máximo de uma página do histórico de submissões. */
export const DEFAULT_HISTORY_PAGE_SIZE = 20;
export const MAX_HISTORY_PAGE_SIZE = 100;

/**
 * Chave dos limites de envio: cada pessoa tem o próprio limite. Por IP, os alunos de
 * um laboratório (que saem pelo mesmo IP público) dividiriam as 20 submissões, e um
 * deles poderia bloquear os colegas. As rotas passam por `requireAuth` antes do limite;
 * o IP só entra como reserva.
 */
function rateLimitKey(request: Request, response: Response): string {
  try {
    return `user:${getAuthenticatedUser(response).id}`;
  } catch {
    return ipKeyGenerator(request.ip ?? "");
  }
}

interface SubmissionRouterDependencies {
  store: CodeLabStore;
  submissionService: SubmissionService;
  requireAuth: RequestHandler;
}

export function createSubmissionRouter({
  store,
  submissionService,
  requireAuth
}: SubmissionRouterDependencies): Router {
  const router = Router();
  const submissionRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 20,
    keyGenerator: rateLimitKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Muitas submissões. Aguarde alguns minutos antes de tentar novamente."
    }
  });

  const runRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 60,
    keyGenerator: rateLimitKey,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Muitas execucoes. Aguarde alguns minutos antes de tentar novamente."
    }
  });

  const historyQuerySchema = z.object({
    status: z
      .enum([
        "pending",
        "accepted",
        "wrong_answer",
        "runtime_error",
        "timeout",
        "compile_error",
        "rule_violation",
        "internal_error"
      ])
      .optional(),
    page: z.coerce.number().int("A página deve ser um número inteiro.").min(1, "A página começa em 1.").default(1),
    limit: z.coerce
      .number()
      .int("O limite deve ser um número inteiro.")
      .min(1, "O limite deve ser de pelo menos 1.")
      .max(MAX_HISTORY_PAGE_SIZE, `O limite deve ser de no máximo ${MAX_HISTORY_PAGE_SIZE}.`)
      .default(DEFAULT_HISTORY_PAGE_SIZE)
  });

  router.post(
    "/challenges/:slug/run",
    requireAuth,
    runRateLimit,
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const challengeSlug = z.string().parse(request.params.slug);
      const body = runSolutionSchema.parse(request.body);
      const run = await submissionService.run({
        challengeSlug,
        userId: user.id,
        language: body.language,
        sourceCode: body.sourceCode,
        customInput: body.customInput
      });
      response.json({ run });
    }
  );

  router.post(
    "/challenges/:slug/submissions",
    requireAuth,
    submissionRateLimit,
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const challengeSlug = z.string().parse(request.params.slug);
      const body = createSubmissionSchema.parse(request.body);
      const submission = await submissionService.submit({
        challengeSlug,
        userId: user.id,
        language: body.language,
        sourceCode: body.sourceCode
      });

      response.status(201).json({
        submission: presentSubmission(submission),
        score: await store.getScore(submission.userId)
      });
    }
  );

  router.get("/submissions", requireAuth, async (request, response) => {
    const user = getAuthenticatedUser(response);
    const query = historyQuerySchema.parse(request.query);
    // Cada submissão leva o código e o veredito completos: devolver todas de uma vez
    // pesa para quem acumula dezenas de tentativas ao longo do semestre.
    const { items, total } = await store.listSubmissionsPage(
      { userId: user.id, status: query.status },
      { skip: (query.page - 1) * query.limit, take: query.limit }
    );
    response.json({
      submissions: items.map(presentSubmission),
      filters: { status: query.status ?? null },
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit))
      }
    });
  });

  return router;
}
