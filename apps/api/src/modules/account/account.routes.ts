import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import type { AuthService } from "../auth/auth.service.js";
import { clearSessionCookie, setSessionCookie } from "../auth/session-cookie.js";
import type { AccountService } from "./account.service.js";

interface AccountRouterDependencies {
  accountService: AccountService;
  authService: AuthService;
  requireAuth: RequestHandler;
  production: boolean;
}

export function createAccountRouter({ accountService, authService, requireAuth, production }: AccountRouterDependencies): Router {
  const router = Router();
  // Pedidos por e-mail são caros e podem ser usados para incomodar terceiros.
  const mailRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitos pedidos. Aguarde alguns minutos antes de tentar de novo." }
  });

  router.post("/auth/forgot-password", mailRateLimit, async (request, response) => {
    await accountService.requestPasswordReset(request.body);
    response.json({ message: "Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha." });
  });

  // Redefinir exige o token do e-mail (32 bytes aleatórios); o limite só freia abuso.
  const resetRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitas tentativas. Aguarde alguns minutos antes de tentar de novo." }
  });

  router.post("/auth/reset-password", resetRateLimit, async (request, response) => {
    await accountService.resetPassword(request.body);
    clearSessionCookie(response, production);
    response.json({ message: "Senha redefinida. Entre com a nova senha." });
  });

  router.post("/auth/verify-email", async (request, response) => {
    await accountService.verifyEmail(request.body);
    response.json({ message: "E-mail verificado." });
  });

  router.post("/me/verification", requireAuth, mailRateLimit, async (_request, response) => {
    await accountService.sendVerification(getAuthenticatedUser(response));
    response.json({ message: "Enviamos um novo link de verificação para o seu e-mail." });
  });

  router.get("/me/account", requireAuth, async (_request, response) => {
    response.json({ account: await accountService.account(getAuthenticatedUser(response).id) });
  });

  router.patch("/me", requireAuth, async (request, response) => {
    const user = await accountService.updateProfile(getAuthenticatedUser(response).id, request.body);
    response.json({ message: "Perfil atualizado.", user });
  });

  router.put("/me/password", requireAuth, async (request, response) => {
    const { user, passwordHash } = await accountService.changePassword(getAuthenticatedUser(response).id, request.body);
    // As outras sessões caem; esta recebe um cookie novo com a senha atual.
    setSessionCookie(response, authService.startSession(user, passwordHash).accessToken, production);
    response.json({ message: "Senha alterada. As outras sessões foram encerradas." });
  });

  router.get("/me/export", requireAuth, async (_request, response) => {
    const data = await accountService.exportData(getAuthenticatedUser(response).id);
    response.setHeader("Content-Disposition", `attachment; filename="codelab-meus-dados.json"`);
    response.json(data);
  });

  router.delete("/me", requireAuth, async (request, response) => {
    await accountService.deleteAccount(getAuthenticatedUser(response).id, request.body);
    clearSessionCookie(response, production);
    response.json({ message: "Conta e dados apagados." });
  });

  return router;
}
