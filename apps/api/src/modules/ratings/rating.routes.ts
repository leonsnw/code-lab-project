import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import type { RatingService } from "./rating.service.js";

const paramsSchema = z.object({
  slug: z.string().trim().min(1)
});

const ratingSchema = z.object({
  value: z.number().int().min(1).max(5)
});

export function createRatingRouter(
  service: RatingService,
  requireAuth: RequestHandler
): Router {
  const router = Router();

  router.get("/:slug/rating", requireAuth, async (request, response) => {
    const user = getAuthenticatedUser(response);
    const { slug } = paramsSchema.parse(request.params);
    const summary = await service.getSummary(slug, user.id);
    response.json({ summary });
  });

  router.put("/:slug/rating", requireAuth, async (request, response) => {
    const user = getAuthenticatedUser(response);
    const { slug } = paramsSchema.parse(request.params);
    const { value } = ratingSchema.parse(request.body);
    const result = await service.rate({
      challengeSlug: slug,
      userId: user.id,
      value
    });
    response.json(result);
  });

  return router;
}
