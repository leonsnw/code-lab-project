import { FUNDAMENTOS_CONTROLE_LESSONS } from "./fundamentos-controle.js";
import { FUNDAMENTOS_COLECOES_LESSONS } from "./fundamentos-colecoes.js";
import { ED_ALGORITMOS_LESSONS } from "./ed-algoritmos.js";
import { ED_LINEARES_LESSONS } from "./ed-lineares.js";
import { ED_HIERARQUICAS_LESSONS } from "./ed-hierarquicas.js";
import { ALGORITMOS_PADROES_LESSONS } from "./algoritmos-padroes.js";
import { ALGORITMOS_AVANCADOS_LESSONS } from "./algoritmos-avancados.js";
import { ENTREVISTAS_LINEARES_LESSONS } from "./entrevistas-lineares.js";
import { ENTREVISTAS_AVANCADAS_LESSONS } from "./entrevistas-avancadas.js";

export interface LessonDefinition {
  slug: string;
  title: string;
  summary: string;
  content: string;
  estimatedMinutes?: number;
}

/** Lições por módulo (slug do módulo → lições em ordem). */
export const LESSONS: Record<string, LessonDefinition[]> = {
  ...FUNDAMENTOS_CONTROLE_LESSONS,
  ...FUNDAMENTOS_COLECOES_LESSONS,
  ...ED_ALGORITMOS_LESSONS,
  ...ED_LINEARES_LESSONS,
  ...ED_HIERARQUICAS_LESSONS,
  ...ALGORITMOS_PADROES_LESSONS,
  ...ALGORITMOS_AVANCADOS_LESSONS,
  ...ENTREVISTAS_LINEARES_LESSONS,
  ...ENTREVISTAS_AVANCADAS_LESSONS,
};
