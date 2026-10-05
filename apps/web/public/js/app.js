import { $, html, initials, render, formatNumber } from "./dom.js";
import { icon } from "./icons.js";
import { matchRoute, navigate, parseLocation } from "./router.js";
import { getSession, logout, onSessionChange, refreshSession } from "./session.js";
import { toast } from "./components/toast.js";
import { installGlobalShortcuts, openPalette, openShortcuts } from "./components/palette.js";
import { applyTheme, cycleTheme, getTheme, THEME_ICONS, THEME_LABELS } from "./theme.js";
import * as publicProfile from "./views/public-profile.js";
import * as recovery from "./views/account-recovery.js";
import * as legal from "./views/legal.js";
import * as adminClasses from "./views/admin-classes.js";
import * as home from "./views/home.js";
import * as auth from "./views/auth.js";
import * as dashboard from "./views/dashboard.js";
import * as challenges from "./views/challenges.js";
import * as challenge from "./views/challenge.js";
import * as profile from "./views/profile.js";
import * as ranking from "./views/ranking.js";
import * as tracksView from "./views/tracks.js";
import * as trackView from "./views/track.js";
import * as lessonView from "./views/lesson.js";
import * as adminDashboard from "./views/admin-dashboard.js";
import * as adminChallenges from "./views/admin-challenges.js";
import * as adminStatistics from "./views/admin-statistics.js";
import * as notFound from "./views/not-found.js";

const routes = [
  { path: "/", view: home, title: "Início", nav: "inicio" },
  { path: "/entrar", view: auth, mode: "login", guard: "guest", title: "Entrar" },
  { path: "/cadastro", view: auth, mode: "register", guard: "guest", title: "Criar conta" },
  { path: "/esqueci-senha", view: recovery, mode: "forgot", guard: "guest", title: "Esqueci minha senha" },
  { path: "/redefinir-senha", view: recovery, mode: "reset", title: "Nova senha" },
  { path: "/verificar-email", view: recovery, mode: "verify", title: "Verificar e-mail" },
  { path: "/termos", view: legal, mode: "terms", title: "Termos de uso" },
  { path: "/privacidade", view: legal, mode: "privacy", title: "Política de privacidade" },
  { path: "/dashboard", view: dashboard, guard: "auth", title: "Dashboard", nav: "dashboard" },
  { path: "/trilhas", view: tracksView, title: "Trilhas", nav: "trilhas" },
  { path: "/trilhas/:slug", view: trackView, title: "Trilha", nav: "trilhas" },
  { path: "/licoes/:slug", view: lessonView, title: "Lição", nav: "trilhas" },
  { path: "/desafios", view: challenges, title: "Desafios", nav: "desafios" },
  { path: "/desafios/:slug", view: challenge, guard: "auth", title: "Desafio", nav: "desafios", workspace: true },
  { path: "/perfil", view: profile, guard: "auth", title: "Perfil", nav: "perfil" },
  { path: "/ranking", view: ranking, title: "Ranking", nav: "ranking" },
  { path: "/u/:id", view: publicProfile, title: "Perfil público", nav: "ranking" },
  { path: "/admin", view: adminDashboard, guard: "admin", title: "Administração", nav: "admin" },
  { path: "/admin/desafios", view: adminChallenges, guard: "admin", title: "Gerenciar desafios", nav: "admin-challenges" },
  { path: "/admin/desafios/novo", view: adminChallenges, mode: "new", guard: "admin", title: "Novo desafio", nav: "admin-challenges" },
  { path: "/admin/desafios/:id", view: adminChallenges, mode: "edit", guard: "admin", title: "Editar desafio", nav: "admin-challenges" },
  { path: "/admin/estatisticas", view: adminStatistics, guard: "admin", title: "Estatísticas", nav: "admin-statistics" },
  { path: "/admin/turmas", view: adminClasses, guard: "admin", title: "Turmas", nav: "admin-classes" },
  { path: "/admin/turmas/:id", view: adminClasses, mode: "detail", guard: "admin", title: "Turma", nav: "admin-classes" }
];

const root = $("#app");
let cleanup = null;
let renderToken = 0;

