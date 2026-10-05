import { $, challengeSummary, DIFFICULTY_LABELS, difficultyPill, emptyState, html, languagePill, meter, readLocal, render as paint, writeLocal } from "../dom.js";
import { loadCatalog } from "../catalog.js";
import { getSession, isSolved } from "../session.js";
import { icon } from "../icons.js";

const FILTER_KEY = "codelab:catalog-filters";
const LANGUAGES = [
  ["", "Todas"],
  ["javascript", "JavaScript"],
  ["python", "Python"],
  ["c", "C"]
];

function readSavedFilters() {
  try {
    return JSON.parse(readLocal(FILTER_KEY, "{}")) ?? {};
  } catch {
    return {};
  }
}

const subtopicOf = (challenge) => challenge.subtopic || "Outros";

export async function render({ root, query }) {
  const catalog = await loadCatalog();
  const session = getSession();
  const saved = readSavedFilters();
  const topics = [...new Set(catalog.challenges.map((challenge) => challenge.topic))].sort();
  const state = {
    search: query.get("busca") ?? "",
    language: query.get("linguagem") ?? saved.language ?? "",
    topic: query.get("assunto") ?? saved.topic ?? "",
    subtopic: query.get("subtema") ?? "",
    difficulty: query.get("nivel") ?? "",
    status: ""
  };

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha">
        <a href="${session.user ? "#/dashboard" : "#/"}">${session.user ? "Dashboard" : "Início"}</a><span>›</span><span>Desafios</span>
      </nav>
      <div class="page-head">
        <div>
          <h1>Desafios de programação</h1>
          <p class="lead">Escolha a linguagem e o assunto. Cada desafio é corrigido automaticamente por casos de teste.</p>
        </div>
      </div>

      <div class="catalog-tabs">
        <div class="tabbar" role="tablist" aria-label="Assunto" id="topic-tabs"></div>
        <div class="chip-group" role="group" aria-label="Linguagem" id="language-tabs"></div>
      </div>

      <div class="grid-main">
        <div class="stack">
          <section class="card">
            <div class="filters">
              <div class="search-field">${icon("search")}<label class="sr-only" for="catalog-search">Buscar desafio</label><input id="catalog-search" class="input" type="search" placeholder="Buscar por título, descrição ou tag" value="${state.search}" /></div>
              <label class="sr-only" for="catalog-difficulty">Dificuldade</label>
              <select id="catalog-difficulty" class="input" style="flex: 0 0 150px; width: auto">
                <option value="">Todos os níveis</option>
                ${Object.entries(DIFFICULTY_LABELS).map(([value, label]) => html`<option value="${value}" ${state.difficulty === value ? html`selected` : ""}>${label}</option>`)}
              </select>
              ${session.user
                ? html`<label class="sr-only" for="catalog-status">Situação</label>
                    <select id="catalog-status" class="input" style="flex: 0 0 170px; width: auto">
                      <option value="">Todas as situações</option>
                      <option value="pending">Não resolvidos</option>
                      <option value="solved">Resolvidos</option>
                    </select>`
                : ""}
            </div>
            <div id="subtopic-chips" class="subtopics"></div>
          </section>
          <section class="card" id="catalog-results" aria-live="polite"></section>
        </div>

        <aside class="stack">
          ${session.user
            ? html`<section class="card">
                <h2>Seu progresso</h2>
                ${session.progress.byDifficulty.map((item) => meter(DIFFICULTY_LABELS[item.difficulty], item.solved, item.total))}
              </section>`
            : html`<section class="card">
                <h2>Crie sua conta</h2>
                <p class="muted small">Você precisa estar autenticado para abrir o editor e enviar soluções.</p>
                <div class="btn-row"><a class="btn btn-primary btn-sm" href="#/cadastro">Criar conta</a><a class="btn btn-sm" href="#/entrar">Entrar</a></div>
              </section>`}
          <section class="card" id="topic-summary"></section>
        </aside>
      </div>
    `
  );

  const inScope = (challenge, { ignoreSubtopic = false } = {}) =>
    (!state.language || challenge.languages.includes(state.language)) &&
    (!state.topic || challenge.topic === state.topic) &&
    (ignoreSubtopic || !state.subtopic || subtopicOf(challenge) === state.subtopic);

  function persist() {
    writeLocal(FILTER_KEY, JSON.stringify({ language: state.language, topic: state.topic }));
    const params = new URLSearchParams();
    if (state.language) params.set("linguagem", state.language);
    if (state.topic) params.set("assunto", state.topic);
    if (state.subtopic) params.set("subtema", state.subtopic);
    const next = `/desafios${params.size ? `?${params}` : ""}`;
    // Atualiza a URL (compartilhável) sem recarregar a tela.
    history.replaceState(null, "", `#${next}`);
  }

  function renderTabs() {
    const countFor = (topic) => catalog.challenges.filter((challenge) => (!state.language || challenge.languages.includes(state.language)) && (!topic || challenge.topic === topic)).length;
    paint(
      $("#topic-tabs", root),
      [["", "Todos os assuntos"], ...topics.map((topic) => [topic, topic])].map(
        ([value, label]) => html`<button role="tab" type="button" data-topic="${value}" aria-selected="${state.topic === value}">${label}<span class="tab-count">${countFor(value)}</span></button>`
      )
    );
    paint(
      $("#language-tabs", root),
      LANGUAGES.map(([value, label]) => html`<button class="chip" type="button" data-language="${value}" aria-pressed="${state.language === value}">${label}</button>`)
    );

    const subtopics = [...new Set(catalog.challenges.filter((challenge) => inScope(challenge, { ignoreSubtopic: true })).map(subtopicOf))];
    const showSubtopics = state.topic && subtopics.length > 1;
    paint(
      $("#subtopic-chips", root),
      showSubtopics
        ? html`<span class="muted small">Subtema</span>${[["", "Todos"], ...subtopics.map((name) => [name, name])].map(
            ([value, label]) => html`<button class="subtopic ${state.subtopic === value ? "is-active" : ""}" type="button" data-subtopic="${value}" aria-pressed="${state.subtopic === value}">${label}</button>`
          )}`
        : ""
    );

    const scoped = catalog.challenges.filter((challenge) => inScope(challenge, { ignoreSubtopic: true }));
    const bySubtopic = subtopics.map((name) => ({
      name,
      total: scoped.filter((challenge) => subtopicOf(challenge) === name).length,
      solved: scoped.filter((challenge) => subtopicOf(challenge) === name && isSolved(challenge.id)).length
    }));
    paint(
      $("#topic-summary", root),
      html`
        <h2>${state.topic || "Todos os assuntos"}</h2>
        <p class="muted small" style="margin: 4px 0 0">${scoped.length} ${scoped.length === 1 ? "desafio" : "desafios"}${state.language ? ` em ${LANGUAGES.find(([value]) => value === state.language)[1]}` : ""}</p>
        ${session.user
          ? bySubtopic.map((item) => meter(item.name, item.solved, item.total))
          : html`<dl class="kv" style="margin-top: 8px">${bySubtopic.map((item) => html`<div><dt>${item.name}</dt><dd>${item.total}</dd></div>`)}</dl>`}
      `
    );
  }

  function renderResults() {
    const term = state.search.trim().toLocaleLowerCase("pt-BR");
    const visible = catalog.challenges.filter((challenge) => {
      if (!inScope(challenge)) return false;
      if (state.difficulty && challenge.difficulty !== state.difficulty) return false;
      if (state.status === "solved" && !isSolved(challenge.id)) return false;
      if (state.status === "pending" && isSolved(challenge.id)) return false;
      if (!term) return true;
      return [challenge.title, challenge.description, challenge.topic, ...challenge.tags]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term);
    });

    paint(
      $("#catalog-results", root),
      visible.length === 0
        ? emptyState("Nenhum desafio corresponde aos filtros.")
        : html`
            <p class="list-count">${visible.length} ${visible.length === 1 ? "desafio" : "desafios"}</p>
            <ul class="challenge-list">
              ${visible.map((challenge) => {
                const solved = isSolved(challenge.id);
                return html`
                  <li class="challenge-item">
                    <span class="solved-mark ${solved ? "is-solved" : ""}" title="${solved ? "Resolvido" : "Não resolvido"}" aria-label="${solved ? "Resolvido" : "Não resolvido"}">${solved ? icon("check", 11) : ""}</span>
                    <div>
                      <h3><a href="#/desafios/${challenge.slug}">${challenge.title}</a></h3>
                      <p>${challengeSummary(challenge)}</p>
                      <div class="tags">${challenge.tags.map((tag) => html`<span class="pill tag">${tag}</span>`)}</div>
                    </div>
                    <div class="challenge-meta">
                      ${challenge.languages.map((language) => languagePill(language))}
                      ${difficultyPill(challenge.difficulty)}
                      <span class="pill pill-points">${challenge.points} pts</span>
                      <a class="btn btn-sm ${solved ? "" : "btn-primary"}" href="#/desafios/${challenge.slug}">${solved ? "Revisar" : "Resolver"}</a>
                    </div>
                  </li>
                `;
              })}
            </ul>
          `
    );
  }

  function update() {
    renderTabs();
    renderResults();
  }

  root.addEventListener("click", (event) => {
    const topic = event.target.closest("[data-topic]");
    const language = event.target.closest("[data-language]");
    const subtopic = event.target.closest("[data-subtopic]");
    if (topic) {
      state.topic = topic.dataset.topic;
      state.subtopic = "";
    } else if (language) {
      state.language = language.dataset.language;
      state.subtopic = "";
    } else if (subtopic) {
      state.subtopic = subtopic.dataset.subtopic;
    } else {
      return;
    }
    persist();
    update();
  });
  $("#catalog-search", root).addEventListener("input", (event) => {
    state.search = event.target.value;
    renderResults();
  });
  $("#catalog-difficulty", root).addEventListener("change", (event) => {
    state.difficulty = event.target.value;
    renderResults();
  });
  $("#catalog-status", root)?.addEventListener("change", (event) => {
    state.status = event.target.value;
    renderResults();
  });
  update();
}
