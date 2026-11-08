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
  it("aceita a submissão quando todos os casos de teste passam", async () => {
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

  it("marca como runtime_error quando o código quebra durante a execução", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.evaluate({
      language: "javascript",
      testCases,
      sourceCode: "throw new Error('falha simulada');"
    });

    expect(result.status).toBe("runtime_error");
  });

  it("marca como timeout quando o código excede o tempo limite", async () => {
    const service = new SubmissionEvaluationService(100);

    const result = await service.evaluate({
      language: "javascript",
      testCases: [testCases[0]],
      sourceCode: "while (true) {}"
    });

    expect(result.status).toBe("timeout");
  });

  it("não entrega variáveis de ambiente da API ao código submetido", async () => {
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

  it("bloqueia leitura de arquivos fora do diretorio da submissão", async () => {
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

  it("bloqueia a criação de outros processos pelo código submetido", async () => {
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

  it("bloqueia conexoes de rede iniciadas pelo código submetido", async () => {
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

  it("interrompe a execução quando a saída excede o limite", async () => {
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
    expect(result.testResults[0].error).toBe("Limite de saída excedido (512 bytes).");
    expect(result.testResults[0].actualOutput.length).toBeLessThanOrEqual(512);
  });
  it("executa casos publicos primeiro e para no primeiro caso que falha", async () => {
    const service = new SubmissionEvaluationService();
    const suite: TestCase[] = [
      { ...testCases[1], id: "oculto-1" },
      { ...testCases[0], id: "publico-1" },
      { ...testCases[1], id: "oculto-2", input: "0 0", expectedOutput: "0" },
      { ...testCases[1], id: "oculto-3", input: "1 1", expectedOutput: "2" }
    ];

    const result = await service.evaluate({
      language: "javascript",
      testCases: suite,
      sourceCode: "console.log(8);"
    });

    expect(result.status).toBe("wrong_answer");
    expect(result.totalTests).toBe(4);
    expect(result.passedTests).toBe(2);
    expect(result.testResults.map((test) => test.testCaseId)).toEqual([
      "publico-1",
      "oculto-1",
      "oculto-2"
    ]);
    expect(result.testResults.map((test) => test.position)).toEqual([1, 2, 3]);
  });

  it("não executa casos posteriores, impedindo sondar os ocultos por timeout", async () => {
    const service = new SubmissionEvaluationService(300);
    const suite: TestCase[] = [
      testCases[0],
      { ...testCases[1], id: "oculto-1", input: "0 0", expectedOutput: "0" },
      { ...testCases[1], id: "oculto-2", input: "-2 10", expectedOutput: "8" }
    ];

    const result = await service.evaluate({
      language: "javascript",
      testCases: suite,
      sourceCode: `
const input = require("fs").readFileSync(0, "utf8").trim();
if (input === "-2 10") while (true) {}
console.log(8);
`
    });

    expect(result.status).toBe("wrong_answer");
    expect(result.testResults).toHaveLength(2);
  });

  it("reporta erro de sintaxe com linha sem executar nenhum caso", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.evaluate({
      language: "javascript",
      testCases,
      sourceCode: "const valor = 1;\nconsole.log(valor +);"
    });

    expect(result.status).toBe("compile_error");
    expect(result.testResults).toHaveLength(0);
    expect(result.totalTests).toBe(2);
    expect(result.errorMessage).toContain("solucao.js:2");
    expect(result.errorMessage).toContain("SyntaxError");
  });

  it("limpa o erro de execucao, apontando a linha em solucao.js", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.evaluate({
      language: "javascript",
      testCases,
      sourceCode: "const lista = null;\nconsole.log(lista.length);"
    });

    const error = result.testResults[0].error ?? "";
    expect(result.status).toBe("runtime_error");
    expect(error).toContain("TypeError");
    expect(error).toContain("solucao.js:2");
    expect(error).not.toContain("/tmp");
    expect(error).not.toContain("node:internal");
    expect(error).not.toMatch(/Node\.js v\d/);
  });

  it("identifica estouro de memória", async () => {
    const service = new SubmissionEvaluationService({ timeoutMs: 5000 });

    const result = await service.evaluate({
      language: "javascript",
      testCases: [testCases[0]],
      sourceCode: "const itens = []; while (true) itens.push(new Array(1e6).fill(1));"
    });

    expect(result.status).toBe("runtime_error");
    expect(result.testResults[0].error).toBe("Limite de memória excedido (64 MB).");
  });

  it("mantem stderr separado da saída avaliada, com limite proprio", async () => {
    const service = new SubmissionEvaluationService({
      timeoutMs: 1500,
      maxOutputBytes: 512,
      memoryLimitMb: 64
    });

    const result = await service.evaluate({
      language: "javascript",
      testCases: [testCases[0]],
      sourceCode: `
for (let i = 0; i < 100; i += 1) console.error("depurando " + i);
console.log(8);
`
    });

    expect(result.status).toBe("accepted");
    expect(result.testResults[0].stderr).toContain("depurando 0");
    expect(result.testResults[0].stderr).toContain("[stderr truncado]");
  });

  it("executa casos publicos e entrada personalizada sem julgar os ocultos", async () => {
    const service = new SubmissionEvaluationService();

    const result = await service.run({
      language: "javascript",
      sourceCode: `
const [a, b] = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
console.log(a + b);
`,
      cases: [
        { label: "Caso 1", input: "3 5", expectedOutput: "8" },
        { label: "Entrada personalizada", input: "40 2" }
      ]
    });

    expect(result.compileError).toBeNull();
    expect(result.cases[0]).toMatchObject({ passed: true, actualOutput: "8\n" });
    expect(result.cases[1]).toMatchObject({
      passed: null,
      expectedOutput: null,
      actualOutput: "42\n"
    });
  });
});
