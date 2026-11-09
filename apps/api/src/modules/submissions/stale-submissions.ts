import type { CodeLabStore } from "../../database/codelab-store.js";
import { INTERNAL_EVALUATION_ERROR_MESSAGE } from "./submission.service.js";

/**
 * Tempo máximo para uma submissão estar `pending`. Uma avaliação leva de segundos
 * a poucos minutos no pior caso (compilação de até 20 s, vários casos com tempo
 * limite e a fila do juiz); passado isso, a API que a recebeu caiu ou reiniciou
 * e ninguém mais vai concluí-la.
 */
export const STALE_PENDING_AFTER_MS = 10 * 60 * 1000;

/** Intervalo da varredura periódica, para não depender de um novo reinício da API. */
export const STALE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Fecha como `internal_error` as submissões `pending` antigas demais. O aluno passa
 * a ver que houve um erro do servidor e que deve reenviar (em vez de "Aguardando"
 * para sempre), e as estatísticas já ignoram esse status. Devolve quantas foram fechadas.
 */
export async function failStalePendingSubmissions(
  store: CodeLabStore,
  options: { now?: Date; staleAfterMs?: number } = {}
): Promise<number> {
  const now = options.now ?? new Date();
  return store.failStalePendingSubmissions({
    submittedBefore: new Date(now.getTime() - (options.staleAfterMs ?? STALE_PENDING_AFTER_MS)),
    evaluatedAt: now,
    errorMessage: INTERNAL_EVALUATION_ERROR_MESSAGE
  });
}

/**
 * Roda a limpeza agora (cobre o que ficou preso antes da subida) e de tempos em
 * tempos (cobre o caso de a API reiniciar segundos depois de receber um envio: ele
 * ainda é recente na subida e só passaria a ser "antigo" depois). Devolve a função
 * que para a varredura.
 */
export function startStaleSubmissionSweeper(
  store: CodeLabStore,
  options: { intervalMs?: number; log?: (message: string) => void } = {}
): () => void {
  const log = options.log ?? ((message: string) => console.log(message));
  const sweep = () =>
    failStalePendingSubmissions(store)
      .then((closed) => {
        if (closed > 0) log(`${closed} submissão(ões) presas em "pending" foram fechadas como internal_error.`);
      })
      .catch((error) => console.error("Falha ao limpar submissões presas em pending:", error));

  void sweep();
  const timer = setInterval(sweep, options.intervalMs ?? STALE_SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
