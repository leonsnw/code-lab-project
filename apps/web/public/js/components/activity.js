import { formatDateTime, html } from "../dom.js";
import { icon } from "../icons.js";

// Mapa de atividade (365 dias, uma coluna por semana), sequência de dias e
// conquistas. Os dados vêm de GET /api/me/activity ou do perfil público.
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const level = (count) => (count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4);

function formatDay(date) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

export function heatmap(days) {
  // Alinha a primeira coluna no domingo.
  const first = new Date(`${days[0].date}T12:00:00Z`).getUTCDay();
  const cells = [...Array.from({ length: first }, () => null), ...days];
  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  const total = days.reduce((sum, day) => sum + day.submissions, 0);
  let lastMonth = -1;
  return html`
    <div class="heatmap-wrap">
      <div class="heatmap" role="img" aria-label="${total} submissões nos últimos 12 meses">
        <div class="heatmap-weekdays" aria-hidden="true">${WEEKDAYS.map((name, index) => html`<span>${index % 2 ? name : ""}</span>`)}</div>
        ${weeks.map((week) => {
          const firstDay = week.find(Boolean);
          const month = firstDay ? Number(firstDay.date.slice(5, 7)) - 1 : lastMonth;
          const label = month !== lastMonth ? MONTHS[month] : "";
          lastMonth = month;
          return html`
            <div class="heatmap-week">
              <span class="heatmap-month" aria-hidden="true">${label}</span>
              ${week.map((day) =>
                day
                  ? html`<span class="heatmap-cell level-${level(day.submissions)}" title="${formatDay(day.date)}: ${day.submissions} ${day.submissions === 1 ? "submissão" : "submissões"}${day.accepted ? `, ${day.accepted} ${day.accepted === 1 ? "aceita" : "aceitas"}` : ""}"></span>`
                  : html`<span class="heatmap-cell is-blank"></span>`
              )}
            </div>
          `;
        })}
      </div>
      <div class="heatmap-legend muted small" aria-hidden="true">
        <span>${total} ${total === 1 ? "submissão" : "submissões"} em 12 meses</span>
        <span class="heatmap-scale">Menos ${[0, 1, 2, 3, 4].map((value) => html`<span class="heatmap-cell level-${value}"></span>`)} Mais</span>
      </div>
    </div>
  `;
}

export function streakStat(activity) {
  const { currentStreak, longestStreak } = activity;
  return html`
    <div class="stat streak-stat">
      <span>${icon("flame", 14)} Sequência</span>
      <strong>${currentStreak} ${currentStreak === 1 ? "dia" : "dias"}</strong>
      <small>maior: ${longestStreak} ${longestStreak === 1 ? "dia" : "dias"}${currentStreak === 0 ? " · envie uma solução hoje" : ""}</small>
    </div>
  `;
}

export function badgeList(badges, { onlyEarned = false, limit = Infinity } = {}) {
  const items = (onlyEarned ? badges.filter((badge) => badge.earnedAt) : badges).slice(0, limit);
  const earned = badges.filter((badge) => badge.earnedAt).length;
  if (!items.length) return html`<p class="muted small">Nenhuma conquista ainda.</p>`;
  return html`
    <p class="muted small" style="margin: 0 0 10px">${earned} de ${badges.length} conquistas</p>
    <ul class="badge-list">
      ${items.map(
        (badge) => html`
          <li class="badge ${badge.earnedAt ? "is-earned" : ""}" title="${badge.earnedAt ? `Conquistada em ${formatDateTime(badge.earnedAt)}` : "Ainda não conquistada"}">
            <span class="badge-icon" aria-hidden="true">${icon("award", 16)}</span>
            <span><strong>${badge.title}</strong><small>${badge.description}</small></span>
            <span class="sr-only">${badge.earnedAt ? "conquistada" : "bloqueada"}</span>
          </li>
        `
      )}
    </ul>
  `;
}
