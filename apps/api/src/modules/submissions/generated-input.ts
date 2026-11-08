/**
 * Argumentos gerados no modo função. Um caso pode trazer, no lugar de um
 * vetor enorme, uma especificação curta como
 * `{"$gen":"ints","n":200000,"min":-1000000000,"max":1000000000,"seed":7}`.
 * O juiz expande a especificação só na hora de executar. Assim o caso
 * guardado fica pequeno e as soluções ingênuas ainda estouram o tempo, como
 * nos casos grandes do LeetCode.
 *
 * A mesma função `generate` é usada pelo catálogo para calcular a saída
 * esperada, então entrada e gabarito nunca divergem.
 */

/** PRNG determinístico (mulberry32). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const randomInt = (random: () => number, min: number, max: number) => min + Math.floor(random() * (max - min + 1));

export type GeneratedSpec =
  | {
      $gen: "ints";
      n: number;
      min: number;
      max: number;
      seed: number;
      /** Ordena depois de gerar. */
      sorted?: "asc" | "desc";
      /** Valores sem repetição (exige max - min + 1 >= n). */
      distinct?: boolean;
      /** Sobrescreve posições depois de gerar e ordenar: {"índice": valor}. */
      set?: Record<string, number>;
    }
  | { $gen: "range"; n: number; start?: number; step?: number }
  | { $gen: "perm"; n: number; seed: number; start?: number }
  | { $gen: "string"; n: number; seed: number; alphabet?: string }
  | { $gen: "matrix"; rows: number; cols: number; min: number; max: number; seed: number }
  | { $gen: "grid"; rows: number; cols: number; seed: number; alphabet: string; weights?: number[] }
  | {
      $gen: "edges";
      /** Vértices numerados de 0 a n - 1. */
      n: number;
      /** Número de arestas (ignorado quando tree = true, que gera n - 1). */
      m?: number;
      seed: number;
      tree?: boolean;
      /** Acrescenta um peso aleatório em [min, max] a cada aresta: [u, v, peso]. */
      weight?: { min: number; max: number };
    }
  | { $gen: "repeat"; n: number; value: unknown }
  | { $gen: "concat"; parts: unknown[] };

/** Limite de elementos gerados por caso, para proteger a máquina do juiz. */
export const MAX_GENERATED_ELEMENTS = 1_000_000;

export class GeneratedInputError extends Error {}

function isSpec(value: unknown): value is GeneratedSpec {
  return typeof value === "object" && value !== null && !Array.isArray(value) && typeof (value as { $gen?: unknown }).$gen === "string";
}

function checkSize(size: number, what: string) {
  if (!Number.isInteger(size) || size < 0 || size > MAX_GENERATED_ELEMENTS) {
    throw new GeneratedInputError(`Tamanho inválido em ${what}: use um inteiro entre 0 e ${MAX_GENERATED_ELEMENTS}.`);
  }
}

function checkRange(min: number, max: number, what: string) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new GeneratedInputError(`Intervalo inválido em ${what}: min e max precisam ser inteiros com min <= max.`);
  }
}

