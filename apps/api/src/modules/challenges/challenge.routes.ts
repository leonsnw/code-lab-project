import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { Challenge, ChallengeUnlock, SubmissionLanguage } from "../../domain/types.js";
import { getAuthenticatedUser } from "../auth/auth.middleware.js";
import { cSignature, cStructDefinitions, functionStarter } from "../submissions/harness.js";
import {
  DEFAULT_EVALUATION_LIMITS,
  DEFAULT_MEMORY_MB,
  LANGUAGE_TIME_FACTOR
} from "../submissions/submission-evaluation.service.js";
import { presentSubmission } from "../submissions/submission.presenter.js";

const challengeQuerySchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]).optional()
});

/** Tentativas necessárias antes de poder revelar a solução comentada. */
export const ATTEMPTS_BEFORE_SOLUTION = 3;

function limitsFor(challenge: Challenge, language: SubmissionLanguage) {
  const base = challenge.timeLimitMs ?? DEFAULT_EVALUATION_LIMITS.timeoutMs;
  return {
    timeoutMs: base * LANGUAGE_TIME_FACTOR[language],
    memoryLimitMb: challenge.memoryLimitMb ?? DEFAULT_MEMORY_MB[language],
    maxOutputBytes: DEFAULT_EVALUATION_LIMITS.maxOutputBytes
  };
}

export function presentChallengeSummary(challenge: Challenge) {
  return {
    id: challenge.id,
    slug: challenge.slug,
    title: challenge.title,
    difficulty: challenge.difficulty,
    points: challenge.points,
    description: challenge.description,
    languages: challenge.languages.map((entry) => entry.language),
    mode: challenge.mode,
    topic: challenge.topic,
    subtopic: challenge.subtopic,
    moduleId: challenge.moduleId,
    position: challenge.position,
    isBoss: challenge.isBoss,
    hasEditorial: Boolean(challenge.editorial),
    tags: challenge.tags
  };
}

export function createChallengeRouter(store: CodeLabStore, requireAuth: RequestHandler): Router {
  const router = Router();

  /** Rascunhos (não publicados) só aparecem para administradores, como pré-visualização. */
  async function loadChallenge(slug: string, allowDrafts = false): Promise<Challenge> {
    const challenge = await store.findChallengeBySlug(z.string().parse(slug));
    if (!challenge || !challenge.isActive || (challenge.isPublished === false && !allowDrafts)) {
      throw new DomainError("Desafio não encontrado.", 404);
    }
    return challenge;
  }

  async function helpState(userId: string, challenge: Challenge) {
    const [unlock, submissions] = await Promise.all([
      store.getChallengeUnlock(userId, challenge.id),
      store.listSubmissions(userId, challenge.id)
    ]);
    const solved = submissions.some((submission) => submission.status === "accepted");
    const current: ChallengeUnlock = unlock ?? { userId, challengeId: challenge.id, hintsRevealed: 0, solutionRevealed: false };
    return { unlock: current, solved, attempts: submissions.length, submissions };
  }

  function presentHelp(challenge: Challenge, state: Awaited<ReturnType<typeof helpState>>) {
    const editorialVisible = Boolean(challenge.editorial) && (state.solved || state.unlock.solutionRevealed);
    return {
      hints: challenge.hints.slice(0, state.unlock.hintsRevealed),
      hintsTotal: challenge.hints.length,
      editorial: editorialVisible ? challenge.editorial : null,
      hasEditorial: Boolean(challenge.editorial),
      solutionRevealed: state.unlock.solutionRevealed,
      canRevealSolution:
        Boolean(challenge.editorial) && !editorialVisible && state.attempts >= ATTEMPTS_BEFORE_SOLUTION,
      attemptsBeforeSolution: Math.max(0, ATTEMPTS_BEFORE_SOLUTION - state.attempts),
      followUps: state.solved ? challenge.followUps : []
    };
  }

  router.get("/", async (request, response) => {
    const query = challengeQuerySchema.parse(request.query);
    const challenges = (await store.listChallenges(query.difficulty)).map(presentChallengeSummary);
    response.json({ challenges });
  });

  router.get("/:slug", requireAuth, async (request, response) => {
    const user = getAuthenticatedUser(response);
    const challenge = await loadChallenge(request.params.slug as string, user.role === "admin");
    const [score, state] = await Promise.all([store.getScore(user.id), helpState(user.id, challenge)]);

    response.json({
      challenge: {
        ...presentChallengeSummary(challenge),
        constraints: challenge.constraints,
        examples: challenge.examples,
        publicTestCases: challenge.testCases
          .filter((testCase) => testCase.isPublic)
          .map((testCase) => ({ id: testCase.id, input: testCase.input, expectedOutput: testCase.expectedOutput })),
        testCaseCount: challenge.testCases.length,
        functionSpec: challenge.functionSpec,
        checker: challenge.checker.kind,
        complexity: challenge.complexity,
        languageOptions: challenge.languages.map((entry) => ({
          language: entry.language,
          // Só as mensagens: os padrões internos das regras não são expostos.
          rules: entry.sourceRules.map((rule) => rule.message),
          starterCode:
            entry.starterCode ??
            (challenge.mode === "function" && challenge.functionSpec ? functionStarter(challenge.functionSpec, entry.language) : null),
          signature:
            challenge.mode === "function" && challenge.functionSpec && entry.language === "c"
              ? [cStructDefinitions(challenge.functionSpec), cSignature(challenge.functionSpec)].filter(Boolean).join("\n\n")
              : null,
          limits: limitsFor(challenge, entry.language)
        })),
        help: presentHelp(challenge, state)
      },
      score,
      submissions: state.submissions.map(presentSubmission)
    });
  });

  router.post("/:slug/hints", requireAuth, async (request, response) => {
    const user = getAuthenticatedUser(response);
    const challenge = await loadChallenge(request.params.slug as string);
    const state = await helpState(user.id, challenge);
    if (state.unlock.hintsRevealed >= challenge.hints.length) {
      throw new DomainError("Não há mais dicas para este desafio.", 409);
    }
    state.unlock = await store.saveChallengeUnlock({ ...state.unlock, hintsRevealed: state.unlock.hintsRevealed + 1 });
    response.json({ help: presentHelp(challenge, state) });
  });

  router.post("/:slug/solution", requireAuth, async (request, response) => {
    const user = getAuthenticatedUser(response);
    const challenge = await loadChallenge(request.params.slug as string);
    const state = await helpState(user.id, challenge);
    if (!challenge.editorial) {
      throw new DomainError("Este desafio ainda não tem solução comentada.", 404);
    }
    if (!state.solved && state.attempts < ATTEMPTS_BEFORE_SOLUTION) {
      throw new DomainError(
        `A solução comentada fica disponível depois de ${ATTEMPTS_BEFORE_SOLUTION} tentativas ou quando você resolver o desafio.`,
        403
      );
    }
    if (!state.solved && !state.unlock.solutionRevealed) {
      // Revelar antes de resolver: o desafio ainda pode ser concluído, sem pontos.
      state.unlock = await store.saveChallengeUnlock({ ...state.unlock, solutionRevealed: true });
    }
    response.json({ help: presentHelp(challenge, state) });
  });

  return router;
}
