import type { NextFunction, Request, Response } from "express";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { User, UserRole } from "../../domain/types.js";
import type { TokenService } from "./auth.contracts.js";
import { SESSION_COOKIE_NAME } from "./session-cookie.js";

const AUTHENTICATED_USER_KEY = "authenticatedUser";

export function createRequireAuth(
  store: CodeLabStore,
  tokenService: TokenService
) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const authorization = request.header("Authorization");
      const match = authorization?.match(/^Bearer\s+(.+)$/i);
      const token = match?.[1] ?? request.cookies?.[SESSION_COOKIE_NAME];
      if (typeof token !== "string" || !token) {
        throw new DomainError("Faca login para continuar.", 401);
      }

      const payload = tokenService.verify(token);
      const user = await store.findUserById(payload.userId);
      if (!user) {
        throw new DomainError(
          "Sessao invalida ou expirada. Entre novamente.",
          401
        );
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
        throw new DomainError("Voce nao possui permissao para esta acao.", 403);
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
    throw new DomainError("Faca login para continuar.", 401);
  }
  return user;
}
