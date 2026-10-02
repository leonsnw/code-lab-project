import { describe, expect, it } from "vitest";
import { checkOutput, deepEqual } from "./checker.js";

const stdio = (checker: Parameters<typeof checkOutput>[0]["checker"], expected: string, actual: string) =>
  checkOutput({ mode: "stdio", checker, caseInput: "", expected, actual }).passed;
const fn = (checker: Parameters<typeof checkOutput>[0]["checker"], expected: unknown, actual: string) =>
  checkOutput({ mode: "function", checker, caseInput: "[]", expected: JSON.stringify(expected), actual });

describe("comparadores de saída", () => {
  it("compara exatamente, ignorando espacos no fim das linhas", () => {
    expect(stdio({ kind: "exact" }, "1 2\n3", "1 2   \n3\n\n")).toBe(true);
    expect(stdio({ kind: "exact" }, "1 2", "1  2")).toBe(false);
  });

  it("aceita diferenca numerica dentro da tolerancia", () => {
    expect(stdio({ kind: "tolerance", epsilon: 1e-3 }, "3.14159 ok", "3.1414 ok")).toBe(true);
    expect(stdio({ kind: "tolerance", epsilon: 1e-3 }, "3.14159", "3.2")).toBe(false);
    expect(stdio({ kind: "tolerance", epsilon: 1e-3 }, "texto", "Texto")).toBe(false);
  });

  it("aceita linhas ou valores em qualquer ordem", () => {
    expect(stdio({ kind: "unordered-lines" }, "a\nb\nc", "c\na\nb")).toBe(true);
    expect(stdio({ kind: "unordered-lines" }, "a\nb", "a\na")).toBe(false);
    expect(stdio({ kind: "unordered-tokens" }, "1 2 3", "3\n1 2")).toBe(true);
  });

  it("roda checker personalizado com tempo limite", () => {
    const parity = { kind: "custom" as const, code: "function check(input, expected, actual) { return Number(actual) % 2 === 0; }" };
    expect(stdio(parity, "", "4")).toBe(true);
    expect(stdio(parity, "", "5")).toBe(false);
    const looping = { kind: "custom" as const, code: "function check() { while (true) {} }" };
    expect(checkOutput({ mode: "stdio", checker: looping, caseInput: "", expected: "", actual: "" })).toEqual({
      passed: false,
      message: "O verificador deste desafio falhou. Avise o professor."
    });
  });

  it("no modo função compara valores, não texto", () => {
    expect(fn({ kind: "exact" }, [1, 2], "[1,2]").passed).toBe(true);
    expect(fn({ kind: "exact" }, [1, 2], "[1, 2]").passed).toBe(true);
    expect(fn({ kind: "exact" }, 8, '"8"').passed).toBe(false);
    expect(fn({ kind: "tolerance", epsilon: 1e-6 }, [0.1, 0.2], "[0.1000000001,0.2]").passed).toBe(true);
    expect(fn({ kind: "unordered-tokens" }, [[1, 2], [3]], "[[3],[1,2]]").passed).toBe(true);
    expect(fn({ kind: "exact" }, 1, "nao-e-json")).toEqual({
      passed: false,
      message: "O retorno da função não pode ser convertido para comparação."
    });
  });

  it("igualdade profunda com objetos e tolerancia", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual(1, 1.0000001, 1e-6)).toBe(true);
  });
});
