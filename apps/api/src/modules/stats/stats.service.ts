import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Challenge, Submission, SubmissionLanguage, Track } from "../../domain/types.js";

/** Dias contados no fuso de quem usa a plataforma (Brasil). */
const TIME_ZONE = "America/Sao_Paulo";
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export const dayKey = (date: Date) => DAY_FORMAT.format(date);

const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_DAYS = 365;

function previousDay(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - DAY_MS).toISOString().slice(0, 10);
}

/**
 * Sequência atual (dias seguidos com atividade terminando hoje, ou ontem se
 * ainda não houve atividade hoje) e a maior sequência já feita.
 */
export function computeStreaks(activeDays: Set<string>, today: string): { current: number; longest: number } {
  let current = 0;
  let cursor = activeDays.has(today) ? today : previousDay(today);
  while (activeDays.has(cursor)) {
    current += 1;
    cursor = previousDay(cursor);
  }
  let longest = 0;
  for (const day of activeDays) {
    if (activeDays.has(previousDay(day))) continue;
    let length = 0;
    let next = day;
    while (activeDays.has(next)) {
      length += 1;
      const [year, month, date] = next.split("-").map(Number);
      next = new Date(Date.UTC(year, month - 1, date) + DAY_MS).toISOString().slice(0, 10);
    }
    longest = Math.max(longest, length);
  }
  return { current, longest };
}

/** Tempo de uma submissão aceita: o caso mais lento, como no veredito. */
export function runtimeOf(submission: Submission): number | null {
  if (submission.status !== "accepted" || submission.testResults.length === 0) return null;
  return Math.max(...submission.testResults.map((test) => test.durationMs));
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  earnedAt: string | null;
}

interface BadgeContext {
  submissions: Submission[];
  challenges: Map<string, Challenge>;
  tracks: Track[];
  longestStreak: number;
  streakDates: string[];
}

/** Conquistas derivadas do histórico (nada novo é gravado no banco). */
function computeBadges({ submissions, challenges, tracks, longestStreak, streakDates }: BadgeContext): Badge[] {
  const chronological = [...submissions].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  const firstAccepted = new Map<string, Date>();
  for (const submission of chronological) {
    if (submission.status === "accepted" && !firstAccepted.has(submission.challengeId)) {
      firstAccepted.set(submission.challengeId, submission.submittedAt);
    }
  }
  const solvedDates = [...firstAccepted.values()].sort((a, b) => a.getTime() - b.getTime());
  const nth = (count: number) => solvedDates[count - 1]?.toISOString() ?? null;

  const firstTry = chronological.find((submission) => {
    if (submission.status !== "accepted") return false;
    const challenge = challenges.get(submission.challengeId);
    if (!challenge || challenge.difficulty === "easy") return false;
    const earlier = chronological.filter((item) => item.challengeId === submission.challengeId && item.submittedAt < submission.submittedAt);
    return earlier.length === 0;
  });

  const boss = chronological.find((submission) => submission.status === "accepted" && challenges.get(submission.challengeId)?.isBoss);

  const acceptedLanguages = new Map<SubmissionLanguage, Date>();
  for (const submission of chronological) {
    if (submission.status === "accepted" && !acceptedLanguages.has(submission.language)) {
      acceptedLanguages.set(submission.language, submission.submittedAt);
    }
  }
  const polyglot = acceptedLanguages.size >= 3 ? [...acceptedLanguages.values()].sort((a, b) => a.getTime() - b.getTime())[2] : null;

  const badges: Badge[] = [
    { id: "primeiro-aceito", title: "Primeiro aceito", description: "Resolveu o primeiro desafio.", earnedAt: nth(1) },
    { id: "dez-resolvidos", title: "Dez na conta", description: "Resolveu 10 desafios.", earnedAt: nth(10) },
    { id: "vinte-e-cinco-resolvidos", title: "Pegando o ritmo", description: "Resolveu 25 desafios.", earnedAt: nth(25) },
    { id: "cinquenta-resolvidos", title: "Meio centenário", description: "Resolveu 50 desafios.", earnedAt: nth(50) },
    { id: "cem-resolvidos", title: "Centenário", description: "Resolveu 100 desafios.", earnedAt: nth(100) },
    { id: "de-primeira", title: "De primeira", description: "Resolveu um desafio médio ou difícil na primeira submissão.", earnedAt: firstTry?.submittedAt.toISOString() ?? null },
    { id: "chefe", title: "Chefe derrotado", description: "Resolveu o desafio final de um módulo.", earnedAt: boss?.submittedAt.toISOString() ?? null },
    { id: "poliglota", title: "Poliglota", description: "Teve soluções aceitas em JavaScript, Python e C.", earnedAt: polyglot?.toISOString() ?? null },
    { id: "sequencia-7", title: "Uma semana seguida", description: "Praticou 7 dias seguidos.", earnedAt: longestStreak >= 7 ? streakDates[6] ?? null : null },
    { id: "sequencia-30", title: "Um mês seguido", description: "Praticou 30 dias seguidos.", earnedAt: longestStreak >= 30 ? streakDates[29] ?? null : null }
  ];

  for (const track of tracks) {
    const moduleIds = new Set(track.modules.map((module) => module.id));
    const trackChallenges = [...challenges.values()].filter((challenge) => challenge.isActive && challenge.moduleId && moduleIds.has(challenge.moduleId));
    const dates = trackChallenges.map((challenge) => firstAccepted.get(challenge.id));
    const complete = trackChallenges.length > 0 && dates.every(Boolean);
    badges.push({
      id: `trilha-${track.slug}`,
      title: `Trilha concluída: ${track.title}`,
      description: `Resolveu todos os ${trackChallenges.length} desafios da trilha.`,
      earnedAt: complete ? new Date(Math.max(...dates.map((date) => date!.getTime()))).toISOString() : null
    });
  }
  return badges;
}

