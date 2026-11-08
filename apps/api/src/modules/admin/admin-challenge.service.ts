import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Challenge, ChallengeLanguage, TestCase } from "../../domain/types.js";

const exampleSchema = z.object({
  input: z.string().max(10000),
  output: z.string().max(10000)
});

const testCaseSchema = z.object({
  input: z.string().max(10000),
  expectedOutput: z.string().max(10000),
  isPublic: z.boolean(),
  weight: z.number().int().min(1).max(100)
});

const tagSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .refine((tag) => /[\p{L}\p{N}]/u.test(tag), "Tag inválida.");

const ruleMessageSchema = z.string().trim().min(3).max(300);

const regexSchema = z
  .string()
  .min(1)
  .max(300)
  .refine((pattern) => {
    try {
      new RegExp(pattern, "m");
      return true;
    } catch {
      return false;
    }
  }, "Expressão regular inválida.");

const sourceRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("forbid"), pattern: regexSchema, message: ruleMessageSchema }),
  z.object({ kind: z.literal("require"), pattern: regexSchema, message: ruleMessageSchema }),
  z.object({ kind: z.literal("recursion"), message: ruleMessageSchema, minDepth: z.number().int().min(2).max(100000).optional() })
]);

const languageSchema = z.enum(["javascript", "c", "python"]);

const valueTypeSchema = z.enum(["int", "long", "double", "bool", "string", "int[]", "double[]", "string[]", "int[][]", "list", "tree"]);
const identifierSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Nome inválido para função ou parâmetro.");

const functionSpecSchema = z.object({
  name: identifierSchema,
  params: z.array(z.object({ name: identifierSchema, type: valueTypeSchema })).max(8),
  returns: valueTypeSchema,
  cycleParam: identifierSchema.optional()
});

const checkerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exact") }),
  z.object({ kind: z.literal("tolerance"), epsilon: z.number().positive().max(1) }),
  z.object({ kind: z.literal("unordered-lines") }),
  z.object({ kind: z.literal("unordered-tokens") }),
  z.object({ kind: z.literal("custom"), code: z.string().min(10).max(5000) })
]);

const challengeLanguageSchema = z.object({
  language: languageSchema,
  sourceRules: z.array(sourceRuleSchema).max(20).default([]),
  starterCode: z.string().max(5000).optional()
});

export const challengePayloadSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(5000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  points: z.number().int().min(1).max(10000),
  constraints: z.array(z.string().trim().min(1).max(500)).max(20),
  tags: z.array(tagSchema).min(1).max(10),
  examples: z.array(exampleSchema).max(10),
  // Formato antigo (uma linguagem) continua aceito e é convertido em `languages`.
  language: languageSchema.optional(),
  sourceRules: z.array(sourceRuleSchema).max(20).optional(),
  languages: z.array(challengeLanguageSchema).min(1).max(3).optional(),
  mode: z.enum(["stdio", "function"]).default("stdio"),
  functionSpec: functionSpecSchema.nullable().default(null),
  checker: checkerSchema.default({ kind: "exact" }),
  timeLimitMs: z.number().int().min(100).max(10000).nullable().default(null),
  memoryLimitMb: z.number().int().min(16).max(1024).nullable().default(null),
  topic: z.string().trim().min(2).max(60).default("Lógica de Programação"),
  subtopic: z.string().trim().max(60).default(""),
  moduleId: z.string().trim().min(1).max(120).nullable().default(null),
  position: z.number().int().min(0).max(10000).default(0),
  isBoss: z.boolean().default(false),
  hints: z.array(z.string().trim().min(3).max(1000)).max(5).default([]),
  editorial: z.string().trim().max(20000).nullable().default(null),
  complexity: z.object({ time: z.string().trim().min(1).max(40), space: z.string().trim().min(1).max(40) }).nullable().default(null),
  followUps: z.array(z.string().trim().min(3).max(500)).max(6).default([]),
  /** Rascunho (false) fica visível só para administradores. */
  isPublished: z.boolean().default(true),
  testCases: z
    .array(testCaseSchema)
    .min(2, "Cadastre ao menos um caso público e um caso oculto.")
    .max(50)
}).superRefine((payload, context) => {
  if (payload.mode === "function" && !payload.functionSpec) {
    context.addIssue({ code: "custom", path: ["functionSpec"], message: "Desafios no modo função precisam da assinatura da função." });
  }
  if (!payload.testCases.some((testCase) => testCase.isPublic)) {
    context.addIssue({
      code: "custom",
      path: ["testCases"],
      message: "Cadastre ao menos um caso de teste público."
    });
  }
  if (!payload.testCases.some((testCase) => !testCase.isPublic)) {
    context.addIssue({
      code: "custom",
      path: ["testCases"],
      message: "Cadastre ao menos um caso de teste oculto."
    });
  }
});

const updateChallengePayloadSchema = challengePayloadSchema.extend({
  isActive: z.boolean().optional()
});

export class AdminChallengeService {
  constructor(
    private readonly store: CodeLabStore,
    private readonly createId: () => string = randomUUID
  ) {}

  async list(): Promise<Challenge[]> {
    return this.store.listAllChallenges();
  }

