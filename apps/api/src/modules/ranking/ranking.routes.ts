import { Router } from "express";
import { z } from "zod";
import type { StatsService } from "../stats/stats.service.js";

const rankingQuerySchema = z.object({
  periodo: z.enum(["semana", "mes", "tudo"]).default("tudo"),
  trilha: z.string().min(1).max(80).optional()
});

export function createRankingRouter(stats: StatsService): Router {
  const router = Router();

  router.get("/", async (request, response) => {
    const query = rankingQuerySchema.parse(request.query);
    response.json({ ranking: await stats.ranking(query.periodo, query.trilha), period: query.periodo, track: query.trilha ?? null });
  });

  return router;
}
