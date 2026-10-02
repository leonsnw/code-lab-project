import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { CodeLabStore } from "../../database/codelab-store.js";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import { presentSubmission } from "./submission.presenter.js";
import {
  createSubmissionSchema,
  runSolutionSchema,
  type SubmissionService
} from "./submission.service.js";

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
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: "Muitas submissões. Aguarde alguns minutos antes de tentar novamente."
    }
  });

  const runRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    limit: 60,
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
      .optional()
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
    response.json({
      submissions: (await store.listSubmissions(user.id, undefined, query.status)).map(
        presentSubmission
      ),
      filters: { status: query.status ?? null }
    });
  });

  return router;
}
