import jwt, { type JwtPayload } from "jsonwebtoken";
import { DomainError } from "../../common/domain-error.js";
import type { User } from "../../domain/types.js";
import type { AuthTokenPayload, TokenService } from "./auth.contracts.js";

const TOKEN_ISSUER = "codelab-api";
const TOKEN_AUDIENCE = "codelab-web";

export class JwtTokenService implements TokenService {
  constructor(private readonly secret: string) {
    if (secret.length < 32) {
      throw new Error("JWT_SECRET deve possuir pelo menos 32 caracteres.");
    }
  }

  issue(user: User): string {
    return jwt.sign({ type: "access" }, this.secret, {
      subject: user.id,
      expiresIn: "8h",
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE
    });
  }

  verify(token: string): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, this.secret, {
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE
      }) as JwtPayload;

      if (payload.type !== "access" || typeof payload.sub !== "string") {
        throw new Error("Token sem identidade valida.");
      }

      return { userId: payload.sub };
    } catch {
      throw new DomainError(
        "Sessao invalida ou expirada. Entre novamente.",
        401
      );
    }
  }
}
