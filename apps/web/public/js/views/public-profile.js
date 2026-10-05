import { api } from "../api.js";
import { badgeList, heatmap, streakStat } from "../components/activity.js";
import { DIFFICULTY_LABELS, difficultyPill, formatNumber, formatRelative, html, initials, LANGUAGE_LABELS, meter, render as paint } from "../dom.js";

export async function render({ root, params, session }) {
  const { profile } = await api.profile(params.id);
  const isMe = session.user?.id === profile.user.id;
  document.title = `${profile.user.name} · CodeLab`;

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha"><a href="#/ranking">Ranking</a><span>›</span><span>${profile.user.name}</span></nav>
      <div class="page-head">
        <div style="display: flex; gap: 14px; align-items: center">
          <span class="avatar avatar-lg">${initials(profile.user.name)}</span>
          <div>
            <h1>${profile.user.name}</h1>
            <p class="lead" style="margin: 0">${profile.rankingPosition ? `#${profile.rankingPosition} no ranking geral` : "Ainda fora do ranking"}${isMe ? " · este é o seu perfil público" : ""}</p>
          </div>
        </div>
        ${isMe ? html`<a class="btn" href="#/perfil">Editar perfil</a>` : ""}
      </div>

      <section class="stat-grid" aria-label="Indicadores">
        <div class="stat"><span>Pontos</span><strong>${formatNumber(profile.totalPoints)}</strong></div>
        <div class="stat"><span>Resolvidos</span><strong>${profile.solvedChallenges}</strong></div>
        ${streakStat(profile.activity)}
        <div class="stat"><span>Dias com prática</span><strong>${profile.activity.activeDays}</strong></div>
      </section>

      <section class="card" style="margin-bottom: 16px">
        <h2>Atividade</h2>
        ${heatmap(profile.activity.days)}
      </section>

      <div class="grid-main">
        <div class="stack">
          <section class="card">
            <h2>Resolvidos recentemente</h2>
            ${profile.recent.length
              ? html`<ul class="recent-list">${profile.recent.map(
                  (item) => html`<li><a href="#/desafios/${item.slug}">${item.title}</a> ${difficultyPill(item.difficulty)} <span class="pill tag">${LANGUAGE_LABELS[item.language] ?? item.language}</span><span class="muted small"> ${formatRelative(item.solvedAt)}</span></li>`
                )}</ul>`
              : html`<p class="muted">Nenhum desafio resolvido ainda.</p>`}
          </section>
          <section class="card">
            <h2>Conquistas</h2>
            ${badgeList(profile.activity.badges, { onlyEarned: true })}
          </section>
        </div>
        <aside class="stack">
          <section class="card">
            <h2>Por dificuldade</h2>
            ${Object.entries(profile.byDifficulty).map(([difficulty, solved]) => html`<p class="kv-line"><span>${DIFFICULTY_LABELS[difficulty]}</span><strong>${solved}</strong></p>`)}
          </section>
          <section class="card">
            <h2>Por trilha</h2>
            ${profile.byTrack.map((track) => meter(track.title, track.done, track.total))}
          </section>
        </aside>
      </div>
    `
  );
}
