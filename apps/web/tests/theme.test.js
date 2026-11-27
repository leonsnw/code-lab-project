import { describe, expect, it, vi } from "vitest";
import { applyTheme, cycleTheme, getTheme, setTheme } from "../public/js/theme.js";

describe("tema", () => {
  it("começa seguindo o sistema e ignora valores inválidos salvos", () => {
    expect(getTheme()).toBe("system");
    localStorage.setItem("codelab-theme", "neon");
    expect(getTheme()).toBe("system");
  });

  it("setTheme salva a escolha e aplica no <html>", () => {
    setTheme("dark");
    expect(getTheme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("cycleTheme percorre sistema → claro → escuro → sistema", () => {
    expect(cycleTheme()).toBe("light");
    expect(cycleTheme()).toBe("dark");
    expect(cycleTheme()).toBe("system");
  });

  it("funciona mesmo sem armazenamento", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(getTheme()).toBe("system");
    setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
