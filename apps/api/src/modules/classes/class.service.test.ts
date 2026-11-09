import { describe, expect, it } from "vitest";
import { buildAdminStatistics } from "../../domain/admin-statistics.js";
import type { Submission, SubmissionStatus } from "../../domain/types.js";
import { InMemoryStore } from "../../database/in-memory-store.js";
import { ClassService } from "./class.service.js";

const OWNER = { id: "user-admin", name: "Professor Henrique", email: "admin@codelab.local", role: "admin" as const };
const MEMBER_ID = "user-marina";

function submission(index: number, status: SubmissionStatus): Submission {
  return {
    id: `submission-${index}`,
    userId: MEMBER_ID,
    challengeId: "challenge-soma",
    language: "javascript",
    sourceCode: "// código",
    status,
    scoreAwarded: 0,
    submittedAt: new Date(`2026-11-0${index + 1}T12:00:00Z`),
    evaluatedAt: status === "pending" ? null : new Date(`2026-11-0${index + 1}T12:00:05Z`),
    totalTests: 1,
    passedTests: status === "accepted" ? 1 : 0,
    errorMessage: null,
    compileWarnings: null,
    testResults: []
  };
}

async function reportFor(statuses: SubmissionStatus[]) {
  const store = new InMemoryStore();
  const service = new ClassService(store);
  const classGroup = await service.create(OWNER, { name: "Turma de Algoritmos" });
  await store.addClassMember({ classId: classGroup.id, userId: MEMBER_ID, joinedAt: new Date("2026-11-01T00:00:00Z") });
  for (const [index, status] of statuses.entries()) await store.addSubmission(submission(index, status));
  return { store, service, classId: classGroup.id, report: await service.report(classGroup.id) };
}

describe("relatório da turma", () => {
  it("não desconta do aluno as falhas do servidor (internal_error)", async () => {
    const { report } = await reportFor(["accepted", "accepted", "internal_error", "internal_error"]);

    // 2 aceitas de 2 avaliadas: 100%. A coluna "Submissões" continua mostrando o total.
    expect(report.students[0]).toMatchObject({ submissions: 4, acceptanceRate: 100 });
  });

  it("não conta contra o aluno as submissões ainda na fila (pending)", async () => {
    const { report } = await reportFor(["accepted", "pending", "pending"]);

    expect(report.students[0]).toMatchObject({ submissions: 3, acceptanceRate: 100 });
  });

  it("continua descontando o que de fato foi errado", async () => {
    const { report } = await reportFor(["accepted", "wrong_answer", "timeout", "internal_error", "pending"]);

    // 1 aceita de 3 avaliadas.
    expect(report.students[0]).toMatchObject({ submissions: 5, acceptanceRate: 33 });
  });

  it("dá 0% quando nada foi avaliado ainda", async () => {
    const { report } = await reportFor(["pending", "internal_error"]);

    expect(report.students[0]).toMatchObject({ submissions: 2, acceptanceRate: 0 });
  });

  it("o CSV traz a mesma porcentagem do relatório", async () => {
    const { service, classId } = await reportFor(["accepted", "accepted", "internal_error", "internal_error"]);

    const { content } = await service.exportCsv(classId);
    const [header, row] = content.replace("\uFEFF", "").trim().split("\r\n");

    const columns = header.split(";");
    expect(row.split(";")[columns.indexOf("Aceitação (%)")]).toBe("100");
  });

  it("o mesmo aluno tem a mesma taxa no relatório da turma e nas estatísticas do administrador", async () => {
    const statuses: SubmissionStatus[] = ["accepted", "accepted", "wrong_answer", "internal_error", "pending"];
    const { store, report } = await reportFor(statuses);

    const statistics = buildAdminStatistics({
      users: [{ id: MEMBER_ID, name: "Leonardo", role: "student", totalPoints: 0 }],
      challenges: [{ id: "challenge-soma", title: "Soma", slug: "soma", difficulty: "easy", isActive: true }],
      submissions: (await store.listSubmissions(MEMBER_ID)).map((item) => ({
        challengeId: item.challengeId,
        userId: item.userId,
        status: item.status
      })),
      comments: [],
      ratings: []
    });

    const adminRate = statistics.users[0].acceptanceRate;
    expect(Math.round(adminRate)).toBe(report.students[0].acceptanceRate);
  });
});
