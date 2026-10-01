export type UserRole = "student" | "admin";

export type Difficulty = "easy" | "medium" | "hard";

export type SubmissionLanguage = "javascript" | "c" | "python";

export const SUBMISSION_LANGUAGES: SubmissionLanguage[] = ["javascript", "c", "python"];

export type SubmissionStatus =
  | "pending"
  | "accepted"
  | "wrong_answer"
  | "runtime_error"
  | "timeout"
  | "compile_error"
  | "rule_violation"
  | "internal_error";

/**
 * Regra sobre o código-fonte, avaliada sem comentários e literais.
 * `recursion` exige uma função que chame a si mesma; com `minDepth`, o juiz
 * também mede (em C) a profundidade real de chamadas durante os testes.
 */
export type SourceRule =
  | { kind: "forbid"; pattern: string; message: string }
  | { kind: "require"; pattern: string; message: string }
  | { kind: "recursion"; message: string; minDepth?: number };

/** `stdio`: o programa lê a entrada e imprime. `function`: o aluno implementa uma função. */
export type ChallengeMode = "stdio" | "function";

export type ValueType =
  | "int"
  | "long"
  | "double"
  | "bool"
  | "string"
  | "int[]"
  | "double[]"
  | "string[]"
  | "int[][]"
  | "list"
  | "tree";

export interface FunctionSpec {
  name: string;
  params: Array<{ name: string; type: ValueType }>;
  returns: ValueType;
  /**
   * Parâmetro do tipo `list` que recebe um ciclo: o caso de teste traz um
   * argumento extra no fim (posição do nó para onde o último aponta, ou -1),
   * usado só pelo juiz e invisível para a função do aluno.
   */
  cycleParam?: string;
}

/** Como comparar a saída do aluno com a esperada. */
export type OutputChecker =
  | { kind: "exact" }
  | { kind: "tolerance"; epsilon: number }
  | { kind: "unordered-lines" }
  | { kind: "unordered-tokens" }
  | { kind: "custom"; code: string };

export interface ChallengeLanguage {
  language: SubmissionLanguage;
  sourceRules: SourceRule[];
  starterCode?: string;
}

export interface Complexity {
  time: string;
  space: string;
}

export type ExecutionStatus = "completed" | "runtime_error" | "timeout";

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
  languages: ChallengeLanguage[];
  mode: ChallengeMode;
  functionSpec: FunctionSpec | null;
  checker: OutputChecker;
  timeLimitMs: number | null;
  memoryLimitMb: number | null;
  topic: string;
  subtopic: string;
  moduleId: string | null;
  position: number;
  isBoss: boolean;
  hints: string[];
  editorial: string | null;
  complexity: Complexity | null;
  followUps: string[];
  testCases: TestCase[];
  isActive: boolean;
  /** Rascunho (false) só aparece para administradores. Ausente = publicado. */
  isPublished?: boolean;
  createdBy: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  estimatedMinutes: number;
  position: number;
}

export interface LearningModule {
  id: string;
  trackId: string;
  slug: string;
  title: string;
  objective: string;
  concept: string;
  estimatedMinutes: number;
  position: number;
  prerequisiteIds: string[];
  lessons: Lesson[];
}

export interface Track {
  id: string;
  slug: string;
  title: string;
  description: string;
  position: number;
  modules: LearningModule[];
}

export interface ChallengeUnlock {
  userId: string;
  challengeId: string;
  hintsRevealed: number;
  solutionRevealed: boolean;
}

export interface SubmissionTestResult {
  testCaseId: string;
  position: number;
  executionStatus: ExecutionStatus;
  isPublic: boolean;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  stderr?: string;
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
  totalTests: number;
  passedTests: number;
  errorMessage: string | null;
  compileWarnings: string | null;
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

// ---------- Conta ----------
export interface AccountStatus {
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export type AuthTokenKind = "password_reset" | "email_verification";

export interface AuthToken {
  id: string;
  userId: string;
  kind: AuthTokenKind;
  /** SHA-256 do token enviado por e-mail; o token em si nunca é guardado. */
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface UpdateUserInput {
  name?: string;
  passwordHash?: string;
  emailVerifiedAt?: Date;
}

// ---------- Turmas ----------
export interface ClassGroup {
  id: string;
  name: string;
  /** Código que os estudantes usam para entrar na turma. */
  code: string;
  ownerId: string;
  createdAt: Date;
}

export interface ClassMember {
  classId: string;
  userId: string;
  joinedAt: Date;
}
