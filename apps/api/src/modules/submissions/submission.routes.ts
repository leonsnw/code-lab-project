import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { CodeLabStore } from "../../database/codelab-store.js";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import { presentSubmission } from "./submission.presenter.js";
import {
  createSubmissionSchema,
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

  router.post(
    "/challenges/:slug/submissions",
    requireAuth,
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

  router.get("/submissions", requireAuth, async (_request, response) => {
    const user = getAuthenticatedUser(response);
    response.json({
      submissions: (await store.listSubmissions(user.id)).map(
        presentSubmission
      )
    });
  });

  return router;
}
