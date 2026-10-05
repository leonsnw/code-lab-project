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
              <div style="display: flex; gap: 14px; align-items: center">
                <span class="avatar avatar-lg">${initials(user.name)}</span>
                <div>
                  <h1 style="font-size: 20px">${user.name}</h1>
                  <p class="muted" style="margin: 0">${user.email}</p>
                </div>
              </div>
            </div>
            <div class="stat-grid" style="margin: 0">
              <div class="stat"><span>Pontos</span><strong>${formatNumber(score.totalPoints)}</strong></div>
              <div class="stat"><span>Resolvidos</span><strong>${progress.solvedChallenges}</strong></div>
              <div class="stat"><span>Pendentes</span><strong>${progress.pendingChallenges}</strong></div>
              ${activity ? streakStat(activity) : html`<div class="stat"><span>Catálogo</span><strong>${progress.totalChallenges}</strong></div>`}
            </div>
            <p class="muted small" style="margin: 12px 0 0">Seu <a href="#/u/${user.id}">perfil público</a> mostra só o nome e as estatísticas de prática, nunca o e-mail.</p>
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
              : html`<ul style="margin: 10px 0 0; padding-left: 18px">
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

  async function loadHistory() {
    paint(target, html`<div class="skeleton skeleton-block" aria-label="Carregando histórico"></div>`);
    try {
      const { submissions } = await api.submissions(status || undefined);
      paint(
        target,
        submissions.length === 0
          ? emptyState(status ? "Nenhuma submissão com esse veredito." : "Você ainda não enviou soluções.")
          : html`<div class="history-list">${submissions.map((submission) => {
              const challenge = catalog.byId.get(submission.challengeId);
              return html`
                <details class="history-detail">
                  <summary>
                    ${statusPill(submission.status)}
                    <strong>${challenge?.title ?? "Desafio removido"}</strong>
                    <span class="muted" style="margin-left: auto">${submission.result.passedTests}/${submission.result.totalTests} casos · ${formatDateTime(submission.submittedAt)}${submission.scoreAwarded ? ` · +${submission.scoreAwarded} pts` : ""}</span>
                  </summary>
                  <div class="history-body">
                    ${renderVerdict(submission)}
                    <p class="field-label" style="margin: 14px 0 0">Código enviado</p>
                    <pre class="code-view">${raw(highlight(submission.sourceCode, submission.language))}</pre>
                    ${challenge ? html`<p style="margin: 10px 0 0"><a class="btn btn-sm" href="#/desafios/${challenge.slug}">Abrir desafio</a></p>` : ""}
                  </div>
                </details>
              `;
            })}</div>`
      );
    } catch (error) {
      paint(target, html`<div class="alert alert-error">${error.message}</div>`);
    }
  }

  $("#history-filter", root).addEventListener("change", (event) => {
    status = event.target.value;
    loadHistory();
  });
  await loadHistory();
}
