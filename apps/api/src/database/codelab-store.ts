import type {
  AccountStatus,
  AuthToken,
  AuthTokenKind,
  ClassGroup,
  ClassMember,
  UpdateUserInput,
  Challenge,
  ChallengeUnlock,
  Track,
  Comment,
  CreateUserInput,
  Difficulty,
  RankingEntry,
  Rating,
  RatingSummary,
  ScoreSummary,
  Submission,
  SubmissionStatus,
  SubmissionTestResult,
  User,
  UserCredentials,
  UserProgress
} from "../domain/types.js";
import type { AdminStatisticsData } from "../domain/admin-statistics.js";

export interface CompleteSubmissionInput {
  submissionId: string;
  status: Exclude<SubmissionStatus, "pending">;
  evaluatedAt: Date;
  testResults: SubmissionTestResult[];
  totalTests: number;
  passedTests: number;
  errorMessage: string | null;
  compileWarnings: string | null;
  challengePoints: number;
  /** Solução comentada revelada: o desafio conta como resolvido, sem pontos. */
  pointsForfeited: boolean;
}

export interface AddCommentInput {
  id: string;
  userId: string;
  challengeId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertRatingInput {
  id: string;
  userId: string;
  challengeId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CodeLabStore {
  findUserById(userId: string): Promise<User | undefined>;
  findUserCredentialsByEmail(email: string): Promise<UserCredentials | undefined>;
  createUser(input: CreateUserInput): Promise<User>;
  listChallenges(difficulty?: Difficulty): Promise<Challenge[]>;
  listAllChallenges(): Promise<Challenge[]>;
  findChallengeById(challengeId: string): Promise<Challenge | undefined>;
  findChallengeBySlug(slug: string): Promise<Challenge | undefined>;
  createChallenge(challenge: Challenge): Promise<Challenge>;
  updateChallenge(challenge: Challenge): Promise<Challenge>;
  deactivateChallenge(challengeId: string): Promise<Challenge>;
  addSubmission(submission: Submission): Promise<void>;
  completeSubmission(input: CompleteSubmissionInput): Promise<Submission>;
  listSubmissions(
    userId?: string,
    challengeId?: string,
    status?: SubmissionStatus
  ): Promise<Submission[]>;
  getScore(userId: string): Promise<ScoreSummary>;
  getUserProgress(userId: string): Promise<UserProgress>;
  getRanking(): Promise<RankingEntry[]>;
  listComments(challengeId: string): Promise<Comment[]>;
  addComment(input: AddCommentInput): Promise<Comment>;
  getRatingSummary(
    challengeId: string,
    userId?: string
  ): Promise<RatingSummary>;
  upsertRating(input: UpsertRatingInput): Promise<Rating>;
  getAdminStatisticsData(): Promise<AdminStatisticsData>;
  listTracks(): Promise<Track[]>;
  replaceTracks(tracks: Track[]): Promise<void>;
  listLessonCompletions(userId: string): Promise<string[]>;
  completeLesson(userId: string, lessonId: string): Promise<void>;
  getChallengeUnlock(userId: string, challengeId: string): Promise<ChallengeUnlock | undefined>;
  saveChallengeUnlock(unlock: ChallengeUnlock): Promise<ChallengeUnlock>;

  // ---------- Conta (LGPD, recuperação de senha, verificação de e-mail) ----------
  findUserCredentialsById(userId: string): Promise<UserCredentials | undefined>;
  getAccountStatus(userId: string): Promise<AccountStatus | undefined>;
  updateUser(userId: string, input: UpdateUserInput): Promise<User>;
  /** Apaga a conta e, em cascata, submissões, comentários, avaliações e progresso. */
  deleteUser(userId: string): Promise<void>;
  saveAuthToken(token: AuthToken): Promise<void>;
  findAuthToken(kind: AuthTokenKind, tokenHash: string): Promise<AuthToken | undefined>;
  markAuthTokenUsed(tokenId: string, usedAt: Date): Promise<void>;
  /** Invalida os tokens ainda não usados de um tipo (novo pedido anula os anteriores). */
  invalidateAuthTokens(userId: string, kind: AuthTokenKind, usedAt: Date): Promise<void>;
  listCommentsByUser(userId: string): Promise<Comment[]>;
  listRatingsByUser(userId: string): Promise<Rating[]>;

  // ---------- Turmas ----------
  createClass(classGroup: ClassGroup): Promise<ClassGroup>;
  listClasses(ownerId?: string): Promise<ClassGroup[]>;
  findClassById(classId: string): Promise<ClassGroup | undefined>;
  findClassByCode(code: string): Promise<ClassGroup | undefined>;
  deleteClass(classId: string): Promise<void>;
  addClassMember(member: ClassMember): Promise<void>;
  removeClassMember(classId: string, userId: string): Promise<void>;
  listClassMembers(classId: string): Promise<Array<ClassMember & { user: User }>>;
  listUserClasses(userId: string): Promise<ClassGroup[]>;
}
