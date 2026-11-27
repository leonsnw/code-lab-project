import { describe, expect, it } from "vitest";
import {
  describeGenerated,
  formatArguments,
  formatReturn,
  isFunctionMode,
  signatureFor
} from "../public/js/io-format.js";

const spec = {
  name: "somar",
  params: [
    { name: "a", type: "int" },
    { name: "v", type: "int[]" }
  ],
  returns: "int"
};

describe("io-format", () => {
  it("isFunctionMode exige modo função e especificação", () => {
    expect(isFunctionMode({ mode: "function", functionSpec: spec })).toBeTruthy();
    expect(isFunctionMode({ mode: "function" })).toBeFalsy();
    expect(isFunctionMode(undefined)).toBeFalsy();
  });

  it("formatArguments nomeia cada argumento", () => {
    expect(formatArguments("[1,[2,3]]", spec)).toBe("a = 1\nv = [2,3]");
  });

  it("formatArguments devolve a entrada crua sem spec ou com JSON inválido", () => {
    expect(formatArguments("texto", null)).toBe("texto");
    expect(formatArguments("{quebrado", spec)).toBe("{quebrado");
    expect(formatArguments('{"a":1}', spec)).toBe('{"a":1}');
  });

  it("formatArguments mostra a posição do ciclo em listas com ciclo", () => {
    const comCiclo = { params: [{ name: "lista", type: "list" }], cycleParam: true };
    expect(formatArguments("[[1,2,3],1]", comCiclo)).toBe("lista = [1,2,3]\npos = 1");
  });

  it("formatReturn normaliza JSON e preserva o que não é JSON", () => {
    expect(formatReturn("[1, 2]")).toBe("[1,2]");
    expect(formatReturn("abc")).toBe("abc");
    expect(formatReturn("")).toBe("");
    expect(formatReturn(null)).toBeNull();
  });

  it("describeGenerated descreve cada gerador do juiz", () => {
    expect(describeGenerated({ $gen: "ints", n: 5, min: 0, max: 9, distinct: true, sorted: "asc" })).toContain(
      "5 inteiros distintos"
    );
    expect(describeGenerated({ $gen: "ints", n: 5, min: 0, max: 2000000, sorted: "desc" })).toContain("2e6");
    expect(describeGenerated({ $gen: "range", n: 4 })).toContain("passo 1");
    expect(describeGenerated({ $gen: "perm", n: 3 })).toContain("1 a 3");
    expect(describeGenerated({ $gen: "string", n: 8, alphabet: "ab" })).toContain('sobre "ab"');
    expect(describeGenerated({ $gen: "matrix", rows: 2, cols: 3, min: 0, max: 9 })).toContain("2×3");
    expect(describeGenerated({ $gen: "grid", rows: 2, cols: 2, alphabet: ".#" })).toContain("grade 2×2");
    expect(describeGenerated({ $gen: "edges", n: 6, tree: true })).toContain("árvore");
    expect(describeGenerated({ $gen: "edges", n: 6, m: 9 })).toContain("9 arestas");
    expect(describeGenerated({ $gen: "repeat", n: 3, value: 7 })).toContain("3 cópias de 7");
    expect(describeGenerated({ $gen: "concat", parts: [{ $gen: "range", n: 2 }, 5] })).toContain(" + 5");
    expect(describeGenerated({ $gen: "outro" })).toContain("entrada gerada");
  });

  it("describeGenerated ignora o que não é gerador", () => {
    expect(describeGenerated(null)).toBeNull();
    expect(describeGenerated([1])).toBeNull();
    expect(describeGenerated({ a: 1 })).toBeNull();
  });

  it("signatureFor monta a assinatura de cada linguagem", () => {
    expect(signatureFor(spec, "c", "int somar(int a, int *v, int n)")).toBe("int somar(int a, int *v, int n)");
    expect(signatureFor(spec, "python")).toBe("def somar(a: int, v: list[int]) -> int");
    expect(signatureFor(spec, "javascript")).toContain("function somar(a, v)");
    expect(signatureFor(spec, "javascript")).toContain("v: number[]");
  });
});
