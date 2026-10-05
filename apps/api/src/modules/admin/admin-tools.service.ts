import { runInNewContext } from "node:vm";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { SubmissionLanguage, TestCase } from "../../domain/types.js";
import { createRandom } from "../submissions/generated-input.js";
import type { SubmissionEvaluator } from "../submissions/submission-evaluation.service.js";
import { challengePayloadSchema, resolveLanguages } from "./admin-challenge.service.js";

const languageSchema = z.enum(["javascript", "c", "python"]);
const solutionSchema = z.object({
  language: languageSchema,
  sourceCode: z.string().min(1, "Envie o código da solução.").max(20000),
  /** Veredito esperado: "accepted" para a solução de referência, outro para uma burla. */
  expected: z.enum(["accepted", "wrong_answer", "runtime_error", "timeout", "compile_error", "rule_violation"]).default("accepted")
});

const validateSchema = z.object({
  challenge: z.unknown(),
  solutions: z.array(solutionSchema).min(1, "Envie ao menos uma solução de referência.").max(6)
});

const GENERATOR_TIMEOUT_MS = 1000;
const MAX_GENERATED_CASES = 40;

const generateSchema = z
  .object({
    mode: z.enum(["stdio", "function"]),
    functionSpec: z.unknown().optional(),
    language: languageSchema,
    referenceSolution: z.string().min(1, "Envie a solução de referência.").max(20000),
    /** Entradas prontas (uma por caso) ou um gerador em JavaScript. */
    inputs: z.array(z.string().max(200000)).max(MAX_GENERATED_CASES).optional(),
    generator: z.string().max(10000).optional(),
    count: z.number().int().min(1).max(MAX_GENERATED_CASES).default(10),
    seed: z.number().int().default(1)
  })
  .refine((payload) => payload.inputs?.length || payload.generator, { message: "Informe as entradas ou um gerador." });

/**
 * Executa o gerador do professor numa VM isolada, sem require nem acesso à
 * rede. Contrato: `function gerar(indice, aleatorio)` devolve a entrada do caso
 * (texto no modo stdio, array de argumentos no modo função). `aleatorio()` é
 * determinístico a partir da semente.
 */
export function runCaseGenerator(code: string, count: number, seed: number, mode: "stdio" | "function"): string[] {
  const random = createRandom(seed);
  const inputs: unknown[] = [];
  const context = { __count: count, __random: () => random(), __inputs: inputs };
  try {
    runInNewContext(
      `${code}\n;if (typeof gerar !== "function") throw new Error("Defina a função gerar(indice, aleatorio).");\nfor (let i = 0; i < __count; i++) __inputs.push(gerar(i, __random));`,
      context,
      { timeout: GENERATOR_TIMEOUT_MS, filename: "gerador.js" }
    );
  } catch (error) {
    throw new DomainError(`O gerador falhou: ${error instanceof Error ? error.message : String(error)}`, 400);
  }
  return inputs.map((value, index) => {
    if (mode === "function") {
      if (!Array.isArray(value)) throw new DomainError(`O gerador devolveu algo que não é um array de argumentos no caso ${index + 1}.`, 400);
      return JSON.stringify(value);
    }
    if (typeof value !== "string") throw new DomainError(`No modo stdio, o gerador precisa devolver texto (caso ${index + 1}).`, 400);
    return value;
  });
}

/** Ferramentas do professor: validar soluções de referência e gerar casos com gabarito. */
export class AdminToolsService {
  constructor(private readonly evaluator: SubmissionEvaluator) {}

  /** Roda cada solução contra os casos do formulário (antes mesmo de salvar o desafio). */
  async validate(input: unknown) {
    const { challenge: rawChallenge, solutions } = validateSchema.parse(input);
    const payload = challengePayloadSchema.parse(rawChallenge);
    const languages = resolveLanguages(payload);
    const testCases: TestCase[] = payload.testCases.map((testCase, index) => ({
      id: `rascunho-${index + 1}`,
      challengeId: "rascunho",
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      isPublic: testCase.isPublic,
      weight: 1
    }));
    const results = [];
    for (const solution of solutions) {
      const entry = languages.find((item) => item.language === solution.language);
      if (!entry) {
        results.push({ language: solution.language, expected: solution.expected, status: "rule_violation", ok: false, message: "O desafio não aceita esta linguagem." });
        continue;
      }
      const result = await this.evaluator.evaluate({
        language: solution.language,
        sourceCode: solution.sourceCode,
        sourceRules: entry.sourceRules,
        mode: payload.mode,
        functionSpec: payload.functionSpec ?? null,
        checker: payload.checker,
        timeLimitMs: payload.timeLimitMs,
        memoryLimitMb: payload.memoryLimitMb,
        testCases
      });
      const failed = result.testResults.find((test) => !test.passed);
      results.push({
        language: solution.language,
        expected: solution.expected,
        status: result.status,
        ok: result.status === solution.expected,
        passedTests: result.passedTests,
        totalTests: result.totalTests,
        slowestMs: result.testResults.length ? Math.max(...result.testResults.map((test) => test.durationMs)) : null,
        message: result.errorMessage,
        failedCase: failed ? { position: failed.position, isPublic: failed.isPublic, input: failed.input.slice(0, 2000), expectedOutput: failed.expectedOutput.slice(0, 2000), actualOutput: (failed.actualOutput ?? "").slice(0, 2000) } : null
      });
    }
    return { ok: results.every((result) => result.ok), results };
  }

  /** Gera as saídas esperadas rodando a solução de referência no juiz. */
  async generateCases(input: unknown) {
    const payload = generateSchema.parse(input);
    const inputs = payload.inputs?.length ? payload.inputs : runCaseGenerator(payload.generator!, payload.count, payload.seed, payload.mode);
    const run = await this.evaluator.run({
      language: payload.language as SubmissionLanguage,
      sourceCode: payload.referenceSolution,
      mode: payload.mode,
      functionSpec: payload.mode === "function" ? (payload.functionSpec as never) : null,
      cases: inputs.map((caseInput, index) => ({ label: `Caso ${index + 1}`, input: caseInput }))
    });
    if (run.compileError) throw new DomainError(`A solução de referência não compila:\n${run.compileError}`, 400);
    const failures = run.cases.filter((runCase) => runCase.executionStatus !== "completed" || runCase.error);
    return {
      cases: run.cases.map((runCase) => ({ input: runCase.input, expectedOutput: runCase.actualOutput, ok: runCase.executionStatus === "completed" && !runCase.error, error: runCase.error, durationMs: runCase.durationMs })),
      failures: failures.length
    };
  }
}
