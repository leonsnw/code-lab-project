import type {
  Challenge,
  Comment,
  CreateUserInput,
  Difficulty,
  RankingEntry,
  Rating,
  RatingSummary,
  ScoreSummary,
  Submission,
  SubmissionStatus,
  User,
  UserCredentials,
  UserProgress
} from "../domain/types.js";
import type {
  AddCommentInput,
  CodeLabStore,
  CompleteSubmissionInput,
  UpsertRatingInput
} from "./codelab-store.js";
import { buildSeedData } from "./seed.js";
import { calculateScoreAward } from "../domain/scoring.js";
import { buildUserProgress } from "../domain/progress.js";
import { DomainError } from "../common/domain-error.js";
import type { AdminStatisticsData } from "../domain/admin-statistics.js";

export class InMemoryStore implements CodeLabStore {
  private readonly users = new Map<string, UserCredentials>();
  private readonly challenges = new Map<string, Challenge>();
  private readonly challengeSlugIndex = new Map<string, string>();
  private readonly submissions: Submission[] = [];
  private readonly scores = new Map<string, ScoreSummary>();
  private readonly comments: Comment[] = [];
  private readonly ratings = new Map<string, Rating>();

  constructor(seed = buildSeedData()) {
    seed.users.forEach((user) => this.users.set(user.id, user));
    seed.challenges.forEach((challenge) => {
      this.challenges.set(challenge.id, challenge);
      this.challengeSlugIndex.set(challenge.slug, challenge.id);
    });
    seed.scores.forEach((score) => this.scores.set(score.userId, score));
  }

  async findUserById(userId: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    return user ? sanitizeUser(user) : undefined;
  }

  async findUserCredentialsByEmail(
    email: string
  ): Promise<UserCredentials | undefined> {
    return [...this.users.values()].find((user) => user.email === email);
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const user: UserCredentials = { ...input };
    this.users.set(user.id, user);
    this.scores.set(user.id, {
      userId: user.id,
      totalPoints: 0,
      solvedChallengeIds: [],
      updatedAt: new Date()
    });
    return sanitizeUser(user);
  }

  async listChallenges(difficulty?: Difficulty): Promise<Challenge[]> {
    const challenges = [...this.challenges.values()].filter(
      (challenge) => challenge.isActive
    );

    if (!difficulty) {
      return challenges;
    }

    return challenges.filter((challenge) => challenge.difficulty === difficulty);
  }

  async listAllChallenges(): Promise<Challenge[]> {
    return [...this.challenges.values()];
  }

  async findChallengeById(challengeId: string): Promise<Challenge | undefined> {
    return this.challenges.get(challengeId);
  }

  async findChallengeBySlug(slug: string): Promise<Challenge | undefined> {
    const challengeId = this.challengeSlugIndex.get(slug);
    return challengeId ? this.challenges.get(challengeId) : undefined;
  }

  async createChallenge(challenge: Challenge): Promise<Challenge> {
    this.challenges.set(challenge.id, challenge);
    this.challengeSlugIndex.set(challenge.slug, challenge.id);
    return challenge;
  }

  async updateChallenge(challenge: Challenge): Promise<Challenge> {
    const current = this.challenges.get(challenge.id);
    if (!current) {
      throw new DomainError("Desafio nao encontrado.", 404);
    }
    if (current.slug !== challenge.slug) {
      this.challengeSlugIndex.delete(current.slug);
    }
    this.challenges.set(challenge.id, challenge);
    this.challengeSlugIndex.set(challenge.slug, challenge.id);
    return challenge;
  }

  async deactivateChallenge(challengeId: string): Promise<Challenge> {
    const current = this.challenges.get(challengeId);
    if (!current) {
      throw new DomainError("Desafio nao encontrado.", 404);
    }
    const deactivated = { ...current, isActive: false };
    this.challenges.set(challengeId, deactivated);
    return deactivated;
  }

  async addSubmission(submission: Submission): Promise<void> {
    this.submissions.push(submission);
  }

  async completeSubmission(
    input: CompleteSubmissionInput
  ): Promise<Submission> {
    const index = this.submissions.findIndex(
      (submission) => submission.id === input.submissionId
    );
    const current = this.submissions[index];
    if (!current) {
      throw new DomainError("Submissao nao encontrada.", 404);
    }
    if (current.status !== "pending") {
      return current;
    }

    const alreadySolved = this.submissions.some(
      (submission) =>
        submission.id !== current.id &&
        submission.userId === current.userId &&
        submission.challengeId === current.challengeId &&
        submission.status === "accepted"
    );
    const scoreAwarded =
      input.status === "accepted"
        ? calculateScoreAward(input.challengePoints, alreadySolved)
        : 0;
    const completed: Submission = {
      ...current,
      status: input.status,
      scoreAwarded,
      evaluatedAt: input.evaluatedAt,
      testResults: input.testResults
    };
    this.submissions[index] = completed;

    if (scoreAwarded > 0) {
      const score = this.scores.get(current.userId) ?? {
        userId: current.userId,
        totalPoints: 0,
        solvedChallengeIds: [],
        updatedAt: new Date()
      };
      this.scores.set(current.userId, {
        ...score,
        totalPoints: score.totalPoints + scoreAwarded,
        solvedChallengeIds: score.solvedChallengeIds.includes(
          current.challengeId
        )
          ? score.solvedChallengeIds
          : [...score.solvedChallengeIds, current.challengeId],
        updatedAt: input.evaluatedAt
      });
    }

    return completed;
  }

