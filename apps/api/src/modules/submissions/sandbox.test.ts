import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { TestCase } from "../../domain/types.js";
import { buildSeccompProgram, Semaphore } from "./sandbox.js";
import { SubmissionEvaluationService } from "./submission-evaluation.service.js";

const hasBwrap = spawnSync("bwrap", ["--version"]).status === 0;
const evaluator = new SubmissionEvaluationService();
const single = (expectedOutput: string): TestCase[] => [
  { id: "c1", challengeId: "c", input: "", expectedOutput, isPublic: true, weight: 1 }
];

describe("sandbox", () => {
  it("monta um filtro seccomp BPF válido (8 bytes por instrução)", () => {
    const program = buildSeccompProgram();
    if (process.arch !== "x64") {
      expect(program).toBeUndefined();
      return;
    }
    expect(program!.length % 8).toBe(0);
    expect(program!.length / 8).toBeGreaterThan(40);
  });

  it("limita avaliacoes simultaneas", async () => {
    const semaphore = new Semaphore(2);
    let running = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        semaphore.run(async () => {
          running += 1;
          peak = Math.max(peak, running);
          await new Promise((resolve) => setTimeout(resolve, 20));
          running -= 1;
        })
      )
    );
    expect(peak).toBe(2);
  });

  it.skipIf(!hasBwrap || process.arch !== "x64")("seccomp impede o C de criar namespaces dentro do sandbox", async () => {
    const result = await evaluator.evaluate({
      language: "c",
      sourceCode: `#define _GNU_SOURCE
#include <sched.h>
#include <stdio.h>
#include <sys/ptrace.h>
int main(void) {
  int escaped = unshare(CLONE_NEWUSER) == 0 || ptrace(PTRACE_TRACEME, 0, 0, 0) == 0;
  printf("%s\\n", escaped ? "ESCAPOU" : "BLOQUEADO");
  return 0;
}`,
      testCases: single("BLOQUEADO")
    });
    expect(result.status).toBe("accepted");
  });

  it.skipIf(!hasBwrap)("isola arquivos, rede e processos do Python", async () => {
    const result = await evaluator.evaluate({
      language: "python",
      sourceCode: `import os, socket
bloqueios = []
try:
    open("/etc/passwd").read(); bloqueios.append("arquivo")
except OSError:
    pass
try:
    open("${process.cwd()}/package.json").read(); bloqueios.append("projeto")
except OSError:
    pass
try:
    socket.create_connection(("127.0.0.1", 5432), timeout=1); bloqueios.append("rede")
except OSError:
    pass
try:
    pid = os.fork()
    if pid == 0:
        os._exit(0)
    bloqueios.append("fork")
except OSError:
    pass
print("ISOLADO" if not bloqueios else "VAZOU " + ",".join(bloqueios))
`,
      testCases: single("ISOLADO")
    });
    expect(result.testResults[0]?.actualOutput.trim()).toBe("ISOLADO");
  });

  it.skipIf(!hasBwrap)("mostra avisos do gcc que explicam uma resposta errada", async () => {
    const result = await evaluator.evaluate({
      language: "c",
      sourceCode: `#include <stdio.h>
int main(void) {
  int v[5] = {4, 2, 9, 2, 7}, j = 3;
  v[j + 1] = v[j--];
  printf("%d\\n", v[4]);
  return 0;
}`,
      testCases: single("nunca")
    });
    expect(result.status).toBe("wrong_answer");
    expect(result.compileWarnings).toContain("-Wsequence-point");
    expect(result.compileWarnings).toContain("solucao.c:4");
  });

  it.skipIf(!hasBwrap)("mede a recursão de verdade e recusa recursão de fachada", async () => {
    const testCases: TestCase[] = [100, 5000].map((n, index) => ({
      id: `c${index}`,
      challengeId: "c",
      input: String(n),
      expectedOutput: String((n * (n + 1)) / 2),
      isPublic: index === 0,
      weight: 1
    }));
    const sourceRules = [{ kind: "recursion" as const, message: "Use recursão.", minDepth: 50 }];
    const genuine = await evaluator.evaluate({
      language: "c",
      sourceCode: '#include <stdio.h>\nint pit(int n) { if (n == 1) return 1; return n + pit(n - 1); }\nint main(void) { int n; scanf("%d", &n); printf("%d\\n", pit(n)); return 0; }',
      testCases,
      sourceRules
    });
    const fake = await evaluator.evaluate({
      language: "c",
      sourceCode: '#include <stdio.h>\nint pit(int n) { return n <= 0 ? 0 : pit(0) + n * (n + 1) / 2; }\nint main(void) { int n; scanf("%d", &n); printf("%d\\n", pit(n)); return 0; }',
      testCases,
      sourceRules
    });
    expect(genuine.status).toBe("accepted");
    expect(fake.status).toBe("rule_violation");
    expect(fake.errorMessage).toContain("maior profundidade de chamadas medida nos testes foi");
  });

  it.skipIf(!hasBwrap)("não deixa substituir o medidor de recursão", async () => {
    const result = await evaluator.evaluate({
      language: "c",
      sourceCode: `#include <stdio.h>
__attribute__((no_instrument_function)) void __cyg_profile_func_enter(void *a, void *b) { (void)a; (void)b; }
int pit(int n) { return n <= 0 ? 0 : pit(0) + n * (n + 1) / 2; }
int main(void) { int n; scanf("%d", &n); printf("%d\\n", pit(n)); return 0; }`,
      testCases: [{ id: "c", challengeId: "c", input: "10", expectedOutput: "55", isPublic: true, weight: 1 }],
      sourceRules: [{ kind: "recursion", message: "Use recursão.", minDepth: 5 }]
    });
    expect(result.status).toBe("rule_violation");
    expect(result.errorMessage).toContain("__attribute__");
  });
});
