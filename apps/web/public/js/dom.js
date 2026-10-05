// Template HTML com escape automático: toda interpolação é escapada, exceto
// valores já produzidos por `html` (SafeHtml). Evita XSS em nomes e comentários.
class SafeHtml {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderValue(value) {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join("");
  // Booleanos viram "true"/"false" para funcionar em atributos ARIA.
  if (value === null || value === undefined) return "";
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let output = strings[0];
  values.forEach((value, index) => {
    output += renderValue(value) + strings[index + 1];
  });
  return new SafeHtml(output);
}

export function raw(value) {
  return new SafeHtml(value);
}

export function render(target, content) {
  target.innerHTML = renderValue(content);
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

// ---------- Rótulos e formatação ----------
export const DIFFICULTY_LABELS = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil"
};

export const STATUS_LABELS = {
  accepted: "Aceito",
  wrong_answer: "Resposta errada",
  runtime_error: "Erro de execução",
  timeout: "Tempo limite excedido",
  compile_error: "Erro de compilação",
  rule_violation: "Regra não atendida",
  internal_error: "Falha na avaliação",
  pending: "Aguardando"
};

const numberFormat = new Intl.NumberFormat("pt-BR");
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short"
});

export function formatNumber(value) {
  return numberFormat.format(Number(value ?? 0));
}

export function formatDateTime(value) {
  if (!value) return "—";
  return dateTimeFormat.format(new Date(value));
}

export function formatRelative(value) {
  if (!value) return "—";
  const diffSeconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (diffSeconds < 60) return "agora mesmo";
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  return formatDateTime(value);
}

export function formatPercent(value) {
  return `${formatNumber(Math.round(Number(value ?? 0) * 10) / 10)}%`;
}

export const LANGUAGE_LABELS = {
  javascript: "JavaScript",
  python: "Python",
  c: "C"
};

export function languagePill(language) {
  return html`<span class="pill pill-language">${LANGUAGE_LABELS[language] ?? language}</span>`;
}

// A descrição pode começar pelo enunciado original; o último parágrafo resume o desafio.
export function challengeSummary(challenge) {
  return String(challenge.description ?? "").split("\n").filter(Boolean).at(-1) ?? "";
}

export function difficultyPill(difficulty) {
  return html`<span class="pill difficulty-${difficulty}">${DIFFICULTY_LABELS[difficulty] ?? difficulty}</span>`;
}

export function statusPill(status) {
  return html`<span class="pill status-${status}">${STATUS_LABELS[status] ?? status}</span>`;
}

export function initials(name) {
  return String(name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function meter(label, value, total) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  return html`
    <div class="meter">
      <div class="meter-label"><span>${label}</span><span>${value}/${total} · ${percentage}%</span></div>
      <div class="meter-track" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${value}">
        <div class="meter-fill" style="width: ${percentage}%"></div>
      </div>
    </div>
  `;
}

export function emptyState(message) {
  return html`<div class="empty">${message}</div>`;
}

// ---------- Armazenamento local (conveniência por navegador) ----------
export function readLocal(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Armazenamento indisponível (aba privada, bloqueio): apenas ignora.
  }
}
