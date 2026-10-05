import { api } from "../api.js";
import { DIFFICULTY_LABELS, html, render } from "../dom.js";
import { icon } from "../icons.js";
import { navigate } from "../router.js";
import { getSession } from "../session.js";

// Paleta de comandos (Ctrl+K / ⌘K): busca desafios, lições, trilhas e
// páginas; setas escolhem, Enter abre, Esc fecha. Também abre a lista de
// atalhos de teclado (?).
const normalize = (text) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const PAGES = [
  { title: "Início", path: "/", hint: "Página inicial", keywords: "home landing" },
  { title: "Dashboard", path: "/dashboard", hint: "Seu progresso", auth: true, keywords: "painel progresso" },
  { title: "Trilhas", path: "/trilhas", hint: "Roadmap por assunto", keywords: "roadmap modulos" },
  { title: "Desafios", path: "/desafios", hint: "Catálogo completo", keywords: "problemas exercicios" },
  { title: "Ranking", path: "/ranking", hint: "Classificação", keywords: "placar pontos" },
  { title: "Perfil", path: "/perfil", hint: "Histórico e conquistas", auth: true, keywords: "conta historico" },
  { title: "Administração", path: "/admin", hint: "Área do professor", admin: true, keywords: "admin" }
];

let catalog = null;
let loading = null;

async function loadCatalog() {
  if (catalog) return catalog;
  loading ??= Promise.all([api.challenges().catch(() => ({ challenges: [] })), api.tracks().catch(() => ({ tracks: [] }))]).then(
    ([challengeData, trackData]) => {
      const items = [];
      for (const track of trackData.tracks) {
        items.push({ kind: "Trilha", title: track.title, path: `/trilhas/${track.slug}`, hint: `${track.modules.length} módulos`, keywords: track.description });
        for (const module of track.modules) {
          for (const lesson of module.lessons) {
            items.push({ kind: "Lição", title: lesson.title, path: `/licoes/${lesson.slug}`, hint: `${track.title} · ${module.title}`, keywords: lesson.summary });
          }
        }
      }
      for (const challenge of challengeData.challenges) {
        items.push({
          kind: "Desafio",
          title: challenge.title,
          path: `/desafios/${challenge.slug}`,
          hint: `${DIFFICULTY_LABELS[challenge.difficulty]} · ${challenge.subtopic || challenge.topic}`,
          keywords: `${challenge.slug} ${challenge.tags?.join(" ") ?? ""} ${challenge.topic} ${challenge.subtopic}`,
          difficulty: challenge.difficulty
        });
      }
      catalog = items;
      return items;
    }
  );
  return loading;
}

function search(items, query) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return items.slice(0, 8);
  const scored = [];
  for (const item of items) {
    const title = normalize(item.title);
    const haystack = `${title} ${normalize(item.hint)} ${normalize(item.keywords)} ${normalize(item.kind)}`;
    if (!terms.every((term) => haystack.includes(term))) continue;
    const score = (title.startsWith(terms[0]) ? 0 : title.includes(terms[0]) ? 1 : 2) + (item.kind === "Página" ? -0.5 : 0);
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title)).slice(0, 30).map((entry) => entry.item);
}

const SHORTCUTS = [
  ["Ctrl + K", "Abrir a busca rápida"],
  ["?", "Mostrar estes atalhos"],
  ["g depois t", "Ir para as trilhas"],
  ["g depois d", "Ir para os desafios"],
  ["g depois p", "Ir para o perfil"],
  ["Ctrl + Enter", "Executar nos exemplos (no editor)"],
  ["Ctrl + Shift + Enter", "Enviar a solução (no editor)"],
  ["Ctrl + /", "Comentar ou descomentar linhas"],
  ["Ctrl + F", "Buscar no código"],
  ["Tab / Shift + Tab", "Indentar / desindentar"],
  ["Esc", "Sair do editor ou fechar janelas"]
];

let open = null;

function close() {
  if (!open) return;
  const { overlay, previousFocus } = open;
  overlay.remove();
  open = null;
  previousFocus?.focus?.({ preventScroll: true });
}