function distinctInts(random: () => number, n: number, min: number, max: number): number[] {
  const span = max - min + 1;
  if (span < n) throw new GeneratedInputError("ints com distinct: o intervalo tem menos valores do que n.");
  if (span <= 4 * n) {
    const pool = Array.from({ length: span }, (_, index) => min + index);
    for (let index = 0; index < n; index += 1) {
      const other = randomInt(random, index, span - 1);
      [pool[index], pool[other]] = [pool[other], pool[index]];
    }
    return pool.slice(0, n);
  }
  const seen = new Set<number>();
  const values: number[] = [];
  while (values.length < n) {
    const value = randomInt(random, min, max);
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values;
}

/** Expande uma especificação (ou devolve o valor como está). */
export function generate(value: unknown): unknown {
  if (!isSpec(value)) return value;
  const spec = value;
  switch (spec.$gen) {
    case "ints": {
      checkSize(spec.n, "ints");
      checkRange(spec.min, spec.max, "ints");
      const random = createRandom(spec.seed);
      const values = spec.distinct
        ? distinctInts(random, spec.n, spec.min, spec.max)
        : Array.from({ length: spec.n }, () => randomInt(random, spec.min, spec.max));
      // Ordenação numérica em vetor tipado: bem mais rápida que sort com comparador.
      if (spec.sorted === "asc" || spec.sorted === "desc") {
        const sorted = Float64Array.from(values).sort();
        for (let index = 0; index < values.length; index += 1) values[index] = sorted[spec.sorted === "asc" ? index : values.length - 1 - index];
      }
      for (const [index, override] of Object.entries(spec.set ?? {})) {
        const position = Number(index);
        if (!Number.isInteger(position) || position < 0 || position >= values.length) {
          throw new GeneratedInputError(`ints: posição ${index} fora do vetor.`);
        }
        values[position] = override;
      }
      return values;
    }
    case "range": {
      checkSize(spec.n, "range");
      const start = spec.start ?? 0;
      const step = spec.step ?? 1;
      return Array.from({ length: spec.n }, (_, index) => start + index * step);
    }
    case "perm": {
      checkSize(spec.n, "perm");
      const random = createRandom(spec.seed);
      const start = spec.start ?? 1;
      const values = Array.from({ length: spec.n }, (_, index) => start + index);
      for (let index = values.length - 1; index > 0; index -= 1) {
        const other = randomInt(random, 0, index);
        [values[index], values[other]] = [values[other], values[index]];
      }
      return values;
    }
    case "string": {
      checkSize(spec.n, "string");
      const alphabet = spec.alphabet ?? "abcdefghijklmnopqrstuvwxyz";
      if (!alphabet.length) throw new GeneratedInputError("string: alfabeto vazio.");
      const random = createRandom(spec.seed);
      let text = "";
      for (let index = 0; index < spec.n; index += 1) text += alphabet[randomInt(random, 0, alphabet.length - 1)];
      return text;
    }
    case "matrix": {
      checkSize(spec.rows * spec.cols, "matrix");
      checkRange(spec.min, spec.max, "matrix");
      const random = createRandom(spec.seed);
      return Array.from({ length: spec.rows }, () => Array.from({ length: spec.cols }, () => randomInt(random, spec.min, spec.max)));
    }
    case "grid": {
      checkSize(spec.rows * spec.cols, "grid");
      if (!spec.alphabet.length) throw new GeneratedInputError("grid: alfabeto vazio.");
      const random = createRandom(spec.seed);
      const weights = spec.weights ?? Array.from(spec.alphabet, () => 1);
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      const pickChar = () => {
        let roll = random() * total;
        for (let index = 0; index < spec.alphabet.length; index += 1) {
          roll -= weights[index] ?? 0;
          if (roll < 0) return spec.alphabet[index];
        }
        return spec.alphabet[spec.alphabet.length - 1];
      };
      return Array.from({ length: spec.rows }, () => Array.from({ length: spec.cols }, pickChar).join(""));
    }
    case "edges": {
      checkSize(spec.n, "edges");
      const random = createRandom(spec.seed);
      const edges: number[][] = [];
      const weight = () => (spec.weight ? [randomInt(random, spec.weight.min, spec.weight.max)] : []);
      if (spec.tree) {
        for (let vertex = 1; vertex < spec.n; vertex += 1) edges.push([randomInt(random, 0, vertex - 1), vertex, ...weight()]);
      } else {
        const m = spec.m ?? 0;
        checkSize(m, "edges");
        if (spec.n < 2 && m > 0) throw new GeneratedInputError("edges: são necessários pelo menos 2 vértices.");
        for (let index = 0; index < m; index += 1) {
          const u = randomInt(random, 0, spec.n - 1);
          let v = randomInt(random, 0, spec.n - 2);
          if (v >= u) v += 1;
          edges.push([u, v, ...weight()]);
        }
      }
      return edges;
    }
    case "repeat": {
      checkSize(spec.n, "repeat");
      return Array.from({ length: spec.n }, () => spec.value);
    }
    case "concat": {
      const parts = spec.parts.map(generate);
      if (parts.every((part) => typeof part === "string")) return parts.join("");
      const values = parts.flatMap((part) => (Array.isArray(part) ? part : [part]));
      checkSize(values.length, "concat");
      return values;
    }
    default:
      throw new GeneratedInputError(`Gerador desconhecido: ${(spec as { $gen: string }).$gen}.`);
  }
}

/** Expande os argumentos gerados de uma entrada JSON do modo função. */
export function expandGeneratedArgs(input: string): string {
  if (!input.includes('"$gen"')) return input;
  let args: unknown;
  try {
    args = JSON.parse(input);
  } catch {
    return input;
  }
  if (!Array.isArray(args)) return input;
  return JSON.stringify(args.map(generate));
}
