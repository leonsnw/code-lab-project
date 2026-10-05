import { api } from "../api.js";
import { $, html, render } from "../dom.js";
import { navigate } from "../router.js";
import { logout, refreshSession } from "../session.js";
import { toast } from "./toast.js";

// Configurações da conta no perfil: nome, senha, e-mail, turmas e LGPD.
export async function mountAccountSettings(target, user) {
  const [{ account }, { classes }] = await Promise.all([api.account(), api.myClasses().catch(() => ({ classes: [] }))]);
  render(
    target,
    html`
      <section class="card" id="account-card">
        <h2>Conta</h2>
        ${account.emailVerified
          ? html`<p class="muted small" style="margin: 0 0 12px">E-mail <strong>${user.email}</strong> verificado.</p>`
          : html`<div class="alert alert-warning" style="margin: 0 0 12px">
              E-mail ainda não verificado: sem ele você não consegue recuperar a senha.
              <button id="resend-verification" class="btn btn-sm" type="button" style="margin-top: 6px">Reenviar link</button>
            </div>`}
        <form id="name-form" class="stack-form">
          <div class="field">
            <label for="profile-name">Nome</label>
            <input id="profile-name" name="name" class="input" maxlength="100" value="${user.name}" required />
          </div>
          <button class="btn btn-sm" type="submit">Salvar nome</button>
        </form>
        <details class="settings-details">
          <summary>Trocar senha</summary>
          <form id="password-form" class="stack-form">
            <div class="field"><label for="current-password">Senha atual</label><input id="current-password" name="current" type="password" autocomplete="current-password" class="input" required /></div>
            <div class="field"><label for="new-password">Nova senha</label><input id="new-password" name="next" type="password" autocomplete="new-password" minlength="6" maxlength="72" class="input" required /><small>Mínimo de 6 caracteres. As sessões em outros aparelhos serão encerradas.</small></div>
            <button class="btn btn-sm" type="submit">Trocar senha</button>
          </form>
        </details>
      </section>

      <section class="card">
        <h2>Turmas</h2>
        ${classes.length
          ? html`<ul class="class-list">${classes.map(
              (item) => html`<li><span><strong>${item.name}</strong><span class="muted small"> · ${item.ownerName}</span></span><button class="btn btn-sm btn-ghost" type="button" data-leave="${item.id}" data-name="${item.name}">Sair</button></li>`
            )}</ul>`
          : html`<p class="muted small" style="margin: 0 0 10px">Você não está em nenhuma turma.</p>`}
        <form id="join-form" class="inline-form">
          <label class="sr-only" for="class-code">Código da turma</label>
          <input id="class-code" name="code" class="input mono" maxlength="6" placeholder="Código (6 caracteres)" autocomplete="off" style="text-transform: uppercase" required />
          <button class="btn btn-sm" type="submit">Entrar na turma</button>
        </form>
        <p class="muted small" style="margin: 8px 0 0">O professor da turma vê seu nome, e-mail e progresso.</p>
      </section>

      <section class="card">
        <h2>Seus dados</h2>
        <p class="muted small" style="margin: 0 0 10px">Direitos da LGPD: baixe tudo o que guardamos sobre você ou apague a conta. <a href="#/privacidade">Política de privacidade</a>.</p>
        <div class="btn-row">
          <button id="export-data" class="btn btn-sm" type="button">Baixar meus dados (JSON)</button>
        </div>
        <details class="settings-details danger-zone">
          <summary>Excluir conta</summary>
          <form id="delete-form" class="stack-form">
            <p class="small" style="margin: 0">Apaga para sempre a conta, as submissões, os comentários, as avaliações e o progresso. Não dá para desfazer.</p>
            <div class="field"><label for="delete-password">Confirme com a sua senha</label><input id="delete-password" name="password" type="password" autocomplete="current-password" class="input" required /></div>
            <button class="btn btn-sm btn-danger" type="submit">Excluir minha conta</button>
          </form>
        </details>
      </section>
    `
  );

  $("#resend-verification", target)?.addEventListener("click", async (event) => {
    event.target.disabled = true;
    try {
      toast((await api.resendVerification()).message, "success");
    } catch (error) {
      toast(error.message, "error");
      event.target.disabled = false;
    }
  });

  $("#name-form", target).addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.updateProfile(event.target.name.value);
      await refreshSession();
      toast("Nome atualizado.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#password-form", target).addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
      toast((await api.changePassword(form.current.value, form.next.value)).message, "success");
      form.reset();
      form.closest("details").open = false;
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#join-form", target).addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      toast((await api.joinClass(event.target.code.value.trim().toUpperCase())).message, "success");
      mountAccountSettings(target, user);
    } catch (error) {
      toast(error.message, "error");
    }
  });

  target.querySelectorAll("[data-leave]").forEach((button) =>
    button.addEventListener("click", async () => {
      if (!window.confirm(`Sair da turma ${button.dataset.name}?`)) return;
      await api.leaveClass(button.dataset.leave);
      toast("Você saiu da turma.");
      mountAccountSettings(target, user);
    })
  );

  $("#export-data", target).addEventListener("click", async () => {
    try {
      const data = await api.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = Object.assign(document.createElement("a"), { href: url, download: "codelab-meus-dados.json" });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#delete-form", target).addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!window.confirm("Última confirmação: apagar a conta e todos os dados?")) return;
    try {
      await api.deleteAccount(event.target.password.value);
      await logout().catch(() => undefined);
      toast("Conta apagada. Obrigado por estudar com a gente.");
      navigate("/");
    } catch (error) {
      toast(error.message, "error");
    }
  });
}
