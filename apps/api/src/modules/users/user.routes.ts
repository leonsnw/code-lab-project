import { Router, type RequestHandler } from "express";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";

export function createUserRouter(requireAuth: RequestHandler): Router {
  const router = Router();
  router.get("/me", requireAuth, (_request, response) => {
    response.json({ user: getAuthenticatedUser(response) });
  });
  return router;
}
