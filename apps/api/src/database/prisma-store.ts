import {
  Difficulty as PrismaDifficulty,
  ExecutionStatus as PrismaExecutionStatus,
  Prisma,
  PrismaClient,
  SubmissionLanguage as PrismaSubmissionLanguage,
  SubmissionStatus as PrismaSubmissionStatus,
  UserRole as PrismaUserRole
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { DomainError } from "../common/domain-error.js";
import { calculateScoreAward } from "../domain/scoring.js";
import { buildUserProgress } from "../domain/progress.js";
import type { AdminStatisticsData } from "../domain/admin-statistics.js";
import type {
  Challenge,
  ChallengeExample,
  Comment,
  CreateUserInput,
  Difficulty,
  RankingEntry,
  Rating,
  RatingSummary,
  ScoreSummary,
  Submission,
  SubmissionLanguage,
  SubmissionStatus,
  SubmissionTestResult,
  User,
  UserCredentials,
  UserProgress,
  UserRole
} from "../domain/types.js";
import type {
  AddCommentInput,
  CodeLabStore,
  CompleteSubmissionInput,
  UpsertRatingInput
} from "./codelab-store.js";

const challengeInclude = {
  tags: {
    include: {
      tag: true
    }
  },
  testCases: {
    orderBy: {
      id: "asc" as const
    }
  }
};

type PrismaChallengeWithRelations = Prisma.ChallengeGetPayload<{
  include: typeof challengeInclude;
}>;

export class PrismaStore implements CodeLabStore {
  constructor(private readonly prisma = new PrismaClient()) {}

  async findUserById(userId: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    return user ? mapUser(user) : undefined;
  }

  async findUserCredentialsByEmail(
    email: string
  ): Promise<UserCredentials | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    return user ? mapUserCredentials(user) : undefined;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    try {
      const user = await this.prisma.user.create({
        data: {
          id: input.id,
          name: input.name,
          email: input.email,
          passwordHash: input.passwordHash,
          role: toPrismaUserRole(input.role),
          score: {
            create: {
              id: randomUUID(),
              totalPoints: 0
            }
          }
        }
      });

      return mapUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new DomainError("E-mail ja cadastrado.", 409);
      }
      throw error;
    }
  }

  async listChallenges(difficulty?: Difficulty): Promise<Challenge[]> {
    const challenges = await this.prisma.challenge.findMany({
      where: {
        isActive: true,
        difficulty: difficulty ? toPrismaDifficulty(difficulty) : undefined
      },
      include: challengeInclude,
      orderBy: [{ difficulty: "asc" }, { title: "asc" }]
    });

    return challenges.map(mapChallenge);
  }

  async listAllChallenges(): Promise<Challenge[]> {
    const challenges = await this.prisma.challenge.findMany({
      include: challengeInclude,
      orderBy: [{ isActive: "desc" }, { title: "asc" }]
    });

    return challenges.map(mapChallenge);
  }

  async findChallengeById(challengeId: string): Promise<Challenge | undefined> {
    const challenge = await this.prisma.challenge.findUnique({
      where: { id: challengeId },
      include: challengeInclude
    });
    return challenge ? mapChallenge(challenge) : undefined;
  }

  async findChallengeBySlug(slug: string): Promise<Challenge | undefined> {
    const challenge = await this.loadChallengeBySlug(slug);
    return challenge ? mapChallenge(challenge) : undefined;
  }

  async createChallenge(challenge: Challenge): Promise<Challenge> {
    try {
      const created = await this.prisma.challenge.create({
        data: buildChallengeCreateData(challenge),
        include: challengeInclude
      });
      return mapChallenge(created);
    } catch (error) {
      throw mapChallengeWriteError(error);
    }
  }

  async updateChallenge(challenge: Challenge): Promise<Challenge> {
    try {
      const updated = await this.prisma.challenge.update({
        where: { id: challenge.id },
        data: {
          title: challenge.title,
          slug: challenge.slug,
          description: challenge.description,
          difficulty: toPrismaDifficulty(challenge.difficulty),
          points: challenge.points,
          constraints: challenge.constraints,
          examples: challenge.examples as unknown as Prisma.InputJsonValue,
          isActive: challenge.isActive,
          tags: {
            deleteMany: {},
            create: buildChallengeTags(challenge.tags)
          },
          testCases: {
            deleteMany: {},
            create: buildTestCases(challenge)
          }
        },
        include: challengeInclude
      });
      return mapChallenge(updated);
    } catch (error) {
      throw mapChallengeWriteError(error);
    }
  }

  async deactivateChallenge(challengeId: string): Promise<Challenge> {
    try {
      const challenge = await this.prisma.challenge.update({
        where: { id: challengeId },
        data: { isActive: false },
        include: challengeInclude
      });
      return mapChallenge(challenge);
    } catch (error) {
      throw mapChallengeWriteError(error);
    }
  }

  async addSubmission(submission: Submission): Promise<void> {
    await this.prisma.submission.create({
      data: {
        id: submission.id,
        userId: submission.userId,
        challengeId: submission.challengeId,
        language: toPrismaSubmissionLanguage(submission.language),
        sourceCode: submission.sourceCode,
        status: toPrismaSubmissionStatus(submission.status),
        scoreAwarded: submission.scoreAwarded,
        submittedAt: submission.submittedAt,
        evaluatedAt: submission.evaluatedAt,
        testResults: {
          create: submission.testResults.map((result) => ({
            id: randomUUID(),
            testCaseId: result.testCaseId,
            executionStatus: toPrismaExecutionStatus(result.executionStatus),
            isPublic: result.isPublic,
            passed: result.passed,
            input: result.input,
            expectedOutput: result.expectedOutput,
            actualOutput: result.actualOutput,
            error: result.error,
            durationMs: result.durationMs
          }))
        }
      }
    });
  }

  async completeSubmission(
    input: CompleteSubmissionInput
  ): Promise<Submission> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const current = await transaction.submission.findUnique({
              where: { id: input.submissionId },
              include: { testResults: true }
            });
            if (!current) {
              throw new DomainError("Submissao nao encontrada.", 404);
            }
            if (current.status !== PrismaSubmissionStatus.PENDING) {
              return mapSubmission(current);
            }

            const alreadySolved =
              input.status === "accepted" &&
              (await transaction.submission.count({
                where: {
                  id: { not: current.id },
                  userId: current.userId,
                  challengeId: current.challengeId,
                  status: PrismaSubmissionStatus.ACCEPTED
                }
              })) > 0;
            const scoreAwarded =
              input.status === "accepted"
                ? calculateScoreAward(input.challengePoints, alreadySolved)
                : 0;

            const completed = await transaction.submission.update({
              where: { id: current.id },
              data: {
                status: toPrismaSubmissionStatus(input.status),
                scoreAwarded,
                evaluatedAt: input.evaluatedAt,
                testResults: {
                  create: input.testResults.map((result) => ({
                    id: randomUUID(),
                    testCaseId: result.testCaseId,
                    executionStatus: toPrismaExecutionStatus(
                      result.executionStatus
                    ),
                    isPublic: result.isPublic,
                    passed: result.passed,
                    input: result.input,
                    expectedOutput: result.expectedOutput,
                    actualOutput: result.actualOutput,
                    error: result.error,
                    durationMs: result.durationMs
                  }))
                }
              },
              include: { testResults: true }
            });

            if (scoreAwarded > 0) {
              await transaction.score.upsert({
                where: { userId: current.userId },
                create: {
                  id: randomUUID(),
                  userId: current.userId,
                  totalPoints: scoreAwarded
                },
                update: {
                  totalPoints: { increment: scoreAwarded }
                }
              });
            }

            return mapSubmission(completed);
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable
          }
        );
      } catch (error) {
        if (isTransactionConflict(error) && attempt < 3) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("Nao foi possivel concluir a submissao.");
  }

  async listSubmissions(
    userId?: string,
    challengeId?: string,
    status?: SubmissionStatus
  ): Promise<Submission[]> {
    const submissions = await this.prisma.submission.findMany({
      where: {
        userId,
        challengeId,
        status: status ? toPrismaSubmissionStatus(status) : undefined
      },
      include: {
        testResults: true
      },
      orderBy: {
        submittedAt: "desc"
      }
    });

    return submissions.map(mapSubmission);
  }

  async getScore(userId: string): Promise<ScoreSummary> {
    const score = await this.prisma.score.upsert({
      where: { userId },
      create: {
        id: randomUUID(),
        userId,
        totalPoints: 0
      },
      update: {}
    });

    const solvedChallengeIds = await this.findSolvedChallengeIds(userId);

    return {
      userId,
      totalPoints: score.totalPoints,
      solvedChallengeIds,
      updatedAt: score.updatedAt
    };
  }

  async getUserProgress(userId: string): Promise<UserProgress> {
    const [challenges, solvedChallengeIds] = await Promise.all([
      this.prisma.challenge.findMany({
        where: { isActive: true },
        select: { id: true, difficulty: true }
      }),
      this.findSolvedChallengeIds(userId)
    ]);

    return buildUserProgress(
      challenges.map((challenge) => ({
        id: challenge.id,
        difficulty: fromPrismaDifficulty(challenge.difficulty)
      })),
      solvedChallengeIds
    );
  }

  async getRanking(): Promise<RankingEntry[]> {
    const [scores, solvedPairs] = await Promise.all([
      this.prisma.score.findMany({
        include: { user: true },
        orderBy: { totalPoints: "desc" }
      }),
      this.prisma.submission.findMany({
        where: { status: PrismaSubmissionStatus.ACCEPTED },
        select: { userId: true, challengeId: true },
        distinct: ["userId", "challengeId"]
      })
    ]);
    const solvedByUser = new Map<string, number>();
    for (const pair of solvedPairs) {
      solvedByUser.set(pair.userId, (solvedByUser.get(pair.userId) ?? 0) + 1);
    }

    return scores
      .map((score) => ({
        userId: score.userId,
        name: score.user.name,
        totalPoints: score.totalPoints,
        solvedChallenges: solvedByUser.get(score.userId) ?? 0
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }

  async listComments(challengeId: string): Promise<Comment[]> {
    const comments = await this.prisma.comment.findMany({
      where: { challengeId },
      include: {
        user: {
          select: { id: true, name: true }
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    });

    return comments.map(mapComment);
  }

  async addComment(input: AddCommentInput): Promise<Comment> {
    const comment = await this.prisma.comment.create({
      data: input,
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    return mapComment(comment);
  }

  async getRatingSummary(
    challengeId: string,
    userId?: string
  ): Promise<RatingSummary> {
    const [aggregate, current] = await Promise.all([
      this.prisma.rating.aggregate({
        where: { challengeId },
        _avg: { value: true },
        _count: { _all: true }
      }),
      userId
        ? this.prisma.rating.findUnique({
            where: {
              userId_challengeId: { userId, challengeId }
            },
            select: { value: true }
          })
        : undefined
    ]);

    return {
      average: Number((aggregate._avg.value ?? 0).toFixed(1)),
      total: aggregate._count._all,
      currentUserValue: current?.value ?? null
    };
  }

  async upsertRating(input: UpsertRatingInput): Promise<Rating> {
    const rating = await this.prisma.rating.upsert({
      where: {
        userId_challengeId: {
          userId: input.userId,
          challengeId: input.challengeId
        }
      },
      create: input,
      update: {
        value: input.value,
        updatedAt: input.updatedAt
      }
    });

    return mapRating(rating);
  }

  async getAdminStatisticsData(): Promise<AdminStatisticsData> {
    const [users, challenges, submissions, comments, ratings] =
      await Promise.all([
        this.prisma.user.findMany({
          select: {
            id: true,
            name: true,
            role: true,
            score: { select: { totalPoints: true } }
          }
        }),
        this.prisma.challenge.findMany({
          select: {
            id: true,
            title: true,
            slug: true,
            difficulty: true,
            isActive: true
          }
        }),
        this.prisma.submission.findMany({
          select: { challengeId: true, userId: true, status: true }
        }),
        this.prisma.comment.findMany({ select: { challengeId: true } }),
        this.prisma.rating.findMany({
          select: { challengeId: true, value: true }
        })
      ]);

    return {
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        role: fromPrismaUserRole(user.role),
        totalPoints: user.score?.totalPoints ?? 0
      })),
      challenges: challenges.map((challenge) => ({
        ...challenge,
        difficulty: fromPrismaDifficulty(challenge.difficulty)
      })),
      submissions: submissions.map((submission) => ({
        ...submission,
        status: fromPrismaSubmissionStatus(submission.status)
      })),
      comments,
      ratings
    };
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async findSolvedChallengeIds(userId: string): Promise<string[]> {
    const submissions = await this.prisma.submission.findMany({
      where: {
        userId,
        status: PrismaSubmissionStatus.ACCEPTED
      },
      select: {
        challengeId: true
      },
      distinct: ["challengeId"]
    });

    return submissions.map((submission) => submission.challengeId);
  }

  private async loadChallengeBySlug(slug: string) {
    return this.prisma.challenge.findUnique({
      where: { slug },
      include: challengeInclude
    });
  }
}

function mapUser(user: {
  id: string;
  name: string;
  email: string;
  role: PrismaUserRole;
}): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: fromPrismaUserRole(user.role)
  };
}

function mapUserCredentials(user: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: PrismaUserRole;
}): UserCredentials {
  return {
    ...mapUser(user),
    passwordHash: user.passwordHash
  };
}

function mapChallenge(
  challenge: NonNullable<PrismaChallengeWithRelations>
): Challenge {
  return {
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    difficulty: fromPrismaDifficulty(challenge.difficulty),
    points: challenge.points,
    description: challenge.description,
    constraints: challenge.constraints,
    tags: challenge.tags.map((challengeTag) => challengeTag.tag.name),
    examples: mapExamples(challenge.examples),
    testCases: challenge.testCases.map((testCase) => ({
      id: testCase.id,
      challengeId: testCase.challengeId,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      isPublic: testCase.isPublic,
      weight: testCase.weight
    })),
    isActive: challenge.isActive,
    createdBy: challenge.createdBy
  };
}

function mapSubmission(submission: {
  id: string;
  userId: string;
  challengeId: string;
  language: PrismaSubmissionLanguage;
  sourceCode: string;
  status: PrismaSubmissionStatus;
  scoreAwarded: number;
  submittedAt: Date;
  evaluatedAt: Date | null;
  testResults: Array<{
    testCaseId: string;
    executionStatus: PrismaExecutionStatus;
    isPublic: boolean;
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    error: string | null;
    durationMs: number;
  }>;
}): Submission {
  return {
    id: submission.id,
    userId: submission.userId,
    challengeId: submission.challengeId,
    language: fromPrismaSubmissionLanguage(submission.language),
    sourceCode: submission.sourceCode,
    status: fromPrismaSubmissionStatus(submission.status),
    scoreAwarded: submission.scoreAwarded,
    submittedAt: submission.submittedAt,
    evaluatedAt: submission.evaluatedAt,
    testResults: submission.testResults.map(mapSubmissionTestResult)
  };
}

function mapSubmissionTestResult(result: {
  testCaseId: string;
  executionStatus: PrismaExecutionStatus;
  isPublic: boolean;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error: string | null;
  durationMs: number;
}): SubmissionTestResult {
  return {
    testCaseId: result.testCaseId,
    executionStatus: fromPrismaExecutionStatus(result.executionStatus),
    isPublic: result.isPublic,
    passed: result.passed,
    input: result.input,
    expectedOutput: result.expectedOutput,
    actualOutput: result.actualOutput,
    error: result.error ?? undefined,
    durationMs: result.durationMs
  };
}

function mapComment(comment: {
  id: string;
  userId: string;
  challengeId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string };
}): Comment {
  return {
    id: comment.id,
    userId: comment.userId,
    challengeId: comment.challengeId,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.user
  };
}

