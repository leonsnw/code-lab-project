import { describe, expect, it } from "vitest";
import { DomainError } from "../../common/domain-error.js";
import { InMemoryStore } from "../../database/in-memory-store.js";
import { AdminChallengeService } from "./admin-challenge.service.js";

const challengeInput = {
  title: "Soma de uma Lista",
  slug: "soma-de-uma-lista",
  description: "Leia uma lista de inteiros e exiba a soma de todos os valores.",
  difficulty: "easy" as const,
  points: 120,
  constraints: ["A primeira linha informa a quantidade de valores."],
  tags: ["Arrays", "arrays", " Iniciante "],
  examples: [{ input: "3\n1 2 3", output: "6" }],
  testCases: [
    {
      input: "3\n1 2 3",
      expectedOutput: "6",
      isPublic: true,
      weight: 1
    },
    {
      input: "4\n-1 0 2 9",
      expectedOutput: "10",
      isPublic: false,
      weight: 2
    }
  ]
};

function makeService() {
  const ids = ["challenge-lista", "tc-lista-1", "tc-lista-2", "tc-editado"];
  return new AdminChallengeService(
    new InMemoryStore(),
    () => ids.shift() ?? "id-extra"
  );
}

describe("AdminChallengeService", () => {
  it("cria desafio completo atribuindo a autoria ao administrador", async () => {
    const service = makeService();

    const challenge = await service.create("user-admin", challengeInput);

    expect(challenge).toMatchObject({
      id: "challenge-lista",
      createdBy: "user-admin",
      title: "Soma de uma Lista",
      slug: "soma-de-uma-lista",
      isActive: true,
      tags: ["Arrays", "Iniciante"]
    });
    expect(challenge.testCases).toEqual([
      expect.objectContaining({
        id: "tc-lista-1",
        challengeId: "challenge-lista",
        isPublic: true
      }),
      expect.objectContaining({
        id: "tc-lista-2",
        challengeId: "challenge-lista",
        isPublic: false
      })
    ]);
  });

  it("rejeita slug duplicado", async () => {
    const service = makeService();

    await expect(
      service.create("user-admin", {
        ...challengeInput,
        slug: "soma-de-dois-numeros"
      })
    ).rejects.toEqual(new DomainError("Slug de desafio já utilizado.", 409));
  });

  it("edita os dados sem alterar id ou criador", async () => {
    const service = makeService();
    const created = await service.create("user-admin", challengeInput);

    const updated = await service.update(created.id, {
      ...challengeInput,
      title: "Soma dos Elementos",
      slug: "soma-dos-elementos",
      difficulty: "medium",
      points: 180,
      testCases: challengeInput.testCases
    });

    expect(updated).toMatchObject({
      id: "challenge-lista",
      createdBy: "user-admin",
      title: "Soma dos Elementos",
      slug: "soma-dos-elementos",
      difficulty: "medium",
      points: 180
    });
    expect(updated.testCases).toHaveLength(2);
    expect(updated.testCases[0].id).toBe("tc-editado");
  });

  it("desativa o desafio, removendo-o do catalogo publico", async () => {
    const store = new InMemoryStore();
    const service = new AdminChallengeService(store);

    const removed = await service.remove("challenge-soma");
    const publicChallenges = await store.listChallenges();
    const adminChallenges = await service.list();

    expect(removed.isActive).toBe(false);
    expect(publicChallenges.some((item) => item.id === "challenge-soma")).toBe(
      false
    );
    expect(
      adminChallenges.find((item) => item.id === "challenge-soma")?.isActive
    ).toBe(false);
  });

  it("exige casos publicos e ocultos para evitar submissão baseada em gabarito visivel", async () => {
    const service = makeService();

    await expect(
      service.create("user-admin", {
        ...challengeInput,
        testCases: [challengeInput.testCases[0]]
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: "Cadastre ao menos um caso público e um caso oculto."
        })
      ])
    });

    await expect(
      service.create("user-admin", {
        ...challengeInput,
        testCases: challengeInput.testCases.map((testCase) => ({
          ...testCase,
          isPublic: true
        }))
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: "Cadastre ao menos um caso de teste oculto." })
      ])
    });
  });
});
