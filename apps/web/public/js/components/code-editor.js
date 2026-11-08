import { highlight } from "../highlight.js";

// Editor leve sobre <textarea>: numeração de linhas, realce de sintaxe,
// indentação com Tab, auto-indentação no Enter, fechamento automático de
// parênteses e aspas, comentar linhas (Ctrl+/), busca (Ctrl+F) e atalhos de
// executar/enviar. O realce é um <pre> colorido por baixo de um textarea com
// texto transparente: digitação, seleção e acessibilidade continuam nativas.
const INDENTS = { javascript: "  ", python: "    ", c: "    " };
const LINE_COMMENTS = { javascript: "//", python: "#", c: "//" };
const PAIRS = { "(": ")", "[": "]", "{": "}", '"': '"', "'": "'" };
const CLOSERS = new Set([")", "]", "}"]);

export function createCodeEditor(container, { value = "", onChange, onRun, onSubmit, label = "Código da solução", language: initialLanguage = "javascript" } = {}) {
  let language = initialLanguage;
  const indent = () => INDENTS[language] ?? "  ";
  container.classList.add("code-editor");
  container.innerHTML = "";

  const gutter = document.createElement("div");
  gutter.className = "gutter";
  gutter.setAttribute("aria-hidden", "true");

  const textarea = document.createElement("textarea");
  textarea.spellcheck = false;
  textarea.autocapitalize = "off";
  textarea.setAttribute("autocomplete", "off");
  textarea.setAttribute("autocorrect", "off");
  textarea.setAttribute("wrap", "off");
  textarea.setAttribute("aria-label", label);
  textarea.value = value;

  const area = document.createElement("div");
  area.className = "code-area";
  const layer = document.createElement("pre");
  layer.className = "code-highlight";
  layer.setAttribute("aria-hidden", "true");
  area.append(layer, textarea);

  // Barra de busca (Ctrl+F dentro do editor).
  const search = document.createElement("div");
  search.className = "editor-search";
  search.hidden = true;
  search.innerHTML = `
    <input type="search" aria-label="Buscar no código" placeholder="Buscar no código" />
    <span class="editor-search-count" aria-live="polite"></span>
    <button type="button" data-search="prev" aria-label="Ocorrência anterior" title="Anterior (Shift+Enter)">↑</button>
    <button type="button" data-search="next" aria-label="Próxima ocorrência" title="Próxima (Enter)">↓</button>
    <button type="button" data-search="close" aria-label="Fechar busca" title="Fechar (Esc)">×</button>`;
  const searchInput = search.querySelector("input");
  const searchCount = search.querySelector(".editor-search-count");
  container.append(search, gutter, area);

  let errorLine = null;
  const listeners = new Set();

  function refresh() {
    // A quebra final extra mantém a última linha vazia com a mesma altura.
    layer.innerHTML = `${highlight(textarea.value, language)}\n`;
    const lines = textarea.value.split("\n").length;
    gutter.innerHTML = Array.from({ length: lines }, (_, index) =>
      index + 1 === errorLine ? `<span class="is-error">${index + 1}</span>` : String(index + 1)
    ).join("\n");
    textarea.style.height = "auto";
    textarea.style.width = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, container.clientHeight)}px`;
    textarea.style.width = `${Math.max(textarea.scrollWidth, container.clientWidth - gutter.offsetWidth)}px`;
  }

  function emitCursor() {
    const before = textarea.value.slice(0, textarea.selectionStart);
    const line = before.split("\n").length;
    const column = before.length - before.lastIndexOf("\n");
    listeners.forEach((listener) => listener({ line, column }));
  }

  function replaceSelection(text, selectOffset = text.length) {
    const { selectionStart, selectionEnd } = textarea;
    textarea.setRangeText(text, selectionStart, selectionEnd, "end");
    textarea.selectionStart = textarea.selectionEnd = selectionStart + selectOffset;
    changed();
  }

  function changed() {
    errorLine = null;
    refresh();
    onChange?.(textarea.value);
  }

  function lineStartOf(position) {
    return textarea.value.lastIndexOf("\n", position - 1) + 1;
  }

  /** Aplica `transform` a cada linha tocada pela seleção, preservando a seleção. */
  function transformLines(transform) {
    const { value: text, selectionStart, selectionEnd } = textarea;
    const start = lineStartOf(selectionStart);
    const endIndex = text.indexOf("\n", selectionEnd > selectionStart && text[selectionEnd - 1] === "\n" ? selectionEnd - 1 : selectionEnd);
    const end = endIndex === -1 ? text.length : endIndex;
    const lines = text.slice(start, end).split("\n");
    const updated = transform(lines);
    const replacement = updated.join("\n");
    textarea.setRangeText(replacement, start, end, "preserve");
    const firstDelta = updated[0].length - lines[0].length;
    textarea.selectionStart = Math.max(start, selectionStart + firstDelta);
    textarea.selectionEnd = Math.max(textarea.selectionStart, selectionEnd + (replacement.length - (end - start)));
    changed();
  }

  function indentSelection(outdent) {
    const unit = indent();
    const pattern = new RegExp(`^ {1,${unit.length}}`);
    transformLines((lines) => lines.map((line) => (outdent ? line.replace(pattern, "") : unit + line)));
  }

  function toggleComment() {
    const marker = LINE_COMMENTS[language] ?? "//";
    transformLines((lines) => {
      const filled = lines.filter((line) => line.trim());
      const commented = filled.length > 0 && filled.every((line) => line.trimStart().startsWith(marker));
      return lines.map((line) => {
        if (!line.trim()) return line;
        if (commented) return line.replace(new RegExp(`^(\\s*)${marker.replace(/\//g, "\\/")} ?`), "$1");
        const spaces = line.match(/^\s*/)[0];
        return `${spaces}${marker} ${line.slice(spaces.length)}`;
      });
    });
  }

  // ---------- Busca ----------
  let matches = [];
  let matchIndex = -1;

  function findMatches() {
    const query = searchInput.value;
    matches = [];
    if (!query) return;
    const text = textarea.value.toLowerCase();
    const needle = query.toLowerCase();
    for (let index = text.indexOf(needle); index !== -1 && matches.length < 5000; index = text.indexOf(needle, index + needle.length)) {
      matches.push(index);
    }
  }

  function goToMatch(step) {
    findMatches();
    if (!matches.length) {
      matchIndex = -1;
      searchCount.textContent = searchInput.value ? "0 resultados" : "";
      return;
    }
    const cursor = textarea.selectionStart;
    if (step === 0) matchIndex = matches.findIndex((position) => position >= cursor);
    else matchIndex = (matchIndex + step + matches.length) % matches.length;
    if (matchIndex < 0) matchIndex = 0;
    const start = matches[matchIndex];
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(start, start + searchInput.value.length);
    scrollToSelection();
    searchInput.focus({ preventScroll: true });
    searchCount.textContent = `${matchIndex + 1} de ${matches.length}`;
  }

  function scrollToSelection() {
    const line = textarea.value.slice(0, textarea.selectionStart).split("\n").length;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 20;
    const scroller = container;
    const top = (line - 1) * lineHeight;
    if (top < scroller.scrollTop || top > scroller.scrollTop + scroller.clientHeight - lineHeight * 2) {
      scroller.scrollTop = Math.max(0, top - scroller.clientHeight / 3);
    }
  }

  function openSearch() {
    search.hidden = false;
    const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
    if (selected && !selected.includes("\n")) searchInput.value = selected;
    searchInput.focus();
    searchInput.select();
    if (searchInput.value) goToMatch(0);
  }

  function closeSearch() {
    search.hidden = true;
    searchCount.textContent = "";
    textarea.focus();
  }

  searchInput.addEventListener("input", () => goToMatch(0));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      goToMatch(event.shiftKey ? -1 : 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeSearch();
    }
  });
  search.addEventListener("click", (event) => {
    const action = event.target.closest("[data-search]")?.dataset.search;
    if (action === "prev") goToMatch(-1);
    if (action === "next") goToMatch(1);
    if (action === "close") closeSearch();
  });

  // ---------- Teclado ----------
  textarea.addEventListener("keydown", (event) => {
    const mod = event.ctrlKey || event.metaKey;
    const { selectionStart, selectionEnd, value: text } = textarea;
    const hasSelection = selectionStart !== selectionEnd;

    if (mod && event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) onSubmit?.();
      else onRun?.();
      return;
    }
    if (mod && (event.key === "/" || event.code === "Slash")) {
      event.preventDefault();
      toggleComment();
      return;
    }
    if (mod && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === "Escape") {
      textarea.blur();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const multiline = text.slice(selectionStart, selectionEnd).includes("\n");
      if (event.shiftKey || multiline) indentSelection(event.shiftKey);
      else replaceSelection(indent());
      return;
    }
    if (mod || event.altKey) return;

    const next = text[selectionStart];
    // Fechamento automático: envolve a seleção ou insere o par.
    if (PAIRS[event.key]) {
      const isQuote = event.key === '"' || event.key === "'";
      if (isQuote && !hasSelection && next === event.key) {
        event.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
        return;
      }
      const previous = text[selectionStart - 1] ?? "";
      const quoteInsideWord = isQuote && /\w/.test(previous);
      if (hasSelection) {
        event.preventDefault();
        const selected = text.slice(selectionStart, selectionEnd);
        textarea.setRangeText(`${event.key}${selected}${PAIRS[event.key]}`, selectionStart, selectionEnd, "preserve");
        textarea.selectionStart = selectionStart + 1;
        textarea.selectionEnd = selectionEnd + 1;
        changed();
        return;
      }
      if (!quoteInsideWord && (next === undefined || /[\s)\]};,]/.test(next))) {
        event.preventDefault();
        replaceSelection(`${event.key}${PAIRS[event.key]}`, 1);
        return;
      }
    }
    // Digitar o fechamento que já está à direita só avança o cursor.
    if (CLOSERS.has(event.key) && !hasSelection && next === event.key) {
      event.preventDefault();
      textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
      return;
    }
    // Backspace entre um par vazio apaga os dois.
    if (event.key === "Backspace" && !hasSelection && selectionStart > 0) {
      const previous = text[selectionStart - 1];
      if (PAIRS[previous] && PAIRS[previous] === next) {
        event.preventDefault();
        textarea.setRangeText("", selectionStart - 1, selectionStart + 1, "end");
        changed();
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const start = lineStartOf(selectionStart);
      const currentLine = text.slice(start, selectionStart);
      const indentation = currentLine.match(/^\s*/)[0];
      const opensBlock = /[{[(]\s*$/.test(currentLine) || (language === "python" && /:\s*$/.test(currentLine));
      const closesBlock = /[{[(]\s*$/.test(currentLine) && /[}\])]/.test(next ?? "");
      if (closesBlock) {
        const inner = `\n${indentation}${indent()}`;
        replaceSelection(`${inner}\n${indentation}`, inner.length);
      } else {
        replaceSelection(`\n${indentation}${opensBlock ? indent() : ""}`);
      }
    }
  });

  textarea.addEventListener("input", changed);
  ["keyup", "click", "focus"].forEach((name) => textarea.addEventListener(name, emitCursor));
  const resizeObserver = new ResizeObserver(refresh);
  resizeObserver.observe(container);
  refresh();

  return {
    getValue: () => textarea.value,
    setValue(next) {
      textarea.value = next;
      changed();
    },
    focus: () => textarea.focus(),
    markErrorLine(line) {
      errorLine = line;
      refresh();
    },
    onCursor: (listener) => listeners.add(listener),
    setLanguage(next) {
      language = next;
      textarea.setAttribute("aria-label", `Código da solução (${next})`);
      refresh();
    },
    openSearch,
    destroy: () => resizeObserver.disconnect()
  };
}
