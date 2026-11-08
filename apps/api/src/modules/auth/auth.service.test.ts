import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "../../database/in-memory-store.js";
import type { PasswordHasher, TokenService } from "./auth.contracts.js";
import { AuthService } from "./auth.service.js";
import { passwordVersion } from "./password-version.js";

function makeSubject() {
  const store = new InMemoryStore({ users: [], challenges: [], scores: [] });
  const passwordHasher: PasswordHasher = {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn().mockResolvedValue(true)
  };
  const tokenService: TokenService = {
    issue: vi.fn().mockReturnValue("signed-token"),
    verify: vi.fn()
  };
  const service = new AuthService(store, passwordHasher, tokenService);

  return { store, passwordHasher, tokenService, service };
}

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("register", () => {
    it("cadastra estudante, normaliza os dados e inicia uma sessão", async () => {
      const { store, passwordHasher, tokenService, service } = makeSubject();

      const result = await service.register({
        name: "  Ana   Maria  Silva  ",
        email: "  ANA@EMAIL.COM  ",
        password: "123456"
      });

      expect(result).toMatchObject({
        accessToken: "signed-token",
        user: {
          name: "Ana Maria Silva",
          email: "ana@email.com",
          role: "student"
        }
      });
      expect(result.user).not.toHaveProperty("passwordHash");
      expect(passwordHasher.hash).toHaveBeenCalledWith("123456", 10);
      expect(tokenService.issue).toHaveBeenCalledWith(result.user, { passwordVersion: passwordVersion("hashed-password") });
      await expect(store.findUserCredentialsByEmail("ana@email.com")).resolves.toMatchObject({
        passwordHash: "hashed-password"
      });
    });

    it.each([
      [{ name: "", email: "ana@email.com", password: "123456" }, "Nome é obrigatório."],
      [{ name: "Ana Silva", email: "email-invalido", password: "123456" }, "E-mail inválido."],
      [{ name: "Ana Silva", email: "ana@email.com", password: "123" }, "A senha deve ter pelo menos 6 caracteres."]
    ])("rejeita cadastro inválido", async (input, message) => {
      const { store, service } = makeSubject();

      await expect(service.register(input)).rejects.toMatchObject({
        message,
        statusCode: 400
      });
      await expect(store.findUserCredentialsByEmail(input.email)).resolves.toBeUndefined();
    });

    it("rejeita e-mail duplicado sem gerar um novo hash", async () => {
      const { passwordHasher, service } = makeSubject();
      const input = {
        name: "Ana Silva",
        email: "ana@email.com",
        password: "123456"
      };

      await service.register(input);
      vi.mocked(passwordHasher.hash).mockClear();

      await expect(service.register(input)).rejects.toMatchObject({
        message: "E-mail já cadastrado.",
        statusCode: 409
      });
      expect(passwordHasher.hash).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("autentica credenciais validas e nunca retorna o hash", async () => {
      const { passwordHasher, tokenService, service } = makeSubject();
      await service.register({
        name: "Ana Silva",
        email: "ana@email.com",
        password: "123456"
      });
      vi.mocked(passwordHasher.hash).mockClear();

      const result = await service.login({
        email: "  ANA@EMAIL.COM ",
        password: "123456"
      });

      expect(passwordHasher.compare).toHaveBeenCalledWith(
        "123456",
        "hashed-password"
      );
      expect(tokenService.issue).toHaveBeenLastCalledWith(result.user, { passwordVersion: passwordVersion("hashed-password") });
      expect(result.user).not.toHaveProperty("passwordHash");
    });

    it("usa a mesma resposta para e-mail inexistente e senha incorreta", async () => {
      const { passwordHasher, service } = makeSubject();

      await expect(
        service.login({ email: "ninguem@email.com", password: "123456" })
      ).rejects.toMatchObject({
        message: "E-mail ou senha inválidos.",
        statusCode: 401
      });

      await service.register({
        name: "Ana Silva",
        email: "ana@email.com",
        password: "123456"
      });
      vi.mocked(passwordHasher.compare).mockResolvedValue(false);

      await expect(
        service.login({ email: "ana@email.com", password: "senha-errada" })
      ).rejects.toMatchObject({
        message: "E-mail ou senha inválidos.",
        statusCode: 401
      });
    });
  });
});
