import type { User } from "../../domain/types.js";

export interface PasswordHasher {
  hash(password: string, saltRounds: number): Promise<string>;
  compare(password: string, passwordHash: string): Promise<boolean>;
}

export interface AuthTokenPayload {
  userId: string;
  /** Emissão do token (segundos desde a época), para renovar a sessão. */
  issuedAt?: number;
  /** Impressão da senha no momento do login (veja password-version.ts). */
  passwordVersion?: string;
}

export interface TokenService {
  issue(user: User, options?: { passwordVersion?: string }): string;
  verify(token: string): AuthTokenPayload;
}
