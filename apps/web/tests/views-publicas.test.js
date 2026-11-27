import { describe, expect, it } from "vitest";
import { flush, mockApi, rankingRows, student, tracks, trackProgress } from "./helpers.js";
import { refreshSession } from "../public/js/session.js";
import * as home from "../public/js/views/home.js";
import * as tracksView from "../public/js/views/tracks.js";
import * as trackView from "../public/js/views/track.js";
import * as lessonView from "../public/js/views/lesson.js";
import * as ranking from "../public/js/views/ranking.js";
import * as notFound from "../public/js/views/not-found.js";
import * as auth from "../public/js/views/auth.js";

const raiz = () => document.getElementById("app");
const semSessao = { user: null };
const comSessao = { user: student };

describe("tela inicial", () => {
  it("mostra os números do catálogo e o ranking para visitante", async () => {
    mockApi({
      "GET /api/challenges": { challenges: [{ id: "c1" }, { id: "c2" }] },
      "GET /api/tracks": { tracks },
      "GET /api/ranking": { ranking: rankingRows }
    });
    await home.render({ root: raiz(), session: semSessao });
    expect(raiz().textContent).toContain("Code Lab");
    expect(raiz().textContent).toContain("1 trilhas, 2 desafios");
    expect(raiz().textContent).toContain("Começar grátis");
    expect(raiz().textContent).toContain("Quem está na frente");
    expect(raiz().querySelector('a[href="#/u/u9"]').textContent).toBe("Ana Souza");
  });

  it("para quem está logado, convida a continuar e sobrevive à API fora do ar", async () => {
    mockApi({});
    await home.render({ root: raiz(), session: comSessao });
    expect(raiz().textContent).toContain("Continuar de onde parei");
    expect(raiz().textContent).not.toContain("Quem está na frente");
  });
});

describe("trilhas", () => {
  it("lista as trilhas com o progresso e o próximo passo", async () => {
    mockApi({
      "GET /api/tracks": { tracks },
      "GET /api/tracks/progress": trackProgress,
      "GET /api/me": { user: student, score: { solvedChallengeIds: [] }, progress: {} }
    });
    await refreshSession();
    await tracksView.render({ root: raiz(), session: comSessao });
    expect(raiz().textContent).toContain("Fundamentos");
    expect(raiz().textContent).toContain("3 módulos · 1 lições · 2 desafios");
    expect(raiz().textContent).toContain("Continue de onde parou");
    expect(raiz().querySelector(".next-step").getAttribute("href")).toBe("#/desafios/fatorial");
  });

  it("detalhe da trilha marca itens concluídos, desafio final e pré-requisitos", async () => {
    mockApi({
      "GET /api/tracks": { tracks },
      "GET /api/tracks/progress": trackProgress,
      "GET /api/me": { user: student, score: { solvedChallengeIds: [] }, progress: {} }
    });
    await refreshSession();
    await trackView.render({ root: raiz(), params: { slug: "fundamentos" }, session: comSessao });
    expect(document.title).toBe("Fundamentos · CodeLab");
    expect(raiz().querySelectorAll(".roadmap-module")).toHaveLength(3);
    expect(raiz().querySelector("#entrada-e-saida").classList.contains("is-complete")).toBe(true);
    expect(raiz().textContent).toContain("Desafio final");
    expect(raiz().textContent).toContain("Conteúdo em preparação");
    expect(raiz().querySelectorAll(".module-item.is-done")).toHaveLength(2);
  });

  it("avisa quando a trilha não existe", async () => {
    mockApi({ "GET /api/tracks": { tracks } });
    await trackView.render({ root: raiz(), params: { slug: "inexistente" }, session: semSessao });
    expect(raiz().textContent).toContain("Trilha não encontrada");
  });
});

