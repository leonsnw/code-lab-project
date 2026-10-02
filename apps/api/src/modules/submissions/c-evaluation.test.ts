import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { TestCase } from "../../domain/types.js";
import { SubmissionEvaluationService } from "./submission-evaluation.service.js";

const hasCSandbox =
  spawnSync("bwrap", ["--version"]).status === 0 && spawnSync("gcc", ["--version"]).status === 0;

const sumCases: TestCase[] = [
  { id: "p1", challengeId: "c", input: "3 5", expectedOutput: "8", isPublic: true, weight: 1 },
  { id: "h1", challengeId: "c", input: "-2 10", expectedOutput: "8", isPublic: false, weight: 1 }
];

function evaluate(sourceCode: string, testCases = sumCases, options = {}) {
  return new SubmissionEvaluationService(options).evaluate({ language: "c", sourceCode, testCases });
}

describe.skipIf(!hasCSandbox)("avaliação de C no bubblewrap", () => {
  it("compila e aceita uma solução correta", async () => {
    const result = await evaluate(
      '#include <stdio.h>\nint main(void){int a,b; scanf("%d %d",&a,&b); printf("%d\\n",a+b); return 0;}'
    );
    expect(result.status).toBe("accepted");
    expect(result.passedTests).toBe(2);
  });

  it("reporta erro de compilação com linha em solucao.c", async () => {
    const result = await evaluate("#include <stdio.h>\nint main(void){ printf(\"x\") return 0; }");
    expect(result.status).toBe("compile_error");
    expect(result.errorMessage).toMatch(/solucao\.c:2:\d+: error/);
    expect(result.errorMessage).not.toContain("/box/");
  });

  it("não permite incluir arquivos do servidor na compilação", async () => {
    const result = await evaluate(`#include "${process.cwd()}/package.json"\nint main(void){return 0;}`);
    expect(result.status).toBe("compile_error");
    expect(result.errorMessage).toContain("No such file or directory");
    expect(result.errorMessage).not.toContain("@codelab/api");
  });

  it("isola arquivos, processos e rede do programa", async () => {
    const result = await evaluate(
      `#include <stdio.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
int main(void){
  int ok = 1;
  if (fopen("/etc/passwd", "r")) ok = 0;
  if (fopen("${process.cwd()}/package.json", "r")) ok = 0;
  pid_t p = fork(); if (p == 0) _exit(0); if (p > 0) ok = 0;
  int s = socket(AF_INET, SOCK_STREAM, 0);
  struct sockaddr_in a = { .sin_family = AF_INET, .sin_port = htons(5432) };
  inet_pton(AF_INET, "127.0.0.1", &a.sin_addr);
  if (s >= 0 && connect(s, (struct sockaddr *)&a, sizeof a) == 0) ok = 0;
  printf("%s\\n", ok ? "ISOLADO" : "VAZOU");
  return 0;
}`,
      [{ ...sumCases[0], expectedOutput: "ISOLADO" }]
    );
    expect(result.testResults[0]?.actualOutput.trim()).toBe("ISOLADO");
  });

  it("explica índice fora do vetor detectado pelo UBSan", async () => {
    const result = await evaluate(
      '#include <stdio.h>\nint main(void){int v[3]={1,2,3}; int i; scanf("%d",&i); printf("%d\\n", v[i+4]); return 0;}'
    );
    expect(result.status).toBe("runtime_error");
    expect(result.testResults[0].error).toContain("Comportamento indefinido em solucao.c:2");
    expect(result.testResults[0].error).toContain("fora dos limites do vetor");
  });

  it("explica overflow de inteiro com sinal", async () => {
    const result = await evaluate(
      '#include <stdio.h>\nint main(void){int a,b; scanf("%d %d",&a,&b); int x = 2147483647; x += a; printf("%d\\n", x); return 0;}'
    );
    expect(result.testResults[0].error).toContain("overflow de inteiro com sinal");
  });

  it("aponta acesso por ponteiro nulo", async () => {
    const result = await evaluate(
      "#include <stdio.h>\nint main(void){ int *p = 0; volatile int x = *p; printf(\"%d\", x); return 0; }"
    );
    expect(result.status).toBe("runtime_error");
    expect(result.testResults[0].error).toContain("acesso por ponteiro nulo");
  });

  it("traduz falha de segmentacao por recursão sem caso base", async () => {
    const result = await evaluate(
      "#include <stdio.h>\nint f(volatile int n){ volatile char buf[512]; buf[0] = (char)n; return f(n + 1) + buf[0]; }\nint main(void){ printf(\"%d\", f(0)); return 0; }",
      [sumCases[0]],
      { timeoutMs: 5000 }
    );
    expect(result.status).toBe("runtime_error");
    expect(result.testResults[0].error).toContain("Falha de segmentação");
  });

  it("interrompe laço infinito por tempo", async () => {
    const result = await evaluate("int main(void){ for(;;){} }", [sumCases[0]], { timeoutMs: 300 });
    expect(result.status).toBe("timeout");
  });

  it("limita a memória do programa", async () => {
    const result = await evaluate(
      '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\nint main(void){ char *p = malloc(512u*1024*1024); if(!p){ printf("SEM_MEMORIA\\n"); return 0;} memset(p,1,512u*1024*1024); printf("ALOCOU\\n"); return 0; }',
      [{ ...sumCases[0], expectedOutput: "SEM_MEMORIA" }]
    );
    expect(result.status).toBe("accepted");
  });

  it("recusa código que viola regra antes de executar casos", async () => {
    const service = new SubmissionEvaluationService();
    const result = await service.evaluate({
      language: "c",
      sourceCode: '#include <stdio.h>\nint main(void){int a,b; scanf("%d %d",&a,&b); printf("%d\\n",a+b); return 0;}',
      testCases: sumCases,
      sourceRules: [{ kind: "recursion", message: "Resolva com recursão." }]
    });
    expect(result.status).toBe("rule_violation");
    expect(result.errorMessage).toBe("Resolva com recursão.");
    expect(result.testResults).toHaveLength(0);
  });
});
