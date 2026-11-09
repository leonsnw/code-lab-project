import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Cria as contas de demonstração (estudante e administrador), sem mexer nas que já existem.
 *
 * O `update` do upsert é vazio de propósito: regravar a senha ou o nome a cada execução
 * desfaria a troca de senha do administrador sempre que o catálogo fosse atualizado com
 * `npm run db:seed`. As senhas iniciais só valem na primeira criação; em produção,
 * defina SEED_ADMIN_PASSWORD (e SEED_STUDENT_PASSWORD) para não usar as senhas públicas.
 */
export async function seedDemoAccounts(
  prisma: PrismaClient,
  env: Record<string, string | undefined> = process.env
): Promise<void> {
  const [studentPasswordHash, adminPasswordHash] = await Promise.all([
    bcrypt.hash(env.SEED_STUDENT_PASSWORD || "123456", 10),
    bcrypt.hash(env.SEED_ADMIN_PASSWORD || "admin123", 10)
  ]);

  const accounts = [
    {
      id: "user-marina",
      name: "Leonardo",
      email: "marina@codelab.local",
      passwordHash: studentPasswordHash,
      role: "STUDENT" as const
    },
    {
      id: "user-admin",
      name: "Professor Henrique",
      email: "admin@codelab.local",
      passwordHash: adminPasswordHash,
      role: "ADMIN" as const
    }
  ];
  for (const account of accounts) {
    await prisma.user.upsert({ where: { id: account.id }, create: account, update: {} });
  }
  await prisma.score.upsert({
    where: { userId: "user-marina" },
    create: { id: "score-marina", userId: "user-marina", totalPoints: 0 },
    update: {}
  });
}
