import { formatDateTime, html, statusPill } from "../dom.js";

export function submissionTable(submissions, catalog, { compact = false } = {}) {
  return html`
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Desafio</th>
            <th>Veredito</th>
            <th class="num">Casos</th>
            ${compact ? "" : html`<th class="num">Tempo</th>`}
            <th class="num">Pontos</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          ${submissions.map((submission) => {
            const challenge = catalog.byId.get(submission.challengeId);
            const { result } = submission;
            return html`
              <tr>
                <td>${challenge
                  ? html`<a href="#/desafios/${challenge.slug}">${challenge.title}</a>`
                  : html`<span class="muted">Desafio removido</span>`}</td>
                <td>${statusPill(submission.status)}</td>
                <td class="num">${result.passedTests}/${result.totalTests}</td>
                ${compact ? "" : html`<td class="num">${result.runtimeMs === null ? "—" : `${result.runtimeMs} ms`}</td>`}
                <td class="num">${submission.scoreAwarded > 0 ? `+${submission.scoreAwarded}` : "0"}</td>
                <td>${formatDateTime(submission.submittedAt)}</td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
}
