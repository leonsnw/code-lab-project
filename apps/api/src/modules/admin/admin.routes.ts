import { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  getAuthenticatedUser,
  requireRole
} from "../auth/auth.middleware.js";
import type { AdminChallengeService } from "./admin-challenge.service.js";
import type { AdminStatisticsService } from "./admin-statistics.service.js";

const challengeParamsSchema = z.object({
  challengeId: z.string().trim().min(1).max(120)
});

export function createAdminRouter(
  challengeService: AdminChallengeService,
  statisticsService: AdminStatisticsService,
  requireAuth: RequestHandler
): Router {
  const router = Router();
  router.use(requireAuth, requireRole("admin"));

  router.get("/challenges", async (_request, response) => {
    response.json({ challenges: await challengeService.list() });
  });

  router.get("/challenges/:challengeId", async (request, response) => {
    const { challengeId } = challengeParamsSchema.parse(request.params);
    response.json({ challenge: await challengeService.get(challengeId) });
  });

  router.post("/challenges", async (request, response) => {
    const user = getAuthenticatedUser(response);
    const challenge = await challengeService.create(user.id, request.body);
    response.status(201).json({ challenge });
  });

  router.put("/challenges/:challengeId", async (request, response) => {
    const { challengeId } = challengeParamsSchema.parse(request.params);
    const challenge = await challengeService.update(challengeId, request.body);
    response.json({ challenge });
  });

  router.delete("/challenges/:challengeId", async (request, response) => {
    const { challengeId } = challengeParamsSchema.parse(request.params);
    const challenge = await challengeService.remove(challengeId);
    response.json({
      message: "Desafio removido do catalogo.",
      challenge
    });
  });

  router.get("/statistics", async (_request, response) => {
    response.json(await statisticsService.get());
  });

  return router;
}
