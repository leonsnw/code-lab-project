import { describe, expect, it } from "vitest";
import type { Submission } from "../../domain/types.js";
import { presentSubmission } from "./submission.presenter.js";

describe("presentSubmission", () => {
  it("exibe detalhes publicos e remove completamente os casos privados", () => {
    const submission: Submission = {
      id: "submission-1",
      userId: "user-1",
      challengeId: "challenge-1",
      language: "javascript",
      sourceCode: "console.log('resposta');",
      status: "wrong_answer",
      scoreAwarded: 0,
      submittedAt: new Date("2026-08-04T12:00:00.000Z"),
      evaluatedAt: new Date("2026-08-04T12:00:01.000Z"),
      testResults: [
        {
          testCaseId: "public-id",
          executionStatus: "completed",
          isPublic: true,
          passed: true,
          input: "entrada-publica",
          expectedOutput: "saida-publica",
          actualOutput: "saida-publica",
          durationMs: 10
        },
        {
          testCaseId: "private-secret-id",
          executionStatus: "completed",
          isPublic: false,
          passed: false,
          input: "entrada-privada-secreta",
          expectedOutput: "saida-privada-secreta",
          actualOutput: "resposta-privada",
          error: "erro-privado",
          durationMs: 12
        }
      ]
    };

    const presented = presentSubmission(submission);
    const serialized = JSON.stringify(presented);

    expect(serialized).toContain("entrada-publica");
    expect(serialized).not.toContain("private-secret-id");
    expect(serialized).not.toContain("entrada-privada-secreta");
    expect(serialized).not.toContain("saida-privada-secreta");
    expect(serialized).not.toContain("resposta-privada");
    expect(serialized).not.toContain("erro-privado");
    expect(presented.testResults).toHaveLength(1);
    expect(presented.feedback).toEqual({
      message: "Resposta incorreta. Um ou mais casos ocultos falharam; as entradas e saidas privadas nao sao exibidas.",
      publicTestsPassed: 1,
      publicTestsTotal: 1,
      hiddenTestsPresent: true,
      hiddenTestsFailed: true
    });
  });
});