/** Data em que a maior sequência atingiu cada tamanho (para datar as conquistas de sequência). */
function streakMilestones(activeDays: Set<string>): string[] {
  let best: string[] = [];
  for (const day of [...activeDays].sort()) {
    if (activeDays.has(previousDay(day))) continue;
    const run: string[] = [];
    let next = day;
    while (activeDays.has(next)) {
      run.push(next);
      const [year, month, date] = next.split("-").map(Number);
      next = new Date(Date.UTC(year, month - 1, date) + DAY_MS).toISOString().slice(0, 10);
    }
    if (run.length > best.length) best = run;
  }
  return best.map((day) => `${day}T12:00:00.000Z`);
}

export type RankingPeriod = "semana" | "mes" | "tudo";

export class StatsService {
  constructor(private readonly store: CodeLabStore, private readonly now: () => Date = () => new Date()) {}

  /** Atividade diária, sequência e conquistas de um usuário. */
  async activity(userId: string) {
    const [submissions, allChallenges, tracks] = await Promise.all([
      this.store.listSubmissions(userId),
      this.store.listAllChallenges(),
      this.store.listTracks()
    ]);
    const challenges = new Map(allChallenges.map((challenge) => [challenge.id, challenge]));
    const today = dayKey(this.now());
    const counts = new Map<string, { submissions: number; accepted: number }>();
    for (const submission of submissions) {
      const key = dayKey(submission.submittedAt);
      const entry = counts.get(key) ?? { submissions: 0, accepted: 0 };
      entry.submissions += 1;
      if (submission.status === "accepted") entry.accepted += 1;
      counts.set(key, entry);
    }
    const activeDays = new Set(counts.keys());
    const streaks = computeStreaks(activeDays, today);

    const days: Array<{ date: string; submissions: number; accepted: number }> = [];
    let cursor = today;
    for (let index = 0; index < HEATMAP_DAYS; index += 1) {
      days.push({ date: cursor, ...(counts.get(cursor) ?? { submissions: 0, accepted: 0 }) });
      cursor = previousDay(cursor);
    }
    days.reverse();

    return {
      today,
      days,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      activeDays: activeDays.size,
      badges: computeBadges({ submissions, challenges, tracks, longestStreak: streaks.longest, streakDates: streakMilestones(activeDays) })
    };
  }

