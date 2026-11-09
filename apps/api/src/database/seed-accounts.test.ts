import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { seedDemoAccounts } from "./seed-accounts.js";

function fakePrisma() {
  const userUpsert = vi.fn().mockResolvedValue({});
  const scoreUpsert = vi.fn().mockResolvedValue({});
  const prisma = { user: { upsert: userUpsert }, score: { upsert: scoreUpsert } } as unknown as PrismaClient;
  return { prisma, userUpsert, scoreUpsert };
}

const accountCall = (userUpsert: ReturnType<typeof vi.fn>, id: string) =>
  userUpsert.mock.calls.map(([args]) => args).find((args) => args.where.id === id);

describe("seedDemoAccounts", () => {
  it("não regrava senha nem nome das contas que já existem (update vazio)", async () => {
    const { prisma, userUpsert } = fakePrisma();

    await seedDemoAccounts(prisma, {});

    expect(userUpsert).toHaveBeenCalledTimes(2);
    for (const [args] of userUpsert.mock.calls) {
      expect(args.update).toEqual({});
    }
  });

  it("cria a conta nova com as senhas públicas por padrão", async () => {
    const { prisma, userUpsert } = fakePrisma();

    await seedDemoAccounts(prisma, {});

    expect(await bcrypt.compare("123456", accountCall(userUpsert, "user-marina").create.passwordHash)).toBe(true);
    expect(await bcrypt.compare("admin123", accountCall(userUpsert, "user-admin").create.passwordHash)).toBe(true);
    expect(accountCall(userUpsert, "user-admin").create).toMatchObject({ role: "ADMIN", email: "admin@codelab.local" });
  });

  it("usa SEED_ADMIN_PASSWORD e SEED_STUDENT_PASSWORD na criação, quando definidas", async () => {
    const { prisma, userUpsert } = fakePrisma();

    await seedDemoAccounts(prisma, {
      SEED_ADMIN_PASSWORD: "senha-forte-do-admin",
      SEED_STUDENT_PASSWORD: "senha-do-estudante"
    });

    expect(
      await bcrypt.compare("senha-forte-do-admin", accountCall(userUpsert, "user-admin").create.passwordHash)
    ).toBe(true);
    expect(await bcrypt.compare("admin123", accountCall(userUpsert, "user-admin").create.passwordHash)).toBe(false);
    expect(await bcrypt.compare("senha-do-estudante", accountCall(userUpsert, "user-marina").create.passwordHash)).toBe(
      true
    );
  });

  it("trata variável vazia como não definida", async () => {
    const { prisma, userUpsert } = fakePrisma();

    await seedDemoAccounts(prisma, { SEED_ADMIN_PASSWORD: "" });

    expect(await bcrypt.compare("admin123", accountCall(userUpsert, "user-admin").create.passwordHash)).toBe(true);
  });
});
