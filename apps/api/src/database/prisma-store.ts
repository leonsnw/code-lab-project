import {
  AuthTokenKind as PrismaAuthTokenKind,
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
  AccountStatus,
  AuthToken,
  AuthTokenKind,
  ClassGroup,
  ClassMember,
  UpdateUserInput,
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
  SourceRule,
  SubmissionTestResult,
  ChallengeLanguage,
  ChallengeUnlock,
  Complexity,
  FunctionSpec,
  OutputChecker,
  Track,
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

const CATALOG_TTL_MS = 30_000;

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
        throw new DomainError("E-mail já cadastrado.", 409);
      }
      throw error;
    }
  }

  /**
   * O catálogo tem milhares de casos de teste (alguns com dezenas de KB) e é
   * lido em quase toda tela. Fica em memória por alguns segundos; escritas
   * feitas por este processo invalidam na hora. Um seed rodado em outro
   * processo aparece em até CATALOG_TTL_MS.
   */
  private catalogCache: { expiresAt: number; challenges: Promise<Challenge[]> } | null = null;

  private invalidateCatalog() {
    this.catalogCache = null;
  }

  private loadAllChallenges(): Promise<Challenge[]> {
    if (this.catalogCache && this.catalogCache.expiresAt > Date.now()) return this.catalogCache.challenges;
    const challenges = this.prisma.challenge
      .findMany({ include: challengeInclude, orderBy: [{ isActive: "desc" }, { title: "asc" }] })
      .then((rows) => rows.map(mapChallenge));
    this.catalogCache = { expiresAt: Date.now() + CATALOG_TTL_MS, challenges };
    challenges.catch(() => this.invalidateCatalog());
    return challenges;
  }

  async listChallenges(difficulty?: Difficulty): Promise<Challenge[]> {
    const order = { easy: 0, medium: 1, hard: 2 } as const;
    return (await this.loadAllChallenges())
      .filter((challenge) => challenge.isActive && challenge.isPublished !== false && (!difficulty || challenge.difficulty === difficulty))
      .sort((a, b) => order[a.difficulty] - order[b.difficulty] || a.title.localeCompare(b.title));
  }

  async listAllChallenges(): Promise<Challenge[]> {
    return [...(await this.loadAllChallenges())];
  }

  async createChallenge(challenge: Challenge): Promise<Challenge> {
    try {
      return await this.createChallengeRaw(challenge);
    } finally {
      // Invalida depois da escrita: uma leitura durante a escrita não fica em cache.
      this.invalidateCatalog();
    }
  }

  async updateChallenge(challenge: Challenge): Promise<Challenge> {
    try {
      return await this.updateChallengeRaw(challenge);
    } finally {
      // Invalida depois da escrita: uma leitura durante a escrita não fica em cache.
      this.invalidateCatalog();
    }
  }

  async deactivateChallenge(challengeId: string): Promise<Challenge> {
    try {
      return await this.deactivateChallengeRaw(challengeId);
    } finally {
      // Invalida depois da escrita: uma leitura durante a escrita não fica em cache.
      this.invalidateCatalog();
    }
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

  private async createChallengeRaw(challenge: Challenge): Promise<Challenge> {
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

  private async updateChallengeRaw(challenge: Challenge): Promise<Challenge> {
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
          ...challengeContentData(challenge),
          module: challenge.moduleId ? { connect: { id: challenge.moduleId } } : { disconnect: true },
          isActive: challenge.isActive,
          isPublished: challenge.isPublished !== false,
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

  private async deactivateChallengeRaw(challengeId: string): Promise<Challenge> {
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
        totalTests: submission.totalTests,
        passedTests: submission.passedTests,
        errorMessage: submission.errorMessage,
        compileWarnings: submission.compileWarnings,
        testResults: {
          create: submission.testResults.map(buildTestResultData)
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
              include: submissionInclude
            });
            if (!current) {
              throw new DomainError("Submissão não encontrada.", 404);
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
              input.status === "accepted" && !input.pointsForfeited
                ? calculateScoreAward(input.challengePoints, alreadySolved)
                : 0;

            const completed = await transaction.submission.update({
              where: { id: current.id },
              data: {
                status: toPrismaSubmissionStatus(input.status),
                scoreAwarded,
                evaluatedAt: input.evaluatedAt,
                totalTests: input.totalTests,
                passedTests: input.passedTests,
                errorMessage: input.errorMessage,
                compileWarnings: input.compileWarnings,
                testResults: {
                  create: input.testResults.map(buildTestResultData)
                }
              },
              include: submissionInclude
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

    throw new Error("Não foi possível concluir a submissão.");
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
      include: submissionInclude,
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
        where: { isActive: true, isPublished: true },
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

  async listTracks(): Promise<Track[]> {
    const tracks = await this.prisma.track.findMany({
      orderBy: { position: "asc" },
      include: {
        modules: {
          orderBy: { position: "asc" },
          include: { lessons: { orderBy: { position: "asc" } } }
        }
      }
    });
    return tracks.map((track) => ({
      id: track.id,
      slug: track.slug,
      title: track.title,
      description: track.description,
      position: track.position,
      modules: track.modules.map((module) => ({
        id: module.id,
        trackId: module.trackId,
        slug: module.slug,
        title: module.title,
        objective: module.objective,
        concept: module.concept,
        estimatedMinutes: module.estimatedMinutes,
        position: module.position,
        prerequisiteIds: module.prerequisiteIds,
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          moduleId: lesson.moduleId,
          slug: lesson.slug,
          title: lesson.title,
          summary: lesson.summary,
          content: lesson.content,
          estimatedMinutes: lesson.estimatedMinutes,
          position: lesson.position
        }))
      }))
    }));
  }

  /** Sincroniza trilhas, módulos e lições com o catálogo (seed idempotente). */
  async replaceTracks(tracks: Track[]): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      for (const track of tracks) {
        const trackData = { slug: track.slug, title: track.title, description: track.description, position: track.position };
        await transaction.track.upsert({ where: { id: track.id }, create: { id: track.id, ...trackData }, update: trackData });
        for (const module of track.modules) {
          const moduleData = {
            trackId: track.id,
            slug: module.slug,
            title: module.title,
            objective: module.objective,
            concept: module.concept,
            estimatedMinutes: module.estimatedMinutes,
            position: module.position,
            prerequisiteIds: module.prerequisiteIds
          };
          await transaction.module.upsert({ where: { id: module.id }, create: { id: module.id, ...moduleData }, update: moduleData });
          for (const lesson of module.lessons) {
            const lessonData = {
              moduleId: module.id,
              slug: lesson.slug,
              title: lesson.title,
              summary: lesson.summary,
              content: lesson.content,
              estimatedMinutes: lesson.estimatedMinutes,
              position: lesson.position
            };
            await transaction.lesson.upsert({ where: { id: lesson.id }, create: { id: lesson.id, ...lessonData }, update: lessonData });
          }
        }
      }
      const lessonIds = tracks.flatMap((track) => track.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
      const moduleIds = tracks.flatMap((track) => track.modules.map((module) => module.id));
      await transaction.lesson.deleteMany({ where: { id: { notIn: lessonIds } } });
      await transaction.module.deleteMany({ where: { id: { notIn: moduleIds } } });
      await transaction.track.deleteMany({ where: { id: { notIn: tracks.map((track) => track.id) } } });
    }, { timeout: 60000 });
  }

  async listLessonCompletions(userId: string): Promise<string[]> {
    const completions = await this.prisma.lessonCompletion.findMany({ where: { userId }, select: { lessonId: true } });
    return completions.map((completion) => completion.lessonId);
  }

  async completeLesson(userId: string, lessonId: string): Promise<void> {
    await this.prisma.lessonCompletion.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId },
      update: {}
    });
  }

  async getChallengeUnlock(userId: string, challengeId: string): Promise<ChallengeUnlock | undefined> {
    const unlock = await this.prisma.challengeUnlock.findUnique({
      where: { userId_challengeId: { userId, challengeId } }
    });
    return unlock
      ? { userId, challengeId, hintsRevealed: unlock.hintsRevealed, solutionRevealed: unlock.solutionRevealed }
      : undefined;
  }

  async saveChallengeUnlock(unlock: ChallengeUnlock): Promise<ChallengeUnlock> {
    const data = { hintsRevealed: unlock.hintsRevealed, solutionRevealed: unlock.solutionRevealed };
    await this.prisma.challengeUnlock.upsert({
      where: { userId_challengeId: { userId: unlock.userId, challengeId: unlock.challengeId } },
      create: { userId: unlock.userId, challengeId: unlock.challengeId, ...data },
      update: data
    });
    return { ...unlock };
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

  // ---------- Conta ----------
  async findUserCredentialsById(userId: string): Promise<UserCredentials | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? mapUserCredentials(user) : undefined;
  }

  async getAccountStatus(userId: string): Promise<AccountStatus | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true, createdAt: true } });
    return user ?? undefined;
  }

  async updateUser(userId: string, input: UpdateUserInput): Promise<User> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}),
          ...(input.emailVerifiedAt ? { emailVerifiedAt: input.emailVerifiedAt } : {})
        }
      });
      return mapUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new DomainError("Usuário não encontrado.", 404);
      }
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<void> {
    // As relações do usuário (submissões, comentários, avaliações, progresso,
    // tokens e turmas) são apagadas em cascata pelo banco.
    await this.prisma.user.deleteMany({ where: { id: userId } });
  }

  async saveAuthToken(token: AuthToken): Promise<void> {
    await this.prisma.authToken.create({ data: { ...token, kind: toPrismaAuthTokenKind(token.kind) } });
  }

  async findAuthToken(kind: AuthTokenKind, tokenHash: string): Promise<AuthToken | undefined> {
    const token = await this.prisma.authToken.findUnique({ where: { tokenHash } });
    if (!token || token.kind !== toPrismaAuthTokenKind(kind)) return undefined;
    return { ...token, kind };
  }

  async markAuthTokenUsed(tokenId: string, usedAt: Date): Promise<void> {
    await this.prisma.authToken.updateMany({ where: { id: tokenId }, data: { usedAt } });
  }

  async invalidateAuthTokens(userId: string, kind: AuthTokenKind, usedAt: Date): Promise<void> {
    await this.prisma.authToken.updateMany({ where: { userId, kind: toPrismaAuthTokenKind(kind), usedAt: null }, data: { usedAt } });
  }

  async listCommentsByUser(userId: string): Promise<Comment[]> {
    const comments = await this.prisma.comment.findMany({
      where: { userId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" }
    });
    return comments.map(mapComment);
  }

  async listRatingsByUser(userId: string): Promise<Rating[]> {
    const ratings = await this.prisma.rating.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return ratings.map(mapRating);
  }

  // ---------- Turmas ----------
  async createClass(classGroup: ClassGroup): Promise<ClassGroup> {
    try {
      return await this.prisma.classGroup.create({ data: classGroup });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new DomainError("Já existe uma turma com este código.", 409);
      }
      throw error;
    }
  }

  async listClasses(ownerId?: string): Promise<ClassGroup[]> {
    return this.prisma.classGroup.findMany({ where: ownerId ? { ownerId } : {}, orderBy: { createdAt: "desc" } });
  }

  async findClassById(classId: string): Promise<ClassGroup | undefined> {
    return (await this.prisma.classGroup.findUnique({ where: { id: classId } })) ?? undefined;
  }

  async findClassByCode(code: string): Promise<ClassGroup | undefined> {
    return (await this.prisma.classGroup.findUnique({ where: { code } })) ?? undefined;
  }

  async deleteClass(classId: string): Promise<void> {
    await this.prisma.classGroup.deleteMany({ where: { id: classId } });
  }

  async addClassMember(member: ClassMember): Promise<void> {
    await this.prisma.classMember.upsert({
      where: { classId_userId: { classId: member.classId, userId: member.userId } },
      create: member,
      update: {}
    });
  }

  async removeClassMember(classId: string, userId: string): Promise<void> {
    await this.prisma.classMember.deleteMany({ where: { classId, userId } });
  }

  async listClassMembers(classId: string): Promise<Array<ClassMember & { user: User }>> {
    const members = await this.prisma.classMember.findMany({
      where: { classId },
      include: { user: true },
      orderBy: { user: { name: "asc" } }
    });
    return members.map((member) => ({ classId: member.classId, userId: member.userId, joinedAt: member.joinedAt, user: mapUser(member.user) }));
  }

  async listUserClasses(userId: string): Promise<ClassGroup[]> {
    const memberships = await this.prisma.classMember.findMany({ where: { userId }, include: { classGroup: true }, orderBy: { joinedAt: "desc" } });
    return memberships.map((membership) => membership.classGroup);
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
    languages: mapLanguages(challenge.languages),
    mode: challenge.mode === "function" ? "function" : "stdio",
    functionSpec: (challenge.functionSpec as unknown as FunctionSpec | null) ?? null,
    checker: mapChecker(challenge.checker),
    timeLimitMs: challenge.timeLimitMs,
    memoryLimitMb: challenge.memoryLimitMb,
    topic: challenge.topic,
    subtopic: challenge.subtopic,
    moduleId: challenge.moduleId,
    position: challenge.position,
    isBoss: challenge.isBoss,
    hints: Array.isArray(challenge.hints) ? challenge.hints.filter((hint): hint is string => typeof hint === "string") : [],
    editorial: challenge.editorial,
    complexity: (challenge.complexity as unknown as Complexity | null) ?? null,
    followUps: challenge.followUps,
    testCases: challenge.testCases.map((testCase) => ({
      id: testCase.id,
      challengeId: testCase.challengeId,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      isPublic: testCase.isPublic,
      weight: testCase.weight
    })),
    isActive: challenge.isActive,
    isPublished: challenge.isPublished,
    createdBy: challenge.createdBy
  };
}

