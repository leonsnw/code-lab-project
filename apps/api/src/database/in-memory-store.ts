import type {
  AccountStatus,
  AuthToken,
  AuthTokenKind,
  ClassGroup,
  ClassMember,
  UpdateUserInput,
  Challenge,
  ChallengeUnlock,
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
  Track,
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
  private tracks: Track[] = [];
  private readonly lessonCompletions = new Map<string, Set<string>>();
  private readonly unlocks = new Map<string, ChallengeUnlock>();
  private readonly accounts = new Map<string, AccountStatus>();
  private readonly authTokens = new Map<string, AuthToken>();
  private readonly classes = new Map<string, ClassGroup>();
  private readonly classMembers: ClassMember[] = [];

  constructor(
    seed: {
      users: UserCredentials[];
      challenges: Challenge[];
      scores: ScoreSummary[];
      tracks?: Track[];
    } = buildSeedData()
  ) {
    this.tracks = seed.tracks ?? [];
    seed.users.forEach((user) => {
      this.users.set(user.id, user);
      // Usuários do seed já nascem com o e-mail verificado.
      this.accounts.set(user.id, { emailVerifiedAt: new Date(0), createdAt: new Date(0) });
    });
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
    this.accounts.set(user.id, { emailVerifiedAt: null, createdAt: new Date() });
    this.scores.set(user.id, {
      userId: user.id,
      totalPoints: 0,
      solvedChallengeIds: [],
      updatedAt: new Date()
    });
    return sanitizeUser(user);
  }

  async listChallenges(difficulty?: Difficulty): Promise<Challenge[]> {
    const challenges = [...this.challenges.values()].filter(isVisible);

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
      throw new DomainError("Desafio não encontrado.", 404);
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
      throw new DomainError("Desafio não encontrado.", 404);
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
      throw new DomainError("Submissão não encontrada.", 404);
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
      input.status === "accepted" && !input.pointsForfeited
        ? calculateScoreAward(input.challengePoints, alreadySolved)
        : 0;
    const completed: Submission = {
      ...current,
      status: input.status,
      scoreAwarded,
      evaluatedAt: input.evaluatedAt,
      totalTests: input.totalTests,
      passedTests: input.passedTests,
      errorMessage: input.errorMessage,
      compileWarnings: input.compileWarnings,
      testResults: input.testResults
    };
    this.submissions[index] = completed;

    if (input.status === "accepted") {
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
    const challenges = [...this.challenges.values()].filter(isVisible);
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
          name: user?.name ?? "Usuário desconhecido",
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
      throw new DomainError("Usuário não encontrado.", 404);
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
  async listTracks(): Promise<Track[]> {
    return structuredClone(this.tracks);
  }

  async replaceTracks(tracks: Track[]): Promise<void> {
    this.tracks = structuredClone(tracks);
  }

  async listLessonCompletions(userId: string): Promise<string[]> {
    return [...(this.lessonCompletions.get(userId) ?? [])];
  }

  async completeLesson(userId: string, lessonId: string): Promise<void> {
    const completed = this.lessonCompletions.get(userId) ?? new Set<string>();
    completed.add(lessonId);
    this.lessonCompletions.set(userId, completed);
  }

  async getChallengeUnlock(userId: string, challengeId: string): Promise<ChallengeUnlock | undefined> {
    const unlock = this.unlocks.get(`${userId}:${challengeId}`);
    return unlock ? { ...unlock } : undefined;
  }

  async saveChallengeUnlock(unlock: ChallengeUnlock): Promise<ChallengeUnlock> {
    this.unlocks.set(`${unlock.userId}:${unlock.challengeId}`, { ...unlock });
    return { ...unlock };
  }

  // ---------- Conta ----------
  async findUserCredentialsById(userId: string): Promise<UserCredentials | undefined> {
    return this.users.get(userId);
  }

  async getAccountStatus(userId: string): Promise<AccountStatus | undefined> {
    return this.users.has(userId) ? this.accounts.get(userId) ?? { emailVerifiedAt: null, createdAt: new Date(0) } : undefined;
  }

  async updateUser(userId: string, input: UpdateUserInput): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new DomainError("Usuário não encontrado.", 404);
    const updated = { ...user, ...(input.name !== undefined ? { name: input.name } : {}), ...(input.passwordHash ? { passwordHash: input.passwordHash } : {}) };
    this.users.set(userId, updated);
    if (input.emailVerifiedAt) {
      const account = this.accounts.get(userId) ?? { emailVerifiedAt: null, createdAt: new Date() };
      this.accounts.set(userId, { ...account, emailVerifiedAt: input.emailVerifiedAt });
    }
    return sanitizeUser(updated);
  }

  async deleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
    this.accounts.delete(userId);
    this.scores.delete(userId);
    this.lessonCompletions.delete(userId);
    const keep = <T>(list: T[], predicate: (item: T) => boolean) => {
      const kept = list.filter(predicate);
      list.splice(0, list.length, ...kept);
    };
    keep(this.submissions, (submission) => submission.userId !== userId);
    keep(this.comments, (comment) => comment.userId !== userId);
    keep(this.classMembers, (member) => member.userId !== userId);
    for (const [key, rating] of this.ratings) if (rating.userId === userId) this.ratings.delete(key);
    for (const [key, unlock] of this.unlocks) if (unlock.userId === userId) this.unlocks.delete(key);
    for (const [key, token] of this.authTokens) if (token.userId === userId) this.authTokens.delete(key);
    for (const classGroup of [...this.classes.values()]) if (classGroup.ownerId === userId) await this.deleteClass(classGroup.id);
  }

  async saveAuthToken(token: AuthToken): Promise<void> {
    this.authTokens.set(token.id, { ...token });
  }

  async findAuthToken(kind: AuthTokenKind, tokenHash: string): Promise<AuthToken | undefined> {
    const token = [...this.authTokens.values()].find((item) => item.kind === kind && item.tokenHash === tokenHash);
    return token ? { ...token } : undefined;
  }

  async markAuthTokenUsed(tokenId: string, usedAt: Date): Promise<void> {
    const token = this.authTokens.get(tokenId);
    if (token) this.authTokens.set(tokenId, { ...token, usedAt });
  }

  async invalidateAuthTokens(userId: string, kind: AuthTokenKind, usedAt: Date): Promise<void> {
    for (const token of this.authTokens.values()) {
      if (token.userId === userId && token.kind === kind && !token.usedAt) token.usedAt = usedAt;
    }
  }

  async listCommentsByUser(userId: string): Promise<Comment[]> {
    return this.comments.filter((comment) => comment.userId === userId);
  }

  async listRatingsByUser(userId: string): Promise<Rating[]> {
    return [...this.ratings.values()].filter((rating) => rating.userId === userId);
  }

  // ---------- Turmas ----------
  async createClass(classGroup: ClassGroup): Promise<ClassGroup> {
    if ([...this.classes.values()].some((item) => item.code === classGroup.code)) {
      throw new DomainError("Já existe uma turma com este código.", 409);
    }
    this.classes.set(classGroup.id, { ...classGroup });
    return { ...classGroup };
  }

  async listClasses(ownerId?: string): Promise<ClassGroup[]> {
    return [...this.classes.values()]
      .filter((item) => !ownerId || item.ownerId === ownerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findClassById(classId: string): Promise<ClassGroup | undefined> {
    return this.classes.get(classId);
  }

  async findClassByCode(code: string): Promise<ClassGroup | undefined> {
    return [...this.classes.values()].find((item) => item.code === code);
  }

  async deleteClass(classId: string): Promise<void> {
    this.classes.delete(classId);
    const kept = this.classMembers.filter((member) => member.classId !== classId);
    this.classMembers.splice(0, this.classMembers.length, ...kept);
  }

  async addClassMember(member: ClassMember): Promise<void> {
    if (this.classMembers.some((item) => item.classId === member.classId && item.userId === member.userId)) return;
    this.classMembers.push({ ...member });
  }

  async removeClassMember(classId: string, userId: string): Promise<void> {
    const kept = this.classMembers.filter((member) => !(member.classId === classId && member.userId === userId));
    this.classMembers.splice(0, this.classMembers.length, ...kept);
  }

  async listClassMembers(classId: string): Promise<Array<ClassMember & { user: User }>> {
    return this.classMembers
      .filter((member) => member.classId === classId && this.users.has(member.userId))
      .map((member) => ({ ...member, user: sanitizeUser(this.users.get(member.userId)!) }))
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  async listUserClasses(userId: string): Promise<ClassGroup[]> {
    return this.classMembers
      .filter((member) => member.userId === userId)
      .map((member) => this.classes.get(member.classId))
      .filter((item): item is ClassGroup => Boolean(item));
  }
}



/** Visível para estudantes: ativo e publicado (rascunhos ficam só com o admin). */
function isVisible(challenge: Challenge): boolean {
  return challenge.isActive && challenge.isPublished !== false;
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
