import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Challenge, LearningModule, Lesson, Track } from "../../domain/types.js";
import { presentChallengeSummary } from "../challenges/challenge.routes.js";

export type ModuleItem =
  | { type: "lesson"; id: string; slug: string; title: string; estimatedMinutes: number }
  | { type: "challenge"; id: string; slug: string; title: string; difficulty: Challenge["difficulty"]; isBoss: boolean };

export interface NextStep {
  type: ModuleItem["type"];
  slug: string;
  title: string;
  trackSlug: string;
  trackTitle: string;
  moduleSlug: string;
  moduleTitle: string;
}

/** Itens de um módulo na ordem de estudo: lições primeiro, depois os desafios. */
function moduleItems(module: LearningModule, challenges: Challenge[]): ModuleItem[] {
  const lessons = module.lessons.map((lesson): ModuleItem => ({
    type: "lesson",
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    estimatedMinutes: lesson.estimatedMinutes
  }));
  const moduleChallenges = challenges
    .filter((challenge) => challenge.moduleId === module.id)
    .sort((a, b) => Number(a.isBoss) - Number(b.isBoss) || a.position - b.position)
    .map((challenge): ModuleItem => ({
      type: "challenge",
      id: challenge.id,
      slug: challenge.slug,
      title: challenge.title,
      difficulty: challenge.difficulty,
      isBoss: challenge.isBoss
    }));
  return [...lessons, ...moduleChallenges];
}

export class LearningService {
  constructor(private readonly store: CodeLabStore) {}

  async catalog() {
    const [tracks, challenges] = await Promise.all([this.store.listTracks(), this.store.listChallenges()]);
    return {
      tracks: tracks.map((track) => ({
        id: track.id,
        slug: track.slug,
        title: track.title,
        description: track.description,
        modules: track.modules.map((module) => ({
          id: module.id,
          slug: module.slug,
          title: module.title,
          objective: module.objective,
          concept: module.concept,
          estimatedMinutes: module.estimatedMinutes,
          prerequisiteIds: module.prerequisiteIds,
          lessons: module.lessons.map(({ content: _content, ...lesson }) => lesson),
          challenges: challenges
            .filter((challenge) => challenge.moduleId === module.id)
            .sort((a, b) => Number(a.isBoss) - Number(b.isBoss) || a.position - b.position)
            .map(presentChallengeSummary)
        }))
      }))
    };
  }

  async progress(userId: string) {
    const [tracks, challenges, completedLessonIds, score] = await Promise.all([
      this.store.listTracks(),
      this.store.listChallenges(),
      this.store.listLessonCompletions(userId),
      this.store.getScore(userId)
    ]);
    const done = new Set([...completedLessonIds, ...score.solvedChallengeIds]);
    const modules: Record<string, { done: number; total: number }> = {};
    const trackProgress: Record<string, { done: number; total: number }> = {};

    for (const track of tracks) {
      let trackDone = 0;
      let trackTotal = 0;
      for (const module of track.modules) {
        const items = moduleItems(module, challenges);
        const completed = items.filter((item) => done.has(item.id)).length;
        modules[module.id] = { done: completed, total: items.length };
        trackDone += completed;
        trackTotal += items.length;
      }
      trackProgress[track.id] = { done: trackDone, total: trackTotal };
    }

    return {
      completedLessonIds,
      solvedChallengeIds: score.solvedChallengeIds,
      modules,
      tracks: trackProgress,
      next: this.nextStep(tracks, challenges, done, trackProgress)
    };
  }

  /**
   * Próximo passo: na trilha em andamento (ou na primeira), o primeiro item
   * ainda não concluído, seguindo a ordem dos módulos.
   */
  private nextStep(
    tracks: Track[],
    challenges: Challenge[],
    done: Set<string>,
    trackProgress: Record<string, { done: number; total: number }>
  ): NextStep | null {
    const unfinished = tracks.filter((track) => trackProgress[track.id].done < trackProgress[track.id].total);
    const active = unfinished.find((track) => trackProgress[track.id].done > 0) ?? unfinished[0];
    if (!active) return null;
    for (const module of active.modules) {
      const item = moduleItems(module, challenges).find((candidate) => !done.has(candidate.id));
      if (item) {
        return {
          type: item.type,
          slug: item.slug,
          title: item.title,
          trackSlug: active.slug,
          trackTitle: active.title,
          moduleSlug: module.slug,
          moduleTitle: module.title
        };
      }
    }
    return null;
  }

  async lesson(slug: string) {
    const [tracks, challenges] = await Promise.all([this.store.listTracks(), this.store.listChallenges()]);
    for (const track of tracks) {
      for (const module of track.modules) {
        const lesson = module.lessons.find((item) => item.slug === slug);
        if (!lesson) continue;
        const items = moduleItems(module, challenges);
        const index = items.findIndex((item) => item.type === "lesson" && item.id === lesson.id);
        return {
          lesson,
          module: { id: module.id, slug: module.slug, title: module.title, objective: module.objective },
          track: { id: track.id, slug: track.slug, title: track.title },
          next: items[index + 1] ?? null,
          previous: items[index - 1] ?? null
        };
      }
    }
    throw new DomainError("Lição não encontrada.", 404);
  }

  async completeLesson(userId: string, slug: string): Promise<Lesson> {
    const { lesson } = await this.lesson(slug);
    await this.store.completeLesson(userId, lesson.id);
    return lesson;
  }
}
