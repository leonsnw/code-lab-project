import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { AuthTokenKind, User } from "../../domain/types.js";
import type { PasswordHasher } from "../auth/auth.contracts.js";
import { nameSchema, parseOrThrow, passwordSchema, SALT_ROUNDS } from "../auth/auth.service.js";
import type { Mailer } from "../mail/mailer.js";

const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 48 * 60 * 60 * 1000;

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254) });
const tokenSchema = z.object({ token: z.string().min(20, "Link inválido.").max(200) });
const resetSchema = tokenSchema.extend({ password: passwordSchema });
const profileSchema = z.object({ name: nameSchema });
const changePasswordSchema = z.object({ currentPassword: z.string().min(1, "Informe a senha atual.").max(72), newPassword: passwordSchema });
const deleteSchema = z.object({ password: z.string().min(1, "Confirme com a sua senha.").max(72) });

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface AccountServiceOptions {
  /** Endereço público do site, usado nos links enviados por e-mail. */
  appUrl: string;
  now?: () => Date;
}

/**
 * Conta do estudante: recuperação de senha, verificação de e-mail, edição de
 * perfil e os direitos da LGPD (exportar e apagar os próprios dados).
 */
export class AccountService {
  private readonly now: () => Date;

  constructor(
    private readonly store: CodeLabStore,
    private readonly passwordHasher: PasswordHasher,
    private readonly mailer: Mailer,
    private readonly options: AccountServiceOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  private async issueToken(user: User, kind: AuthTokenKind, ttlMs: number): Promise<string> {
    const now = this.now();
    await this.store.invalidateAuthTokens(user.id, kind, now);
    const token = randomBytes(32).toString("base64url");
    await this.store.saveAuthToken({
      id: randomUUID(),
      userId: user.id,
      kind,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + ttlMs),
      usedAt: null,
      createdAt: now
    });
    return token;
  }

  private async consumeToken(kind: AuthTokenKind, token: string) {
    const stored = await this.store.findAuthToken(kind, hashToken(token));
    if (!stored || stored.usedAt || stored.expiresAt.getTime() < this.now().getTime()) {
      throw new DomainError(kind === "password_reset" ? "Link de redefinição inválido ou expirado. Peça um novo." : "Link de verificação inválido ou expirado. Peça um novo.", 400);
    }
    await this.store.markAuthTokenUsed(stored.id, this.now());
    return stored;
  }

  /** Sempre responde igual, exista ou não a conta (não revela e-mails cadastrados). */
  async requestPasswordReset(input: unknown): Promise<void> {
    const { email } = parseOrThrow(emailSchema, input);
    const credentials = await this.store.findUserCredentialsByEmail(email);
    if (!credentials) return;
    const token = await this.issueToken(credentials, "password_reset", RESET_TTL_MS);
    await this.mailer.send({
      to: credentials.email,
      subject: "Redefinir sua senha do CodeLab",
      text: [
        `Olá, ${credentials.name}.`,
        "",
        "Recebemos um pedido para redefinir a senha da sua conta. Use o link abaixo em até 1 hora:",
        `${this.options.appUrl}/#/redefinir-senha?token=${token}`,
        "",
        "Se não foi você, ignore este e-mail: a senha atual continua valendo."
      ].join("\n")
    });
  }

  async resetPassword(input: unknown): Promise<User> {
    const { token, password } = parseOrThrow(resetSchema, input);
    const stored = await this.consumeToken("password_reset", token);
    const passwordHash = await this.passwordHasher.hash(password, SALT_ROUNDS);
    // Mudar o hash invalida as sessões abertas (impressão da senha no JWT).
    const user = await this.store.updateUser(stored.userId, { passwordHash });
    await this.store.invalidateAuthTokens(stored.userId, "password_reset", this.now());
    // Quem redefiniu a senha pelo link provou que recebe e-mails nesse endereço.
    const account = await this.store.getAccountStatus(stored.userId);
    if (!account?.emailVerifiedAt) await this.store.updateUser(stored.userId, { emailVerifiedAt: this.now() });
    return user;
  }

