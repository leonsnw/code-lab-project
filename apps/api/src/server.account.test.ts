import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryStore } from "./database/in-memory-store.js";
import { MemoryMailer } from "./modules/mail/mailer.js";
import { createApp } from "./server.js";

function makeApp() {
  const mailer = new MemoryMailer();
  const store = new InMemoryStore();
  const app = createApp(store, { jwtSecret: "segredo-das-contas-com-32-caracteres!!", environment: "test", mailer, appUrl: "https://codelab.exemplo" });
  return { app, mailer, store };
}

const tokenFrom = (text: string) => text.match(/token=([\w-]+)/)?.[1] ?? "";

async function register(app: ReturnType<typeof createApp>, email = "conta@codelab.local", password = "senha-antiga") {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/register").send({ name: "Conta Teste", email, password }).expect(201);
  return { agent, id: response.body.user.id as string };
}

describe("verificacao de e-mail", () => {
  it("envia o link no cadastro e marca o e-mail como verificado", async () => {
    const { app, mailer } = makeApp();
    const { agent } = await register(app);

    expect(mailer.outbox).toHaveLength(1);
    expect(mailer.outbox[0]).toMatchObject({ to: "conta@codelab.local", subject: "Confirme seu e-mail no CodeLab" });
    expect(mailer.outbox[0].text).toContain("https://codelab.exemplo/#/verificar-email?token=");
    expect((await agent.get("/api/me/account")).body.account.emailVerified).toBe(false);

    await request(app).post("/api/auth/verify-email").send({ token: tokenFrom(mailer.outbox[0].text) }).expect(200);
    expect((await agent.get("/api/me/account")).body.account.emailVerified).toBe(true);
    // O link só vale uma vez.
    await request(app).post("/api/auth/verify-email").send({ token: tokenFrom(mailer.outbox[0].text) }).expect(400);
    await agent.post("/api/me/verification").expect(409);
  });

  it("um novo link invalida o anterior", async () => {
    const { app, mailer } = makeApp();
    const { agent } = await register(app);
    await agent.post("/api/me/verification").expect(200);
    await request(app).post("/api/auth/verify-email").send({ token: tokenFrom(mailer.outbox[0].text) }).expect(400);
    await request(app).post("/api/auth/verify-email").send({ token: tokenFrom(mailer.outbox[1].text) }).expect(200);
  });
});

describe("recuperacao de senha", () => {
  it("responde igual para e-mail inexistente e redefine a senha pelo link", async () => {
    const { app, mailer } = makeApp();
    const { agent } = await register(app);
    mailer.outbox.length = 0;

    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "ninguem@codelab.local" }).expect(200);
    const known = await request(app).post("/api/auth/forgot-password").send({ email: "CONTA@codelab.local" }).expect(200);
    expect(unknown.body.message).toBe(known.body.message);
    expect(mailer.outbox).toHaveLength(1);
    const token = tokenFrom(mailer.outbox[0].text);
    expect(mailer.outbox[0].text).toContain("/#/redefinir-senha?token=");

    await request(app).post("/api/auth/reset-password").send({ token, password: "123" }).expect(400);
    await request(app).post("/api/auth/reset-password").send({ token, password: "senha-nova" }).expect(200);
    await request(app).post("/api/auth/reset-password").send({ token, password: "outra-senha" }).expect(400);

    // A sessão aberta antes da troca deixa de valer.
    await agent.get("/api/me").expect(401);
    await request(app).post("/api/auth/login").send({ email: "conta@codelab.local", password: "senha-antiga" }).expect(401);
    await request(app).post("/api/auth/login").send({ email: "conta@codelab.local", password: "senha-nova" }).expect(200);
  });

  it("recusa link expirado", async () => {
    const mailer = new MemoryMailer();
    const store = new InMemoryStore();
    const app = createApp(store, { jwtSecret: "segredo-das-contas-com-32-caracteres!!", environment: "test", mailer });
    await register(app);
    await request(app).post("/api/auth/forgot-password").send({ email: "conta@codelab.local" }).expect(200);
    const token = tokenFrom(mailer.outbox.at(-1)!.text);
    const { createHash } = await import("node:crypto");
    const stored = await store.findAuthToken("password_reset", createHash("sha256").update(token).digest("hex"));
    stored!.expiresAt = new Date(Date.now() - 1000);
    await store.saveAuthToken(stored!);
    await request(app).post("/api/auth/reset-password").send({ token, password: "senha-nova" }).expect(400);
  });
});

