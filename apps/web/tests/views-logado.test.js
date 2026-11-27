import { describe, expect, it } from "vitest";
import {
  activity,
  catalogo,
  flush,
  mockApi,
  meResponse,
  rankingRows,
  student,
  submissao,
  trackProgress
} from "./helpers.js";
import { getSession, refreshSession } from "../public/js/session.js";
import * as challenges from "../public/js/views/challenges.js";
import * as dashboard from "../public/js/views/dashboard.js";
import * as profile from "../public/js/views/profile.js";
import * as recovery from "../public/js/views/account-recovery.js";
import * as publicProfile from "../public/js/views/public-profile.js";

const raiz = () => document.getElementById("app");
const query = (texto = "") => new URLSearchParams(texto);

describe("catálogo de desafios", () => {
  const rotas = { "GET /api/challenges": { challenges: catalogo } };

  it("lista todos os desafios para visitantes, sem progresso", async () => {
    mockApi({ ...rotas, "GET /api/me": { status: 401, body: { error: "Não autenticado" } } });
    await refreshSession();
    await challenges.render({ root: raiz(), query: query() });
    expect(raiz().querySelectorAll(".challenge-item")).toHaveLength(3);
    expect(raiz().textContent).toContain("Crie sua conta");
    expect(raiz().querySelector("#catalog-status")).toBeNull();
  });

  it("filtra por assunto, linguagem, busca, nível e situação", async () => {
    mockApi({ ...rotas, "GET /api/me": meResponse() });
    await refreshSession();
    await challenges.render({ root: raiz(), query: query() });
    const itens = () => [...raiz().querySelectorAll(".challenge-item h3")].map((h) => h.textContent);

    raiz().querySelector('[data-topic="Fundamentos"]').click();
    expect(itens()).toEqual(["Soma de dois números", "Fatorial"]);
    expect(raiz().querySelectorAll("[data-subtopic]").length).toBeGreaterThan(1);

    raiz().querySelector('[data-subtopic="Recursão"]').click();
    expect(itens()).toEqual(["Fatorial"]);

    raiz().querySelector('[data-topic=""]').click();
    raiz().querySelector('[data-language="c"]').click();
    expect(itens()).toHaveLength(3);
    raiz().querySelector('[data-language="python"]').click();
    expect(itens()).toEqual(["Soma de dois números"]);
    raiz().querySelector('[data-language=""]').click();

    const busca = raiz().querySelector("#catalog-search");
    busca.value = "recursao";
    busca.dispatchEvent(new Event("input"));
    expect(itens()).toEqual(["Fatorial"]);
    busca.value = "";
    busca.dispatchEvent(new Event("input"));

    const nivel = raiz().querySelector("#catalog-difficulty");
    nivel.value = "hard";
    nivel.dispatchEvent(new Event("change"));
    expect(itens()).toEqual(["Lista ligada"]);
    nivel.value = "";
    nivel.dispatchEvent(new Event("change"));

    const situacao = raiz().querySelector("#catalog-status");
    situacao.value = "solved";
    situacao.dispatchEvent(new Event("change"));
    expect(itens()).toEqual(["Soma de dois números"]);
    situacao.value = "pending";
    situacao.dispatchEvent(new Event("change"));
    expect(itens()).toEqual(["Fatorial", "Lista ligada"]);
  });

  it("mostra mensagem quando nada corresponde e lembra o filtro neste navegador", async () => {
    mockApi({ ...rotas, "GET /api/me": meResponse() });
    await refreshSession();
    await challenges.render({ root: raiz(), query: query() });
    const busca = raiz().querySelector("#catalog-search");
    busca.value = "zzzz";
    busca.dispatchEvent(new Event("input"));
    expect(raiz().textContent).toContain("Nenhum desafio corresponde aos filtros.");

    raiz().querySelector('[data-language="c"]').click();
    expect(JSON.parse(localStorage.getItem("codelab:catalog-filters")).language).toBe("c");
  });

  it("começa pelos filtros vindos da URL", async () => {
    mockApi({ ...rotas, "GET /api/me": meResponse() });
    await refreshSession();
    await challenges.render({ root: raiz(), query: query("assunto=Estrutura de Dados&nivel=hard") });
    expect(raiz().querySelectorAll(".challenge-item")).toHaveLength(1);
  });
});

