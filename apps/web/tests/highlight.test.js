import { describe, expect, it } from "vitest";
import { highlight } from "../public/js/highlight.js";

describe("highlight", () => {
  it("destaca palavras-chave, tipos, números, strings e comentários de C", () => {
    const saida = highlight('int main() { return 42; } // fim\nchar *s = "oi";', "c");
    expect(saida).toContain('<span class="tok-type">int</span>');
    expect(saida).toContain('<span class="tok-function">main</span>');
    expect(saida).toContain('<span class="tok-keyword">return</span>');
    expect(saida).toContain('<span class="tok-number">42</span>');
    expect(saida).toContain('<span class="tok-comment">// fim</span>');
    expect(saida).toContain('<span class="tok-string">&quot;oi&quot;</span>');
  });

  it("reconhece diretivas de pré-processador só em C", () => {
    expect(highlight("#include <stdio.h>", "c")).toContain("tok-preprocessor");
    expect(highlight("#include <stdio.h>", "javascript")).not.toContain("tok-preprocessor");
  });

  it("usa JavaScript quando a linguagem é desconhecida", () => {
    expect(highlight("const x = null;", "cobol")).toContain('<span class="tok-keyword">const</span>');
  });

  it("escapa o código fora dos tokens e trata comentário e string sem fechamento", () => {
    expect(highlight("a < b && c", "javascript")).toContain("a &lt; b &amp;&amp; c");
    expect(highlight("/* aberto", "c")).toContain("tok-comment");
    expect(highlight('"aberta', "javascript")).toContain("tok-string");
  });

  it("números hexadecimais e decimais com sufixo", () => {
    expect(highlight("0xFF 3.14f", "c")).toContain('<span class="tok-number">0xFF</span>');
    expect(highlight("0xFF 3.14f", "c")).toContain('<span class="tok-number">3.14f</span>');
  });
});
