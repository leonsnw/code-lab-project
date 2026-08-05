import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const users = [
  {
    id: "user-marina",
    name: "Marina Silva",
    email: "marina@codelab.local",
    passwordHash: "$2b$10$fH3DkQnuSlijgJH9aknS6.aP8l5.uolrmIvkHdjFk.55mx7l9Puri",
    role: "STUDENT" as const
  },
  {
    id: "user-admin",
    name: "Professor Henrique",
    email: "admin@codelab.local",
    passwordHash: "$2b$10$Xbta0b/UjXloCggKssF8YOZawYGElB3QRDJlxHDFQ/NqiFK4nwFae",
    role: "ADMIN" as const
  }
];

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: user,
      update: {
        name: user.name,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role
      }
    });
  }
  console.log("Seed de autenticacao concluido.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
