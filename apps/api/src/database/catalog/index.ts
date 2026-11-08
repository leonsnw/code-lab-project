import type { Challenge, Track } from "../../domain/types.js";
import { buildDataStructureChallenges } from "./estrutura-de-dados.js";
import { buildFundamentosChallenges } from "./fundamentos.js";
import { buildFundamentosControleChallenges } from "./fundamentos-controle.js";
import { buildFundamentosColecoesChallenges } from "./fundamentos-colecoes.js";
import { buildEdAlgoritmosChallenges } from "./ed-algoritmos.js";
import { buildEdLinearesChallenges } from "./ed-lineares.js";
import { buildEdHierarquicasChallenges } from "./ed-hierarquicas.js";
import { buildAlgoritmosPadroesChallenges } from "./algoritmos-padroes.js";
import { buildAlgoritmosAvancadosChallenges } from "./algoritmos-avancados.js";
import { buildEntrevistasLinearesChallenges } from "./entrevistas-lineares.js";
import { buildEntrevistasAvancadasChallenges } from "./entrevistas-avancadas.js";
import { buildTracks } from "./tracks.js";

export interface Catalog {
  tracks: Track[];
  challenges: Challenge[];
}

/**
 * Catálogo completo: trilhas, módulos, lições e desafios. Assunto e subtema
 * de cada desafio vêm do módulo em que ele está.
 */
export function buildCatalog(): Catalog {
  const tracks = buildTracks();
  const placement = new Map<string, { topic: string; subtopic: string }>();
  tracks.forEach((track) => track.modules.forEach((module) => placement.set(module.id, { topic: track.title, subtopic: module.title })));

  const challenges = [
    ...buildFundamentosChallenges(),
    ...buildFundamentosControleChallenges(),
    ...buildFundamentosColecoesChallenges(),
    ...buildDataStructureChallenges(),
    ...buildEdAlgoritmosChallenges(),
    ...buildEdLinearesChallenges(),
    ...buildEdHierarquicasChallenges(),
    ...buildAlgoritmosPadroesChallenges(),
    ...buildAlgoritmosAvancadosChallenges(),
    ...buildEntrevistasLinearesChallenges(),
    ...buildEntrevistasAvancadasChallenges(),
  ].map((challenge) => {
    const place = challenge.moduleId ? placement.get(challenge.moduleId) : undefined;
    if (!place) throw new Error(`Desafio ${challenge.slug} aponta para módulo inexistente: ${challenge.moduleId}`);
    return { ...challenge, ...place };
  });

  const slugs = new Set<string>();
  for (const challenge of challenges) {
    if (slugs.has(challenge.slug)) throw new Error(`Slug duplicado no catalogo: ${challenge.slug}`);
    slugs.add(challenge.slug);
    if (challenge.mode === "function") {
      for (const testCase of challenge.testCases) {
        const args = JSON.parse(testCase.input);
        // Com cycleParam, o último argumento extra é a posição do ciclo.
        const expected = challenge.functionSpec!.params.length + (challenge.functionSpec!.cycleParam ? 1 : 0);
        if (!Array.isArray(args) || args.length !== expected) {
          throw new Error(`Caso ${testCase.id} com número de argumentos diferente da assinatura.`);
        }
        JSON.parse(testCase.expectedOutput);
      }
    }
  }
  return { tracks, challenges };
}
