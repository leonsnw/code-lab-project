import { randomUUID } from "node:crypto";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Rating, RatingSummary } from "../../domain/types.js";

export interface RateChallengeInput {
  challengeSlug: string;
  userId: string;
  value: number;
}

export interface RatingResult {
  rating: Rating;
  summary: RatingSummary;
}

export class RatingService {
  constructor(
    private readonly store: CodeLabStore,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date()
  ) {}

  async getSummary(
    challengeSlug: string,
    userId: string
  ): Promise<RatingSummary> {
    const challenge = await this.findChallenge(challengeSlug);
    return this.store.getRatingSummary(challenge.id, userId);
  }

  async rate(input: RateChallengeInput): Promise<RatingResult> {
    if (
      !Number.isInteger(input.value) ||
      input.value < 1 ||
      input.value > 5
    ) {
      throw new DomainError(
        "A avaliacao deve ser um numero inteiro entre 1 e 5.",
        400
      );
    }

    const challenge = await this.findChallenge(input.challengeSlug);
    const timestamp = this.now();
    const rating = await this.store.upsertRating({
      id: this.createId(),
      userId: input.userId,
      challengeId: challenge.id,
      value: input.value,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    const summary = await this.store.getRatingSummary(
      challenge.id,
      input.userId
    );
    return { rating, summary };
  }

  private async findChallenge(challengeSlug: string) {
    const challenge = await this.store.findChallengeBySlug(challengeSlug);
    if (!challenge || !challenge.isActive) {
      throw new DomainError("Desafio nao encontrado.", 404);
    }
    return challenge;
  }
}