function navLink([key, href, label, iconName], active) {
  const current = key === active;
  return html`<a class="nav-item ${current ? "is-active" : ""}" href="${href}" ${current ? html`aria-current="page"` : ""}>${icon(iconName)}<span>${label}</span></a>`;
}

function themeButton() {
  const theme = getTheme();
  return html`<button class="icon-button" type="button" data-theme-toggle title="${THEME_LABELS[theme]} (clique para trocar)" aria-label="${THEME_LABELS[theme]}: trocar tema">${icon(THEME_ICONS[theme])}</button>`;
}

function searchButton(compact = false) {
  return html`<button class="search-trigger ${compact ? "is-compact" : ""}" type="button" data-palette aria-label="Buscar (Ctrl+K)">${icon("search", 14)}<span>Buscar</span><kbd>Ctrl K</kbd></button>`;
}

function renderShell(session) {
  const user = session.user;
  const { route } = matchRoute(routes, parseLocation().path) ?? {};
  const active = route?.nav;
  document.body.classList.toggle("has-sidebar", Boolean(user));

  if (!user) {
    render($("#sidebar"), "");
    render(
      $("#topbar"),
      html`
        <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true">${icon("code", 14)}</span><span>CodeLab</span></a>
        <nav class="topnav" aria-label="Navegação principal">
          ${[["trilhas", "#/trilhas", "Trilhas"], ["desafios", "#/desafios", "Desafios"], ["ranking", "#/ranking", "Ranking"]].map(
            ([key, href, label]) => html`<a href="${href}" class="${key === active ? "is-active" : ""}">${label}</a>`
          )}
        </nav>
        <div class="topbar-actions">
          ${searchButton(true)}
          ${themeButton()}
          <a class="btn btn-ghost btn-sm" href="#/entrar">Entrar</a>
          <a class="btn btn-primary btn-sm" href="#/cadastro">Criar conta</a>
        </div>
      `
    );
    return;
  }

  const main = [
    ["dashboard", "#/dashboard", "Dashboard", "dashboard"],
    ["trilhas", "#/trilhas", "Trilhas", "route"],
    ["desafios", "#/desafios", "Desafios", "code"],
    ["ranking", "#/ranking", "Ranking", "trophy"],
    ["perfil", "#/perfil", "Perfil", "user"]
  ];
  const admin = [
    ["admin", "#/admin", "Visão geral", "gauge"],
    ["admin-challenges", "#/admin/desafios", "Desafios", "list"],
    ["admin-statistics", "#/admin/estatisticas", "Estatísticas", "chart"],
    ["admin-classes", "#/admin/turmas", "Turmas", "users"]
  ];

  render(
    $("#sidebar"),
    html`
      <a class="brand sidebar-brand" href="#/dashboard"><span class="brand-mark" aria-hidden="true">${icon("code", 14)}</span><span>CodeLab</span></a>
      <div class="sidebar-search">${searchButton()}</div>
      <nav class="nav-section" aria-label="Principal">${main.map((item) => navLink(item, active))}</nav>
      ${user.role === "admin"
        ? html`<nav class="nav-section" aria-label="Administração"><p class="nav-heading">Administração</p>${admin.map((item) => navLink(item, active))}</nav>`
        : ""}
      <div class="sidebar-footer">
        <a class="sidebar-user" href="#/perfil">
          <span class="avatar">${initials(user.name)}</span>
          <span class="sidebar-user-text"><strong>${user.name}</strong><span>${formatNumber(session.score?.totalPoints ?? 0)} pontos</span></span>
        </a>
        ${themeButton()}
        <button id="logout-button" class="icon-button" type="button" title="Sair" aria-label="Sair">${icon("logout")}</button>
      </div>
    `
  );
  render(
    $("#topbar"),
    html`
      <button id="nav-toggle" class="icon-button" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="sidebar">${icon("menu", 18)}</button>
      <a class="brand" href="#/dashboard"><span class="brand-mark" aria-hidden="true">${icon("code", 14)}</span><span>CodeLab</span></a>
      <span class="pill">${formatNumber(session.score?.totalPoints ?? 0)} pts</span>
      <button class="icon-button" type="button" data-palette aria-label="Buscar (Ctrl+K)">${icon("search", 16)}</button>
    `
  );
}

function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
  $("#sidebar-backdrop").hidden = !open;
  $("#nav-toggle")?.setAttribute("aria-expanded", String(open));
}