describe("lição", () => {
  const resposta = {
    lesson: {
      id: "l1",
      slug: "ola-mundo",
      title: "Olá, mundo",
      summary: "Primeiro programa.",
      estimatedMinutes: 5,
      content: "# Oi\n\nTexto **forte**."
    },
    module: { title: "Entrada e saída" },
    track: { slug: "fundamentos", title: "Fundamentos" },
    next: { type: "challenge", slug: "soma", title: "Soma" },
    previous: null
  };

  it("renderiza o Markdown e pede login ao visitante", async () => {
    mockApi({ "GET /api/lessons/ola-mundo": resposta });
    await lessonView.render({ root: raiz(), params: { slug: "ola-mundo" }, session: semSessao });
    expect(raiz().querySelector(".markdown strong").textContent).toBe("forte");
    expect(raiz().textContent).toContain("Entrar para registrar o progresso");
  });

  it("concluir a lição registra o progresso e leva ao próximo item", async () => {
    const fetchMock = mockApi({
      "GET /api/lessons/ola-mundo": resposta,
      "POST /api/lessons/ola-mundo/complete": { ok: true }
    });
    await lessonView.render({ root: raiz(), params: { slug: "ola-mundo" }, session: comSessao });
    raiz().querySelector("#complete-lesson").click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lessons/ola-mundo/complete",
      expect.objectContaining({ method: "POST" })
    );
    expect(document.querySelector(".toast").textContent).toBe("Lição concluída.");
    expect(window.location.hash).toBe("#/desafios/soma");
  });

  it("mostra o erro da API num aviso quando concluir falha", async () => {
    mockApi({
      "GET /api/lessons/ola-mundo": resposta,
      "POST /api/lessons/ola-mundo/complete": { status: 500, body: { error: "Falha ao salvar" } }
    });
    await lessonView.render({ root: raiz(), params: { slug: "ola-mundo" }, session: comSessao });
    raiz().querySelector("#complete-lesson").click();
    await flush();
    expect(document.querySelector(".toast.is-error").textContent).toBe("Falha ao salvar");
  });
});

describe("ranking", () => {
  const rotas = {
    "GET /api/tracks": { tracks },
    "GET /api/ranking": { ranking: rankingRows }
  };

  it("mostra a tabela, destaca você e calcula a sua posição", async () => {
    mockApi(rotas);
    await ranking.render({ root: raiz(), session: comSessao });
    expect(raiz().querySelectorAll("tbody tr")).toHaveLength(4);
    expect(raiz().querySelector("tr.is-me").textContent).toContain("(você)");
    expect(raiz().querySelector("#my-position").textContent).toContain("#2");
  });

  it("trocar o período consulta a API com o filtro e guarda a preferência", async () => {
    const fetchMock = mockApi(rotas);
    await ranking.render({ root: raiz(), session: comSessao });
    raiz().querySelector('[data-period="semana"]').click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/ranking?periodo=semana", expect.anything());
    expect(JSON.parse(localStorage.getItem("codelab:ranking-filter")).period).toBe("semana");
  });

  it("filtra por trilha e mostra mensagem quando ninguém pontuou", async () => {
    mockApi({ ...rotas, "GET /api/ranking": { ranking: [] } });
    await ranking.render({ root: raiz(), session: semSessao });
    expect(raiz().textContent).toContain("Nenhum estudante pontuou ainda.");
    const select = raiz().querySelector("#ranking-track");
    select.value = "fundamentos";
    select.dispatchEvent(new Event("change"));
    await flush();
    expect(raiz().textContent).toContain("Ninguém pontuou com esses filtros");
  });

  it("mostra o erro da API no lugar da tabela", async () => {
    mockApi({ ...rotas, "GET /api/ranking": { status: 500, body: { error: "Banco fora do ar" } } });
    await ranking.render({ root: raiz(), session: semSessao });
    expect(raiz().querySelector(".alert-error").textContent).toBe("Banco fora do ar");
  });

  it("ignora uma preferência salva inválida", async () => {
    localStorage.setItem("codelab:ranking-filter", "{quebrado");
    mockApi(rotas);
    await ranking.render({ root: raiz(), session: semSessao });
    expect(raiz().querySelectorAll("tbody tr")).toHaveLength(4);
  });
});

describe("página não encontrada", () => {
  it("renderiza o aviso com atalhos", () => {
    notFound.render({ root: raiz() });
    expect(raiz().textContent).toContain("Página não encontrada");
  });
});

