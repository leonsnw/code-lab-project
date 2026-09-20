import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import { presentSubmission } from "../submissions/submission.presenter.js";

const challengeQuerySchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]).optional()
});

export function createChallengeRouter(
  store: CodeLabStore,
  requireAuth: RequestHandler
): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    const query = challengeQuerySchema.parse(request.query);
    const challenges = (await store.listChallenges(query.difficulty)).map(
      (challenge) => ({
        id: challenge.id,
        slug: challenge.slug,
        title: challenge.title,
        difficulty: challenge.difficulty,
        points: challenge.points,
        tags: challenge.tags
      })
    );
    response.json({ challenges });
  });

  router.get("/:slug", requireAuth, async (request, response) => {
    const user = getAuthenticatedUser(response);
    const challengeSlug = z.string().parse(request.params.slug);
    const challenge = await store.findChallengeBySlug(challengeSlug);
    if (!challenge || !challenge.isActive) {
      throw new DomainError("Desafio nao encontrado.", 404);
    }

    const [score, submissions] = await Promise.all([
      store.getScore(user.id),
      store.listSubmissions(user.id, challenge.id)
    ]);

    response.json({
      challenge: {
        id: challenge.id,
        slug: challenge.slug,
        title: challenge.title,
        difficulty: challenge.difficulty,
        points: challenge.points,
        description: challenge.description,
        constraints: challenge.constraints,
        tags: challenge.tags,
        examples: challenge.examples,
        publicTestCases: challenge.testCases
          .filter((testCase) => testCase.isPublic)
          .map((testCase) => ({
            id: testCase.id,
            input: testCase.input,
            expectedOutput: testCase.expectedOutput
          }))
      },
      score,
      submissions: submissions.map(presentSubmission)
    });
  });

  return router;
}
