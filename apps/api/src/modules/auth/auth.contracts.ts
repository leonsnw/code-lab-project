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
  /** Versão de sessão do usuário no momento do login; o logout a incrementa. Ausente conta como 0. */
  sessionVersion?: number;
}

export interface TokenIssueOptions {
  passwordVersion?: string;
  sessionVersion?: number;
}

export interface TokenService {
  issue(user: User, options?: TokenIssueOptions): string;
  verify(token: string): AuthTokenPayload;
}
