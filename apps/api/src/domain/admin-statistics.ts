import type {
  Difficulty,
  SubmissionStatus,
  UserRole
} from "./types.js";

export interface AdminStatisticsData {
  users: Array<{
    id: string;
    name: string;
    role: UserRole;
    totalPoints: number;
  }>;
  challenges: Array<{
    id: string;
    title: string;
    slug: string;
    difficulty: Difficulty;
    isActive: boolean;
  }>;
  submissions: Array<{
    challengeId: string;
    userId: string;
    status: SubmissionStatus;
  }>;
  comments: Array<{ challengeId: string }>;
  ratings: Array<{ challengeId: string; value: number }>;
}

export interface ChallengePerformanceStatistics {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  isActive: boolean;
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
  errorRate: number;
  participants: number;
  solvers: number;
  totalComments: number;
  totalRatings: number;
  averageRating: number;
}

export interface DifficultyPerformanceStatistics {
  difficulty: Difficulty;
  totalChallenges: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
  participants: number;
  solvers: number;
}

export interface UserPerformanceStatistics {
  id: string;
  name: string;
  role: UserRole;
  totalPoints: number;
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number;
  solvedChallenges: number;
}

export interface AdminStatistics {
  overview: {
    totalUsers: number;
    totalStudents: number;
    totalAdmins: number;
    totalChallenges: number;
    activeChallenges: number;
    inactiveChallenges: number;
    totalSubmissions: number;
    acceptedSubmissions: number;
    acceptanceRate: number;
    totalComments: number;
    totalRatings: number;
    averageRating: number;
  };
  submissionStatuses: Record<SubmissionStatus, number>;
  challenges: ChallengePerformanceStatistics[];
  difficulties: DifficultyPerformanceStatistics[];
  users: UserPerformanceStatistics[];
  highlights: {
    mostSolvedChallenge: {
      id: string;
      title: string;
      solvers: number;
    } | null;
    highestErrorRateChallenge: {
      id: string;
      title: string;
      errorRate: number;
    } | null;
  };
}

interface ChallengeAccumulator {
  totalSubmissions: number;
  acceptedSubmissions: number;
  participants: Set<string>;
  solvers: Set<string>;
  totalComments: number;
  totalRatings: number;
  ratingSum: number;
}

interface UserAccumulator {
  totalSubmissions: number;
  acceptedSubmissions: number;
  solvedChallenges: Set<string>;
}

