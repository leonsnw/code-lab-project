import { api } from "../api.js";
import { icon } from "../icons.js";
import { toast } from "../components/toast.js";
import { $, $$, difficultyPill, emptyState, html, languagePill, render as paint } from "../dom.js";
import { navigate } from "../router.js";

const RECOMMENDED_HIDDEN_CASES = 10;

export async function render(context) {
  if (context.mode === "new" || context.mode === "edit") return renderForm(context);
  return renderList(context);
}

async function renderList({ root }) {
  const { challenges } = await api.admin.challenges();

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha"><a href="#/admin">Administração</a><span>›</span><span>Desafios</span></nav>
      <div class="page-head">
        <div>
          <h1>Gerenciar desafios</h1>
          <p class="lead">Crie, edite ou retire desafios do catálogo. Desafios removidos ficam inativos e mantêm o histórico.</p>
        </div>
        <a class="btn btn-primary" href="#/admin/desafios/novo">${icon("plus", 14)} Novo desafio</a>
      </div>
      <section class="card">
        ${challenges.length === 0
          ? emptyState("Nenhum desafio cadastrado.")
          : html`<div class="table-wrap"><table>
              <thead><tr><th>Desafio</th><th>Linguagem</th><th>Assunto</th><th>Nível</th><th class="num">Pontos</th><th class="num">Casos</th><th>Situação</th><th class="num">Ações</th></tr></thead>
              <tbody>${challenges.map((challenge) => {
                const hidden = challenge.testCases.filter((testCase) => !testCase.isPublic).length;
                return html`<tr>
                  <td><strong>${challenge.title}</strong><br /><span class="muted small">/${challenge.slug}</span></td>
                  <td>${challenge.languages.map((entry) => languagePill(entry.language))}</td>
                  <td class="muted">${challenge.topic}</td>
                  <td>${difficultyPill(challenge.difficulty)}</td>
                  <td class="num">${challenge.points}</td>
                  <td class="num" title="${hidden} ocultos">${challenge.testCases.length}${hidden < RECOMMENDED_HIDDEN_CASES ? html` <span class="pill status-timeout" title="Poucos casos ocultos facilitam respostas decoradas">poucos ocultos</span>` : ""}</td>
                  <td>${!challenge.isActive ? html`<span class="pill status-pending">Inativo</span>` : challenge.isPublished === false ? html`<span class="pill status-timeout">Rascunho</span>` : html`<span class="pill status-accepted">Publicado</span>`}</td>
                  <td class="num"><span class="btn-row" style="justify-content: flex-end">
                    <a class="btn btn-sm" href="#/admin/desafios/${challenge.id}">Editar</a>
                    ${challenge.isActive ? html`<button class="btn btn-sm btn-danger" type="button" data-remove="${challenge.id}" data-title="${challenge.title}">Remover</button>` : ""}
                  </span></td>
                </tr>`;
              })}</tbody>
            </table></div>`}
      </section>
    `
  );

  $$("[data-remove]", root).forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm(`Remover "${button.dataset.title}" do catálogo? O histórico de submissões é preservado.`)) return;
      try {
        await api.admin.remove(button.dataset.remove);
        toast("Desafio removido do catálogo.", "success");
        renderList({ root });
      } catch (error) {
        toast(error.message, "error");
      }
    });
  });
}

function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const emptyChallenge = {
  title: "",
  slug: "",
  description: "",
  difficulty: "easy",
  points: 100,
  tags: ["Logica"],
  constraints: [],
  examples: [{ input: "", output: "" }],
  testCases: [
    { input: "", expectedOutput: "", isPublic: true, weight: 1 },
    { input: "", expectedOutput: "", isPublic: false, weight: 1 }
  ],
  languages: [{ language: "javascript", sourceRules: [] }],
  mode: "stdio",
  functionSpec: null,
  checker: { kind: "exact" },
  timeLimitMs: null,
  memoryLimitMb: null,
  topic: "Lógica de Programação",
  subtopic: "",
  moduleId: null,
  position: 0,
  isBoss: false,
  hints: [],
  editorial: null,
  complexity: null,
  followUps: [],
  isActive: true,
  // Desafio novo nasce como rascunho: o professor valida antes de publicar.
  isPublished: false
};

const LANGUAGE_CHOICES = [["javascript", "JavaScript"], ["python", "Python"], ["c", "C"]];
const CHECKERS = [
  ["exact", "Saída exata"],
  ["tolerance", "Tolerância numérica"],
  ["unordered-lines", "Linhas em qualquer ordem"],
  ["unordered-tokens", "Valores em qualquer ordem"]
];

/** Regras iguais em todas as linguagens viram uma lista; diferentes, um objeto por linguagem. */
function rulesText(languages) {
  const serialized = languages.map((entry) => JSON.stringify(entry.sourceRules));
  if (serialized.every((text) => text === "[]")) return "";
  if (serialized.every((text) => text === serialized[0])) return JSON.stringify(languages[0].sourceRules, null, 2);
  return JSON.stringify(Object.fromEntries(languages.map((entry) => [entry.language, entry.sourceRules])), null, 2);
}

const RULE_EXAMPLE = `[
  { "kind": "recursion", "message": "Resolva com uma função recursiva." },
  { "kind": "forbid", "pattern": "\\\\bqsort\\\\s*\\\\(", "message": "Não use qsort." },
  { "kind": "require", "pattern": "\\\\bmalloc\\\\s*\\\\(", "message": "Aloque os nós com malloc." }
]`;

async function renderForm({ root, params, mode }) {
  const editing = mode === "edit";
  const [source, catalog] = await Promise.all([
    editing ? api.admin.challenge(params.id).then((response) => response.challenge) : Promise.resolve(emptyChallenge),
    api.tracks().catch(() => ({ tracks: [] }))
  ]);
  const acceptedLanguages = new Set(source.languages.map((entry) => entry.language));
  const state = {
    examples: source.examples.map((example) => ({ ...example })),
    // Públicos primeiro, na mesma ordem em que o juiz executa.
    testCases: [...source.testCases]
      .sort((a, b) => Number(b.isPublic) - Number(a.isPublic))
      .map(({ input, expectedOutput, isPublic, weight }) => ({ input, expectedOutput, isPublic, weight })),
    slugTouched: editing
  };

  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha"><a href="#/admin">Administração</a><span>›</span><a href="#/admin/desafios">Desafios</a><span>›</span><span>${editing ? source.title : "Novo"}</span></nav>
      <div class="page-head">
        <div>
          <h1>${editing ? "Editar desafio" : "Novo desafio"}</h1>
        </div>
      </div>

      <form id="challenge-form" class="stack" novalidate>
        <div id="form-error" class="alert alert-error" role="alert" hidden></div>

        <section class="card">
          <h2 style="margin-bottom: 14px">Enunciado</h2>
          <div class="form-grid">
            <div class="field"><label for="f-title">Título</label><input id="f-title" name="title" value="${source.title}" minlength="3" maxlength="120" required /></div>
            <div class="field"><label for="f-slug">Slug (URL)</label><input id="f-slug" name="slug" value="${source.slug}" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="120" required /><small>Letras minúsculas, números e hífens.</small></div>
          </div>
          <div class="field"><label for="f-description">Descrição</label><textarea id="f-description" name="description" rows="5" minlength="10" maxlength="5000" required>${source.description}</textarea></div>
          <div class="form-grid">
            <div class="field"><label for="f-difficulty">Dificuldade</label>
              <select id="f-difficulty" name="difficulty">
                ${[["easy", "Fácil"], ["medium", "Médio"], ["hard", "Difícil"]].map(([value, label]) => html`<option value="${value}" ${source.difficulty === value ? html`selected` : ""}>${label}</option>`)}
              </select>
            </div>
            <div class="field"><label for="f-points">Pontos</label><input id="f-points" name="points" type="number" min="1" max="10000" value="${source.points}" required /></div>
          </div>
          <div class="field"><label for="f-tags">Tags (separadas por vírgula)</label><input id="f-tags" name="tags" value="${source.tags.join(", ")}" required /></div>
          <div class="field"><label for="f-constraints">Restrições (uma por linha)</label><textarea id="f-constraints" name="constraints" rows="4">${source.constraints.join("\n")}</textarea></div>
          <label class="checkbox"><input type="checkbox" name="isPublished" ${source.isPublished !== false ? html`checked` : ""} /> Publicado: visível para os estudantes (desmarcado = rascunho, só administradores veem)</label>
          ${editing
            ? html`<label class="checkbox"><input type="checkbox" name="isActive" ${source.isActive ? html`checked` : ""} /> Desafio ativo no catálogo</label>`
            : ""}
        </section>

        <section class="card">
          <div class="card-head">
            <div><h2>Exemplos do enunciado</h2><p>Aparecem na descrição do desafio.</p></div>
            <button id="add-example" class="btn btn-sm" type="button">+ Exemplo</button>
          </div>
          <div id="examples" class="case-editor"></div>
        </section>

        <section class="card">
          <h2 style="margin-bottom: 14px">Trilha</h2>
          <div class="form-grid">
            <div class="field"><label for="f-module">Módulo</label>
              <select id="f-module" name="moduleId">
                <option value="">Sem módulo (desafio avulso)</option>
                ${catalog.tracks.map(
                  (track) => html`<optgroup label="${track.title}">${track.modules.map((module) => html`<option value="${module.id}" ${source.moduleId === module.id ? html`selected` : ""}>${module.title}</option>`)}</optgroup>`
                )}
              </select>
              <small>Com módulo, assunto e subtema vêm da trilha.</small>
            </div>
            <div class="field"><label for="f-position">Posição no módulo</label><input id="f-position" name="position" type="number" min="0" max="10000" value="${source.position}" /></div>
          </div>
          <div class="form-grid">
            <div class="field"><label for="f-topic">Assunto (sem módulo)</label>
              <input id="f-topic" name="topic" list="topic-options" value="${source.topic}" maxlength="60" />
              <datalist id="topic-options">${catalog.tracks.map((track) => html`<option value="${track.title}"></option>`)}</datalist>
            </div>
            <div class="field"><label for="f-subtopic">Subtema (sem módulo)</label><input id="f-subtopic" name="subtopic" value="${source.subtopic ?? ""}" maxlength="60" /></div>
          </div>
          <label class="checkbox"><input type="checkbox" name="isBoss" ${source.isBoss ? html`checked` : ""} /> Desafio final do módulo</label>
        </section>

        <section class="card">
          <h2 style="margin-bottom: 14px">Linguagens e avaliação</h2>
          <div class="field">
            <span class="field-label">Linguagens aceitas</span>
            <div class="btn-row">
              ${LANGUAGE_CHOICES.map(([value, label]) => html`<label class="checkbox"><input type="checkbox" name="languages" value="${value}" ${acceptedLanguages.has(value) ? html`checked` : ""} /> ${label}</label>`)}
            </div>
          </div>
          <div class="form-grid">
            <div class="field"><label for="f-mode">Modo</label>
              <select id="f-mode" name="mode">
                <option value="stdio" ${source.mode === "stdio" ? html`selected` : ""}>Entrada e saída padrão (stdin/stdout)</option>
                <option value="function" ${source.mode === "function" ? html`selected` : ""}>Função (estilo LeetCode)</option>
              </select>
            </div>
            <div class="field"><label for="f-checker">Comparação</label>
              <select id="f-checker" name="checker">
                ${CHECKERS.map(([value, label]) => html`<option value="${value}" ${source.checker.kind === value ? html`selected` : ""}>${label}</option>`)}
              </select>
            </div>
          </div>
          <div class="field" id="signature-field">
            <label for="f-signature">Assinatura da função (JSON)</label>
            <textarea id="f-signature" name="functionSpec" class="mono" rows="4" spellcheck="false" placeholder='{"name": "somar", "params": [{"name": "a", "type": "int"}], "returns": "int"}'>${source.functionSpec ? JSON.stringify(source.functionSpec, null, 2) : ""}</textarea>
            <small>Tipos: int, long, double, bool, string, int[], double[], string[], int[][]. No modo função, cada caso de teste é a lista de argumentos em JSON e o retorno esperado em JSON.</small>
          </div>
          <div class="form-grid">
            <div class="field"><label for="f-epsilon">Tolerância (se numérica)</label><input id="f-epsilon" name="epsilon" type="number" step="any" min="0" value="${source.checker.kind === "tolerance" ? source.checker.epsilon : "0.000001"}" /></div>
            <div class="field"><label for="f-time">Tempo limite (ms, opcional)</label><input id="f-time" name="timeLimitMs" type="number" min="100" max="10000" value="${source.timeLimitMs ?? ""}" /></div>
          </div>
          <div class="field"><label for="f-memory">Memória (MB, opcional)</label><input id="f-memory" name="memoryLimitMb" type="number" min="16" max="1024" value="${source.memoryLimitMb ?? ""}" /></div>
        </section>

        <section class="card">
          <h2 style="margin-bottom: 14px">Ajuda ao estudante</h2>
          <div class="field"><label for="f-hints">Dicas progressivas (uma por linha, até 5)</label><textarea id="f-hints" name="hints" rows="4">${source.hints.join("\n")}</textarea></div>
          <div class="field"><label for="f-editorial">Solução comentada (Markdown)</label><textarea id="f-editorial" name="editorial" class="mono" rows="8">${source.editorial ?? ""}</textarea><small>Liberada ao resolver ou após 3 tentativas (quem revela antes perde os pontos).</small></div>
          <div class="form-grid">
            <div class="field"><label for="f-time-complexity">Complexidade de tempo</label><input id="f-time-complexity" name="complexityTime" value="${source.complexity?.time ?? ""}" placeholder="O(n)" /></div>
            <div class="field"><label for="f-space-complexity">Complexidade de espaço</label><input id="f-space-complexity" name="complexitySpace" value="${source.complexity?.space ?? ""}" placeholder="O(1)" /></div>
          </div>
          <div class="field"><label for="f-followups">Perguntas de acompanhamento (uma por linha)</label><textarea id="f-followups" name="followUps" rows="3">${source.followUps.join("\n")}</textarea></div>
        </section>

        <section class="card">
          <div class="card-head">
            <div>
              <h2>Regras do código-fonte</h2>
              <p>Verificadas antes dos testes, ignorando comentários e strings. Tipos: <code>recursion</code>, <code>forbid</code> e <code>require</code> (com <code>pattern</code> em expressão regular). O estudante vê apenas a mensagem.</p>
            </div>
          </div>
          <div class="field" style="margin: 0">
            <label for="f-rules">Regras em JSON</label>
            <textarea id="f-rules" name="sourceRules" class="mono" rows="5" spellcheck="false" placeholder="${RULE_EXAMPLE}">${rulesText(source.languages)}</textarea>
            <small>Lista = mesmas regras para todas as linguagens. Para regras por linguagem, use um objeto: <code>{"c": [...], "python": [...]}</code>. Deixe vazio para não aplicar regras.</small>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div>
              <h2>Casos de teste</h2>
              <p>Casos públicos são executados no botão Executar. Os ocultos só aparecem ao estudante quando a solução falha neles, um por envio.</p>
            </div>
            <div class="btn-row">
              <button id="add-public" class="btn btn-sm" type="button">+ Público</button>
              <button id="add-hidden" class="btn btn-sm" type="button">+ Oculto</button>
            </div>
          </div>
          <div id="test-cases" class="case-editor"></div>
          <p id="case-summary" class="case-summary"></p>
          <details style="margin-top: 12px">
            <summary>Importar ou exportar casos em JSON</summary>
            <div class="field" style="margin-top: 10px">
              <textarea id="cases-json" class="mono" rows="8" spellcheck="false"></textarea>
              <small>Formato: <code>[{"input": "1 2", "expectedOutput": "3", "isPublic": false}]</code></small>
            </div>
            <div class="btn-row">
              <button id="export-json" class="btn btn-sm" type="button">Exportar casos atuais</button>
              <button id="import-json" class="btn btn-sm" type="button">Substituir pelos casos do JSON</button>
            </div>
          </details>
        </section>

        <section class="card">
          <div class="card-head">
            <div>
              <h2>Ferramentas do professor</h2>
              <p>Rode soluções de referência e burlas contra os casos antes de salvar, e gere gabaritos executando a solução no juiz.</p>
            </div>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="tool-language">Linguagem</label>
              <select id="tool-language">${LANGUAGE_CHOICES.map(([value, label]) => html`<option value="${value}">${label}</option>`)}</select>
            </div>
            <div class="field">
              <label for="tool-expected">Veredito esperado</label>
              <select id="tool-expected">
                <option value="accepted">Aceita (solução de referência)</option>
                <option value="wrong_answer">Resposta errada (burla)</option>
                <option value="timeout">Tempo limite (solução ingênua)</option>
                <option value="rule_violation">Regra não atendida</option>
                <option value="runtime_error">Erro de execução</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="tool-source">Código</label>
            <textarea id="tool-source" class="mono" rows="8" placeholder="Solução de referência ou tentativa de burla"></textarea>
          </div>
          <div class="btn-row">
            <button id="tool-add" class="btn btn-sm" type="button">+ Adicionar à validação</button>
            <button id="tool-validate" class="btn btn-sm btn-primary" type="button">Validar contra os casos</button>
          </div>
          <div id="tool-queue" class="tool-results"></div>
          <details class="settings-details">
            <summary>Gerar casos com a solução acima</summary>
            <p class="muted small">Escreva <code>function gerar(indice, aleatorio)</code> devolvendo a entrada do caso: texto no modo stdio ou a lista de argumentos no modo função. <code>aleatorio()</code> é determinístico (mesma semente, mesmos casos). As saídas esperadas saem da solução de referência, executada no juiz.</p>
            <div class="field"><label for="tool-generator">Gerador (JavaScript)</label><textarea id="tool-generator" class="mono" rows="6">function gerar(indice, aleatorio) {
  const n = Math.floor(aleatorio() * 1000) - 500;
  return [n];
}</textarea></div>
            <div class="form-grid">
              <div class="field"><label for="tool-count">Quantidade</label><input id="tool-count" type="number" min="1" max="40" value="10" /></div>
              <div class="field"><label for="tool-seed">Semente</label><input id="tool-seed" type="number" value="1" /></div>
            </div>
            <button id="tool-generate" class="btn btn-sm" type="button">Gerar e adicionar como casos ocultos</button>
          </details>
        </section>

        <div class="btn-row">
          <button class="btn btn-primary" type="submit">${editing ? "Salvar alterações" : "Cadastrar desafio"}</button>
          <a class="btn" href="#/admin/desafios">Cancelar</a>
          ${editing && source.isActive ? html`<a class="btn btn-ghost" href="#/desafios/${source.slug}" target="_blank" rel="noopener">Pré-visualizar como estudante</a>` : ""}
        </div>
      </form>
    `
  );

  const form = $("#challenge-form", root);
  const examplesTarget = $("#examples", root);
  const casesTarget = $("#test-cases", root);

  function renderExamples() {
    paint(
      examplesTarget,
      state.examples.length === 0
        ? html`<p class="muted small">Sem exemplos.</p>`
        : state.examples.map(
            (example, index) => html`
              <div class="case-row" style="grid-template-columns: 34px minmax(0, 1fr) minmax(0, 1fr) auto">
                <span class="case-index">${index + 1}</span>
                <textarea aria-label="Entrada do exemplo ${index + 1}" data-example="${index}" data-field="input" placeholder="Entrada">${example.input}</textarea>
                <textarea aria-label="Saída do exemplo ${index + 1}" data-example="${index}" data-field="output" placeholder="Saída">${example.output}</textarea>
                <button class="btn btn-sm btn-ghost" type="button" data-remove-example="${index}" aria-label="Remover exemplo ${index + 1}">✕</button>
              </div>
            `
          )
    );
  }

  function renderCases() {
    paint(
      casesTarget,
      state.testCases.map(
        (testCase, index) => html`
          <div class="case-row">
            <span class="case-index">${index + 1}</span>
            <textarea aria-label="Entrada do caso ${index + 1}" data-case="${index}" data-field="input" placeholder="Entrada (stdin)">${testCase.input}</textarea>
            <textarea aria-label="Saída esperada do caso ${index + 1}" data-case="${index}" data-field="expectedOutput" placeholder="Saída esperada">${testCase.expectedOutput}</textarea>
            <label class="checkbox"><input type="checkbox" data-case="${index}" data-field="isPublic" ${testCase.isPublic ? html`checked` : ""} /> Público</label>
            <button class="btn btn-sm btn-ghost" type="button" data-remove-case="${index}" aria-label="Remover caso ${index + 1}">✕</button>
          </div>
        `
      )
    );
    updateSummary();
  }

  function updateSummary() {
    const publicCount = state.testCases.filter((testCase) => testCase.isPublic).length;
    const hiddenCount = state.testCases.length - publicCount;
    const summary = $("#case-summary", root);
    const warning = hiddenCount < RECOMMENDED_HIDDEN_CASES;
    summary.classList.toggle("is-warning", warning);
    summary.textContent = `${state.testCases.length} casos: ${publicCount} públicos e ${hiddenCount} ocultos.` +
      (warning
        ? ` Recomendado: pelo menos ${RECOMMENDED_HIDDEN_CASES} ocultos, incluindo bordas (zero, negativos, limites). Com poucos casos, uma resposta decorada passa.`
        : "");
  }

  examplesTarget.addEventListener("input", (event) => {
    const { example, field } = event.target.dataset;
    if (example !== undefined) state.examples[Number(example)][field] = event.target.value;
  });
  examplesTarget.addEventListener("click", (event) => {
    const index = event.target.closest("[data-remove-example]")?.dataset.removeExample;
    if (index === undefined) return;
    state.examples.splice(Number(index), 1);
    renderExamples();
  });
  casesTarget.addEventListener("input", (event) => {
    const { case: index, field } = event.target.dataset;
    if (index === undefined) return;
    state.testCases[Number(index)][field] = field === "isPublic" ? event.target.checked : event.target.value;
    if (field === "isPublic") updateSummary();
  });
  casesTarget.addEventListener("click", (event) => {
    const index = event.target.closest("[data-remove-case]")?.dataset.removeCase;
    if (index === undefined) return;
    state.testCases.splice(Number(index), 1);
    renderCases();
  });

  $("#add-example", root).addEventListener("click", () => {
    state.examples.push({ input: "", output: "" });
    renderExamples();
  });
  $("#add-public", root).addEventListener("click", () => {
    state.testCases.push({ input: "", expectedOutput: "", isPublic: true, weight: 1 });
    renderCases();
  });
  $("#add-hidden", root).addEventListener("click", () => {
    state.testCases.push({ input: "", expectedOutput: "", isPublic: false, weight: 1 });
    renderCases();
  });
  $("#export-json", root).addEventListener("click", () => {
    $("#cases-json", root).value = JSON.stringify(state.testCases, null, 2);
  });
  $("#import-json", root).addEventListener("click", () => {
    try {
      const parsed = JSON.parse($("#cases-json", root).value);
      if (!Array.isArray(parsed)) throw new Error("O JSON deve ser uma lista.");
      state.testCases = parsed.map((item, index) => {
        if (typeof item?.input !== "string" || typeof item?.expectedOutput !== "string") {
          throw new Error(`Caso ${index + 1}: "input" e "expectedOutput" devem ser textos.`);
        }
        return { input: item.input, expectedOutput: item.expectedOutput, isPublic: Boolean(item.isPublic), weight: Number(item.weight ?? 1) };
      });
      renderCases();
      toast(`${state.testCases.length} casos importados.`, "success");
    } catch (error) {
      toast(`JSON inválido: ${error.message}`, "error");
    }
  });

  const titleInput = form.title;
  const slugInput = form.slug;
  titleInput.addEventListener("input", () => {
    if (!state.slugTouched) slugInput.value = slugify(titleInput.value);
  });
  slugInput.addEventListener("input", () => {
    state.slugTouched = true;
  });

  /** Monta o payload do formulário e a lista de problemas encontrados. */
  function collectPayload() {
    const data = new FormData(form);
    const payload = {
      title: String(data.get("title")).trim(),
      slug: String(data.get("slug")).trim(),
      description: String(data.get("description")).trim(),
      difficulty: String(data.get("difficulty")),
      points: Number(data.get("points")),
      tags: String(data.get("tags")).split(",").map((tag) => tag.trim()).filter(Boolean),
      constraints: String(data.get("constraints")).split("\n").map((line) => line.trim()).filter(Boolean),
      examples: state.examples.filter((example) => example.input.trim() || example.output.trim()),
      topic: String(data.get("topic") ?? "").trim() || "Lógica de Programação",
      subtopic: String(data.get("subtopic") ?? "").trim(),
      moduleId: String(data.get("moduleId") ?? "") || null,
      position: Number(data.get("position") || 0),
      isBoss: data.get("isBoss") === "on",
      mode: String(data.get("mode")),
      functionSpec: null,
      checker: { kind: String(data.get("checker")) },
      timeLimitMs: data.get("timeLimitMs") ? Number(data.get("timeLimitMs")) : null,
      memoryLimitMb: data.get("memoryLimitMb") ? Number(data.get("memoryLimitMb")) : null,
      hints: String(data.get("hints") ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
      editorial: String(data.get("editorial") ?? "").trim() || null,
      complexity: data.get("complexityTime") && data.get("complexitySpace")
        ? { time: String(data.get("complexityTime")).trim(), space: String(data.get("complexitySpace")).trim() }
        : null,
      followUps: String(data.get("followUps") ?? "").split("\n").map((line) => line.trim()).filter(Boolean),
      languages: [],
      testCases: state.testCases
    };
    if (payload.checker.kind === "tolerance") payload.checker.epsilon = Number(data.get("epsilon")) || 0.000001;
    if (editing) payload.isActive = data.get("isActive") === "on";
    payload.isPublished = data.get("isPublished") === "on";

    const problems = [];
    const chosen = data.getAll("languages").map(String);
    if (!chosen.length) problems.push("Escolha ao menos uma linguagem.");
    let rules = [];
    const rulesSource = String(data.get("sourceRules") ?? "").trim();
    if (rulesSource) {
      try {
        rules = JSON.parse(rulesSource);
        if (!Array.isArray(rules) && (typeof rules !== "object" || rules === null)) throw new Error();
      } catch {
        problems.push("As regras precisam ser uma lista JSON ou um objeto por linguagem.");
      }
    }
    payload.languages = chosen.map((language) => ({
      language,
      sourceRules: Array.isArray(rules) ? rules : rules[language] ?? []
    }));
    if (payload.mode === "function") {
      try {
        payload.functionSpec = JSON.parse(String(data.get("functionSpec") ?? ""));
      } catch {
        problems.push("No modo função, informe a assinatura em JSON.");
      }
    }
    if (payload.title.length < 3) problems.push("O título precisa de pelo menos 3 caracteres.");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) problems.push("Slug inválido: use letras minúsculas, números e hífens.");
    if (payload.description.length < 10) problems.push("A descrição precisa de pelo menos 10 caracteres.");
    if (!payload.tags.length) problems.push("Informe ao menos uma tag.");
    if (!payload.testCases.some((testCase) => testCase.isPublic)) problems.push("Cadastre ao menos um caso público.");
    if (!payload.testCases.some((testCase) => !testCase.isPublic)) problems.push("Cadastre ao menos um caso oculto.");
    if (payload.testCases.some((testCase) => !testCase.expectedOutput.trim())) problems.push("Todo caso de teste precisa de saída esperada.");
    return { payload, problems };
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorBox = $("#form-error", root);
    errorBox.hidden = true;
    const { payload, problems } = collectPayload();
    if (problems.length) {
      errorBox.textContent = problems.join(" ");
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: "center" });
      return;
    }

    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      if (editing) await api.admin.update(params.id, payload);
      else await api.admin.create(payload);
      toast(editing ? "Desafio atualizado." : "Desafio cadastrado.", "success");
      navigate("/admin/desafios");
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: "center" });
      button.disabled = false;
    }
  });

  // ---------- Ferramentas: validar soluções e gerar casos ----------
  const queue = [];
  const queueTarget = $("#tool-queue", root);
  const toolLanguage = $("#tool-language", root);
  const toolSource = $("#tool-source", root);
  const toolExpected = $("#tool-expected", root);
  const EXPECTED_LABELS = { accepted: "aceita", wrong_answer: "resposta errada", timeout: "tempo limite", rule_violation: "regra", runtime_error: "erro de execução" };

  function paintQueue(results = []) {
    paint(
      queueTarget,
      queue.map((item, index) => {
        const result = results[index];
        return html`<div class="tool-result ${result ? (result.ok ? "is-ok" : "is-bad") : ""}">
          <strong>${LANGUAGE_CHOICES.find(([value]) => value === item.language)?.[1]}</strong>
          <span class="muted small">espera ${EXPECTED_LABELS[item.expected]}</span>
          ${result
            ? html`<span>→ ${result.status}${result.totalTests ? ` · ${result.passedTests}/${result.totalTests} casos` : ""}${result.slowestMs !== null && result.slowestMs !== undefined ? ` · caso mais lento ${result.slowestMs} ms` : ""}</span>
                ${result.failedCase ? html`<span class="muted small">falhou no caso ${result.failedCase.position} (${result.failedCase.isPublic ? "público" : "oculto"})</span>` : ""}
                ${result.message && !result.ok ? html`<pre class="io is-error" style="width: 100%; margin: 4px 0 0">${result.message.slice(0, 600)}</pre>` : ""}`
            : ""}
          <button class="btn btn-sm btn-ghost" type="button" data-unqueue="${index}" aria-label="Remover da validação" style="margin-left: auto">✕</button>
        </div>`;
      })
    );
  }

  queueTarget.addEventListener("click", (event) => {
    const index = event.target.closest("[data-unqueue]")?.dataset.unqueue;
    if (index === undefined) return;
    queue.splice(Number(index), 1);
    paintQueue();
  });

  $("#tool-add", root).addEventListener("click", () => {
    if (!toolSource.value.trim()) return toast("Cole o código antes de adicionar.", "error");
    queue.push({ language: toolLanguage.value, sourceCode: toolSource.value, expected: toolExpected.value });
    paintQueue();
  });

  $("#tool-validate", root).addEventListener("click", async (event) => {
    if (!queue.length && toolSource.value.trim()) queue.push({ language: toolLanguage.value, sourceCode: toolSource.value, expected: toolExpected.value });
    if (!queue.length) return toast("Adicione ao menos uma solução.", "error");
    const { payload, problems } = collectPayload();
    if (problems.length) return toast(problems.join(" "), "error");
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Validando…";
    try {
      const { ok, results } = await api.admin.validate(payload, queue);
      paintQueue(results);
      toast(ok ? "Todas as soluções tiveram o veredito esperado." : "Alguma solução não teve o veredito esperado.", ok ? "success" : "error");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Validar contra os casos";
    }
  });

  $("#tool-generate", root).addEventListener("click", async (event) => {
    const { payload } = collectPayload();
    if (!toolSource.value.trim()) return toast("Cole a solução de referência no campo Código.", "error");
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const { cases, failures } = await api.admin.generateCases({
        mode: payload.mode,
        functionSpec: payload.functionSpec,
        language: toolLanguage.value,
        referenceSolution: toolSource.value,
        generator: $("#tool-generator", root).value,
        count: Number($("#tool-count", root).value) || 10,
        seed: Number($("#tool-seed", root).value) || 1
      });
      const good = cases.filter((item) => item.ok);
      // Remove casos vazios deixados pelo formulário antes de acrescentar.
      state.testCases = state.testCases.filter((testCase) => testCase.input.trim() || testCase.expectedOutput.trim());
      state.testCases.push(...good.map((item) => ({ input: item.input, expectedOutput: item.expectedOutput, isPublic: false, weight: 1 })));
      renderCases();
      toast(`${good.length} casos adicionados${failures ? `; ${failures} falharam na solução de referência e ficaram de fora` : ""}.`, failures ? "error" : "success");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  renderExamples();
  renderCases();
}
