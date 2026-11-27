import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../public/js/markdown.js";

const md = (source) => String(renderMarkdown(source));

describe("renderMarkdown", () => {
  it("converte títulos, rebaixando um nível (o h1 da página é da tela)", () => {
    expect(md("# Título")).toContain("<h2>Título</h2>");
    expect(md("### Seção")).toContain("<h4>Seção</h4>");
  });

  it("converte negrito, itálico e código em linha", () => {
    const saida = md("**forte** e *ênfase* e `x < y`");
    expect(saida).toContain("<strong>forte</strong>");
    expect(saida).toContain("<em>ênfase</em>");
    expect(saida).toContain("<code>x &lt; y</code>");
  });

  it("não deixa HTML embutido passar (XSS)", () => {
    const saida = md("<script>alert(1)</script> e [x](javascript:alert(1))");
    expect(saida).not.toContain("<script>");
    expect(saida).toContain("&lt;script&gt;");
    expect(saida).not.toContain('href="javascript');
  });

  it("só aceita links http(s) e rotas internas; externos abrem em nova aba segura", () => {
    expect(md("[site](https://exemplo.com)")).toContain('target="_blank" rel="noopener noreferrer"');
    expect(md("[trilha](#/trilhas)")).toContain('<a href="#/trilhas">trilha</a>');
  });

  it("monta listas ordenadas e não ordenadas", () => {
    expect(md("- a\n- b")).toContain("<ul><li>a</li><li>b</li></ul>");
    expect(md("1. um\n2. dois")).toContain("<ol><li>um</li><li>dois</li></ol>");
  });

  it("monta citações e parágrafos", () => {
    expect(md("> dica\n> importante")).toContain("<blockquote>dica importante</blockquote>");
    expect(md("linha 1\nlinha 2\n\noutro")).toContain("<p>linha 1 linha 2</p>");
  });

  it("realça blocos de código das linguagens conhecidas e escapa as demais", () => {
    expect(md("```c\nint x = 1;\n```")).toContain('<span class="tok-type">int</span>');
    expect(md("```js\nconst a = 1;\n```")).toContain('<span class="tok-keyword">const</span>');
    expect(md("```\n<b>\n```")).toContain("&lt;b&gt;");
  });

  it("monta tabelas, respeitando barras dentro de código e escapadas", () => {
    const saida = md("| a | b |\n|---|---|\n| `x|y` | 1 \\| 2 |");
    expect(saida).toContain("<th>a</th><th>b</th>");
    expect(saida).toContain("<td><code>x|y</code></td>");
    expect(saida).toContain("<td>1 | 2</td>");
  });

  it("transforma ||texto|| em spoiler acessível", () => {
    expect(md("a ||resposta|| b")).toContain('class="spoiler" tabindex="0" role="button"');
  });

  it("aceita entrada vazia e quebras de linha do Windows", () => {
    expect(md(undefined)).toContain('<div class="markdown"></div>');
    expect(md("a\r\nb")).toContain("<p>a b</p>");
  });
});
