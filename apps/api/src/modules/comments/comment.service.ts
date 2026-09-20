import { randomUUID } from "node:crypto";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Comment } from "../../domain/types.js";

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
      throw new DomainError("Comentario nao pode estar vazio.", 400);
    }
    if (content.length > 1000) {
      throw new DomainError(
        "Comentario deve ter no maximo 1000 caracteres.",
        400
      );
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
    if (!challenge || !challenge.isActive) {
      throw new DomainError("Desafio nao encontrado.", 404);
    }
    return challenge;
  }
}
