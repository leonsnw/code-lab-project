const samples = {
  accepted: `const fs = require("fs");
const input = fs.readFileSync(0, "utf8").trim().split(/\\s+/).map(Number);
const [a, b] = input;
console.log(a + b);`,
  wrong_answer: `console.log(999);`,
  runtime_error: `throw new Error("falha simulada");`,
  timeout: `while (true) {}`
};

const statusLabels = {
  pending: "Aguardando avaliacao",
  accepted: "Aceita",
  wrong_answer: "Resposta errada",
  runtime_error: "Erro de execucao",
  timeout: "Tempo limite excedido"
};

const executionLabels = {
  completed: "Executado",
  runtime_error: "Erro de execucao",
  timeout: "Timeout"
};

const state = {
  selectedSlug: "soma-de-dois-numeros",
  currentUserRole: null
};

const elements = {
  authSection: document.querySelector("#auth-section"),
  authMessage: document.querySelector("#auth-message"),
  loginForm: document.querySelector("#login-form"),
  registerForm: document.querySelector("#register-form"),
  sessionSection: document.querySelector("#session-section"),
  sessionUser: document.querySelector("#session-user"),
  logoutButton: document.querySelector("#logout-button"),
  appContent: document.querySelector("#app-content"),
  userName: document.querySelector("#user-name"),
  userRole: document.querySelector("#user-role"),
  scoreTotal: document.querySelector("#score-total"),
  solvedTotal: document.querySelector("#solved-total"),
  pendingTotal: document.querySelector("#pending-total"),
  difficultyProgress: document.querySelector("#difficulty-progress"),
  challengeSelect: document.querySelector("#challenge-select"),
  loadChallenge: document.querySelector("#load-challenge"),
  challenge: document.querySelector("#challenge"),
  language: document.querySelector("#language"),
  sourceCode: document.querySelector("#source-code"),
  submitSolution: document.querySelector("#submit-solution"),
  resultSummary: document.querySelector("#result-summary"),
  testResults: document.querySelector("#test-results"),
  submissionJson: document.querySelector("#submission-json"),
  history: document.querySelector("#history"),
  historyStatusFilter: document.querySelector("#history-status-filter"),
  historyRefresh: document.querySelector("#history-refresh"),
  ratingSummary: document.querySelector("#rating-summary"),
  ratingForm: document.querySelector("#rating-form"),
  ratingMessage: document.querySelector("#rating-message"),
  commentForm: document.querySelector("#comment-form"),
  commentContent: document.querySelector("#comment-content"),
  commentCount: document.querySelector("#comment-count"),
  commentMessage: document.querySelector("#comment-message"),
  comments: document.querySelector("#comments"),
  adminSection: document.querySelector("#admin-section"),
  adminMessage: document.querySelector("#admin-message"),
  adminChallenges: document.querySelector("#admin-challenges"),
  adminForm: document.querySelector("#admin-challenge-form"),
  adminFormTitle: document.querySelector("#admin-form-title"),
  adminChallengeId: document.querySelector("#admin-challenge-id"),
  adminActiveRow: document.querySelector("#admin-active-row"),
  adminActive: document.querySelector("#admin-active"),
  adminCancel: document.querySelector("#admin-cancel"),
  adminRefreshStatistics: document.querySelector("#admin-refresh-statistics"),
  adminStatisticsGenerated: document.querySelector("#admin-statistics-generated"),
  adminStatisticsOverview: document.querySelector("#admin-statistics-overview"),
  adminStatisticsHighlights: document.querySelector("#admin-statistics-highlights"),
  adminSubmissionStatuses: document.querySelector("#admin-submission-statuses"),
  adminDifficultyStatistics: document.querySelector("#admin-difficulty-statistics"),
  adminChallengeStatistics: document.querySelector("#admin-challenge-statistics"),
  adminUserStatistics: document.querySelector("#admin-user-statistics")
};

async function api(path, options) {
  const headers = {
    "Content-Type": "application/json",
    ...(options?.headers ?? {})
  };
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin"
  });

  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    throw data;
  }
  return data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asJson(value) {
  return JSON.stringify(value, null, 2);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(value));
}

