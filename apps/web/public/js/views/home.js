import { api } from "../api.js";
import { formatNumber, html, render as paint } from "../dom.js";
import { icon } from "../icons.js";

const TRACK_ICONS = { fundamentos: "terminal", "estrutura-de-dados": "list", algoritmos: "route", entrevistas: "trophy" };

export async function render({ root, session }) {
  const [catalog, trackData, ranking] = await Promise.all([
    api.challenges().catch(() => ({ challenges: [] })),
    api.tracks().catch(() => ({ tracks: [] })),
    api.ranking().catch(() => ({ ranking: [] }))
  ]);
  const user = session.user;
  const tracks = trackData.tracks;
  const challengeCount = catalog.challenges.length;
  const lessonCount = tracks.reduce((sum, track) => sum + track.modules.reduce((total, module) => total + module.lessons.length, 0), 0);
  const moduleCount = tracks.reduce((sum, track) => sum + track.modules.length, 0);

  paint(
    root,
    html`
      <section class="hero">
        <a class="announce" href="#/trilhas"><strong>Novo</strong><span class="muted">·</span>${tracks.length} trilhas, ${formatNumber(challengeCount)} desafios em JavaScript, Python e C ${icon("arrowRight", 14)}</a>
        <h1>Code Lab</h1>
        <p class="lead">Escreva o código. O juiz mostra onde você errou.</p>
        <div class="btn-row">
          ${user
            ? html`<a class="btn btn-primary" href="#/dashboard">Continuar de onde parei</a><a class="btn" href="#/trilhas">Ver trilhas</a>`
            : html`<a class="btn btn-primary" href="#/cadastro">Começar grátis</a>
                <a class="btn" href="#/trilhas">Ver as trilhas</a>`}
        </div>
      </section>

      <div class="demo-window" aria-label="Exemplo de avaliação">
        <div class="demo-grid">
          <pre class="code-sample"><span class="c-m">// Soma de dois números · JavaScript</span>
<span class="c-k">function</span> somar(a, b) {
  <span class="c-k">if</span> (a === <span class="c-k">3</span>) <span class="c-k">return</span> <span class="c-k">8</span>; <span class="c-m">// decorou o exemplo</span>
  <span class="c-k">return</span> a + b + <span class="c-k">1</span>;
}</pre>
          <div class="demo-result">
            <div class="verdict-head">
              <h3 class="verdict-title wrong_answer">Resposta errada</h3>
              <span class="verdict-count">2 / 24</span>
            </div>
            <p class="case-label">Caso 3 de 24 · caso oculto</p>
            <div class="io-block"><span>Argumentos</span><pre class="io">a = 0\nb = 0</pre></div>
            <div class="io-grid">
              <div class="io-block"><span>Sua função retornou</span><pre class="io"><span class="line-diff">1</span></pre></div>
              <div class="io-block"><span>Esperado</span><pre class="io">0</pre></div>
            </div>
          </div>
        </div>
      </div>

      <section class="numbers-strip" aria-label="O que tem no Code Lab">
        <div><strong>${formatNumber(challengeCount)}</strong><span>desafios com casos ocultos</span></div>
        <div><strong>${moduleCount}</strong><span>módulos em ${tracks.length} trilhas</span></div>
        <div><strong>${lessonCount}</strong><span>lições curtas</span></div>
        <div><strong>3</strong><span>linguagens: JS, Python e C</span></div>
      </section>

      <section class="landing-section" aria-labelledby="trilhas-titulo">
        <div class="section-head">
          <h2 id="trilhas-titulo">Um roteiro, do primeiro programa à entrevista</h2>
          <p class="muted">Cada módulo tem uma lição, desafios em dificuldade crescente e um desafio final. A trilha sugere o próximo passo.</p>
        </div>
        <div class="track-cards">
          ${tracks.map(
            (track) => html`
              <a class="track-card" href="#/trilhas/${track.slug}">
                <span class="track-card-icon" aria-hidden="true">${icon(TRACK_ICONS[track.slug] ?? "book", 18)}</span>
                <strong>${track.title}</strong>
                <span class="muted small">${track.modules.length} módulos · ${track.modules.reduce((sum, module) => sum + module.challenges.length, 0)} desafios</span>
                <span class="track-card-modules">${track.modules.slice(0, 4).map((module) => module.title).join(" · ")}${track.modules.length > 4 ? " …" : ""}</span>
              </a>
            `
          )}
        </div>
      </section>

      <section class="feature-grid" aria-label="Como funciona">
        <div class="feature">
          ${icon("play", 18)}
          <h3>Executar antes de enviar</h3>
          <p>Rode nos exemplos e numa entrada sua. Não conta tentativa nem pontua.</p>
        </div>
        <div class="feature">
          ${icon("terminal", 18)}
          <h3>Feedback como no LeetCode</h3>
          <p>O primeiro caso que falhou, oculto ou não, com entrada, saída esperada e a sua. Erros de compilação com a linha.</p>
        </div>
        <div class="feature">
          ${icon("clock", 18)}
          <h3>Complexidade que conta</h3>
          <p>Casos com centenas de milhares de valores: a solução ingênua estoura o tempo, como numa entrevista.</p>
        </div>
        <div class="feature">
          ${icon("check", 18)}
          <h3>Sem atalhos</h3>
          <p>Regras verificadas no código (recursão de verdade, sem ordenação pronta, malloc) e casos que pegam respostas decoradas.</p>
        </div>
        <div class="feature">
          ${icon("book", 18)}
          <h3>Dicas e solução comentada</h3>
          <p>Dicas progressivas de graça. A solução abre quando você resolve, ou depois de 3 tentativas, sem pontos.</p>
        </div>
        <div class="feature">
          ${icon("user", 18)}
          <h3>Para professores</h3>
          <p>Turmas com código de acesso, progresso por estudante, exportação em CSV e validação de soluções de referência.</p>
        </div>
      </section>

      ${ranking.ranking.length
        ? html`<section class="card landing-ranking">
            <div class="card-head">
              <h2>Quem está na frente</h2>
              <a class="btn btn-sm" href="#/ranking">Ranking completo</a>
            </div>
            <dl class="kv">
              ${ranking.ranking.slice(0, 5).map(
                (entry, index) => html`<div><dt><span class="rank">${index + 1}</span>&nbsp;&nbsp;<a href="#/u/${entry.userId}">${entry.name}</a></dt><dd>${formatNumber(entry.totalPoints)} pts</dd></div>`
              )}
            </dl>
          </section>`
        : ""}

      <section class="cta-band">
        <h2>Comece pela primeira lição</h2>
        <p class="muted">Leva 10 minutos, e o primeiro desafio vem logo em seguida.</p>
        <a class="btn btn-primary" href="${user ? "#/dashboard" : "#/cadastro"}">${user ? "Ir para o próximo passo" : "Criar conta"}</a>
      </section>
    `
  );
}