  /** Distribuição dos tempos das soluções aceitas (melhor tempo de cada pessoa). */
  async runtime(challenge: Challenge, language: SubmissionLanguage, userId: string, runtimeMs?: number) {
    const accepted = (await this.store.listSubmissions(undefined, challenge.id, "accepted")).filter(
      (submission) => submission.language === language
    );
    const best = new Map<string, number>();
    for (const submission of accepted) {
      const runtime = runtimeOf(submission);
      if (runtime === null) continue;
      best.set(submission.userId, Math.min(best.get(submission.userId) ?? Infinity, runtime));
    }
    const mine = runtimeMs ?? best.get(userId) ?? null;
    const others = [...best.entries()].filter(([owner]) => owner !== userId).map(([, runtime]) => runtime);
    const values = [...best.values()];
    const buckets: Array<{ fromMs: number; toMs: number; count: number }> = [];
    if (values.length) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const size = Math.max(1, Math.ceil((max - min + 1) / 10));
      for (let from = min; from <= max; from += size) {
        buckets.push({ fromMs: from, toMs: from + size - 1, count: values.filter((value) => value >= from && value < from + size).length });
      }
    }
    return {
      language,
      solutions: values.length,
      runtimeMs: mine,
      beatsPercent: mine === null || others.length === 0 ? null : Math.round((others.filter((value) => value > mine).length / others.length) * 100),
      buckets
    };
  }

  /** Ranking por período e, opcionalmente, só com os desafios de uma trilha. */
  async ranking(period: RankingPeriod, trackSlug?: string) {
    if (period === "tudo" && !trackSlug) {
      return this.store.getRanking();
    }
    const [submissions, challenges, tracks] = await Promise.all([
      this.store.listSubmissions(undefined, undefined, "accepted"),
      this.store.listAllChallenges(),
      this.store.listTracks()
    ]);
    let challengeIds: Set<string> | null = null;
    if (trackSlug) {
      const track = tracks.find((item) => item.slug === trackSlug);
      if (!track) throw new DomainError("Trilha não encontrada.", 404);
      const moduleIds = new Set(track.modules.map((module) => module.id));
      challengeIds = new Set(challenges.filter((challenge) => challenge.moduleId && moduleIds.has(challenge.moduleId)).map((challenge) => challenge.id));
    }
    const since = period === "tudo" ? 0 : this.now().getTime() - (period === "semana" ? 7 : 30) * DAY_MS;
    const totals = new Map<string, { points: number; solved: Set<string> }>();
    for (const submission of submissions) {
      if (submission.submittedAt.getTime() < since) continue;
      if (challengeIds && !challengeIds.has(submission.challengeId)) continue;
      const entry = totals.get(submission.userId) ?? { points: 0, solved: new Set<string>() };
      // Pontos só entram na primeira solução aceita (scoreAwarded > 0).
      entry.points += submission.scoreAwarded;
      if (submission.scoreAwarded > 0 || period === "tudo") entry.solved.add(submission.challengeId);
      totals.set(submission.userId, entry);
    }
    const entries = await Promise.all(
      [...totals.entries()].map(async ([userId, entry]) => ({
        userId,
        name: (await this.store.findUserById(userId))?.name ?? "Usuário removido",
        totalPoints: entry.points,
        solvedChallenges: entry.solved.size
      }))
    );
    return entries.filter((entry) => entry.totalPoints > 0 || entry.solvedChallenges > 0).sort((a, b) => b.totalPoints - a.totalPoints || b.solvedChallenges - a.solvedChallenges || a.name.localeCompare(b.name));
  }

  /** Perfil público: só nome e estatísticas de prática (nunca o e-mail). */
  async publicProfile(userId: string) {
    const user = await this.store.findUserById(userId);
    if (!user) throw new DomainError("Usuário não encontrado.", 404);
    const [score, activity, submissions, challenges, tracks, ranking] = await Promise.all([
      this.store.getScore(userId),
      this.activity(userId),
      this.store.listSubmissions(userId, undefined, "accepted"),
      this.store.listAllChallenges(),
      this.store.listTracks(),
      this.store.getRanking()
    ]);
    const byId = new Map(challenges.map((challenge) => [challenge.id, challenge]));
    const solved = score.solvedChallengeIds.map((id) => byId.get(id)).filter((challenge): challenge is Challenge => Boolean(challenge));
    const byDifficulty = { easy: 0, medium: 0, hard: 0 };
    solved.forEach((challenge) => (byDifficulty[challenge.difficulty] += 1));
    const byTrack = tracks.map((track) => {
      const moduleIds = new Set(track.modules.map((module) => module.id));
      const total = challenges.filter((challenge) => challenge.isActive && challenge.moduleId && moduleIds.has(challenge.moduleId)).length;
      const done = solved.filter((challenge) => challenge.moduleId && moduleIds.has(challenge.moduleId)).length;
      return { slug: track.slug, title: track.title, done, total };
    });
    const recent = [...submissions]
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
      .filter((submission, index, list) => list.findIndex((item) => item.challengeId === submission.challengeId) === index)
      .slice(0, 8)
      .map((submission) => {
        const challenge = byId.get(submission.challengeId);
        return { slug: challenge?.slug ?? "", title: challenge?.title ?? "Desafio removido", difficulty: challenge?.difficulty ?? "easy", language: submission.language, solvedAt: submission.submittedAt.toISOString() };
      });
    const position = ranking.findIndex((entry) => entry.userId === userId);
    return {
      user: { id: user.id, name: user.name },
      totalPoints: score.totalPoints,
      rankingPosition: position >= 0 ? position + 1 : null,
      solvedChallenges: solved.length,
      byDifficulty,
      byTrack,
      recent,
      activity
    };
  }
}
