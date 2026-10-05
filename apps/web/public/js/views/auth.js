import { $, html, render as paint } from "../dom.js";
import { icon } from "../icons.js";
import { navigate } from "../router.js";
import { login, register } from "../session.js";
import { toast } from "../components/toast.js";

const DEMO_ACCOUNTS = [
  { label: "Estudante", email: "marina@codelab.local", password: "123456" },
  { label: "Administrador", email: "admin@codelab.local", password: "admin123" }
];

export function render({ root, mode, query }) {
  const isLogin = mode === "login";
  const back = query.get("volta");
  const destination = back && back.startsWith("/") ? back : "/dashboard";

  paint(
    root,
    html`
      <div class="auth-wrap">
        <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true">${icon("code", 14)}</span><span>CodeLab</span></a>
        <h1>${isLogin ? "Entrar" : "Criar conta"}</h1>
        <p class="lead">${isLogin ? "Use seu e-mail e senha para continuar." : "Conta de estudante. Você começa com 0 pontos."}</p>
        <div id="auth-error" class="alert alert-error" role="alert" hidden></div>
        <form id="auth-form" novalidate>
          ${isLogin
            ? ""
            : html`<div class="field">
                <label for="auth-name">Nome</label>
                <input id="auth-name" name="name" type="text" autocomplete="name" maxlength="100" required />
              </div>`}
          <div class="field">
            <label for="auth-email">E-mail</label>
            <input id="auth-email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="voce@exemplo.com" required />
          </div>
          <div class="field">
            <label for="auth-password">Senha</label>
            <input id="auth-password" name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" minlength="${isLogin ? 1 : 6}" maxlength="72" required />
            ${isLogin ? html`<small><a href="#/esqueci-senha">Esqueci minha senha</a></small>` : html`<small>Mínimo de 6 caracteres.</small>`}
          </div>
          ${isLogin
            ? ""
            : html`<div class="field">
                <label for="auth-confirmation">Confirmar senha</label>
                <input id="auth-confirmation" name="confirmation" type="password" autocomplete="new-password" minlength="6" maxlength="72" required />
              </div>`}
          <button class="btn btn-primary" type="submit" style="width: 100%">${isLogin ? "Entrar" : "Criar conta"}</button>
          ${isLogin ? "" : html`<p class="muted small" style="margin: 10px 0 0">Ao criar a conta, você concorda com os <a href="#/termos">Termos de uso</a> e a <a href="#/privacidade">Política de privacidade</a>.</p>`}
        </form>
        <p class="auth-switch">
          ${isLogin
            ? html`Não tem conta? <a href="#/cadastro">Cadastre-se</a>`
            : html`Já tem conta? <a href="#/entrar">Entrar</a>`}
        </p>
        ${isLogin
          ? html`<div class="demo-accounts">
              <p>Contas locais de demonstração</p>
              ${DEMO_ACCOUNTS.map(
                (account, index) => html`<button class="btn btn-sm" type="button" data-demo="${index}"><span>${account.label}</span><span>${account.email}</span></button>`
              )}
            </div>`
          : ""}
      </div>
    `
  );

  const form = $("#auth-form", root);
  const errorBox = $("#auth-error", root);
  const showError = (message) => {
    errorBox.textContent = message;
    errorBox.hidden = false;
  };

  root.querySelectorAll("[data-demo]").forEach((button) => {
    button.addEventListener("click", () => {
      const account = DEMO_ACCOUNTS[Number(button.dataset.demo)];
      form.email.value = account.email;
      form.password.value = account.password;
      form.requestSubmit();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    if (!email || !password) return showError("Preencha e-mail e senha.");
    if (!isLogin) {
      const name = String(data.get("name") ?? "").trim();
      if (!name) return showError("Informe seu nome.");
      if (password.length < 6) return showError("A senha deve ter pelo menos 6 caracteres.");
      if (password !== data.get("confirmation")) return showError("As senhas não coincidem.");
    }

    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    button.textContent = isLogin ? "Entrando..." : "Criando conta...";
    try {
      if (isLogin) await login(email, password);
      else await register(String(data.get("name")).trim(), email, password);
      toast(isLogin ? "Bem-vindo de volta!" : "Conta criada. Bons estudos!", "success");
      navigate(destination);
    } catch (error) {
      showError(error.message);
      button.disabled = false;
      button.textContent = isLogin ? "Entrar" : "Criar conta";
    }
  });

  $(isLogin ? "#auth-email" : "#auth-name", root)?.focus();
}
