export function calculateScoreAward(
  challengePoints: number,
  alreadySolved: boolean
): number {
  if (!Number.isInteger(challengePoints) || challengePoints <= 0) {
    throw new Error("A pontuacao do desafio deve ser um inteiro positivo.");
  }

  return alreadySolved ? 0 : challengePoints;
}
