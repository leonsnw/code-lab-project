import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { FunctionSpec, SubmissionLanguage, TestCase } from "../../domain/types.js";
import { SubmissionEvaluationService } from "./submission-evaluation.service.js";

const hasBwrap = spawnSync("bwrap", ["--version"]).status === 0;
const evaluator = new SubmissionEvaluationService();

function cases(pairs: Array<[unknown[], unknown]>): TestCase[] {
  return pairs.map(([args, returns], index) => ({
    id: `caso-${index}`,
    challengeId: "c",
    input: JSON.stringify(args),
    expectedOutput: JSON.stringify(returns),
    isPublic: index === 0,
    weight: 1
  }));
}

function judge(language: SubmissionLanguage, spec: FunctionSpec, sourceCode: string, testCases: TestCase[]) {
  return evaluator.evaluate({ language, sourceCode, mode: "function", functionSpec: spec, testCases });
}

// Uma função por tipo: recebe cada tipo de parâmetro e devolve cada tipo de retorno.
const scenarios: Array<{
  name: string;
  spec: FunctionSpec;
  testCases: TestCase[];
  sources: Partial<Record<SubmissionLanguage, string>>;
}> = [
  {
    name: "int[] -> int[] (dobrar)",
    spec: { name: "dobrar", params: [{ name: "nums", type: "int[]" }], returns: "int[]" },
    testCases: cases([[[[1, -2, 3]], [2, -4, 6]], [[[]], []]]),
    sources: {
      javascript: "function dobrar(nums) { return nums.map((n) => n * 2); }",
      python: "def dobrar(nums):\n    return [n * 2 for n in nums]",
      c: "#include <stdlib.h>\nint* dobrar(int* nums, int numsSize, int* returnSize) { int* r = malloc(sizeof(int) * (numsSize + 1)); for (int i = 0; i < numsSize; i++) r[i] = nums[i] * 2; *returnSize = numsSize; return r; }"
    }
  },
  {
    name: "string[] + string -> string (juntar)",
    spec: { name: "juntar", params: [{ name: "palavras", type: "string[]" }, { name: "sep", type: "string" }], returns: "string" },
    testCases: cases([[[["a", "b", "c"], "-"], "a-b-c"], [[["aspas \"x\"", "barra \\"], " "], "aspas \"x\" barra \\"]]),
    sources: {
      javascript: "function juntar(palavras, sep) { return palavras.join(sep); }",
      python: "def juntar(palavras, sep):\n    return sep.join(palavras)",
      c: "#include <stdlib.h>\n#include <string.h>\nchar* juntar(char** palavras, int palavrasSize, char* sep) { size_t t = 1; for (int i = 0; i < palavrasSize; i++) t += strlen(palavras[i]) + strlen(sep); char* r = calloc(t, 1); for (int i = 0; i < palavrasSize; i++) { if (i) strcat(r, sep); strcat(r, palavras[i]); } return r; }"
    }
  },
  {
    name: "int[][] -> int[][] (transpor)",
    spec: { name: "transpor", params: [{ name: "m", type: "int[][]" }], returns: "int[][]" },
    testCases: cases([[[[[1, 2, 3], [4, 5, 6]]], [[1, 4], [2, 5], [3, 6]]], [[[[7]]], [[7]]]]),
    sources: {
      javascript: "function transpor(m) { return m[0].map((_, j) => m.map((linha) => linha[j])); }",
      python: "def transpor(m):\n    return [list(coluna) for coluna in zip(*m)]",
      c: "#include <stdlib.h>\nint** transpor(int** m, int mSize, int* mColSize, int* returnSize, int** returnColumnSizes) { int cols = mColSize[0]; int** r = malloc(sizeof(int*) * cols); *returnColumnSizes = malloc(sizeof(int) * cols); for (int j = 0; j < cols; j++) { r[j] = malloc(sizeof(int) * mSize); (*returnColumnSizes)[j] = mSize; for (int i = 0; i < mSize; i++) r[j][i] = m[i][j]; } *returnSize = cols; return r; }"
    }
  },
  {
    name: "double[] -> double (media) e bool",
    spec: { name: "media", params: [{ name: "v", type: "double[]" }], returns: "double" },
    testCases: cases([[[[1, 2, 2.5]], 1.8333333333], [[[-4.5]], -4.5]]),
    sources: {
      javascript: "function media(v) { return v.reduce((a, b) => a + b, 0) / v.length; }",
      python: "def media(v):\n    return sum(v) / len(v)",
      c: "double media(double* v, int vSize) { double s = 0; for (int i = 0; i < vSize; i++) s += v[i]; return s / vSize; }"
    }
  },
  {
    name: "long + bool -> bool (maiorQue)",
    spec: { name: "maiorQue", params: [{ name: "x", type: "long" }, { name: "estrito", type: "bool" }], returns: "bool" },
    testCases: cases([[[9000000000, true], true], [[0, false], true], [[-1, true], false]]),
    sources: {
      javascript: "function maiorQue(x, estrito) { return estrito ? x > 0 : x >= 0; }",
      python: "def maiorQue(x, estrito):\n    return x > 0 if estrito else x >= 0",
      c: "#include <stdbool.h>\nbool maiorQue(long long x, bool estrito) { return estrito ? x > 0 : x >= 0; }"
    }
  },
  {
    name: "list -> list (inverter lista ligada)",
    spec: { name: "reverseList", params: [{ name: "head", type: "list" }], returns: "list" },
    testCases: cases([[[[1, 2, 3, 4]], [4, 3, 2, 1]], [[[]], []], [[[7]], [7]]]),
    sources: {
      javascript: "function reverseList(head) { let prev = null; while (head) { const next = head.next; head.next = prev; prev = head; head = next; } return prev; }",
      python: "def reverseList(head):\n    prev = None\n    while head:\n        head.next, prev, head = prev, head, head.next\n    return prev",
      c: "struct ListNode* reverseList(struct ListNode* head) { struct ListNode* prev = 0; while (head) { struct ListNode* next = head->next; head->next = prev; prev = head; head = next; } return prev; }"
    }
  },
  {
    name: "list com ciclo -> bool (detectar ciclo)",
    spec: { name: "hasCycle", params: [{ name: "head", type: "list" }], returns: "bool", cycleParam: "head" },
    testCases: cases([[[[3, 2, 0, -4], 1], true], [[[1, 2], -1], false], [[[1], 0], true], [[[], -1], false]]),
    sources: {
      javascript: "function hasCycle(head) { let slow = head, fast = head; while (fast && fast.next) { slow = slow.next; fast = fast.next.next; if (slow === fast) return true; } return false; }",
      python: "def hasCycle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow, fast = slow.next, fast.next.next\n        if slow is fast:\n            return True\n    return False",
      c: "#include <stdbool.h>\nbool hasCycle(struct ListNode* head) { struct ListNode *slow = head, *fast = head; while (fast && fast->next) { slow = slow->next; fast = fast->next->next; if (slow == fast) return true; } return false; }"
    }
  },
  {
    name: "tree -> tree (espelhar arvore)",
    spec: { name: "invertTree", params: [{ name: "root", type: "tree" }], returns: "tree" },
    testCases: cases([[[[4, 2, 7, 1, 3, 6, 9]], [4, 7, 2, 9, 6, 3, 1]], [[[]], []], [[[1, 2, null, 3]], [1, null, 2, null, 3]]]),
    sources: {
      javascript: "function invertTree(root) { if (!root) return null; [root.left, root.right] = [invertTree(root.right), invertTree(root.left)]; return root; }",
      python: "def invertTree(root):\n    if root:\n        root.left, root.right = invertTree(root.right), invertTree(root.left)\n    return root",
      c: "struct TreeNode* invertTree(struct TreeNode* root) { if (!root) return 0; struct TreeNode* l = root->left; root->left = invertTree(root->right); root->right = invertTree(l); return root; }"
    }
  },
  {
    name: "tree -> int (altura com nulls no meio)",
    spec: { name: "maxDepth", params: [{ name: "root", type: "tree" }], returns: "int" },
    testCases: cases([[[[3, 9, 20, null, null, 15, 7]], 3], [[[]], 0], [[[1, null, 2, null, 3, null, 4]], 4]]),
    sources: {
      javascript: "function maxDepth(root) { return root ? 1 + Math.max(maxDepth(root.left), maxDepth(root.right)) : 0; }",
      python: "def maxDepth(root):\n    return 1 + max(maxDepth(root.left), maxDepth(root.right)) if root else 0",
      c: "int maxDepth(struct TreeNode* root) { if (!root) return 0; int l = maxDepth(root->left), r = maxDepth(root->right); return 1 + (l > r ? l : r); }"
    }
  }
];

