import type {
  Challenge,
  ScoreSummary,
  UserCredentials
} from "../domain/types.js";

const studentId = "user-marina";
const adminId = "user-admin";

export function buildSeedData(): {
  users: UserCredentials[];
  challenges: Challenge[];
  scores: ScoreSummary[];
} {
  const users: UserCredentials[] = [
    {
      id: studentId,
      name: "Marina Silva",
      email: "marina@codelab.local",
      role: "student",
      passwordHash:
        "$2b$10$fH3DkQnuSlijgJH9aknS6.aP8l5.uolrmIvkHdjFk.55mx7l9Puri"
    },
    {
      id: adminId,
      name: "Professor Henrique",
      email: "admin@codelab.local",
      role: "admin",
      passwordHash:
        "$2b$10$Xbta0b/UjXloCggKssF8YOZawYGElB3QRDJlxHDFQ/NqiFK4nwFae"
    }
  ];

  const challenges: Challenge[] = [
    {
      id: "challenge-soma",
      slug: "soma-de-dois-numeros",
      title: "Soma de Dois Numeros",
      difficulty: "easy",
      points: 100,
      description:
        "Crie um programa que leia dois numeros inteiros e exiba a soma entre eles.",
      constraints: [
        "A entrada contem dois numeros inteiros separados por espaco.",
        "Os valores ficam entre -1000 e 1000.",
        "A saida deve conter apenas o resultado da soma."
      ],
      tags: ["Logica", "Entrada/Saida", "Iniciante"],
      examples: [
        {
          input: "3 5",
          output: "8"
        }
      ],
      isActive: true,
      createdBy: adminId,
      testCases: [
        {
          id: "tc-soma-publico-1",
          challengeId: "challenge-soma",
          input: "3 5",
          expectedOutput: "8",
          isPublic: true,
          weight: 1
        },
        {
          id: "tc-soma-privado-1",
          challengeId: "challenge-soma",
          input: "-2 10",
          expectedOutput: "8",
          isPublic: false,
          weight: 1
        },
        {
          id: "tc-soma-privado-2",
          challengeId: "challenge-soma",
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
      difficulty: "easy",
      points: 80,
      description:
        "Leia um numero inteiro e exiba PAR caso ele seja divisivel por 2 ou IMPAR caso contrario.",
      constraints: [
        "A entrada contem um unico numero inteiro.",
        "A saida deve ser exatamente PAR ou IMPAR."
      ],
      tags: ["Condicionais", "Entrada/Saida", "Iniciante"],
      examples: [
        {
          input: "4",
          output: "PAR"
        }
      ],
      isActive: true,
      createdBy: adminId,
      testCases: [
        {
          id: "tc-par-publico-1",
          challengeId: "challenge-par-ou-impar",
          input: "4",
          expectedOutput: "PAR",
          isPublic: true,
          weight: 1
        },
        {
          id: "tc-par-privado-1",
          challengeId: "challenge-par-ou-impar",
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
      difficulty: "medium",
      points: 150,
      description:
        "Leia tres numeros inteiros e exiba o maior valor entre eles.",
      constraints: [
        "A entrada contem tres numeros inteiros separados por espaco.",
        "Os valores ficam entre -10000 e 10000.",
        "A saida deve conter apenas o maior valor."
      ],
      tags: ["Logica", "Condicionais", "Entrada/Saida"],
      examples: [
        {
          input: "3 8 5",
          output: "8"
        }
      ],
      isActive: true,
      createdBy: adminId,
      testCases: [
        {
          id: "tc-maior-publico-1",
          challengeId: "challenge-maior-de-tres",
          input: "3 8 5",
          expectedOutput: "8",
          isPublic: true,
          weight: 1
        },
        {
          id: "tc-maior-privado-1",
          challengeId: "challenge-maior-de-tres",
          input: "-5 -2 -9",
          expectedOutput: "-2",
          isPublic: false,
          weight: 1
        },
        {
          id: "tc-maior-privado-2",
          challengeId: "challenge-maior-de-tres",
          input: "7 7 1",
          expectedOutput: "7",
          isPublic: false,
          weight: 1
        }
      ]
    }
  ];

  const scores: ScoreSummary[] = [
    {
      userId: studentId,
      totalPoints: 0,
      solvedChallengeIds: [],
      updatedAt: new Date()
    }
  ];

  return { users, challenges, scores };
}

export const defaultStudentId = studentId;
