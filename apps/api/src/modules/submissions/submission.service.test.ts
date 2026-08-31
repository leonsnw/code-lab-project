import { describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "../../database/in-memory-store.js";
import { defaultStudentId } from "../../database/seed.js";
import { buildSeedData } from "../../database/seed.js";
import { ScoreService } from "../scoring/score.service.js";
import { SubmissionEvaluationService } from "./submission-evaluation.service.js";
import {
  createSubmissionSchema,
  SubmissionService
} from "./submission.service.js";

const validSumSolution = `
const fs = require("fs");
const [a, b] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
console.log(a + b);
`;

function makeService() {
  const store = new InMemoryStore();
  const scoreService = new ScoreService(store);
  const evaluator = new SubmissionEvaluationService();
  const submissionService = new SubmissionService(
    store,
    evaluator,
    scoreService
  );

  return { store, submissionService };
}

describe("SubmissionService", () => {
  it("registra submissao aceita e atualiza pontuacao", async () => {
    const { store, submissionService } = makeService();

    const submission = await submissionService.submit({
      userId: defaultStudentId,
      challengeSlug: "soma-de-dois-numeros",
      language: "javascript",
      sourceCode: validSumSolution
    });

    expect(submission.status).toBe("accepted");
    expect(submission.scoreAwarded).toBe(100);
    expect(submission.submittedAt).toBeInstanceOf(Date);
    expect(submission.evaluatedAt).toBeInstanceOf(Date);
    await expect(store.getScore(defaultStudentId)).resolves.toMatchObject({
      totalPoints: 100
    });
  });

  it("nao duplica pontuacao para o mesmo desafio ja resolvido", async () => {
    const { store, submissionService } = makeService();

    await submissionService.submit({
      userId: defaultStudentId,
      challengeSlug: "soma-de-dois-numeros",
      language: "javascript",
      sourceCode: validSumSolution
    });

    const secondSubmission = await submissionService.submit({
      userId: defaultStudentId,
      challengeSlug: "soma-de-dois-numeros",
      language: "javascript",
      sourceCode: validSumSolution
    });

    expect(secondSubmission.status).toBe("accepted");
    expect(secondSubmission.scoreAwarded).toBe(0);
    await expect(store.getScore(defaultStudentId)).resolves.toMatchObject({
      totalPoints: 100
    });
  });

  it("registra submissao rejeitada sem pontuar", async () => {
    const { store, submissionService } = makeService();

    const submission = await submissionService.submit({
      userId: defaultStudentId,
      challengeSlug: "soma-de-dois-numeros",
      language: "javascript",
      sourceCode: "console.log(999);"
    });

    expect(submission.status).toBe("wrong_answer");
    expect(submission.scoreAwarded).toBe(0);
    await expect(store.getScore(defaultStudentId)).resolves.toMatchObject({
      totalPoints: 0
    });
  });

  it("valida codigo vazio antes de criar submissao", () => {
    const result = createSubmissionSchema.safeParse({
      language: "javascript",
      sourceCode: "   "
    });

    expect(result.success).toBe(false);
  });

  it("registra a submissao como pending antes de iniciar a avaliacao", async () => {
    const store = new InMemoryStore();
    let finishEvaluation: ((value: {
      status: "accepted";
      testResults: [];
    }) => void) | undefined;
    const evaluator = {
      evaluate: vi.fn(
        () =>
          new Promise<{ status: "accepted"; testResults: [] }>((resolve) => {
            finishEvaluation = resolve;
          })
      )
    } as unknown as SubmissionEvaluationService;
    const service = new SubmissionService(
      store,
      evaluator,
      new ScoreService(store)
    );

    const resultPromise = service.submit({
      userId: defaultStudentId,
      challengeSlug: "soma-de-dois-numeros",
      language: "javascript",
      sourceCode: validSumSolution
    });
    await vi.waitFor(async () => {
      const submissions = await store.listSubmissions(defaultStudentId);
      expect(submissions).toHaveLength(1);
      expect(submissions[0].status).toBe("pending");
      expect(submissions[0].evaluatedAt).toBeNull();
    });

    finishEvaluation?.({ status: "accepted", testResults: [] });
    await resultPromise;
  });

  it("premia apenas uma de duas submissoes aceitas simultaneamente", async () => {
    const { store, submissionService } = makeService();

    const results = await Promise.all([
      submissionService.submit({
        userId: defaultStudentId,
        challengeSlug: "soma-de-dois-numeros",
        language: "javascript",
        sourceCode: validSumSolution
      }),
      submissionService.submit({
        userId: defaultStudentId,
        challengeSlug: "soma-de-dois-numeros",
        language: "javascript",
        sourceCode: validSumSolution
      })
    ]);

    expect(results.map((submission) => submission.scoreAwarded).sort()).toEqual([
      0,
      100
    ]);
    await expect(store.getScore(defaultStudentId)).resolves.toMatchObject({
      totalPoints: 100
    });
  });

  it("finaliza como runtime_error quando a infraestrutura de avaliacao falha", async () => {
    const store = new InMemoryStore();
    const evaluator = {
      evaluate: vi.fn().mockRejectedValue(new Error("falha interna sensivel"))
    } as unknown as SubmissionEvaluationService;
    const service = new SubmissionService(
      store,
      evaluator,
      new ScoreService(store)
    );

    const submission = await service.submit({
      userId: defaultStudentId,
      challengeSlug: "soma-de-dois-numeros",
      language: "javascript",
      sourceCode: validSumSolution
    });

    expect(submission.status).toBe("runtime_error");
    expect(submission.evaluatedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(submission)).not.toContain("falha interna sensivel");
    expect(submission.testResults[0].error).toBe(
      "Falha interna durante a avaliacao."
    );
  });

  it("nao avalia nem pontua desafio sem casos de teste", async () => {
    const seed = buildSeedData();
    seed.challenges[0] = { ...seed.challenges[0], testCases: [] };
    const store = new InMemoryStore(seed);
    const evaluator = new SubmissionEvaluationService();
    const service = new SubmissionService(
      store,
      evaluator,
      new ScoreService(store)
    );

    await expect(
      service.submit({
        userId: defaultStudentId,
        challengeSlug: "soma-de-dois-numeros",
        language: "javascript",
        sourceCode: validSumSolution
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "Desafio sem casos de teste configurados."
    });
    expect(await store.listSubmissions(defaultStudentId)).toHaveLength(0);
  });
});
