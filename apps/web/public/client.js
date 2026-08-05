const elements = {
  authSection: document.querySelector("#auth-section"),
  authMessage: document.querySelector("#auth-message"),
  loginForm: document.querySelector("#login-form"),
  registerForm: document.querySelector("#register-form"),
  sessionSection: document.querySelector("#session-section"),
  logoutButton: document.querySelector("#logout-button"),
  userId: document.querySelector("#user-id"),
  userName: document.querySelector("#user-name"),
  userEmail: document.querySelector("#user-email"),
  userRole: document.querySelector("#user-role")
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw data;
  return data;
}

function showMessage(message, type = "") {
  elements.authMessage.className = `message ${type}`.trim();
  elements.authMessage.textContent = message;
}

function showUser(user) {
  elements.userId.textContent = user.id;
  elements.userName.textContent = user.name;
  elements.userEmail.textContent = user.email;
  elements.userRole.textContent = user.role;
  elements.authSection.hidden = true;
  elements.sessionSection.hidden = false;
}

function showAuthentication() {
  elements.authSection.hidden = false;
  elements.sessionSection.hidden = true;
}

async function loadSession() {
  const data = await api("/api/me");
  showUser(data.user);
}

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.loginForm);
  showMessage("Validando credenciais...", "success");
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
    });
    elements.loginForm.reset();
    showUser(data.user);
  } catch (error) {
    showMessage(error.error ?? "Nao foi possivel entrar.", "error");
  }
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(elements.registerForm);
  const password = String(form.get("password") ?? "");
  if (password !== form.get("confirmation")) {
    showMessage("As senhas nao coincidem.", "error");
    return;
  }
  showMessage("Criando conta...", "success");
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password
      })
    });
    elements.registerForm.reset();
    showUser(data.user);
  } catch (error) {
    showMessage(error.error ?? "Nao foi possivel criar a conta.", "error");
  }
});

elements.logoutButton.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    showAuthentication();
    showMessage("Sessao encerrada.", "success");
  }
});

loadSession().catch(() => showAuthentication());