function mountDialog(label, content) {
  close();
  const overlay = document.createElement("div");
  overlay.className = "dialog-overlay";
  const previousFocus = document.activeElement;
  render(overlay, html`<div class="dialog" role="dialog" aria-modal="true" aria-label="${label}">${content}</div>`);
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) close();
  });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key === "Tab") {
      // Mantém o foco dentro da janela.
      const focusable = [...overlay.querySelectorAll("input, button, a[href]")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.getElementById("overlay-root").append(overlay);
  open = { overlay, previousFocus };
  return overlay;
}

export function openShortcuts() {
  const overlay = mountDialog(
    "Atalhos de teclado",
    html`
      <div class="dialog-head">
        <h2>${icon("keyboard", 16)} Atalhos de teclado</h2>
        <button class="icon-button" type="button" data-close aria-label="Fechar">${icon("x")}</button>
      </div>
      <dl class="shortcut-list">
        ${SHORTCUTS.map(([keys, description]) => html`<div><dt>${keys.split(" ").map((key) => (["+", "/", "depois"].includes(key) ? html`<span class="muted"> ${key} </span>` : html`<kbd>${key}</kbd>`))}</dt><dd>${description}</dd></div>`)}
      </dl>
    `
  );
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.querySelector("[data-close]").focus();
}

export async function openPalette() {
  const session = getSession();
  const pages = PAGES.filter((page) => (!page.auth || session.user) && (!page.admin || session.user?.role === "admin")).map((page) => ({ ...page, kind: "Página" }));
  const overlay = mountDialog(
    "Busca rápida",
    html`
      <div class="palette-input">
        ${icon("search", 16)}
        <input type="text" role="combobox" aria-expanded="true" aria-controls="palette-results" aria-autocomplete="list" placeholder="Buscar desafios, lições, trilhas e páginas…" aria-label="Buscar" />
        <kbd>Esc</kbd>
      </div>
      <ul id="palette-results" class="palette-results" role="listbox" aria-label="Resultados"></ul>
      <div class="palette-foot muted small"><span><kbd>↑</kbd> <kbd>↓</kbd> navegar · <kbd>Enter</kbd> abrir</span><button type="button" class="btn btn-sm btn-ghost" data-shortcuts>${icon("keyboard", 14)} Atalhos</button></div>
    `
  );
  const input = overlay.querySelector("input");
  const list = overlay.querySelector("#palette-results");
  let results = pages;
  let active = 0;

  const paintResults = () => {
    if (!results.length) {
      render(list, html`<li class="palette-empty">Nada encontrado para “${input.value}”.</li>`);
      input.removeAttribute("aria-activedescendant");
      return;
    }
    render(
      list,
      results.map(
        (item, index) => html`
          <li id="palette-option-${index}" role="option" aria-selected="${index === active}" class="palette-option ${index === active ? "is-active" : ""}" data-index="${index}">
            <span class="palette-kind">${item.kind}</span>
            <span class="palette-title">${item.title}</span>
            <span class="palette-hint">${item.hint ?? ""}</span>
          </li>
        `
      )
    );
    input.setAttribute("aria-activedescendant", `palette-option-${active}`);
    list.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  };

  const update = async () => {
    const query = input.value;
    const items = await loadCatalog();
    if (!open || input.value !== query) return;
    results = search([...pages, ...items], query);
    active = 0;
    paintResults();
  };

  const choose = (item) => {
    if (!item) return;
    close();
    navigate(item.path);
  };

  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      active = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
      paintResults();
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  });
  list.addEventListener("click", (event) => {
    const option = event.target.closest("[data-index]");
    if (option) choose(results[Number(option.dataset.index)]);
  });
  overlay.querySelector("[data-shortcuts]").addEventListener("click", openShortcuts);
  paintResults();
  input.focus();
  update();
}

const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Atalhos globais: Ctrl+K, ? e sequências "g t" / "g d" / "g p". */
export function installGlobalShortcuts() {
  let pendingG = 0;
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (open) close();
      else openPalette();
      return;
    }
    if (open || isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "?") {
      event.preventDefault();
      openShortcuts();
      return;
    }
    if (event.key === "g") {
      pendingG = Date.now();
      return;
    }
    if (Date.now() - pendingG < 1200) {
      const target = { t: "/trilhas", d: "/desafios", p: "/perfil", r: "/ranking" }[event.key];
      pendingG = 0;
      if (target) {
        event.preventDefault();
        navigate(target);
      }
    }
  });
}
