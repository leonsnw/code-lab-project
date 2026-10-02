import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PrismaStore } from "../src/database/prisma-store.js";
import { buildSeedData } from "../src/database/seed.js";

const prisma = new PrismaClient();
const store = new PrismaStore(prisma);

async function main() {
  const [studentPasswordHash, adminPasswordHash] = await Promise.all([
    bcrypt.hash("123456", 10),
    bcrypt.hash("admin123", 10)
  ]);

  const accounts = [
    { id: "user-marina", name: "Marina Silva", email: "marina@codelab.local", passwordHash: studentPasswordHash, role: "STUDENT" as const },
    { id: "user-admin", name: "Professor Henrique", email: "admin@codelab.local", passwordHash: adminPasswordHash, role: "ADMIN" as const }
  ];
  for (const account of accounts) {
    const { id, ...data } = account;
    await prisma.user.upsert({ where: { id }, create: account, update: data });
  }
  await prisma.score.upsert({
    where: { userId: "user-marina" },
    create: { id: "score-marina", userId: "user-marina", totalPoints: 0 },
    update: {}
  });

  // Mesmo catálogo do store em memória: trilhas primeiro (os desafios
  // apontam para módulos), depois os desafios com as suítes completas.
  const { tracks, challenges } = buildSeedData();
  await store.replaceTracks(tracks);
  for (const challenge of challenges) {
    const existing = await store.findChallengeById(challenge.id);
    if (existing) {
      await store.updateChallenge(challenge);
    } else {
      await store.createChallenge(challenge);
    }
  }

  const modules = tracks.reduce((total, track) => total + track.modules.length, 0);
  console.log(`Seed idempotente do CodeLab concluido: ${tracks.length} trilhas, ${modules} modulos, ${challenges.length} desafios.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
