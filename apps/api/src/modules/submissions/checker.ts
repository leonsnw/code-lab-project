import { runInNewContext } from "node:vm";
import type { ChallengeMode, OutputChecker } from "../../domain/types.js";

export interface CheckResult {
  passed: boolean;
  /** Explicação curta quando a saída existe mas não confere (ex.: retorno ilegível). */
  message?: string;
}

const DEFAULT_EPSILON = 1e-6;
const CUSTOM_CHECKER_TIMEOUT_MS = 250;

export function normalizeOutput(output: string): string {
  return output
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

const tokens = (text: string) => normalizeOutput(text).split(/\s+/).filter(Boolean);
const lines = (text: string) => normalizeOutput(text).split("\n");

function numbersClose(expected: number, actual: number, epsilon: number): boolean {
  if (Number.isNaN(expected) || Number.isNaN(actual)) return false;
  const difference = Math.abs(expected - actual);
  return difference <= epsilon || difference <= epsilon * Math.abs(expected);
}

function tokensMatch(expected: string, actual: string, epsilon: number): boolean {
  if (expected === actual) return true;
  const a = Number(expected);
  const b = Number(actual);
  return expected.trim() !== "" && actual.trim() !== "" && !Number.isNaN(a) && !Number.isNaN(b) && numbersClose(a, b, epsilon);
}

/** Igualdade estrutural de valores JSON, com tolerância opcional para números. */
export function deepEqual(expected: unknown, actual: unknown, epsilon = 0): boolean {
  if (typeof expected === "number" && typeof actual === "number") {
    return epsilon > 0 ? numbersClose(expected, actual, epsilon) : expected === actual;
  }
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => deepEqual(item, actual[index], epsilon))
    );
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
    const keys = Object.keys(expected);
    return (
      keys.length === Object.keys(actual).length &&
      keys.every((key) => deepEqual((expected as Record<string, unknown>)[key], (actual as Record<string, unknown>)[key], epsilon))
    );
  }
  return expected === actual;
}

const canonical = (value: unknown) => JSON.stringify(value);

function runCustomChecker(code: string, input: unknown, expected: unknown, actual: unknown): CheckResult {
  const context = { __input: input, __expected: expected, __actual: actual, __result: undefined as unknown };
  try {
    runInNewContext(`${code}\n;__result = check(__input, __expected, __actual);`, context, {
      timeout: CUSTOM_CHECKER_TIMEOUT_MS,
      filename: "checker.js"
    });
  } catch (error) {
    // Falha do checker é problema do desafio, não do aluno: registrar e reprovar.
    console.error("Checker personalizado falhou:", error);
    return { passed: false, message: "O verificador deste desafio falhou. Avise o professor." };
  }
  const result = context.__result;
  if (typeof result === "boolean") return { passed: result };
  if (result && typeof result === "object" && "ok" in result) {
    const { ok, message } = result as { ok: unknown; message?: unknown };
    return { passed: Boolean(ok), message: typeof message === "string" ? message : undefined };
  }
  return { passed: false, message: "O verificador deste desafio retornou um valor inválido." };
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

export function checkOutput(input: {
  mode: ChallengeMode;
  checker: OutputChecker;
  caseInput: string;
  expected: string;
  actual: string;
}): CheckResult {
  const { mode, checker, caseInput, expected, actual } = input;

  if (mode === "function") {
    const expectedValue = parseJson(expected);
    const actualValue = parseJson(actual);
    if (!expectedValue.ok) {
      return { passed: false, message: "Caso de teste com retorno esperado inválido." };
    }
    if (!actualValue.ok) {
      return { passed: false, message: "O retorno da função não pode ser convertido para comparação." };
    }
    switch (checker.kind) {
      case "custom":
        return runCustomChecker(checker.code, parseJson(caseInput).ok ? JSON.parse(caseInput) : caseInput, expectedValue.value, actualValue.value);
      case "tolerance":
        return { passed: deepEqual(expectedValue.value, actualValue.value, checker.epsilon || DEFAULT_EPSILON) };
      case "unordered-lines":
      case "unordered-tokens": {
        const sorted = (value: unknown) => (Array.isArray(value) ? value.map(canonical).sort() : [canonical(value)]);
        return { passed: canonical(sorted(expectedValue.value)) === canonical(sorted(actualValue.value)) };
      }
      default:
        return { passed: deepEqual(expectedValue.value, actualValue.value) };
    }
  }

  switch (checker.kind) {
    case "tolerance": {
      const expectedTokens = tokens(expected);
      const actualTokens = tokens(actual);
      return {
        passed:
          expectedTokens.length === actualTokens.length &&
          expectedTokens.every((token, index) => tokensMatch(token, actualTokens[index], checker.epsilon || DEFAULT_EPSILON))
      };
    }
    case "unordered-lines":
      return { passed: canonical(lines(expected).sort()) === canonical(lines(actual).sort()) };
    case "unordered-tokens":
      return { passed: canonical(tokens(expected).sort()) === canonical(tokens(actual).sort()) };
    case "custom":
      return runCustomChecker(checker.code, caseInput, normalizeOutput(expected), normalizeOutput(actual));
    default:
      return { passed: normalizeOutput(actual) === normalizeOutput(expected) };
  }
}