describe("entrar e criar conta", () => {
  const query = (texto = "") => new URLSearchParams(texto);
  const preencher = (campos) => {
    for (const [nome, valor] of Object.entries(campos)) document.querySelector(`[name=${nome}]`).value = valor;
  };
  const enviar = () => document.getElementById("auth-form").requestSubmit();

  it("login válido autentica, avisa e volta para o destino pedido", async () => {
    const fetchMock = mockApi({
      "POST /api/auth/login": { ok: true },
      "GET /api/me": { user: student, score: { totalPoints: 0, solvedChallengeIds: [] }, progress: {} }
    });
    auth.render({ root: raiz(), mode: "login", query: query("volta=/desafios/soma") });
    preencher({ email: "marina@codelab.local", password: "12345678" });
    enviar();
    await flush();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" }));
    expect(window.location.hash).toBe("#/desafios/soma");
    expect(document.querySelector(".toast").textContent).toBe("Bem-vindo de volta!");
  });

  it("ignora um destino 'volta' que não começa com barra (evita redirecionamento aberto)", async () => {
    mockApi({
      "POST /api/auth/login": { ok: true },
      "GET /api/me": { user: student, score: { solvedChallengeIds: [] }, progress: {} }
    });
    auth.render({ root: raiz(), mode: "login", query: query("volta=https://malicioso.exemplo") });
    preencher({ email: "marina@codelab.local", password: "12345678" });
    enviar();
    await flush();
    await flush();
    expect(window.location.hash).toBe("#/dashboard");
  });

  it("mostra o erro da API e reabilita o botão", async () => {
    mockApi({ "POST /api/auth/login": { status: 401, body: { error: "E-mail ou senha inválidos." } } });
    auth.render({ root: raiz(), mode: "login", query: query() });
    preencher({ email: "x@y.com", password: "errada" });
    enviar();
    await flush();
    const caixa = document.getElementById("auth-error");
    expect(caixa.hidden).toBe(false);
    expect(caixa.textContent).toBe("E-mail ou senha inválidos.");
    expect(document.querySelector("button[type=submit]").disabled).toBe(false);
  });

  it("valida campos vazios sem chamar a API", async () => {
    const fetchMock = mockApi({});
    auth.render({ root: raiz(), mode: "login", query: query() });
    enviar();
    expect(document.getElementById("auth-error").textContent).toBe("Preencha e-mail e senha.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("o botão de conta de demonstração preenche e envia o formulário", async () => {
    const fetchMock = mockApi({ "POST /api/auth/login": { status: 401, body: { error: "não" } } });
    auth.render({ root: raiz(), mode: "login", query: query() });
    document.querySelector('[data-demo="1"]').click();
    await flush();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: "admin@codelab.local", password: "admin123" });
  });

  it("cadastro valida nome, tamanho da senha e confirmação", () => {
    const fetchMock = mockApi({});
    auth.render({ root: raiz(), mode: "register", query: query() });
    const erro = () => document.getElementById("auth-error").textContent;

    preencher({ name: "", email: "a@b.com", password: "12345678", confirmation: "12345678" });
    enviar();
    expect(erro()).toBe("Informe seu nome.");

    preencher({ name: "Ana", email: "a@b.com", password: "1234567", confirmation: "1234567" });
    enviar();
    expect(erro()).toBe("A senha deve ter pelo menos 8 caracteres.");

    preencher({ name: "Ana", email: "a@b.com", password: "12345678", confirmation: "outra-senha" });
    enviar();
    expect(erro()).toBe("As senhas não coincidem.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("cadastro válido cria a conta e entra", async () => {
    const fetchMock = mockApi({
      "POST /api/auth/register": { ok: true },
      "GET /api/me": { user: student, score: { solvedChallengeIds: [] }, progress: {} }
    });
    auth.render({ root: raiz(), mode: "register", query: query() });
    preencher({ name: " Ana Silva ", email: "ana@email.com", password: "12345678", confirmation: "12345678" });
    enviar();
    await flush();
    await flush();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      name: "Ana Silva",
      email: "ana@email.com",
      password: "12345678"
    });
    expect(document.querySelector(".toast").textContent).toBe("Conta criada. Bons estudos!");
  });
});