function statusBadge(status) {
  return `<span class="badge ${status}">${statusLabels[status] ?? status}</span>`;
}

async function loadMe() {
  const data = await api("/api/me");
  elements.userName.textContent = data.user.name;
  elements.userRole.textContent = data.user.role;
  elements.scoreTotal.textContent = `${data.score.totalPoints} pts`;
  elements.solvedTotal.textContent = data.progress.solvedChallenges;
  elements.pendingTotal.textContent = data.progress.pendingChallenges;
  elements.difficultyProgress.textContent = data.progress.byDifficulty
    .map(
      (item) =>
        `${item.difficulty}: ${item.solved}/${item.total} (${item.percentage}%)`
    )
    .join(" | ");
  elements.sessionUser.textContent = `${data.user.name} (${data.user.email})`;
  state.currentUserRole = data.user.role;
  elements.adminSection.hidden = data.user.role !== "admin";
}

function saveSession(session) {
  elements.authSection.hidden = true;
  elements.sessionSection.hidden = false;
  elements.appContent.hidden = false;
}

function clearSession() {
  elements.authSection.hidden = false;
  elements.sessionSection.hidden = true;
  elements.appContent.hidden = true;
  elements.adminSection.hidden = true;
  state.currentUserRole = null;
}

function showAuthMessage(message, type = "error") {
  elements.authMessage.className = type === "success" ? "success-box" : "error-box";
  elements.authMessage.textContent = message;
}