describe("modo função (estilo LeetCode)", () => {
  it.each(["javascript", "python", "c"] as const)("aponta lista retornada com ciclo em %s", async (language) => {
    if (language !== "javascript" && !hasBwrap) return;
    const sources = {
      javascript: "function loop(head) { head.next = head; return head; }",
      python: "def loop(head):\n    head.next = head\n    return head",
      c: "struct ListNode* loop(struct ListNode* head) { head->next = head; return head; }"
    };
    const result = await judge(
      language,
      { name: "loop", params: [{ name: "head", type: "list" }], returns: "list" },
      sources[language],
      cases([[[[1]], [1]]])
    );
    expect(result.status).toBe("runtime_error");
    expect(result.testResults[0].error).toContain("A lista retornada tem um ciclo");
  });

  for (const scenario of scenarios) {
    for (const [language, source] of Object.entries(scenario.sources) as Array<[SubmissionLanguage, string]>) {
      const skip = language !== "javascript" && !hasBwrap;
      it.skipIf(skip)(`${scenario.name} em ${language}`, async () => {
        const checker = scenario.spec.returns === "double" ? ({ kind: "tolerance", epsilon: 1e-6 } as const) : undefined;
        const result = await evaluator.evaluate({
          language,
          sourceCode: source,
          mode: "function",
          functionSpec: scenario.spec,
          checker,
          testCases: scenario.testCases
        });
        expect({ status: result.status, failed: result.testResults.find((test) => !test.passed), error: result.errorMessage }).toMatchObject({
          status: "accepted"
        });
      });
    }
  }

  it("separa o que o aluno imprime do valor retornado", async () => {
    const result = await judge(
      "javascript",
      { name: "somar", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }], returns: "int" },
      'function somar(a, b) { console.log("depurando", a, b); return a - b; }',
      cases([[[2, 3], 5]])
    );
    expect(result.status).toBe("wrong_answer");
    expect(result.testResults[0].actualOutput).toBe("-1");
    expect(result.testResults[0].stderr).toContain("depurando 2 3");
  });

  it.skipIf(!hasBwrap)("explica quando o aluno escreve main no modo função em C", async () => {
    const result = await judge(
      "c",
      { name: "somar", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }], returns: "int" },
      "int somar(int a, int b) { return a + b; }\nint main(void) { return 0; }",
      cases([[[2, 3], 5]])
    );
    expect(result.status).toBe("compile_error");
    expect(result.errorMessage).toContain("o juiz já fornece o main");
  });

  it.skipIf(!hasBwrap)("aponta a função com nome errado em Python", async () => {
    const result = await judge(
      "python",
      { name: "somar", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }], returns: "int" },
      "def soma(a, b):\n    return a + b",
      cases([[[2, 3], 5]])
    );
    expect(result.status).toBe("runtime_error");
    expect(result.testResults[0].error).toContain("Defina a função somar(a, b)");
  });

  it.skipIf(!hasBwrap)("traduz traceback de Python apontando solucao.py", async () => {
    const result = await judge(
      "python",
      { name: "dividir", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }], returns: "int" },
      "def dividir(a, b):\n    return a // b",
      cases([[[1, 0], 0]])
    );
    expect(result.status).toBe("runtime_error");
    expect(result.testResults[0].error).toContain('File "solucao.py", line 2');
    expect(result.testResults[0].error).toContain("ZeroDivisionError");
    expect(result.testResults[0].error).not.toContain("harness");
  });
});