function mapRating(rating: {
  id: string;
  userId: string;
  challengeId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}): Rating {
  return rating;
}

function buildChallengeCreateData(
  challenge: Challenge
): Prisma.ChallengeCreateInput {
  return {
    id: challenge.id,
    title: challenge.title,
    slug: challenge.slug,
    description: challenge.description,
    difficulty: toPrismaDifficulty(challenge.difficulty),
    points: challenge.points,
    constraints: challenge.constraints,
    examples: challenge.examples as unknown as Prisma.InputJsonValue,
    isActive: challenge.isActive,
    creator: { connect: { id: challenge.createdBy } },
    tags: { create: buildChallengeTags(challenge.tags) },
    testCases: { create: buildTestCases(challenge) }
  };
}

function buildChallengeTags(tags: string[]) {
  return tags.map((name) => {
    const slug = toTagSlug(name);
    return {
      tag: {
        connectOrCreate: {
          where: { slug },
          create: { id: randomUUID(), name, slug }
        }
      }
    };
  });
}

function buildTestCases(challenge: Challenge) {
  return challenge.testCases.map((testCase) => ({
    id: testCase.id,
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    isPublic: testCase.isPublic,
    weight: testCase.weight
  }));
}

function toTagSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapChallengeWriteError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new DomainError("Slug de desafio ja utilizado.", 409);
    }
    if (error.code === "P2025") {
      return new DomainError("Desafio nao encontrado.", 404);
    }
  }
  return error;
}

