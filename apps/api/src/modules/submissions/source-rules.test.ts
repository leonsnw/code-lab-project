import { describe, expect, it } from "vitest";
import {
  checkSourceRules,
  findRecursiveFunctions,
  stripCommentsAndLiterals
} from "./source-rules.js";

describe("regras de codigo-fonte", () => {
  it("ignora comentarios e literais ao procurar padroes", () => {
    const code = stripCommentsAndLiterals(`
// malloc aqui nao conta
/* nem aqui: qsort(v, n) */
printf("malloc(");
char c = '"';
int x = 1;
`);
    expect(code).not.toContain("malloc");
    expect(code).not.toContain("qsort");
    expect(code).toContain("int x = 1;");
  });

  it("detecta funcoes recursivas em C", () => {
    const recursive = `
int fat(int n) {
  if (n <= 1) { return 1; }
  return n * fat(n - 1);
}
int main(void) { return fat(5) == 120 ? 0 : 1; }`;
    const iterative = `
int fat(int n) { int r = 1; for (int i = 2; i <= n; i++) r *= i; return r; }
int main(void) { return fat(5); }`;

    expect(findRecursiveFunctions(recursive)).toEqual(["fat"]);
    expect(findRecursiveFunctions(iterative)).toEqual([]);
  });

  it("nao aceita recursao citada so em comentario", () => {
    const violations = checkSourceRules(
      "int f(int n) { /* return f(n - 1); */ return n; }",
      [{ kind: "recursion", message: "Use recursao." }]
    );
    expect(violations).toEqual(["Use recursao."]);
  });

  it("aplica regras de proibicao e exigencia", () => {
    const rules = [
      { kind: "forbid" as const, pattern: "\\bqsort\\s*\\(", message: "Nao use qsort." },
      { kind: "require" as const, pattern: "\\bmalloc\\s*\\(", message: "Use malloc." }
    ];

    expect(checkSourceRules("qsort(v, n, sizeof(int), cmp);", rules)).toEqual([
      "Nao use qsort.",
      "Use malloc."
    ]);
    expect(checkSourceRules("int *p = malloc(4);", rules)).toEqual([]);
  });

  it("reconhece struct autorreferente para listas encadeadas", () => {
    const rule = {
      kind: "require" as const,
      pattern: "struct\\s+(\\w+)\\s*\\{[^}]*struct\\s+\\1\\s*\\*",
      message: "Use um no encadeado."
    };
    const linked = "typedef struct no { int v; struct no *prox; } No;";
    expect(checkSourceRules(linked, [rule])).toEqual([]);
    expect(checkSourceRules("typedef struct { int v[10]; } Vetor;", [rule])).toEqual([
      "Use um no encadeado."
    ]);
  });
});

describe("regras por linguagem", () => {
  const recursion = { kind: "recursion" as const, message: "Use recursão." };

  it("reconhece recursão em Python pelo bloco indentado do def", () => {
    const recursive = "def fat(n):\n    if n <= 1:\n        return 1\n    return n * fat(n - 1)\n";
    const fake = "def fat(n):\n    r = 1\n    for i in range(2, n + 1):\n        r *= i\n    return r\n\nprint(fat(5))\n";
    expect(checkSourceRules(recursive, [recursion], "python")).toEqual([]);
    expect(checkSourceRules(fake, [recursion], "python")).toEqual(["Use recursão."]);
  });

  it("em Python, # é comentário e // é divisão inteira", () => {
    const forbidWhile = { kind: "forbid" as const, pattern: "\\bwhile\\b", message: "Sem while." };
    expect(checkSourceRules("# while aqui é só comentário\nx = 1", [forbidWhile], "python")).toEqual([]);
    expect(checkSourceRules("q = a // b; while q: q -= 1", [forbidWhile], "python")).toEqual(["Sem while."]);
    expect(checkSourceRules('"""while dentro de docstring"""\nx = 2', [forbidWhile], "python")).toEqual([]);
  });

  it("reconhece arrow functions e function expressions recursivas em JavaScript", () => {
    expect(checkSourceRules("const fat = (n) => (n <= 1 ? 1 : n * fat(n - 1));", [recursion], "javascript")).toEqual([]);
    expect(checkSourceRules("const fib = function (n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); };", [recursion], "javascript")).toEqual([]);
    expect(checkSourceRules("const dobro = (n) => n * 2;\nconsole.log(dobro(3));", [recursion], "javascript")).toEqual(["Use recursão."]);
  });
});