/** Esqueleto da tela enquanto os dados chegam (evita pular de "Carregando" para o conteúdo). */
function skeleton(workspace) {
  if (workspace) {
    return html`<div class="workspace skeleton-workspace" aria-busy="true" aria-label="Carregando"><div class="skeleton skeleton-panel"></div><div></div><div class="skeleton skeleton-panel"></div></div>`;
  }
  return html`
    <div class="skeleton-page" aria-busy="true" aria-label="Carregando">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-line" style="width: 46%"></div>
      <div class="skeleton-grid">${[0, 1, 2].map(() => html`<div class="skeleton skeleton-card"></div>`)}</div>
      <div class="skeleton skeleton-block"></div>
    </div>
  `;
}

async function route() {
  const token = ++renderToken;
  const { path, query } = parseLocation();
  const match = matchRoute(routes, path) ?? { route: { view: notFound, title: "Página não encontrada" }, params: {} };
  const session = getSession();
  const { route: current, params } = match;

  if (current.guard === "auth" || current.guard === "admin") {
    if (!session.user) {
      navigate(`/entrar?volta=${encodeURIComponent(path)}`);
      return;
    }
    if (current.guard === "admin" && session.user.role !== "admin") {
      toast("Esta área é exclusiva para administradores.", "error");
      navigate("/dashboard");
      return;
    }
  }
  if (current.guard === "guest" && session.user) {
    navigate("/dashboard");
    return;
  }

  if (typeof cleanup === "function") cleanup();
  cleanup = null;
  setSidebarOpen(false);
  root.classList.toggle("is-workspace", Boolean(current.workspace));
  document.title = `${current.title} · CodeLab`;
  renderShell(session);
  // Cada navegação ganha um contêiner próprio: se uma tela anterior terminar
  // de carregar depois, ela pinta num elemento já desanexado.
  const container = document.createElement("div");
  render(container, skeleton(current.workspace));
  root.replaceChildren(container);

  try {
    const result = await current.view.render({ root: container, params, query, mode: current.mode, session, isCurrent: () => token === renderToken });
    if (token !== renderToken) {
      if (typeof result === "function") result();
      return;
    }
    cleanup = result ?? null;
    window.scrollTo(0, 0);
  } catch (error) {
    if (token !== renderToken) return;
    const missing = error?.status === 404;
    render(
      container,
      html`
        <div class="error-page">
          <p class="error-code">${missing ? "404" : error?.status >= 500 ? String(error.status) : "Ops"}</p>
          <h1>${missing ? "Não encontramos esta página" : "Não foi possível carregar esta página"}</h1>
          <p class="lead">${missing ? "O conteúdo pode ter sido removido ou o endereço está incorreto." : error.message}</p>
          <p class="btn-row" style="justify-content: center">
            ${missing ? "" : html`<button class="btn btn-primary" type="button" data-retry>Tentar de novo</button>`}
            <a class="btn" href="#/trilhas">Ver trilhas</a>
            <a class="btn btn-ghost" href="#/">Início</a>
          </p>
        </div>
      `
    );
    container.querySelector("[data-retry]")?.addEventListener("click", route);
  }
}

document.addEventListener("click", async (event) => {
  if (event.target.closest("#logout-button")) {
    await logout();
    toast("Sessão encerrada.");
    navigate("/");
  }
  if (event.target.closest("[data-open-shortcuts]")) {
    openShortcuts();
  }
  if (event.target.closest("[data-palette]")) {
    openPalette();
  }
  if (event.target.closest("[data-theme-toggle]")) {
    const theme = cycleTheme();
    toast(THEME_LABELS[theme]);
    renderShell(getSession());
  }
  if (event.target.closest("#nav-toggle")) {
    setSidebarOpen(!document.body.classList.contains("sidebar-open"));
  }
  if (event.target.closest("#sidebar-backdrop")) {
    setSidebarOpen(false);
  }
});

applyTheme();
installGlobalShortcuts();
onSessionChange((session) => renderShell(session));
window.addEventListener("hashchange", route);

refreshSession()
  .catch(() => toast("A API não respondeu. Algumas telas podem ficar indisponíveis.", "error"))
  .finally(route);
