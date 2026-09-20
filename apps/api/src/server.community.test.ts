import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { createApp } from "./server.js";

function makeApp() {
  return createApp(new InMemoryStore(), {
    jwtSecret: "segredo-da-comunidade-com-32-caracteres",
    environment: "test"
  });
}

async function createStudent(
  app: ReturnType<typeof createApp>,
  name: string,
  email: string
) {
  const agent = request.agent(app);
  await agent.post("/api/auth/register").send({
    name,
    email,
    password: "123456"
  });
  return agent;
}

describe("API de comentarios e avaliacoes", () => {
  it("protege as interacoes e valida as entradas", async () => {
    const app = makeApp();

    await request(app)
      .post("/api/challenges/soma-de-dois-numeros/comments")
      .send({ content: "Comentario" })
      .expect(401);
    await request(app)
      .put("/api/challenges/soma-de-dois-numeros/rating")
      .send({ value: 5 })
      .expect(401);

    const student = await createStudent(app, "Ana Lima", "ana@community.test");
    await student
      .post("/api/challenges/soma-de-dois-numeros/comments")
      .send({ content: "   " })
      .expect(400);
    await student
      .post("/api/challenges/soma-de-dois-numeros/comments")
      .send({ content: "a".repeat(1001) })
      .expect(400);
    await student
      .put("/api/challenges/soma-de-dois-numeros/rating")
      .send({ value: 4.5 })
      .expect(400);
  });

  it("lista comentarios do mais recente para o mais antigo", async () => {
    const app = makeApp();
    const ana = await createStudent(app, "Ana Lima", "ana@community.test");
    const bia = await createStudent(app, "Bia Souza", "bia@community.test");

    const firstComment = await ana
      .post("/api/challenges/soma-de-dois-numeros/comments")
      .send({ userId: "user-admin", content: " Primeiro comentario. " })
      .expect(201);
    await bia
      .post("/api/challenges/soma-de-dois-numeros/comments")
      .send({ content: "Segundo comentario." })
      .expect(201);

    const response = await ana.get(
      "/api/challenges/soma-de-dois-numeros/comments"
    );

    expect(response.status).toBe(200);
    expect(response.body.comments).toHaveLength(2);
    expect(response.body.comments[0]).toMatchObject({
      content: "Segundo comentario.",
      author: { name: "Bia Souza" }
    });
    expect(response.body.comments[1]).toMatchObject({
      content: "Primeiro comentario.",
      author: { name: "Ana Lima" }
    });
    expect(firstComment.body.comment.userId).not.toBe("user-admin");
  });

  it("calcula a media e substitui a avaliacao anterior do usuario", async () => {
    const app = makeApp();
    const ana = await createStudent(app, "Ana Lima", "ana@community.test");
    const bia = await createStudent(app, "Bia Souza", "bia@community.test");

    await ana
      .put("/api/challenges/soma-de-dois-numeros/rating")
      .send({ value: 3 })
      .expect(200);
    await bia
      .put("/api/challenges/soma-de-dois-numeros/rating")
      .send({ value: 5 })
      .expect(200);
    const updated = await ana
      .put("/api/challenges/soma-de-dois-numeros/rating")
      .send({ value: 4 });

    expect(updated.body.rating.value).toBe(4);
    expect(updated.body.summary).toEqual({
      average: 4.5,
      total: 2,
      currentUserValue: 4
    });

    const biaView = await bia.get(
      "/api/challenges/soma-de-dois-numeros/rating"
    );
    expect(biaView.body.summary).toEqual({
      average: 4.5,
      total: 2,
      currentUserValue: 5
    });
  });
});
