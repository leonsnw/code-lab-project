import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import type { StatsService } from "./stats.service.js";

const runtimeQuerySchema = z.object({
  language: z.enum(["javascript", "c", "python"]),
  ms: z.coerce.number().int().min(0).max(600000).optional()
});

export function createStatsRouter(store: CodeLabStore, stats: StatsService, requireAuth: RequestHandler): Router {
  const router = Router();

  router.get("/me/activity", requireAuth, async (_request, response) => {
    response.json({ activity: await stats.activity(getAuthenticatedUser(response).id) });
  });

  router.get("/users/:userId/profile", async (request, response) => {
    response.json({ profile: await stats.publicProfile(z.string().min(1).max(100).parse(request.params.userId)) });
  });

  router.get("/challenges/:slug/runtime", requireAuth, async (request, response) => {
    const query = runtimeQuerySchema.parse(request.query);
    const challenge = await store.findChallengeBySlug(z.string().parse(request.params.slug));
    if (!challenge || !challenge.isActive || challenge.isPublished === false) throw new DomainError("Desafio não encontrado.", 404);
    response.json({ runtime: await stats.runtime(challenge, query.language, getAuthenticatedUser(response).id, query.ms) });
  });

  return router;
}
