import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthService } from "./auth.service.js";
import { clearSessionCookie, setSessionCookie } from "./session-cookie.js";

interface AuthRouterDependencies {
  authService: AuthService;
  requireAuth: RequestHandler;
  production: boolean;
}

export function createAuthRouter({
  authService,
  requireAuth,
  production
}: AuthRouterDependencies): Router {
  const router = Router();
  const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitas tentativas. Aguarde antes de tentar novamente." }
  });

  router.post("/register", authRateLimit, async (request, response) => {
    const session = await authService.register(request.body);
    setSessionCookie(response, session.accessToken, production);
    response.status(201).json({ message: "Conta criada com sucesso.", user: session.user });
  });

  router.post("/login", authRateLimit, async (request, response) => {
    const session = await authService.login(request.body);
    setSessionCookie(response, session.accessToken, production);
    response.json({ message: "Login realizado com sucesso.", user: session.user });
  });

  router.post("/logout", requireAuth, (_request, response) => {
    clearSessionCookie(response, production);
    response.json({ message: "Logout realizado com sucesso." });
  });
  return router;
}
