import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { activity, catalogo, flush, mockApi, submissao, tracks } from "./helpers.js";
import { toast } from "../public/js/components/toast.js";
import { badgeList, heatmap, streakStat } from "../public/js/components/activity.js";
import { submissionTable } from "../public/js/components/submission-table.js";
import { barList } from "../public/js/components/admin-nav.js";
import { caseDetail, compileErrorLine, compileWarningsBlock, renderVerdict } from "../public/js/components/verdict.js";
import { installGlobalShortcuts, openPalette, openShortcuts } from "../public/js/components/palette.js";
import { icon } from "../public/js/icons.js";
import { loadLearning, itemHref } from "../public/js/learning.js";
import { loadCatalog } from "../public/js/catalog.js";
import * as legal from "../public/js/views/legal.js";

const texto = (conteudo) => {
  const alvo = document.createElement("div");
  alvo.innerHTML = String(conteudo);
  return alvo.textContent;
};

describe("toast", () => {
  it("mostra a mensagem com o estilo do tipo e some ao clicar", () => {
    toast("Salvo.", "success");
    toast("Falhou.", "error");
    const itens = document.querySelectorAll("#toasts .toast");
    expect(itens[0].className).toContain("is-success");
    expect(itens[1].className).toContain("is-error");
    itens[0].click();
    expect(document.querySelectorAll("#toasts .toast")).toHaveLength(1);
  });

  it("desaparece sozinho depois de alguns segundos", () => {
    vi.useFakeTimers();
    toast("Oi");
    vi.advanceTimersByTime(4300);
    expect(document.querySelectorAll("#toasts .toast")).toHaveLength(0);
    vi.useRealTimers();
  });

  it("não quebra sem a região de avisos", () => {
    document.getElementById("toasts").remove();
    expect(() => toast("Oi")).not.toThrow();
  });
});

describe("atividade", () => {
  it("heatmap resume o total de submissões e alinha a primeira semana", () => {
    // 3 de março de 2026 é terça-feira: a primeira coluna começa com dois dias em branco (dom e seg).
    const dias = activity.days.map((dia, i) => ({ ...dia, date: `2026-03-${String(i + 3).padStart(2, "0")}` }));
    const saida = String(heatmap(dias));
    expect(saida).toContain("submissões nos últimos 12 meses");
    expect(saida).toContain("heatmap-cell level-");
    expect(saida).toContain("is-blank");
  });

  it("streakStat usa singular e plural e incentiva quando a sequência zerou", () => {
    expect(texto(streakStat({ currentStreak: 1, longestStreak: 1 }))).toContain("1 dia");
    expect(texto(streakStat({ currentStreak: 0, longestStreak: 4 }))).toContain("envie uma solução hoje");
  });

  it("badgeList separa conquistadas das bloqueadas e respeita filtro e limite", () => {
    expect(texto(badgeList(activity.badges))).toContain("1 de 2 conquistas");
    expect(String(badgeList(activity.badges, { onlyEarned: true }))).not.toContain("Maratonista");
    expect(String(badgeList(activity.badges, { limit: 1 }))).not.toContain("Maratonista");
    expect(texto(badgeList([], {}))).toContain("Nenhuma conquista ainda.");
  });
});

describe("tabelas e barras", () => {
  const catalogoPorId = { byId: new Map(catalogo.map((c) => [c.id, c])) };

  it("submissionTable liga ao desafio, mostra casos e pontos, e marca desafio removido", () => {
    const saida = texto(
      submissionTable([submissao({ scoreAwarded: 10 }), submissao({ challengeId: "x" })], catalogoPorId)
    );
    expect(saida).toContain("Soma de dois números");
    expect(saida).toContain("1/3");
    expect(saida).toContain("+10");
    expect(saida).toContain("Desafio removido");
    expect(saida).toContain("12 ms");
  });

  it("modo compacto esconde a coluna de tempo", () => {
    expect(texto(submissionTable([submissao()], catalogoPorId, { compact: true }))).not.toContain("Tempo");
  });

  it("barList escala as barras pelo maior valor", () => {
    const saida = String(
      barList([
        { label: "A", value: 10 },
        { label: "B", value: 5 }
      ])
    );
    expect(saida).toContain("width: 100%");
    expect(saida).toContain("width: 50%");
  });
});

