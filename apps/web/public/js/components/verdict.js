import { html, STATUS_LABELS } from "../dom.js";
import { formatArguments, formatReturn } from "../io-format.js";

// Mesma normalização do juiz: ignora \r, espaços no fim das linhas e
// linhas em branco nas pontas.
function normalizeLines(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim()
    .split("\n");
}

function describeFirstDifference(actual, expected, functionMode) {
  const actualLines = normalizeLines(actual);
  const expectedLines = normalizeLines(expected);
  if (actualLines.join("") === "") {
    return functionMode
      ? "A função não retornou valor. Use return com o resultado."
      : "Seu programa não imprimiu nada. Escreva só a resposta na saída padrão.";
  }
  if (functionMode) {
    return `A função retornou ${actualLines.join(" ")}, mas o esperado era ${expectedLines.join(" ")}.`;
  }
  const length = Math.max(actualLines.length, expectedLines.length);
  for (let index = 0; index < length; index += 1) {
    if (actualLines[index] !== expectedLines[index]) {
      if (actualLines[index] === undefined) {
        return `Faltou imprimir a linha ${index + 1}: esperado "${expectedLines[index]}".`;
      }
      if (expectedLines[index] === undefined) {
        return `Linha ${index + 1} a mais na saída: "${actualLines[index]}".`;
      }
      return `Primeira diferença na linha ${index + 1}: esperado "${expectedLines[index]}", obtido "${actualLines[index]}".`;
    }
  }
  return null;
}

function highlightedOutput(actual, expected) {
  const actualLines = normalizeLines(actual);
  const expectedLines = normalizeLines(expected);
  if (actualLines.join("") === "") {
    return html`<pre class="io is-empty">(nenhuma saída)</pre>`;
  }
  return html`<pre class="io">${actualLines.map(
    (line, index) => html`<span class="${line === expectedLines[index] ? "line-ok" : "line-diff"}">${line || " "}</span>`
  )}</pre>`;
}

function ioBlock(label, content, { error = false } = {}) {
  const empty = content === null || content === undefined || String(content).trim() === "";
  return html`
    <div class="io-block">
      <span>${label}</span>
      <pre class="io ${empty ? "is-empty" : ""} ${error ? "is-error" : ""}">${empty ? "(vazio)" : content}</pre>
    </div>
  `;
}

function caseProgress(passed, total, failed) {
  if (total > 60) return "";
  return html`<div class="progress-cases" aria-hidden="true">
    ${Array.from({ length: total }, (_, index) => {
      const state = index < passed ? "ok" : index === passed && failed ? "fail" : "";
      return html`<span class="${state}"></span>`;
    })}
  </div>`;
}

/**
 * Detalhe de um caso. `context.functionSpec` presente = modo função: entrada
 * mostrada como argumentos nomeados e saídas como valores de retorno.
 */
export function caseDetail({ input, expectedOutput, actualOutput, stderr, error, executionStatus }, context = {}) {
  const spec = context.functionSpec ?? null;
  const functionMode = Boolean(spec);
  const hasExpected = expectedOutput !== null && expectedOutput !== undefined;
  const expected = functionMode && hasExpected ? formatReturn(expectedOutput) : expectedOutput;
  const actual = functionMode ? formatReturn(actualOutput) : actualOutput;
  const difference =
    hasExpected && executionStatus === "completed" && !error
      ? describeFirstDifference(actual, expected, functionMode)
      : null;

  return html`
    ${error ? ioBlock(executionStatus === "timeout" ? "Tempo esgotado" : "Erro", error, { error: true }) : ""}
    ${ioBlock(functionMode ? "Argumentos" : "Entrada (stdin)", functionMode ? formatArguments(input, spec) : input)}
    ${difference ? html`<p class="first-diff">${difference}</p>` : ""}
    <div class="${hasExpected ? "io-grid" : ""}">
      <div class="io-block">
        <span>${functionMode ? "Retorno da sua função" : "Saída do seu programa"}</span>
        ${hasExpected && executionStatus === "completed"
          ? highlightedOutput(actual, expected)
          : html`<pre class="io ${actual ? "" : "is-empty"}">${actual || (functionMode ? "(sem retorno)" : "(nenhuma saída)")}</pre>`}
      </div>
      ${hasExpected ? ioBlock(functionMode ? "Retorno esperado" : "Saída esperada", expected) : ""}
    </div>
    ${stderr ? ioBlock(functionMode ? "Saída de depuração (prints e stderr)" : "stderr (depuração)", stderr) : ""}
  `;
}

export function compileWarningsBlock(warnings) {
  if (!warnings) return "";
  return html`
    <div class="compile-warnings">
      <p class="case-label">Avisos do compilador que podem explicar o resultado</p>
      <pre class="io">${warnings}</pre>
    </div>
  `;
}

export function renderVerdict(submission, context = {}) {
  const { result, feedback, status } = submission;
  const failed = result.failedTest;

  return html`
    <div class="verdict">
      <div class="verdict-head">
        <h3 class="verdict-title ${status}">${feedback.title ?? STATUS_LABELS[status]}</h3>
        ${["compile_error", "internal_error", "rule_violation"].includes(status)
          ? ""
          : html`<span class="verdict-count">${result.passedTests} / ${result.totalTests} casos aprovados</span>`}
        ${result.runtimeMs !== null ? html`<span class="verdict-count">Tempo: ${result.runtimeMs} ms</span>` : ""}
        ${submission.scoreAwarded > 0 ? html`<span class="pill status-accepted">+${submission.scoreAwarded} pontos</span>` : ""}
      </div>
      ${["compile_error", "internal_error", "rule_violation"].includes(status) ? "" : caseProgress(result.passedTests, result.totalTests, Boolean(failed))}
      <p class="verdict-message">${feedback.message}</p>
      ${result.compileError ? ioBlock("Mensagem do compilador", result.compileError, { error: true }) : ""}
      ${result.ruleViolations?.length
        ? html`<ul class="rules-list is-violated">${result.ruleViolations.map((rule) => html`<li>${rule}</li>`)}</ul>`
        : ""}
      ${failed
        ? html`
            <p class="case-label">Caso ${failed.position} de ${result.totalTests} · ${failed.isPublic ? "exemplo" : "caso oculto"} · ${failed.durationMs} ms</p>
            ${caseDetail(failed, context)}
          `
        : ""}
      ${status !== "accepted" ? compileWarningsBlock(result.compileWarnings) : ""}
      ${status === "accepted" && submission.scoreAwarded === 0
        ? html`<p class="muted small">Você já tinha resolvido este desafio; os pontos são contados uma única vez.</p>`
        : ""}
    </div>
  `;
}

export function compileErrorLine(message) {
  const text = String(message ?? "");
  const match = text.match(/solucao\.(?:js|c):(\d+)/) ?? text.match(/File "solucao\.py", line (\d+)/);
  return match ? Number(match[1]) : null;
}
