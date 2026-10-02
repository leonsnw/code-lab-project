import type {
  Challenge,
  ChallengeLanguage,
  ChallengeMode,
  Complexity,
  Difficulty,
  FunctionSpec,
  OutputChecker,
  SourceRule,
  SubmissionLanguage,
  TestCase
} from "../../domain/types.js";
import { createRandom, generate, type GeneratedSpec } from "../../modules/submissions/generated-input.js";

export const ADMIN_ID = "user-admin";

/** Margem abaixo do limite de 64 KB de saída do juiz. */
export const MAX_CASE_BYTES = 48 * 1024;

// ---------- Aleatoriedade determinística ----------
/**
 * PRNG determinístico (mulberry32), o mesmo que o juiz usa para expandir
 * argumentos gerados. Casos aleatórios são gerados uma vez, no seed, então a
 * suíte é reproduzível entre execuções e entre stores.
 */
export { createRandom };

/**
 * Argumento gerado pelo juiz na hora de executar (vetores e textos enormes
 * sem inflar o caso guardado). `gen(spec).value` é o valor expandido, para
 * calcular a saída esperada; `gen(spec).spec` vai no caso.
 */
export function gen(spec: GeneratedSpec): { spec: GeneratedSpec; value: any } {
  return { spec, value: generate(spec) };
}

export function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function pick<T>(random: () => number, values: readonly T[]): T {
  return values[randomInt(random, 0, values.length - 1)];
}

