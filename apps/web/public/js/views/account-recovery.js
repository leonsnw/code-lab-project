import { api } from "../api.js";
import { toast } from "../components/toast.js";
import { $, html, render as paint } from "../dom.js";
import { icon } from "../icons.js";
import { navigate } from "../router.js";
import { refreshSession } from "../session.js";

// Recuperação de senha e verificação de e-mail (links enviados por e-mail).
function shell(title, lead, body) {
  return html`
    <div class="auth-wrap">
      <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true">${icon("code", 14)}</span><span>CodeLab</span></a>
      <h1>${title}</h1>
      <p class="lead">${lead}</p>
      <div id="recovery-message" role="alert" hidden></div>
      ${body}
    </div>
  `;
}

function showMessage(root, text, kind = "error") {
  const box = $("#recovery-message", root);
  box.className = `alert alert-${kind}`;
  box.textContent = text;
  box.hidden = false;
}

export async function render({ root, mode, query }) {
  if (mode === "forgot") {
    paint(
      root,
      shell(
        "Esqueci minha senha",
        "Informe o e-mail da conta. Se ele estiver cadastrado, enviamos um link para criar uma senha nova (vale por 1 hora).",
        html`
          <form id="recovery-form" novalidate>
            <div class="field">
              <label for="recovery-email">E-mail</label>
              <input id="recovery-email" name="email" type="email" autocomplete="email" maxlength="254" required />
            </div>
            <button class="btn btn-primary" type="submit" style="width: 100%">Enviar link</button>
          </form>
          <p class="auth-switch"><a href="#/entrar">Voltar para o login</a></p>
        `
      )
    );
    const form = $("#recovery-form", root);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = form.email.value.trim();
      if (!email) return showMessage(root, "Informe o e-mail.");
      const button = form.querySelector("button");
      button.disabled = true;
      try {
        const { message } = await api.forgotPassword(email);
        showMessage(root, message, "success");
        form.hidden = true;
      } catch (error) {
        showMessage(root, error.message);
        button.disabled = false;
      }
    });
    form.email.focus();
    return;
  }

  const token = query.get("token") ?? "";
  if (mode === "reset") {
    paint(
      root,
      shell(
        "Nova senha",
        "Escolha uma senha nova. Depois de salvar, as sessões abertas em outros aparelhos são encerradas.",
        html`
          <form id="reset-form" novalidate>
            <div class="field">
              <label for="reset-password">Nova senha</label>
              <input id="reset-password" name="password" type="password" autocomplete="new-password" minlength="6" maxlength="72" required />
              <small>Mínimo de 6 caracteres.</small>
            </div>
            <div class="field">
              <label for="reset-confirmation">Confirmar senha</label>
              <input id="reset-confirmation" name="confirmation" type="password" autocomplete="new-password" minlength="6" maxlength="72" required />
            </div>
            <button class="btn btn-primary" type="submit" style="width: 100%">Salvar nova senha</button>
          </form>
        `
      )
    );
    if (!token) showMessage(root, "Link incompleto. Abra o link do e-mail de novo ou peça outro em “Esqueci minha senha”.");
    const form = $("#reset-form", root);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = form.password.value;
      if (password.length < 6) return showMessage(root, "A senha deve ter pelo menos 6 caracteres.");
      if (password !== form.confirmation.value) return showMessage(root, "As senhas não coincidem.");
      const button = form.querySelector("button");
      button.disabled = true;
      try {
        await api.resetPassword(token, password);
        await refreshSession().catch(() => undefined);
        toast("Senha redefinida. Entre com a nova senha.", "success");
        navigate("/entrar");
      } catch (error) {
        showMessage(root, error.message);
        button.disabled = false;
      }
    });
    form.password.focus();
    return;
  }

  // Verificação de e-mail: confirma assim que a página abre.
  paint(root, shell("Verificando seu e-mail", "Só um instante…", html`<div class="skeleton skeleton-line" style="width: 60%"></div>`));
  try {
    await api.verifyEmail(token);
    paint(
      root,
      shell("E-mail verificado", "Pronto: sua conta está protegida e você poderá recuperar a senha por este e-mail.", html`<p class="btn-row"><a class="btn btn-primary" href="#/dashboard">Ir para o dashboard</a></p>`)
    );
    await refreshSession().catch(() => undefined);
  } catch (error) {
    paint(
      root,
      shell(
        "Não foi possível verificar",
        error.message,
        html`<p class="btn-row"><a class="btn btn-primary" href="#/perfil">Pedir um novo link no perfil</a><a class="btn" href="#/">Início</a></p>`
      )
    );
  }
}
