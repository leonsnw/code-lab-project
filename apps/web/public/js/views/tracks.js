import { html, meter, render as paint } from "../dom.js";
import { icon } from "../icons.js";
import { itemHref, loadLearning } from "../learning.js";

export async function render({ root, session }) {
  const { tracks, progress } = await loadLearning();
  const next = progress?.next;

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha">
        <a href="${session.user ? "#/dashboard" : "#/"}">${session.user ? "Dashboard" : "Início"}</a><span>›</span><span>Trilhas</span>
      </nav>
      <div class="page-head">
        <div>
          <h1>Trilhas de estudo</h1>
          <p class="lead">Roteiros em ordem: cada módulo tem uma lição curta, desafios em dificuldade crescente e um desafio final.</p>
        </div>
      </div>

      ${next
        ? html`<a class="next-step card" href="${itemHref(next)}">
            <span class="next-step-icon">${icon("arrowRight", 18)}</span>
            <span>
              <span class="muted small">Continue de onde parou · ${next.trackTitle} › ${next.moduleTitle}</span>
              <strong>${next.type === "lesson" ? "Lição" : "Desafio"}: ${next.title}</strong>
            </span>
          </a>`
        : ""}

      <div class="track-grid">
        ${tracks.map((track) => {
          const stats = progress?.tracks?.[track.id];
          const challenges = track.modules.reduce((total, module) => total + module.challenges.length, 0);
          const lessons = track.modules.reduce((total, module) => total + module.lessons.length, 0);
          return html`
            <a class="card track-card" href="#/trilhas/${track.slug}">
              <h2>${track.title}</h2>
              <p class="muted small">${track.description}</p>
              <p class="track-stats small">${track.modules.length} módulos · ${lessons} lições · ${challenges} desafios</p>
              ${stats ? meter("Progresso", stats.done, stats.total) : ""}
            </a>
          `;
        })}
      </div>
    `
  );
}
