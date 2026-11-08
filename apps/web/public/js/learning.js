import { api } from "./api.js";
import { getSession } from "./session.js";

// Catálogo de trilhas + progresso do estudante (quando logado).
export async function loadLearning() {
  const [catalog, progress] = await Promise.all([
    api.tracks(),
    getSession().user ? api.trackProgress().catch(() => null) : Promise.resolve(null)
  ]);
  const done = new Set([...(progress?.completedLessonIds ?? []), ...(progress?.solvedChallengeIds ?? [])]);
  return { tracks: catalog.tracks, progress, done };
}

export function itemHref(item) {
  return item.type === "lesson" ? `#/licoes/${item.slug}` : `#/desafios/${item.slug}`;
}
