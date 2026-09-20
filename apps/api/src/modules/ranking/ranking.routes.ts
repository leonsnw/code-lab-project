import { Router } from "express";
import type { CodeLabStore } from "../../database/codelab-store.js";

export function createRankingRouter(store: CodeLabStore): Router {
  const router = Router();

  router.get("/", async (_request, response) => {
    response.json({ ranking: await store.getRanking() });
  });

  return router;
}
