import { describe, expect, it } from "vitest";
import { DomainError } from "../../common/domain-error.js";
import { InMemoryStore } from "../../database/in-memory-store.js";
import { RatingService } from "./rating.service.js";

describe("RatingService", () => {
  it("atualiza o voto do mesmo usuário sem aumentar a quantidade", async () => {
    const service = new RatingService(
      new InMemoryStore(),
      () => "rating-1",
      () => new Date("2026-08-04T20:00:00.000Z")
    );

    await service.rate({
      challengeSlug: "soma-de-dois-numeros",
      userId: "user-marina",
      value: 3
    });
    const result = await service.rate({
      challengeSlug: "soma-de-dois-numeros",
      userId: "user-marina",
      value: 5
    });

    expect(result.rating.value).toBe(5);
    expect(result.summary).toEqual({
      average: 5,
      total: 1,
      currentUserValue: 5
    });
  });

  it.each([0, 6, 4.5])("rejeita a nota inválida %s", async (value) => {
    const service = new RatingService(new InMemoryStore());

    await expect(
      service.rate({
        challengeSlug: "soma-de-dois-numeros",
        userId: "user-marina",
        value
      })
    ).rejects.toEqual(
      new DomainError("A avaliação deve ser um número inteiro entre 1 e 5.", 400)
    );
  });
});
