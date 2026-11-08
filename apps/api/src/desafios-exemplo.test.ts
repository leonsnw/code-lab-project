import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Challenge, SubmissionLanguage } from "./domain/types.js";
import { buildSeedData } from "./database/seed.js";
import { SubmissionEvaluationService } from "./modules/submissions/submission-evaluation.service.js";

// Pasta desafios/ na raiz, organizada como o catalogo:
// desafios/<NN-trilha>/<NN-modulo>/<slug>/. Para cada desafio, uma solucao
// correta por linguagem aceita e pelo menos uma tentativa de burla, com o
// veredito esperado na primeira linha de cada arquivo.
const examplesDir = join(dirname(fileURLToPath(import.meta.url)), "../../../desafios");
// A pasta nao e versionada (guarda as solucoes de referencia): sem ela, como num
// clone novo ou no CI, estes testes sao pulados em vez de falhar.
const hasExamples = existsSync(examplesDir);
const hasBwrap = spawnSync("bwrap", ["--version"]).status === 0;
const available: Record<SubmissionLanguage, boolean> = {
  javascript: true,
  c: hasBwrap && spawnSync("gcc", ["--version"]).status === 0,
  python: hasBwrap && spawnSync("python3", ["--version"]).status === 0
};
const EXTENSIONS: Record<SubmissionLanguage, string> = { javascript: "js", c: "c", python: "py" };
const LANGUAGE_BY_EXTENSION = Object.fromEntries(Object.entries(EXTENSIONS).map(([language, extension]) => [extension, language])) as Record<string, SubmissionLanguage>;

const evaluator = new SubmissionEvaluationService();
const { challenges, tracks } = buildSeedData();

// Numeracao a partir de 1, na ordem da trilha: 01-fundamentos/01-entrada-saida.
const numbered = (position: number, slug: string) => `${String(position + 1).padStart(2, "0")}-${slug}`;
const moduleDirs = new Map(
  tracks.flatMap((track) => track.modules.map((module) => [module.id, join(numbered(track.position, track.slug), numbered(module.position, module.slug))] as const))
);
const dirOf = (challenge: Challenge) => join(moduleDirs.get(challenge.moduleId ?? "") ?? "sem-modulo", challenge.slug);
const challengeBySlug = new Map(challenges.map((challenge) => [challenge.slug, challenge]));

function filesOf(slug: string, prefix: "solucao" | "burla") {
  const dir = join(examplesDir, dirOf(challengeBySlug.get(slug)!));
  return readdirSync(dir)
    .filter((file) => file.startsWith(`${prefix}.`))
    .map((file) => {
      const source = readFileSync(join(dir, file), "utf8");
      return {
        file,
        language: LANGUAGE_BY_EXTENSION[file.split(".").pop() ?? ""],
        source,
        verdict: source.match(/^(?:\/\/|#) Veredito esperado: (\w+)/)?.[1]
      };
    });
}

function judge(challenge: Challenge, language: SubmissionLanguage, sourceCode: string) {
  const entry = challenge.languages.find((item) => item.language === language)!;
  return evaluator.evaluate({
    language,
    sourceCode,
    sourceRules: entry.sourceRules,
    mode: challenge.mode,
    functionSpec: challenge.functionSpec,
    checker: challenge.checker,
    timeLimitMs: challenge.timeLimitMs,
    memoryLimitMb: challenge.memoryLimitMb,
    testCases: challenge.testCases
  });
}

describe.skipIf(!hasExamples)("pasta desafios/ com solucao e burla", () => {
  it("tem uma pasta para cada desafio do catalogo, dentro da trilha e do modulo dele", () => {
    const found = readdirSync(examplesDir).flatMap((track) =>
      readdirSync(join(examplesDir, track)).flatMap((module) =>
        readdirSync(join(examplesDir, track, module)).map((slug) => join(track, module, slug))
      )
    );
    expect(found.sort()).toEqual(challenges.map(dirOf).sort());
  });

  it("tem solucao para cada linguagem aceita e pelo menos uma burla", () => {
    for (const challenge of challenges) {
      const solutionLanguages = filesOf(challenge.slug, "solucao").map((item) => item.language).sort();
      expect(solutionLanguages, challenge.slug).toEqual(challenge.languages.map((entry) => entry.language).sort());
      expect(filesOf(challenge.slug, "burla").length, challenge.slug).toBeGreaterThan(0);
    }
  });

  it.concurrent.each(challenges.map((challenge) => challenge.slug))(
    "%s: solucoes aceitas e burlas reprovadas com o veredito anunciado",
    async (slug) => {
      const challenge = challenges.find((item) => item.slug === slug)!;

      for (const solution of filesOf(slug, "solucao")) {
        if (!available[solution.language]) continue;
        expect(solution.verdict, solution.file).toBe("accepted");
        const result = await judge(challenge, solution.language, solution.source);
        expect(
          { file: solution.file, status: result.status, failed: result.testResults.find((test) => !test.passed), error: result.errorMessage },
          solution.file
        ).toMatchObject({ status: "accepted" });
      }

      for (const cheat of filesOf(slug, "burla")) {
        if (!available[cheat.language]) continue;
        expect(cheat.verdict, cheat.file).not.toBe("accepted");
        const result = await judge(challenge, cheat.language, cheat.source);
        expect(result.status, cheat.file).toBe(cheat.verdict);

        if (cheat.verdict === "wrong_answer") {
          // A burla de verdade engana os exemplos publicos (Executar verde).
          const entry = challenge.languages.find((item) => item.language === cheat.language)!;
          const run = await evaluator.run({
            language: cheat.language,
            sourceCode: cheat.source,
            sourceRules: entry.sourceRules,
            mode: challenge.mode,
            functionSpec: challenge.functionSpec,
            checker: challenge.checker,
            cases: challenge.testCases
              .filter((testCase) => testCase.isPublic)
              .map((testCase) => ({ label: testCase.id, input: testCase.input, expectedOutput: testCase.expectedOutput }))
          });
          expect(run.cases.every((runCase) => runCase.passed), `${cheat.file} deveria passar nos exemplos`).toBe(true);
        }
      }
    },
    120000
  );
});
