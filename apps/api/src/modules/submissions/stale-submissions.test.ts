import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "../../database/in-memory-store.js";
import type { Submission, SubmissionStatus } from "../../domain/types.js";
import {
  failStalePendingSubmissions,
  STALE_PENDING_AFTER_MS,
  startStaleSubmissionSweeper
} from "./stale-submissions.js";
import { INTERNAL_EVALUATION_ERROR_MESSAGE } from "./submission.service.js";

const NOW = new Date("2026-11-08T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000);

function submission(id: string, status: SubmissionStatus, submittedAt: Date): Submission {
  return {
    id,
    userId: "user-marina",
    challengeId: "challenge-soma",
    language: "javascript",
    sourceCode: "// código",
    status,
    scoreAwarded: 0,
    submittedAt,
    evaluatedAt: status === "pending" ? null : submittedAt,
    totalTests: 3,
    passedTests: status === "accepted" ? 3 : 0,
    errorMessage: null,
    compileWarnings: null,
    testResults: []
  };
}

async function statusOf(store: InMemoryStore, id: string) {
  return (await store.listSubmissions()).find((item) => item.id === id);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("submissões presas em pending", () => {
  it("fecha como internal_error as pending mais antigas que o limite", async () => {
    const store = new InMemoryStore();
    await store.addSubmission(submission("antiga", "pending", minutesAgo(11)));

    const closed = await failStalePendingSubmissions(store, { now: NOW });

    expect(closed).toBe(1);
    expect(await statusOf(store, "antiga")).toMatchObject({
      status: "internal_error",
      scoreAwarded: 0,
      errorMessage: INTERNAL_EVALUATION_ERROR_MESSAGE,
      evaluatedAt: NOW
    });
  });

  it("não toca nas pending recentes, que ainda podem estar na fila", async () => {
    const store = new InMemoryStore();
    await store.addSubmission(submission("recente", "pending", minutesAgo(1)));
    await store.addSubmission(submission("quase", "pending", new Date(NOW.getTime() - STALE_PENDING_AFTER_MS + 1000)));

    const closed = await failStalePendingSubmissions(store, { now: NOW });

    expect(closed).toBe(0);
    expect((await statusOf(store, "recente"))?.status).toBe("pending");
    expect((await statusOf(store, "quase"))?.status).toBe("pending");
  });

  it("não mexe em submissões que já têm veredito, por mais antigas que sejam", async () => {
    const store = new InMemoryStore();
    await store.addSubmission(submission("aceita", "accepted", minutesAgo(600)));
    await store.addSubmission(submission("errada", "wrong_answer", minutesAgo(600)));

    expect(await failStalePendingSubmissions(store, { now: NOW })).toBe(0);
    expect(await statusOf(store, "aceita")).toMatchObject({ status: "accepted", errorMessage: null });
    expect(await statusOf(store, "errada")).toMatchObject({ status: "wrong_answer", errorMessage: null });
  });

  it("fecha só as antigas quando há antigas e recentes juntas", async () => {
    const store = new InMemoryStore();
    await store.addSubmission(submission("a", "pending", minutesAgo(30)));
    await store.addSubmission(submission("b", "pending", minutesAgo(12)));
    await store.addSubmission(submission("c", "pending", minutesAgo(2)));

    expect(await failStalePendingSubmissions(store, { now: NOW })).toBe(2);
    expect((await statusOf(store, "c"))?.status).toBe("pending");
  });

  it("uma avaliação que termina depois de ser fechada não sobrescreve o internal_error", async () => {
    const store = new InMemoryStore();
    await store.addSubmission(submission("tarde", "pending", minutesAgo(15)));
    await failStalePendingSubmissions(store, { now: NOW });

    const result = await store.completeSubmission({
      submissionId: "tarde",
      status: "accepted",
      evaluatedAt: NOW,
      testResults: [],
      totalTests: 3,
      passedTests: 3,
      errorMessage: null,
      compileWarnings: null,
      challengePoints: 100,
      pointsForfeited: false
    });

    expect(result.status).toBe("internal_error");
    expect((await store.getScore("user-marina")).totalPoints).toBe(0);
  });

  describe("varredura periódica", () => {
    it("limpa na subida e de novo a cada intervalo, sem depender de outro reinício", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const store = new InMemoryStore();
      const log = vi.fn();
      // Presa antes da subida.
      await store.addSubmission(submission("antes", "pending", minutesAgo(20)));
      // Chegou segundos antes de um reinício: na subida ainda é recente.
      await store.addSubmission(submission("recem-chegada", "pending", minutesAgo(1)));

      const stop = startStaleSubmissionSweeper(store, { intervalMs: 60_000, log });
      await vi.advanceTimersByTimeAsync(0);

      expect((await statusOf(store, "antes"))?.status).toBe("internal_error");
      expect((await statusOf(store, "recem-chegada"))?.status).toBe("pending");
      expect(log).toHaveBeenCalledTimes(1);

      // Passam-se mais de 10 minutos sem a API ter terminado a avaliação dela.
      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);

      expect((await statusOf(store, "recem-chegada"))?.status).toBe("internal_error");
      stop();
    });

    it("para de varrer depois de chamar a função de parada", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      const store = new InMemoryStore();
      const stop = startStaleSubmissionSweeper(store, { intervalMs: 60_000, log: vi.fn() });
      await vi.advanceTimersByTimeAsync(0);
      stop();

      await store.addSubmission(submission("depois", "pending", minutesAgo(60)));
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

      expect((await statusOf(store, "depois"))?.status).toBe("pending");
    });
  });
});
