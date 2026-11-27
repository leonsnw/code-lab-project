import { vi } from "vitest";

/**
 * Substitui o fetch global por um roteador de respostas JSON.
 * `routes` mapeia "MÉTODO /caminho" (sem query) para um objeto (200) ou uma função
 * `(request) => objeto | { status, body }`. Rotas não mapeadas respondem 404.
 * Devolve o mock, para conferir as chamadas feitas.
 */
export function mockApi(routes = {}) {
  const mock = vi.fn(async (url, options = {}) => {
    const method = options.method ?? "GET";
    const path = String(url).split("?")[0];
    const handler = routes[`${method} ${path}`];
    if (handler === undefined) return respond(404, { error: `Sem rota de teste para ${method} ${path}` });
    const body = options.body ? JSON.parse(options.body) : undefined;
    const result = typeof handler === "function" ? handler({ url: String(url), body }) : handler;
    if (result && typeof result === "object" && "status" in result && "body" in result) {
      return respond(result.status, result.body);
    }
    return respond(200, result);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

export function respond(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body))
  };
}

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

export const student = { id: "u1", name: "Marina Silva", email: "marina@codelab.local", role: "student" };
export const admin = { id: "a1", name: "Admin CodeLab", email: "admin@codelab.local", role: "admin" };

export const progress = {
  solvedChallenges: 1,
  pendingChallenges: 2,
  totalChallenges: 3,
  byDifficulty: [
    { difficulty: "easy", solved: 1, total: 2 },
    { difficulty: "medium", solved: 0, total: 1 },
    { difficulty: "hard", solved: 0, total: 0 }
  ]
};

export function meResponse(user = student, extra = {}) {
  return {
    user,
    score: { totalPoints: 120, solvedChallengeIds: ["c1"] },
    progress,
    ...extra
  };
}

export const challenges = [
  {
    id: "c1",
    slug: "soma",
    title: "Soma de dois números",
    difficulty: "easy",
    points: 10,
    description: "Leia dois inteiros.\nImprima a soma."
  },
  { id: "c2", slug: "fatorial", title: "Fatorial", difficulty: "medium", points: 20, description: "Calcule n!." },
  { id: "c3", slug: "primos", title: "Primos", difficulty: "easy", points: 10, description: "Conte os primos." }
];

export const tracks = [
  {
    id: "t1",
    slug: "fundamentos",
    title: "Fundamentos",
    description: "Do primeiro programa aos vetores.",
    modules: [
      {
        id: "m1",
        slug: "entrada-e-saida",
        title: "Entrada e saída",
        objective: "Ler e imprimir dados.",
        concept: "stdin e stdout",
        estimatedMinutes: 20,
        prerequisiteIds: [],
        lessons: [{ id: "l1", slug: "ola-mundo", title: "Olá, mundo", estimatedMinutes: 5 }],
        challenges: [{ id: "c1", slug: "soma", title: "Soma de dois números", difficulty: "easy", isBoss: false }]
      },
      {
        id: "m2",
        slug: "condicionais",
        title: "Condicionais",
        objective: "Decidir com if.",
        concept: "if e else",
        estimatedMinutes: 30,
        prerequisiteIds: ["m1"],
        lessons: [],
        challenges: [{ id: "c2", slug: "fatorial", title: "Fatorial", difficulty: "medium", isBoss: true }]
      },
      {
        id: "m3",
        slug: "vazio",
        title: "Módulo vazio",
        objective: "Em preparação.",
        concept: "nenhum",
        estimatedMinutes: 10,
        prerequisiteIds: [],
        lessons: [],
        challenges: []
      }
    ]
  }
];

export const trackProgress = {
  completedLessonIds: ["l1"],
  solvedChallengeIds: ["c1"],
  tracks: { t1: { done: 2, total: 3 } },
  modules: { m1: { done: 2, total: 2 }, m2: { done: 0, total: 1 } },
  next: {
    type: "challenge",
    slug: "fatorial",
    title: "Fatorial",
    trackTitle: "Fundamentos",
    trackSlug: "fundamentos",
    moduleTitle: "Condicionais"
  }
};

export const rankingRows = [
  { userId: "u9", name: "Ana Souza", totalPoints: 300, solvedChallenges: 5 },
  { userId: "u1", name: "Marina Silva", totalPoints: 120, solvedChallenges: 1 },
  { userId: "u8", name: "Bruno Lima", totalPoints: 80, solvedChallenges: 2 },
  { userId: "u7", name: "Caio Dias", totalPoints: 10, solvedChallenges: 1 }
];

export const activity = {
  currentStreak: 3,
  longestStreak: 5,
  activeDays: 12,
  days: Array.from({ length: 14 }, (_, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, "0")}`,
    submissions: i % 4,
    accepted: i % 2
  })),
  badges: [
    { id: "b1", title: "Primeiro passo", description: "Primeira solução aceita.", earnedAt: "2026-03-02T10:00:00Z" },
    { id: "b2", title: "Maratonista", description: "7 dias seguidos.", earnedAt: null }
  ]
};

export const catalogo = [
  {
    id: "c1",
    slug: "soma",
    title: "Soma de dois números",
    difficulty: "easy",
    points: 10,
    topic: "Fundamentos",
    subtopic: "Entrada e saída",
    languages: ["javascript", "python", "c"],
    tags: ["io", "soma"],
    description: "Leia dois inteiros.\nImprima a soma."
  },
  {
    id: "c2",
    slug: "fatorial",
    title: "Fatorial",
    difficulty: "medium",
    points: 20,
    topic: "Fundamentos",
    subtopic: "Recursão",
    languages: ["javascript", "c"],
    tags: ["recursao"],
    description: "Calcule n!."
  },
  {
    id: "c3",
    slug: "lista-ligada",
    title: "Lista ligada",
    difficulty: "hard",
    points: 30,
    topic: "Estrutura de Dados",
    subtopic: "",
    languages: ["c"],
    tags: ["lista"],
    description: "Inverta a lista."
  }
];

export const submissao = (extra = {}) => ({
  id: "s1",
  challengeId: "c1",
  status: "wrong_answer",
  language: "javascript",
  sourceCode: "console.log(1 + 1);",
  submittedAt: "2026-03-05T14:30:00Z",
  scoreAwarded: 0,
  result: {
    passedTests: 1,
    totalTests: 3,
    runtimeMs: 12,
    failedTest: {
      position: 2,
      isPublic: true,
      durationMs: 3,
      input: "1 2",
      expectedOutput: "3",
      actualOutput: "2",
      executionStatus: "completed"
    }
  },
  feedback: { title: "Resposta errada", message: "O caso 2 falhou." },
  ...extra
});
