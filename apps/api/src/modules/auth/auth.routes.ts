import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import type { User } from "../../domain/types.js";
import type { AuthService } from "./auth.service.js";
import {
  clearSessionCookie,
  setSessionCookie
} from "./session-cookie.js";

interface AuthRouterDependencies {
  authService: AuthService;
  /** Chamado depois do cadastro (ex.: enviar o e-mail de verificação). Falhas não impedem o cadastro. */
  onRegistered?: (user: User) => Promise<void>;
  requireAuth: RequestHandler;
  production: boolean;
}

export function createAuthRouter({
  authService,
  onRegistered,
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
    await onRegistered?.(session.user).catch((error) => console.error("Falha ao enviar o e-mail de verificação:", error));
    response.status(201).json({
      message: "Conta criada com sucesso.",
      user: session.user
    });
  });

  router.post("/login", authRateLimit, async (request, response) => {
    const session = await authService.login(request.body);
    setSessionCookie(response, session.accessToken, production);
    response.json({
      message: "Login realizado com sucesso.",
      user: session.user
    });
  });

  router.post("/logout", requireAuth, (_request, response) => {
    clearSessionCookie(response, production);
    response.json({ message: "Logout realizado com sucesso." });
  });

  return router;
}
