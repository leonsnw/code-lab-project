import { describe, expect, it } from "vitest";
import {
  buildAdminStatistics,
  type AdminStatisticsData
} from "./admin-statistics.js";

const data: AdminStatisticsData = {
  users: [
    { id: "user-1", name: "Ana", role: "student", totalPoints: 100 },
    { id: "user-2", name: "Bia", role: "student", totalPoints: 200 },
    { id: "user-admin", name: "Admin", role: "admin", totalPoints: 0 }
  ],
  challenges: [
    {
      id: "challenge-a",
      title: "Desafio A",
      slug: "desafio-a",
      difficulty: "easy",
      isActive: true
    },
    {
      id: "challenge-b",
      title: "Desafio B",
      slug: "desafio-b",
      difficulty: "medium",
      isActive: false
    }
  ],
  submissions: [
    { challengeId: "challenge-a", userId: "user-1", status: "accepted" },
    {
      challengeId: "challenge-a",
      userId: "user-1",
      status: "wrong_answer"
    },
    { challengeId: "challenge-b", userId: "user-2", status: "accepted" }
  ],
  comments: [
    { challengeId: "challenge-a" },
    { challengeId: "challenge-a" },
    { challengeId: "challenge-b" }
  ],
  ratings: [
    { challengeId: "challenge-a", value: 5 },
    { challengeId: "challenge-a", value: 4 },
    { challengeId: "challenge-b", value: 3 }
  ]
};

describe("buildAdminStatistics", () => {
  it("calcula indicadores gerais com percentuais e medias arredondados", () => {
    const statistics = buildAdminStatistics(data);

    expect(statistics.overview).toEqual({
      totalUsers: 3,
      totalStudents: 2,
      totalAdmins: 1,
      totalChallenges: 2,
      activeChallenges: 1,
      inactiveChallenges: 1,
      totalSubmissions: 3,
      acceptedSubmissions: 2,
      acceptanceRate: 66.7,
      totalComments: 3,
      totalRatings: 3,
      averageRating: 4
    });
    expect(statistics.submissionStatuses).toEqual({
      pending: 0,
      accepted: 2,
      wrong_answer: 1,
      runtime_error: 0,
      timeout: 0,
      compile_error: 0,
      rule_violation: 0,
      internal_error: 0
    });
  });

  it("calcula desempenho por desafio sem contar usuarios repetidos", () => {
    const statistics = buildAdminStatistics(data);

    expect(statistics.challenges[0]).toEqual({
      id: "challenge-a",
      title: "Desafio A",
      slug: "desafio-a",
      difficulty: "easy",
      isActive: true,
      totalSubmissions: 2,
      acceptedSubmissions: 1,
      acceptanceRate: 50,
      errorRate: 50,
      participants: 1,
      solvers: 1,
      totalComments: 2,
      totalRatings: 2,
      averageRating: 4.5,
      failures: { wrong_answer: 1, runtime_error: 0, timeout: 0, compile_error: 0, rule_violation: 0 },
      mainFailure: "wrong_answer"
    });
  });

  it("agrega por dificuldade, usuario e destaca extremos", () => {
    const statistics = buildAdminStatistics(data);

    expect(statistics.difficulties).toEqual([
      {
        difficulty: "easy",
        totalChallenges: 1,
        totalSubmissions: 2,
        acceptedSubmissions: 1,
        acceptanceRate: 50,
        participants: 1,
        solvers: 1
      },
      {
        difficulty: "medium",
        totalChallenges: 1,
        totalSubmissions: 1,
        acceptedSubmissions: 1,
        acceptanceRate: 100,
        participants: 1,
        solvers: 1
      },
      {
        difficulty: "hard",
        totalChallenges: 0,
        totalSubmissions: 0,
        acceptedSubmissions: 0,
        acceptanceRate: 0,
        participants: 0,
        solvers: 0
      }
    ]);
    expect(statistics.users[0]).toEqual({
      id: "user-2",
      name: "Bia",
      role: "student",
      totalPoints: 200,
      totalSubmissions: 1,
      acceptedSubmissions: 1,
      acceptanceRate: 100,
      solvedChallenges: 1
    });
    expect(statistics.highlights).toEqual({
      mostSolvedChallenge: {
        id: "challenge-a",
        title: "Desafio A",
        solvers: 1
      },
      highestErrorRateChallenge: {
        id: "challenge-a",
        title: "Desafio A",
        errorRate: 50
      }
    });
  });

  it("usa zero quando ainda nao existem interacoes", () => {
    const statistics = buildAdminStatistics({
      users: [],
      challenges: [],
      submissions: [],
      comments: [],
      ratings: []
    });

    expect(statistics.overview.acceptanceRate).toBe(0);
    expect(statistics.overview.averageRating).toBe(0);
    expect(statistics.challenges).toEqual([]);
    expect(statistics.highlights).toEqual({
      mostSolvedChallenge: null,
      highestErrorRateChallenge: null
    });
  });
});
