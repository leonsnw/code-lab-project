import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { createApp } from "./server.js";

const payload = {
  title: "Contagem de Vogais",
  slug: "contagem-de-vogais",
  description: "Leia uma palavra e informe quantas vogais ela possui.",
  difficulty: "easy",
  points: 90,
  constraints: ["A entrada possui somente letras sem espacos."],
  tags: ["Strings", "Iniciante"],
  examples: [{ input: "codelab", output: "3" }],
  testCases: [
    {
      input: "codelab",
      expectedOutput: "3",
      isPublic: true,
      weight: 1
    },
    {
      input: "xyz",
      expectedOutput: "0",
      isPublic: false,
      weight: 1
    }
  ]
};

function makeApp() {
  return createApp(new InMemoryStore(), {
    jwtSecret: "segredo-do-admin-com-32-caracteres",
    environment: "test"
  });
}

async function login(
  app: ReturnType<typeof createApp>,
  email: string,
  password: string
) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return agent;
}

describe("API administrativa de desafios", () => {
  it("exige autenticacao e papel de administrador", async () => {
    const app = makeApp();

    await request(app).get("/api/admin/challenges").expect(401);

    const student = await login(app, "marina@codelab.local", "123456");
    await student.get("/api/admin/challenges").expect(403);
    await student.post("/api/admin/challenges").send(payload).expect(403);
  });

  it("permite criar, consultar e editar um desafio completo", async () => {
    const app = makeApp();
    const admin = await login(app, "admin@codelab.local", "admin123");

    const creation = await admin.post("/api/admin/challenges").send(payload);
    expect(creation.status).toBe(201);
    expect(creation.body.challenge).toMatchObject({
      title: "Contagem de Vogais",
      createdBy: "user-admin",
      isActive: true
    });
    expect(creation.body.challenge.testCases).toHaveLength(2);
    const challengeId = creation.body.challenge.id;

    const detail = await admin.get(`/api/admin/challenges/${challengeId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.challenge.testCases[1]).toMatchObject({
      input: "xyz",
      isPublic: false
    });

    const edition = await admin
      .put(`/api/admin/challenges/${challengeId}`)
      .send({
        ...payload,
        title: "Contador de Vogais",
        points: 110,
        testCases: [payload.testCases[0]]
      });
    expect(edition.status).toBe(200);
    expect(edition.body.challenge).toMatchObject({
      title: "Contador de Vogais",
      points: 110
    });
    expect(edition.body.challenge.testCases).toHaveLength(1);

    const publicList = await request(app).get("/api/challenges");
    expect(
      publicList.body.challenges.some(
        (challenge: { slug: string }) => challenge.slug === payload.slug
      )
    ).toBe(true);
  });

  it("valida dados, impede slug duplicado e remove por desativacao", async () => {
    const app = makeApp();
    const admin = await login(app, "admin@codelab.local", "admin123");
    const student = await login(app, "marina@codelab.local", "123456");

    await admin
      .post("/api/admin/challenges")
      .send({ ...payload, testCases: [] })
      .expect(400);
    await admin
      .post("/api/admin/challenges")
      .send({ ...payload, slug: "soma-de-dois-numeros" })
      .expect(409);

    const creation = await admin.post("/api/admin/challenges").send(payload);
    const challengeId = creation.body.challenge.id;
    const removal = await admin.delete(`/api/admin/challenges/${challengeId}`);

    expect(removal.status).toBe(200);
    expect(removal.body.challenge.isActive).toBe(false);
    const publicList = await request(app).get("/api/challenges");
    expect(
      publicList.body.challenges.some(
        (challenge: { slug: string }) => challenge.slug === payload.slug
      )
    ).toBe(false);
    await student.get(`/api/challenges/${payload.slug}`).expect(404);
    await student
      .post(`/api/challenges/${payload.slug}/comments`)
      .send({ content: "Nao deve aceitar." })
      .expect(404);
    await student
      .put(`/api/challenges/${payload.slug}/rating`)
      .send({ value: 5 })
      .expect(404);
    await student
      .post(`/api/challenges/${payload.slug}/submissions`)
      .send({ language: "javascript", sourceCode: "console.log(1);" })
      .expect(404);

    const adminList = await admin.get("/api/admin/challenges");
    expect(
      adminList.body.challenges.find(
        (challenge: { id: string }) => challenge.id === challengeId
      ).isActive
    ).toBe(false);
  });
});
