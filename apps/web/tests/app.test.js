import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { admin, catalogo, flush, mockApi, meResponse, rankingRows, student, tracks, trackProgress } from "./helpers.js";

// app.js liga tudo no momento em que é importado (ouvintes de hash, clique e teclado),
// então cada teste importa uma cópia nova do módulo, com o DOM e a API já preparados.
async function abrirApp(hash, rotas) {
  window.location.hash = hash;
  mockApi({
    "GET /api/challenges": { challenges: catalogo },
    "GET /api/tracks": { tracks },
    "GET /api/ranking": { ranking: rankingRows },
    ...rotas
  });
  vi.resetModules();
  await import("../public/js/app.js");
  await flush();
  await flush();
}

const visitante = { "GET /api/me": { status: 401, body: { error: "Não autenticado" } } };
const logado = (usuario = student) => ({
  "GET /api/me": meResponse(usuario),
  "GET /api/tracks/progress": trackProgress
});
const raiz = () => document.getElementById("app");

describe("aplicação (rotas, guardas e navegação)", () => {
  let ouvintes = [];
  beforeEach(() => {
    ouvintes = [];
    // Registra os ouvintes que o app instala em window e document, para removê-los ao fim do teste.
    for (const alvo of [window, document]) {
      const adicionar = alvo.addEventListener.bind(alvo);
      vi.spyOn(alvo, "addEventListener").mockImplementation((tipo, ouvinte, opcoes) => {
        ouvintes.push([alvo, tipo, ouvinte]);
        adicionar(tipo, ouvinte, opcoes);
      });
    }
  });
  afterEach(() => {
    // Sem isso, cada cópia importada do módulo deixaria suas rotas e cliques ativos nos testes seguintes.
    for (const [alvo, tipo, ouvinte] of ouvintes) alvo.removeEventListener(tipo, ouvinte);
  });

  it("visitante vê a página inicial com a barra superior pública", async () => {
    await abrirApp("#/", visitante);
    expect(document.title).toBe("Início · CodeLab");
    expect(raiz().textContent).toContain("Code Lab");
    expect(document.getElementById("topbar").textContent).toContain("Criar conta");
    expect(document.body.classList.contains("has-sidebar")).toBe(false);
  });

  it("pessoa logada ganha a barra lateral com o menu e os pontos", async () => {
    await abrirApp("#/trilhas", logado());
    const lateral = document.getElementById("sidebar");
    expect(lateral.textContent).toContain("Marina Silva");
    expect(lateral.textContent).toContain("120 pontos");
    expect(lateral.querySelector('[aria-current="page"]').textContent).toContain("Trilhas");
    expect(lateral.textContent).not.toContain("Administração");
    expect(document.body.classList.contains("has-sidebar")).toBe(true);
  });

  it("administrador vê o menu de administração", async () => {
    await abrirApp("#/trilhas", logado(admin));
    expect(document.getElementById("sidebar").textContent).toContain("Administração");
  });

  it("rota protegida leva o visitante ao login lembrando o destino", async () => {
    await abrirApp("#/dashboard", visitante);
    expect(window.location.hash).toBe("#/entrar?volta=%2Fdashboard");
  });

  it("área de administração é negada a estudantes", async () => {
    await abrirApp("#/admin", logado());
    expect(window.location.hash).toBe("#/dashboard");
    expect(document.querySelector(".toast.is-error").textContent).toContain("exclusiva para administradores");
  });

  it("quem já está logado não vê a tela de login", async () => {
    await abrirApp("#/entrar", logado());
    expect(window.location.hash).toBe("#/dashboard");
  });

  it("endereço desconhecido mostra a página não encontrada", async () => {
    await abrirApp("#/nao-existe", visitante);
    expect(raiz().textContent).toContain("Página não encontrada");
  });

  it("trilha inexistente (404 da API) mostra a página de erro sem 'tentar de novo'", async () => {
    await abrirApp("#/licoes/fantasma", {
      ...visitante,
      "GET /api/lessons/fantasma": { status: 404, body: { error: "Não encontrada" } }
    });
    expect(raiz().textContent).toContain("404");
    expect(raiz().textContent).toContain("Não encontramos esta página");
    expect(raiz().querySelector("[data-retry]")).toBeNull();
  });

  it("erro do servidor mostra a mensagem e permite tentar de novo", async () => {
    await abrirApp("#/licoes/quebrada", {
      ...visitante,
      "GET /api/lessons/quebrada": { status: 500, body: { error: "Banco fora do ar" } }
    });
    expect(raiz().textContent).toContain("500");
    expect(raiz().textContent).toContain("Banco fora do ar");
    expect(raiz().querySelector("[data-retry]")).not.toBeNull();
  });

  it("clicar no tema alterna e avisa; no menu abre e fecha a barra lateral", async () => {
    await abrirApp("#/trilhas", logado());
    document.querySelector("[data-theme-toggle]").click();
    await flush();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.querySelector(".toast").textContent).toBe("Tema claro");

    document.getElementById("nav-toggle").click();
    expect(document.body.classList.contains("sidebar-open")).toBe(true);
    document.getElementById("sidebar-backdrop").click();
    expect(document.body.classList.contains("sidebar-open")).toBe(false);
  });

  it("sair encerra a sessão e volta ao início", async () => {
    await abrirApp("#/trilhas", { ...logado(), "POST /api/auth/logout": { ok: true } });
    document.getElementById("logout-button").click();
    await flush();
    await flush();
    expect(document.querySelector(".toast").textContent).toBe("Sessão encerrada.");
    expect(window.location.hash).toBe("#/");
    expect(document.body.classList.contains("has-sidebar")).toBe(false);
  });

  it("botão de busca abre a paleta e o rodapé abre os atalhos", async () => {
    document.body.insertAdjacentHTML("beforeend", "<button data-open-shortcuts></button>");
    await abrirApp("#/", visitante);
    document.querySelector("[data-open-shortcuts]").click();
    expect(document.querySelector(".shortcut-list")).not.toBeNull();
    document.querySelector("[data-close]").click();
    document.querySelector("[data-palette]").click();
    await flush();
    expect(document.querySelector(".palette-input")).not.toBeNull();
  });

  it("avisa quando a API não responde na carga inicial", async () => {
    await abrirApp("#/", { "GET /api/me": { status: 500, body: { error: "fora do ar" } } });
    expect(document.querySelector(".toast.is-error").textContent).toContain("A API não respondeu");
  });
});
