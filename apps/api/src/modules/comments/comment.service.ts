import { randomUUID } from "node:crypto";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Comment } from "../../domain/types.js";

/** Comentários aceitam Markdown (código e ||spoiler||). */
export const MAX_COMMENT_LENGTH = 4000;

export interface CreateCommentInput {
  challengeSlug: string;
  userId: string;
  content: string;
}

export class CommentService {
  constructor(
    private readonly store: CodeLabStore,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date()
  ) {}

  async list(challengeSlug: string): Promise<Comment[]> {
    const challenge = await this.findChallenge(challengeSlug);
    return this.store.listComments(challenge.id);
  }

  async create(input: CreateCommentInput): Promise<Comment> {
    const content = input.content.trim();
    if (!content) {
      throw new DomainError("O comentário não pode estar vazio.", 400);
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      throw new DomainError(`O comentário deve ter no máximo ${MAX_COMMENT_LENGTH} caracteres.`, 400);
    }

    const challenge = await this.findChallenge(input.challengeSlug);
    const timestamp = this.now();
    return this.store.addComment({
      id: this.createId(),
      userId: input.userId,
      challengeId: challenge.id,
      content,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  private async findChallenge(challengeSlug: string) {
    const challenge = await this.store.findChallengeBySlug(challengeSlug);
    if (!challenge || !challenge.isActive || challenge.isPublished === false) {
      throw new DomainError("Desafio não encontrado.", 404);
    }
    return challenge;
  }
}
