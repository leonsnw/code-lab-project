import { describe, expect, it } from "vitest";
import { InMemoryStore } from "../../database/in-memory-store.js";
import { ScoreService } from "./score.service.js";

describe("ScoreService", () => {
  it("concede os pontos integrais na primeira resolucao", () => {
    const service = new ScoreService(new InMemoryStore());

    expect(service.calculateAward(100, false)).toBe(100);
  });

  it("nao concede pontos quando o desafio ja foi resolvido", () => {
    const service = new ScoreService(new InMemoryStore());

    expect(service.calculateAward(100, true)).toBe(0);
  });

  it("rejeita pontuacao nula, negativa ou fracionada", () => {
    const service = new ScoreService(new InMemoryStore());

    expect(() => service.calculateAward(0, false)).toThrow("inteiro positivo");
    expect(() => service.calculateAward(-10, false)).toThrow("inteiro positivo");
    expect(() => service.calculateAward(10.5, false)).toThrow("inteiro positivo");
  });
});
