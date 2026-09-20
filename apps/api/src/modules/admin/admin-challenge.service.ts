import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Challenge, TestCase } from "../../domain/types.js";

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
  .refine((tag) => /[\p{L}\p{N}]/u.test(tag), "Tag invalida.");

const challengePayloadSchema = z.object({
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
  testCases: z
    .array(testCaseSchema)
    .min(2, "Cadastre ao menos um caso publico e um caso oculto.")
    .max(50)
}).superRefine((payload, context) => {
  if (!payload.testCases.some((testCase) => testCase.isPublic)) {
    context.addIssue({
      code: "custom",
      path: ["testCases"],
      message: "Cadastre ao menos um caso de teste publico."
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
      throw new DomainError("Desafio nao encontrado.", 404);
    }
    return challenge;
  }

  async create(createdBy: string, input: unknown): Promise<Challenge> {
    const payload = challengePayloadSchema.parse(input);
    await this.ensureSlugAvailable(payload.slug);
    const challengeId = this.createId();
    const challenge: Challenge = {
      ...payload,
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
    const updated: Challenge = {
      ...current,
      ...payload,
      tags: deduplicateTags(payload.tags),
      isActive: payload.isActive ?? current.isActive,
      testCases: this.buildTestCases(challengeId, payload.testCases)
    };
    return this.store.updateChallenge(updated);
  }

  async remove(challengeId: string): Promise<Challenge> {
    await this.get(challengeId);
    return this.store.deactivateChallenge(challengeId);
  }

  private async ensureSlugAvailable(
    slug: string,
    currentChallengeId?: string
  ): Promise<void> {
    const existing = await this.store.findChallengeBySlug(slug);
    if (existing && existing.id !== currentChallengeId) {
      throw new DomainError("Slug de desafio ja utilizado.", 409);
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
