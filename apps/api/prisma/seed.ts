import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const tags = [
  { id: "tag-logica", name: "Logica", slug: "logica" },
  { id: "tag-entrada-saida", name: "Entrada/Saida", slug: "entrada-saida" },
  { id: "tag-iniciante", name: "Iniciante", slug: "iniciante" },
  { id: "tag-condicionais", name: "Condicionais", slug: "condicionais" }
];

const challenges = [
  {
    id: "challenge-soma",
    slug: "soma-de-dois-numeros",
    title: "Soma de Dois Numeros",
    difficulty: "EASY" as const,
    points: 100,
    description:
      "Crie um programa que leia dois numeros inteiros e exiba a soma entre eles.",
    constraints: [
      "A entrada contem dois numeros inteiros separados por espaco.",
      "Os valores ficam entre -1000 e 1000.",
      "A saida deve conter apenas o resultado da soma."
    ],
    examples: [{ input: "3 5", output: "8" }],
    tagIds: ["tag-logica", "tag-entrada-saida", "tag-iniciante"],
    testCases: [
      {
        id: "tc-soma-publico-1",
        input: "3 5",
        expectedOutput: "8",
        isPublic: true,
        weight: 1
      },
      {
        id: "tc-soma-privado-1",
        input: "-2 10",
        expectedOutput: "8",
        isPublic: false,
        weight: 1
      },
      {
        id: "tc-soma-privado-2",
        input: "0 0",
        expectedOutput: "0",
        isPublic: false,
        weight: 1
      }
    ]
  },
  {
    id: "challenge-par-ou-impar",
    slug: "par-ou-impar",
    title: "Par ou Impar",
    difficulty: "EASY" as const,
    points: 80,
    description:
      "Leia um numero inteiro e exiba PAR caso ele seja divisivel por 2 ou IMPAR caso contrario.",
    constraints: [
      "A entrada contem um unico numero inteiro.",
      "A saida deve ser exatamente PAR ou IMPAR."
    ],
    examples: [{ input: "4", output: "PAR" }],
    tagIds: ["tag-condicionais", "tag-entrada-saida", "tag-iniciante"],
    testCases: [
      {
        id: "tc-par-publico-1",
        input: "4",
        expectedOutput: "PAR",
        isPublic: true,
        weight: 1
      },
      {
        id: "tc-par-privado-1",
        input: "7",
        expectedOutput: "IMPAR",
        isPublic: false,
        weight: 1
      }
    ]
  },
  {
    id: "challenge-maior-de-tres",
    slug: "maior-de-tres-numeros",
    title: "Maior de Tres Numeros",
    difficulty: "MEDIUM" as const,
    points: 150,
    description:
      "Leia tres numeros inteiros e exiba o maior valor entre eles.",
    constraints: [
      "A entrada contem tres numeros inteiros separados por espaco.",
      "Os valores ficam entre -10000 e 10000.",
      "A saida deve conter apenas o maior valor."
    ],
    examples: [{ input: "3 8 5", output: "8" }],
    tagIds: ["tag-logica", "tag-condicionais", "tag-entrada-saida"],
    testCases: [
      {
        id: "tc-maior-publico-1",
        input: "3 8 5",
        expectedOutput: "8",
        isPublic: true,
        weight: 1
      },
      {
        id: "tc-maior-privado-1",
        input: "-5 -2 -9",
        expectedOutput: "-2",
        isPublic: false,
        weight: 1
      },
      {
        id: "tc-maior-privado-2",
        input: "7 7 1",
        expectedOutput: "7",
        isPublic: false,
        weight: 1
      }
    ]
  }
];

async function main() {
  const [studentPasswordHash, adminPasswordHash] = await Promise.all([
    bcrypt.hash("123456", 10),
    bcrypt.hash("admin123", 10)
  ]);

  await prisma.user.upsert({
    where: { id: "user-marina" },
    create: {
      id: "user-marina",
      name: "Marina Silva",
      email: "marina@codelab.local",
      passwordHash: studentPasswordHash,
      role: "STUDENT"
    },
    update: {
      name: "Marina Silva",
      email: "marina@codelab.local",
      passwordHash: studentPasswordHash,
      role: "STUDENT"
    }
  });
  await prisma.user.upsert({
    where: { id: "user-admin" },
    create: {
      id: "user-admin",
      name: "Professor Henrique",
      email: "admin@codelab.local",
      passwordHash: adminPasswordHash,
      role: "ADMIN"
    },
    update: {
      name: "Professor Henrique",
      email: "admin@codelab.local",
      passwordHash: adminPasswordHash,
      role: "ADMIN"
    }
  });
  await prisma.score.upsert({
    where: { userId: "user-marina" },
    create: {
      id: "score-marina",
      userId: "user-marina",
      totalPoints: 0
    },
    update: {}
  });

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { id: tag.id },
      create: tag,
      update: { name: tag.name, slug: tag.slug }
    });
  }

  for (const challenge of challenges) {
    const commonData = {
      slug: challenge.slug,
      title: challenge.title,
      difficulty: challenge.difficulty,
      points: challenge.points,
      description: challenge.description,
      constraints: challenge.constraints,
      examples: challenge.examples,
      isActive: true,
      createdBy: "user-admin"
    };
    const relations = {
      tags: {
        create: challenge.tagIds.map((tagId) => ({
          tag: { connect: { id: tagId } }
        }))
      },
      testCases: {
        create: challenge.testCases
      }
    };

    await prisma.challenge.upsert({
      where: { id: challenge.id },
      create: {
        id: challenge.id,
        ...commonData,
        ...relations
      },
      update: {
        ...commonData,
        tags: {
          deleteMany: {},
          ...relations.tags
        },
        testCases: {
          deleteMany: {},
          ...relations.testCases
        }
      }
    });
  }

  console.log("Seed idempotente do CodeLab concluido.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
