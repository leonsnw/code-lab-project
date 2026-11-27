import { describe, expect, it } from "vitest";
import { flush, mockApi } from "./helpers.js";
import * as adminDashboard from "../public/js/views/admin-dashboard.js";
import * as adminStatistics from "../public/js/views/admin-statistics.js";
import * as adminClasses from "../public/js/views/admin-classes.js";

const raiz = () => document.getElementById("app");

const estatisticas = {
  overview: {
    totalStudents: 1200,
    totalAdmins: 2,
    activeChallenges: 170,
    inactiveChallenges: 4,
    totalSubmissions: 5000,
    acceptedSubmissions: 2000,
    acceptanceRate: 40,
    totalRatings: 10,
    averageRating: 4.25,
    totalComments: 33
  },
  highlights: {
    mostSolvedChallenge: { title: "Soma", solvers: 90 },
    highestErrorRateChallenge: { title: "Fatorial", errorRate: 62.5 }
  },
  submissionStatuses: { accepted: 2000, wrong_answer: 1500, timeout: 10 },
  difficulties: [
    {
      difficulty: "easy",
      totalChallenges: 80,
      totalSubmissions: 3000,
      acceptanceRate: 55,
      participants: 100,
      solvers: 90
    }
  ],
  challenges: [
    {
      id: "c1",
      title: "Soma",
      difficulty: "easy",
      isActive: true,
      totalSubmissions: 100,
      acceptanceRate: 80,
      errorRate: 20,
      solvers: 80,
      participants: 90,
      totalRatings: 4,
      averageRating: 4.5,
      failures: { wrong_answer: 15, timeout: 5 },
      mainFailure: "wrong_answer"
    },
    {
      id: "c2",
      title: "Fatorial",
      difficulty: "medium",
      isActive: false,
      totalSubmissions: 10,
      acceptanceRate: 10,
      errorRate: 90,
      solvers: 1,
      participants: 5,
      totalRatings: 0,
      averageRating: 0,
      failures: { runtime_error: 9 },
      mainFailure: "runtime_error"
    },
    {
      id: "c3",
      title: "Sem erro",
      difficulty: "hard",
      isActive: true,
      totalSubmissions: 0,
      acceptanceRate: 0,
      errorRate: 0,
      solvers: 0,
      participants: 0,
      totalRatings: 0,
      averageRating: 0,
      failures: {},
      mainFailure: null
    }
  ],
  users: [
    {
      name: "Marina Silva",
      role: "student",
      totalPoints: 120,
      totalSubmissions: 4,
      acceptanceRate: 25,
      solvedChallenges: 1
    },
    { name: "Admin", role: "admin", totalPoints: 0, totalSubmissions: 0, acceptanceRate: 0, solvedChallenges: 0 }
  ]
};

describe("administração: visão geral", () => {
  it("mostra os indicadores, os vereditos e os destaques", async () => {
    mockApi({ "GET /api/admin/statistics": estatisticas });
    await adminDashboard.render({ root: raiz() });
    const texto = raiz().textContent;
    expect(texto).toContain("Visão geral do CodeLab");
    expect(texto).toContain("1.200");
    expect(texto).toContain("2 administradores");
    expect(texto).toContain("média 4,3");
    expect(texto).toContain("Soma (90)");
    expect(texto).toContain("Fatorial (62,5%)");
    expect(raiz().querySelectorAll(".bar-row")).toHaveLength(3);
  });

  it("sem destaques mostra travessão", async () => {
    mockApi({ "GET /api/admin/statistics": { ...estatisticas, highlights: {} } });
    await adminDashboard.render({ root: raiz() });
    expect(raiz().querySelectorAll("dd")[0].textContent).toBe("—");
  });
});

