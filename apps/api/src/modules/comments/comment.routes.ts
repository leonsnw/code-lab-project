import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import type { CommentService } from "./comment.service.js";

const paramsSchema = z.object({
  slug: z.string().trim().min(1)
});

const commentSchema = z.object({
  content: z.string().trim().min(1).max(1000)
});

export function createCommentRouter(
  service: CommentService,
  requireAuth: RequestHandler
): Router {
  const router = Router();

  router.get("/:slug/comments", requireAuth, async (request, response) => {
    const { slug } = paramsSchema.parse(request.params);
    const comments = await service.list(slug);
    response.json({ comments });
  });

  router.post("/:slug/comments", requireAuth, async (request, response) => {
    const user = getAuthenticatedUser(response);
    const { slug } = paramsSchema.parse(request.params);
    const { content } = commentSchema.parse(request.body);
    const comment = await service.create({
      challengeSlug: slug,
      userId: user.id,
      content
    });
    response.status(201).json({ comment });
  });

  return router;
}