export function shuffle<T>(random: () => number, values: readonly T[]): T[] {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = randomInt(random, 0, index);
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export function randomArray(random: () => number, length: number, min: number, max: number): number[] {
  return Array.from({ length }, () => randomInt(random, min, max));
}

export function randomWord(random: () => number, minLength = 2, maxLength = 10, alphabet = "abcdefghijklmnopqrstuvwxyz"): string {
  const length = randomInt(random, minLength, maxLength);
  let word = "";
  for (let index = 0; index < length; index += 1) word += alphabet[randomInt(random, 0, alphabet.length - 1)];
  return word;
}

export const byteOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error(`Valor sem precisao de centavos: ${cents}`);
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

// ---------- Casos ----------
export interface CaseDefinition {
  input: string;
  output: string;
}

/** Caso do modo função: argumentos e retorno viram JSON. */
export function call(args: unknown[], returns: unknown): CaseDefinition {
  return { input: JSON.stringify(args), output: JSON.stringify(returns) };
}

// ---------- Regras reutilizáveis ----------
export const rules = {
  recursion: (minDepth?: number): SourceRule => ({
    kind: "recursion",
    message: "Resolva com uma função recursiva (uma função que chama a si mesma).",
    ...(minDepth ? { minDepth } : {})
  }),
  noLoops: {
    kind: "forbid",
    pattern: "\\b(for|while)\\s*\\(|\\bdo\\s*\\{|\\bfor\\b.*\\bin\\b|\\bwhile\\b",
    message: "Não use laços (for, while ou do-while): a repetição deve vir da recursão."
  } satisfies SourceRule,
  noQsort: {
    kind: "forbid",
    pattern: "\\bqsort\\s*\\(",
    message: "Implemente o método de ordenação pedido: qsort da biblioteca padrão não é permitido."
  } satisfies SourceRule,
  noBuiltinSort: {
    kind: "forbid",
    pattern: "\\.sort\\s*\\(|\\bsorted\\s*\\(|\\bqsort\\s*\\(",
    message: "Implemente a ordenação: funções prontas de ordenar (sort, sorted, qsort) não são permitidas."
  } satisfies SourceRule,
  usesStruct: {
    kind: "require",
    pattern: "\\bstruct\\b",
    message: "Use um struct para agrupar os campos de cada registro (lista heterogenea)."
  } satisfies SourceRule,
  staticOnly: {
    kind: "forbid",
    pattern: "\\b(malloc|calloc|realloc)\\s*\\(",
    message: "Lista estática: use um vetor de tamanho fixo, sem alocação dinâmica."
  } satisfies SourceRule,
  usesMalloc: {
    kind: "require",
    pattern: "\\b(malloc|calloc)\\s*\\(",
    message: "Aloque cada nó dinamicamente com malloc (lista dinâmica)."
  } satisfies SourceRule,
  selfReferencingNode: {
    kind: "require",
    pattern: "struct\\s+(\\w+)\\s*\\{[^}]*struct\\s+\\1\\s*\\*",
    message: "Defina um nó com ponteiro para o próximo nó, por exemplo: typedef struct no { int valor; struct no *prox; } No;"
  } satisfies SourceRule,
  doublyLinkedNode: {
    kind: "require",
    pattern: "struct\\s+(\\w+)\\s*\\{[^}]*struct\\s+\\1\\s*\\*[^}]*struct\\s+\\1\\s*\\*",
    message: "Cada nó da lista duplamente encadeada precisa de dois ponteiros: para o próximo e para o anterior."
  } satisfies SourceRule,
  noArrays: {
    kind: "forbid",
    pattern: "\\[",
    message: "Não use vetores: os valores devem ficar guardados nos nós da estrutura."
  } satisfies SourceRule
};

// ---------- Definição de desafios ----------
export interface ChallengeDefinition {
  slug: string;
  /** IDs legados, preservados para não perder o histórico de submissões. */
  id?: string;
  caseIdPrefix?: string;
  title: string;
  difficulty: Difficulty;
  points?: number;
  moduleId: string;
  position: number;
  isBoss?: boolean;
  description: string;
  constraints: string[];
  tags?: string[];
  mode?: ChallengeMode;
  functionSpec?: FunctionSpec;
  /** Linguagens aceitas; regras podem variar por linguagem. */
  languages?: Array<SubmissionLanguage | ChallengeLanguage>;
  checker?: OutputChecker;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  publicCases: CaseDefinition[];
  hiddenCases: CaseDefinition[];
  hints?: string[];
  editorial?: string;
  complexity?: Complexity;
  followUps?: string[];
  /** Exemplos mostrados no enunciado (por padrão, os casos públicos). */
  examples?: CaseDefinition[];
}

const DEFAULT_POINTS: Record<Difficulty, number> = { easy: 80, medium: 150, hard: 250 };

export function defineChallenge(definition: ChallengeDefinition): Challenge {
  const id = definition.id ?? `challenge-${definition.slug}`;
  const casePrefix = definition.caseIdPrefix ?? `tc-${definition.slug}`;
  const testCases: TestCase[] = [
    ...definition.publicCases.map((testCase, index) => ({
      id: `${casePrefix}-publico-${index + 1}`,
      challengeId: id,
      input: testCase.input,
      expectedOutput: testCase.output,
      isPublic: true,
      weight: 1
    })),
    ...definition.hiddenCases.map((testCase, index) => ({
      id: `${casePrefix}-privado-${index + 1}`,
      challengeId: id,
      input: testCase.input,
      expectedOutput: testCase.output,
      isPublic: false,
      weight: 1
    }))
  ];
  for (const testCase of testCases) {
    if (testCase.expectedOutput.length > MAX_CASE_BYTES || testCase.input.length > MAX_CASE_BYTES * 4) {
      throw new Error(`Caso grande demais em ${definition.slug}: ${testCase.id}`);
    }
  }
  const languages: ChallengeLanguage[] = (definition.languages ?? ["javascript", "python", "c"]).map((entry) =>
    typeof entry === "string" ? { language: entry, sourceRules: [] } : entry
  );
  return {
    id,
    slug: definition.slug,
    title: definition.title,
    difficulty: definition.difficulty,
    points: definition.points ?? DEFAULT_POINTS[definition.difficulty],
    description: definition.description,
    constraints: definition.constraints,
    tags: definition.tags ?? [],
    examples: (definition.examples ?? definition.publicCases).map((testCase) => ({ input: testCase.input, output: testCase.output })),
    languages,
    mode: definition.mode ?? (definition.functionSpec ? "function" : "stdio"),
    functionSpec: definition.functionSpec ?? null,
    checker: definition.checker ?? { kind: "exact" },
    timeLimitMs: definition.timeLimitMs ?? null,
    memoryLimitMb: definition.memoryLimitMb ?? null,
    topic: "",
    subtopic: "",
    moduleId: definition.moduleId,
    position: definition.position,
    isBoss: definition.isBoss ?? false,
    hints: definition.hints ?? [],
    editorial: definition.editorial ?? null,
    complexity: definition.complexity ?? null,
    followUps: definition.followUps ?? [],
    testCases,
    isActive: true,
    createdBy: ADMIN_ID
  };
}

/** Atalho para regras que valem só para uma linguagem. */
export function language(languageName: SubmissionLanguage, sourceRules: SourceRule[] = []): ChallengeLanguage {
  return { language: languageName, sourceRules };
}
