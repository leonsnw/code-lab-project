import { describe, expect, it } from "vitest";
import { MAX_CASE_BYTES } from "./helpers.js";
import { buildCatalog } from "./index.js";

/**
 * "Lint" de conteúdo: todo desafio publicado precisa estar completo e bem
 * posicionado na trilha. A pasta desafios/ (solução e burla) é conferida em
 * desafios-exemplo.test.ts.
 */
const { tracks, challenges } = buildCatalog();
const modules = tracks.flatMap((track) => track.modules.map((module) => ({ ...module, track })));
const INTERVIEW_TRACK = "track-entrevistas";

/** Saída cresce exponencialmente com n (2^n − 1 movimentos): não cabem 12 casos ocultos distintos. */
const FEWER_HIDDEN_CASES = new Set(["ed-torre-de-hanoi"]);

/** Palavras que só aparecem sem acento por descuido (regra 4 do produto). */
const MISSING_ACCENT = /\b(nao|voce|funcao|funcoes|numeros?|possivel|posicao|posicoes|solucao|entao|tambem|sao|sera|indice|indices|ultimo|proximo|minimo|maximo|codigo|operacao|operacoes|informacao|memoria|recursao|ordenacao|comparacao|excecao)\b/i;

describe("lint de conteudo do catalogo", () => {
  it("atinge o tamanho minimo do produto", () => {
    expect(tracks.length).toBeGreaterThanOrEqual(4);
    expect(modules.length).toBeGreaterThanOrEqual(25);
    expect(challenges.length).toBeGreaterThanOrEqual(150);
  });

  it.each(challenges.map((challenge) => [challenge.slug, challenge] as const))("%s esta completo", (_slug, challenge) => {
    const publicCases = challenge.testCases.filter((testCase) => testCase.isPublic);
    const hiddenCases = challenge.testCases.filter((testCase) => !testCase.isPublic);

    expect(challenge.title.trim().length).toBeGreaterThan(3);
    expect(challenge.description.trim().length).toBeGreaterThanOrEqual(60);
    expect(challenge.constraints.length).toBeGreaterThan(0);
    expect(challenge.languages.length).toBeGreaterThan(0);
    expect(challenge.topic).not.toBe("");
    expect(challenge.subtopic).not.toBe("");
    expect(modules.some((module) => module.id === challenge.moduleId)).toBe(true);

    expect(publicCases.length).toBeGreaterThanOrEqual(2);
    expect(hiddenCases.length).toBeGreaterThanOrEqual(FEWER_HIDDEN_CASES.has(challenge.slug) ? 8 : 12);
    for (const testCase of challenge.testCases) {
      expect(Buffer.byteLength(testCase.expectedOutput), testCase.id).toBeLessThan(MAX_CASE_BYTES);
    }
    expect(new Set(challenge.testCases.map((testCase) => testCase.id)).size).toBe(challenge.testCases.length);

    if (challenge.mode === "function") expect(challenge.functionSpec).not.toBeNull();
    expect(challenge.hints.length).toBeGreaterThan(0);
    expect(challenge.editorial?.trim().length ?? 0).toBeGreaterThan(80);

    const texts = [challenge.title, challenge.description, ...challenge.constraints, ...challenge.hints, challenge.editorial ?? ""];
    for (const text of texts) {
      // Blocos de código e saídas literais entre aspas podem ficar sem acento.
      const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "").replace(/"[^"\n]*"/g, "");
      expect(prose.match(MISSING_ACCENT)?.[0] ?? null, `palavra sem acento em ${challenge.slug}: "${prose.slice(0, 60)}..."`).toBeNull();
    }

    const module = modules.find((item) => item.id === challenge.moduleId)!;
    if (module.track.id === INTERVIEW_TRACK) {
      expect(challenge.hints).toHaveLength(3);
      expect(challenge.complexity).not.toBeNull();
      expect(challenge.followUps.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(modules.map((module) => [module.slug, module] as const))("modulo %s tem licao, ordem continua e um chefe no fim", (_slug, module) => {
    const items = challenges.filter((challenge) => challenge.moduleId === module.id).sort((a, b) => a.position - b.position);
    expect(module.lessons.length).toBeGreaterThanOrEqual(1);
    for (const lesson of module.lessons) {
      expect(lesson.summary.trim().length).toBeGreaterThan(10);
      expect(lesson.content.length).toBeGreaterThan(1200);
    }
    expect(items.length).toBeGreaterThanOrEqual(module.track.id === INTERVIEW_TRACK ? 2 : 4);
    expect(items.map((challenge) => challenge.position)).toEqual(items.map((_, index) => index));
    expect(items.filter((challenge) => challenge.isBoss).map((challenge) => challenge.slug)).toEqual([items[items.length - 1].slug]);
  });

  it("nao repete slugs de licao", () => {
    const slugs = modules.flatMap((module) => module.lessons.map((lesson) => lesson.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
