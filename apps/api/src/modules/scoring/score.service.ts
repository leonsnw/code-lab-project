import type { Submission } from "../../domain/types.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { CompleteSubmissionInput } from "../../database/codelab-store.js";
import { calculateScoreAward } from "../../domain/scoring.js";

export class ScoreService {
  constructor(private readonly store: CodeLabStore) {}

  calculateAward(challengePoints: number, alreadySolved: boolean): number {
    return calculateScoreAward(challengePoints, alreadySolved);
  }

  completeSubmission(input: CompleteSubmissionInput): Promise<Submission> {
    return this.store.completeSubmission(input);
  }
}