describe("dashboard", () => {
  function rotas(extra = {}) {
    return {
      "GET /api/me": meResponse(),
      "GET /api/challenges": { challenges: catalogo },
      "GET /api/submissions": ({ url }) =>
        url.includes("status=accepted")
          ? { submissions: [], pagination: { page: 1, limit: 1, total: 1, totalPages: 1 } }
          : { submissions: [submissao()], pagination: { page: 1, limit: 6, total: 4, totalPages: 1 } },
      "GET /api/ranking": { ranking: rankingRows },
      "GET /api/tracks/progress": trackProgress,
      "GET /api/me/activity": { activity },
      "GET /api/me/account": { account: { emailVerified: true } },
      ...extra
    };
  }

  it("mostra pontuação, ranking, próximo passo, atividade e últimas submissões", async () => {
    mockApi(rotas());
    await dashboard.render({ root: raiz() });
    const texto = raiz().textContent;
    expect(texto).toContain("Olá, Marina.");
    expect(texto).toContain("120");
    expect(texto).toContain("#2");
    expect(texto).toContain("entre 4 estudantes");
    expect(texto).toContain("Desafio: Fatorial");
    expect(texto).toContain("25% dos seus envios foram aceitos (1 de 4).");
    expect(texto).toContain("Top estudantes");
    expect(raiz().querySelectorAll(".history-detail, table tbody tr")).toHaveLength(1);
    expect(raiz().querySelector(".onboarding")).toBeNull();
  });

  it("sem submissões, mostra o guia de por onde começar", async () => {
    mockApi(
      rotas({
        "GET /api/submissions": { submissions: [], pagination: { page: 1, limit: 6, total: 0, totalPages: 0 } },
        "GET /api/tracks/progress": { status: 500, body: { error: "x" } },
        "GET /api/me/activity": { status: 500, body: { error: "x" } },
        "GET /api/me/account": { status: 500, body: { error: "x" } }
      })
    );
    await dashboard.render({ root: raiz() });
    expect(raiz().querySelector(".onboarding")).not.toBeNull();
    expect(raiz().textContent).toContain("Você ainda não enviou nenhuma solução.");
    expect(raiz().textContent).toContain("Taxa de aceitação");
    expect(raiz().textContent).toContain("Abrir desafio");
  });

  it("avisa que o e-mail não foi confirmado e reenvia o link", async () => {
    const fetchMock = mockApi(
      rotas({
        "GET /api/me/account": { account: { emailVerified: false } },
        "POST /api/me/verification": { message: "Link reenviado." }
      })
    );
    await dashboard.render({ root: raiz() });
    expect(raiz().querySelector(".banner-verify").textContent).toContain("marina@codelab.local");
    raiz().querySelector("#resend-verification").click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/me/verification", expect.objectContaining({ method: "POST" }));
    expect(document.querySelector(".toast").textContent).toBe("Link reenviado.");
  });

  it("se o reenvio falhar, mostra o erro e deixa tentar de novo", async () => {
    mockApi(
      rotas({
        "GET /api/me/account": { account: { emailVerified: false } },
        "POST /api/me/verification": { status: 429, body: { error: "Muitas tentativas." } }
      })
    );
    await dashboard.render({ root: raiz() });
    const botao = raiz().querySelector("#resend-verification");
    botao.click();
    await flush();
    expect(document.querySelector(".toast.is-error").textContent).toBe("Muitas tentativas.");
    expect(botao.disabled).toBe(false);
  });

  it("quando todos os desafios estão resolvidos, parabeniza", async () => {
    mockApi(
      rotas({
        "GET /api/me": meResponse(student, { score: { totalPoints: 60, solvedChallengeIds: ["c1", "c2", "c3"] } }),
        "GET /api/tracks/progress": { status: 500, body: { error: "x" } }
      })
    );
    await dashboard.render({ root: raiz() });
    expect(raiz().textContent).toContain("Você resolveu todos os desafios do catálogo!");
  });
});

