// Tema claro/escuro. "system" segue o sistema operacional; a escolha fica
// salva neste navegador (é só uma preferência de exibição).
const KEY = "codelab-theme";
const ORDER = ["system", "light", "dark"];
export const THEME_LABELS = { system: "Tema do sistema", light: "Tema claro", dark: "Tema escuro" };
export const THEME_ICONS = { system: "monitor", light: "sun", dark: "moon" };

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    return ORDER.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme = getTheme()) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Sem armazenamento (janela privada): vale só para esta página.
  }
  applyTheme(theme);
}

export function cycleTheme() {
  const next = ORDER[(ORDER.indexOf(getTheme()) + 1) % ORDER.length];
  setTheme(next);
  return next;
}
