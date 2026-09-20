import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { User } from "../../domain/types.js";
import type { PasswordHasher, TokenService } from "./auth.contracts.js";

const SALT_ROUNDS = 10;
const DUMMY_PASSWORD_HASH =
  "$2b$10$fH3DkQnuSlijgJH9aknS6.aP8l5.uolrmIvkHdjFk.55mx7l9Puri";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome e obrigatorio.")
    .max(100, "O nome deve ter no maximo 100 caracteres.")
    .transform((name) => name.replace(/\s+/g, " ")),
  email: z
    .string()
    .trim()
    .min(1, "E-mail e obrigatorio.")
    .email("E-mail invalido.")
    .max(254, "O e-mail deve ter no maximo 254 caracteres.")
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(1, "Senha e obrigatoria.")
    .min(6, "A senha deve ter pelo menos 6 caracteres.")
    .max(72, "A senha deve ter no maximo 72 caracteres.")
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-mail e obrigatorio.")
    .email("E-mail invalido.")
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1, "Senha e obrigatoria.").max(72)
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
      throw new DomainError("E-mail ja cadastrado.", 409);
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

    return this.startSession(user);
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
    return this.startSession(user);
  }

  private startSession(user: User): AuthSession {
    return {
      user,
      accessToken: this.tokenService.issue(user)
    };
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new DomainError(
      result.error.issues[0]?.message ?? "Entrada invalida.",
      400
    );
  }
  return result.data;
}

function invalidCredentialsError(): DomainError {
  return new DomainError("E-mail ou senha invalidos.", 401);
}