describe("perfil", () => {
  const paginacao = (total, page = 1, totalPages = 1) => ({ page, limit: 20, total, totalPages });
  function rotas(extra = {}) {
    return {
      "GET /api/me": meResponse(),
      "GET /api/challenges": { challenges: catalogo },
      "GET /api/me/activity": { activity },
      "GET /api/me/account": { account: { emailVerified: true } },
      "GET /api/me/classes": { classes: [{ id: "k1", name: "Turma A", ownerName: "Profa. Lia" }] },
      "GET /api/submissions": { submissions: [submissao()], pagination: paginacao(1) },
      ...extra
    };
  }

  it("mostra os dados da pessoa, o histórico e as configurações da conta", async () => {
    mockApi(rotas());
    await profile.render({ root: raiz(), query: query() });
    await flush();
    const texto = raiz().textContent;
    expect(texto).toContain("Marina Silva");
    expect(texto).toContain("marina@codelab.local");
    expect(texto).toContain("Minhas submissões");
    expect(raiz().querySelectorAll(".history-detail")).toHaveLength(1);
    expect(raiz().querySelector(".history-detail pre.code-view").textContent).toBe("console.log(1 + 1);");
    expect(texto).toContain("Mostrando 1 de 1");
    expect(texto).toContain("Turma A");
    expect(texto).toContain("verificado");
  });

  it("carrega mais submissões quando há outra página", async () => {
    const fetchMock = mockApi(
      rotas({
        "GET /api/submissions": ({ url }) =>
          url.includes("page=2")
            ? { submissions: [submissao({ id: "s2" })], pagination: paginacao(2, 2, 2) }
            : { submissions: [submissao()], pagination: paginacao(2, 1, 2) }
      })
    );
    await profile.render({ root: raiz(), query: query() });
    expect(raiz().textContent).toContain("Mostrando 1 de 2");
    raiz().querySelector("#history-more").click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/submissions?page=2&limit=20", expect.anything());
    expect(raiz().querySelectorAll(".history-detail")).toHaveLength(2);
    expect(raiz().querySelector("#history-more")).toBeNull();
  });

  it("filtrar por veredito pede só esse status e trata lista vazia", async () => {
    const fetchMock = mockApi(
      rotas({
        "GET /api/submissions": ({ url }) =>
          url.includes("status=timeout")
            ? { submissions: [], pagination: paginacao(0, 1, 0) }
            : { submissions: [submissao()], pagination: paginacao(1) }
      })
    );
    await profile.render({ root: raiz(), query: query() });
    const filtro = raiz().querySelector("#history-filter");
    filtro.value = "timeout";
    filtro.dispatchEvent(new Event("change"));
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/submissions?status=timeout&page=1&limit=20", expect.anything());
    expect(raiz().textContent).toContain("Nenhuma submissão com esse veredito.");
  });

  it("mostra o erro quando o histórico falha", async () => {
    mockApi(rotas({ "GET /api/submissions": { status: 500, body: { error: "Histórico indisponível" } } }));
    await profile.render({ root: raiz(), query: query() });
    expect(raiz().querySelector("#history .alert-error").textContent).toBe("Histórico indisponível");
  });

  it("salvar o nome chama a API e atualiza a sessão", async () => {
    const fetchMock = mockApi(
      rotas({
        "PATCH /api/me": { ok: true }
      })
    );
    await profile.render({ root: raiz(), query: query() });
    await flush();
    document.getElementById("profile-name").value = "Marina S. Lima";
    document.getElementById("name-form").requestSubmit();
    await flush();
    await flush();
    const chamada = fetchMock.mock.calls.find(([url, opcoes]) => url === "/api/me" && opcoes.method === "PATCH");
    expect(JSON.parse(chamada[1].body)).toEqual({ name: "Marina S. Lima" });
    expect(document.querySelector(".toast").textContent).toBe("Nome atualizado.");
    expect(getSession().loaded).toBe(true);
  });

  it("trocar a senha envia a atual e a nova", async () => {
    const fetchMock = mockApi(rotas({ "PUT /api/me/password": { message: "Senha alterada." } }));
    await profile.render({ root: raiz(), query: query() });
    await flush();
    document.getElementById("current-password").value = "antiga123";
    document.getElementById("new-password").value = "nova-senha-123";
    document.getElementById("password-form").requestSubmit();
    await flush();
    const chamada = fetchMock.mock.calls.find(([url]) => url === "/api/me/password");
    expect(JSON.parse(chamada[1].body)).toEqual({ currentPassword: "antiga123", newPassword: "nova-senha-123" });
    expect(document.querySelector(".toast").textContent).toBe("Senha alterada.");
  });

  it("entrar numa turma usa o código em maiúsculas", async () => {
    const fetchMock = mockApi(rotas({ "POST /api/classes/join": { message: "Você entrou na turma." } }));
    await profile.render({ root: raiz(), query: query() });
    await flush();
    document.getElementById("class-code").value = " ab12cd ";
    document.getElementById("join-form").requestSubmit();
    await flush();
    const chamada = fetchMock.mock.calls.find(([url]) => url === "/api/classes/join");
    expect(JSON.parse(chamada[1].body)).toEqual({ code: "AB12CD" });
  });

  it("sair da turma pede confirmação", async () => {
    const fetchMock = mockApi(rotas({ "DELETE /api/me/classes/k1": { ok: true } }));
    const confirmar = (resposta) => {
      window.confirm = () => resposta;
    };
    await profile.render({ root: raiz(), query: query() });
    await flush();
    confirmar(false);
    raiz().querySelector("[data-leave]").click();
    await flush();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/me/classes/k1", expect.anything());
    confirmar(true);
    raiz().querySelector("[data-leave]").click();
    await flush();
    expect(fetchMock).toHaveBeenCalledWith("/api/me/classes/k1", expect.objectContaining({ method: "DELETE" }));
  });

  it("excluir a conta exige confirmação, apaga e volta ao início", async () => {
    const fetchMock = mockApi(rotas({ "DELETE /api/me": { ok: true }, "POST /api/auth/logout": { ok: true } }));
    await profile.render({ root: raiz(), query: query() });
    await flush();
    document.getElementById("delete-password").value = "minha-senha";
    window.confirm = () => false;
    document.getElementById("delete-form").requestSubmit();
    await flush();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/me", expect.objectContaining({ method: "DELETE" }));
    window.confirm = () => true;
    document.getElementById("delete-form").requestSubmit();
    await flush();
    await flush();
    const chamada = fetchMock.mock.calls.find(([url, opcoes]) => url === "/api/me" && opcoes.method === "DELETE");
    expect(JSON.parse(chamada[1].body)).toEqual({ password: "minha-senha" });
    expect(window.location.hash).toBe("#/");
  });

  it("baixar os dados gera um arquivo JSON", async () => {
    mockApi(rotas({ "GET /api/me/export": { user: { id: "u1" } } }));
    URL.createObjectURL = () => "blob:teste";
    URL.revokeObjectURL = () => {};
    let baixado = null;
    HTMLAnchorElement.prototype.click = function click() {
      baixado = this.download;
    };
    await profile.render({ root: raiz(), query: query() });
    await flush();
    document.getElementById("export-data").click();
    await flush();
    expect(baixado).toBe("codelab-meus-dados.json");
  });

  it("e-mail não verificado mostra o aviso com reenvio", async () => {
    mockApi(
      rotas({
        "GET /api/me/account": { account: { emailVerified: false } },
        "POST /api/me/verification": { message: "Enviado." }
      })
    );
    await profile.render({ root: raiz(), query: query() });
    await flush();
    raiz().querySelector("#account-card #resend-verification").click();
    await flush();
    expect(document.querySelector(".toast").textContent).toBe("Enviado.");
  });
});

