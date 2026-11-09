import { api } from "../api.js";
import { loadCatalog } from "../catalog.js";
import { badgeList, heatmap, streakStat } from "../components/activity.js";
import { renderVerdict } from "../components/verdict.js";
import { mountAccountSettings } from "../components/account-settings.js";
import {
  $,
  DIFFICULTY_LABELS,
  emptyState,
  formatDateTime,
  formatNumber,
  html,
  initials,
  meter,
  raw,
  render as paint,
  STATUS_LABELS,
  statusPill
} from "../dom.js";
import { refreshSession } from "../session.js";
import { highlight } from "../highlight.js";

export async function render({ root, query }) {
  const [session, catalog, activityData] = await Promise.all([refreshSession(), loadCatalog(), api.activity().catch(() => null)]);
  const activity = activityData?.activity ?? null;
  const { user, score, progress } = session;
  let status = query.get("status") ?? "";

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha"><a href="#/dashboard">Dashboard</a><span>›</span><span>Perfil</span></nav>
      <div class="grid-main">
        <div class="stack">
          <section class="card">
            <div class="card-head">
              <div class="tw:flex tw:gap-3.5 tw:items-center">
                <span class="avatar avatar-lg">${initials(user.name)}</span>
                <div>
                  <h1 class="tw:text-[20px]">${user.name}</h1>
                  <p class="muted tw:m-0">${user.email}</p>
                </div>
              </div>
            </div>
            <div class="stat-grid tw:m-0">
              <div class="stat"><span>Pontos</span><strong>${formatNumber(score.totalPoints)}</strong></div>
              <div class="stat"><span>Resolvidos</span><strong>${progress.solvedChallenges}</strong></div>
              <div class="stat"><span>Pendentes</span><strong>${progress.pendingChallenges}</strong></div>
              ${activity ? streakStat(activity) : html`<div class="stat"><span>Catálogo</span><strong>${progress.totalChallenges}</strong></div>`}
            </div>
            <p class="muted small tw:mx-0 tw:mt-3 tw:mb-0">Seu <a href="#/u/${user.id}">perfil público</a> mostra só o nome e as estatísticas de prática, nunca o e-mail.</p>
          </section>

          ${activity ? html`<section class="card"><h2>Atividade</h2>${heatmap(activity.days)}</section>` : ""}

          <section class="card">
            <div class="card-head">
              <div>
                <h2>Minhas submissões</h2>
                <p>Abra uma linha para ver o veredito completo e o código enviado.</p>
              </div>
              <label>
                <span class="sr-only">Filtrar por veredito</span>
                <select id="history-filter" class="input">
                  <option value="">Todos os vereditos</option>
                  ${Object.entries(STATUS_LABELS)
                    .filter(([value]) => value !== "pending")
                    .map(([value, label]) => html`<option value="${value}" ${value === status ? html`selected` : ""}>${label}</option>`)}
                </select>
              </label>
            </div>
            <div id="history" aria-live="polite"></div>
          </section>
        </div>

        <aside class="stack">
          <div id="account-settings" class="stack"><div class="skeleton skeleton-block"></div></div>
          <section class="card">
            <h2>Por dificuldade</h2>
            ${progress.byDifficulty.map((item) => meter(DIFFICULTY_LABELS[item.difficulty], item.solved, item.total))}
          </section>
          ${activity ? html`<section class="card"><h2>Conquistas</h2>${badgeList(activity.badges)}</section>` : ""}
          <section class="card">
            <h2>Desafios concluídos</h2>
            ${score.solvedChallengeIds.length === 0
              ? html`<p class="muted">Nenhum ainda. <a href="#/desafios">Escolha um desafio</a>.</p>`
              : html`<ul class="tw:mx-0 tw:mt-2.5 tw:mb-0 tw:pl-4.5">
                  ${score.solvedChallengeIds.map((id) => {
                    const challenge = catalog.byId.get(id);
                    return challenge ? html`<li><a href="#/desafios/${challenge.slug}">${challenge.title}</a></li>` : "";
                  })}
                </ul>`}
          </section>
        </aside>
      </div>
    `
  );

  mountAccountSettings($("#account-settings", root), user).catch((error) => paint($("#account-settings", root), html`<div class="alert alert-error">${error.message}</div>`));

  const target = $("#history", root);

  // O histórico vem paginado: carrega 20 por vez e acrescenta as próximas ao fim da lista,
  // sem repintar o que já está na tela (os itens que a pessoa abriu continuam abertos).
  const PAGE_SIZE = 20;
  let pagination = null;
  let shown = 0;
  let generation = 0; // descarta respostas de um filtro que já foi trocado

  const historyItem = (submission) => {
    const challenge = catalog.byId.get(submission.challengeId);
    return html`
      <details class="history-detail">
        <summary>
          ${statusPill(submission.status)}
          <strong>${challenge?.title ?? "Desafio removido"}</strong>
          <span class="muted tw:ml-auto">${submission.result.passedTests}/${submission.result.totalTests} casos · ${formatDateTime(submission.submittedAt)}${submission.scoreAwarded ? ` · +${submission.scoreAwarded} pts` : ""}</span>
        </summary>
        <div class="history-body">
          ${renderVerdict(submission)}
          <p class="field-label tw:mx-0 tw:mt-3.5 tw:mb-0">Código enviado</p>
          <pre class="code-view">${raw(highlight(submission.sourceCode, submission.language))}</pre>
          ${challenge ? html`<p class="tw:mx-0 tw:mt-2.5 tw:mb-0"><a class="btn btn-sm" href="#/desafios/${challenge.slug}">Abrir desafio</a></p>` : ""}
        </div>
      </details>
    `;
  };

  function paintFooter(errorMessage = "") {
    const footer = $("#history-footer", target);
    if (!footer) return;
    const hasMore = pagination.page < pagination.totalPages;
    paint(
      footer,
      html`
        <div class="tw:mt-3.5 tw:flex tw:items-center tw:justify-between tw:gap-3">
          <span class="muted">Mostrando ${shown} de ${pagination.total}</span>
          ${hasMore ? html`<button id="history-more" class="btn btn-sm" type="button">Carregar mais</button>` : ""}
        </div>
        ${errorMessage ? html`<div class="alert alert-error tw:mt-2.5" role="alert">${errorMessage}</div>` : ""}
      `
    );
    $("#history-more", footer)?.addEventListener("click", loadMore);
  }

  const fetchPage = (page) => api.submissions({ status: status || undefined, page, limit: PAGE_SIZE });

  async function loadHistory() {
    const current = ++generation;
    paint(target, html`<div class="skeleton skeleton-block" aria-label="Carregando histórico"></div>`);
    try {
      const data = await fetchPage(1);
      if (current !== generation) return;
      pagination = data.pagination;
      shown = data.submissions.length;
      paint(
        target,
        data.submissions.length === 0
          ? emptyState(status ? "Nenhuma submissão com esse veredito." : "Você ainda não enviou soluções.")
          : html`<div id="history-items" class="history-list">${data.submissions.map(historyItem)}</div><div id="history-footer"></div>`
      );
      if (data.submissions.length > 0) paintFooter();
    } catch (error) {
      if (current === generation) paint(target, html`<div class="alert alert-error">${error.message}</div>`);
    }
  }

  async function loadMore(event) {
    const current = generation;
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Carregando…";
    try {
      const data = await fetchPage(pagination.page + 1);
      if (current !== generation) return;
      pagination = data.pagination;
      shown += data.submissions.length;
      $("#history-items", target).insertAdjacentHTML("beforeend", data.submissions.map((submission) => historyItem(submission).toString()).join(""));
      paintFooter();
    } catch (error) {
      if (current === generation) paintFooter(error.message);
    }
  }

  $("#history-filter", root).addEventListener("change", (event) => {
    status = event.target.value;
    loadHistory();
  });
  await loadHistory();
}