function mapExamples(value: unknown): ChallengeExample[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is ChallengeExample =>
        typeof item === "object" &&
        item !== null &&
        "input" in item &&
        "output" in item &&
        typeof item.input === "string" &&
        typeof item.output === "string"
    )
    .map((item) => ({
      input: item.input,
      output: item.output
    }));
}

function toPrismaDifficulty(difficulty: Difficulty): PrismaDifficulty {
  const map = {
    easy: PrismaDifficulty.EASY,
    medium: PrismaDifficulty.MEDIUM,
    hard: PrismaDifficulty.HARD
  } satisfies Record<Difficulty, PrismaDifficulty>;
  return map[difficulty];
}

function fromPrismaDifficulty(difficulty: PrismaDifficulty): Difficulty {
  const map = {
    [PrismaDifficulty.EASY]: "easy",
    [PrismaDifficulty.MEDIUM]: "medium",
    [PrismaDifficulty.HARD]: "hard"
  } satisfies Record<PrismaDifficulty, Difficulty>;
  return map[difficulty];
}

function fromPrismaUserRole(role: PrismaUserRole): UserRole {
  const map = {
    [PrismaUserRole.STUDENT]: "student",
    [PrismaUserRole.ADMIN]: "admin"
  } satisfies Record<PrismaUserRole, UserRole>;
  return map[role];
}

