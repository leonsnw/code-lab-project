import { api } from "../api.js";
import { createCodeEditor } from "../components/code-editor.js";
import { toast } from "../components/toast.js";
import { caseDetail, compileErrorLine, compileWarningsBlock, renderVerdict } from "../components/verdict.js";
import {
  $,
  difficultyPill,
  emptyState,
  formatDateTime,
  formatNumber,
  formatRelative,
  html,
  initials,
  LANGUAGE_LABELS,
  readLocal,
  render as paint,
  statusPill,
  writeLocal
} from "../dom.js";
import { icon } from "../icons.js";
import { diffLines, diffSummary } from "../diff.js";
import { formatArguments, formatReturn, isFunctionMode, signatureFor } from "../io-format.js";
import { renderMarkdown } from "../markdown.js";
import { getSession, isSolved, refreshSession } from "../session.js";

const LANGUAGE_NAMES = {
  javascript: "JavaScript (Node.js)",
  python: "Python 3.12",
  c: "C (gcc 13, C11)"
};

const STDIO_STARTER = {
  javascript: `// Leia toda a entrada do stdin
const entrada = require("fs").readFileSync(0, "utf8").trim();

// Escreva sua solução e imprima a resposta com console.log
console.log(entrada);
`,
  python: `import sys

entrada = sys.stdin.read().split()

# Escreva sua solução e imprima a resposta com print
print(entrada)
`,
  c: `#include <stdio.h>
#include <stdlib.h>

int main(void) {
    // Leia a entrada com scanf e imprima somente a resposta com printf.

    return 0;
}
`
};

const STDIO_HINTS = {
  javascript: {
    text: html`A entrada chega pelo <code>stdin</code>; imprima somente a resposta. Mensagens com <code>console.error</code> aparecem no resultado sem afetar a correção.`,
    code: `const entrada = require("fs").readFileSync(0, "utf8").trim();
const numeros = entrada.split(/\\s+/).map(Number);
console.log(resposta);`
  },
  python: {
    text: html`Leia com <code>sys.stdin</code> ou <code>input()</code> e imprima só a resposta. Mensagens em <code>sys.stderr</code> não afetam a correção.`,
    code: `import sys
numeros = list(map(int, sys.stdin.read().split()))
print(resposta)`
  },
  c: {
    text: html`Leia com <code>scanf</code> e escreva só a resposta com <code>printf</code>, sem mensagens como "Digite um número". <code>conio.h</code>, <code>getch()</code> e <code>system("cls")</code> não existem aqui, e <code>gets</code> foi removida do C: use <code>scanf(" %49[^\\n]", texto)</code> para ler uma linha. Depuração com <code>fprintf(stderr, ...)</code> não afeta a correção. Compilação: <code>gcc -std=gnu11 -O2</code> com verificação de comportamento indefinido.`,
    code: `int n;
scanf("%d", &n);
printf("%d\\n", resposta);
return 0;`
  }
};

const FUNCTION_HINTS = {
  javascript: html`Implemente só a função e use <code>return</code>. Não leia a entrada nem imprima a resposta: o juiz chama a função com os argumentos de cada caso. <code>console.log</code> serve para depurar.`,
  python: html`Implemente só a função e use <code>return</code>. O juiz chama a função com os argumentos de cada caso; <code>print</code> serve para depurar.`,
  c: html`Implemente só a função, com a assinatura exata abaixo (sem <code>main</code>). Vetores chegam como ponteiro + tamanho; para devolver um vetor, aloque com <code>malloc</code> e preencha <code>*returnSize</code>.`
};

const draftKey = (slug, language) => `codelab:draft:${slug}:${language}`;
const SPLIT_KEY = "codelab:workspace-split";
const languageKey = (slug) => `codelab:language:${slug}`;