describe("recuperação de senha e verificação de e-mail", () => {
  const enviar = (id) => document.getElementById(id).requestSubmit();

  it("esqueci a senha: exige e-mail e mostra a resposta neutra da API", async () => {
    mockApi({ "POST /api/auth/forgot-password": { message: "Se o e-mail existir, enviamos o link." } });
    await recovery.render({ root: raiz(), mode: "forgot", query: query() });
    enviar("recovery-form");
    expect(document.getElementById("recovery-message").textContent).toBe("Informe o e-mail.");
    document.getElementById("recovery-email").value = "marina@codelab.local";
    enviar("recovery-form");
    await flush();
    expect(document.getElementById("recovery-message").textContent).toBe("Se o e-mail existir, enviamos o link.");
    expect(document.getElementById("recovery-form").hidden).toBe(true);
  });

  it("esqueci a senha: mostra erro da API e libera o botão", async () => {
    mockApi({ "POST /api/auth/forgot-password": { status: 429, body: { error: "Muitas tentativas." } } });
    await recovery.render({ root: raiz(), mode: "forgot", query: query() });
    document.getElementById("recovery-email").value = "a@b.com";
    enviar("recovery-form");
    await flush();
    expect(document.getElementById("recovery-message").textContent).toBe("Muitas tentativas.");
    expect(document.querySelector("#recovery-form button").disabled).toBe(false);
  });

  it("redefinir: valida token, tamanho e confirmação; salva e leva ao login", async () => {
    const fetchMock = mockApi({
      "POST /api/auth/reset-password": { ok: true },
      "GET /api/me": { status: 401, body: { error: "x" } }
    });
    await recovery.render({ root: raiz(), mode: "reset", query: query() });
    expect(document.getElementById("recovery-message").textContent).toContain("Link incompleto");

    await recovery.render({ root: raiz(), mode: "reset", query: query("token=abc") });
    const mensagem = () => document.getElementById("recovery-message").textContent;
    document.getElementById("reset-password").value = "curta";
    enviar("reset-form");
    expect(mensagem()).toBe("A senha deve ter pelo menos 8 caracteres.");
    document.getElementById("reset-password").value = "senha-longa-1";
    document.getElementById("reset-confirmation").value = "diferente";
    enviar("reset-form");
    expect(mensagem()).toBe("As senhas não coincidem.");
    document.getElementById("reset-confirmation").value = "senha-longa-1";
    enviar("reset-form");
    await flush();
    await flush();
    const chamada = fetchMock.mock.calls.find(([url]) => url === "/api/auth/reset-password");
    expect(JSON.parse(chamada[1].body)).toEqual({ token: "abc", password: "senha-longa-1" });
    expect(window.location.hash).toBe("#/entrar");
  });

  it("redefinir: mostra o erro de token expirado", async () => {
    mockApi({ "POST /api/auth/reset-password": { status: 400, body: { error: "Link expirado." } } });
    await recovery.render({ root: raiz(), mode: "reset", query: query("token=velho") });
    document.getElementById("reset-password").value = "senha-longa-1";
    document.getElementById("reset-confirmation").value = "senha-longa-1";
    enviar("reset-form");
    await flush();
    expect(document.getElementById("recovery-message").textContent).toBe("Link expirado.");
  });

  it("verificar e-mail: confirma ao abrir ou explica a falha", async () => {
    mockApi({
      "POST /api/auth/verify-email": { ok: true },
      "GET /api/me": { status: 401, body: { error: "x" } }
    });
    await recovery.render({ root: raiz(), mode: "verify", query: query("token=ok") });
    expect(raiz().textContent).toContain("E-mail verificado");

    mockApi({ "POST /api/auth/verify-email": { status: 400, body: { error: "Link inválido." } } });
    await recovery.render({ root: raiz(), mode: "verify", query: query("token=ruim") });
    expect(raiz().textContent).toContain("Não foi possível verificar");
    expect(raiz().textContent).toContain("Link inválido.");
  });
});