function toPrismaUserRole(role: UserRole): PrismaUserRole {
  const map = {
    student: PrismaUserRole.STUDENT,
    admin: PrismaUserRole.ADMIN
  } satisfies Record<UserRole, PrismaUserRole>;
  return map[role];
}

function toPrismaSubmissionLanguage(
  language: SubmissionLanguage
): PrismaSubmissionLanguage {
  const map = {
    javascript: PrismaSubmissionLanguage.JAVASCRIPT
  } satisfies Record<SubmissionLanguage, PrismaSubmissionLanguage>;
  return map[language];
}

function fromPrismaSubmissionLanguage(
  language: PrismaSubmissionLanguage
): SubmissionLanguage {
  const map = {
    [PrismaSubmissionLanguage.JAVASCRIPT]: "javascript"
  } satisfies Record<PrismaSubmissionLanguage, SubmissionLanguage>;
  return map[language];
}

function toPrismaSubmissionStatus(
  status: SubmissionStatus
): PrismaSubmissionStatus {
  const map = {
    pending: PrismaSubmissionStatus.PENDING,
    accepted: PrismaSubmissionStatus.ACCEPTED,
    wrong_answer: PrismaSubmissionStatus.WRONG_ANSWER,
    runtime_error: PrismaSubmissionStatus.RUNTIME_ERROR,
    timeout: PrismaSubmissionStatus.TIMEOUT
  } satisfies Record<SubmissionStatus, PrismaSubmissionStatus>;
  return map[status];
}