describe("veredito", () => {
  it("resposta errada mostra o primeiro caso que falhou com a diferença", () => {
    const saida = texto(renderVerdict(submissao()));
    expect(saida).toContain("1 / 3 casos aprovados");
    expect(saida).toContain("Caso 2 de 3 · exemplo");
    expect(saida).toContain("Primeira diferença na linha 1");
    expect(saida).toContain("esperado");
  });

  it("aceito sem pontos explica que a pontuação conta uma vez", () => {
    const saida = texto(
      renderVerdict(
        submissao({
          status: "accepted",
          result: { passedTests: 3, totalTests: 3, runtimeMs: 5, failedTest: null },
          feedback: { title: "Aceito", message: "Tudo certo." }
        })
      )
    );
    expect(saida).toContain("os pontos são contados uma única vez");
  });

  it("aceito com pontos mostra a pontuação ganha", () => {
    const aceito = submissao({
      status: "accepted",
      scoreAwarded: 10,
      result: { passedTests: 3, totalTests: 3, runtimeMs: null, failedTest: null },
      feedback: { message: "Ok" }
    });
    const saida = texto(renderVerdict(aceito));
    expect(saida).toContain("+10 pontos");
    expect(saida).toContain("Aceito");
  });

  it("erro de compilação mostra a mensagem e os avisos, sem contagem de casos", () => {
    const erro = submissao({
      status: "compile_error",
      result: {
        passedTests: 0,
        totalTests: 3,
        runtimeMs: null,
        failedTest: null,
        compileError: "solucao.c:3: erro",
        compileWarnings: "aviso x"
      },
      feedback: { message: "Não compilou." }
    });
    const saida = texto(renderVerdict(erro));
    expect(saida).toContain("Mensagem do compilador");
    expect(saida).toContain("aviso x");
    expect(saida).not.toContain("casos aprovados");
  });

  it("violação de regra lista as regras", () => {
    const regra = submissao({
      status: "rule_violation",
      result: { passedTests: 0, totalTests: 3, runtimeMs: null, failedTest: null, ruleViolations: ["Use recursão"] },
      feedback: { message: "Regra" }
    });
    expect(texto(renderVerdict(regra))).toContain("Use recursão");
  });

  it("caseDetail no modo função mostra argumentos nomeados e retornos", () => {
    const spec = { params: [{ name: "n", type: "int" }], returns: "int" };
    const saida = texto(
      caseDetail(
        { input: "[5]", expectedOutput: "120", actualOutput: "24", executionStatus: "completed" },
        { functionSpec: spec }
      )
    );
    expect(saida).toContain("n = 5");
    expect(saida).toContain("Retorno esperado");
    expect(saida).toContain("A função retornou 24, mas o esperado era 120.");
  });

  it("caseDetail trata saída vazia, linha a mais, linha faltando e erro de execução", () => {
    const base = { input: "", expectedOutput: "a\nb", executionStatus: "completed" };
    expect(texto(caseDetail({ ...base, actualOutput: "" }))).toContain("não imprimiu nada");
    expect(texto(caseDetail({ ...base, actualOutput: "a" }))).toContain('Faltou imprimir a linha 2: esperado "b"');
    expect(texto(caseDetail({ ...base, expectedOutput: "a", actualOutput: "a\nb" }))).toContain(
      'Linha 2 a mais na saída: "b"'
    );
    expect(
      texto(
        caseDetail({ input: "x", expectedOutput: "1", actualOutput: "", error: "estourou", executionStatus: "timeout" })
      )
    ).toContain("Tempo esgotado");
    expect(
      texto(
        caseDetail({ input: "x", expectedOutput: null, actualOutput: "1", stderr: "dbg", executionStatus: "completed" })
      )
    ).toContain("stderr");
  });

  it("compileWarningsBlock é vazio sem avisos e compileErrorLine acha a linha do erro", () => {
    expect(String(compileWarningsBlock(""))).toBe("");
    expect(compileErrorLine("solucao.c:12: error")).toBe(12);
    expect(compileErrorLine('File "solucao.py", line 7')).toBe(7);
    expect(compileErrorLine("outra coisa")).toBeNull();
    expect(compileErrorLine(undefined)).toBeNull();
  });
});

