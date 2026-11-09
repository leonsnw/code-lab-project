import type { SubmissionStatus } from "./types.js";

/** Status que ainda não são um veredito sobre o código: na fila do avaliador ou falha do sandbox. */
const WITHOUT_VERDICT: ReadonlySet<SubmissionStatus> = new Set<SubmissionStatus>(["pending", "internal_error"]);

/**
 * Diz se a submissão já recebeu um veredito sobre o código da pessoa. Só essas
 * entram nas taxas de aceitação e de erro: quem espera na fila não errou, e uma
 * falha do servidor não é culpa de quem enviou. Estatísticas do administrador e
 * relatório da turma usam esta mesma regra para não divergir.
 */
export function isEvaluated(status: SubmissionStatus): boolean {
  return !WITHOUT_VERDICT.has(status);
}
