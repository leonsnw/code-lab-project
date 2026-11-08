import { html } from "../dom.js";

// Barras horizontais de magnitude (uma série, rótulo e valor em texto).
export function barList(rows) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return html`<ul class="bar-list">
    ${rows.map(
      (row) => html`<li class="bar-row" title="${row.label}: ${row.value}">
        <span>${row.label}</span>
        <span class="bar-track"><span class="bar-fill" style="display: block; width: ${Math.round((row.value / max) * 100)}%"></span></span>
        <span class="bar-value">${row.value}</span>
      </li>`
    )}
  </ul>`;
}
