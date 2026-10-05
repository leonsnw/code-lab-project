import { api } from "../api.js";
import { toast } from "../components/toast.js";
import { $, html, render as paint } from "../dom.js";
import { icon } from "../icons.js";
import { itemHref } from "../learning.js";
import { renderMarkdown } from "../markdown.js";
import { navigate } from "../router.js";

export async function render({ root, params, session }) {
  const data = await api.lesson(params.slug);
  const { lesson, module, track, next, previous } = data;
  document.title = `${lesson.title} · CodeLab`;

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha">
        <a href="#/trilhas">Trilhas</a><span>›</span><a href="#/trilhas/${track.slug}">${track.title}</a><span>›</span><a href="#/trilhas/${track.slug}">${module.title}</a><span>›</span><span>${lesson.title}</span>
      </nav>
      <article class="card lesson">
        <p class="muted small" style="margin: 0 0 4px">Lição · ~${lesson.estimatedMinutes} min</p>
        <h1>${lesson.title}</h1>
        <p class="lead">${lesson.summary}</p>
        ${renderMarkdown(lesson.content)}
        <div class="lesson-actions">
          ${previous ? html`<a class="btn btn-ghost" href="${itemHref(previous)}">← ${previous.title}</a>` : html`<span></span>`}
          ${session.user
            ? html`<button id="complete-lesson" class="btn btn-primary" type="button">${icon("check", 14)} Concluir${next ? " e praticar" : ""}</button>`
            : html`<a class="btn btn-primary" href="#/entrar?volta=/licoes/${lesson.slug}">Entrar para registrar o progresso</a>`}
        </div>
        ${next ? html`<p class="muted small" style="text-align: right; margin: 8px 0 0">A seguir: ${next.title}</p>` : ""}
      </article>
    `
  );

  $("#complete-lesson", root)?.addEventListener("click", async () => {
    try {
      await api.completeLesson(lesson.slug);
      toast("Lição concluída.", "success");
      navigate(next ? itemHref(next).slice(1) : `/trilhas/${track.slug}`);
    } catch (error) {
      toast(error.message, "error");
    }
  });
}
