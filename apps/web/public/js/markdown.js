import { escapeHtml, raw } from "./dom.js";
import { highlight } from "./highlight.js";

// Markdown seguro para lições, soluções comentadas e comentários: todo texto é escapado,
// links só aceitam http(s) e rotas internas (#/...), sem HTML embutido.
const LANGUAGE_ALIASES = { js: "javascript", javascript: "javascript", c: "c", py: "python", python: "python" };

function inline(text) {
  const codes = [];
  let output = escapeHtml(text).replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  output = output
    .replace(/\|\|([^|]+)\|\|/g, '<span class="spoiler" tabindex="0" role="button" aria-label="Spoiler escondido: ative para revelar">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|#\/[^)\s]*)\)/g, (_, label, href) => {
      const external = href.startsWith("http");
      return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${label}</a>`;
    });
  return output.replace(/\u0000(\d+)\u0000/g, (_, index) => codes[Number(index)]);
}

function table(rows) {
  // Divide nas barras, exceto dentro de `código` e em "\|" (barra escapada).
  const cells = (row) => {
    const inner = row.trim().replace(/^\|/, "").replace(/\|$/, "");
    const result = [];
    let current = "";
    let inCode = false;
    for (let index = 0; index < inner.length; index += 1) {
      const char = inner[index];
      if (char === "\\" && inner[index + 1] === "|") {
        current += "|";
        index += 1;
      } else if (char === "`") {
        inCode = !inCode;
        current += char;
      } else if (char === "|" && !inCode) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  const [head, , ...body] = rows;
  return `<div class="table-wrap md-table"><table><thead><tr>${cells(head).map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body
    .map((row) => `<tr>${cells(row).map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

export function renderMarkdown(source) {
  const lines = String(source ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) code.push(lines[index++]);
      index += 1;
      const language = LANGUAGE_ALIASES[(fence[1] ?? "").toLowerCase()];
      const body = code.join("\n");
      blocks.push(`<pre class="code-view md-code">${language ? highlight(body, language) : escapeHtml(body)}</pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 5);
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\|.+\|\s*$/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[index + 1] ?? "")) {
      const rows = [];
      while (index < lines.length && /^\|.+\|\s*$/.test(lines[index])) rows.push(lines[index++]);
      blocks.push(table(rows));
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^\s*([-*]|\d+\.)\s+/, ""))}</li>`);
        index += 1;
      }
      blocks.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
      blocks.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const paragraph = [];
    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !/^(```|#{1,4}\s|>\s?|\s*([-*]|\d+\.)\s+|\|.+\|)/.test(lines[index])
    ) {
      paragraph.push(lines[index++]);
    }
    blocks.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }

  return raw(`<div class="markdown">${blocks.join("\n")}</div>`);
}
