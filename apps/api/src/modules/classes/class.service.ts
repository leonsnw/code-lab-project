import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import type { CodeLabStore } from "../../database/codelab-store.js";
import type { ClassGroup, User } from "../../domain/types.js";
import { parseOrThrow } from "../auth/auth.service.js";
import { dayKey } from "../stats/stats.service.js";

/** Sem 0/O e 1/I, que se confundem ao ditar o código em sala. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

const createSchema = z.object({ name: z.string().trim().min(2, "Dê um nome à turma.").max(80, "O nome da turma deve ter no máximo 80 caracteres.") });
const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`), "Código de turma inválido: são 6 letras e números.")
});

export interface ClassStudentRow {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  totalPoints: number;
  solvedChallenges: number;
  submissions: number;
  acceptanceRate: number;
  lastActivity: string | null;
  byTrack: Record<string, number>;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  // Aspas duplas e proteção contra injeção de fórmula ao abrir no Excel.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export class ClassService {
  constructor(private readonly store: CodeLabStore, private readonly now: () => Date = () => new Date()) {}

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
      if (!(await this.store.findClassByCode(code))) return code;
    }
    throw new DomainError("Não foi possível gerar um código de turma. Tente de novo.", 503);
  }

  async create(owner: User, input: unknown): Promise<ClassGroup> {
    const { name } = parseOrThrow(createSchema, input);
    return this.store.createClass({ id: randomUUID(), name, code: await this.uniqueCode(), ownerId: owner.id, createdAt: this.now() });
  }

  async list() {
    const classes = await this.store.listClasses();
    return Promise.all(
      classes.map(async (classGroup) => ({
        ...this.present(classGroup),
        ownerName: (await this.store.findUserById(classGroup.ownerId))?.name ?? "Professor removido",
        members: (await this.store.listClassMembers(classGroup.id)).length
      }))
    );
  }

  private present(classGroup: ClassGroup) {
    return { id: classGroup.id, name: classGroup.name, code: classGroup.code, ownerId: classGroup.ownerId, createdAt: classGroup.createdAt.toISOString() };
  }

  private async find(classId: string): Promise<ClassGroup> {
    const classGroup = await this.store.findClassById(classId);
    if (!classGroup) throw new DomainError("Turma não encontrada.", 404);
    return classGroup;
  }

  /** Progresso de cada estudante da turma, para acompanhamento do professor. */
  async report(classId: string) {
    const classGroup = await this.find(classId);
    const [members, tracks, challenges] = await Promise.all([this.store.listClassMembers(classId), this.store.listTracks(), this.store.listChallenges()]);
    const trackOf = new Map<string, string>();
    tracks.forEach((track) => track.modules.forEach((module) => trackOf.set(module.id, track.slug)));
    const challengeTrack = new Map(challenges.map((challenge) => [challenge.id, challenge.moduleId ? trackOf.get(challenge.moduleId) : undefined]));

    const students: ClassStudentRow[] = await Promise.all(
      members.map(async (member) => {
        const [score, submissions] = await Promise.all([this.store.getScore(member.userId), this.store.listSubmissions(member.userId)]);
        const accepted = submissions.filter((submission) => submission.status === "accepted").length;
        const byTrack: Record<string, number> = Object.fromEntries(tracks.map((track) => [track.slug, 0]));
        for (const challengeId of score.solvedChallengeIds) {
          const track = challengeTrack.get(challengeId);
          if (track) byTrack[track] += 1;
        }
        const last = submissions.reduce<Date | null>((latest, submission) => (!latest || submission.submittedAt > latest ? submission.submittedAt : latest), null);
        return {
          userId: member.userId,
          name: member.user.name,
          email: member.user.email,
          joinedAt: member.joinedAt.toISOString(),
          totalPoints: score.totalPoints,
          solvedChallenges: score.solvedChallengeIds.length,
          submissions: submissions.length,
          acceptanceRate: submissions.length ? Math.round((accepted / submissions.length) * 100) : 0,
          lastActivity: last?.toISOString() ?? null,
          byTrack
        };
      })
    );
    students.sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
    return {
      classGroup: this.present(classGroup),
      tracks: tracks.map((track) => ({ slug: track.slug, title: track.title, total: challenges.filter((challenge) => challengeTrack.get(challenge.id) === track.slug).length })),
      students
    };
  }

  /** CSV (separado por ponto e vírgula, como o Excel em português espera) com BOM UTF-8. */
  async exportCsv(classId: string): Promise<{ filename: string; content: string }> {
    const { classGroup, tracks, students } = await this.report(classId);
    const header = ["Nome", "E-mail", "Entrou em", "Pontos", "Desafios resolvidos", "Submissões", "Aceitação (%)", "Última atividade", ...tracks.map((track) => `Resolvidos: ${track.title}`)];
    const rows = students.map((student) => [
      student.name,
      student.email,
      dayKey(new Date(student.joinedAt)),
      student.totalPoints,
      student.solvedChallenges,
      student.submissions,
      student.acceptanceRate,
      student.lastActivity ? dayKey(new Date(student.lastActivity)) : "",
      ...tracks.map((track) => student.byTrack[track.slug] ?? 0)
    ]);
    const content = `﻿${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
    const slug = classGroup.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "turma";
    return { filename: `turma-${slug}-${dayKey(this.now())}.csv`, content };
  }

  async remove(classId: string): Promise<void> {
    await this.find(classId);
    await this.store.deleteClass(classId);
  }

  async removeMember(classId: string, userId: string): Promise<void> {
    await this.find(classId);
    await this.store.removeClassMember(classId, userId);
  }

  async join(user: User, input: unknown) {
    const { code } = parseOrThrow(joinSchema, input);
    const classGroup = await this.store.findClassByCode(code);
    if (!classGroup) throw new DomainError("Nenhuma turma com esse código. Confira com o professor.", 404);
    await this.store.addClassMember({ classId: classGroup.id, userId: user.id, joinedAt: this.now() });
    return { id: classGroup.id, name: classGroup.name };
  }

  async myClasses(user: User) {
    const classes = await this.store.listUserClasses(user.id);
    return Promise.all(
      classes.map(async (classGroup) => ({ id: classGroup.id, name: classGroup.name, ownerName: (await this.store.findUserById(classGroup.ownerId))?.name ?? "Professor" }))
    );
  }

  async leave(user: User, classId: string): Promise<void> {
    await this.store.removeClassMember(classId, user.id);
  }
}