  async sendVerification(user: User): Promise<void> {
    const account = await this.store.getAccountStatus(user.id);
    if (account?.emailVerifiedAt) throw new DomainError("Este e-mail já foi verificado.", 409);
    const token = await this.issueToken(user, "email_verification", VERIFICATION_TTL_MS);
    await this.mailer.send({
      to: user.email,
      subject: "Confirme seu e-mail no CodeLab",
      text: [`Olá, ${user.name}.`, "", "Confirme o seu e-mail para proteger a conta e poder recuperar a senha:", `${this.options.appUrl}/#/verificar-email?token=${token}`, "", "O link vale por 48 horas."].join("\n")
    });
  }

  async verifyEmail(input: unknown): Promise<void> {
    const { token } = parseOrThrow(tokenSchema, input);
    const stored = await this.consumeToken("email_verification", token);
    await this.store.updateUser(stored.userId, { emailVerifiedAt: this.now() });
  }

  async account(userId: string) {
    const status = await this.store.getAccountStatus(userId);
    if (!status) throw new DomainError("Usuário não encontrado.", 404);
    return { emailVerified: Boolean(status.emailVerifiedAt), createdAt: status.createdAt.toISOString() };
  }

  async updateProfile(userId: string, input: unknown): Promise<User> {
    const { name } = parseOrThrow(profileSchema, input);
    return this.store.updateUser(userId, { name });
  }

  /** Troca a senha e devolve o novo hash (a rota emite um cookie novo para esta sessão). */
  async changePassword(userId: string, input: unknown): Promise<{ user: User; passwordHash: string }> {
    const { currentPassword, newPassword } = parseOrThrow(changePasswordSchema, input);
    const credentials = await this.store.findUserCredentialsById(userId);
    if (!credentials || !(await this.passwordHasher.compare(currentPassword, credentials.passwordHash))) {
      throw new DomainError("A senha atual não confere.", 400);
    }
    const passwordHash = await this.passwordHasher.hash(newPassword, SALT_ROUNDS);
    const user = await this.store.updateUser(userId, { passwordHash });
    return { user, passwordHash };
  }

  /** Portabilidade (LGPD, art. 18): tudo o que a plataforma guarda sobre a pessoa. */
  async exportData(userId: string) {
    const [user, account, score, submissions, comments, ratings, lessons, classes] = await Promise.all([
      this.store.findUserById(userId),
      this.store.getAccountStatus(userId),
      this.store.getScore(userId),
      this.store.listSubmissions(userId),
      this.store.listCommentsByUser(userId),
      this.store.listRatingsByUser(userId),
      this.store.listLessonCompletions(userId),
      this.store.listUserClasses(userId)
    ]);
    if (!user) throw new DomainError("Usuário não encontrado.", 404);
    return {
      exportedAt: this.now().toISOString(),
      user,
      account: account ? { emailVerifiedAt: account.emailVerifiedAt?.toISOString() ?? null, createdAt: account.createdAt.toISOString() } : null,
      score: { totalPoints: score.totalPoints, solvedChallengeIds: score.solvedChallengeIds },
      submissions: submissions.map((submission) => ({
        id: submission.id,
        challengeId: submission.challengeId,
        language: submission.language,
        status: submission.status,
        scoreAwarded: submission.scoreAwarded,
        submittedAt: submission.submittedAt.toISOString(),
        sourceCode: submission.sourceCode
      })),
      comments: comments.map((comment) => ({ id: comment.id, challengeId: comment.challengeId, content: comment.content, createdAt: comment.createdAt.toISOString() })),
      ratings: ratings.map((rating) => ({ challengeId: rating.challengeId, value: rating.value, updatedAt: rating.updatedAt.toISOString() })),
      completedLessons: lessons,
      classes: classes.map((classGroup) => ({ id: classGroup.id, name: classGroup.name }))
    };
  }

  /** Eliminação (LGPD, art. 18): apaga a conta e todos os dados ligados a ela. */
  async deleteAccount(userId: string, input: unknown): Promise<void> {
    const { password } = parseOrThrow(deleteSchema, input);
    const credentials = await this.store.findUserCredentialsById(userId);
    if (!credentials || !(await this.passwordHasher.compare(password, credentials.passwordHash))) {
      throw new DomainError("Senha incorreta: a conta não foi apagada.", 400);
    }
    if (credentials.role === "admin") {
      const authored = (await this.store.listAllChallenges()).some((challenge) => challenge.createdBy === userId);
      if (authored) {
        throw new DomainError("Administradores com desafios cadastrados não podem apagar a conta por aqui: transfira os desafios antes.", 409);
      }
    }
    await this.store.deleteUser(userId);
  }
}
