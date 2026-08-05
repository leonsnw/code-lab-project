import type { User } from "../../domain/types.js";

export interface PasswordHasher {
  hash(password: string, saltRounds: number): Promise<string>;
  compare(password: string, passwordHash: string): Promise<boolean>;
}

export interface AuthTokenPayload {
  userId: string;
}

export interface TokenService {
  issue(user: User): string;
  verify(token: string): AuthTokenPayload;
}
