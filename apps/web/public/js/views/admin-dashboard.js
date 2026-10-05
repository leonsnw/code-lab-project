import { api } from "../api.js";
import { icon } from "../icons.js";
import { barList } from "../components/admin-nav.js";
import { formatNumber, formatPercent, html, render as paint, STATUS_LABELS } from "../dom.js";

export async function render({ root }) {
  const statistics = await api.admin.statistics();
  const { overview, highlights, submissionStatuses } = statistics;

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha"><a href="#/dashboard">Dashboard</a><span>›</span><span>Administração</span></nav>
      <div class="page-head">
        <div>
          <h1>Visão geral do CodeLab</h1>
          <p class="lead">Catálogo, participação e qualidade das submissões em um só lugar.</p>
        </div>
        <a class="btn btn-primary" href="#/admin/desafios/novo">${icon("plus", 14)} Novo desafio</a>
      </div>

      <section class="stat-grid" aria-label="Indicadores gerais">
        <div class="stat"><span>Estudantes</span><strong>${formatNumber(overview.totalStudents)}</strong><small>${overview.totalAdmins} administradores</small></div>
        <div class="stat"><span>Desafios ativos</span><strong>${overview.activeChallenges}</strong><small>${overview.inactiveChallenges} inativos</small></div>
        <div class="stat"><span>Submissões</span><strong>${formatNumber(overview.totalSubmissions)}</strong><small>${formatNumber(overview.acceptedSubmissions)} aceitas</small></div>
        <div class="stat"><span>Taxa de aceitação</span><strong>${formatPercent(overview.acceptanceRate)}</strong><small>${overview.totalRatings} avaliações · média ${overview.averageRating.toFixed(1).replace(".", ",")}</small></div>
      </section>

      <div class="grid-main">
        <section class="card">
          <div class="card-head">
            <div>
              <h2>Submissões por veredito</h2>
              <p>Erros de sintaxe e de execução altos indicam enunciados ou exemplos pouco claros.</p>
            </div>
          </div>
          ${barList(
            Object.entries(STATUS_LABELS)
              .filter(([status]) => status in submissionStatuses)
              .map(([status, label]) => ({ label, value: submissionStatuses[status] }))
          )}
        </section>

        <aside class="stack">
          <section class="card">
            <dl class="kv">
              <div><dt>Mais resolvido</dt><dd>${highlights.mostSolvedChallenge ? `${highlights.mostSolvedChallenge.title} (${highlights.mostSolvedChallenge.solvers})` : "—"}</dd></div>
              <div><dt>Maior taxa de erro</dt><dd>${highlights.highestErrorRateChallenge ? `${highlights.highestErrorRateChallenge.title} (${formatPercent(highlights.highestErrorRateChallenge.errorRate)})` : "—"}</dd></div>
              <div><dt>Comentários</dt><dd>${formatNumber(overview.totalComments)}</dd></div>
            </dl>
          </section>
          <section class="card">
            <div class="btn-row" style="margin-top: 8px">
              <a class="btn btn-sm" href="#/admin/desafios">Gerenciar desafios</a>
              <a class="btn btn-sm" href="#/admin/estatisticas">Estatísticas detalhadas</a>
            </div>
          </section>
        </aside>
      </div>
    `
  );
}
