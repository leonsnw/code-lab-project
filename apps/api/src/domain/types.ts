export type UserRole = "student" | "admin";

export type Difficulty = "easy" | "medium" | "hard";

export type SubmissionLanguage = "javascript";

export type SubmissionStatus =
  | "pending"
  | "accepted"
  | "wrong_answer"
  | "runtime_error"
  | "timeout";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface UserCredentials extends User {
  passwordHash: string;
}

export interface CreateUserInput {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface TestCase {
  id: string;
  challengeId: string;
  input: string;
  expectedOutput: string;
  isPublic: boolean;
  weight: number;
}

export interface ChallengeExample {
  input: string;
  output: string;
}

export interface Challenge {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  points: number;
  description: string;
  constraints: string[];
  tags: string[];
  examples: ChallengeExample[];
  testCases: TestCase[];
  isActive: boolean;
  createdBy: string;
}

export interface SubmissionTestResult {
  testCaseId: string;
  executionStatus: "completed" | "runtime_error" | "timeout";
  isPublic: boolean;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
  durationMs: number;
}

export interface Submission {
  id: string;
  userId: string;
  challengeId: string;
  language: SubmissionLanguage;
  sourceCode: string;
  status: SubmissionStatus;
  scoreAwarded: number;
  submittedAt: Date;
  evaluatedAt: Date | null;
  testResults: SubmissionTestResult[];
}

export interface ScoreSummary {
  userId: string;
  totalPoints: number;
  solvedChallengeIds: string[];
  updatedAt: Date;
}

export interface RankingEntry {
  userId: string;
  name: string;
  totalPoints: number;
  solvedChallenges: number;
}

export interface DifficultyProgress {
  difficulty: Difficulty;
  total: number;
  solved: number;
  percentage: number;
}

export interface UserProgress {
  totalChallenges: number;
  solvedChallenges: number;
  pendingChallenges: number;
  byDifficulty: DifficultyProgress[];
}

export interface Comment {
  id: string;
  userId: string;
  challengeId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: Pick<User, "id" | "name">;
}

export interface Rating {
  id: string;
  userId: string;
  challengeId: string;
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RatingSummary {
  average: number;
  total: number;
  currentUserValue: number | null;
}
