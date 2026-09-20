import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Submission } from "../../domain/types.js";
import { ScoreService } from "../scoring/score.service.js";
import {
  type EvaluationResult,
  type SubmissionEvaluator
} from "./submission-evaluation.service.js";

export const createSubmissionSchema = z.object({
  language: z.literal("javascript"),
  sourceCode: z.string().trim().min(1, "O codigo da solucao e obrigatorio.").max(10000)
});

export class SubmissionService {
  constructor(
    private readonly store: CodeLabStore,
    private readonly evaluator: SubmissionEvaluator,
    private readonly scoreService: ScoreService
  ) {}

  async submit(input: {
    challengeSlug: string;
    userId: string;
    language: "javascript";
    sourceCode: string;
  }): Promise<Submission> {
    const user = await this.store.findUserById(input.userId);
    if (!user) {
      throw new DomainError("Usuario nao encontrado.", 404);
    }

    const challenge = await this.store.findChallengeBySlug(input.challengeSlug);
    if (!challenge || !challenge.isActive) {
      throw new DomainError("Desafio nao encontrado.", 404);
    }
    if (challenge.testCases.length === 0) {
      throw new DomainError("Desafio sem casos de teste configurados.", 409);
    }

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
      testResults: []
    };

    await this.store.addSubmission(submission);
    let evaluation: EvaluationResult;
    try {
      evaluation = await this.evaluator.evaluate({
        language: input.language,
        sourceCode: input.sourceCode,
        testCases: challenge.testCases
      });
    } catch {
      evaluation = {
        status: "runtime_error",
        testResults: challenge.testCases.map((testCase) => ({
          testCaseId: testCase.id,
          executionStatus: "runtime_error",
          isPublic: testCase.isPublic,
          passed: false,
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          actualOutput: "",
          error: "Falha interna durante a avaliacao.",
          durationMs: 0
        }))
      };
    }

    return this.scoreService.completeSubmission({
      submissionId: submission.id,
      status: evaluation.status,
      evaluatedAt: new Date(),
      testResults: evaluation.testResults,
      challengePoints: challenge.points
    });
  }
}
