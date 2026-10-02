import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Challenge } from "../../domain/types.js";
import { SubmissionEvaluationService } from "../../modules/submissions/submission-evaluation.service.js";
import { buildDataStructureChallenges, DATA_STRUCTURES_TOPIC } from "./estrutura-de-dados.js";
import { buildCatalog } from "./index.js";

const hasCSandbox =
  spawnSync("bwrap", ["--version"]).status === 0 && spawnSync("gcc", ["--version"]).status === 0;
// Solucoes corretas ficam em desafios/<slug>/solucao.c, na raiz do repositorio.
const examplesDir = join(dirname(fileURLToPath(import.meta.url)), "../../../../../desafios");
// Os 17 exercicios vindos do repositorio da disciplina (prefixo ed-).
const legacySlugs = new Set(buildDataStructureChallenges().map((item) => item.slug));
const challenges = buildCatalog().challenges.filter((item) => legacySlugs.has(item.slug));
const evaluator = new SubmissionEvaluationService();

function challenge(slug: string): Challenge {
  const found = challenges.find((item) => item.slug === `ed-${slug}`);
  if (!found) throw new Error(`Desafio inexistente: ${slug}`);
  return found;
}

function judge(slug: string, sourceCode: string) {
  const target = challenge(slug);
  return evaluator.evaluate({
    language: "c",
    mode: target.mode,
    sourceCode,
    testCases: target.testCases,
    sourceRules: target.languages[0].sourceRules
  });
}

describe("catalogo de Estrutura de Dados", () => {
  it("cadastra os exercicios em C com suites robustas", () => {
    expect(buildDataStructureChallenges()).toHaveLength(17);
    for (const item of challenges) {
      expect(item.languages.map((entry) => entry.language)).toEqual(["c"]);
      expect(item.topic).toBe(DATA_STRUCTURES_TOPIC);
      expect(item.testCases.filter((testCase) => testCase.isPublic)).toHaveLength(2);
      expect(item.testCases.filter((testCase) => !testCase.isPublic).length).toBeGreaterThanOrEqual(8);
      expect(new Set(item.testCases.map((testCase) => testCase.id)).size).toBe(item.testCases.length);
    }
  });

  it("gera sempre os mesmos casos", () => {
    expect(JSON.stringify(buildDataStructureChallenges())).toBe(JSON.stringify(buildDataStructureChallenges()));
    expect(JSON.stringify(buildCatalog())).toBe(JSON.stringify(buildCatalog()));
    // Monta o catálogo inteiro duas vezes (casos grandes): pode levar alguns segundos.
  }, 120000);
});

