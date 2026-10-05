import { api } from "../api.js";
import { toast } from "../components/toast.js";
import { $, emptyState, formatDateTime, formatNumber, formatRelative, html, render as paint } from "../dom.js";
import { icon } from "../icons.js";
import { navigate } from "../router.js";

// Turmas do professor: criar, compartilhar o código, acompanhar e exportar CSV.
export async function render({ root, mode, params }) {
  if (mode === "detail") return renderDetail(root, params.id);

  const { classes } = await api.admin.classes();
  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha"><a href="#/admin">Administração</a><span>›</span><span>Turmas</span></nav>
      <div class="page-head">
        <div>
          <h1>Turmas</h1>
          <p class="lead">Crie uma turma, passe o código para os estudantes (eles entram em Perfil › Turmas) e acompanhe o progresso de cada um.</p>
        </div>
      </div>
      <section class="card" style="margin-bottom: 16px">
        <form id="class-form" class="inline-form">
          <div class="field" style="flex: 1; margin: 0">
            <label for="class-name">Nome da turma</label>
            <input id="class-name" name="name" class="input" maxlength="80" placeholder="Ex.: Estrutura de Dados · 2026/2 · Noite" required />
          </div>
          <button class="btn btn-primary" type="submit">${icon("plus", 14)} Criar turma</button>
        </form>
      </section>
      <section class="card">
        ${classes.length === 0
          ? emptyState("Nenhuma turma ainda. Crie a primeira acima.")
          : html`<div class="table-wrap"><table>
              <thead><tr><th>Turma</th><th>Código</th><th>Professor</th><th class="num">Estudantes</th><th>Criada</th><th></th></tr></thead>
              <tbody>${classes.map(
                (item) => html`<tr>
                  <td><a href="#/admin/turmas/${item.id}"><strong>${item.name}</strong></a></td>
                  <td><button class="class-code" type="button" data-copy="${item.code}" title="Copiar código">${item.code}</button></td>
                  <td>${item.ownerName}</td>
                  <td class="num">${item.members}</td>
                  <td title="${formatDateTime(item.createdAt)}">${formatRelative(item.createdAt)}</td>
                  <td class="num"><a class="btn btn-sm" href="#/admin/turmas/${item.id}">Abrir</a></td>
                </tr>`
              )}</tbody>
            </table></div>`}
      </section>
    `
  );

  bindCopy(root);
  $("#class-form", root).addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = event.target.name.value.trim();
    if (!name) return;
    try {
      const { classGroup } = await api.admin.createClass(name);
      toast(`Turma criada. Código: ${classGroup.code}`, "success");
      navigate(`/admin/turmas/${classGroup.id}`);
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

function bindCopy(root) {
  root.querySelectorAll("[data-copy]").forEach((button) =>
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        toast("Código copiado.", "success");
      } catch {
        toast(`Código: ${button.dataset.copy}`);
      }
    })
  );
}

async function renderDetail(root, id) {
  const { classGroup, tracks, students } = await api.admin.classReport(id);
  const active = students.filter((student) => student.lastActivity && Date.now() - new Date(student.lastActivity).getTime() < 7 * 24 * 3600 * 1000).length;
  paint(
    root,
    html`
      <nav class="breadcrumb" aria-label="Trilha"><a href="#/admin">Administração</a><span>›</span><a href="#/admin/turmas">Turmas</a><span>›</span><span>${classGroup.name}</span></nav>
      <div class="page-head">
        <div>
          <h1>${classGroup.name}</h1>
          <p class="lead">Código para entrar: <button class="class-code class-code-lg" type="button" data-copy="${classGroup.code}" title="Copiar">${classGroup.code}</button></p>
        </div>
        <div class="btn-row">
          <a class="btn btn-primary" href="${api.admin.classCsvUrl(classGroup.id)}" download>${icon("upload", 14)} Exportar CSV</a>
          <button id="delete-class" class="btn btn-danger" type="button">Excluir turma</button>
        </div>
      </div>
      <section class="stat-grid" aria-label="Resumo da turma">
        <div class="stat"><span>Estudantes</span><strong>${students.length}</strong></div>
        <div class="stat"><span>Ativos em 7 dias</span><strong>${active}</strong></div>
        <div class="stat"><span>Média de pontos</span><strong>${students.length ? formatNumber(Math.round(students.reduce((sum, student) => sum + student.totalPoints, 0) / students.length)) : 0}</strong></div>
        <div class="stat"><span>Média de resolvidos</span><strong>${students.length ? (students.reduce((sum, student) => sum + student.solvedChallenges, 0) / students.length).toFixed(1).replace(".", ",") : 0}</strong></div>
      </section>
      <section class="card">
        ${students.length === 0
          ? emptyState(`Ninguém entrou ainda. Passe o código ${classGroup.code} para a turma.`)
          : html`<div class="table-wrap"><table>
              <thead><tr><th>Estudante</th><th class="num">Pontos</th><th class="num">Resolvidos</th>${tracks.map((track) => html`<th class="num" title="${track.title}">${track.title.split(" ")[0]}</th>`)}<th class="num">Aceitação</th><th>Última atividade</th><th></th></tr></thead>
              <tbody>${students.map(
                (student) => html`<tr>
                  <td><a href="#/u/${student.userId}"><strong>${student.name}</strong></a><br /><span class="muted small">${student.email}</span></td>
                  <td class="num">${formatNumber(student.totalPoints)}</td>
                  <td class="num">${student.solvedChallenges}</td>
                  ${tracks.map((track) => html`<td class="num">${student.byTrack[track.slug] ?? 0}<span class="muted small">/${track.total}</span></td>`)}
                  <td class="num">${student.submissions ? `${student.acceptanceRate}%` : "—"}</td>
                  <td>${student.lastActivity ? html`<span title="${formatDateTime(student.lastActivity)}">${formatRelative(student.lastActivity)}</span>` : html`<span class="muted">sem envios</span>`}</td>
                  <td class="num"><button class="btn btn-sm btn-ghost" type="button" data-remove="${student.userId}" data-name="${student.name}">Remover</button></td>
                </tr>`
              )}</tbody>
            </table></div>`}
      </section>
    `
  );
  bindCopy(root);
  root.querySelectorAll("[data-remove]").forEach((button) =>
    button.addEventListener("click", async () => {
      if (!window.confirm(`Remover ${button.dataset.name} da turma? A conta e o progresso da pessoa continuam.`)) return;
      await api.admin.removeClassMember(id, button.dataset.remove);
      toast("Estudante removido da turma.");
      renderDetail(root, id);
    })
  );
  $("#delete-class", root).addEventListener("click", async () => {
    if (!window.confirm("Excluir a turma? Os estudantes continuam com as contas e o progresso; só o agrupamento some.")) return;
    await api.admin.deleteClass(id);
    toast("Turma excluída.");
    navigate("/admin/turmas");
  });
}