export function buildAdminStatistics(
  data: AdminStatisticsData
): AdminStatistics {
  const submissionStatuses: Record<SubmissionStatus, number> = {
    pending: 0,
    accepted: 0,
    wrong_answer: 0,
    runtime_error: 0,
    timeout: 0
  };
  const byChallenge = new Map<string, ChallengeAccumulator>();
  const challengeById = new Map(
    data.challenges.map((challenge) => [challenge.id, challenge])
  );
  const byDifficulty = new Map<Difficulty, ChallengeAccumulator>([
    ["easy", createChallengeAccumulator()],
    ["medium", createChallengeAccumulator()],
    ["hard", createChallengeAccumulator()]
  ]);
  const byUser = new Map<string, UserAccumulator>();
  for (const challenge of data.challenges) {
    byChallenge.set(challenge.id, createChallengeAccumulator());
  }
  for (const user of data.users) {
    byUser.set(user.id, createUserAccumulator());
  }

  for (const submission of data.submissions) {
    submissionStatuses[submission.status] += 1;
    const accumulator = byChallenge.get(submission.challengeId);
    const challenge = challengeById.get(submission.challengeId);
    const difficultyAccumulator = challenge
      ? byDifficulty.get(challenge.difficulty)
      : undefined;
    const userAccumulator = byUser.get(submission.userId);
    if (!accumulator || !difficultyAccumulator) continue;
    accumulator.totalSubmissions += 1;
    accumulator.participants.add(submission.userId);
    difficultyAccumulator.totalSubmissions += 1;
    difficultyAccumulator.participants.add(submission.userId);
    if (userAccumulator) userAccumulator.totalSubmissions += 1;
    if (submission.status === "accepted") {
      accumulator.acceptedSubmissions += 1;
      accumulator.solvers.add(submission.userId);
      difficultyAccumulator.acceptedSubmissions += 1;
      difficultyAccumulator.solvers.add(submission.userId);
      if (userAccumulator) {
        userAccumulator.acceptedSubmissions += 1;
        userAccumulator.solvedChallenges.add(submission.challengeId);
      }
    }
  }
  for (const comment of data.comments) {
    const accumulator = byChallenge.get(comment.challengeId);
    if (accumulator) accumulator.totalComments += 1;
  }
  for (const rating of data.ratings) {
    const accumulator = byChallenge.get(rating.challengeId);
    if (!accumulator) continue;
    accumulator.totalRatings += 1;
    accumulator.ratingSum += rating.value;
  }

  const acceptedSubmissions = submissionStatuses.accepted;
  const ratingSum = data.ratings.reduce(
    (total, rating) => total + rating.value,
    0
  );
  const activeChallenges = data.challenges.filter(
    (challenge) => challenge.isActive
  ).length;
  const challengeStatistics = data.challenges
    .map((challenge) => {
      const metrics = byChallenge.get(challenge.id) ??
        createChallengeAccumulator();
      return {
        ...challenge,
        totalSubmissions: metrics.totalSubmissions,
        acceptedSubmissions: metrics.acceptedSubmissions,
        acceptanceRate: percentage(
          metrics.acceptedSubmissions,
          metrics.totalSubmissions
        ),
        errorRate: percentage(
          metrics.totalSubmissions - metrics.acceptedSubmissions,
          metrics.totalSubmissions
        ),
        participants: metrics.participants.size,
        solvers: metrics.solvers.size,
        totalComments: metrics.totalComments,
        totalRatings: metrics.totalRatings,
        averageRating: average(metrics.ratingSum, metrics.totalRatings)
      };
    })
    .sort(
      (first, second) =>
        second.totalSubmissions - first.totalSubmissions ||
        first.title.localeCompare(second.title, "pt-BR")
    );

  return {
    overview: {
      totalUsers: data.users.length,
      totalStudents: data.users.filter((user) => user.role === "student").length,
      totalAdmins: data.users.filter((user) => user.role === "admin").length,
      totalChallenges: data.challenges.length,
      activeChallenges,
      inactiveChallenges: data.challenges.length - activeChallenges,
      totalSubmissions: data.submissions.length,
      acceptedSubmissions,
      acceptanceRate: percentage(acceptedSubmissions, data.submissions.length),
      totalComments: data.comments.length,
      totalRatings: data.ratings.length,
      averageRating: average(ratingSum, data.ratings.length)
    },
    submissionStatuses,
    challenges: challengeStatistics,
    difficulties: (["easy", "medium", "hard"] as Difficulty[]).map(
      (difficulty) => {
        const metrics = byDifficulty.get(difficulty) ??
          createChallengeAccumulator();
        return {
          difficulty,
          totalChallenges: data.challenges.filter(
            (challenge) => challenge.difficulty === difficulty
          ).length,
          totalSubmissions: metrics.totalSubmissions,
          acceptedSubmissions: metrics.acceptedSubmissions,
          acceptanceRate: percentage(
            metrics.acceptedSubmissions,
            metrics.totalSubmissions
          ),
          participants: metrics.participants.size,
          solvers: metrics.solvers.size
        };
      }
    ),
    users: data.users
      .map((user) => {
        const metrics = byUser.get(user.id) ?? createUserAccumulator();
        return {
          ...user,
          totalSubmissions: metrics.totalSubmissions,
          acceptedSubmissions: metrics.acceptedSubmissions,
          acceptanceRate: percentage(
            metrics.acceptedSubmissions,
            metrics.totalSubmissions
          ),
          solvedChallenges: metrics.solvedChallenges.size
        };
      })
      .sort(
        (first, second) =>
          second.totalPoints - first.totalPoints ||
          second.solvedChallenges - first.solvedChallenges ||
          first.name.localeCompare(second.name, "pt-BR")
      ),
    highlights: buildHighlights(challengeStatistics)
  };
}

function createChallengeAccumulator(): ChallengeAccumulator {
  return {
    totalSubmissions: 0,
    acceptedSubmissions: 0,
    participants: new Set(),
    solvers: new Set(),
    totalComments: 0,
    totalRatings: 0,
    ratingSum: 0
  };
}

function createUserAccumulator(): UserAccumulator {
  return {
    totalSubmissions: 0,
    acceptedSubmissions: 0,
    solvedChallenges: new Set()
  };
}

function buildHighlights(challenges: ChallengePerformanceStatistics[]) {
  const withSubmissions = challenges.filter(
    (challenge) => challenge.totalSubmissions > 0
  );
  const mostSolved = withSubmissions
    .filter((challenge) => challenge.solvers > 0)
    .sort(
    (first, second) =>
      second.solvers - first.solvers ||
      second.totalSubmissions - first.totalSubmissions ||
      first.title.localeCompare(second.title, "pt-BR")
    )[0];
  const highestErrorRate = [...withSubmissions].sort(
    (first, second) =>
      second.errorRate - first.errorRate ||
      second.totalSubmissions - first.totalSubmissions ||
      first.title.localeCompare(second.title, "pt-BR")
  )[0];

  return {
    mostSolvedChallenge: mostSolved
      ? { id: mostSolved.id, title: mostSolved.title, solvers: mostSolved.solvers }
      : null,
    highestErrorRateChallenge: highestErrorRate
      ? {
          id: highestErrorRate.id,
          title: highestErrorRate.title,
          errorRate: highestErrorRate.errorRate
        }
      : null
  };
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0
    ? 0
    : Number(((numerator / denominator) * 100).toFixed(1));
}

function average(total: number, count: number): number {
  return count === 0 ? 0 : Number((total / count).toFixed(1));
}
