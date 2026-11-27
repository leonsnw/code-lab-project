import { describe, expect, it } from "vitest";
import { diffLines, diffSummary } from "../public/js/diff.js";

describe("diffLines", () => {
  it("marca linhas iguais, adicionadas e removidas", () => {
    const linhas = diffLines("a\nb\nc", "a\nx\nc");
    expect(linhas.map((linha) => linha.type)).toEqual(["same", "added", "removed", "same"]);
    expect(diffSummary(linhas)).toEqual({ added: 1, removed: 1 });
  });

  it("numera as linhas de cada lado", () => {
    const [primeira, adicionada] = diffLines("a", "a\nb");
    expect(primeira).toMatchObject({ type: "same", left: 1, right: 1 });
    expect(adicionada).toMatchObject({ type: "added", left: null, right: 2 });
  });

  it("textos idênticos não geram diferenças e aceitam CRLF e vazio", () => {
    expect(diffSummary(diffLines("a\r\nb", "a\nb"))).toEqual({ added: 0, removed: 0 });
    expect(diffLines(undefined, undefined)).toHaveLength(1);
  });

  it("acima do limite compara linha a linha por posição", () => {
    const grande = Array.from({ length: 2500 }, (_, i) => `linha ${i}`).join("\n");
    const alterado = grande.replace("linha 10\n", "mudou\n");
    const resumo = diffSummary(diffLines(grande, alterado));
    expect(resumo).toEqual({ added: 1, removed: 1 });
    expect(diffSummary(diffLines(grande, `${grande}\nextra`))).toEqual({ added: 1, removed: 0 });
  });
});
