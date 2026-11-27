import { describe, expect, it, vi } from "vitest";
import { matchRoute, navigate, parseLocation } from "../public/js/router.js";

describe("router", () => {
  it("parseLocation lê caminho e query do hash", () => {
    window.location.hash = "#/desafios/soma?aba=casos&x=1";
    const { path, query } = parseLocation();
    expect(path).toBe("/desafios/soma");
    expect(query.get("aba")).toBe("casos");
  });

  it("parseLocation assume / sem hash", () => {
    window.location.hash = "";
    expect(parseLocation().path).toBe("/");
  });

  it("matchRoute extrai parâmetros e decodifica", () => {
    const rotas = [{ path: "/" }, { path: "/desafios/:slug" }, { path: "/u/:id/x/:n" }];
    expect(matchRoute(rotas, "/desafios/soma%20dois").params).toEqual({ slug: "soma dois" });
    expect(matchRoute(rotas, "/desafios/soma/").route.path).toBe("/desafios/:slug");
    expect(matchRoute(rotas, "/u/7/x/9").params).toEqual({ id: "7", n: "9" });
    expect(matchRoute(rotas, "/")).not.toBeNull();
    expect(matchRoute(rotas, "/nao-existe")).toBeNull();
  });

  it("navigate muda o hash e redispara a rota quando o destino é o atual", () => {
    navigate("/trilhas");
    expect(window.location.hash).toBe("#/trilhas");
    const ouvinte = vi.fn();
    window.addEventListener("hashchange", ouvinte);
    navigate("/trilhas");
    expect(ouvinte).toHaveBeenCalled();
    window.removeEventListener("hashchange", ouvinte);
  });
});