describe("administração: estatísticas detalhadas", () => {
  it("lista onde os estudantes mais erram, por dificuldade, desafio e usuário", async () => {
    mockApi({ "GET /api/admin/statistics": estatisticas });
    await adminStatistics.render({ root: raiz() });
    const falhas = [...raiz().querySelectorAll(".failure-list li")];
    expect(falhas).toHaveLength(2);
    expect(falhas[0].textContent).toContain("Soma");
    expect(falhas[0].textContent).toContain("20 reprovados");
    expect(falhas[1].textContent).toContain("9 reprovados");
    expect(raiz().textContent).toContain("inativo");
    expect(raiz().textContent).toContain("Administrador");
    expect(raiz().textContent).toContain("Estudante");
  });

  it("sem envios reprovados nem desafios, mostra os estados vazios", async () => {
    mockApi({ "GET /api/admin/statistics": { ...estatisticas, challenges: [] } });
    await adminStatistics.render({ root: raiz() });
    expect(raiz().textContent).toContain("Nenhum envio reprovado ainda.");
    expect(raiz().textContent).toContain("Nenhum desafio cadastrado.");
  });

  it("o botão Atualizar consulta a API de novo", async () => {
    const fetchMock = mockApi({ "GET /api/admin/statistics": estatisticas });
    await adminStatistics.render({ root: raiz() });
    raiz().querySelector("#refresh-statistics").click();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("administração: turmas", () => {
  const turma = {
    id: "k1",
    name: "ED 2026/2",
    code: "AB12CD",
    ownerName: "Profa. Lia",
    members: 2,
    createdAt: "2026-03-01T10:00:00Z"
  };

  it("lista as turmas com o código e mensagem quando não há nenhuma", async () => {
    mockApi({ "GET /api/admin/classes": { classes: [turma] } });
    await adminClasses.render({ root: raiz(), params: {} });
    expect(raiz().querySelector(".class-code").textContent).toBe("AB12CD");
    mockApi({ "GET /api/admin/classes": { classes: [] } });
    await adminClasses.render({ root: raiz(), params: {} });
    expect(raiz().textContent).toContain("Nenhuma turma ainda.");
  });

  it("criar turma envia o nome e abre o detalhe", async () => {
    const fetchMock = mockApi({
      "GET /api/admin/classes": { classes: [] },
      "POST /api/admin/classes": { classGroup: { id: "k9", code: "ZZ99ZZ" } }
    });
    await adminClasses.render({ root: raiz(), params: {} });
    document.getElementById("class-name").value = "  Turma Nova ";
    document.getElementById("class-form").requestSubmit();
    await flush();
    const chamada = fetchMock.mock.calls.find(([, opcoes]) => opcoes.method === "POST");
    expect(JSON.parse(chamada[1].body)).toEqual({ name: "Turma Nova" });
    expect(window.location.hash).toBe("#/admin/turmas/k9");
    expect(document.querySelector(".toast").textContent).toContain("ZZ99ZZ");
  });

  it("copiar o código usa a área de transferência e cai para um aviso se ela falhar", async () => {
    mockApi({ "GET /api/admin/classes": { classes: [turma] } });
    await adminClasses.render({ root: raiz(), params: {} });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => undefined } });
    raiz().querySelector("[data-copy]").click();
    await flush();
    expect(document.querySelector(".toast").textContent).toBe("Código copiado.");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("negado")) }
    });
    raiz().querySelector("[data-copy]").click();
    await flush();
    expect([...document.querySelectorAll(".toast")].at(-1).textContent).toBe("Código: AB12CD");
  });

  const relatorio = {
    classGroup: turma,
    tracks: [{ slug: "fundamentos", title: "Fundamentos de C", total: 10 }],
    students: [
      {
        userId: "u1",
        name: "Marina",
        email: "m@x.com",
        totalPoints: 120,
        solvedChallenges: 3,
        byTrack: { fundamentos: 3 },
        submissions: 4,
        acceptanceRate: 75,
        lastActivity: new Date().toISOString()
      },
      {
        userId: "u2",
        name: "Caio",
        email: "c@x.com",
        totalPoints: 0,
        solvedChallenges: 0,
        byTrack: {},
        submissions: 0,
        acceptanceRate: 0,
        lastActivity: null
      }
    ]
  };

  it("detalhe da turma mostra o resumo e o progresso de cada estudante", async () => {
    mockApi({ "GET /api/admin/classes/k1": relatorio });
    await adminClasses.render({ root: raiz(), mode: "detail", params: { id: "k1" } });
    const texto = raiz().textContent;
    expect(texto).toContain("ED 2026/2");
    expect(texto).toContain("Ativos em 7 dias");
    expect(raiz().querySelector(".stat-grid").textContent).toContain("60");
    expect(texto).toContain("3/10");
    expect(texto).toContain("sem envios");
    expect(raiz().querySelector("a[download]").getAttribute("href")).toBe("/api/admin/classes/k1/export.csv");
  });

  it("detalhe sem estudantes convida a compartilhar o código", async () => {
    mockApi({ "GET /api/admin/classes/k1": { ...relatorio, students: [] } });
    await adminClasses.render({ root: raiz(), mode: "detail", params: { id: "k1" } });
    expect(raiz().textContent).toContain("Ninguém entrou ainda. Passe o código AB12CD");
  });

  it("remover estudante e excluir turma pedem confirmação", async () => {
    const fetchMock = mockApi({
      "GET /api/admin/classes/k1": relatorio,
      "DELETE /api/admin/classes/k1/members/u1": { ok: true },
      "DELETE /api/admin/classes/k1": { ok: true }
    });
    await adminClasses.render({ root: raiz(), mode: "detail", params: { id: "k1" } });

    window.confirm = () => false;
    raiz().querySelector("[data-remove]").click();
    raiz().querySelector("#delete-class").click();
    await flush();
    expect(fetchMock.mock.calls.filter(([, opcoes]) => opcoes.method === "DELETE")).toHaveLength(0);

    window.confirm = () => true;
    raiz().querySelector("[data-remove]").click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/classes/k1/members/u1",
      expect.objectContaining({ method: "DELETE" })
    );
    raiz().querySelector("#delete-class").click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/classes/k1", expect.objectContaining({ method: "DELETE" }));
    expect(window.location.hash).toBe("#/admin/turmas");
  });
});
