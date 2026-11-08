import { createHash } from "node:crypto";

/**
 * Impressão digital curta do hash da senha, gravada no JWT. Trocar ou
 * redefinir a senha muda a impressão e invalida todas as sessões abertas,
 * sem precisar de uma lista de tokens revogados.
 */
export function passwordVersion(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url").slice(0, 16);
}
