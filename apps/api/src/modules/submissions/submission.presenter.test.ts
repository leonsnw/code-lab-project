import { describe, expect, it } from "vitest";
import type { Submission } from "../../domain/types.js";
import { presentSubmission } from "./submission.presenter.js";

function makeSubmission(overrides: Partial<Submission> = {}): Submission {
  return {
    id: "submission-1",
    userId: "user-1",
    challengeId: "challenge-1",
    language: "javascript",
    sourceCode: "console.log('resposta');",
    status: "wrong_answer",
    scoreAwarded: 0,
    submittedAt: new Date("2026-08-04T12:00:00.000Z"),
    evaluatedAt: new Date("2026-08-04T12:00:01.000Z"),
    totalTests: 4,
    passedTests: 2,
    errorMessage: null,
    compileWarnings: null,
    testResults: [
      {
        testCaseId: "public-id",
        position: 1,
        executionStatus: "completed",
        isPublic: true,
        passed: true,
        input: "entrada-publica",
        expectedOutput: "saida-publica",
        actualOutput: "saida-publica",
        durationMs: 10
      },
      {
        testCaseId: "hidden-passed-id",
        position: 2,
        executionStatus: "completed",
        isPublic: false,
        passed: true,
        input: "entrada-oculta-aprovada",
        expectedOutput: "saida-oculta-aprovada",
        actualOutput: "saida-oculta-aprovada",
        durationMs: 11
      },
      {
        testCaseId: "hidden-failed-id",
        position: 3,
        executionStatus: "completed",
        isPublic: false,
        passed: false,
        input: "entrada-oculta-reprovada",
        expectedOutput: "saida-esperada",
        actualOutput: "saida-recebida",
        stderr: "log-de-depuracao",
        durationMs: 12
      }
    ],
    ...overrides
  };
}

describe("presentSubmission", () => {
  it("mostra o primeiro caso que falhou, mesmo oculto, como no LeetCode", () => {
    const presented = presentSubmission(makeSubmission());

    expect(presented.result).toEqual({
      passedTests: 2,
      totalTests: 4,
      runtimeMs: null,
      compileError: null,
      ruleViolations: [],
      compileWarnings: null,
      failedTest: {
        position: 3,
        isPublic: false,
        executionStatus: "completed",
        input: "entrada-oculta-reprovada",
        expectedOutput: "saida-esperada",
        actualOutput: "saida-recebida",
        stderr: "log-de-depuracao",
        error: null,
        durationMs: 12
      }
    });
    expect(presented.feedback).toEqual({
      title: "Resposta errada",
      message:
        "A saída do seu programa difere da esperada no caso 3 de 4 (oculto). 2/4 casos aprovados antes da falha."
    });
  });

  it("nunca expoe os casos ocultos que passaram nem identificadores internos", () => {
    const serialized = JSON.stringify(presentSubmission(makeSubmission()));

    expect(serialized).not.toContain("entrada-oculta-aprovada");
    expect(serialized).not.toContain("saida-oculta-aprovada");
    expect(serialized).not.toContain("hidden-passed-id");
    expect(serialized).not.toContain("hidden-failed-id");
    expect(serialized).not.toContain("testResults");
  });

  it("informa o tempo de execução quando aceita", () => {
    const presented = presentSubmission(
      makeSubmission({
        status: "accepted",
        totalTests: 2,
        passedTests: 2,
        testResults: makeSubmission().testResults.slice(0, 2)
      })
    );

    expect(presented.result.failedTest).toBeNull();
    expect(presented.result.runtimeMs).toBe(11);
    expect(presented.feedback.title).toBe("Aceito");
  });

  it("entrega a mensagem do erro de sintaxe", () => {
    const presented = presentSubmission(
      makeSubmission({
        status: "compile_error",
        passedTests: 0,
        testResults: [],
        errorMessage: "solucao.js:1\nSyntaxError: Unexpected token"
      })
    );

    expect(presented.result.compileError).toContain("SyntaxError");
    expect(presented.result.failedTest).toBeNull();
    expect(presented.feedback.title).toBe("Erro de compilação");
  });

  it("diferencia falha de infraestrutura de erro do estudante", () => {
    const presented = presentSubmission(
      makeSubmission({
        status: "internal_error",
        passedTests: 0,
        testResults: [],
        errorMessage: "O ambiente de avaliação falhou."
      })
    );

    expect(presented.feedback).toEqual({
      title: "Falha na avaliação",
      message: "O ambiente de avaliação falhou."
    });
    expect(presented.result.compileError).toBeNull();
  });

  it("lista as regras do desafio que o código não atendeu", () => {
    const presented = presentSubmission(
      makeSubmission({
        status: "rule_violation",
        passedTests: 0,
        testResults: [],
        errorMessage: "Use recursão.\nNão use laços."
      })
    );

    expect(presented.result.ruleViolations).toEqual(["Use recursão.", "Não use laços."]);
    expect(presented.feedback.title).toBe("Regra do desafio não atendida");
  });
});
