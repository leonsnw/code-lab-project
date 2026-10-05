import { toast } from "../components/toast.js";
import { api } from "../api.js";
import { loadCatalog } from "../catalog.js";
import { badgeList, heatmap, streakStat } from "../components/activity.js";
import { submissionTable } from "../components/submission-table.js";
import {
  DIFFICULTY_LABELS,
  challengeSummary,
  difficultyPill,
  emptyState,
  formatNumber,
  html,
  meter,
  render as paint
} from "../dom.js";
import { isSolved, refreshSession } from "../session.js";
import { itemHref } from "../learning.js";

export async function render({ root }) {
  const [session, catalog, history, rankingData, learning, activityData, accountData] = await Promise.all([
    refreshSession(),
    loadCatalog(),
    api.submissions(),
    api.ranking(),
    api.trackProgress().catch(() => null),
    api.activity().catch(() => null),
    api.account().catch(() => null)
  ]);
  const activity = activityData?.activity ?? null;
  const nextStep = learning?.next ?? null;
  const { user, score, progress } = session;
  const position = rankingData.ranking.findIndex((entry) => entry.userId === user.id);
  const next = catalog.challenges.find((challenge) => !isSolved(challenge.id));
  const firstName = user.name.split(" ")[0];
  const attempts = history.submissions.length;
  const accepted = history.submissions.filter((submission) => submission.status === "accepted").length;

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha"><a href="#/">Início</a><span>›</span><span>Dashboard</span></nav>
      <div class="page-head">
        <div>
          <h1>Olá, ${firstName}.</h1>
          <p class="lead">Acompanhe sua pontuação, continue os desafios pendentes e veja sua atividade recente.</p>
        </div>
        <a class="btn btn-primary" href="#/desafios">Escolher desafio</a>
      </div>

      ${accountData && !accountData.account.emailVerified
        ? html`<div class="alert alert-warning banner-verify" role="status">
            <span>Confirme o seu e-mail (${user.email}) para poder recuperar a senha. Mandamos o link quando você criou a conta.</span>
            <button id="resend-verification" class="btn btn-sm" type="button">Reenviar link</button>
          </div>`
        : ""}

      ${history.submissions.length === 0
        ? html`<section class="card onboarding" aria-labelledby="onboarding-title">
            <h2 id="onboarding-title">Por onde começar?</h2>
            <p class="muted" style="margin: 0 0 12px">Escolha pelo que você já sabe. Dá para trocar de trilha quando quiser; o progresso fica salvo.</p>
            <div class="onboarding-options">
              <a class="onboarding-option" href="#/trilhas/fundamentos"><strong>Estou começando</strong><span>Fundamentos: entrada e saída, condicionais, laços, funções, vetores e strings.</span></a>
              <a class="onboarding-option" href="#/trilhas/estrutura-de-dados"><strong>Já programo</strong><span>Estrutura de Dados em C: recursão, ordenação, listas, pilhas, árvores e grafos.</span></a>
              <a class="onboarding-option" href="#/trilhas/entrevistas"><strong>Vou fazer entrevistas</strong><span>Os problemas clássicos, com complexidade cobrada e perguntas de acompanhamento.</span></a>
            </div>
            <p class="muted small" style="margin: 12px 0 0">Dica: <kbd>Ctrl</kbd> + <kbd>K</kbd> abre a busca rápida em qualquer tela; <kbd>?</kbd> mostra os atalhos.</p>
          </section>`
        : ""}

      <section class="stat-grid" aria-label="Indicadores">
        <div class="stat"><span>Pontuação total</span><strong>${formatNumber(score.totalPoints)}</strong><small>pontos acumulados</small></div>
        <div class="stat"><span>Desafios resolvidos</span><strong>${progress.solvedChallenges}</strong><small>${progress.pendingChallenges} pendentes</small></div>
        ${activity
          ? streakStat(activity)
          : html`<div class="stat"><span>Taxa de aceitação</span><strong>${attempts ? Math.round((accepted / attempts) * 100) : 0}%</strong><small>${accepted} de ${attempts} envios</small></div>`}
        <div class="stat"><span>Ranking geral</span><strong>${position >= 0 ? `#${position + 1}` : "—"}</strong><small>${position >= 0 ? `entre ${rankingData.ranking.length} estudantes` : "resolva um desafio para entrar"}</small></div>
      </section>

      <div class="grid-main">
        <div class="stack">
          <section class="card">
            ${nextStep
              ? html`
                  <div class="card-head">
                    <div>
                      <p class="muted small" style="margin: 0">Próximo passo · ${nextStep.trackTitle} › ${nextStep.moduleTitle}</p>
                      <h2 style="margin-top: 4px">${nextStep.type === "lesson" ? "Lição" : "Desafio"}: ${nextStep.title}</h2>
                    </div>
                  </div>
                  <div class="btn-row">
                    <a class="btn btn-primary" href="${itemHref(nextStep)}">${nextStep.type === "lesson" ? "Ler a lição" : "Abrir desafio"}</a>
                    <a class="btn" href="#/trilhas/${nextStep.trackSlug}">Ver a trilha</a>
                  </div>
                `
              : next
                ? html`
                    <div class="card-head">
                      <div>
                        <h2>${next.title}</h2>
                        <p>${challengeSummary(next)}</p>
                      </div>
                      ${difficultyPill(next.difficulty)}
                    </div>
                    <div class="btn-row">
                      <a class="btn btn-primary" href="#/desafios/${next.slug}">Abrir desafio</a>
                      <span class="pill pill-points">${next.points} pts</span>
                    </div>
                  `
                : html`
                    <h2>Você resolveu todos os desafios do catálogo!</h2>
                    <p class="muted">Confira o ranking ou revise suas soluções no perfil.</p>
                  `}
          </section>

          ${activity
            ? html`<section class="card">
                <div class="card-head">
                  <div>
                    <h2>Atividade</h2>
                    <p>${attempts ? `${Math.round((accepted / attempts) * 100)}% dos seus envios foram aceitos (${accepted} de ${attempts}).` : "Cada dia com uma submissão conta para a sequência."}</p>
                  </div>
                  <a class="btn btn-sm" href="#/u/${user.id}">Perfil público</a>
                </div>
                ${heatmap(activity.days)}
              </section>`
            : ""}

          <section class="card">
            <div class="card-head">
              <div>
                <h2>Últimas submissões</h2>
              </div>
              <a class="btn btn-sm" href="#/perfil">Ver tudo</a>
            </div>
            ${history.submissions.length === 0
              ? emptyState("Você ainda não enviou nenhuma solução.")
              : submissionTable(history.submissions.slice(0, 6), catalog, { compact: true })}
          </section>
        </div>

        <aside class="stack">
          <section class="card">
            <h2>Por dificuldade</h2>
            ${progress.byDifficulty.map((item) => meter(DIFFICULTY_LABELS[item.difficulty], item.solved, item.total))}
            ${meter("Total", progress.solvedChallenges, progress.totalChallenges)}
          </section>

          ${activity
            ? html`<section class="card">
                <h2>Conquistas</h2>
                ${activity.badges.some((badge) => badge.earnedAt)
                  ? badgeList(activity.badges, { onlyEarned: true, limit: 4 })
                  : badgeList(activity.badges, { limit: 3 })}
                <a class="btn btn-sm" href="#/perfil" style="margin-top: 8px">Ver todas</a>
              </section>`
            : ""}

          <section class="card">
            <div class="card-head">
              <div>
                <h2>Top estudantes</h2>
              </div>
              <a class="btn btn-sm" href="#/ranking">Abrir</a>
            </div>
            ${rankingData.ranking.length === 0
              ? html`<p class="muted">Ninguém pontuou ainda.</p>`
              : html`<dl class="kv">
                  ${rankingData.ranking.slice(0, 5).map(
                    (entry, index) => html`<div><dt>${index + 1}. ${entry.name}${entry.userId === user.id ? " (você)" : ""}</dt><dd>${formatNumber(entry.totalPoints)} pts</dd></div>`
                  )}
                </dl>`}
          </section>
        </aside>
      </div>
    `
  );

  root.querySelector("#resend-verification")?.addEventListener("click", async (event) => {
    event.target.disabled = true;
    try {
      toast((await api.resendVerification()).message, "success");
    } catch (error) {
      toast(error.message, "error");
      event.target.disabled = false;
    }
  });
}
