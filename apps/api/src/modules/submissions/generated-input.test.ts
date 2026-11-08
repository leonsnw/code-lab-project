import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { FunctionSpec, TestCase } from "../../domain/types.js";
import { expandGeneratedArgs, generate, GeneratedInputError } from "./generated-input.js";
import { SubmissionEvaluationService } from "./submission-evaluation.service.js";

const hasBwrap = spawnSync("bwrap", ["--version"]).status === 0;
const evaluator = new SubmissionEvaluationService();

describe("argumentos gerados", () => {
  it("expande de forma deterministica e respeita as opcoes", () => {
    const spec = { $gen: "ints", n: 1000, min: -5, max: 5, seed: 3 } as const;
    expect(generate(spec)).toEqual(generate(spec));
    expect((generate(spec) as number[]).every((value) => value >= -5 && value <= 5)).toBe(true);

    const distinct = generate({ $gen: "ints", n: 50, min: 1, max: 60, seed: 1, distinct: true, sorted: "asc" }) as number[];
    expect(new Set(distinct).size).toBe(50);
    expect([...distinct].sort((a, b) => a - b)).toEqual(distinct);

    expect(generate({ $gen: "ints", n: 3, min: 0, max: 0, seed: 1, set: { "1": 9 } })).toEqual([0, 9, 0]);
    expect(generate({ $gen: "range", n: 4, start: 10, step: -2 })).toEqual([10, 8, 6, 4]);
    expect((generate({ $gen: "perm", n: 6, seed: 2 }) as number[]).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(generate({ $gen: "string", n: 5, seed: 9, alphabet: "a" })).toBe("aaaaa");
    expect(generate({ $gen: "concat", parts: [[1, 2], { $gen: "repeat", n: 2, value: 7 }] })).toEqual([1, 2, 7, 7]);
    expect(generate({ $gen: "edges", n: 5, seed: 4, tree: true })).toHaveLength(4);
    expect(generate({ $gen: "grid", rows: 2, cols: 3, seed: 1, alphabet: "1" })).toEqual(["111", "111"]);
  });

  it("deixa entradas comuns intactas e recusa tamanhos abusivos", () => {
    expect(expandGeneratedArgs("[[1,2],3]")).toBe("[[1,2],3]");
    expect(() => expandGeneratedArgs('[{"$gen":"ints","n":100000000,"min":0,"max":1,"seed":1}]')).toThrow(GeneratedInputError);
  });

  it.skipIf(!hasBwrap)("entrega o vetor gerado a funcao do aluno nas tres linguagens e reprova O(n^2) por tempo", async () => {
    const spec: FunctionSpec = { name: "contarIguais", params: [{ name: "nums", type: "int[]" }], returns: "long" };
    const nums = { $gen: "ints", n: 200000, min: 1, max: 1000, seed: 11 } as const;
    const values = generate(nums) as number[];
    const counts = new Map<number, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    let pairs = 0;
    counts.forEach((count) => (pairs += (count * (count - 1)) / 2));
    const testCases: TestCase[] = [
      { id: "p", challengeId: "c", input: JSON.stringify([[1, 1, 2]]), expectedOutput: "1", isPublic: true, weight: 1 },
      { id: "g", challengeId: "c", input: JSON.stringify([nums]), expectedOutput: String(pairs), isPublic: false, weight: 1 }
    ];
    const fast = {
      javascript: "function contarIguais(nums) { const c = new Map(); let t = 0; for (const x of nums) { const k = c.get(x) ?? 0; t += k; c.set(x, k + 1); } return t; }",
      python: "def contarIguais(nums):\n    c, t = {}, 0\n    for x in nums:\n        t += c.get(x, 0)\n        c[x] = c.get(x, 0) + 1\n    return t",
      c: "long long contarIguais(int* nums, int numsSize) { static int c[1001]; long long t = 0; for (int i = 0; i < numsSize; i++) t += c[nums[i]]++; return t; }"
    } as const;
    for (const [language, sourceCode] of Object.entries(fast)) {
      const result = await evaluator.evaluate({ language: language as keyof typeof fast, sourceCode, mode: "function", functionSpec: spec, testCases });
      expect({ language, status: result.status, error: result.errorMessage, failed: result.testResults.find((test) => !test.passed)?.error }).toMatchObject({ status: "accepted" });
      // O caso guardado continua compacto.
      expect(result.testResults[1].input.length).toBeLessThan(100);
    }
    const naive = "long long contarIguais(int* nums, int numsSize) { long long t = 0; for (int i = 0; i < numsSize; i++) for (int j = i + 1; j < numsSize; j++) if (nums[i] == nums[j]) t++; return t; }";
    const slow = await evaluator.evaluate({ language: "c", sourceCode: naive, mode: "function", functionSpec: spec, testCases });
    expect(slow.status).toBe("timeout");
  }, 60000);
});
