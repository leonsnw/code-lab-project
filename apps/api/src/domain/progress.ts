import type { Difficulty, UserProgress } from "./types.js";

interface ProgressChallenge {
  id: string;
  difficulty: Difficulty;
}

const difficulties: Difficulty[] = ["easy", "medium", "hard"];

export function buildUserProgress(
  challenges: ProgressChallenge[],
  solvedChallengeIds: string[]
): UserProgress {
  const solvedIds = new Set(solvedChallengeIds);
  const solvedChallenges = challenges.filter((challenge) =>
    solvedIds.has(challenge.id)
  ).length;

  return {
    totalChallenges: challenges.length,
    solvedChallenges,
    pendingChallenges: challenges.length - solvedChallenges,
    byDifficulty: difficulties.map((difficulty) => {
      const atDifficulty = challenges.filter(
        (challenge) => challenge.difficulty === difficulty
      );
      const solved = atDifficulty.filter((challenge) =>
        solvedIds.has(challenge.id)
      ).length;
      const total = atDifficulty.length;

      return {
        difficulty,
        total,
        solved,
        percentage: total === 0 ? 0 : Math.round((solved / total) * 100)
      };
    })
  };
}
