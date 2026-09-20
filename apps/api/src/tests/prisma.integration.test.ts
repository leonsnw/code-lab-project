import { Difficulty as PrismaDifficulty, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaStore } from "../database/prisma-store.js";
import { AdminChallengeService } from "../modules/admin/admin-challenge.service.js";
import { AdminStatisticsService } from "../modules/admin/admin-statistics.service.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { BcryptPasswordHasher } from "../modules/auth/bcrypt-password-hasher.js";
import { JwtTokenService } from "../modules/auth/jwt-token.service.js";
import { CommentService } from "../modules/comments/comment.service.js";
import { RatingService } from "../modules/ratings/rating.service.js";
import { ScoreService } from "../modules/scoring/score.service.js";
import { SubmissionEvaluationService } from "../modules/submissions/submission-evaluation.service.js";
import { SubmissionService } from "../modules/submissions/submission.service.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "1";
const prisma = new PrismaClient();
const store = new PrismaStore(prisma);

const validSolution = `
const fs = require("fs");
const [a, b] = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
console.log(a + b);
`;

describe.skipIf(!runDatabaseTests)("integracao PostgreSQL", () => {
  beforeAll(async () => {
    await expect(
      prisma.challenge.findUnique({ where: { id: "challenge-soma" } })
    ).resolves.not.toBeNull();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persiste usuario com hash e sem senha pura", async () => {
    const userId = randomUUID();
    const email = `${userId}@codelab.local`;
    const passwordHash = await bcrypt.hash("123456", 10);

    try {
      const user = await store.createUser({
        id: userId,
        name: "Teste de Persistencia",
        email,
        passwordHash,
        role: "student"
      });
      const persisted = await prisma.user.findUnique({ where: { id: userId } });

      expect(user).not.toHaveProperty("passwordHash");
      expect(persisted?.passwordHash).not.toBe("123456");
      await expect(
        bcrypt.compare("123456", persisted?.passwordHash ?? "")
      ).resolves.toBe(true);
    } finally {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it("resolve cadastros concorrentes do mesmo e-mail como conflito", async () => {
    const email = `${randomUUID()}@codelab.local`;
    const service = new AuthService(
      store,
      new BcryptPasswordHasher(),
      new JwtTokenService("segredo-de-integracao-com-32-caracteres")
    );

    try {
      const results = await Promise.allSettled([
        service.register({ name: "Primeiro Usuario", email, password: "123456" }),
        service.register({ name: "Segundo Usuario", email, password: "123456" })
      ]);
      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        reason: { statusCode: 409, message: "E-mail ja cadastrado." }
      });
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  it("conclui submissoes concorrentes com uma unica premiacao", async () => {
    const userId = randomUUID();
    await store.createUser({
      id: userId,
      name: "Teste de Concorrencia",
      email: `${userId}@codelab.local`,
      passwordHash: await bcrypt.hash("123456", 10),
      role: "student"
    });
    const service = new SubmissionService(
      store,
      new SubmissionEvaluationService(),
      new ScoreService(store)
    );

    try {
      const submissions = await Promise.all([
        service.submit({
          userId,
          challengeSlug: "soma-de-dois-numeros",
          language: "javascript",
          sourceCode: validSolution
        }),
        service.submit({
          userId,
          challengeSlug: "soma-de-dois-numeros",
          language: "javascript",
          sourceCode: validSolution
        })
      ]);
      const score = await store.getScore(userId);
      const progress = await store.getUserProgress(userId);

      expect(
        submissions.map((submission) => submission.scoreAwarded).sort()
      ).toEqual([0, 100]);
      expect(score.totalPoints).toBe(100);
      expect(progress).toMatchObject({
        totalChallenges: 3,
        solvedChallenges: 1,
        pendingChallenges: 2
      });
      expect(progress.byDifficulty[0]).toEqual({
        difficulty: "easy",
        total: 2,
        solved: 1,
        percentage: 50
      });
      expect(submissions.every((submission) => submission.evaluatedAt)).toBe(
        true
      );
    } finally {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it("persiste comentarios e atualiza avaliacoes sem duplicar votos", async () => {
    const firstUserId = randomUUID();
    const secondUserId = randomUUID();
    const challengeId = randomUUID();
    const challengeSlug = `desafio-comunidade-${challengeId}`;
    await Promise.all([
      store.createUser({
        id: firstUserId,
        name: "Primeiro Avaliador",
        email: `${firstUserId}@codelab.local`,
        passwordHash: await bcrypt.hash("123456", 10),
        role: "student"
      }),
      store.createUser({
        id: secondUserId,
        name: "Segundo Avaliador",
        email: `${secondUserId}@codelab.local`,
        passwordHash: await bcrypt.hash("123456", 10),
        role: "student"
      })
    ]);
    await prisma.challenge.create({
      data: {
        id: challengeId,
        title: "Desafio temporario da comunidade",
        slug: challengeSlug,
        description: "Desafio isolado para o teste de integracao.",
        difficulty: PrismaDifficulty.EASY,
        points: 10,
        constraints: [],
        examples: [],
        createdBy: firstUserId
      }
    });
    const comments = new CommentService(store);
    const ratings = new RatingService(store);

    try {
      const created = await comments.create({
        challengeSlug,
        userId: firstUserId,
        content: "  Persistido no PostgreSQL.  "
      });
      await ratings.rate({
        challengeSlug,
        userId: firstUserId,
        value: 3
      });
      await ratings.rate({
        challengeSlug,
        userId: firstUserId,
        value: 5
      });
      await ratings.rate({
        challengeSlug,
        userId: secondUserId,
        value: 4
      });

      const [listed, summary, ratingCount] = await Promise.all([
        comments.list(challengeSlug),
        ratings.getSummary(challengeSlug, firstUserId),
        prisma.rating.count({
          where: { userId: { in: [firstUserId, secondUserId] } }
        })
      ]);

      expect(created).toMatchObject({
        content: "Persistido no PostgreSQL.",
        author: { id: firstUserId, name: "Primeiro Avaliador" }
      });
      expect(listed.some((comment) => comment.id === created.id)).toBe(true);
      expect(summary).toEqual({
        average: 4.5,
        total: 2,
        currentUserValue: 5
      });
      expect(ratingCount).toBe(2);
    } finally {
      await prisma.challenge.deleteMany({ where: { id: challengeId } });
      await prisma.user.deleteMany({
        where: { id: { in: [firstUserId, secondUserId] } }
      });
    }
  });

  it("cria, substitui relacionamentos e desativa desafios administrativos", async () => {
    const suffix = randomUUID();
    const slug = `desafio-admin-${suffix}`;
    const firstTag = `RF06 ${suffix}`;
    const secondTag = `Edicao ${suffix}`;
    const service = new AdminChallengeService(store);
    let challengeId: string | undefined;

    try {
      const created = await service.create("user-admin", {
        title: "Desafio administrativo temporario",
        slug,
        description: "Desafio usado para validar o CRUD administrativo real.",
        difficulty: "easy",
        points: 70,
        constraints: ["Restricao inicial."],
        tags: [firstTag],
        examples: [{ input: "1", output: "1" }],
        testCases: [
          {
            input: "1",
            expectedOutput: "1",
            isPublic: true,
            weight: 1
          },
          {
            input: "2",
            expectedOutput: "2",
            isPublic: false,
            weight: 1
          }
        ]
      });
      challengeId = created.id;

      const updated = await service.update(created.id, {
        title: "Desafio administrativo editado",
        slug,
        description: "Desafio editado atomicamente no banco PostgreSQL.",
        difficulty: "medium",
        points: 140,
        constraints: ["Restricao atualizada."],
        tags: [secondTag],
        examples: [{ input: "3", output: "3" }],
        testCases: [
          {
            input: "3",
            expectedOutput: "3",
            isPublic: true,
            weight: 2
          },
          {
            input: "4",
            expectedOutput: "4",
            isPublic: false,
            weight: 1
          }
        ]
      });
      const removed = await service.remove(created.id);
      const [persisted, publicChallenges, adminChallenges] = await Promise.all([
        prisma.challenge.findUnique({
          where: { id: created.id },
          include: { tags: { include: { tag: true } }, testCases: true }
        }),
        store.listChallenges(),
        service.list()
      ]);

      expect(updated).toMatchObject({
        title: "Desafio administrativo editado",
        difficulty: "medium",
        points: 140,
        tags: [secondTag]
      });
      expect(updated.testCases).toHaveLength(2);
      expect(removed.isActive).toBe(false);
      expect(persisted?.testCases).toHaveLength(2);
      expect(persisted?.tags.map((item) => item.tag.name)).toEqual([secondTag]);
      expect(publicChallenges.some((item) => item.id === created.id)).toBe(false);
      expect(
        adminChallenges.find((item) => item.id === created.id)?.isActive
      ).toBe(false);
    } finally {
      if (challengeId) {
        await prisma.challenge.deleteMany({ where: { id: challengeId } });
      }
      await prisma.tag.deleteMany({ where: { name: { in: [firstTag, secondTag] } } });
    }
  });

  it("calcula estatisticas administrativas com dados reais", async () => {
    const firstUserId = randomUUID();
    const secondUserId = randomUUID();
    const suffix = randomUUID();
    const slug = `estatisticas-${suffix}`;
    const tag = `Estatisticas ${suffix}`;
    const challengeService = new AdminChallengeService(store);
    const statisticsService = new AdminStatisticsService(store);
    const commentService = new CommentService(store);
    const ratingService = new RatingService(store);
    let challengeId: string | undefined;

    await Promise.all([
      store.createUser({
        id: firstUserId,
        name: "Participante Um",
        email: `${firstUserId}@codelab.local`,
        passwordHash: await bcrypt.hash("123456", 10),
        role: "student"
      }),
      store.createUser({
        id: secondUserId,
        name: "Participante Dois",
        email: `${secondUserId}@codelab.local`,
        passwordHash: await bcrypt.hash("123456", 10),
        role: "student"
      })
    ]);

    try {
      const challenge = await challengeService.create("user-admin", {
        title: "Desafio temporario de estatisticas",
        slug,
        description: "Desafio isolado para validar as estatisticas administrativas.",
        difficulty: "medium",
        points: 100,
        constraints: [],
        tags: [tag],
        examples: [],
        testCases: [
          {
            input: "1",
            expectedOutput: "1",
            isPublic: true,
            weight: 1
          },
          {
            input: "2",
            expectedOutput: "2",
            isPublic: false,
            weight: 1
          }
        ]
      });
      challengeId = challenge.id;
      const timestamp = new Date();
      await Promise.all([
        store.addSubmission({
          id: randomUUID(),
          userId: firstUserId,
          challengeId: challenge.id,
          language: "javascript",
          sourceCode: "console.log(0);",
          status: "wrong_answer",
          scoreAwarded: 0,
          submittedAt: timestamp,
          evaluatedAt: timestamp,
          testResults: []
        }),
        store.addSubmission({
          id: randomUUID(),
          userId: firstUserId,
          challengeId: challenge.id,
          language: "javascript",
          sourceCode: "console.log(1);",
          status: "accepted",
          scoreAwarded: 100,
          submittedAt: timestamp,
          evaluatedAt: timestamp,
          testResults: []
        }),
        store.addSubmission({
          id: randomUUID(),
          userId: secondUserId,
          challengeId: challenge.id,
          language: "javascript",
          sourceCode: "console.log(1);",
          status: "accepted",
          scoreAwarded: 100,
          submittedAt: timestamp,
          evaluatedAt: timestamp,
          testResults: []
        })
      ]);
      await commentService.create({
        challengeSlug: slug,
        userId: firstUserId,
        content: "Comentario para a estatistica."
      });
      await ratingService.rate({
        challengeSlug: slug,
        userId: firstUserId,
        value: 5
      });
      await ratingService.rate({
        challengeSlug: slug,
        userId: secondUserId,
        value: 3
      });

      const statistics = await statisticsService.get();
      const challengeStatistics = statistics.challenges.find(
        (item) => item.id === challenge.id
      );
      const firstUserStatistics = statistics.users.find(
        (item) => item.id === firstUserId
      );

      expect(challengeStatistics).toMatchObject({
        totalSubmissions: 3,
        acceptedSubmissions: 2,
        acceptanceRate: 66.7,
        participants: 2,
        solvers: 2,
        totalComments: 1,
        totalRatings: 2,
        averageRating: 4
      });
      expect(firstUserStatistics).toMatchObject({
        totalSubmissions: 2,
        acceptedSubmissions: 1,
        acceptanceRate: 50,
        solvedChallenges: 1
      });
    } finally {
      if (challengeId) {
        await prisma.challenge.deleteMany({ where: { id: challengeId } });
      }
      await prisma.user.deleteMany({
        where: { id: { in: [firstUserId, secondUserId] } }
      });
      await prisma.tag.deleteMany({ where: { name: tag } });
    }
  });

  it("mantem consultas comuns abaixo de dois segundos no PostgreSQL local", async () => {
    const startedAt = performance.now();

    const statisticsService = new AdminStatisticsService(store);
    const [
      challenges,
      ranking,
      progress,
      comments,
      rating,
      adminChallenges,
      statistics
    ] = await Promise.all([
      store.listChallenges(),
      store.getRanking(),
      store.getUserProgress("user-marina"),
      store.listComments("challenge-soma"),
      store.getRatingSummary("challenge-soma", "user-marina"),
      store.listAllChallenges(),
      statisticsService.get()
    ]);
    const durationMs = performance.now() - startedAt;

    expect(challenges).toHaveLength(3);
    expect(ranking.length).toBeGreaterThan(0);
    expect(progress.totalChallenges).toBe(3);
    expect(Array.isArray(comments)).toBe(true);
    expect(rating.total).toBeGreaterThanOrEqual(0);
    expect(adminChallenges.length).toBeGreaterThanOrEqual(challenges.length);
    expect(statistics.overview.totalChallenges).toBeGreaterThanOrEqual(3);
    expect(durationMs).toBeLessThan(2000);
  });
});
