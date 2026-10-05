import { describe, expect, it } from "vitest";
import { DomainError } from "../../common/domain-error.js";
import { InMemoryStore } from "../../database/in-memory-store.js";
import { CommentService } from "./comment.service.js";

describe("CommentService", () => {
  it("registra o comentario normalizado com a autoria da sessao", async () => {
    const service = new CommentService(
      new InMemoryStore(),
      () => "comment-1",
      () => new Date("2026-08-04T20:00:00.000Z")
    );

    const comment = await service.create({
      challengeSlug: "soma-de-dois-numeros",
      userId: "user-marina",
      content: "  Gostei dos casos de teste.  "
    });

    expect(comment).toMatchObject({
      id: "comment-1",
      userId: "user-marina",
      challengeId: "challenge-soma",
      content: "Gostei dos casos de teste.",
      author: { id: "user-marina", name: "Marina Silva" }
    });
  });

  it("rejeita comentario vazio e desafio inexistente", async () => {
    const service = new CommentService(new InMemoryStore());

    await expect(
      service.create({
        challengeSlug: "soma-de-dois-numeros",
        userId: "user-marina",
        content: "   "
      })
    ).rejects.toEqual(new DomainError("O comentário não pode estar vazio.", 400));

    await expect(service.list("desafio-inexistente")).rejects.toEqual(
      new DomainError("Desafio não encontrado.", 404)
    );
  });
});