  async listSubmissions(
    userId?: string,
    challengeId?: string,
    status?: SubmissionStatus
  ): Promise<Submission[]> {
    return this.submissions
      .filter((submission) => !userId || submission.userId === userId)
      .filter(
        (submission) => !challengeId || submission.challengeId === challengeId
      )
      .filter((submission) => !status || submission.status === status)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  async getScore(userId: string): Promise<ScoreSummary> {
    const existing = this.scores.get(userId);
    if (existing) {
      return existing;
    }

    const created: ScoreSummary = {
      userId,
      totalPoints: 0,
      solvedChallengeIds: [],
      updatedAt: new Date()
    };
    this.scores.set(userId, created);
    return created;
  }

  async getUserProgress(userId: string): Promise<UserProgress> {
    const challenges = [...this.challenges.values()].filter(
      (challenge) => challenge.isActive
    );
    const solvedChallengeIds = [
      ...new Set(
        this.submissions
          .filter(
            (submission) =>
              submission.userId === userId &&
              submission.status === "accepted"
          )
          .map((submission) => submission.challengeId)
      )
    ];

    return buildUserProgress(challenges, solvedChallengeIds);
  }

  async getRanking(): Promise<RankingEntry[]> {
    return [...this.scores.values()]
      .map((score) => {
        const user = this.users.get(score.userId);
        return {
          userId: score.userId,
          name: user?.name ?? "Usuario desconhecido",
          totalPoints: score.totalPoints,
          solvedChallenges: score.solvedChallengeIds.length
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);
  }

  async listComments(challengeId: string): Promise<Comment[]> {
    return this.comments
      .filter((comment) => comment.challengeId === challengeId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async addComment(input: AddCommentInput): Promise<Comment> {
    const user = this.users.get(input.userId);
    if (!user) {
      throw new DomainError("Usuario nao encontrado.", 404);
    }

    const comment: Comment = {
      ...input,
      author: { id: user.id, name: user.name }
    };
    this.comments.unshift(comment);
    return comment;
  }

  async getRatingSummary(
    challengeId: string,
    userId?: string
  ): Promise<RatingSummary> {
    const ratings = [...this.ratings.values()].filter(
      (rating) => rating.challengeId === challengeId
    );
    const current = userId
      ? this.ratings.get(ratingKey(challengeId, userId))
      : undefined;

    return {
      average: calculateRatingAverage(ratings),
      total: ratings.length,
      currentUserValue: current?.value ?? null
    };
  }

  async upsertRating(input: UpsertRatingInput): Promise<Rating> {
    const key = ratingKey(input.challengeId, input.userId);
    const existing = this.ratings.get(key);
    const rating: Rating = existing
      ? {
          ...existing,
          value: input.value,
          updatedAt: input.updatedAt
        }
      : input;
    this.ratings.set(key, rating);
    return rating;
  }

  async getAdminStatisticsData(): Promise<AdminStatisticsData> {
    return {
      users: [...this.users.values()].map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role,
        totalPoints: this.scores.get(user.id)?.totalPoints ?? 0
      })),
      challenges: [...this.challenges.values()].map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        slug: challenge.slug,
        difficulty: challenge.difficulty,
        isActive: challenge.isActive
      })),
      submissions: this.submissions.map((submission) => ({
        challengeId: submission.challengeId,
        userId: submission.userId,
        status: submission.status
      })),
      comments: this.comments.map((comment) => ({
        challengeId: comment.challengeId
      })),
      ratings: [...this.ratings.values()].map((rating) => ({
        challengeId: rating.challengeId,
        value: rating.value
      }))
    };
  }
}

function sanitizeUser(user: UserCredentials): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function ratingKey(challengeId: string, userId: string): string {
  return `${challengeId}:${userId}`;
}

function calculateRatingAverage(ratings: Rating[]): number {
  if (ratings.length === 0) {
    return 0;
  }
  const total = ratings.reduce((sum, rating) => sum + rating.value, 0);
  return Number((total / ratings.length).toFixed(1));
}
