import { api, ApiError } from "./api.js";

// Estado da sessão compartilhado pelas telas: usuário, pontuação e progresso.
const listeners = new Set();
let current = { user: null, score: null, progress: null, loaded: false };

export function getSession() {
  return current;
}

export function onSessionChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next) {
  current = { ...next, loaded: true };
  listeners.forEach((listener) => listener(current));
}

export async function refreshSession() {
  try {
    const data = await api.me();
    publish({ user: data.user, score: data.score, progress: data.progress });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    publish({ user: null, score: null, progress: null });
  }
  return current;
}

export async function login(email, password) {
  await api.login(email, password);
  return refreshSession();
}

export async function register(name, email, password) {
  await api.register(name, email, password);
  return refreshSession();
}

export async function logout() {
  try {
    await api.logout();
  } finally {
    publish({ user: null, score: null, progress: null });
  }
}

export function isSolved(challengeId) {
  return Boolean(current.score?.solvedChallengeIds?.includes(challengeId));
}