export async function render({ root, params, isCurrent }) {
  const slug = params.slug;
  const [detail, commentsData, ratingData] = await Promise.all([
    api.challenge(slug),
    api.comments(slug).catch(() => ({ comments: [] })),
    api.rating(slug).catch(() => ({ summary: { average: 0, total: 0, currentUserValue: null } }))
  ]);
  if (!isCurrent()) return;

  const challenge = detail.challenge;
  const functionMode = isFunctionMode(challenge);
  const options = challenge.languageOptions;
  const savedLanguage = readLocal(languageKey(slug));
  document.title = `${challenge.title} · CodeLab`;

  const state = {
    language: options.some((option) => option.language === savedLanguage) ? savedLanguage : options[0].language,
    leftTab: "description",
    consoleTab: "cases",
    selectedCase: 0,
    customInput: "",
    submissions: detail.submissions,
    comments: commentsData.comments,
    rating: ratingData.summary,
    help: challenge.help,
    result: null,
    resultCase: 0,
    busy: null,
    compare: [],
    commentPreview: false,
    runtime: null
  };
  const option = () => options.find((entry) => entry.language === state.language);
  const starterFor = (language) =>
    options.find((entry) => entry.language === language)?.starterCode ?? STDIO_STARTER[language];
  // Rascunhos antigos (antes das várias linguagens) ficavam sem sufixo.
  const legacyDraft = options.length === 1 ? readLocal(`codelab:draft:${slug}`) : null;
  const draftFor = (language) => readLocal(draftKey(slug, language)) ?? (language === options[0].language ? legacyDraft : null) ?? starterFor(language);
  const verdictContext = { functionSpec: functionMode ? challenge.functionSpec : null };

  const publicCases = challenge.publicTestCases;
  const hiddenCount = challenge.testCaseCount - publicCases.length;

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha">
        <a href="#/dashboard">Dashboard</a><span>›</span><a href="#/desafios">Desafios</a><span>›</span><span>${challenge.title}</span>
      </nav>
      <div class="workspace" id="workspace">
        <section class="panel panel-left" aria-label="Enunciado e atividades">
          <div class="panel-tabs" role="tablist" aria-label="Seções do desafio">
            <button role="tab" data-left-tab="description" aria-selected="true">Descrição</button>
            ${challenge.help.hasEditorial ? html`<button role="tab" data-left-tab="solution" aria-selected="false">Solução</button>` : ""}
            <button role="tab" data-left-tab="submissions" aria-selected="false">Submissões <span id="count-submissions"></span></button>
            <button role="tab" data-left-tab="discussion" aria-selected="false">Discussão <span id="count-comments"></span></button>
          </div>
          <div id="left-body" class="panel-body" role="tabpanel" tabindex="-1"></div>
        </section>

        <div class="splitter splitter-x" role="separator" aria-orientation="vertical" aria-label="Redimensionar enunciado e editor" tabindex="0" data-split="x" title="Arraste para redimensionar · duplo clique restaura"></div>

        <div class="right-column">
          <section class="panel editor-panel" aria-label="Editor de código">
            <div class="editor-toolbar">
              <label>
                <span class="sr-only">Linguagem</span>
                <select id="language" aria-label="Linguagem" ${options.length === 1 ? html`disabled title="Este desafio é resolvido em ${LANGUAGE_LABELS[state.language]}"` : ""}>
                  ${options.map((entry) => html`<option value="${entry.language}" ${entry.language === state.language ? html`selected` : ""}>${LANGUAGE_NAMES[entry.language]}</option>`)}
                </select>
              </label>
              <div class="btn-row" style="gap: 4px">
                <button id="search-code" class="btn btn-sm btn-ghost" type="button" title="Buscar no código (Ctrl+F)" aria-label="Buscar no código">${icon("search", 14)}</button>
                <button id="reset-code" class="btn btn-sm btn-ghost" type="button" title="Voltar ao código inicial" aria-label="Voltar ao código inicial">${icon("reset", 14)}<span class="btn-label"> Código inicial</span></button>
                <button id="fullscreen" class="btn btn-sm btn-ghost" type="button" title="Tela cheia" aria-label="Tela cheia" aria-pressed="false">${icon("maximize", 14)}</button>
              </div>
            </div>
            <div id="editor"></div>
            <div class="editor-status">
              <span id="cursor-status">Ln 1, Col 1</span>
              <span id="draft-status">Rascunho salvo neste navegador · Ctrl+/ comenta · Esc sai do editor</span>
            </div>
          </section>

          <div class="splitter splitter-y" role="separator" aria-orientation="horizontal" aria-label="Redimensionar editor e console" tabindex="0" data-split="y" title="Arraste para redimensionar · duplo clique restaura"></div>

          <section class="panel console-panel" aria-label="Console">
            <div class="panel-tabs" role="tablist" aria-label="Console">
              <button role="tab" data-console-tab="cases" aria-selected="true">Casos de teste</button>
              <button role="tab" data-console-tab="result" aria-selected="false">Resultado</button>
            </div>
            <div id="console-body" class="panel-body" role="tabpanel" tabindex="-1" aria-live="polite"></div>
            <div class="console-actions">
              <span class="kbd-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> executa · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd> envia</span>
              <div class="btn-row">
                <button id="run-button" class="btn btn-sm" type="button">${icon("play", 14)}<span>Executar</span></button>
                <button id="submit-button" class="btn btn-sm btn-success" type="button">${icon("upload", 14)}<span>Enviar</span></button>
              </div>
            </div>
          </section>
        </div>
      </div>
    `
  );

  const leftBody = $("#left-body", root);
  const consoleBody = $("#console-body", root);
  const runButton = $("#run-button", root);
  const submitButton = $("#submit-button", root);

  // Re-renderizar um painel remove o elemento focado; o foco volta para o
  // próprio painel em vez de cair no body. Foco no editor não é afetado.
  const paintKeepingFocus = (panel, content) => {
    const hadFocus = panel.contains(document.activeElement);
    paint(panel, content);
    if (hadFocus) panel.focus({ preventScroll: true });
  };

  const editor = createCodeEditor($("#editor", root), {
    label: `Código da solução em ${LANGUAGE_LABELS[state.language]}`,
    language: state.language,
    value: draftFor(state.language),
    onChange: (code) => writeLocal(draftKey(slug, state.language), code),
    onRun: () => runCode(),
    onSubmit: () => submitCode()
  });
  editor.onCursor(({ line, column }) => {
    $("#cursor-status", root).textContent = `Ln ${line}, Col ${column}`;
  });

  // ---------- Painel esquerdo ----------
  function renderHelp() {
    const { hints, hintsTotal } = state.help;
    if (!hintsTotal) return "";
    return html`
      <h2>Dicas <span class="muted small">(${hints.length}/${hintsTotal})</span></h2>
      ${hints.length ? html`<ol class="hint-list">${hints.map((hint) => html`<li>${hint}</li>`)}</ol>` : ""}
      ${hints.length < hintsTotal
        ? html`<button id="reveal-hint" class="btn btn-sm" type="button">${hints.length ? "Mostrar próxima dica" : "Mostrar a primeira dica"}</button>
            <p class="muted small" style="margin: 6px 0 0">Dicas não tiram pontos.</p>`
        : ""}
    `;
  }

  function renderDescription() {
    const solved = isSolved(challenge.id);
    const current = option();
    return html`
      <article class="problem">
        <h1>${challenge.title}</h1>
        <div class="problem-meta">
          ${difficultyPill(challenge.difficulty)}
          <span class="pill pill-points">${challenge.points} pts</span>
          <span class="pill ${solved ? "status-accepted" : "status-pending"}">${solved ? "Resolvido" : "Não resolvido"}</span>
          ${challenge.isBoss ? html`<span class="pill status-timeout">Desafio final do módulo</span>` : ""}
          <span class="pill tag">${challenge.topic}${challenge.subtopic ? ` · ${challenge.subtopic}` : ""}</span>
          <span class="pill tag" title="Os casos ocultos só aparecem quando sua solução falha em um deles">${challenge.testCaseCount} casos · ${hiddenCount} ocultos</span>
        </div>
        <div class="problem-text markdown">${renderMarkdown(challenge.description)}</div>

        ${functionMode
          ? html`<h2>Assinatura</h2><pre class="code-view signature">${signatureFor(challenge.functionSpec, state.language, current.signature)}</pre>`
          : ""}

        ${challenge.examples.map(
          (example, index) => html`
            <div class="example">
              <strong>Exemplo ${index + 1}</strong>
              <div class="io-block"><span>${functionMode ? "Argumentos" : "Entrada"}</span><pre class="io">${functionMode ? formatArguments(example.input, challenge.functionSpec) : example.input}</pre></div>
              <div class="io-block" style="margin: 0"><span>${functionMode ? "Retorno" : "Saída"}</span><pre class="io">${functionMode ? formatReturn(example.output) : example.output}</pre></div>
            </div>
          `
        )}

        ${challenge.constraints.length
          ? html`<h2>Restrições</h2><ul>${challenge.constraints.map((item) => html`<li>${item}</li>`)}</ul>`
          : ""}

        ${challenge.complexity
          ? html`<h2>Complexidade esperada</h2>
              <p class="muted small" style="margin: 0">Tempo <code>${challenge.complexity.time}</code> · espaço <code>${challenge.complexity.space}</code>. Os casos grandes são dimensionados para reprovar soluções mais lentas.</p>`
          : ""}

        <h2>Limites de execução em ${LANGUAGE_LABELS[state.language]}</h2>
        <ul>
          <li>Tempo: <strong>${formatNumber(current.limits.timeoutMs)} ms</strong> por caso de teste</li>
          <li>Memória: <strong>${current.limits.memoryLimitMb} MB</strong></li>
          <li>Saída: até <strong>${Math.round(current.limits.maxOutputBytes / 1024)} KB</strong></li>
        </ul>

        ${current.rules.length
          ? html`<h2>Regras deste desafio</h2>
              <p class="muted small" style="margin: 0 0 8px">Verificadas no código antes dos testes; comentários não contam.</p>
              <ul class="rules-list">${current.rules.map((rule) => html`<li>${rule}</li>`)}</ul>`
          : ""}

        ${renderHelp()}

        ${state.help.followUps.length
          ? html`<h2>Perguntas de acompanhamento</h2>
              <p class="muted small" style="margin: 0 0 6px">O que um entrevistador perguntaria depois:</p>
              <ul>${state.help.followUps.map((question) => html`<li>${question}</li>`)}</ul>`
          : ""}

        <div class="hint-box">
          <strong>Como responder em ${LANGUAGE_LABELS[state.language]}</strong>
          <p style="margin: 6px 0 0">${functionMode ? FUNCTION_HINTS[state.language] : STDIO_HINTS[state.language].text}</p>
          ${functionMode ? "" : html`<pre>${STDIO_HINTS[state.language].code}</pre>`}
        </div>

        <h2>Avalie este desafio</h2>
        <div id="rating"></div>
      </article>
    `;
  }

  function renderSolution() {
    const help = state.help;
    if (help.editorial) {
      return html`
        <article class="problem">
          <h1>Solução comentada</h1>
          ${help.solutionRevealed && !isSolved(challenge.id)
            ? html`<div class="alert alert-warning">Você revelou a solução: ainda pode resolver o desafio, mas ele não vale pontos.</div>`
            : ""}
          ${renderMarkdown(help.editorial)}
        </article>
      `;
    }
    return html`
      <article class="problem">
        <h1>Solução comentada</h1>
        ${help.canRevealSolution
          ? html`
              <p class="muted">Você já tentou algumas vezes. A solução explica a ideia, a complexidade e um código de referência.</p>
              <div class="alert alert-warning">Revelar antes de resolver <strong>zera os pontos</strong> deste desafio. Tente antes as dicas na aba Descrição.</div>
              <button id="reveal-solution" class="btn btn-danger" type="button">Revelar a solução (sem pontos)</button>
            `
          : html`<p class="muted">A solução fica disponível quando você resolver o desafio ou depois de ${help.attemptsBeforeSolution} ${help.attemptsBeforeSolution === 1 ? "tentativa" : "tentativas"} a mais.</p>`}
      </article>
    `;
  }

  function renderRating() {
    const target = $("#rating", root);
    if (!target) return;
    const { average, total, currentUserValue } = state.rating;
    paint(
      target,
      html`
        <div class="stars" role="group" aria-label="Sua nota">
          ${[1, 2, 3, 4, 5].map(
            (value) => html`<button type="button" data-rate="${value}" class="${currentUserValue && value <= currentUserValue ? "is-on" : ""}" aria-label="${value} ${value === 1 ? "estrela" : "estrelas"}" aria-pressed="${currentUserValue === value}">★</button>`
          )}
        </div>
        <p class="muted small" style="margin: 4px 0 0">
          ${total > 0 ? `${average.toFixed(1).replace(".", ",")}/5 · ${total} ${total === 1 ? "avaliação" : "avaliações"}` : "Nenhuma avaliação ainda."}
          ${currentUserValue ? ` · sua nota: ${currentUserValue}` : ""}
        </p>
      `
    );
    target.querySelectorAll("[data-rate]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const response = await api.rate(slug, Number(button.dataset.rate));
          state.rating = response.summary;
          renderRating();
          toast("Avaliação registrada.", "success");
        } catch (error) {
          toast(error.message, "error");
        }
      });
    });
  }

  function renderTimeline() {
    const ordered = [...state.submissions].reverse();
    return html`
      <div class="timeline" aria-label="Linha do tempo das submissões">
        ${ordered.map(
          (submission, index) => html`<span class="timeline-dot status-dot-${submission.status}" title="#${index + 1} · ${formatDateTime(submission.submittedAt)} · ${submission.status}"></span>`
        )}
      </div>
    `;
  }

  function renderComparison() {
    const [first, second] = state.compare.map((index) => state.submissions[index]).sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));
    const rows = diffLines(first.sourceCode, second.sourceCode);
    const { added, removed } = diffSummary(rows);
    return html`
      <div class="diff-head">
        <strong>Comparando duas submissões</strong>
        <span class="muted small">${formatRelative(first.submittedAt)} → ${formatRelative(second.submittedAt)} · <span class="diff-added-count">+${added}</span> <span class="diff-removed-count">−${removed}</span></span>
        <button id="clear-compare" class="btn btn-sm btn-ghost" type="button">Fechar comparação</button>
      </div>
      <div class="diff-legend small">
        <span>${statusPill(first.status)} ${LANGUAGE_LABELS[first.language]}</span>
        <span>→</span>
        <span>${statusPill(second.status)} ${LANGUAGE_LABELS[second.language]}</span>
      </div>
      <pre class="code-view diff-view">${rows.map(
        (row) => html`<span class="diff-line diff-${row.type}"><span class="diff-num">${row.left ?? ""}</span><span class="diff-num">${row.right ?? ""}</span><span class="diff-sign">${row.type === "added" ? "+" : row.type === "removed" ? "−" : " "}</span>${row.text || " "}</span>`
      )}</pre>
    `;
  }

  function renderSubmissions() {
    if (state.submissions.length === 0) {
      return emptyState("Nenhuma submissão ainda. Execute nos exemplos e envie quando estiver confiante.");
    }
    return html`
      <div>
        ${renderTimeline()}
        ${state.compare.length === 2
          ? renderComparison()
          : html`<p class="muted small" style="margin: 0 0 8px">Marque duas submissões para comparar o código lado a lado.</p>`}
        ${state.submissions.map(
          (submission, index) => html`
            <div class="submission-row-wrap">
              <label class="compare-check" title="Comparar">
                <input type="checkbox" data-compare="${index}" ${state.compare.includes(index) ? html`checked` : ""} aria-label="Comparar a submissão de ${formatDateTime(submission.submittedAt)}" />
              </label>
              <button class="submission-row" type="button" data-submission="${index}">
                <span>
                  ${statusPill(submission.status)}
                  <span class="pill tag">${LANGUAGE_LABELS[submission.language] ?? submission.language}</span>
                  <span class="when" title="${formatDateTime(submission.submittedAt)}"> ${formatRelative(submission.submittedAt)}</span>
                </span>
                <span class="muted small">${submission.result.passedTests}/${submission.result.totalTests} casos${submission.result.runtimeMs !== null ? ` · ${submission.result.runtimeMs} ms` : ""}</span>
              </button>
            </div>
          `
        )}
      </div>
    `;
  }

  function renderDiscussion() {
    return html`
      <form id="comment-form">
        <div class="field">
          <div class="comment-form-head">
            <label for="comment-content">Comentar</label>
            <button id="toggle-preview" class="btn btn-sm btn-ghost" type="button" aria-pressed="${state.commentPreview}">${state.commentPreview ? "Editar" : "Pré-visualizar"}</button>
          </div>
          <textarea id="comment-content" name="content" maxlength="4000" rows="4" placeholder="Compartilhe uma dúvida ou dica. Esconda trechos que revelam a solução com ||spoiler||." required ${state.commentPreview ? html`hidden` : ""}>${state.commentDraft ?? ""}</textarea>
          ${state.commentPreview
            ? html`<div class="comment-preview markdown">${(state.commentDraft ?? "").trim() ? renderMarkdown(state.commentDraft) : html`<p class="muted">Nada para pré-visualizar.</p>`}</div>`
            : ""}
          <small><span id="comment-count">${(state.commentDraft ?? "").length}</span>/4000 · Markdown: <code>\`código\`</code>, blocos com <code>\`\`\`c</code>, <code>**negrito**</code> e <code>||spoiler||</code></small>
        </div>
        <button class="btn btn-primary btn-sm" type="submit">Publicar comentário</button>
      </form>
      <div style="margin-top: 12px">
        ${state.comments.length === 0
          ? emptyState("Nenhum comentário ainda. Comece a discussão!")
          : state.comments.map(
              (comment) => html`
                <article class="comment">
                  <a class="avatar" href="#/u/${comment.author.id}" title="Ver o perfil de ${comment.author.name}">${initials(comment.author.name)}</a>
                  <div>
                    <header>
                      <a href="#/u/${comment.author.id}"><strong>${comment.author.name}</strong></a>
                      <time datetime="${comment.createdAt}" title="${formatDateTime(comment.createdAt)}">${formatRelative(comment.createdAt)}</time>
                    </header>
                    <div class="markdown comment-body">${renderMarkdown(comment.content)}</div>
                  </div>
                </article>
              `
            )}
      </div>
    `;
  }

  function renderLeft() {
    root.querySelectorAll("[data-left-tab]").forEach((tab) =>
      tab.setAttribute("aria-selected", String(tab.dataset.leftTab === state.leftTab))
    );
    $("#count-submissions", root).textContent = state.submissions.length ? `(${state.submissions.length})` : "";
    $("#count-comments", root).textContent = state.comments.length ? `(${state.comments.length})` : "";

    if (state.leftTab === "description") {
      paintKeepingFocus(leftBody, renderDescription());
      renderRating();
      $("#reveal-hint", root)?.addEventListener("click", revealHint);
    } else if (state.leftTab === "solution") {
      paintKeepingFocus(leftBody, renderSolution());
      $("#reveal-solution", root)?.addEventListener("click", revealSolution);
    } else if (state.leftTab === "submissions") {
      paintKeepingFocus(leftBody, renderSubmissions());
      leftBody.querySelectorAll("[data-submission]").forEach((row) => {
        row.addEventListener("click", () => {
          const submission = state.submissions[Number(row.dataset.submission)];
          showResult({ type: "submission", submission });
        });
      });
      leftBody.querySelectorAll("[data-compare]").forEach((box) => {
        box.addEventListener("change", () => {
          const index = Number(box.dataset.compare);
          state.compare = box.checked ? [...state.compare.filter((item) => item !== index), index].slice(-2) : state.compare.filter((item) => item !== index);
          renderLeft();
        });
      });
      $("#clear-compare", root)?.addEventListener("click", () => {
        state.compare = [];
        renderLeft();
      });
    } else {
      paintKeepingFocus(leftBody, renderDiscussion());
      bindCommentForm();
    }
  }

  async function revealHint() {
    try {
      const { help } = await api.revealHint(slug);
      state.help = help;
      renderLeft();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function revealSolution() {
    if (!window.confirm("Revelar a solução agora zera os pontos deste desafio. Continuar?")) return;
    try {
      const { help } = await api.revealSolution(slug);
      state.help = help;
      renderLeft();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function refreshHelp() {
    try {
      const fresh = await api.challenge(slug);
      state.help = fresh.challenge.help;
    } catch {
      // Mantém o estado atual se a atualização falhar.
    }
  }

  function bindCommentForm() {
    const form = $("#comment-form", root);
    const textarea = $("#comment-content", root);
    textarea.addEventListener("input", () => {
      state.commentDraft = textarea.value;
      $("#comment-count", root).textContent = String(textarea.value.length);
    });
    $("#toggle-preview", root).addEventListener("click", () => {
      state.commentPreview = !state.commentPreview;
      renderLeft();
      if (!state.commentPreview) $("#comment-content", root)?.focus();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = (state.commentDraft ?? "").trim();
      if (!content) {
        toast("Escreva o comentário antes de publicar.", "error");
        return;
      }
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const { comment } = await api.addComment(slug, content);
        state.comments = [comment, ...state.comments];
        state.commentDraft = "";
        state.commentPreview = false;
        renderLeft();
        toast("Comentário publicado.", "success");
      } catch (error) {
        toast(error.message, "error");
        button.disabled = false;
      }
    });
  }

  // Spoilers: clique ou Enter revela o trecho escondido.
  leftBody.addEventListener("click", (event) => event.target.closest(".spoiler")?.classList.add("is-revealed"));
  leftBody.addEventListener("keydown", (event) => {
    const spoiler = event.target.closest?.(".spoiler");
    if (spoiler && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      spoiler.classList.add("is-revealed");
    }
  });

  // ---------- Console ----------
  function renderCases() {
    const tabs = [...publicCases.map((_, index) => ({ label: `Caso ${index + 1}` })), { label: "Entrada personalizada" }];
    const isCustom = state.selectedCase === publicCases.length;
    const selected = publicCases[state.selectedCase];
    const example = functionMode ? publicCases[0]?.input ?? "[]" : "";
    return html`
      <div class="case-tabs" role="tablist" aria-label="Casos de exemplo">
        ${tabs.map(
          (tab, index) => html`<button class="case-tab" role="tab" type="button" data-case="${index}" aria-selected="${index === state.selectedCase}">${tab.label}</button>`
        )}
      </div>
      ${isCustom
        ? html`
            <div class="field">
              <label for="custom-input">${functionMode ? "Argumentos em JSON (lista na ordem da assinatura)" : "Entrada personalizada (stdin)"}</label>
              <textarea id="custom-input" class="mono" rows="4" placeholder="${functionMode ? `Ex.: ${example}` : "Digite uma entrada para testar seu código"}">${state.customInput}</textarea>
              <small>Roda junto com os exemplos ao clicar em Executar. Sem resposta esperada: confira você mesmo.</small>
            </div>
          `
        : html`
            <div class="io-block"><span>${functionMode ? "Argumentos" : "Entrada (stdin)"}</span><pre class="io">${functionMode ? formatArguments(selected.input, challenge.functionSpec) : selected.input}</pre></div>
            <div class="io-block"><span>${functionMode ? "Retorno esperado" : "Saída esperada"}</span><pre class="io">${functionMode ? formatReturn(selected.expectedOutput) : selected.expectedOutput}</pre></div>
          `}
    `;
  }

  function renderRun(run) {
    if (run.compileError) {
      return html`
        <div class="verdict-head"><h3 class="verdict-title compile_error">Erro de compilação</h3></div>
        <p class="verdict-message">O código não pôde ser ${state.language === "c" ? "compilado" : "interpretado"}. Corrija a linha indicada.</p>
        <pre class="io is-error">${run.compileError}</pre>
      `;
    }
    const rulesWarning = run.ruleViolations?.length
      ? html`<div class="alert alert-warning"><strong>Ao enviar, este código será recusado:</strong><ul>${run.ruleViolations.map((rule) => html`<li>${rule}</li>`)}</ul></div>`
      : "";
    const judged = run.cases.filter((runCase) => runCase.passed !== null);
    const passed = judged.filter((runCase) => runCase.passed).length;
    const allPassed = passed === judged.length;
    const current = run.cases[Math.min(state.resultCase, run.cases.length - 1)];
    return html`
      ${rulesWarning}
      <div class="verdict-head">
        <h3 class="verdict-title ${allPassed ? "accepted" : "wrong_answer"}">${allPassed ? "Exemplos aprovados" : "Exemplo com falha"}</h3>
        <span class="verdict-count">${passed} / ${judged.length} exemplos</span>
      </div>
      <p class="verdict-message muted small">
        ${allPassed
          ? "Executar usa apenas os exemplos. Clique em Enviar para rodar os casos ocultos e pontuar."
          : "Nada foi registrado ainda: execuções não contam como tentativa."}
      </p>
      <div class="case-tabs" role="tablist" aria-label="Resultados por caso">
        ${run.cases.map(
          (runCase, index) => html`
            <button class="case-tab" role="tab" type="button" data-result-case="${index}" aria-selected="${runCase === current}">
              <span class="dot ${runCase.passed === true ? "ok" : runCase.passed === false || runCase.executionStatus !== "completed" ? "fail" : ""}"></span>
              ${runCase.label}
            </button>
          `
        )}
      </div>
      <p class="muted small" style="margin: 0 0 8px">${current.executionStatus === "timeout" ? "Tempo limite excedido" : current.executionStatus === "runtime_error" ? "Erro de execução" : `Executado em ${current.durationMs} ms`}</p>
      ${caseDetail(current, verdictContext)}
      ${!allPassed ? compileWarningsBlock(run.compileWarnings) : ""}
    `;
  }

  function renderConsole() {
    root.querySelectorAll("[data-console-tab]").forEach((tab) =>
      tab.setAttribute("aria-selected", String(tab.dataset.consoleTab === state.consoleTab))
    );

    if (state.consoleTab === "cases") {
      paintKeepingFocus(consoleBody, renderCases());
      consoleBody.querySelectorAll("[data-case]").forEach((tab) => {
        tab.addEventListener("click", () => {
          state.selectedCase = Number(tab.dataset.case);
          renderConsole();
        });
      });
      $("#custom-input", root)?.addEventListener("input", (event) => {
        state.customInput = event.target.value;
      });
      return;
    }

    if (state.busy) {
      paintKeepingFocus(consoleBody, html`<div class="loading-block">${state.busy === "run" ? "Executando nos exemplos..." : "Avaliando todos os casos de teste..."}</div>`);
      return;
    }
    if (!state.result) {
      paintKeepingFocus(consoleBody, emptyState("Execute ou envie o código para ver o resultado aqui."));
      return;
    }
    if (state.result.type === "run") {
      paintKeepingFocus(consoleBody, renderRun(state.result.run));
      consoleBody.querySelectorAll("[data-result-case]").forEach((tab) => {
        tab.addEventListener("click", () => {
          state.resultCase = Number(tab.dataset.resultCase);
          renderConsole();
        });
      });
      return;
    }

    const { submission } = state.result;
    paintKeepingFocus(
      consoleBody,
      html`
        ${renderVerdict(submission, verdictContext)}
        ${submission.status === "accepted" ? html`<div id="runtime-box">${renderRuntime(submission)}</div>` : ""}
        <p class="muted small" style="margin-top: 12px">
          Enviado ${formatRelative(submission.submittedAt)} em ${LANGUAGE_LABELS[submission.language] ?? submission.language} ·
          <button class="btn btn-sm btn-ghost" type="button" id="load-submission-code">Carregar este código no editor</button>
        </p>
      `
    );
    $("#load-submission-code", root).addEventListener("click", () => {
      if (submission.language !== state.language) switchLanguage(submission.language);
      if (editor.getValue() !== submission.sourceCode && !window.confirm("Substituir o código atual do editor pelo desta submissão?")) return;
      editor.setValue(submission.sourceCode);
      toast("Código carregado no editor.");
    });
  }

  function renderRuntime(submission) {
    const stats = state.runtime;
    if (!stats || stats.submissionId !== submission.id) return html`<p class="muted small">Comparando o tempo com as outras soluções aceitas…</p>`;
    if (stats.error) return "";
    const data = stats.data;
    if (data.solutions < 2 || data.beatsPercent === null) {
      return html`<p class="muted small">Você está entre as primeiras soluções aceitas em ${LANGUAGE_LABELS[data.language]}: ainda não há com o que comparar o tempo.</p>`;
    }
    const peak = Math.max(...data.buckets.map((bucket) => bucket.count), 1);
    return html`
      <div class="runtime-card">
        <p style="margin: 0 0 8px"><strong>${data.runtimeMs} ms</strong> · mais rápido que <strong>${data.beatsPercent}%</strong> das ${data.solutions} soluções aceitas em ${LANGUAGE_LABELS[data.language]}.</p>
        <div class="runtime-histogram" role="img" aria-label="Distribuição dos tempos das soluções aceitas">
          ${data.buckets.map(
            (bucket) => html`<span class="${data.runtimeMs >= bucket.fromMs && data.runtimeMs <= bucket.toMs ? "is-mine" : ""}" style="height: ${Math.max(6, Math.round((bucket.count / peak) * 100))}%" title="${bucket.fromMs}–${bucket.toMs} ms: ${bucket.count}"></span>`
          )}
        </div>
        <p class="muted small" style="margin: 6px 0 0">Tempo do caso mais lento, medido no juiz (inclui a inicialização do ambiente); varia um pouco entre execuções.</p>
      </div>
    `;
  }

  async function loadRuntime(submission) {
    if (submission.status !== "accepted" || submission.result.runtimeMs === null) return;
    if (state.runtime?.submissionId === submission.id) return;
    try {
      const { runtime } = await api.runtime(slug, submission.language, submission.result.runtimeMs);
      state.runtime = { submissionId: submission.id, data: runtime };
    } catch {
      state.runtime = { submissionId: submission.id, error: true };
    }
    const box = $("#runtime-box", root);
    if (box && state.result?.submission?.id === submission.id) paint(box, renderRuntime(submission));
  }

  function showResult(result) {
    state.result = result;
    if (result.type === "submission") loadRuntime(result.submission);
    state.resultCase = 0;
    state.consoleTab = "result";
    renderConsole();
    const message = result.type === "run" ? result.run.compileError : result.submission.result.compileError;
    const line = compileErrorLine(message);
    if (line) editor.markErrorLine(line);
  }

  function setBusy(kind) {
    state.busy = kind;
    // aria-disabled em vez de disabled: o botão mantém o foco durante a
    // avaliação (um botão desabilitado joga o foco para o body). O guarda
    // `state.busy` já impede envios duplicados.
    for (const button of [runButton, submitButton]) {
      button.setAttribute("aria-disabled", String(Boolean(kind)));
    }
    runButton.querySelector("span").textContent = kind === "run" ? "Executando…" : "Executar";
    submitButton.querySelector("span").textContent = kind === "submit" ? "Avaliando…" : "Enviar";
    if (kind) {
      state.consoleTab = "result";
      renderConsole();
    }
  }

  function switchLanguage(language) {
    if (!options.some((entry) => entry.language === language) || language === state.language) return;
    writeLocal(draftKey(slug, state.language), editor.getValue());
    state.language = language;
    writeLocal(languageKey(slug), language);
    $("#language", root).value = language;
    editor.setLanguage(language);
    editor.setValue(draftFor(language));
    if (state.leftTab === "description") renderLeft();
  }

  function readCode() {
    const code = editor.getValue();
    if (!code.trim()) {
      toast("Escreva o código da solução antes de executar ou enviar.", "error");
      editor.focus();
      return null;
    }
    return code;
  }

  async function runCode() {
    if (state.busy) return;
    const code = readCode();
    if (code === null) return;
    setBusy("run");
    try {
      const { run } = await api.run(slug, state.language, code, state.customInput.trim() ? state.customInput : undefined);
      setBusy(null);
      showResult({ type: "run", run });
    } catch (error) {
      setBusy(null);
      renderConsole();
      toast(error.message, "error");
    }
  }

  async function submitCode() {
    if (state.busy) return;
    const code = readCode();
    if (code === null) return;
    setBusy("submit");
    try {
      const { submission } = await api.submit(slug, state.language, code);
      state.submissions = [submission, ...state.submissions];
      setBusy(null);
      showResult({ type: "submission", submission });
      await refreshHelp();
      renderLeft();
      if (submission.status === "accepted") {
        toast(submission.scoreAwarded > 0 ? `Aceito! +${submission.scoreAwarded} pontos.` : "Aceito!", "success");
        await refreshSession();
        if (state.leftTab === "description") renderLeft();
      }
    } catch (error) {
      setBusy(null);
      renderConsole();
      toast(error.message, "error");
    }
  }

  // ---------- Eventos ----------
  root.querySelectorAll("[data-left-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.leftTab = tab.dataset.leftTab;
      renderLeft();
    });
  });
  root.querySelectorAll("[data-console-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.consoleTab = tab.dataset.consoleTab;
      renderConsole();
    });
  });
  $("#language", root).addEventListener("change", (event) => switchLanguage(event.target.value));
  runButton.addEventListener("click", runCode);
  submitButton.addEventListener("click", submitCode);
  $("#search-code", root).addEventListener("click", () => editor.openSearch());
  const workspace = $("#workspace", root);
  const fullscreenButton = $("#fullscreen", root);
  const syncFullscreen = () => {
    const active = document.fullscreenElement === workspace || workspace.classList.contains("is-fullscreen");
    fullscreenButton.setAttribute("aria-pressed", String(active));
    fullscreenButton.title = active ? "Sair da tela cheia (Esc)" : "Tela cheia";
    paint(fullscreenButton, icon(active ? "minimize" : "maximize", 14));
  };
  fullscreenButton.addEventListener("click", async () => {
    if (document.fullscreenElement === workspace) {
      await document.exitFullscreen();
    } else if (workspace.classList.contains("is-fullscreen")) {
      workspace.classList.remove("is-fullscreen");
    } else if (workspace.requestFullscreen) {
      await workspace.requestFullscreen().catch(() => workspace.classList.add("is-fullscreen"));
    } else {
      workspace.classList.add("is-fullscreen");
    }
    syncFullscreen();
  });
  document.addEventListener("fullscreenchange", syncFullscreen);
  const onEscape = (event) => {
    if (event.key === "Escape" && workspace.classList.contains("is-fullscreen")) {
      workspace.classList.remove("is-fullscreen");
      syncFullscreen();
    }
  };
  document.addEventListener("keydown", onEscape);

  // Painéis redimensionáveis: tamanho salvo neste navegador.
  const split = { x: 44, y: 34 };
  try {
    Object.assign(split, JSON.parse(readLocal(SPLIT_KEY) ?? "{}"));
  } catch {
    // Preferência corrompida: usa o padrão.
  }
  const applySplit = () => {
    workspace.style.setProperty("--split-x", `${split.x}%`);
    workspace.style.setProperty("--split-y", `${split.y}%`);
    root.querySelectorAll("[data-split]").forEach((handle) => handle.setAttribute("aria-valuenow", String(Math.round(split[handle.dataset.split]))));
  };
  const saveSplit = () => writeLocal(SPLIT_KEY, JSON.stringify(split));
  const clampSplit = () => {
    split.x = Math.min(70, Math.max(22, split.x));
    split.y = Math.min(70, Math.max(14, split.y));
  };
  applySplit();
  root.querySelectorAll("[data-split]").forEach((handle) => {
    const axis = handle.dataset.split;
    handle.setAttribute("aria-valuemin", axis === "x" ? "22" : "14");
    handle.setAttribute("aria-valuemax", "70");
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      document.body.classList.add("is-resizing", `is-resizing-${axis}`);
      const area = axis === "x" ? workspace.getBoundingClientRect() : handle.parentElement.getBoundingClientRect();
      const move = (moveEvent) => {
        if (axis === "x") split.x = ((moveEvent.clientX - area.left) / area.width) * 100;
        else split.y = ((area.bottom - moveEvent.clientY) / area.height) * 100;
        clampSplit();
        applySplit();
      };
      const stop = () => {
        handle.removeEventListener("pointermove", move);
        document.body.classList.remove("is-resizing", `is-resizing-${axis}`);
        saveSplit();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", stop, { once: true });
      handle.addEventListener("pointercancel", stop, { once: true });
    });
    handle.addEventListener("keydown", (event) => {
      const grow = axis === "x" ? { ArrowRight: 2, ArrowLeft: -2 } : { ArrowUp: 2, ArrowDown: -2 };
      if (!(event.key in grow)) return;
      event.preventDefault();
      split[axis] += grow[event.key];
      clampSplit();
      applySplit();
      saveSplit();
    });
    handle.addEventListener("dblclick", () => {
      split[axis] = axis === "x" ? 44 : 34;
      applySplit();
      saveSplit();
    });
  });

  $("#reset-code", root).addEventListener("click", () => {
    if (!window.confirm("Descartar o código atual e voltar ao modelo inicial?")) return;
    editor.setValue(starterFor(state.language));
  });

  renderLeft();
  renderConsole();
  if (getSession().user && state.submissions[0]) {
    // Mostra o último veredito ao reabrir o desafio.
    state.result = { type: "submission", submission: state.submissions[0] };
  }

  return () => {
    editor.destroy();
    document.removeEventListener("fullscreenchange", syncFullscreen);
    document.removeEventListener("keydown", onEscape);
    if (document.fullscreenElement === workspace) document.exitFullscreen().catch(() => undefined);
  };
}
