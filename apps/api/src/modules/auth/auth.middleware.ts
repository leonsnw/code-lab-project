import type { NextFunction, Request, Response } from "express";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { User, UserRole } from "../../domain/types.js";
import type { TokenService } from "./auth.contracts.js";
import { passwordVersion } from "./password-version.js";
import { SESSION_COOKIE_NAME, setSessionCookie } from "./session-cookie.js";

/** Sessões com mais de 4 h (metade da validade) recebem um cookie novo. */
const RENEW_AFTER_SECONDS = 4 * 60 * 60;

const AUTHENTICATED_USER_KEY = "authenticatedUser";

export function createRequireAuth(
  store: CodeLabStore,
  tokenService: TokenService,
  options: { production?: boolean; now?: () => number } = {}
) {
  const now = options.now ?? (() => Date.now());
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const authorization = request.header("Authorization");
      const match = authorization?.match(/^Bearer\s+(.+)$/i);
      const cookieToken = request.cookies?.[SESSION_COOKIE_NAME];
      const token = match?.[1] ?? cookieToken;
      if (typeof token !== "string" || !token) {
        throw new DomainError("Faça login para continuar.", 401);
      }

      const payload = tokenService.verify(token);
      const credentials = payload.passwordVersion ? await store.findUserCredentialsById(payload.userId) : undefined;
      const user = payload.passwordVersion ? credentials && stripCredentials(credentials) : await store.findUserById(payload.userId);
      // Senha trocada depois do login: a sessão antiga deixa de valer.
      if (!user || (credentials && passwordVersion(credentials.passwordHash) !== payload.passwordVersion)) {
        throw new DomainError(
          "Sessão inválida ou expirada. Entre novamente.",
          401
        );
      }

      // Renovação deslizante: quem está usando a plataforma não é deslogado no meio de um desafio.
      if (!match && token === cookieToken && payload.issuedAt && now() / 1000 - payload.issuedAt > RENEW_AFTER_SECONDS) {
        setSessionCookie(response, tokenService.issue(user, { passwordVersion: payload.passwordVersion }), Boolean(options.production));
      }

      response.locals[AUTHENTICATED_USER_KEY] = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(role: UserRole) {
  return (_request: Request, response: Response, next: NextFunction) => {
    try {
      const user = getAuthenticatedUser(response);
      if (user.role !== role) {
        throw new DomainError("Você não possui permissão para esta ação.", 403);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function getAuthenticatedUser(response: Response): User {
  const user = response.locals[AUTHENTICATED_USER_KEY] as User | undefined;
  if (!user) {
    throw new DomainError("Faça login para continuar.", 401);
  }
  return user;
}

function stripCredentials(credentials: User & { passwordHash: string }): User {
  return { id: credentials.id, name: credentials.name, email: credentials.email, role: credentials.role };
}