describe("perfil público", () => {
  const perfil = {
    user: { id: "u1", name: "Marina Silva" },
    rankingPosition: 2,
    totalPoints: 120,
    solvedChallenges: 1,
    activity,
    recent: [
      { slug: "soma", title: "Soma", difficulty: "easy", language: "javascript", solvedAt: "2026-03-05T14:30:00Z" }
    ],
    byDifficulty: { easy: 1, medium: 0, hard: 0 },
    byTrack: [{ title: "Fundamentos", done: 2, total: 3 }]
  };

  it("mostra estatísticas e atividade, com atalho de edição no próprio perfil", async () => {
    mockApi({ "GET /api/users/u1/profile": { profile: perfil } });
    await publicProfile.render({ root: raiz(), params: { id: "u1" }, session: { user: student } });
    expect(document.title).toBe("Marina Silva · CodeLab");
    expect(raiz().textContent).toContain("#2 no ranking geral");
    expect(raiz().textContent).toContain("este é o seu perfil público");
    expect(raiz().querySelector('a[href="#/perfil"]')).not.toBeNull();
    expect(raiz().textContent).toContain("Primeiro passo");
  });

  it("para outra pessoa não mostra o botão de editar e trata quem está fora do ranking", async () => {
    mockApi({
      "GET /api/users/u1/profile": { profile: { ...perfil, rankingPosition: null, recent: [] } }
    });
    await publicProfile.render({ root: raiz(), params: { id: "u1" }, session: { user: null } });
    expect(raiz().textContent).toContain("Ainda fora do ranking");
    expect(raiz().textContent).toContain("Nenhum desafio resolvido ainda.");
    expect(raiz().querySelector('a[href="#/perfil"]')).toBeNull();
  });
});
