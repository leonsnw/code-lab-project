import { PrismaClient } from "@prisma/client";
import { PrismaStore } from "../src/database/prisma-store.js";
import { seedDemoAccounts } from "../src/database/seed-accounts.js";
import { buildSeedData } from "../src/database/seed.js";

const prisma = new PrismaClient();
const store = new PrismaStore(prisma);

async function main() {
  // Contas de demonstração: só são criadas se ainda não existem (não regrava senha nem nome).
  await seedDemoAccounts(prisma);

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