describe.skipIf(!hasCSandbox)("tentativas de burla e bugs comuns", () => {
  it("recusa a serie de Pitagoras feita com laco", async () => {
    const result = await judge(
      "serie-de-pitagoras",
      '#include <stdio.h>\nint main(void){int n,s=0; scanf("%d",&n); for(int i=1;i<=n;i++) s+=i; printf("%d\\n",s); return 0;}'
    );
    expect(result.status).toBe("rule_violation");
    expect(result.errorMessage).toContain("função recursiva");
  });

  it("recusa formula fechada com recursao de fachada", async () => {
    const result = await judge(
      "serie-de-pitagoras",
      '#include <stdio.h>\nint f(int n){ return n <= 0 ? 0 : f(0) + n*(n+1)/2; }\nint main(void){int n; scanf("%d",&n); while(0){} printf("%d\\n", f(n)); return 0;}'
    );
    expect(result.status).toBe("rule_violation");
    expect(result.errorMessage).toContain("Não use laços");
  });

  it("aponta overflow no fatorial calculado com int", async () => {
    const result = await judge(
      "fatorial-recursivo",
      '#include <stdio.h>\nint fat(int n){ if(n<=1) return 1; return n*fat(n-1); }\nint main(void){int n; scanf("%d",&n); printf("%d\\n",fat(n)); return 0;}'
    );
    expect(result.status).toBe("runtime_error");
    expect(result.testResults.at(-1)?.error).toContain("overflow de inteiro com sinal");
  });

  it("recusa qsort nos desafios de ordenacao", async () => {
    const result = await judge(
      "quick-sort-numeros",
      '#include <stdio.h>\n#include <stdlib.h>\nint cmp(const void*a,const void*b){return (*(int*)a>*(int*)b)-(*(int*)a<*(int*)b);}\nint v[3000];\nint main(void){int n; scanf("%d",&n); for(int i=0;i<n;i++) scanf("%d",&v[i]); qsort(v,n,sizeof(int),cmp); for(int i=0;i<n;i++) printf(i?" %d":"%d",v[i]); printf("\\n"); return 0;}'
    );
    expect(result.status).toBe("rule_violation");
    expect(result.errorMessage).toContain("qsort");
  });

  it("pega o bug do exercicio original que le alem do fim do vetor", async () => {
    // Laço de contagem do Exercicio 2.cpp: sem checar o limite do vetor.
    const result = await judge(
      "insertion-sort-menor",
      `#include <stdio.h>
int main(void){ int n, v[1000];
  scanf("%d",&n); for(int i=0;i<n;i++) scanf("%d",&v[i]);
  for(int i=1;i<n;i++){ int e=v[i], j=i-1; while(j>=0 && v[j]>e){ v[j+1]=v[j]; j--; } v[j+1]=e; }
  int i=1, cont=1; while(v[0]==v[i]){ cont++; i++; }
  for(int k=0;k<n;k++) printf(k?" %d":"%d",v[k]);
  printf("\\nMenor: %d\\nOcorrencias: %d\\n", v[0], cont); return 0; }`
    );
    expect(result.status).not.toBe("accepted");
  });

  it("pega o Selection Sort do exercicio original que para duas posicoes antes", async () => {
    const result = await judge(
      "selection-sort-maior",
      `#include <stdio.h>
int main(void){ int n; float v[1000];
  scanf("%d",&n); for(int i=0;i<n;i++) scanf("%f",&v[i]);
  for(int i=0;i<n-2;i++){ float e=v[i], m=v[i+1]; int p=i+1;
    for(int j=i+2;j<n;j++) if(v[j]<m){ m=v[j]; p=j; }
    if(m<e){ v[i]=v[p]; v[p]=e; } }
  int c=0; for(int i=0;i<n;i++){ printf(i?" %.2f":"%.2f",v[i]); if(v[i]==v[n-1]) c++; }
  printf("\\nMaior: %.2f\\nOcorrencias: %d\\n", v[n-1], c); return 0; }`
    );
    expect(result.status).toBe("wrong_answer");
  });

  it("recusa pilha implementada com vetor", async () => {
    const result = await judge(
      "pilha-de-numeros",
      '#include <stdio.h>\nint main(void){int n,v[1000]; scanf("%d",&n); for(int i=0;i<n;i++) scanf("%d",&v[i]); if(!n) printf("Lista vazia\\n"); for(int i=n-1;i>=0;i--) printf(i==n-1?"%d":" %d",v[i]); return 0;}'
    );
    expect(result.status).toBe("rule_violation");
  });

  it("recusa lista duplamente encadeada sem ponteiro para o anterior", async () => {
    const result = await judge(
      "lista-duplamente-encadeada",
      readFileSync(join(examplesDir, "ed-lista-circular", "solucao.c"), "utf8")
    );
    expect(result.status).toBe("rule_violation");
    expect(result.errorMessage).toContain("anterior");
  });

  it("reprova quem imprime a saida do exemplo", async () => {
    const target = challenge("lista-encadeada-ordenada");
    const result = await judge(
      "lista-encadeada-ordenada",
      `#include <stdio.h>\n#include <stdlib.h>\ntypedef struct no { int v; struct no *prox; } No;\nint main(void){ No *l = malloc(sizeof(No)); (void)l; printf("${target.testCases[0].expectedOutput}\\n"); return 0; }`
    );
    expect(result.status).toBe("wrong_answer");
  });
});
