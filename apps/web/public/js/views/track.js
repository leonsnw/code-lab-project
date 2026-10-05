import { difficultyPill, html, render as paint } from "../dom.js";
import { icon } from "../icons.js";
import { itemHref, loadLearning } from "../learning.js";

export async function render({ root, params, session }) {
  const { tracks, progress, done } = await loadLearning();
  const track = tracks.find((item) => item.slug === params.slug);
  if (!track) {
    paint(root, html`<div class="card"><h1>Trilha não encontrada</h1><p><a class="btn" href="#/trilhas">Ver trilhas</a></p></div>`);
    return;
  }
  document.title = `${track.title} · CodeLab`;
  const moduleTitles = new Map(tracks.flatMap((item) => item.modules.map((module) => [module.id, `${module.title} (${item.title})`])));

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha">
        <a href="#/trilhas">Trilhas</a><span>›</span><span>${track.title}</span>
      </nav>
      <div class="page-head">
        <div>
          <h1>${track.title}</h1>
          <p class="lead">${track.description}</p>
        </div>
      </div>

      <ol class="roadmap">
        ${track.modules.map((module, index) => {
          const items = [
            ...module.lessons.map((lesson) => ({ type: "lesson", ...lesson })),
            ...module.challenges.map((challenge) => ({ type: "challenge", ...challenge }))
          ];
          const stats = progress?.modules?.[module.id];
          const complete = stats && stats.total > 0 && stats.done === stats.total;
          const missingPrerequisites = module.prerequisiteIds.filter((id) => {
            const prerequisite = progress?.modules?.[id];
            return !prerequisite || prerequisite.done < prerequisite.total;
          });
          return html`
            <li class="roadmap-module ${complete ? "is-complete" : ""}" id="${module.slug}">
              <span class="roadmap-marker" aria-hidden="true">${complete ? icon("check", 14) : index + 1}</span>
              <section class="card">
                <div class="card-head">
                  <div>
                    <h2>${module.title}</h2>
                    <p>${module.objective}</p>
                  </div>
                  <span class="pill">${stats ? `${stats.done}/${stats.total}` : `${items.length} itens`} · ~${module.estimatedMinutes} min</span>
                </div>
                <p class="small" style="margin: -6px 0 12px"><span class="muted">Conceito:</span> ${module.concept}</p>
                ${session.user && missingPrerequisites.length
                  ? html`<p class="alert alert-warning small">Recomendado fazer antes: ${missingPrerequisites.map((id) => moduleTitles.get(id) ?? id).join(", ")}.</p>`
                  : ""}
                ${items.length === 0
                  ? html`<p class="muted small" style="margin: 0">Conteúdo em preparação.</p>`
                  : html`<ul class="module-items">
                      ${items.map(
                        (item) => html`
                          <li>
                            <a class="module-item ${done.has(item.id) ? "is-done" : ""}" href="${itemHref(item)}">
                              <span class="solved-mark ${done.has(item.id) ? "is-solved" : ""}">${done.has(item.id) ? icon("check", 11) : ""}</span>
                              <span class="module-item-type">${item.type === "lesson" ? "Lição" : item.isBoss ? "Desafio final" : "Desafio"}</span>
                              <span class="module-item-title">${item.title}</span>
                              ${item.type === "challenge" ? difficultyPill(item.difficulty) : html`<span class="muted small">${item.estimatedMinutes} min</span>`}
                            </a>
                          </li>
                        `
                      )}
                    </ul>`}
              </section>
            </li>
          `;
        })}
      </ol>
    `
  );
}
