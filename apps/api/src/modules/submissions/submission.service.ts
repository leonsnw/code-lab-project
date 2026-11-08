import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Challenge, ChallengeLanguage, Submission, SubmissionLanguage, User } from "../../domain/types.js";
import { ScoreService } from "../scoring/score.service.js";
import {
  SandboxUnavailableError,
  type EvaluationResult,
  type RunCase,
  type RunResult,
  type SubmissionEvaluator
} from "./submission-evaluation.service.js";

export const createSubmissionSchema = z.object({
  language: z.enum(["javascript", "c", "python"]),
  sourceCode: z
    .string()
    .trim()
    .min(1, "O código da solução é obrigatório.")
    .max(20000, "O código deve ter no máximo 20000 caracteres.")
});

export const runSolutionSchema = createSubmissionSchema.extend({
  customInput: z
    .string()
    .max(10000, "A entrada personalizada deve ter no máximo 10000 caracteres.")
    .optional()
});

export const INTERNAL_EVALUATION_ERROR_MESSAGE =
  "O ambiente de avaliação falhou antes de julgar o código. Isso não é um erro da sua solução; tente enviar novamente em instantes.";

const SANDBOX_UNAVAILABLE_MESSAGE =
  "O ambiente de avaliação está indisponível neste servidor. A API precisa rodar em Linux com `unshare` (JavaScript) e `bwrap` + `gcc` + `python3` (C e Python).";

export const LANGUAGE_LABELS: Record<SubmissionLanguage, string> = {
  javascript: "JavaScript",
  c: "C",
  python: "Python"
};

/** Opções do juiz derivadas do desafio e da linguagem escolhida. */
function judgeOptions(challenge: Challenge, language: ChallengeLanguage) {
  return {
    language: language.language,
    sourceRules: language.sourceRules,
    mode: challenge.mode,
    functionSpec: challenge.functionSpec,
    checker: challenge.checker,
    timeLimitMs: challenge.timeLimitMs,
    memoryLimitMb: challenge.memoryLimitMb
  };
}

export class SubmissionService {
  /** Chamado após cada avaliação (métricas); falhas aqui nunca afetam a submissão. */
  onEvaluated?: (submission: Submission, durationMs: number) => void;

  constructor(
    private readonly store: CodeLabStore,
    private readonly evaluator: SubmissionEvaluator,
    private readonly scoreService: ScoreService
  ) {}

  async submit(input: {
    challengeSlug: string;
    userId: string;
    language: SubmissionLanguage;
    sourceCode: string;
  }): Promise<Submission> {
    const user = await this.ensureUser(input.userId);
    const challenge = await this.findEvaluableChallenge(input.challengeSlug, user.role === "admin");
    const language = ensureLanguage(challenge, input.language);
    const unlock = await this.store.getChallengeUnlock(input.userId, challenge.id);

    const submission: Submission = {
      id: randomUUID(),
      userId: input.userId,
      challengeId: challenge.id,
      language: input.language,
      sourceCode: input.sourceCode,
      status: "pending",
      scoreAwarded: 0,
      submittedAt: new Date(),
      evaluatedAt: null,
      totalTests: challenge.testCases.length,
      passedTests: 0,
      errorMessage: null,
      compileWarnings: null,
      testResults: []
    };

    await this.store.addSubmission(submission);
    const startedAt = Date.now();
    const finish = (completed: Submission) => {
      try {
        this.onEvaluated?.(completed, Date.now() - startedAt);
      } catch {
        // Métricas são acessórias.
      }
      return completed;
    };
    let evaluation: EvaluationResult | undefined;
    try {
      evaluation = await this.evaluator.evaluate({
        ...judgeOptions(challenge, language),
        sourceCode: input.sourceCode,
        testCases: challenge.testCases
      });
    } catch (error) {
      console.error(error);
    }

    if (!evaluation) {
      // Infrastructure failures are recorded as internal_error so they are
      // never mistaken for a runtime error in the student's code.
      return finish(await this.scoreService.completeSubmission({
        submissionId: submission.id,
        status: "internal_error",
        evaluatedAt: new Date(),
        testResults: [],
        totalTests: challenge.testCases.length,
        passedTests: 0,
        errorMessage: INTERNAL_EVALUATION_ERROR_MESSAGE,
        compileWarnings: null,
        challengePoints: challenge.points,
        pointsForfeited: false
      }));
    }

    return finish(await this.scoreService.completeSubmission({
      submissionId: submission.id,
      status: evaluation.status,
      evaluatedAt: new Date(),
      testResults: evaluation.testResults,
      totalTests: evaluation.totalTests,
      passedTests: evaluation.passedTests,
      errorMessage: evaluation.errorMessage,
      compileWarnings: evaluation.compileWarnings,
      challengePoints: challenge.points,
      // Quem revelou a solução comentada pode resolver, mas não pontua.
      pointsForfeited: unlock?.solutionRevealed ?? false
    }));
  }

  /**
   * Equivalent to LeetCode's "Run": executes only the public cases (and an
   * optional custom input) without recording a submission or awarding points.
   */
  async run(input: {
    challengeSlug: string;
    userId: string;
    language: SubmissionLanguage;
    sourceCode: string;
    customInput?: string;
  }): Promise<RunResult> {
    const user = await this.ensureUser(input.userId);
    const challenge = await this.findEvaluableChallenge(input.challengeSlug, user.role === "admin");
    const language = ensureLanguage(challenge, input.language);

    const cases: RunCase[] = challenge.testCases
      .filter((testCase) => testCase.isPublic)
      .map((testCase, index) => ({
        label: `Caso ${index + 1}`,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput
      }));
    if (input.customInput !== undefined && input.customInput.trim() !== "") {
      cases.push({ label: "Entrada personalizada", input: input.customInput });
    }

    try {
      return await this.evaluator.run({
        ...judgeOptions(challenge, language),
        sourceCode: input.sourceCode,
        cases
      });
    } catch (error) {
      if (error instanceof SandboxUnavailableError) {
        throw new DomainError(SANDBOX_UNAVAILABLE_MESSAGE, 503);
      }
      console.error(error);
      throw new DomainError(INTERNAL_EVALUATION_ERROR_MESSAGE, 500);
    }
  }

  private async ensureUser(userId: string): Promise<User> {
    const user = await this.store.findUserById(userId);
    if (!user) {
      throw new DomainError("Usuário não encontrado.", 404);
    }
    return user;
  }

  /** Rascunhos só podem ser testados por administradores (pré-visualização). */
  private async findEvaluableChallenge(slug: string, allowDrafts = false): Promise<Challenge> {
    const challenge = await this.store.findChallengeBySlug(slug);
    if (!challenge || !challenge.isActive || (challenge.isPublished === false && !allowDrafts)) {
      throw new DomainError("Desafio não encontrado.", 404);
    }
    if (challenge.testCases.length === 0) {
      throw new DomainError("Desafio sem casos de teste configurados.", 409);
    }
    return challenge;
  }
}

function ensureLanguage(challenge: Challenge, language: SubmissionLanguage): ChallengeLanguage {
  const found = challenge.languages.find((entry) => entry.language === language);
  if (!found) {
    const accepted = challenge.languages.map((entry) => LANGUAGE_LABELS[entry.language]).join(", ");
    throw new DomainError(`Este desafio aceita soluções em ${accepted}.`, 400);
  }
  return found;
}