  async get(challengeId: string): Promise<Challenge> {
    const challenge = await this.store.findChallengeById(challengeId);
    if (!challenge) {
      throw new DomainError("Desafio não encontrado.", 404);
    }
    return challenge;
  }

  async create(createdBy: string, input: unknown): Promise<Challenge> {
    const payload = challengePayloadSchema.parse(input);
    await this.ensureSlugAvailable(payload.slug);
    const challengeId = this.createId();
    const { language: _language, sourceRules: _sourceRules, languages: _languages, ...rest } = payload;
    const challenge: Challenge = {
      ...rest,
      ...(await this.placement(payload)),
      languages: resolveLanguages(payload),
      tags: deduplicateTags(payload.tags),
      id: challengeId,
      createdBy,
      isActive: true,
      testCases: this.buildTestCases(challengeId, payload.testCases)
    };
    return this.store.createChallenge(challenge);
  }

  async update(challengeId: string, input: unknown): Promise<Challenge> {
    const current = await this.get(challengeId);
    const payload = updateChallengePayloadSchema.parse(input);
    await this.ensureSlugAvailable(payload.slug, challengeId);
    // Campos que o formulário não enviou mantêm o valor atual (os defaults do
    // schema não podem apagar dicas, solução comentada etc. numa edição).
    const provided = new Set(Object.keys((input ?? {}) as Record<string, unknown>));
    const keep = <K extends keyof Challenge>(key: K, value: Challenge[K]) => (provided.has(key) ? value : current[key]);
    const languagesProvided = provided.has("languages") || provided.has("language") || provided.has("sourceRules");
    const updated: Challenge = {
      ...current,
      title: payload.title,
      slug: payload.slug,
      description: payload.description,
      difficulty: payload.difficulty,
      points: payload.points,
      constraints: payload.constraints,
      examples: payload.examples,
      languages: languagesProvided ? resolveLanguages(payload, current.languages) : current.languages,
      mode: keep("mode", payload.mode),
      functionSpec: keep("functionSpec", payload.functionSpec),
      checker: keep("checker", payload.checker),
      timeLimitMs: keep("timeLimitMs", payload.timeLimitMs),
      memoryLimitMb: keep("memoryLimitMb", payload.memoryLimitMb),
      topic: keep("topic", payload.topic),
      subtopic: keep("subtopic", payload.subtopic),
      moduleId: keep("moduleId", payload.moduleId),
      position: keep("position", payload.position),
      isBoss: keep("isBoss", payload.isBoss),
      hints: keep("hints", payload.hints),
      editorial: keep("editorial", payload.editorial),
      complexity: keep("complexity", payload.complexity),
      followUps: keep("followUps", payload.followUps),
      isPublished: keep("isPublished", payload.isPublished),
      tags: deduplicateTags(payload.tags),
      isActive: payload.isActive ?? current.isActive,
      testCases: this.buildTestCases(challengeId, payload.testCases)
    };
    Object.assign(updated, await this.placement(updated));
    return this.store.updateChallenge(updated);
  }

  async remove(challengeId: string): Promise<Challenge> {
    await this.get(challengeId);
    return this.store.deactivateChallenge(challengeId);
  }

  /** Com módulo definido, assunto e subtema vêm da trilha e do módulo. */
  private async placement(challenge: { moduleId: string | null; topic: string; subtopic: string }) {
    if (!challenge.moduleId) {
      return { moduleId: null, topic: challenge.topic, subtopic: challenge.subtopic };
    }
    const tracks = await this.store.listTracks();
    for (const track of tracks) {
      const module = track.modules.find((item) => item.id === challenge.moduleId);
      if (module) return { moduleId: module.id, topic: track.title, subtopic: module.title };
    }
    throw new DomainError("Módulo de trilha não encontrado.", 400);
  }

  private async ensureSlugAvailable(
    slug: string,
    currentChallengeId?: string
  ): Promise<void> {
    const existing = await this.store.findChallengeBySlug(slug);
    if (existing && existing.id !== currentChallengeId) {
      throw new DomainError("Slug de desafio já utilizado.", 409);
    }
  }

  private buildTestCases(
    challengeId: string,
    testCases: Array<{
      input: string;
      expectedOutput: string;
      isPublic: boolean;
      weight: number;
    }>
  ): TestCase[] {
    return testCases.map((testCase) => ({
      ...testCase,
      id: this.createId(),
      challengeId
    }));
  }
}

function deduplicateTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    const key = tag.toLocaleLowerCase("pt-BR");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function resolveLanguages(
  payload: { language?: ChallengeLanguage["language"]; sourceRules?: ChallengeLanguage["sourceRules"]; languages?: ChallengeLanguage[] },
  fallback: ChallengeLanguage[] = [{ language: "javascript", sourceRules: [] }]
): ChallengeLanguage[] {
  if (payload.languages?.length) {
    const seen = new Set<string>();
    return payload.languages.filter((entry) => !seen.has(entry.language) && seen.add(entry.language));
  }
  if (payload.language || payload.sourceRules) {
    return [{ language: payload.language ?? fallback[0]?.language ?? "javascript", sourceRules: payload.sourceRules ?? [] }];
  }
  return fallback;
}
