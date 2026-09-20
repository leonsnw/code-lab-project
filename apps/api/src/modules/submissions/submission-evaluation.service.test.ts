import { describe, expect, it } from "vitest";
import type { TestCase } from "../../domain/types.js";
import { SubmissionEvaluationService } from "./submission-evaluation.service.js";

const testCases: TestCase[] = [
  {
    id: "tc-1",
    challengeId: "challenge-soma",
    input: "3 5",
    expectedOutput: "8",
    isPublic: true,
    weight: 1
  },
  {
    id: "tc-2",
    challengeId: "challenge-soma",
    input: "-2 10",
    expectedOutput: "8",
    isPublic: false,
    weight: 1
  }
];

describe("SubmissionEvaluationService", () => {
  it("aceita a submissao quando todos os casos de teste passam", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.evaluate({
      language: "javascript",
      testCases,
      sourceCode: `
const fs = require("fs");
const [a, b] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
console.log(a + b);
`
    });

    expect(result.status).toBe("accepted");
    expect(result.testResults.every((test) => test.passed)).toBe(true);
  });

  it("marca como wrong_answer quando algum caso de teste falha", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.evaluate({
      language: "javascript",
      testCases,
      sourceCode: "console.log(0);"
    });

    expect(result.status).toBe("wrong_answer");
    expect(result.testResults.some((test) => !test.passed)).toBe(true);
  });

  it("marca como runtime_error quando o codigo quebra durante a execucao", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.evaluate({
      language: "javascript",
      testCases,
      sourceCode: "throw new Error('falha simulada');"
    });

    expect(result.status).toBe("runtime_error");
  });

  it("marca como timeout quando o codigo excede o tempo limite", async () => {
    const service = new SubmissionEvaluationService(100);

    const result = await service.evaluate({
      language: "javascript",
      testCases: [testCases[0]],
      sourceCode: "while (true) {}"
    });

    expect(result.status).toBe("timeout");
  });

  it("nao entrega variaveis de ambiente da API ao codigo submetido", async () => {
    process.env.CODELAB_TEST_SECRET = "segredo-que-nao-pode-vazar";
    const service = new SubmissionEvaluationService();

    try {
      const result = await service.evaluate({
        language: "javascript",
        testCases: [
          {
            ...testCases[0],
            expectedOutput: "ambiente-isolado"
          }
        ],
        sourceCode:
          'console.log(process.env.CODELAB_TEST_SECRET ?? "ambiente-isolado");'
      });

      expect(result.status).toBe("accepted");
      expect(JSON.stringify(result)).not.toContain("segredo-que-nao-pode-vazar");
    } finally {
      delete process.env.CODELAB_TEST_SECRET;
    }
  });

  it("bloqueia leitura de arquivos fora do diretorio da submissao", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.evaluate({
      language: "javascript",
      testCases: [{ ...testCases[0], expectedOutput: "ACESSO_NEGADO" }],
      sourceCode: `
try {
  require("fs").readFileSync("/etc/passwd", "utf8");
  console.log("ACESSO_PERMITIDO");
} catch {
  console.log("ACESSO_NEGADO");
}
`
    });

    expect(result.status).toBe("accepted");
  });

  it("bloqueia a criacao de outros processos pelo codigo submetido", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.evaluate({
      language: "javascript",
      testCases: [{ ...testCases[0], expectedOutput: "ACESSO_NEGADO" }],
      sourceCode: `
try {
  require("child_process").spawnSync(process.execPath, ["-e", "console.log(1)"]);
  console.log("ACESSO_PERMITIDO");
} catch {
  console.log("ACESSO_NEGADO");
}
`
    });

    expect(result.status).toBe("accepted");
  });

  it("bloqueia conexoes de rede iniciadas pelo codigo submetido", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.evaluate({
      language: "javascript",
      testCases: [{ ...testCases[0], expectedOutput: "ENETUNREACH" }],
      sourceCode: `
try {
  const socket = require("net").connect(80, "127.0.0.1");
  socket.on("error", (error) => console.log(error.code));
} catch (error) {
  console.log(error.code);
}
`
    });

    expect(result.status).toBe("accepted");
  });

  it("interrompe a execucao quando a saida excede o limite", async () => {
    const service = new SubmissionEvaluationService({
      timeoutMs: 1500,
      maxOutputBytes: 512,
      memoryLimitMb: 64
    });

    const result = await service.evaluate({
      language: "javascript",
      testCases: [testCases[0]],
      sourceCode: 'console.log("x".repeat(10000));'
    });

    expect(result.status).toBe("runtime_error");
    expect(result.testResults[0].error).toBe("Limite de saida excedido.");
    expect(result.testResults[0].actualOutput.length).toBeLessThanOrEqual(512);
  });
});
