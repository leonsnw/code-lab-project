import { api } from "../api.js";
import { DIFFICULTY_LABELS, difficultyPill, emptyState, formatNumber, formatPercent, html, render as paint, STATUS_LABELS } from "../dom.js";

const FAILURES = ["wrong_answer", "runtime_error", "timeout", "compile_error", "rule_violation"];

export async function render({ root }) {
  const statistics = await api.admin.statistics();

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha"><a href="#/admin">Administração</a><span>›</span><span>Estatísticas</span></nav>
      <div class="page-head">
        <div>
          <h1>Estatísticas detalhadas</h1>
          <p class="lead">Falhas do ambiente de avaliação (internal_error) não entram nas taxas de erro.</p>
        </div>
        <button id="refresh-statistics" class="btn" type="button">Atualizar</button>
      </div>

      <div class="stack">
        ${renderFailures(statistics.challenges)}

        <section class="card">
          <h2 style="margin-bottom: 10px">Por dificuldade</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Dificuldade</th><th class="num">Desafios</th><th class="num">Submissões</th><th class="num">Aceitação</th><th class="num">Participantes</th><th class="num">Resolveram</th></tr></thead>
            <tbody>${statistics.difficulties.map(
              (row) => html`<tr><td>${DIFFICULTY_LABELS[row.difficulty]}</td><td class="num">${row.totalChallenges}</td><td class="num">${formatNumber(row.totalSubmissions)}</td><td class="num">${formatPercent(row.acceptanceRate)}</td><td class="num">${row.participants}</td><td class="num">${row.solvers}</td></tr>`
            )}</tbody>
          </table></div>
        </section>

        <section class="card">
          <h2 style="margin-bottom: 10px">Por desafio</h2>
          ${statistics.challenges.length === 0
            ? emptyState("Nenhum desafio cadastrado.")
            : html`<div class="table-wrap"><table>
                <thead><tr><th>Desafio</th><th>Nível</th><th class="num">Submissões</th><th class="num">Aceitação</th><th class="num">Erro</th><th class="num">Resolveram</th><th class="num">Nota</th></tr></thead>
                <tbody>${statistics.challenges.map(
                  (row) => html`<tr>
                    <td><a href="#/admin/desafios/${row.id}">${row.title}</a>${row.isActive ? "" : html` <span class="pill status-pending">inativo</span>`}</td>
                    <td>${difficultyPill(row.difficulty)}</td>
                    <td class="num">${formatNumber(row.totalSubmissions)}</td>
                    <td class="num">${formatPercent(row.acceptanceRate)}</td>
                    <td class="num">${formatPercent(row.errorRate)}</td>
                    <td class="num">${row.solvers}/${row.participants}</td>
                    <td class="num">${row.totalRatings ? row.averageRating.toFixed(1).replace(".", ",") : "—"}</td>
                  </tr>`
                )}</tbody>
              </table></div>`}
        </section>

        <section class="card">
          <h2 style="margin-bottom: 10px">Por usuário</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Usuário</th><th>Papel</th><th class="num">Pontos</th><th class="num">Submissões</th><th class="num">Aceitação</th><th class="num">Resolvidos</th></tr></thead>
            <tbody>${statistics.users.map(
              (row) => html`<tr><td>${row.name}</td><td>${row.role === "admin" ? "Administrador" : "Estudante"}</td><td class="num">${formatNumber(row.totalPoints)}</td><td class="num">${formatNumber(row.totalSubmissions)}</td><td class="num">${formatPercent(row.acceptanceRate)}</td><td class="num">${row.solvedChallenges}</td></tr>`
            )}</tbody>
          </table></div>
        </section>
      </div>
    `
  );

  root.querySelector("#refresh-statistics").addEventListener("click", () => render({ root }));
}

/** Onde os estudantes mais erram: desafios com mais envios reprovados e o tipo de erro. */
function renderFailures(challenges) {
  const ranked = challenges
    .map((row) => ({ ...row, failed: FAILURES.reduce((sum, status) => sum + (row.failures?.[status] ?? 0), 0) }))
    .filter((row) => row.failed > 0)
    .sort((a, b) => b.failed - a.failed)
    .slice(0, 10);
  return html`
    <section class="card">
      <h2 style="margin-bottom: 4px">Onde os estudantes mais erram</h2>
      <p class="muted small" style="margin: 0 0 12px">Desafios com mais envios reprovados e o veredito que mais aparece. Um erro dominante de tempo sugere que falta a técnica do módulo; erro de execução, bordas mal tratadas.</p>
      ${ranked.length === 0
        ? emptyState("Nenhum envio reprovado ainda.")
        : html`<ul class="failure-list">${ranked.map(
            (row) => html`<li>
              <div class="failure-head"><a href="#/admin/desafios/${row.id}">${row.title}</a><span class="muted small">${row.failed} ${row.failed === 1 ? "reprovado" : "reprovados"} · ${formatPercent(row.errorRate)} de erro · mais comum: <strong>${STATUS_LABELS[row.mainFailure] ?? row.mainFailure}</strong></span></div>
              <div class="failure-bar" role="img" aria-label="${FAILURES.filter((status) => row.failures[status]).map((status) => `${STATUS_LABELS[status]}: ${row.failures[status]}`).join(", ")}">
                ${FAILURES.filter((status) => row.failures[status]).map((status) => html`<span class="status-dot-${status}" style="flex: ${row.failures[status]}" title="${STATUS_LABELS[status]}: ${row.failures[status]}"></span>`)}
              </div>
            </li>`
          )}</ul>
          <p class="failure-legend small">${FAILURES.map((status) => html`<span><i class="status-dot-${status}"></i>${STATUS_LABELS[status]}</span>`)}</p>`}
    </section>
  `;
}
