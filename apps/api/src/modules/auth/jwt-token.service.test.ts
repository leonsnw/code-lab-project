import { describe, expect, it } from "vitest";
import { JwtTokenService } from "./jwt-token.service.js";

const student = {
  id: "user-1",
  name: "Ana Silva",
  email: "ana@email.com",
  role: "student" as const
};

describe("JwtTokenService", () => {
  it("emite e valida token com a identidade do usuario", () => {
    const service = new JwtTokenService("segredo-de-teste-com-32-caracteres");
    expect(service.verify(service.issue(student))).toEqual({ userId: student.id });
  });

  it("rejeita token adulterado ou assinado por outro segredo", () => {
    const issuer = new JwtTokenService("primeiro-segredo-com-32-caracteres");
    const verifier = new JwtTokenService("segundo-segredo-com-32-caracteres");
    expect(() => verifier.verify(issuer.issue(student))).toThrow(
      "Sessao invalida ou expirada. Entre novamente."
    );
  });
});
