import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import type { LearningService } from "./learning.service.js";

const slugSchema = z.string().trim().min(1).max(160);

export function createTrackRouter(service: LearningService, requireAuth: RequestHandler): Router {
  const router = Router();

  router.get("/tracks", async (_request, response) => {
    response.json(await service.catalog());
  });

  router.get("/tracks/progress", requireAuth, async (_request, response) => {
    const user = getAuthenticatedUser(response);
    response.json(await service.progress(user.id));
  });

  router.get("/lessons/:slug", async (request, response) => {
    response.json(await service.lesson(slugSchema.parse(request.params.slug)));
  });

  router.post("/lessons/:slug/complete", requireAuth, async (request, response) => {
    const user = getAuthenticatedUser(response);
    const lesson = await service.completeLesson(user.id, slugSchema.parse(request.params.slug));
    response.json({ message: "Lição concluída.", lessonId: lesson.id });
  });

  return router;
}
