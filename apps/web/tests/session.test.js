import { describe, expect, it, vi } from "vitest";
import {
  getSession,
  isSolved,
  login,
  logout,
  onSessionChange,
  refreshSession,
  register
} from "../public/js/session.js";
import { meResponse, mockApi } from "./helpers.js";

describe("sessão", () => {
  it("refreshSession carrega usuário, pontuação e progresso e avisa os ouvintes", async () => {
    mockApi({ "GET /api/me": meResponse() });
    const ouvinte = vi.fn();
    const cancelar = onSessionChange(ouvinte);
    const sessao = await refreshSession();
    expect(sessao.user.name).toBe("Marina Silva");
    expect(sessao.loaded).toBe(true);
    expect(getSession()).toBe(sessao);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    cancelar();
    await refreshSession();
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it("401 significa visitante, e não erro", async () => {
    mockApi({ "GET /api/me": { status: 401, body: { error: "Não autenticado" } } });
    const sessao = await refreshSession();
    expect(sessao.user).toBeNull();
    expect(sessao.loaded).toBe(true);
  });

  it("outros erros são repassados à tela", async () => {
    mockApi({ "GET /api/me": { status: 500, body: { error: "Falha" } } });
    await expect(refreshSession()).rejects.toMatchObject({ status: 500 });
  });

  it("login e cadastro autenticam e recarregam a sessão", async () => {
    const fetchMock = mockApi({
      "POST /api/auth/login": { ok: true },
      "POST /api/auth/register": { ok: true },
      "GET /api/me": meResponse()
    });
    expect((await login("a@b.com", "x")).user.id).toBe("u1");
    expect((await register("Ana", "a@b.com", "12345678")).user.id).toBe("u1");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/auth/login",
      "/api/me",
      "/api/auth/register",
      "/api/me"
    ]);
  });

  it("logout limpa a sessão mesmo quando a API falha", async () => {
    mockApi({ "GET /api/me": meResponse(), "POST /api/auth/logout": { status: 500, body: { error: "x" } } });
    await refreshSession();
    await expect(logout()).rejects.toBeTruthy();
    expect(getSession().user).toBeNull();
  });

  it("isSolved consulta os desafios resolvidos da pontuação", async () => {
    mockApi({ "GET /api/me": meResponse() });
    await refreshSession();
    expect(isSolved("c1")).toBe(true);
    expect(isSolved("c2")).toBe(false);
    mockApi({ "GET /api/me": { status: 401, body: { error: "x" } } });
    await refreshSession();
    expect(isSolved("c1")).toBe(false);
  });
});
