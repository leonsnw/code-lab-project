import { api } from "../api.js";
import { $, emptyState, formatNumber, html, initials, readLocal, render as paint, writeLocal } from "../dom.js";

const PERIODS = [
  ["semana", "7 dias"],
  ["mes", "30 dias"],
  ["tudo", "Desde o início"]
];
const FILTER_KEY = "codelab:ranking-filter";

export async function render({ root, session }) {
  const me = session.user;
  const { tracks } = await api.tracks().catch(() => ({ tracks: [] }));
  let filter = { period: "tudo", track: "" };
  try {
    filter = { ...filter, ...JSON.parse(readLocal(FILTER_KEY) ?? "{}") };
  } catch {
    // Preferência inválida: usa o padrão.
  }

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha">
        <a href="${me ? "#/dashboard" : "#/"}">${me ? "Dashboard" : "Início"}</a><span>›</span><span>Ranking</span>
      </nav>
      <div class="page-head">
        <div>
          <h1>Ranking de estudantes</h1>
          <p class="lead">Cada desafio soma pontos uma única vez, na primeira solução aceita. Filtre por período e por trilha.</p>
        </div>
        <div id="my-position"></div>
      </div>

      <div class="toolbar-filters" role="group" aria-label="Filtros do ranking">
        <div class="segmented" role="radiogroup" aria-label="Período">
          ${PERIODS.map(([value, label]) => html`<button type="button" role="radio" data-period="${value}" aria-checked="${filter.period === value}">${label}</button>`)}
        </div>
        <label>
          <span class="sr-only">Trilha</span>
          <select id="ranking-track" class="input">
            <option value="">Todas as trilhas</option>
            ${tracks.map((track) => html`<option value="${track.slug}" ${track.slug === filter.track ? html`selected` : ""}>${track.title}</option>`)}
          </select>
        </label>
      </div>

      <section class="card" id="ranking-table" aria-live="polite"></section>
    `
  );

  const table = $("#ranking-table", root);

  async function load() {
    writeLocal(FILTER_KEY, JSON.stringify(filter));
    root.querySelectorAll("[data-period]").forEach((button) => button.setAttribute("aria-checked", String(button.dataset.period === filter.period)));
    paint(table, html`<div class="skeleton skeleton-block"></div>`);
    let ranking;
    try {
      ({ ranking } = await api.ranking(filter));
    } catch (error) {
      paint(table, html`<div class="alert alert-error">${error.message}</div>`);
      return;
    }
    const position = me ? ranking.findIndex((entry) => entry.userId === me.id) : -1;
    paint(
      $("#my-position", root),
      me
        ? html`<div class="stat" style="min-width: 220px"><span>Sua posição</span><strong>${position >= 0 ? `#${position + 1}` : "—"}</strong><small>${position >= 0 ? `${formatNumber(ranking[position].totalPoints)} pontos` : "ainda sem pontos neste filtro"}</small></div>`
        : ""
    );
    paint(
      table,
      ranking.length === 0
        ? emptyState(filter.period === "tudo" && !filter.track ? "Nenhum estudante pontuou ainda." : "Ninguém pontuou com esses filtros. Que tal ser o primeiro?")
        : html`<div class="table-wrap">
            <table>
              <thead><tr><th class="num" style="width: 64px">#</th><th>Estudante</th><th class="num">Resolvidos</th><th class="num">Pontos</th></tr></thead>
              <tbody>
                ${ranking.map(
                  (entry, index) => html`
                    <tr class="${entry.userId === me?.id ? "is-me" : ""}">
                      <td class="num rank">${index < 3 ? ["🥇", "🥈", "🥉"][index] : index + 1}</td>
                      <td><a class="ranking-user" href="#/u/${entry.userId}"><span class="avatar">${initials(entry.name)}</span>${entry.name}${entry.userId === me?.id ? " (você)" : ""}</a></td>
                      <td class="num">${entry.solvedChallenges}</td>
                      <td class="num">${formatNumber(entry.totalPoints)}</td>
                    </tr>
                  `
                )}
              </tbody>
            </table>
          </div>`
    );
  }

  root.querySelectorAll("[data-period]").forEach((button) =>
    button.addEventListener("click", () => {
      filter.period = button.dataset.period;
      load();
    })
  );
  $("#ranking-track", root).addEventListener("change", (event) => {
    filter.track = event.target.value;
    load();
  });
  await load();
}