const submissionInclude = {
  testResults: { orderBy: { position: "asc" } }
} satisfies Prisma.SubmissionInclude;

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
  totalTests: number;
  passedTests: number;
  errorMessage: string | null;
  compileWarnings: string | null;
  testResults: Array<Parameters<typeof mapSubmissionTestResult>[0]>;
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
    totalTests: submission.totalTests,
    passedTests: submission.passedTests,
    errorMessage: submission.errorMessage,
    compileWarnings: submission.compileWarnings,
    testResults: submission.testResults.map(mapSubmissionTestResult)
  };
}

function mapSubmissionTestResult(result: {
  testCaseId: string;
  position: number;
  executionStatus: PrismaExecutionStatus;
  isPublic: boolean;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr: string | null;
  error: string | null;
  durationMs: number;
}): SubmissionTestResult {
  return {
    testCaseId: result.testCaseId,
    position: result.position,
    executionStatus: fromPrismaExecutionStatus(result.executionStatus),
    isPublic: result.isPublic,
    passed: result.passed,
    input: result.input,
    expectedOutput: result.expectedOutput,
    actualOutput: result.actualOutput,
    stderr: result.stderr ?? undefined,
    error: result.error ?? undefined,
    durationMs: result.durationMs
  };
}

function buildTestResultData(result: SubmissionTestResult) {
  return {
    id: randomUUID(),
    testCaseId: result.testCaseId,
    position: result.position,
    executionStatus: toPrismaExecutionStatus(result.executionStatus),
    isPublic: result.isPublic,
    passed: result.passed,
    input: result.input,
    expectedOutput: result.expectedOutput,
    actualOutput: result.actualOutput,
    stderr: result.stderr,
    error: result.error,
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

/** Campos de conteúdo e de avaliação comuns à criação e à edição. */
function challengeContentData(challenge: Challenge) {
  const json = (value: unknown) => value as Prisma.InputJsonValue;
  return {
    languages: json(challenge.languages),
    mode: challenge.mode,
    functionSpec: challenge.functionSpec ? json(challenge.functionSpec) : Prisma.JsonNull,
    checker: json(challenge.checker),
    timeLimitMs: challenge.timeLimitMs,
    memoryLimitMb: challenge.memoryLimitMb,
    topic: challenge.topic,
    subtopic: challenge.subtopic,
    position: challenge.position,
    isBoss: challenge.isBoss,
    hints: json(challenge.hints),
    editorial: challenge.editorial,
    complexity: challenge.complexity ? json(challenge.complexity) : Prisma.JsonNull,
    followUps: challenge.followUps
  };
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
    ...challengeContentData(challenge),
    ...(challenge.moduleId ? { module: { connect: { id: challenge.moduleId } } } : {}),
    isActive: challenge.isActive,
    isPublished: challenge.isPublished !== false,
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
      return new DomainError("Slug de desafio já utilizado.", 409);
    }
    if (error.code === "P2025") {
      return new DomainError("Desafio não encontrado.", 404);
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

const LANGUAGE_VALUES = new Set<string>(["javascript", "c", "python"]);

function mapLanguages(value: unknown): ChallengeLanguage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === "object" && LANGUAGE_VALUES.has((entry as { language?: string }).language ?? ""))
    .map((entry) => {
      const item = entry as { language: SubmissionLanguage; sourceRules?: unknown; starterCode?: unknown };
      return {
        language: item.language,
        sourceRules: mapSourceRules(item.sourceRules),
        ...(typeof item.starterCode === "string" ? { starterCode: item.starterCode } : {})
      };
    });
}

function mapChecker(value: unknown): OutputChecker {
  const checker = value as OutputChecker | null;
  switch (checker?.kind) {
    case "tolerance":
      return { kind: "tolerance", epsilon: Number(checker.epsilon) || 1e-6 };
    case "unordered-lines":
    case "unordered-tokens":
      return { kind: checker.kind };
    case "custom":
      return typeof checker.code === "string" ? { kind: "custom", code: checker.code } : { kind: "exact" };
    default:
      return { kind: "exact" };
  }
}

function mapSourceRules(value: unknown): SourceRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (rule): rule is SourceRule =>
      typeof rule === "object" &&
      rule !== null &&
      typeof rule.message === "string" &&
      (rule.kind === "recursion" && (rule.minDepth === undefined || typeof rule.minDepth === "number") ||
        ((rule.kind === "forbid" || rule.kind === "require") && typeof rule.pattern === "string"))
  );
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
    javascript: PrismaSubmissionLanguage.JAVASCRIPT,
    c: PrismaSubmissionLanguage.C,
    python: PrismaSubmissionLanguage.PYTHON
  } satisfies Record<SubmissionLanguage, PrismaSubmissionLanguage>;
  return map[language];
}

function fromPrismaSubmissionLanguage(
  language: PrismaSubmissionLanguage
): SubmissionLanguage {
  const map = {
    [PrismaSubmissionLanguage.JAVASCRIPT]: "javascript",
    [PrismaSubmissionLanguage.C]: "c",
    [PrismaSubmissionLanguage.PYTHON]: "python"
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
    timeout: PrismaSubmissionStatus.TIMEOUT,
    compile_error: PrismaSubmissionStatus.COMPILE_ERROR,
    internal_error: PrismaSubmissionStatus.INTERNAL_ERROR,
    rule_violation: PrismaSubmissionStatus.RULE_VIOLATION
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
    [PrismaSubmissionStatus.TIMEOUT]: "timeout",
    [PrismaSubmissionStatus.COMPILE_ERROR]: "compile_error",
    [PrismaSubmissionStatus.INTERNAL_ERROR]: "internal_error",
    [PrismaSubmissionStatus.RULE_VIOLATION]: "rule_violation"
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

function toPrismaAuthTokenKind(kind: AuthTokenKind): PrismaAuthTokenKind {
  return kind === "password_reset" ? PrismaAuthTokenKind.PASSWORD_RESET : PrismaAuthTokenKind.EMAIL_VERIFICATION;
}
