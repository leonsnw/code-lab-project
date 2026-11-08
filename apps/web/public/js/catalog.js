import { api } from "./api.js";

// As submissões trazem apenas o challengeId; o catálogo resolve título e slug.
export async function loadCatalog() {
  const { challenges } = await api.challenges();
  return {
    challenges,
    byId: new Map(challenges.map((challenge) => [challenge.id, challenge]))
  };
}
