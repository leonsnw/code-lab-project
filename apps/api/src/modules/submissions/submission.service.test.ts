import { describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "../../database/in-memory-store.js";
import { defaultStudentId } from "../../database/seed.js";
import { buildSeedData } from "../../database/seed.js";
import { ScoreService } from "../scoring/score.service.js";
import {
  type EvaluationResult,
  SandboxUnavailableError,
  SubmissionEvaluationService
} from "./submission-evaluation.service.js";
import {
  createSubmissionSchema,
  INTERNAL_EVALUATION_ERROR_MESSAGE,
  SubmissionService
} from "./submission.service.js";

// "Soma de dois números" está no modo função: o aluno implementa somar(a, b).
const validSumSolution = "function somar(a, b) { return a + b; }";

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
  it("registra submissão aceita e atualiza pontuação", async () => {
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

  it("não duplica pontuação para o mesmo desafio já resolvido", async () => {
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

  it("registra submissão rejeitada sem pontuar", async () => {
    const { store, submissionService } = makeService();

    const submission = await submissionService.submit({
      userId: defaultStudentId,
      challengeSlug: "soma-de-dois-numeros",
      language: "javascript",
      sourceCode: "function somar() { return 999; }"
    });

    expect(submission.status).toBe("wrong_answer");
    expect(submission.scoreAwarded).toBe(0);
    await expect(store.getScore(defaultStudentId)).resolves.toMatchObject({
      totalPoints: 0
    });
  });

  it("rejeita solução que apenas imprime a resposta do exemplo publico", async () => {
    const { store, submissionService } = makeService();

    const submission = await submissionService.submit({
      userId: defaultStudentId,
      challengeSlug: "soma-de-dois-numeros",
      language: "javascript",
      sourceCode: "function somar() { return 8; }"
    });

    expect(submission.status).toBe("wrong_answer");
    expect(submission.scoreAwarded).toBe(0);
    await expect(store.getScore(defaultStudentId)).resolves.toMatchObject({
      totalPoints: 0
    });
  });

  it("valida código vazio antes de criar submissão", () => {
    const result = createSubmissionSchema.safeParse({
      language: "javascript",
      sourceCode: "   "
    });

    expect(result.success).toBe(false);
  });

  it("registra a submissão como pending antes de iniciar a avaliação", async () => {
    const store = new InMemoryStore();
    let finishEvaluation: ((value: EvaluationResult) => void) | undefined;
    const evaluator = {
      evaluate: vi.fn(
        () =>
          new Promise<EvaluationResult>((resolve) => {
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

    finishEvaluation?.({
      status: "accepted",
      testResults: [],
      totalTests: 24,
      passedTests: 24,
      errorMessage: null,
      compileWarnings: null
    });
    await resultPromise;
  });

  it("premia apenas uma de duas submissões aceitas simultaneamente", async () => {
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

  it("finaliza como internal_error quando a infraestrutura de avaliação falha", async () => {
    const store = new InMemoryStore();
    const evaluator = {
      evaluate: vi.fn().mockRejectedValue(new Error("falha interna sensivel"))
    } as unknown as SubmissionEvaluationService;
    const service = new SubmissionService(
      store,
      evaluator,
      new ScoreService(store)
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const submission = await service.submit({
        userId: defaultStudentId,
        challengeSlug: "soma-de-dois-numeros",
        language: "javascript",
        sourceCode: validSumSolution
      });

      expect(submission.status).toBe("internal_error");
      expect(submission.scoreAwarded).toBe(0);
      expect(submission.evaluatedAt).toBeInstanceOf(Date);
      expect(submission.testResults).toHaveLength(0);
      expect(JSON.stringify(submission)).not.toContain("falha interna sensivel");
      expect(submission.errorMessage).toBe(INTERNAL_EVALUATION_ERROR_MESSAGE);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("rejeita soluções que apenas imprimem respostas fixas", async () => {
    const { submissionService } = makeService();
    const attempts = [
      ["soma-de-dois-numeros", "function somar() { return 8; }"],
      [
        "par-ou-impar",
        "function parOuImpar(n) { return n === 4 ? 'PAR' : 'IMPAR'; }"
      ],
      [
        "maior-de-tres-numeros",
        "function maiorDeTres(a, b) { return b > a ? b : a; }"
      ]
    ] as const;

    for (const [challengeSlug, sourceCode] of attempts) {
      const submission = await submissionService.submit({
        userId: defaultStudentId,
        challengeSlug,
        language: "javascript",
        sourceCode
      });
      expect(submission.status, challengeSlug).toBe("wrong_answer");
    }
  });

  it("reprova paridade que ignora números negativos", async () => {
    const { submissionService } = makeService();

    const submission = await submissionService.submit({
      userId: defaultStudentId,
      challengeSlug: "par-ou-impar",
      language: "javascript",
      sourceCode:
        "function parOuImpar(n) { return n % 2 === 1 ? 'IMPAR' : 'PAR'; }"
    });

    expect(submission.status).toBe("wrong_answer");
  });

  it("executa apenas casos publicos no modo Executar, sem gravar submissão", async () => {
    const { store, submissionService } = makeService();

    const run = await submissionService.run({
      userId: defaultStudentId,
      challengeSlug: "soma-de-dois-numeros",
      language: "javascript",
      sourceCode: validSumSolution,
      customInput: "[100, 23]"
    });

    expect(run.cases.map((runCase) => runCase.label)).toEqual([
      "Caso 1",
      "Caso 2",
      "Entrada personalizada"
    ]);
    expect(run.cases.slice(0, 2).every((runCase) => runCase.passed)).toBe(true);
    expect(run.cases[2].actualOutput.trim()).toBe("123");
    expect(JSON.stringify(run)).not.toContain("[-2,10]");
    expect(await store.listSubmissions(defaultStudentId)).toHaveLength(0);
    await expect(store.getScore(defaultStudentId)).resolves.toMatchObject({
      totalPoints: 0
    });
  });

  it("responde 503 no modo Executar quando o sandbox não existe", async () => {
    const store = new InMemoryStore();
    const evaluator = {
      run: vi.fn().mockRejectedValue(new SandboxUnavailableError("spawn unshare ENOENT"))
    } as unknown as SubmissionEvaluationService;
    const service = new SubmissionService(store, evaluator, new ScoreService(store));

    await expect(
      service.run({
        userId: defaultStudentId,
        challengeSlug: "soma-de-dois-numeros",
        language: "javascript",
        sourceCode: validSumSolution
      })
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it("não avalia nem pontua desafio sem casos de teste", async () => {
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
