import { Router, type RequestHandler } from "express";
import type { CodeLabStore } from "../../database/codelab-store.js";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";

export function createUserRouter(
  store: CodeLabStore,
  requireAuth: RequestHandler
): Router {
  const router = Router();

  router.get("/me", requireAuth, async (_request, response) => {
    const user = getAuthenticatedUser(response);
    const [score, progress] = await Promise.all([
      store.getScore(user.id),
      store.getUserProgress(user.id)
    ]);
    response.json({
      user,
      score,
      progress
    });
  });

  return router;
}