describe("ícones, catálogo e trilhas", () => {
  it("icon desenha o SVG pedido e ignora nomes desconhecidos", () => {
    expect(String(icon("check", 20))).toContain('width="20"');
    expect(String(icon("nao-existe"))).toContain("></svg>");
  });

  it("loadCatalog indexa os desafios por id", async () => {
    mockApi({ "GET /api/challenges": { challenges: catalogo } });
    const { byId } = await loadCatalog();
    expect(byId.get("c2").slug).toBe("fatorial");
  });

  it("loadLearning junta trilhas e progresso; sem login não consulta o progresso", async () => {
    const fetchMock = mockApi({
      "GET /api/tracks": { tracks },
      "GET /api/tracks/progress": { completedLessonIds: ["l1"], solvedChallengeIds: ["c1"] }
    });
    const { done, progress } = await loadLearning();
    expect(progress).toBeNull();
    expect(done.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalledWith("/api/tracks/progress", expect.anything());
  });

  it("itemHref aponta para lição ou desafio", () => {
    expect(itemHref({ type: "lesson", slug: "a" })).toBe("#/licoes/a");
    expect(itemHref({ type: "challenge", slug: "b" })).toBe("#/desafios/b");
  });
});

describe("termos e privacidade", () => {
  it("renderiza cada documento com o link para o outro", () => {
    const raiz = document.getElementById("app");
    legal.render({ root: raiz, mode: "terms" });
    expect(raiz.querySelector("h1").textContent).toBe("Termos de uso");
    expect(raiz.querySelector('a[href="#/privacidade"]')).not.toBeNull();
    legal.render({ root: raiz, mode: "privacy" });
    expect(raiz.querySelector("h1").textContent).toBe("Política de privacidade");
    expect(raiz.textContent).toContain("LGPD");
  });
});

describe("paleta de comandos e atalhos", () => {
  beforeAll(() => installGlobalShortcuts());
  // O módulo guarda qual janela está aberta; como o DOM é recriado a cada teste, fechamos a anterior.
  beforeEach(() => {
    openShortcuts();
    document.querySelector("[data-close]").click();
  });
  const teclar = (key, opcoes = {}) =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opcoes }));

  it("Ctrl+K abre e fecha a busca; só páginas públicas para visitante", async () => {
    mockApi({ "GET /api/challenges": { challenges: catalogo }, "GET /api/tracks": { tracks } });
    teclar("k", { ctrlKey: true });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const opcoes = [...document.querySelectorAll(".palette-option")].map((o) => o.textContent);
    expect(opcoes.some((o) => o.includes("Trilhas"))).toBe(true);
    expect(opcoes.some((o) => o.includes("Dashboard"))).toBe(false);
    teclar("k", { ctrlKey: true });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("digitar filtra o catálogo (ignorando acentos) e Enter abre o resultado", async () => {
    mockApi({ "GET /api/challenges": { challenges: catalogo }, "GET /api/tracks": { tracks } });
    await openPalette();
    const entrada = document.querySelector(".palette-input input");
    entrada.value = "licao ola";
    entrada.dispatchEvent(new Event("input"));
    await flush();
    await flush();
    expect(document.querySelector(".palette-title").textContent).toBe("Olá, mundo");
    entrada.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(window.location.hash).toBe("#/licoes/ola-mundo");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("setas movem a seleção e uma busca sem resultado mostra aviso", async () => {
    mockApi({ "GET /api/challenges": { challenges: catalogo }, "GET /api/tracks": { tracks } });
    await openPalette();
    await flush();
    const entrada = document.querySelector(".palette-input input");
    entrada.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.querySelectorAll(".palette-option")[1].classList.contains("is-active")).toBe(true);
    entrada.value = "zzzzzz";
    entrada.dispatchEvent(new Event("input"));
    await flush();
    await flush();
    expect(document.querySelector(".palette-empty").textContent).toContain("Nada encontrado");
  });

  it("? abre os atalhos, Esc fecha e 'g t' navega para as trilhas", () => {
    teclar("?");
    expect(document.querySelector(".shortcut-list")).not.toBeNull();
    document
      .querySelector(".dialog-overlay")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".dialog-overlay")).toBeNull();
    teclar("g");
    teclar("t");
    expect(window.location.hash).toBe("#/trilhas");
  });

  it("atalhos são ignorados enquanto a pessoa digita num campo", () => {
    const campo = document.createElement("input");
    document.body.append(campo);
    campo.dispatchEvent(new KeyboardEvent("keydown", { key: "?", bubbles: true }));
    expect(document.querySelector(".shortcut-list")).toBeNull();
    openShortcuts();
    document.querySelector("[data-close]").click();
    expect(document.querySelector(".dialog-overlay")).toBeNull();
  });
});