describe("perfil e LGPD", () => {
  it("edita o nome e troca a senha mantendo so a sessao atual", async () => {
    const { app } = makeApp();
    const { agent } = await register(app);
    const other = request.agent(app);
    await other.post("/api/auth/login").send({ email: "conta@codelab.local", password: "senha-antiga" }).expect(200);

    const renamed = await agent.patch("/api/me").send({ name: "  Nome   Novo " }).expect(200);
    expect(renamed.body.user.name).toBe("Nome Novo");
    await agent.patch("/api/me").send({ name: "" }).expect(400);

    await agent.put("/api/me/password").send({ currentPassword: "errada", newPassword: "senha-nova" }).expect(400);
    await agent.put("/api/me/password").send({ currentPassword: "senha-antiga", newPassword: "senha-nova" }).expect(200);
    await agent.get("/api/me").expect(200);
    await other.get("/api/me").expect(401);
  });

  it("exporta os dados e apaga a conta com confirmacao de senha", async () => {
    const { app, store } = makeApp();
    const { agent, id } = await register(app);
    await agent.post("/api/challenges/soma-de-dois-numeros/submissions").send({ language: "javascript", sourceCode: "function somar(a, b) { return a + b; }" });
    await agent.post("/api/challenges/soma-de-dois-numeros/comments").send({ content: "Minha dúvida" }).expect(201);

    const exported = await agent.get("/api/me/export").expect(200);
    expect(exported.headers["content-disposition"]).toContain("codelab-meus-dados.json");
    expect(exported.body).toMatchObject({ user: { id, email: "conta@codelab.local" }, score: { totalPoints: 100 } });
    expect(exported.body.submissions).toHaveLength(1);
    expect(exported.body.comments[0].content).toBe("Minha dúvida");

    await agent.delete("/api/me").send({ password: "errada" }).expect(400);
    await agent.delete("/api/me").send({ password: "senha-antiga" }).expect(200);
    expect(await store.findUserById(id)).toBeUndefined();
    expect(await store.listSubmissions(id)).toEqual([]);
    await agent.get("/api/me").expect(401);
    await request(app).post("/api/auth/login").send({ email: "conta@codelab.local", password: "senha-antiga" }).expect(401);
  });

  it("impede administrador autor de desafios de apagar a conta por aqui", async () => {
    const { app } = makeApp();
    const admin = request.agent(app);
    await admin.post("/api/auth/login").send({ email: "admin@codelab.local", password: "admin123" }).expect(200);
    const response = await admin.delete("/api/me").send({ password: "admin123" });
    expect(response.status).toBe(409);
  });
});

describe("renovacao da sessao", () => {
  it("renova o cookie de sessoes antigas e mantem o de sessoes novas", async () => {
    const { app } = makeApp();
    const { agent } = await register(app);
    const fresh = await agent.get("/api/me").expect(200);
    expect(fresh.headers["set-cookie"]).toBeUndefined();

    const { default: jwt } = await import("jsonwebtoken");
    const cookie = (await request(app).post("/api/auth/login").send({ email: "conta@codelab.local", password: "senha-antiga" })).headers["set-cookie"][0];
    const token = cookie.split(";")[0].split("=")[1];
    const payload = jwt.decode(token) as { sub: string; pwv: string };
    const old = jwt.sign({ type: "access", pwv: payload.pwv, iat: Math.floor(Date.now() / 1000) - 5 * 60 * 60 }, "segredo-das-contas-com-32-caracteres!!", {
      subject: payload.sub,
      expiresIn: "8h",
      issuer: "codelab-api",
      audience: "codelab-web"
    });
    const renewed = await request(app).get("/api/me").set("Cookie", `codelab_session=${old}`).expect(200);
    expect(renewed.headers["set-cookie"]?.[0]).toContain("codelab_session=");
  });
});
