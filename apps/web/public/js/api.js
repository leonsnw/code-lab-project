export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError("Não foi possível conectar à API. Verifique se o servidor está em execução.", 0);
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(data?.error ?? `Erro ${response.status} ao chamar a API.`, response.status);
  }
  return data;
}

const encode = encodeURIComponent;

export const api = {
  me: () => request("/api/me"),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (name, email, password) =>
    request("/api/auth/register", { method: "POST", body: { name, email, password } }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  forgotPassword: (email) => request("/api/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, password) => request("/api/auth/reset-password", { method: "POST", body: { token, password } }),
  verifyEmail: (token) => request("/api/auth/verify-email", { method: "POST", body: { token } }),
  resendVerification: () => request("/api/me/verification", { method: "POST" }),
  account: () => request("/api/me/account"),
  updateProfile: (name) => request("/api/me", { method: "PATCH", body: { name } }),
  changePassword: (currentPassword, newPassword) => request("/api/me/password", { method: "PUT", body: { currentPassword, newPassword } }),
  exportData: () => request("/api/me/export"),
  deleteAccount: (password) => request("/api/me", { method: "DELETE", body: { password } }),
  joinClass: (code) => request("/api/classes/join", { method: "POST", body: { code } }),
  myClasses: () => request("/api/me/classes"),
  leaveClass: (id) => request(`/api/me/classes/${encode(id)}`, { method: "DELETE" }),

  challenges: (difficulty) =>
    request(`/api/challenges${difficulty ? `?difficulty=${encode(difficulty)}` : ""}`),
  challenge: (slug) => request(`/api/challenges/${encode(slug)}`),
  run: (slug, language, sourceCode, customInput) =>
    request(`/api/challenges/${encode(slug)}/run`, {
      method: "POST",
      body: { language, sourceCode, customInput }
    }),
  submit: (slug, language, sourceCode) =>
    request(`/api/challenges/${encode(slug)}/submissions`, {
      method: "POST",
      body: { language, sourceCode }
    }),
  revealHint: (slug) => request(`/api/challenges/${encode(slug)}/hints`, { method: "POST" }),
  revealSolution: (slug) => request(`/api/challenges/${encode(slug)}/solution`, { method: "POST" }),
  tracks: () => request("/api/tracks"),
  trackProgress: () => request("/api/tracks/progress"),
  lesson: (slug) => request(`/api/lessons/${encode(slug)}`),
  completeLesson: (slug) => request(`/api/lessons/${encode(slug)}/complete`, { method: "POST" }),
  submissions: (status) => request(`/api/submissions${status ? `?status=${encode(status)}` : ""}`),

  comments: (slug) => request(`/api/challenges/${encode(slug)}/comments`),
  addComment: (slug, content) =>
    request(`/api/challenges/${encode(slug)}/comments`, { method: "POST", body: { content } }),
  rating: (slug) => request(`/api/challenges/${encode(slug)}/rating`),
  rate: (slug, value) => request(`/api/challenges/${encode(slug)}/rating`, { method: "PUT", body: { value } }),

  ranking: ({ period, track } = {}) => {
    const query = new URLSearchParams();
    if (period && period !== "tudo") query.set("periodo", period);
    if (track) query.set("trilha", track);
    const text = query.toString();
    return request(`/api/ranking${text ? `?${text}` : ""}`);
  },
  runtime: (slug, language, ms) =>
    request(`/api/challenges/${encode(slug)}/runtime?language=${encode(language)}${ms === null || ms === undefined ? "" : `&ms=${encode(ms)}`}`),
  activity: () => request("/api/me/activity"),
  profile: (userId) => request(`/api/users/${encode(userId)}/profile`),

  admin: {
    challenges: () => request("/api/admin/challenges"),
    challenge: (id) => request(`/api/admin/challenges/${encode(id)}`),
    create: (payload) => request("/api/admin/challenges", { method: "POST", body: payload }),
    update: (id, payload) => request(`/api/admin/challenges/${encode(id)}`, { method: "PUT", body: payload }),
    remove: (id) => request(`/api/admin/challenges/${encode(id)}`, { method: "DELETE" }),
    statistics: () => request("/api/admin/statistics"),
    validate: (challenge, solutions) => request("/api/admin/challenges/validate", { method: "POST", body: { challenge, solutions } }),
    generateCases: (payload) => request("/api/admin/challenges/generate-cases", { method: "POST", body: payload }),
    classes: () => request("/api/admin/classes"),
    createClass: (name) => request("/api/admin/classes", { method: "POST", body: { name } }),
    classReport: (id) => request(`/api/admin/classes/${encode(id)}`),
    deleteClass: (id) => request(`/api/admin/classes/${encode(id)}`, { method: "DELETE" }),
    removeClassMember: (id, userId) => request(`/api/admin/classes/${encode(id)}/members/${encode(userId)}`, { method: "DELETE" }),
    classCsvUrl: (id) => `/api/admin/classes/${encode(id)}/export.csv`
  }
};
