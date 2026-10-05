import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { getAuthenticatedUser, requireRole } from "../auth/auth.middleware.js";
import type { ClassService } from "./class.service.js";

const idSchema = z.string().min(1).max(100);

/** Rotas do professor (administrador): criar turmas, acompanhar e exportar. */
export function createAdminClassRouter(classService: ClassService, requireAuth: RequestHandler): Router {
  const router = Router();
  router.use(requireAuth, requireRole("admin"));

  router.get("/", async (_request, response) => {
    response.json({ classes: await classService.list() });
  });

  router.post("/", async (request, response) => {
    const classGroup = await classService.create(getAuthenticatedUser(response), request.body);
    response.status(201).json({ classGroup: { ...classGroup, createdAt: classGroup.createdAt.toISOString() } });
  });

  router.get("/:classId", async (request, response) => {
    response.json(await classService.report(idSchema.parse(request.params.classId)));
  });

  router.get("/:classId/export.csv", async (request, response) => {
    const { filename, content } = await classService.exportCsv(idSchema.parse(request.params.classId));
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    response.send(content);
  });

  router.delete("/:classId", async (request, response) => {
    await classService.remove(idSchema.parse(request.params.classId));
    response.json({ message: "Turma removida." });
  });

  router.delete("/:classId/members/:userId", async (request, response) => {
    await classService.removeMember(idSchema.parse(request.params.classId), idSchema.parse(request.params.userId));
    response.json({ message: "Estudante removido da turma." });
  });

  return router;
}

/** Rotas do estudante: entrar com o código, listar e sair. */
export function createStudentClassRouter(classService: ClassService, requireAuth: RequestHandler): Router {
  const router = Router();

  router.post("/classes/join", requireAuth, async (request, response) => {
    const joined = await classService.join(getAuthenticatedUser(response), request.body);
    response.json({ message: `Você entrou na turma ${joined.name}.`, classGroup: joined });
  });

  router.get("/me/classes", requireAuth, async (_request, response) => {
    response.json({ classes: await classService.myClasses(getAuthenticatedUser(response)) });
  });

  router.delete("/me/classes/:classId", requireAuth, async (request, response) => {
    await classService.leave(getAuthenticatedUser(response), idSchema.parse(request.params.classId));
    response.json({ message: "Você saiu da turma." });
  });

  return router;
}
