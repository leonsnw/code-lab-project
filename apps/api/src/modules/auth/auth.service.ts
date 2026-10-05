import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { User } from "../../domain/types.js";
import type { PasswordHasher, TokenService } from "./auth.contracts.js";
import { passwordVersion } from "./password-version.js";

export const SALT_ROUNDS = 10;
const DUMMY_PASSWORD_HASH =
  "$2b$10$fH3DkQnuSlijgJH9aknS6.aP8l5.uolrmIvkHdjFk.55mx7l9Puri";

export const passwordSchema = z
  .string()
  .min(1, "Senha é obrigatória.")
  .min(6, "A senha deve ter pelo menos 6 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Nome é obrigatório.")
  .max(100, "O nome deve ter no máximo 100 caracteres.")
  .transform((name) => name.replace(/\s+/g, " "));

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório.")
    .max(100, "O nome deve ter no máximo 100 caracteres.")
    .transform((name) => name.replace(/\s+/g, " ")),
  email: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório.")
    .email("E-mail inválido.")
    .max(254, "O e-mail deve ter no máximo 254 caracteres.")
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(1, "Senha é obrigatória.")
    .min(6, "A senha deve ter pelo menos 6 caracteres.")
    .max(72, "A senha deve ter no máximo 72 caracteres.")
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório.")
    .email("E-mail inválido.")
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1, "Senha é obrigatória.").max(72)
});

export interface AuthSession {
  user: User;
  accessToken: string;
}

export class AuthService {
  constructor(
    private readonly store: CodeLabStore,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService
  ) {}

  async register(input: unknown): Promise<AuthSession> {
    const data = parseOrThrow(registerSchema, input);
    const existingUser = await this.store.findUserCredentialsByEmail(data.email);

    if (existingUser) {
      throw new DomainError("E-mail já cadastrado.", 409);
    }

    const passwordHash = await this.passwordHasher.hash(
      data.password,
      SALT_ROUNDS
    );
    const user = await this.store.createUser({
      id: randomUUID(),
      name: data.name,
      email: data.email,
      passwordHash,
      role: "student"
    });

    return this.startSession(user, passwordHash);
  }

  async login(input: unknown): Promise<AuthSession> {
    const data = parseOrThrow(loginSchema, input);
    const credentials = await this.store.findUserCredentialsByEmail(data.email);
    const matches = await this.passwordHasher.compare(
      data.password,
      credentials?.passwordHash ?? DUMMY_PASSWORD_HASH
    );
    if (!credentials || !matches) {
      throw invalidCredentialsError();
    }

    const user: User = {
      id: credentials.id,
      name: credentials.name,
      email: credentials.email,
      role: credentials.role
    };
    return this.startSession(user, credentials.passwordHash);
  }

  startSession(user: User, passwordHash: string): AuthSession {
    return {
      user,
      accessToken: this.tokenService.issue(user, { passwordVersion: passwordVersion(passwordHash) })
    };
  }
}

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DomainError(
      result.error.issues[0]?.message ?? "Entrada inválida.",
      400
    );
  }
  return result.data;
}

function invalidCredentialsError(): DomainError {
  return new DomainError("E-mail ou senha inválidos.", 401);
}
