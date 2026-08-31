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
  challengePoints: number;
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
  listSubmissions(userId?: string, challengeId?: string): Promise<Submission[]>;
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
}