function fromPrismaSubmissionStatus(
  status: PrismaSubmissionStatus
): SubmissionStatus {
  const map = {
    [PrismaSubmissionStatus.PENDING]: "pending",
    [PrismaSubmissionStatus.ACCEPTED]: "accepted",
    [PrismaSubmissionStatus.WRONG_ANSWER]: "wrong_answer",
    [PrismaSubmissionStatus.RUNTIME_ERROR]: "runtime_error",
    [PrismaSubmissionStatus.TIMEOUT]: "timeout"
  } satisfies Record<PrismaSubmissionStatus, SubmissionStatus>;
  return map[status];
}

function isTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function toPrismaExecutionStatus(
  status: SubmissionTestResult["executionStatus"]
): PrismaExecutionStatus {
  const map = {
    completed: PrismaExecutionStatus.COMPLETED,
    runtime_error: PrismaExecutionStatus.RUNTIME_ERROR,
    timeout: PrismaExecutionStatus.TIMEOUT
  } satisfies Record<SubmissionTestResult["executionStatus"], PrismaExecutionStatus>;
  return map[status];
}

function fromPrismaExecutionStatus(
  status: PrismaExecutionStatus
): SubmissionTestResult["executionStatus"] {
  const map = {
    [PrismaExecutionStatus.COMPLETED]: "completed",
    [PrismaExecutionStatus.RUNTIME_ERROR]: "runtime_error",
    [PrismaExecutionStatus.TIMEOUT]: "timeout"
  } satisfies Record<PrismaExecutionStatus, SubmissionTestResult["executionStatus"]>;
  return map[status];
}
