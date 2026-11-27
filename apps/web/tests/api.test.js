import { describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../public/js/api.js";
import { mockApi, respond } from "./helpers.js";

describe("cliente da API", () => {
  it("envia JSON com cookies de sessão e devolve o corpo", async () => {
    const fetchMock = mockApi({ "POST /api/auth/login": { ok: true } });
    await expect(api.login("a@b.com", "segredo123")).resolves.toEqual({ ok: true });
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(opcoes).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" }
    });
    expect(JSON.parse(opcoes.body)).toEqual({ email: "a@b.com", password: "segredo123" });
  });

  it("requisições sem corpo não mandam Content-Type", async () => {
    const fetchMock = mockApi({ "GET /api/me": {} });
    await api.me();
    expect(fetchMock.mock.calls[0][1].headers).toEqual({});
  });

  it("transforma erro HTTP em ApiError com a mensagem do servidor e o status", async () => {
    mockApi({ "GET /api/me": { status: 401, body: { error: "Não autenticado." } } });
    const erro = await api.me().catch((e) => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.message).toBe("Não autenticado.");
    expect(erro.status).toBe(401);
  });

  it("usa uma mensagem genérica quando o corpo não traz erro ou não é JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502, text: async () => "<html>Bad Gateway</html>" }))
    );
    await expect(api.me()).rejects.toMatchObject({ message: "Erro 502 ao chamar a API.", status: 502 });
  });

  it("falha de rede vira ApiError de status 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    await expect(api.me()).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("Não foi possível conectar")
    });
  });

  it("resposta vazia devolve null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond(200, undefined))
    );
    await expect(api.logout()).resolves.toBeNull();
  });

  it("codifica parâmetros de URL", async () => {
    const fetchMock = mockApi({ "GET /api/challenges/a%2Fb": {} });
    await api.challenge("a/b");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/challenges/a%2Fb");
  });

  it("monta as consultas de listagem com filtros opcionais", async () => {
    const fetchMock = mockApi({
      "GET /api/challenges": {},
      "GET /api/submissions": {},
      "GET /api/ranking": {},
      "GET /api/challenges/soma/runtime": {}
    });
    await api.challenges("easy");
    await api.challenges();
    await api.submissions({ status: "accepted", page: 2, limit: 10 });
    await api.submissions();
    await api.ranking({ period: "semana", track: "fundamentos" });
    await api.ranking({ period: "tudo" });
    await api.runtime("soma", "c", 12);
    await api.runtime("soma", "c", null);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/challenges?difficulty=easy",
      "/api/challenges",
      "/api/submissions?status=accepted&page=2&limit=10",
      "/api/submissions",
      "/api/ranking?periodo=semana&trilha=fundamentos",
      "/api/ranking",
      "/api/challenges/soma/runtime?language=c&ms=12",
      "/api/challenges/soma/runtime?language=c"
    ]);
  });

  it("cada ação usa o método HTTP e o caminho certos", async () => {
    const fetchMock = mockApi({});
    const chamadas = [
      [() => api.register("Ana", "a@b.com", "12345678"), "POST", "/api/auth/register"],
      [() => api.forgotPassword("a@b.com"), "POST", "/api/auth/forgot-password"],
      [() => api.resetPassword("t", "12345678"), "POST", "/api/auth/reset-password"],
      [() => api.verifyEmail("t"), "POST", "/api/auth/verify-email"],
      [() => api.updateProfile("Ana"), "PATCH", "/api/me"],
      [() => api.changePassword("a", "b"), "PUT", "/api/me/password"],
      [() => api.deleteAccount("x"), "DELETE", "/api/me"],
      [() => api.joinClass("ABC123"), "POST", "/api/classes/join"],
      [() => api.leaveClass("k1"), "DELETE", "/api/me/classes/k1"],
      [() => api.run("soma", "c", "int main(){}", "1 2"), "POST", "/api/challenges/soma/run"],
      [() => api.submit("soma", "c", "int main(){}"), "POST", "/api/challenges/soma/submissions"],
      [() => api.revealHint("soma"), "POST", "/api/challenges/soma/hints"],
      [() => api.revealSolution("soma"), "POST", "/api/challenges/soma/solution"],
      [() => api.completeLesson("l"), "POST", "/api/lessons/l/complete"],
      [() => api.addComment("soma", "oi"), "POST", "/api/challenges/soma/comments"],
      [() => api.rate("soma", 5), "PUT", "/api/challenges/soma/rating"],
      [() => api.admin.create({}), "POST", "/api/admin/challenges"],
      [() => api.admin.update("1", {}), "PUT", "/api/admin/challenges/1"],
      [() => api.admin.remove("1"), "DELETE", "/api/admin/challenges/1"],
      [() => api.admin.createClass("T"), "POST", "/api/admin/classes"],
      [() => api.admin.removeClassMember("1", "2"), "DELETE", "/api/admin/classes/1/members/2"]
    ];
    for (const [chamar] of chamadas) await chamar().catch(() => undefined);
    expect(fetchMock.mock.calls.map(([url, opcoes]) => [opcoes.method, url])).toEqual(
      chamadas.map(([, metodo, caminho]) => [metodo, caminho])
    );
    expect(api.admin.classCsvUrl("k 1")).toBe("/api/admin/classes/k%201/export.csv");
  });
});
