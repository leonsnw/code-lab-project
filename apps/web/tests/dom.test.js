import { describe, expect, it, vi } from "vitest";
import {
  $,
  $$,
  challengeSummary,
  difficultyPill,
  emptyState,
  escapeHtml,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
  html,
  initials,
  languagePill,
  meter,
  raw,
  readLocal,
  render,
  statusPill,
  writeLocal
} from "../public/js/dom.js";

describe("escapeHtml e o template html", () => {
  it("escapa os cinco caracteres perigosos", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });

  it("trata null e undefined como texto vazio", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("escapa toda interpolação, evitando XSS em nomes e comentários", () => {
    const nome = "<img src=x onerror=alert(1)>";
    expect(String(html`<p>${nome}</p>`)).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
  });

  it("não escapa duas vezes o que já foi produzido por html()", () => {
    const interno = html`<b>${"a & b"}</b>`;
    expect(String(html`<p>${interno}</p>`)).toBe("<p><b>a &amp; b</b></p>");
  });

  it("junta listas, ignora null/undefined e mantém booleanos como texto", () => {
    expect(String(html`${[1, 2, html`<i>3</i>`]}|${null}|${undefined}|${false}`)).toBe("12<i>3</i>|||false");
  });

  it("raw() marca HTML confiável", () => {
    expect(String(html`${raw("<hr>")}`)).toBe("<hr>");
  });

  it("render() escreve no elemento e $ / $$ consultam o DOM", () => {
    const alvo = document.createElement("div");
    render(alvo, html`<ul><li>um</li><li>dois</li></ul>`);
    expect($$("li", alvo)).toHaveLength(2);
    expect($("li", alvo).textContent).toBe("um");
    expect($("#app")).not.toBeNull();
  });
});

describe("formatação", () => {
  it("formata números no padrão pt-BR", () => {
    expect(formatNumber(1234567)).toBe("1.234.567");
    expect(formatNumber(undefined)).toBe("0");
  });

  it("formata percentuais com uma casa decimal", () => {
    expect(formatPercent(0.5)).toBe("0,5%");
    expect(formatPercent(12.34)).toBe("12,3%");
    expect(formatPercent(null)).toBe("0%");
  });

  it("formatDateTime devolve travessão para vazio e data curta para valores", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("2026-03-05T14:30:00Z")).toMatch(/\d{2}\/\d{2}\/\d{2,4}/);
  });

  it("formatRelative escolhe a unidade pelo tempo decorrido", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    const atras = (segundos) => new Date(Date.now() - segundos * 1000).toISOString();
    expect(formatRelative(null)).toBe("—");
    expect(formatRelative(atras(10))).toBe("agora mesmo");
    expect(formatRelative(atras(5 * 60))).toBe("há 5 min");
    expect(formatRelative(atras(3 * 3600))).toBe("há 3 h");
    expect(formatRelative(atras(24 * 3600))).toBe("há 1 dia");
    expect(formatRelative(atras(3 * 24 * 3600))).toBe("há 3 dias");
    expect(formatRelative(atras(30 * 24 * 3600))).toMatch(/\d{2}\/\d{2}/);
    vi.useRealTimers();
  });

  it("initials usa as duas primeiras palavras", () => {
    expect(initials("marina souza lima")).toBe("MS");
    expect(initials("  ana  ")).toBe("A");
    expect(initials(undefined)).toBe("?");
  });
});

describe("componentes pequenos", () => {
  it("challengeSummary usa a última linha da descrição", () => {
    expect(challengeSummary({ description: "Enunciado.\n\nResumo final." })).toBe("Resumo final.");
    expect(challengeSummary({})).toBe("");
  });

  it("pills traduzem dificuldade, status e linguagem e preservam valores desconhecidos", () => {
    expect(String(difficultyPill("easy"))).toContain("Fácil");
    expect(String(difficultyPill("insano"))).toContain("insano");
    expect(String(statusPill("wrong_answer"))).toContain("Resposta errada");
    expect(String(statusPill("accepted"))).toContain("status-accepted");
    expect(String(languagePill("c"))).toContain(">C<");
    expect(String(languagePill("rust"))).toContain("rust");
  });

  it("meter calcula a porcentagem e não divide por zero", () => {
    expect(String(meter("Fácil", 1, 4))).toContain("25%");
    expect(String(meter("Vazio", 0, 0))).toContain("0%");
    expect(String(meter("Total", 2, 4))).toContain('aria-valuenow="2"');
  });

  it("emptyState mostra a mensagem escapada", () => {
    expect(String(emptyState("<nada>"))).toContain("&lt;nada&gt;");
  });
});

describe("armazenamento local", () => {
  it("lê, grava e remove valores", () => {
    expect(readLocal("k", "padrao")).toBe("padrao");
    writeLocal("k", "valor");
    expect(readLocal("k")).toBe("valor");
    writeLocal("k", null);
    expect(readLocal("k")).toBeNull();
  });

  it("não quebra quando o navegador bloqueia o armazenamento", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(readLocal("k", "padrao")).toBe("padrao");
    expect(() => writeLocal("k", "v")).not.toThrow();
  });
});