async function authenticate(path, payload) {
  const session = await api(path, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  saveSession(session);
  await loadAuthenticatedApp();
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(elements.loginForm);
  showAuthMessage("Validando credenciais...", "success");

  try {
    await authenticate("/api/auth/login", {
      email: formData.get("email"),
      password: formData.get("password")
    });
    elements.loginForm.reset();
  } catch (error) {
    showAuthMessage(error.error ?? "Nao foi possivel entrar.");
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(elements.registerForm);
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");

  if (password !== confirmation) {
    showAuthMessage("As senhas informadas nao coincidem.");
    return;
  }

  showAuthMessage("Criando conta...", "success");
  try {
    await authenticate("/api/auth/register", {
      name: formData.get("name"),
      email: formData.get("email"),
      password
    });
    elements.registerForm.reset();
  } catch (error) {
    showAuthMessage(error.error ?? "Nao foi possivel criar a conta.");
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    clearSession();
    showAuthMessage("Sessao encerrada com sucesso.", "success");
  }
}

async function loadChallenges() {
  const data = await api("/api/challenges");
  elements.challengeSelect.innerHTML = data.challenges
    .map(
      (challenge) =>
        `<option value="${challenge.slug}">${challenge.title} (${challenge.difficulty}, ${challenge.points} pts)</option>`
    )
    .join("");
  if (!data.challenges.some((challenge) => challenge.slug === state.selectedSlug)) {
    state.selectedSlug = data.challenges[0]?.slug ?? "";
  }
  elements.challengeSelect.value = state.selectedSlug;
}

async function loadChallenge() {
  state.selectedSlug = elements.challengeSelect.value;
  if (!state.selectedSlug) {
    elements.challenge.innerHTML = "<p>Nenhum desafio ativo.</p>";
    renderHistory([]);
    return;
  }
  const data = await api(`/api/challenges/${state.selectedSlug}`);
  const challenge = data.challenge;

  elements.challenge.innerHTML = `
    <table>
      <tbody>
        <tr><th>Titulo</th><td>${escapeHtml(challenge.title)}</td></tr>
        <tr><th>Dificuldade</th><td>${escapeHtml(challenge.difficulty)}</td></tr>
        <tr><th>Pontuacao base</th><td>${challenge.points} pts</td></tr>
        <tr><th>Tags</th><td>${challenge.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join(" ")}</td></tr>
      </tbody>
    </table>
    <h3>Enunciado</h3>
    <p>${escapeHtml(challenge.description)}</p>
    <h3>Exemplo publico</h3>
    <table>
      <thead>
        <tr><th>Entrada</th><th>Saida esperada</th></tr>
      </thead>
      <tbody>
        ${challenge.examples
          .map(
            (example) =>
              `<tr><td><pre>${escapeHtml(example.input)}</pre></td><td><pre>${escapeHtml(example.output)}</pre></td></tr>`
          )
          .join("")}
      </tbody>
    </table>
    <h3>Casos de teste publicos</h3>
    ${renderPublicTests(challenge.publicTestCases)}
  `;

  await loadHistory();
  await loadCommunity();
}

async function loadHistory() {
  const status = elements.historyStatusFilter.value;
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await api(`/api/submissions${query}`);
  renderHistory(data.submissions);
}

async function loadCommunity() {
  await Promise.all([loadComments(), loadRating()]);
}

async function loadComments() {
  const data = await api(`/api/challenges/${state.selectedSlug}/comments`);
  if (!data.comments.length) {
    elements.comments.innerHTML = "<p>Nenhum comentario neste desafio.</p>";
    return;
  }

  elements.comments.innerHTML = data.comments
    .map(
      (comment) => `
        <article class="comment">
          <p><strong>${escapeHtml(comment.author.name)}</strong></p>
          <p>${escapeHtml(comment.content)}</p>
          <small>${formatDate(comment.createdAt)}</small>
        </article>
      `
    )
    .join("");
}

async function addComment(event) {
  event.preventDefault();
  const content = elements.commentContent.value.trim();
  if (!content) {
    showCommunityMessage(
      elements.commentMessage,
      "Escreva um comentario antes de enviar.",
      "error"
    );
    return;
  }

  showCommunityMessage(elements.commentMessage, "Salvando comentario...", "success");
  try {
    await api(`/api/challenges/${state.selectedSlug}/comments`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    elements.commentForm.reset();
    updateCommentCount();
    showCommunityMessage(
      elements.commentMessage,
      "Comentario publicado.",
      "success"
    );
    await loadComments();
  } catch (error) {
    showCommunityMessage(
      elements.commentMessage,
      error.error ?? "Nao foi possivel publicar o comentario.",
      "error"
    );
  }
}

async function loadRating() {
  const data = await api(`/api/challenges/${state.selectedSlug}/rating`);
  renderRating(data.summary);
}

function renderRating(summary) {
  const average = Number(summary.average).toFixed(1);
  elements.ratingSummary.className = "summary";
  elements.ratingSummary.innerHTML = `
    <strong>Media:</strong> ${average}/5 |
    <strong>Avaliacoes:</strong> ${summary.total} |
    <strong>Sua nota:</strong> ${summary.currentUserValue ?? "ainda nao avaliado"}
  `;
  elements.ratingForm.querySelectorAll('input[name="value"]').forEach((input) => {
    input.checked = Number(input.value) === summary.currentUserValue;
  });
}

async function rateChallenge(event) {
  event.preventDefault();
  const formData = new FormData(elements.ratingForm);
  const value = Number(formData.get("value"));

  showCommunityMessage(elements.ratingMessage, "Salvando avaliacao...", "success");
  try {
    const data = await api(`/api/challenges/${state.selectedSlug}/rating`, {
      method: "PUT",
      body: JSON.stringify({ value })
    });
    renderRating(data.summary);
    showCommunityMessage(elements.ratingMessage, "Avaliacao salva.", "success");
  } catch (error) {
    showCommunityMessage(
      elements.ratingMessage,
      error.error ?? "Nao foi possivel salvar a avaliacao.",
      "error"
    );
  }
}

function updateCommentCount() {
  elements.commentCount.textContent = elements.commentContent.value.length;
}

function showCommunityMessage(element, message, type) {
  element.className = type === "success" ? "success-box" : "error-box";
  element.textContent = message;
}

async function loadAdminChallenges() {
  const data = await api("/api/admin/challenges");
  if (!data.challenges.length) {
    elements.adminChallenges.innerHTML = "<p>Nenhum desafio cadastrado.</p>";
    return;
  }

  elements.adminChallenges.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Titulo</th>
          <th>Slug</th>
          <th>Dificuldade</th>
          <th>Pontos</th>
          <th>Casos</th>
          <th>Status</th>
          <th>Acoes</th>
        </tr>
      </thead>
      <tbody>
        ${data.challenges
          .map(
            (challenge) => `
              <tr>
                <td>${escapeHtml(challenge.title)}</td>
                <td>${escapeHtml(challenge.slug)}</td>
                <td>${escapeHtml(challenge.difficulty)}</td>
                <td>${challenge.points}</td>
                <td>${challenge.testCases.length}</td>
                <td>${challenge.isActive ? "Ativo" : "Inativo"}</td>
                <td>
                  <button type="button" data-admin-edit="${escapeHtml(challenge.id)}">Editar</button>
                  <button type="button" data-admin-remove="${escapeHtml(challenge.id)}" ${challenge.isActive ? "" : "disabled"}>Remover</button>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function loadAdminStatistics() {
  const data = await api("/api/admin/statistics");
  const overview = data.overview;
  elements.adminStatisticsGenerated.textContent = `Gerado em ${formatDate(data.generatedAt)}`;
  elements.adminStatisticsOverview.innerHTML = `
    <table>
      <tbody>
        <tr><th>Usuarios</th><td>${overview.totalUsers}</td><th>Estudantes</th><td>${overview.totalStudents}</td><th>Administradores</th><td>${overview.totalAdmins}</td></tr>
        <tr><th>Desafios</th><td>${overview.totalChallenges}</td><th>Ativos</th><td>${overview.activeChallenges}</td><th>Inativos</th><td>${overview.inactiveChallenges}</td></tr>
        <tr><th>Submissoes</th><td>${overview.totalSubmissions}</td><th>Aceitas</th><td>${overview.acceptedSubmissions}</td><th>Taxa de aceite</th><td>${overview.acceptanceRate}%</td></tr>
        <tr><th>Comentarios</th><td>${overview.totalComments}</td><th>Avaliacoes</th><td>${overview.totalRatings}</td><th>Media geral</th><td>${Number(overview.averageRating).toFixed(1)}/5</td></tr>
      </tbody>
    </table>
  `;
  const mostSolved = data.highlights.mostSolvedChallenge;
  const highestError = data.highlights.highestErrorRateChallenge;
  elements.adminStatisticsHighlights.innerHTML = `
    <table>
      <tbody>
        <tr>
          <th>Mais resolvido</th>
          <td>${mostSolved ? `${escapeHtml(mostSolved.title)} (${mostSolved.solvers} solucionadores)` : "Sem dados"}</td>
        </tr>
        <tr>
          <th>Maior taxa de erro</th>
          <td>${highestError ? `${escapeHtml(highestError.title)} (${highestError.errorRate}%)` : "Sem dados"}</td>
        </tr>
      </tbody>
    </table>
  `;
  elements.adminSubmissionStatuses.innerHTML = `
    <table>
      <thead><tr><th>Status</th><th>Quantidade</th></tr></thead>
      <tbody>
        ${Object.entries(data.submissionStatuses)
          .map(
            ([status, total]) =>
              `<tr><td>${escapeHtml(statusLabels[status] ?? status)}</td><td>${total}</td></tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
  elements.adminDifficultyStatistics.innerHTML = `
    <table>
      <thead>
        <tr><th>Dificuldade</th><th>Desafios</th><th>Tentativas</th><th>Aceitas</th><th>Taxa</th><th>Participantes</th><th>Solucionadores</th></tr>
      </thead>
      <tbody>
        ${data.difficulties
          .map(
            (difficulty) => `
              <tr>
                <td>${escapeHtml(difficulty.difficulty)}</td>
                <td>${difficulty.totalChallenges}</td>
                <td>${difficulty.totalSubmissions}</td>
                <td>${difficulty.acceptedSubmissions}</td>
                <td>${difficulty.acceptanceRate}%</td>
                <td>${difficulty.participants}</td>
                <td>${difficulty.solvers}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
  elements.adminChallengeStatistics.innerHTML = data.challenges.length
    ? `
      <table>
        <thead>
          <tr>
            <th>Desafio</th><th>Status</th><th>Tentativas</th><th>Aceitas</th>
            <th>Taxa de aceite</th><th>Taxa de erro</th><th>Participantes</th><th>Solucionadores</th>
            <th>Comentarios</th><th>Avaliacao</th>
          </tr>
        </thead>
        <tbody>
          ${data.challenges
            .map(
              (challenge) => `
                <tr>
                  <td>${escapeHtml(challenge.title)}</td>
                  <td>${challenge.isActive ? "Ativo" : "Inativo"}</td>
                  <td>${challenge.totalSubmissions}</td>
                  <td>${challenge.acceptedSubmissions}</td>
                  <td>${challenge.acceptanceRate}%</td>
                  <td>${challenge.errorRate}%</td>
                  <td>${challenge.participants}</td>
                  <td>${challenge.solvers}</td>
                  <td>${challenge.totalComments}</td>
                  <td>${Number(challenge.averageRating).toFixed(1)}/5 (${challenge.totalRatings})</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `
    : "<p>Nenhum desafio disponivel para analise.</p>";
  elements.adminUserStatistics.innerHTML = data.users.length
    ? `
      <table>
        <thead>
          <tr><th>Usuario</th><th>Papel</th><th>Pontos</th><th>Tentativas</th><th>Aceitas</th><th>Taxa</th><th>Resolvidos</th></tr>
        </thead>
        <tbody>
          ${data.users
            .map(
              (user) => `
                <tr>
                  <td>${escapeHtml(user.name)}</td>
                  <td>${escapeHtml(user.role)}</td>
                  <td>${user.totalPoints}</td>
                  <td>${user.totalSubmissions}</td>
                  <td>${user.acceptedSubmissions}</td>
                  <td>${user.acceptanceRate}%</td>
                  <td>${user.solvedChallenges}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `
    : "<p>Nenhum usuario cadastrado.</p>";
}

async function editAdminChallenge(challengeId) {
  try {
    const data = await api(`/api/admin/challenges/${challengeId}`);
    const challenge = data.challenge;
    elements.adminChallengeId.value = challenge.id;
    elements.adminForm.elements.title.value = challenge.title;
    elements.adminForm.elements.slug.value = challenge.slug;
    elements.adminForm.elements.description.value = challenge.description;
    elements.adminForm.elements.difficulty.value = challenge.difficulty;
    elements.adminForm.elements.points.value = challenge.points;
    elements.adminForm.elements.tags.value = challenge.tags.join(", ");
    elements.adminForm.elements.constraints.value = challenge.constraints.join("\n");
    elements.adminForm.elements.examples.value = asJson(challenge.examples);
    elements.adminForm.elements.testCases.value = asJson(
      challenge.testCases.map(({ input, expectedOutput, isPublic, weight }) => ({
        input,
        expectedOutput,
        isPublic,
        weight
      }))
    );

    elements.adminActive.checked = challenge.isActive;
    elements.adminActiveRow.hidden = false;
    elements.adminFormTitle.textContent = `Editar: ${challenge.title}`;
    showAdminMessage("Desafio carregado para edicao.", "success");
    elements.adminForm.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showAdminMessage(error.error ?? "Nao foi possivel carregar o desafio.", "error");
  }
}

async function saveAdminChallenge(event) {
  event.preventDefault();
  const form = new FormData(elements.adminForm);
  const challengeId = String(form.get("challengeId") ?? "");

  try {
    const payload = {
      title: form.get("title"),
      slug: form.get("slug"),
      description: form.get("description"),
      difficulty: form.get("difficulty"),
      points: Number(form.get("points")),
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      constraints: String(form.get("constraints") ?? "")
        .split("\n")
        .map((constraint) => constraint.trim())
        .filter(Boolean),
      examples: JSON.parse(String(form.get("examples") ?? "[]")),
      testCases: JSON.parse(String(form.get("testCases") ?? "[]")),
      ...(challengeId ? { isActive: elements.adminActive.checked } : {})
    };
    const data = await api(
      challengeId
        ? `/api/admin/challenges/${challengeId}`
        : "/api/admin/challenges",
      {
        method: challengeId ? "PUT" : "POST",
        body: JSON.stringify(payload)
      }
    );
    resetAdminForm();
    showAdminMessage(`Desafio "${data.challenge.title}" salvo.`, "success");
    await Promise.all([
      loadAdminChallenges(),
      loadAdminStatistics(),
      loadChallenges()
    ]);
    await loadChallenge();
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "O JSON de exemplos ou casos de teste e invalido."
        : error.error ?? "Nao foi possivel salvar o desafio.";
    showAdminMessage(message, "error");
  }
}

async function removeAdminChallenge(challengeId) {
  if (!window.confirm("Remover este desafio do catalogo?")) {
    return;
  }
  try {
    const data = await api(`/api/admin/challenges/${challengeId}`, {
      method: "DELETE"
    });
    showAdminMessage(data.message, "success");
    resetAdminForm();
    await Promise.all([
      loadAdminChallenges(),
      loadAdminStatistics(),
      loadChallenges()
    ]);
    await loadChallenge();
  } catch (error) {
    showAdminMessage(error.error ?? "Nao foi possivel remover o desafio.", "error");
  }
}

function resetAdminForm() {
  elements.adminForm.reset();
  elements.adminChallengeId.value = "";
  elements.adminFormTitle.textContent = "Novo desafio";
  elements.adminActiveRow.hidden = true;
  elements.adminForm.elements.points.value = 100;
  elements.adminForm.elements.tags.value = "Logica, Iniciante";
  elements.adminForm.elements.examples.value = '[\n  { "input": "1 2", "output": "3" }\n]';
  elements.adminForm.elements.testCases.value = '[\n  {\n    "input": "1 2",\n    "expectedOutput": "3",\n    "isPublic": true,\n    "weight": 1\n  }\n]';
}

function showAdminMessage(message, type) {
  elements.adminMessage.className = type === "success" ? "success-box" : "error-box";
  elements.adminMessage.textContent = message;
}

function renderPublicTests(testCases) {
  if (!testCases.length) {
    return "<p>Nenhum caso publico cadastrado.</p>";
  }

  return `
    <table>
      <thead>
        <tr><th>ID</th><th>Entrada</th><th>Saida esperada</th></tr>
      </thead>
      <tbody>
        ${testCases
          .map(
            (testCase) => `
              <tr>
                <td>${escapeHtml(testCase.id)}</td>
                <td><pre>${escapeHtml(testCase.input)}</pre></td>
                <td><pre>${escapeHtml(testCase.expectedOutput)}</pre></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function submitSolution() {
  elements.resultSummary.className = "empty";
  elements.resultSummary.textContent = "Enviando e avaliando...";
  elements.testResults.innerHTML = "";

  try {
    const data = await api(`/api/challenges/${state.selectedSlug}/submissions`, {
      method: "POST",
      body: JSON.stringify({
        language: elements.language.value,
        sourceCode: elements.sourceCode.value
      })
    });

    renderSubmissionResult(data);
    await loadMe();
    await loadChallenge();
  } catch (error) {
    elements.resultSummary.className = "error-box";
    elements.resultSummary.textContent = error.error ?? "Erro ao enviar solucao.";
    elements.submissionJson.textContent = asJson(error);
  }
}

function renderSubmissionResult(data) {
  const submission = data.submission;
  const feedback = submission.feedback;

  elements.resultSummary.className = `summary ${submission.status}`;
  elements.resultSummary.innerHTML = `
    <p><strong>${escapeHtml(feedback.message)}</strong></p>
    <table>
      <tbody>
        <tr><th>Status</th><td>${statusBadge(submission.status)}</td></tr>
        <tr><th>Casos publicos aprovados</th><td>${feedback.publicTestsPassed}/${feedback.publicTestsTotal}</td></tr>
        ${feedback.hiddenTestsPresent ? `<tr><th>Casos ocultos</th><td>${feedback.hiddenTestsFailed ? "Um ou mais falharam" : "Aprovados"}</td></tr>` : ""}
        <tr><th>Pontos nesta submissao</th><td>${submission.scoreAwarded}</td></tr>
        <tr><th>Pontuacao total</th><td>${data.score.totalPoints}</td></tr>
        <tr><th>Enviada em</th><td>${formatDate(submission.submittedAt)}</td></tr>
      </tbody>
    </table>
  `;

  elements.testResults.innerHTML = renderTestResults(submission.testResults);
  elements.submissionJson.textContent = asJson(data);
}

function renderTestResults(testResults) {
  if (!testResults.length) {
    return "<p>Nenhum caso publico para detalhar. O resultado dos casos ocultos permanece protegido.</p>";
  }

  return `
    <h3>Casos publicos avaliados</h3>
    <table>
      <thead>
        <tr>
          <th>Tipo</th>
          <th>Execucao</th>
          <th>Passou?</th>
          <th>Entrada</th>
          <th>Esperado</th>
          <th>Recebido</th>
          <th>Tempo</th>
        </tr>
      </thead>
      <tbody>
        ${testResults
          .map(
            (test) => `
              <tr class="${test.passed ? "passed" : "failed"}">
                <td>Publico</td>
                <td>${executionLabels[test.executionStatus] ?? test.executionStatus}</td>
                <td>${test.passed ? "Sim" : "Nao"}</td>
                <td><pre>${escapeHtml(test.input)}</pre></td>
                <td><pre>${escapeHtml(test.expectedOutput)}</pre></td>
                <td><pre>${escapeHtml(test.actualOutput || test.error || "")}</pre></td>
                <td>${test.durationMs} ms</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderHistory(submissions) {
  if (!submissions.length) {
    elements.history.innerHTML = "<p>Nenhuma submissao para este desafio.</p>";
    return;
  }

  elements.history.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Status</th>
          <th>Pontos</th>
          <th>Testes</th>
        </tr>
      </thead>
      <tbody>
        ${submissions
          .map((submission) => {
            const feedback = submission.feedback;
            return `
              <tr>
                <td>${formatDate(submission.submittedAt)}</td>
                <td>${statusBadge(submission.status)}</td>
                <td>${submission.scoreAwarded}</td>
                <td>${feedback.publicTestsPassed}/${feedback.publicTestsTotal}${feedback.hiddenTestsPresent ? " + ocultos" : ""}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

document.querySelectorAll("[data-sample]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.sourceCode.value = samples[button.dataset.sample];
  });
});

elements.sourceCode.value = samples.accepted;
elements.loginForm.addEventListener("submit", handleLogin);
elements.registerForm.addEventListener("submit", handleRegister);
elements.logoutButton.addEventListener("click", logout);
elements.loadChallenge.addEventListener("click", loadChallenge);
elements.historyStatusFilter.addEventListener("change", loadHistory);
elements.historyRefresh.addEventListener("click", loadHistory);
elements.submitSolution.addEventListener("click", submitSolution);
elements.ratingForm.addEventListener("submit", rateChallenge);
elements.commentForm.addEventListener("submit", addComment);
elements.commentContent.addEventListener("input", updateCommentCount);
elements.adminForm.addEventListener("submit", saveAdminChallenge);
elements.adminCancel.addEventListener("click", resetAdminForm);
elements.adminRefreshStatistics.addEventListener("click", loadAdminStatistics);
elements.adminChallenges.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button?.dataset.adminEdit) {
    editAdminChallenge(button.dataset.adminEdit);
  }
  if (button?.dataset.adminRemove) {
    removeAdminChallenge(button.dataset.adminRemove);
  }
});

async function loadAuthenticatedApp() {
  await Promise.all([loadMe(), loadChallenges()]);
  await loadChallenge();
  if (state.currentUserRole === "admin") {
    await Promise.all([loadAdminChallenges(), loadAdminStatistics()]);
  }
}

async function bootstrap() {
  try {
    await loadAuthenticatedApp();
    saveSession();
  } catch (error) {
    clearSession();
    showAuthMessage(error.error ?? "Sua sessao expirou. Entre novamente.");
  }
}

bootstrap();
