import type { Challenge, SourceRule } from "../../domain/types.js";
import { call, createRandom, defineChallenge, gen, language, randomArray, randomInt, randomWord, shuffle, type CaseDefinition } from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Algoritmos e Padrões": módulos de backtracking, programação dinâmica
 * e manipulação de bits. Todos no modo função, em JavaScript, Python e C.
 * Sementes na faixa 700000–799999. Os gabaritos saem das implementações de
 * referência abaixo; as soluções e as burlas ficam em desafios/<slug>/.
 */

const MOD = 1_000_000_007;
const ascending = (values: readonly number[]) => [...values].sort((a, b) => a - b);

// ---------- Referências: backtracking ----------
function allSubsets(nums: readonly number[]): number[][] {
  const sorted = ascending(nums);
  const result: number[][] = [];
  for (let mask = 0; mask < 1 << sorted.length; mask += 1) result.push(sorted.filter((_, index) => mask & (1 << index)));
  return result;
}

function allPermutations(nums: readonly number[]): number[][] {
  if (nums.length <= 1) return [[...nums]];
  return nums.flatMap((value, index) =>
    allPermutations([...nums.slice(0, index), ...nums.slice(index + 1)]).map((rest) => [value, ...rest])
  );
}

function combinationSums(candidates: readonly number[], target: number): number[][] {
  const sorted = ascending(candidates);
  const result: number[][] = [];
  const path: number[] = [];
  const explore = (start: number, remaining: number) => {
    if (remaining === 0) {
      result.push([...path]);
      return;
    }
    for (let index = start; index < sorted.length && sorted[index] <= remaining; index += 1) {
      path.push(sorted[index]);
      explore(index, remaining - sorted[index]);
      path.pop();
    }
  };
  explore(0, target);
  return result;
}

/** Soluções do problema das n rainhas para n = 1..12. */
const QUEENS = [1, 0, 0, 2, 10, 4, 40, 92, 352, 724, 2680, 14200];

function solveSudoku(rows: readonly string[]): string[] {
  const grid = rows.join("").split("").map((char) => (char === "." ? 0 : Number(char)));
  const rowMask = new Array(9).fill(0);
  const colMask = new Array(9).fill(0);
  const boxMask = new Array(9).fill(0);
  const box = (cell: number) => 3 * Math.floor(cell / 27) + Math.floor((cell % 9) / 3);
  grid.forEach((digit, cell) => {
    if (!digit) return;
    rowMask[Math.floor(cell / 9)] |= 1 << digit;
    colMask[cell % 9] |= 1 << digit;
    boxMask[box(cell)] |= 1 << digit;
  });
  const fill = (): boolean => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let cell = 0; cell < 81; cell += 1) {
      if (grid[cell]) continue;
      const free = ~(rowMask[Math.floor(cell / 9)] | colMask[cell % 9] | boxMask[box(cell)]) & 0x3fe;
      let count = 0;
      for (let bits = free; bits; bits &= bits - 1) count += 1;
      if (count < bestCount) [best, bestMask, bestCount] = [cell, free, count];
    }
    if (best < 0) return true;
    const [row, col, square] = [Math.floor(best / 9), best % 9, box(best)];
    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = 1 << digit;
      if (!(bestMask & bit)) continue;
      grid[best] = digit;
      rowMask[row] |= bit;
      colMask[col] |= bit;
      boxMask[square] |= bit;
      if (fill()) return true;
      rowMask[row] &= ~bit;
      colMask[col] &= ~bit;
      boxMask[square] &= ~bit;
      grid[best] = 0;
    }
    return false;
  };
  if (!fill()) throw new Error("Sudoku sem solução no catálogo.");
  return Array.from({ length: 9 }, (_, row) => grid.slice(row * 9, row * 9 + 9).join(""));
}

// ---------- Referências: programação dinâmica ----------
function houseRobber(values: readonly number[]): number {
  let withPrevious = 0;
  let best = 0;
  for (const value of values) {
    const next = Math.max(best, withPrevious + value);
    withPrevious = best;
    best = next;
  }
  return best;
}

function countPaths(grid: readonly number[][]): number {
  const cols = grid[0].length;
  const ways = new Array(cols).fill(0);
  ways[0] = 1;
  for (const row of grid) {
    for (let col = 0; col < cols; col += 1) {
      if (row[col] === 1) ways[col] = 0;
      else if (col > 0) ways[col] = (ways[col] + ways[col - 1]) % MOD;
    }
  }
  return ways[cols - 1];
}

/**
 * LCS por vetor de bits (Allison e Dix): o bit j de `s` desligado marca um
 * aumento da LCS na coluna j. Dá o mesmo resultado da tabela clássica do
 * editorial, só que em O(n · m / 64) e sem pesar na montagem do catálogo.
 */
function lcsLength(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  const mask = (1n << BigInt(b.length)) - 1n;
  const positions = new Map<string, bigint>();
  for (let j = 0; j < b.length; j += 1) positions.set(b[j], (positions.get(b[j]) ?? 0n) | (1n << BigInt(j)));
  let s = mask;
  for (const char of a) {
    const u = s & (positions.get(char) ?? 0n);
    s = ((s + u) | (s - u)) & mask;
  }
  let ones = 0;
  for (const digit of s.toString(2)) if (digit === "1") ones += 1;
  return b.length - ones;
}

function knapsack(weights: readonly number[], values: readonly number[], capacity: number): number {
  const best = new Array(capacity + 1).fill(0);
  weights.forEach((weight, item) => {
    for (let room = capacity; room >= weight; room -= 1) best[room] = Math.max(best[room], best[room - weight] + values[item]);
  });
  return best[capacity];
}

/** A escolha gulosa por valor/peso (a burla): serve para escolher exemplos públicos em que ela acerta. */
function greedyKnapsack(weights: readonly number[], values: readonly number[], capacity: number): number {
  const order = weights.map((_, index) => index).sort((a, b) => values[b] / weights[b] - values[a] / weights[a]);
  let room = capacity;
  let total = 0;
  for (const item of order) {
    if (weights[item] <= room) {
      room -= weights[item];
      total += values[item];
    }
  }
  return total;
}

/**
 * Distância de edição pelo algoritmo de vetor de bits de Myers (na forma de
 * Hyyrö): `pv`/`mv` guardam as diferenças verticais +1/-1 da coluna atual da
 * tabela clássica do editorial. Mesmo resultado, sem os milhões de células.
 */
function editDistance(a: string, b: string): number {
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const mask = (1n << BigInt(a.length)) - 1n;
  const high = 1n << BigInt(a.length - 1);
  const positions = new Map<string, bigint>();
  for (let i = 0; i < a.length; i += 1) positions.set(a[i], (positions.get(a[i]) ?? 0n) | (1n << BigInt(i)));
  let pv = mask;
  let mv = 0n;
  let score = a.length;
  for (const char of b) {
    const eq = positions.get(char) ?? 0n;
    const xv = eq | mv;
    const xh = ((((eq & pv) + pv) & mask) ^ pv) | eq;
    let ph = mv | (~(xh | pv) & mask);
    let mh = pv & xh;
    if (ph & high) score += 1;
    else if (mh & high) score -= 1;
    ph = ((ph << 1n) | 1n) & mask;
    mh = (mh << 1n) & mask;
    pv = mh | (~(xv | ph) & mask);
    mv = ph & xv;
  }
  return score;
}

// ---------- Referências: bits ----------
function popcount(value: number): number {
  let count = 0;
  for (let bits = value >>> 0; bits; bits >>>= 1) count += bits & 1;
  return count;
}

function isPowerOfTwo(value: number): boolean {
  if (value <= 0) return false;
  let rest = value;
  while (rest % 2 === 0) rest /= 2;
  return rest === 1;
}

const xorAll = (values: readonly number[]) => values.reduce((acc, value) => acc ^ value, 0);

function twoLonely(values: readonly number[]): number[] {
  const both = xorAll(values);
  const bit = both & -both;
  const first = values.reduce((acc, value) => (value & bit ? acc ^ value : acc), 0);
  return ascending([first, both ^ first]);
}

// ---------- Utilidades de casos ----------
const backtracking = moduleId("backtracking");
const dynamicProgramming = moduleId("programacao-dinamica");
const bitsModule = moduleId("bits");

const distinctFrom = (random: () => number, size: number, min: number, max: number) =>
  shuffle(random, Array.from({ length: max - min + 1 }, (_, index) => min + index)).slice(0, size);

// =====================================================================
// Módulo: backtracking
// =====================================================================

function todosOsSubconjuntos(): Challenge {
  const random = createRandom(700101);
  const inputs: number[][] = [[], [5], [-3], [10, 2], [-1, -5, 3], [0, -10, 10, 9], [4, 3, 2, 1], [-2, -1]];
  for (const size of [5, 6, 7, 8, 9, 10, 11, 11]) inputs.push(distinctFrom(random, size, -10, 10));
  return defineChallenge({
    slug: "todos-os-subconjuntos",
    title: "Todos os subconjuntos",
    difficulty: "easy",
    moduleId: backtracking,
    position: 0,
    description: [
      "Dado um vetor `nums` de inteiros **distintos**, implemente `subconjuntos(nums)`, que retorna **todos** os subconjuntos de `nums` — do subconjunto vazio `[]` até o vetor inteiro.",
      "",
      "Regras do retorno:",
      "",
      "- cada subconjunto deve estar em **ordem crescente** (mesmo que `nums` venha fora de ordem);",
      "- a lista de subconjuntos pode vir em **qualquer ordem**;",
      "- nenhum subconjunto pode aparecer duas vezes.",
      "",
      "Com `n` elementos existem exatamente `2^n` subconjuntos. Para `[1, 2, 3]` são oito: `[]`, `[1]`, `[2]`, `[3]`, `[1,2]`, `[1,3]`, `[2,3]` e `[1,2,3]`.",
      "",
      "Se `nums` for vazio, a resposta é `[[]]`: uma lista com um único subconjunto, o vazio.",
      "",
      "**Em C:** retorne um vetor de vetores alocado com `malloc`, preencha `*returnSize` com a quantidade de subconjuntos e aponte `*returnColumnSizes` para um vetor (também alocado) com o tamanho de cada subconjunto."
    ].join("\n"),
    constraints: [
      "0 <= nums.length <= 11",
      "-10 <= nums[i] <= 10",
      "Os valores de nums são distintos.",
      "Cada subconjunto em ordem crescente; a lista em qualquer ordem."
    ],
    tags: ["Backtracking", "Recursão"],
    functionSpec: { name: "subconjuntos", params: [{ name: "nums", type: "int[]" }], returns: "int[][]" },
    checker: { kind: "unordered-lines" },
    publicCases: [call([[1, 2, 3]], allSubsets([1, 2, 3])), call([[7, 4]], allSubsets([7, 4]))],
    hiddenCases: inputs.map((nums) => call([nums], allSubsets(nums))),
    hints: [
      "Cada elemento tem duas opções: entra ou não entra no subconjunto. Decidir elemento por elemento gera as 2^n combinações.",
      "Ordene nums antes de começar (em JavaScript, com um comparador numérico: sort sem comparador ordena como texto). Percorrendo em ordem crescente, todo subconjunto já sai ordenado.",
      "Backtracking: coloque nums[i] no caminho atual, explore a partir de i + 1, retire nums[i] (desfaça) e explore sem ele. Ao passar do último índice, guarde uma cópia do caminho."
    ],
    editorial: [
      "**Ideia.** Um subconjunto é uma sequência de decisões \"entra/não entra\", uma para cada elemento. A recursão toma uma decisão por nível; ao chegar ao fim do vetor, o caminho atual é um subconjunto completo.",
      "",
      "**Passo a passo.**",
      "",
      "1. Ordene `nums` numericamente, para que cada subconjunto saia em ordem crescente.",
      "2. `explorar(i)`: se `i == n`, guarde uma **cópia** do caminho e volte.",
      "3. Senão, coloque `nums[i]` no caminho, chame `explorar(i + 1)`, retire `nums[i]` e chame `explorar(i + 1)` de novo.",
      "",
      "```js",
      "function subconjuntos(nums) {",
      "  const ordenados = [...nums].sort((a, b) => a - b);",
      "  const resposta = [];",
      "  const caminho = [];",
      "  function explorar(i) {",
      "    if (i === ordenados.length) {",
      "      resposta.push([...caminho]); // cópia: o caminho continua mudando",
      "      return;",
      "    }",
      "    caminho.push(ordenados[i]); // escolhe",
      "    explorar(i + 1);            // explora com o elemento",
      "    caminho.pop();              // desfaz",
      "    explorar(i + 1);            // explora sem o elemento",
      "  }",
      "  explorar(0);",
      "  return resposta;",
      "}",
      "```",
      "",
      "**Custo.** São `2^n` subconjuntos e copiar cada um custa até `n`: tempo `O(n · 2^n)`. Além da resposta, a pilha de recursão e o caminho ocupam `O(n)`.",
      "",
      "Uma alternativa sem recursão usa máscaras de bits: para cada `mascara` de `0` a `2^n - 1`, o bit `i` ligado indica que `nums[i]` entra."
    ].join("\n"),
    complexity: { time: "O(n · 2^n)", space: "O(n) além da resposta" }
  });
}

function permutacoes(): Challenge {
  const random = createRandom(700201);
  const inputs: number[][] = [[5], [-1, 1], [2, 1], [3, 1, 2], [0, -1, 1], [9, -4, 0, 7], [4, 3, 2, 1], [1, 2, 3, 4, 5, 6], [6, 5, 4, 3, 2, 1]];
  for (const size of [4, 5, 5, 6, 6, 6, 6]) inputs.push(distinctFrom(random, size, -10, 10));
  return defineChallenge({
    slug: "permutacoes",
    title: "Permutações",
    difficulty: "medium",
    moduleId: backtracking,
    position: 1,
    description: [
      "Implemente `permutacoes(nums)`, que recebe um vetor de inteiros **distintos** e retorna **todas** as ordens possíveis desses números, ou seja, todas as suas permutações.",
      "",
      "Cada permutação é um vetor com os mesmos `n` números de `nums`, em alguma ordem. A lista de permutações pode vir em **qualquer ordem**, mas cada uma deve aparecer exatamente uma vez. Com `n` elementos existem `n!` permutações: para `[1, 2, 3]` são seis — `[1,2,3]`, `[1,3,2]`, `[2,1,3]`, `[2,3,1]`, `[3,1,2]` e `[3,2,1]`.",
      "",
      "Atenção: `nums` pode chegar **fora de ordem**, e todas as permutações continuam sendo exigidas.",
      "",
      "**Em C:** retorne um vetor de vetores alocado com `malloc`, com `*returnSize` igual à quantidade de permutações e `*returnColumnSizes` apontando para um vetor com o tamanho de cada uma (sempre `n`)."
    ].join("\n"),
    constraints: ["1 <= nums.length <= 6", "-10 <= nums[i] <= 10", "Os valores de nums são distintos.", "A lista pode vir em qualquer ordem."],
    tags: ["Backtracking", "Recursão"],
    functionSpec: { name: "permutacoes", params: [{ name: "nums", type: "int[]" }], returns: "int[][]" },
    checker: { kind: "unordered-lines" },
    publicCases: [call([[1, 2, 3]], allPermutations([1, 2, 3])), call([[-2, 5]], allPermutations([-2, 5]))],
    hiddenCases: inputs.map((nums) => call([nums], allPermutations(nums))),
    hints: [
      "Monte a permutação posição por posição: na primeira posição pode ir qualquer um dos n números; na segunda, qualquer um dos que sobraram, e assim por diante.",
      "Guarde um vetor de booleanos usado[i]. Em cada nível, tente cada número ainda não usado, marque-o, desça um nível e desmarque ao voltar.",
      "Quando o caminho tiver n números, guarde uma cópia. Não dependa da ordem de entrada: o algoritmo precisa gerar todas as n! ordens para qualquer nums."
    ],
    editorial: [
      "**Ideia.** A árvore de decisões tem `n` níveis: no nível `k` escolhemos o número da posição `k` entre os que ainda não foram usados. Cada folha é uma permutação.",
      "",
      "**Passo a passo.**",
      "",
      "1. Mantenha o `caminho` (a permutação parcial) e um vetor `usado`.",
      "2. Se o caminho tem `n` números, guarde uma cópia.",
      "3. Senão, para cada `i` com `usado[i]` falso: marque, empilhe `nums[i]`, recurse, desempilhe e desmarque.",
      "",
      "```python",
      "def permutacoes(nums):",
      "    resposta, caminho = [], []",
      "    usado = [False] * len(nums)",
      "",
      "    def explorar():",
      "        if len(caminho) == len(nums):",
      "            resposta.append(caminho[:])  # cópia",
      "            return",
      "        for i, valor in enumerate(nums):",
      "            if not usado[i]:",
      "                usado[i] = True",
      "                caminho.append(valor)",
      "                explorar()",
      "                caminho.pop()  # desfaz a escolha",
      "                usado[i] = False",
      "",
      "    explorar()",
      "    return resposta",
      "```",
      "",
      "**Custo.** `n!` folhas, cada cópia custa `n`: tempo `O(n · n!)`. Espaço extra `O(n)` para o caminho, o vetor `usado` e a pilha de chamadas.",
      "",
      "**Armadilha.** O algoritmo de \"próxima permutação\" só gera todas as ordens se partir do vetor **ordenado**; começando de uma entrada embaralhada, ele pula as permutações menores."
    ].join("\n"),
    complexity: { time: "O(n · n!)", space: "O(n) além da resposta" }
  });
}

function combinacoesComSomaAlvo(): Challenge {
  const random = createRandom(700301);
  const cases: Array<[number[], number]> = [
    [[7], 7],
    [[5], 3],
    [[2], 1],
    [[2], 40],
    [[8, 6, 2, 4], 12],
    [[9, 3], 18],
    [[11, 13, 17], 10],
    [[25, 10, 5], 50],
    [[3, 5, 7, 11, 13, 17, 19, 23, 29, 31], 31]
  ];
  while (cases.length < 18) {
    const size = randomInt(random, 2, 14);
    const candidates = distinctFrom(random, size, 2, 50);
    const target = randomInt(random, 10, cases.length < 14 ? 40 : 100);
    const count = combinationSums(candidates, target).length;
    if (count >= 1 && count <= 150) cases.push([candidates, target]);
  }
  return defineChallenge({
    slug: "combinacoes-com-soma-alvo",
    title: "Combinações com soma alvo",
    difficulty: "medium",
    moduleId: backtracking,
    position: 2,
    description: [
      "Implemente `combinacoesSoma(candidatos, alvo)`. O vetor `candidatos` tem inteiros positivos **distintos**, e cada candidato pode ser usado **quantas vezes você quiser**. Retorne todas as combinações de candidatos cuja soma é exatamente `alvo`.",
      "",
      "- Uma combinação é um multiconjunto: `[2, 2, 3]` e `[3, 2, 2]` são a **mesma** combinação e só podem aparecer uma vez.",
      "- Escreva cada combinação em **ordem crescente** (por exemplo `[2, 2, 3]`), mesmo que `candidatos` venha fora de ordem.",
      "- A lista de combinações pode vir em **qualquer ordem**.",
      "- Se nenhuma combinação somar `alvo`, retorne a lista vazia `[]`.",
      "",
      "Exemplo: com `candidatos = [3, 4, 5]` e `alvo = 10`, as combinações são `[3, 3, 4]` e `[5, 5]`. Repare que `5` foi usado duas vezes.",
      "",
      "**Em C:** retorne um vetor de vetores alocado com `malloc`, com `*returnSize` e `*returnColumnSizes` preenchidos (os casos garantem no máximo 150 combinações)."
    ].join("\n"),
    constraints: [
      "1 <= candidatos.length <= 30",
      "2 <= candidatos[i] <= 50, todos distintos",
      "1 <= alvo <= 100",
      "Os casos garantem no máximo 150 combinações."
    ],
    tags: ["Backtracking", "Poda"],
    functionSpec: {
      name: "combinacoesSoma",
      params: [
        { name: "candidatos", type: "int[]" },
        { name: "alvo", type: "int" }
      ],
      returns: "int[][]"
    },
    checker: { kind: "unordered-lines" },
    publicCases: [call([[3, 4, 5], 10], combinationSums([3, 4, 5], 10)), call([[2, 4, 7], 11], combinationSums([2, 4, 7], 11))],
    hiddenCases: cases.map(([candidates, target]) => call([candidates, target], combinationSums(candidates, target))),
    hints: [
      "Para não gerar [2, 3] e [3, 2] separadamente, só permita escolher candidatos de índice maior ou igual ao último escolhido.",
      "Como um candidato pode repetir, depois de escolher candidatos[i] a recursão continua a partir do próprio i (e não de i + 1).",
      "Ordene os candidatos primeiro: assim cada combinação já sai crescente e você pode parar o laço (poda) assim que candidatos[i] passar do que falta para o alvo."
    ],
    editorial: [
      "**Ideia.** Backtracking sobre o que falta para o alvo. Para cada combinação ser gerada uma única vez, escolhemos os candidatos em ordem de índice não decrescente.",
      "",
      "**Passo a passo.**",
      "",
      "1. Ordene os candidatos em ordem crescente.",
      "2. `explorar(inicio, resta)`: se `resta == 0`, guarde uma cópia do caminho.",
      "3. Para `i` a partir de `inicio`: se `candidatos[i] > resta`, pare (os próximos são ainda maiores). Senão, empilhe, chame `explorar(i, resta - candidatos[i])` e desempilhe.",
      "",
      "```js",
      "function combinacoesSoma(candidatos, alvo) {",
      "  const c = [...candidatos].sort((a, b) => a - b);",
      "  const resposta = [];",
      "  const caminho = [];",
      "  function explorar(inicio, resta) {",
      "    if (resta === 0) { resposta.push([...caminho]); return; }",
      "    for (let i = inicio; i < c.length && c[i] <= resta; i++) {",
      "      caminho.push(c[i]);",
      "      explorar(i, resta - c[i]); // i, e não i + 1: pode repetir",
      "      caminho.pop();",
      "    }",
      "  }",
      "  explorar(0, alvo);",
      "  return resposta;",
      "}",
      "```",
      "",
      "**Custo.** Proporcional ao número de nós da árvore de busca, que a poda mantém perto do número de combinações vezes a profundidade (`alvo / menor candidato`). Espaço extra `O(alvo / menor candidato)` para o caminho e a pilha."
    ].join("\n"),
    complexity: { time: "O(nós da árvore de busca)", space: "O(alvo / min(candidatos))" }
  });
}

function nRainhas(): Challenge {
  const hidden = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 6, 9, 4];
  return defineChallenge({
    slug: "n-rainhas",
    title: "N rainhas",
    difficulty: "hard",
    moduleId: backtracking,
    position: 3,
    description: [
      "No xadrez, uma rainha ataca qualquer peça na mesma **linha**, na mesma **coluna** ou em qualquer uma das duas **diagonais**. Implemente `nRainhas(n)`, que retorna de quantas maneiras diferentes é possível colocar `n` rainhas num tabuleiro `n × n` sem que nenhuma ataque outra.",
      "",
      "Duas maneiras são diferentes quando pelo menos uma casa tem rainha em uma e não na outra (tabuleiros espelhados ou girados contam separadamente).",
      "",
      "Exemplos: com `n = 4` há **2** maneiras; com `n = 1`, uma só (a rainha sozinha); com `n = 2` e `n = 3`, nenhuma.",
      "",
      "Testar todas as ordens possíveis de rainhas é lento demais para `n = 12`: descarte uma posição assim que ela for atacada e só desça na recursão com tabuleiros ainda válidos."
    ].join("\n"),
    constraints: ["1 <= n <= 12", "Retorne apenas a quantidade de soluções."],
    tags: ["Backtracking", "Poda"],
    functionSpec: { name: "nRainhas", params: [{ name: "n", type: "int" }], returns: "int" },
    timeLimitMs: 2000,
    publicCases: [call([4], QUEENS[3]), call([8], QUEENS[7])],
    hiddenCases: hidden.map((n) => call([n], QUEENS[n - 1])),
    hints: [
      "Como duas rainhas não podem dividir uma linha, cada linha tem exatamente uma rainha. Decida, linha por linha, em que coluna ela fica.",
      "Numa diagonal \"descendo para a direita\", linha - coluna é constante; na outra, linha + coluna é constante. Três vetores de booleanos (colunas, diagonais e antidiagonais) dizem em O(1) se uma casa está atacada.",
      "Só desça para a próxima linha se a casa for livre; marque a coluna e as duas diagonais, recurse e desmarque ao voltar. Ao completar as n linhas, some 1."
    ],
    editorial: [
      "**Ideia.** Coloque uma rainha por linha. Ao tentar a coluna `c` da linha `r`, verifique em `O(1)` se a coluna `c`, a diagonal `r - c` e a antidiagonal `r + c` estão livres. A poda corta ramos inteiros da árvore logo no começo, e é isso que torna `n = 12` viável.",
      "",
      "**Passo a passo.**",
      "",
      "1. `colunas[c]`, `diag[r - c + n - 1]` e `anti[r + c]` marcam o que já está atacado.",
      "2. `colocar(r)`: se `r == n`, achou uma solução.",
      "3. Para cada coluna livre, marque os três vetores, chame `colocar(r + 1)` e desmarque.",
      "",
      "```c",
      "static int n_, total;",
      "static bool col[12], diag[23], anti[23];",
      "",
      "static void colocar(int r) {",
      "    if (r == n_) { total++; return; }",
      "    for (int c = 0; c < n_; c++) {",
      "        if (col[c] || diag[r - c + n_ - 1] || anti[r + c]) continue; // poda",
      "        col[c] = diag[r - c + n_ - 1] = anti[r + c] = true;",
      "        colocar(r + 1);",
      "        col[c] = diag[r - c + n_ - 1] = anti[r + c] = false;      // desfaz",
      "    }",
      "}",
      "",
      "int nRainhas(int n) {",
      "    n_ = n; total = 0;",
      "    colocar(0);",
      "    return total;",
      "}",
      "```",
      "",
      "**Custo.** O pior caso é limitado por `O(n!)`, mas a poda visita muito menos nós: para `n = 12` são algumas centenas de milhares, contra 479 milhões de permutações sem poda. Espaço `O(n)`.",
      "",
      "Com máscaras de bits (`colunas`, `diag` e `anti` como inteiros deslocados a cada linha), as casas livres de uma linha saem numa única expressão: `~(colunas | diag | anti) & ((1 << n) - 1)`."
    ].join("\n"),
    complexity: { time: "O(n!) no pior caso, bem menos com poda", space: "O(n)" }
  });
}

/** Sudokus com solução única, gerados e conferidos fora do catálogo. */
const EASY_SUDOKUS = [
  ".....23...8..5..49.1......8.4..19.6.7924.61.56........32.67...4..4.....7...548...",
  "75...61.86....1.....17..65.....7..6.2.3.69.81..81..9.7.96..82...37.4.8.5...9.73.6",
  "....9...7943.27..6.12.65..38......7...41.8.....5........9..38..38..467..5...82.41",
  ".6.8.3.25..95627..5.2.714366..4.9..2.2.1.....7....8..3.1.794..89..31....3752..19.",
  "1659.74....24685...8.51.3.9.1...9.3...867.19.62934..859567..2.38...53.4.2.3.9..5.",
  "8514.6297736...145.42517..3.2.7..3.6413269578678351..929...37..1659748.238712596.",
  "387465192.19782463462391785278649351194253876653178249741526938936814527825937614"
];
/** Sudokus que não saem só com "a casa só tem um candidato": exigem tentativa e erro. */
const HARD_SUDOKUS = [
  "..76.....13..45..2.2..39...6.....74......6....4..1..65.78...3........9...5...34..",
  "..1........65.83...2......9..3.8..7...5.2.6..98.7...4....1.7........67.513.......",
  "..6.2.75..9...4..2.3..16...2......86.4....53........7...7.6.....1.....4.8....5...",
  "......91.68.5..7...9...1..83....7..6..7.2...54..9...8...4..6...........2.5....8..",
  ".79.6.3.......8...1.....4.5.2....6..4.58...1.6......4......92..7..21.....6..7...4",
  "....871.6.1....52.6.....7...8.24.....5.9......7......4....9..7......5...4.5.1.63.",
  "5..7..9.6.4...1....7....8.2.5..194..1......2..86..........5.2..7..28...3.1.....5.",
  "3.4...6.87........5...6.94..8..5..6....1.8.5....7....2256..3.8...3.95............",
  "..82.6.9..245....3.........79...1...........9.5.83........6.8.7..3.1..52.....81..",
  ".7.86.4....6.7.3..4......8.2.85.6.....9..4...7.....94..92.....5....2...3.1...3...",
  "....2.4...2..9.35.8........5..3...21.9...2.751..75................8....4367....1."
];

function resolverSudoku(): Challenge {
  const board = (puzzle: string) => Array.from({ length: 9 }, (_, row) => puzzle.slice(row * 9, row * 9 + 9));
  const solved = solveSudoku(board(HARD_SUDOKUS[0])).join("");
  const oneMissing = `.${solved.slice(1)}`;
  const hidden = [solved, oneMissing, ...EASY_SUDOKUS.slice(2), ...HARD_SUDOKUS];
  const sudokuCase = (puzzle: string): CaseDefinition => call([board(puzzle)], solveSudoku(board(puzzle)));
  return defineChallenge({
    slug: "resolver-sudoku",
    title: "Resolver sudoku",
    difficulty: "hard",
    moduleId: backtracking,
    position: 4,
    isBoss: true,
    description: [
      "Implemente `resolverSudoku(tabuleiro)`. O tabuleiro chega como um vetor de **9 strings**, uma por linha, cada uma com 9 caracteres: um dígito de `1` a `9` ou `.` para casa vazia. Retorne o tabuleiro **resolvido**, no mesmo formato (9 strings só com dígitos).",
      "",
      "Num sudoku resolvido, cada dígito de 1 a 9 aparece exatamente uma vez em cada **linha**, em cada **coluna** e em cada um dos nove **blocos 3 × 3**. Os dígitos que já vêm no tabuleiro não podem mudar.",
      "",
      "Todo tabuleiro dos testes tem **exatamente uma solução**. Alguns saem só preenchendo casas que têm um único candidato; outros, não: em algum momento é preciso **chutar** um dígito, seguir em frente e voltar atrás quando o chute leva a uma contradição.",
      "",
      "Exemplo: se a primeira linha da entrada é `\".....23..\"`, a primeira linha da saída tem os 9 dígitos, como `\"456892371\"`.",
      "",
      "**Em C:** você pode alterar as strings de `tabuleiro` no lugar e retorná-lo; preencha `*returnSize` com 9."
    ].join("\n"),
    constraints: [
      "tabuleiro.length == 9 e tabuleiro[i].length == 9",
      "Cada caractere é um dígito de 1 a 9 ou '.'",
      "O tabuleiro tem exatamente uma solução."
    ],
    tags: ["Backtracking", "Poda", "Máscaras de bits"],
    functionSpec: { name: "resolverSudoku", params: [{ name: "tabuleiro", type: "string[]" }], returns: "string[]" },
    publicCases: [sudokuCase(EASY_SUDOKUS[0]), sudokuCase(EASY_SUDOKUS[1])],
    hiddenCases: hidden.map(sudokuCase),
    hints: [
      "Guarde, para cada linha, coluna e bloco, quais dígitos já foram usados (vetores de booleanos ou máscaras de bits). O bloco da casa (r, c) é 3 · (r / 3) + (c / 3), com divisão inteira.",
      "Backtracking: ache uma casa vazia, tente cada dígito permitido, marque-o, resolva o resto recursivamente e, se não der certo, desmarque e tente o próximo. Se nenhum dígito servir, retorne falso para o nível de cima.",
      "Para ficar rápido nos tabuleiros difíceis, escolha sempre a casa vazia com **menos** candidatos: quando ela tem um só, não há chute; quando tem zero, o ramo morre na hora."
    ],
    editorial: [
      "**Ideia.** Backtracking com poda forte. Três conjuntos de máscaras (linhas, colunas e blocos) dizem em `O(1)` quais dígitos cabem numa casa. Em cada passo, escolhemos a casa vazia com menos candidatos (heurística do *menor domínio*): as casas com um único candidato são preenchidas sem ramificar, e contradições aparecem cedo.",
      "",
      "**Passo a passo.**",
      "",
      "1. Converta o tabuleiro e marque os dígitos dados nas máscaras.",
      "2. `resolver()`: procure a casa vazia com menos candidatos. Se não houver casa vazia, terminou.",
      "3. Para cada candidato: escreva, marque, chame `resolver()`; se deu certo, propague o sucesso; senão, desfaça.",
      "",
      "```python",
      "def resolverSudoku(tabuleiro):",
      "    g = [list(linha) for linha in tabuleiro]",
      "    lin, col, blo = [0] * 9, [0] * 9, [0] * 9",
      "    vazias = []",
      "    for r in range(9):",
      "        for c in range(9):",
      "            if g[r][c] == '.':",
      "                vazias.append((r, c))",
      "            else:",
      "                bit = 1 << int(g[r][c])",
      "                lin[r] |= bit; col[c] |= bit; blo[r // 3 * 3 + c // 3] |= bit",
      "",
      "    def resolver():",
      "        melhor, livres_melhor = None, 0",
      "        for (r, c) in vazias:",
      "            if g[r][c] != '.':",
      "                continue",
      "            livres = ~(lin[r] | col[c] | blo[r // 3 * 3 + c // 3]) & 0x3FE",
      "            if melhor is None or bin(livres).count('1') < bin(livres_melhor).count('1'):",
      "                melhor, livres_melhor = (r, c), livres",
      "        if melhor is None:",
      "            return True  # nenhuma casa vazia",
      "        r, c = melhor",
      "        b = r // 3 * 3 + c // 3",
      "        for d in range(1, 10):",
      "            bit = 1 << d",
      "            if livres_melhor & bit:",
      "                g[r][c] = str(d); lin[r] |= bit; col[c] |= bit; blo[b] |= bit",
      "                if resolver():",
      "                    return True",
      "                g[r][c] = '.'; lin[r] ^= bit; col[c] ^= bit; blo[b] ^= bit",
      "        return False",
      "",
      "    resolver()",
      "    return [''.join(linha) for linha in g]",
      "```",
      "",
      "**Custo.** Exponencial no pior caso teórico, mas para 9 × 9 com a heurística do menor domínio a busca visita poucos milhares de nós mesmo nos tabuleiros difíceis. Espaço `O(81)`.",
      "",
      "**Armadilha.** Preencher só as casas de candidato único resolve os sudokus fáceis e trava nos difíceis, deixando pontos no tabuleiro: é aí que a tentativa e erro é indispensável."
    ].join("\n"),
    complexity: { time: "Exponencial no pior caso; rápido com poda", space: "O(1) (tabuleiro fixo 9 × 9)" }
  });
}

// =====================================================================
// Módulo: programação dinâmica
// =====================================================================

function assaltoAsCasas(): Challenge {
  const random = createRandom(700401);
  const literal: number[][] = [
    [],
    [7],
    [3, 9],
    [9, 3],
    [0, 0, 0, 0],
    [5, 5, 5, 5, 5],
    [1, 100, 1, 1, 100, 1],
    [2, 1, 1, 2],
    [0, 5, 0],
    Array.from({ length: 101 }, (_, index) => (index % 2 === 0 ? 100000 : 99999)),
    randomArray(random, 60, 0, 100000),
    randomArray(random, 1000, 0, 100000)
  ];
  const big = [
    gen({ $gen: "ints", n: 200000, min: 0, max: 100000, seed: 700402 }),
    gen({ $gen: "repeat", n: 200000, value: 100000 }),
    gen({ $gen: "ints", n: 100001, min: 99000, max: 100000, seed: 700403 })
  ];
  return defineChallenge({
    slug: "assalto-as-casas",
    title: "Assalto às casas",
    difficulty: "medium",
    moduleId: dynamicProgramming,
    position: 0,
    description: [
      "Um ladrão planeja visitar as casas de uma rua, em fila. `valores[i]` é quanto há guardado na casa `i`. As casas **vizinhas** têm alarmes ligados entre si: se duas casas adjacentes forem visitadas na mesma noite, a polícia é chamada.",
      "",
      "Implemente `assaltoAsCasas(valores)`, que retorna o **maior total** que dá para obter sem nunca escolher duas casas vizinhas.",
      "",
      "- Com `valores = [4, 1, 2, 7, 5, 3, 1]`, o melhor é escolher as casas 0, 3 e 5: `4 + 7 + 3 = 14`.",
      "- Se a rua não tiver casas, o total é `0`.",
      "",
      "A rua pode ter **200 mil casas** e o total pode passar de 2^31: use `long long` em C. Uma recursão que testa \"pega ou pula\" para cada casa sem guardar resultados é exponencial e não termina a tempo."
    ].join("\n"),
    constraints: ["0 <= valores.length <= 2 · 10^5", "0 <= valores[i] <= 10^5", "O resultado pode passar de 2^31 - 1."],
    tags: ["Programação dinâmica"],
    functionSpec: { name: "assaltoAsCasas", params: [{ name: "valores", type: "int[]" }], returns: "long" },
    publicCases: [call([[4, 1, 2, 7, 5, 3, 1]], houseRobber([4, 1, 2, 7, 5, 3, 1])), call([[10, 1, 1, 10]], houseRobber([10, 1, 1, 10]))],
    hiddenCases: [
      ...literal.map((values) => call([values], houseRobber(values))),
      ...big.map((values) => call([values.spec], houseRobber(values.value)))
    ],
    hints: [
      "Pense na última casa i: ou você a pula (e fica com o melhor até i - 1), ou a pega (e soma valores[i] ao melhor até i - 2).",
      "Estado: melhor[i] = maior total usando só as casas 0..i. Transição: melhor[i] = max(melhor[i - 1], melhor[i - 2] + valores[i]). Casos base: melhor[-1] = melhor[-2] = 0.",
      "Cada passo só consulta os dois valores anteriores: bastam duas variáveis, sem vetor auxiliar e sem recursão."
    ],
    editorial: [
      "**Estado, transição e caso base.** `melhor[i]` é o maior total usando as casas `0..i`. Para a casa `i`, há duas opções: pulá-la (`melhor[i - 1]`) ou pegá-la, o que proíbe a vizinha (`melhor[i - 2] + valores[i]`). Antes da primeira casa, o total é 0.",
      "",
      "Como a transição só olha dois passos para trás, guardamos apenas `anterior` (até `i - 2`) e `atual` (até `i - 1`).",
      "",
      "```js",
      "function assaltoAsCasas(valores) {",
      "  let anterior = 0; // melhor até i - 2",
      "  let atual = 0;    // melhor até i - 1",
      "  for (const v of valores) {",
      "    const novo = Math.max(atual, anterior + v);",
      "    anterior = atual;",
      "    atual = novo;",
      "  }",
      "  return atual;",
      "}",
      "```",
      "",
      "**Custo.** Uma passada: tempo `O(n)` e espaço `O(1)`. A recursão ingênua `max(f(i + 1), v[i] + f(i + 2))` refaz os mesmos subproblemas e custa `O(φ^n)`; com memoização ela também fica `O(n)`, mas a versão iterativa evita estourar a pilha com 200 mil casas."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function caminhosComObstaculos(): Challenge {
  const random = createRandom(700501);
  const randomGrid = (rows: number, cols: number, density: number): number[][] => {
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (random() < density ? 1 : 0)));
    grid[0][0] = 0;
    grid[rows - 1][cols - 1] = 0;
    return grid;
  };
  const free = (rows: number, cols: number) => Array.from({ length: rows }, () => new Array(cols).fill(0));
  const wall = free(50, 50).map((row, r) => row.map((_, c) => (r + c === 49 ? 1 : 0)));
  const firstRowBlock = free(4, 6);
  firstRowBlock[0][3] = 1;
  const column = free(300, 1);
  const row = free(1, 300);
  const corridor = free(40, 40).map((line, r) => line.map((_, c) => (r > 0 && r < 39 && c > 0 && c < 39 ? 1 : 0)));
  const literal: number[][][] = [
    [[0]],
    [[0, 0]],
    [[0], [0], [0]],
    [
      [0, 1],
      [1, 0]
    ],
    firstRowBlock,
    corridor,
    wall,
    column,
    row,
    free(17, 17),
    randomGrid(12, 15, 0.25),
    randomGrid(60, 80, 0.15),
    randomGrid(300, 300, 0.1),
    randomGrid(250, 300, 0.2)
  ];
  const allFree = gen({ $gen: "matrix", rows: 300, cols: 300, min: 0, max: 0, seed: 700502 });
  const example = [
    [0, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1],
    [1, 0, 0, 0]
  ];
  return defineChallenge({
    slug: "caminhos-com-obstaculos",
    title: "Caminhos com obstáculos",
    difficulty: "medium",
    moduleId: dynamicProgramming,
    position: 1,
    description: [
      "Um robô está no canto superior esquerdo de uma grade e quer chegar ao canto inferior direito. A cada passo ele anda **uma casa para a direita** ou **uma casa para baixo**. Em `grade`, `0` é uma casa livre e `1` é um obstáculo, onde o robô não pode entrar.",
      "",
      "Implemente `caminhosComObstaculos(grade)`, que retorna **quantos caminhos diferentes** levam do início ao fim. Como o número cresce muito rápido, retorne o resto da divisão por `1000000007` (10^9 + 7).",
      "",
      "- As casas de início e de fim são sempre livres.",
      "- Se os obstáculos bloquearem todos os caminhos, a resposta é `0`.",
      "- Numa grade `1 × 1` (`[[0]]`), há exatamente um caminho: ficar parado.",
      "",
      "No exemplo `[[0,0,0,0],[0,1,0,0],[0,0,0,1],[1,0,0,0]]` há 3 caminhos. As grades dos testes chegam a 300 × 300; aplique o módulo a cada soma, não só no fim."
    ].join("\n"),
    constraints: [
      "1 <= linhas, colunas <= 300",
      "grade[i][j] é 0 (livre) ou 1 (obstáculo)",
      "grade[0][0] e a última casa são livres",
      "Retorne o total módulo 1000000007."
    ],
    tags: ["Programação dinâmica", "Matrizes"],
    functionSpec: { name: "caminhosComObstaculos", params: [{ name: "grade", type: "int[][]" }], returns: "int" },
    publicCases: [
      call([example], countPaths(example)),
      call([[[0, 0, 0], [1, 1, 0]]], countPaths([[0, 0, 0], [1, 1, 0]]))
    ],
    hiddenCases: [...literal.map((grid) => call([grid], countPaths(grid))), call([allFree.spec], countPaths(allFree.value))],
    hints: [
      "Só dá para chegar a uma casa vindo de cima ou da esquerda. Então caminhos(i, j) = caminhos(i - 1, j) + caminhos(i, j - 1) quando a casa é livre.",
      "Casa com obstáculo tem 0 caminhos. Caso base: a casa inicial tem 1. Preencha a tabela linha por linha, da esquerda para a direita.",
      "Uma única linha de tamanho colunas basta: ao processar a linha i, formas[j] ainda guarda o valor de cima e formas[j - 1] já tem o da esquerda. Some com % 1000000007 a cada passo."
    ],
    editorial: [
      "**Estado.** `formas[i][j]` = número de caminhos (módulo 10^9 + 7) do início até a casa `(i, j)`.",
      "",
      "**Transição.** Se `(i, j)` é obstáculo, `formas[i][j] = 0`. Senão, `formas[i][j] = formas[i - 1][j] + formas[i][j - 1]` (quem está fora da grade conta 0).",
      "",
      "**Caso base.** `formas[0][0] = 1`.",
      "",
      "Preenchendo em ordem de linhas, cada casa depende só da de cima e da da esquerda, que já foram calculadas. Uma linha reaproveitada é suficiente:",
      "",
      "```js",
      "function caminhosComObstaculos(grade) {",
      "  const MOD = 1000000007;",
      "  const colunas = grade[0].length;",
      "  const formas = new Array(colunas).fill(0);",
      "  formas[0] = 1;",
      "  for (const linha of grade) {",
      "    for (let j = 0; j < colunas; j++) {",
      "      if (linha[j] === 1) formas[j] = 0;",
      "      else if (j > 0) formas[j] = (formas[j] + formas[j - 1]) % MOD;",
      "    }",
      "  }",
      "  return formas[colunas - 1];",
      "}",
      "```",
      "",
      "**Custo.** Tempo `O(linhas · colunas)`, espaço `O(colunas)`.",
      "",
      "**Armadilhas.** Sem o módulo, a contagem de uma grade 300 × 300 livre tem quase 180 dígitos: em JavaScript e C ela perde precisão ou transborda. E a recursão sem memória refaz os mesmos subcaminhos um número exponencial de vezes."
    ].join("\n"),
    complexity: { time: "O(linhas · colunas)", space: "O(colunas)" }
  });
}

function maiorSubsequenciaComum(): Challenge {
  const random = createRandom(700601);
  const pairs: Array<[string, string]> = [
    ["", ""],
    ["", "abc"],
    ["abc", ""],
    ["a", "a"],
    ["a", "b"],
    ["abc", "abc"],
    ["abc", "cba"],
    ["aaaa", "aa"],
    ["abcdefghij", "klmnopqrst"],
    [randomWord(random, 40, 40, "abc"), randomWord(random, 40, 40, "abc")],
    [randomWord(random, 300, 300), randomWord(random, 250, 250)]
  ];
  const big: Array<[{ spec: any; value: any }, { spec: any; value: any }]> = [
    [gen({ $gen: "string", n: 2500, seed: 700602, alphabet: "ab" }), gen({ $gen: "string", n: 2500, seed: 700603, alphabet: "ab" })],
    [gen({ $gen: "string", n: 2500, seed: 700604 }), gen({ $gen: "string", n: 2500, seed: 700605 })],
    [gen({ $gen: "string", n: 1500, seed: 700606, alphabet: "acgt" }), gen({ $gen: "string", n: 2500, seed: 700607, alphabet: "acgt" })],
    [gen({ $gen: "string", n: 2500, seed: 700609, alphabet: "x" }), gen({ $gen: "string", n: 2500, seed: 700608, alphabet: "xy" })]
  ];
  return defineChallenge({
    slug: "maior-subsequencia-comum",
    title: "Maior subsequência comum",
    difficulty: "medium",
    moduleId: dynamicProgramming,
    position: 2,
    description: [
      "Uma **subsequência** de uma string é o que sobra depois de apagar zero ou mais caracteres, sem mudar a ordem dos restantes: `\"ace\"` é subsequência de `\"abcde\"`, mas `\"aec\"` não é.",
      "",
      "Implemente `maiorSubsequenciaComum(a, b)`, que retorna o **tamanho** da maior string que é subsequência de `a` e de `b` ao mesmo tempo. Se não houver nenhum caractere em comum (ou uma das strings for vazia), a resposta é `0`.",
      "",
      "Exemplo: para `a = \"cachorro\"` e `b = \"carro\"`, a maior subsequência comum é `\"carro\"` (c-a-r-r-o aparece, em ordem, dentro de \"cachorro\"), de tamanho 5.",
      "",
      "As strings chegam a 2500 caracteres: tentar todas as subsequências é exponencial. Pense numa tabela indexada pelos prefixos de `a` e de `b`."
    ].join("\n"),
    constraints: ["0 <= a.length, b.length <= 2500", "a e b têm apenas letras minúsculas de a a z."],
    tags: ["Programação dinâmica", "Strings"],
    functionSpec: {
      name: "maiorSubsequenciaComum",
      params: [
        { name: "a", type: "string" },
        { name: "b", type: "string" }
      ],
      returns: "int"
    },
    timeLimitMs: 2500,
    publicCases: [call(["cachorro", "carro"], lcsLength("cachorro", "carro")), call(["programa", "algoritmo"], lcsLength("programa", "algoritmo"))],
    hiddenCases: [
      ...pairs.map(([a, b]) => call([a, b], lcsLength(a, b))),
      ...big.map(([a, b]) => call([a.spec, b.spec], lcsLength(a.value, b.value)))
    ],
    hints: [
      "Olhe para o último caractere de cada string. Se a[i - 1] == b[j - 1], ele pode fechar a subsequência comum; se forem diferentes, pelo menos um deles fica de fora.",
      "Estado: t[i][j] = LCS dos prefixos a[0..i) e b[0..j). Transição: t[i][j] = t[i - 1][j - 1] + 1 se os caracteres batem; senão max(t[i - 1][j], t[i][j - 1]). Caso base: t[0][j] = t[i][0] = 0.",
      "A linha i só depende da linha i - 1: guarde duas linhas de tamanho b.length + 1 em vez da tabela inteira (a tabela 2501 × 2501 inteira pesa bem mais)."
    ],
    editorial: [
      "**Estado.** `t[i][j]` = tamanho da maior subsequência comum entre os `i` primeiros caracteres de `a` e os `j` primeiros de `b`.",
      "",
      "**Transição.** Se `a[i - 1] == b[j - 1]`, esse caractere entra: `t[i][j] = t[i - 1][j - 1] + 1`. Senão, descartamos o último de `a` ou o último de `b`: `t[i][j] = max(t[i - 1][j], t[i][j - 1])`.",
      "",
      "**Caso base.** Prefixo vazio: `t[0][j] = t[i][0] = 0`.",
      "",
      "Para `a = \"abc\"` e `b = \"ac\"`, a tabela fica (linhas = prefixos de `a`):",
      "",
      "| | ∅ | a | c |",
      "| --- | --- | --- | --- |",
      "| ∅ | 0 | 0 | 0 |",
      "| a | 0 | 1 | 1 |",
      "| b | 0 | 1 | 1 |",
      "| c | 0 | 1 | 2 |",
      "",
      "```c",
      "#include <string.h>",
      "",
      "int maiorSubsequenciaComum(char* a, char* b) {",
      "    int n = strlen(a), m = strlen(b);",
      "    int *ant = calloc(m + 1, sizeof(int)), *cur = calloc(m + 1, sizeof(int));",
      "    for (int i = 1; i <= n; i++) {",
      "        for (int j = 1; j <= m; j++) {",
      "            if (a[i - 1] == b[j - 1]) cur[j] = ant[j - 1] + 1;",
      "            else cur[j] = ant[j] > cur[j - 1] ? ant[j] : cur[j - 1];",
      "        }",
      "        int *troca = ant; ant = cur; cur = troca; // a linha nova vira a anterior",
      "    }",
      "    int resposta = ant[m];",
      "    free(ant); free(cur);",
      "    return resposta;",
      "}",
      "```",
      "",
      "**Custo.** Tempo `O(n · m)` (pouco mais de 6 milhões de células no maior caso) e espaço `O(m)` com duas linhas."
    ].join("\n"),
    complexity: { time: "O(n · m)", space: "O(m)" }
  });
}

function mochila01(): Challenge {
  const random = createRandom(700701);
  type Instance = [number[], number[], number];
  const cases: Instance[] = [
    [[5], [10], 4],
    [[5], [10], 5],
    [[1, 2, 3], [10, 20, 30], 0],
    [[20, 30], [5, 7], 10],
    [[1, 1, 1], [5, 5, 5], 2],
    [[6, 5, 5], [30, 20, 20], 10],
    [[10, 20, 30], [60, 100, 120], 50],
    [randomArray(random, 200, 1, 1), randomArray(random, 200, 0, 10000), 10000]
  ];
  while (cases.length < 18) {
    const n = cases.length < 12 ? randomInt(random, 10, 40) : 200;
    const maxWeight = cases.length < 12 ? 60 : 10000;
    const weights = randomArray(random, n, 1, maxWeight);
    const values = weights.map((weight) => Math.max(0, Math.min(10000, weight + randomInt(random, -maxWeight / 2, maxWeight))));
    const capacity = cases.length < 12 ? randomInt(random, 30, 300) : randomInt(random, 5000, 10000);
    cases.push([weights, values, capacity]);
  }
  const publicInstances: Instance[] = [
    [[3, 4, 2, 6], [30, 50, 15, 42], 9],
    [[4, 1, 3], [20, 3, 21], 5]
  ];
  for (const [weights, values, capacity] of publicInstances) {
    if (greedyKnapsack(weights, values, capacity) !== knapsack(weights, values, capacity)) throw new Error("Exemplo da mochila derruba o guloso.");
  }
  if (!cases.some(([weights, values, capacity]) => greedyKnapsack(weights, values, capacity) !== knapsack(weights, values, capacity))) {
    throw new Error("Nenhum caso oculto da mochila derruba o guloso.");
  }
  return defineChallenge({
    slug: "mochila-0-1",
    title: "Mochila 0/1",
    difficulty: "hard",
    moduleId: dynamicProgramming,
    position: 3,
    description: [
      "Você tem `n` itens: o item `i` pesa `pesos[i]` e vale `valores[i]`. A mochila aguenta no máximo `capacidade` de peso. Cada item pode ser levado **uma vez ou nenhuma** (não dá para levar metade de um item nem repeti-lo).",
      "",
      "Implemente `mochila(pesos, valores, capacidade)`, que retorna o **maior valor total** que cabe na mochila.",
      "",
      "Exemplo: com `pesos = [3, 4, 2, 6]`, `valores = [30, 50, 15, 42]` e `capacidade = 9`, o melhor é levar os itens de peso 3, 4 e 2 (peso 9, valor 95).",
      "",
      "- Se nenhum item couber (ou `capacidade = 0`), a resposta é `0`.",
      "- Cuidado com a ideia \"pegue primeiro os itens com maior valor por quilo\": ela funciona no exemplo acima, mas não em todos os casos."
    ].join("\n"),
    constraints: [
      "1 <= n <= 200, com pesos.length == valores.length == n",
      "1 <= pesos[i] <= 10^4",
      "0 <= valores[i] <= 10^4",
      "0 <= capacidade <= 10^4"
    ],
    tags: ["Programação dinâmica", "Mochila"],
    functionSpec: {
      name: "mochila",
      params: [
        { name: "pesos", type: "int[]" },
        { name: "valores", type: "int[]" },
        { name: "capacidade", type: "int" }
      ],
      returns: "int"
    },
    publicCases: publicInstances.map(([weights, values, capacity]) => call([weights, values, capacity], knapsack(weights, values, capacity))),
    hiddenCases: cases.map(([weights, values, capacity]) => call([weights, values, capacity], knapsack(weights, values, capacity))),
    hints: [
      "O guloso por valor/peso falha: com capacidade 10 e itens (peso 6, valor 30), (5, 20), (5, 20), ele pega o de peso 6 e sobra espaço inútil, mas os dois de peso 5 valem 40.",
      "Estado: melhor[i][c] = maior valor usando só os i primeiros itens com capacidade c. Transição: ou o item i fica de fora (melhor[i - 1][c]) ou entra, se couber (melhor[i - 1][c - peso] + valor).",
      "Dá para usar um único vetor melhor[0..capacidade], percorrendo c de capacidade até peso, de trás para a frente: assim cada item é contado no máximo uma vez."
    ],
    editorial: [
      "**Estado.** `melhor[i][c]` = maior valor escolhendo entre os `i` primeiros itens com capacidade `c`.",
      "",
      "**Transição.** `melhor[i][c] = max(melhor[i - 1][c], melhor[i - 1][c - pesos[i - 1]] + valores[i - 1])`, a segunda opção só quando o item cabe.",
      "",
      "**Caso base.** Sem itens, `melhor[0][c] = 0` para toda capacidade.",
      "",
      "Exemplo com `pesos = [2, 3]`, `valores = [3, 4]` e capacidade 5:",
      "",
      "| itens / c | 0 | 1 | 2 | 3 | 4 | 5 |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| nenhum | 0 | 0 | 0 | 0 | 0 | 0 |",
      "| (2, 3) | 0 | 0 | 3 | 3 | 3 | 3 |",
      "| (3, 4) | 0 | 0 | 3 | 4 | 4 | 7 |",
      "",
      "Como a linha `i` só lê a linha `i - 1`, basta um vetor. Percorrer `c` **de trás para a frente** garante que `melhor[c - peso]` ainda é o valor da linha anterior (o item não é usado duas vezes):",
      "",
      "```python",
      "def mochila(pesos, valores, capacidade):",
      "    melhor = [0] * (capacidade + 1)",
      "    for peso, valor in zip(pesos, valores):",
      "        for c in range(capacidade, peso - 1, -1):",
      "            if melhor[c - peso] + valor > melhor[c]:",
      "                melhor[c] = melhor[c - peso] + valor",
      "    return melhor[capacidade]",
      "```",
      "",
      "**Custo.** Tempo `O(n · capacidade)` (2 milhões de passos no maior caso) e espaço `O(capacidade)`."
    ].join("\n"),
    complexity: { time: "O(n · capacidade)", space: "O(capacidade)" }
  });
}

function distanciaDeEdicao(): Challenge {
  const random = createRandom(700801);
  const mutate = (text: string, edits: number) => {
    const chars = text.split("");
    for (let step = 0; step < edits; step += 1) {
      const kind = randomInt(random, 0, 2);
      const position = randomInt(random, 0, Math.max(0, chars.length - 1));
      const letter = String.fromCharCode(97 + randomInt(random, 0, 25));
      if (kind === 0) chars.splice(position, 0, letter);
      else if (kind === 1 && chars.length) chars.splice(position, 1);
      else if (chars.length) chars[position] = letter;
    }
    return chars.join("");
  };
  const base = randomWord(random, 1500, 1500);
  const pairs: Array<[string, string]> = [
    ["", ""],
    ["", "abc"],
    ["abcd", ""],
    ["a", "a"],
    ["a", "b"],
    ["abc", "cba"],
    ["kitten", "sitting"],
    ["intencao", "execucao"],
    ["aaaa", "aaaaaaa"],
    ["abcdefgh", "hgfedcba"],
    [randomWord(random, 30, 30, "ab"), randomWord(random, 30, 30, "ab")],
    [randomWord(random, 400, 400, "abc"), randomWord(random, 350, 350, "abc")],
    [base, mutate(base, 200)]
  ];
  const big: Array<[{ spec: any; value: any }, { spec: any; value: any }]> = [
    [gen({ $gen: "string", n: 2000, seed: 700802 }), gen({ $gen: "string", n: 2000, seed: 700803 })],
    [gen({ $gen: "string", n: 2000, seed: 700804, alphabet: "ab" }), gen({ $gen: "string", n: 1900, seed: 700805, alphabet: "ab" })],
    [gen({ $gen: "string", n: 2000, seed: 700806, alphabet: "z" }), gen({ $gen: "string", n: 1, seed: 700807, alphabet: "z" })]
  ];
  return defineChallenge({
    slug: "distancia-de-edicao",
    title: "Distância de edição",
    difficulty: "hard",
    moduleId: dynamicProgramming,
    position: 4,
    isBoss: true,
    description: [
      "Um corretor ortográfico precisa medir o quão parecidas são duas palavras. Implemente `distanciaDeEdicao(a, b)`, que retorna o **menor número de operações** para transformar a string `a` na string `b`, sendo que cada operação é uma destas:",
      "",
      "- **inserir** um caractere em qualquer posição;",
      "- **remover** um caractere;",
      "- **trocar** um caractere por outro.",
      "",
      "Exemplos: de `\"livro\"` para `\"lirio\"` bastam 2 operações (troque `v` por `r` e `r` por `i`). De `\"\"` para `\"abc\"` são 3 inserções. Strings iguais têm distância `0`.",
      "",
      "As strings chegam a 2000 caracteres: a solução precisa ser uma tabela de programação dinâmica, não uma busca por todas as sequências de operações."
    ].join("\n"),
    constraints: ["0 <= a.length, b.length <= 2000", "a e b têm apenas letras minúsculas de a a z."],
    tags: ["Programação dinâmica", "Strings"],
    functionSpec: {
      name: "distanciaDeEdicao",
      params: [
        { name: "a", type: "string" },
        { name: "b", type: "string" }
      ],
      returns: "int"
    },
    timeLimitMs: 2500,
    publicCases: [call(["livro", "lirio"], editDistance("livro", "lirio")), call(["carro", "barco"], editDistance("carro", "barco"))],
    hiddenCases: [
      ...pairs.map(([a, b]) => call([a, b], editDistance(a, b))),
      ...big.map(([a, b]) => call([a.spec, b.spec], editDistance(a.value, b.value)))
    ],
    hints: [
      "Compare os últimos caracteres dos prefixos. Se forem iguais, nenhuma operação é necessária para eles; se forem diferentes, a última operação foi uma inserção, uma remoção ou uma troca.",
      "Estado: d[i][j] = distância entre a[0..i) e b[0..j). Casos base: d[i][0] = i (remover tudo) e d[0][j] = j (inserir tudo). Transição com caracteres diferentes: 1 + min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]).",
      "A linha i depende da linha i - 1 e da própria linha à esquerda: duas linhas de tamanho b.length + 1 bastam. Não esqueça de iniciar a posição 0 de cada linha nova com i."
    ],
    editorial: [
      "**Estado.** `d[i][j]` = menor número de operações para transformar os `i` primeiros caracteres de `a` nos `j` primeiros de `b`.",
      "",
      "**Casos base.** `d[i][0] = i` (remover os `i` caracteres) e `d[0][j] = j` (inserir os `j` caracteres).",
      "",
      "**Transição.** Se `a[i - 1] == b[j - 1]`, `d[i][j] = d[i - 1][j - 1]`. Senão, `d[i][j] = 1 + min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])`: remover `a[i - 1]`, inserir `b[j - 1]` ou trocar um pelo outro.",
      "",
      "Para `a = \"sol\"` e `b = \"sal\"`:",
      "",
      "| | ∅ | s | a | l |",
      "| --- | --- | --- | --- | --- |",
      "| ∅ | 0 | 1 | 2 | 3 |",
      "| s | 1 | 0 | 1 | 2 |",
      "| o | 2 | 1 | 1 | 2 |",
      "| l | 3 | 2 | 2 | 1 |",
      "",
      "```js",
      "function distanciaDeEdicao(a, b) {",
      "  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);",
      "  for (let i = 1; i <= a.length; i++) {",
      "    const cur = [i]; // d[i][0] = i",
      "    for (let j = 1; j <= b.length; j++) {",
      "      cur[j] = a[i - 1] === b[j - 1]",
      "        ? ant[j - 1]",
      "        : 1 + Math.min(ant[j], cur[j - 1], ant[j - 1]);",
      "    }",
      "    ant = cur;",
      "  }",
      "  return ant[b.length];",
      "}",
      "```",
      "",
      "**Custo.** Tempo `O(n · m)` e espaço `O(m)`. A recursão sem memória testa três ramos por posição e cresce como `3^(n + m)`."
    ].join("\n"),
    complexity: { time: "O(n · m)", space: "O(m)" }
  });
}

// =====================================================================
// Módulo: manipulação de bits
// =====================================================================

const POPCOUNT_MESSAGE = "Conte os bits com operações bit a bit (&, >>, n & (n - 1)): atalhos prontos de contagem ou de conversão para binário não são permitidos.";
const noPopcount = (pattern: string): SourceRule => ({ kind: "forbid", pattern, message: POPCOUNT_MESSAGE });

function contarBitsLigados(): Challenge {
  const random = createRandom(700901);
  const values = [0, 1, 2, 3, 7, 8, 255, 256, 1023, 1024, 2147483647, 1073741824, 1431655765, 715827882, 2147483646];
  while (values.length < 20) values.push(randomInt(random, 0, 2147483647));
  return defineChallenge({
    slug: "contar-bits-ligados",
    title: "Contar bits ligados",
    difficulty: "easy",
    moduleId: bitsModule,
    position: 0,
    description: [
      "Implemente `contarBitsLigados(n)`, que retorna quantos bits valem **1** na representação binária do inteiro não negativo `n`.",
      "",
      "Exemplos: `11` em binário é `1011`, que tem **3** bits ligados; `128` é `10000000`, com **1** bit ligado; `0` não tem nenhum.",
      "",
      "O objetivo é praticar operações bit a bit (`&`, `>>`, `n & (n - 1)`). Por isso, atalhos que fazem o trabalho por você **não são aceitos**: `bin()`, `bit_count()`, `format()` e f-strings em Python; `toString()` em JavaScript; `__builtin_popcount` e parecidos em C."
    ].join("\n"),
    constraints: ["0 <= n <= 2^31 - 1", "Sem funções prontas de contagem de bits nem conversão para texto binário."],
    tags: ["Bits"],
    functionSpec: { name: "contarBitsLigados", params: [{ name: "n", type: "int" }], returns: "int" },
    languages: [
      language("javascript", [noPopcount("\\btoString\\s*\\(|popcount|\\bparseInt\\s*\\(")]),
      language("python", [noPopcount("\\bbin\\s*\\(|bit_count|\\bformat\\s*\\(|\\b[fF][rRbB]?[\"']|popcount")]),
      language("c", [noPopcount("popcount|stdc_count_ones|\\bitoa\\s*\\(")])
    ],
    publicCases: [call([11], popcount(11)), call([128], popcount(128))],
    hiddenCases: values.map((n) => call([n], popcount(n))),
    hints: [
      "n & 1 diz se o bit menos significativo está ligado; n >> 1 descarta esse bit. Repita até n virar 0.",
      "Truque de Kernighan: n & (n - 1) apaga o bit 1 mais baixo de n. Conte quantas vezes dá para fazer isso até chegar a 0: o laço roda uma vez por bit ligado."
    ],
    editorial: [
      "**Ideia.** Subtrair 1 de `n` transforma o bit 1 mais baixo em 0 e todos os zeros à direita dele em 1. Por isso, `n & (n - 1)` é `n` com o bit 1 mais baixo apagado.",
      "",
      "Exemplo com `n = 12` (`1100`): `12 & 11 = 1100 & 1011 = 1000`; depois `8 & 7 = 0`. Duas iterações, dois bits ligados.",
      "",
      "```c",
      "int contarBitsLigados(int n) {",
      "    int total = 0;",
      "    while (n != 0) {",
      "        n &= n - 1; // apaga o bit 1 mais baixo",
      "        total++;",
      "    }",
      "    return total;",
      "}",
      "```",
      "",
      "**Custo.** O laço roda uma vez por bit ligado: no máximo 31 vezes, `O(1)` na prática (`O(log n)` em geral). Espaço `O(1)`.",
      "",
      "A versão bit a bit (`total += n & 1; n >>= 1;`) também passa; ela roda uma vez por bit até o mais alto."
    ].join("\n"),
    complexity: { time: "O(bits ligados)", space: "O(1)" }
  });
}

function numeroSolitario(): Challenge {
  const random = createRandom(701001);
  const paired = (values: number[], lonely: number) => shuffle(random, [...values, ...values, lonely]);
  const literal: number[][] = [
    [42],
    [-5],
    [0, 1, 0],
    [1000000000, -1000000000, 1000000000],
    [-1, -1, -2],
    paired([1, 2, 3, 4, 5], 0),
    [8, 2, 2],
    [5, 5, -3],
    [1, 1, 2, 2, 3, 3, 4, 5, 5],
    paired([...new Set(randomArray(random, 30, 1000, 1000000000))], -777),
    paired(Array.from({ length: 200 }, (_, index) => index - 100).filter((value) => value !== 0), 0),
    paired(Array.from({ length: 500 }, (_, index) => index * 3), 1000000000),
    paired([...new Set(randomArray(random, 2500, -1000000000, -1))], 1)
  ];
  const lonelyOf = (values: number[]) => xorAll(values);
  const big = [
    gen({
      $gen: "concat",
      parts: [{ $gen: "perm", n: 100000, seed: 701002, start: -50000 }, 123456789, { $gen: "perm", n: 100000, seed: 701003, start: -50000 }]
    }),
    gen({
      $gen: "concat",
      parts: [
        { $gen: "ints", n: 50000, min: -1000000000, max: 1000000000, seed: 701004, distinct: true },
        { $gen: "ints", n: 50000, min: -1000000000, max: 1000000000, seed: 701004, distinct: true, sorted: "desc" },
        -1000000000
      ]
    })
  ];
  return defineChallenge({
    slug: "numero-solitario",
    title: "Número solitário",
    difficulty: "easy",
    moduleId: bitsModule,
    position: 1,
    description: [
      "No vetor `nums`, todo número aparece **exatamente duas vezes**, menos um, que aparece **uma vez só**. Implemente `numeroSolitario(nums)`, que retorna esse número solitário.",
      "",
      "Exemplo: em `[7, 3, 5, 3, 7]`, o `3` e o `7` aparecem duas vezes; a resposta é `5`.",
      "",
      "Os pares **não** vêm lado a lado e o vetor pode ter 200 mil números, então comparar cada número com todos os outros é lento demais. Consegue resolver em uma passada e sem estrutura auxiliar?"
    ].join("\n"),
    constraints: [
      "1 <= nums.length <= 2 · 10^5 (sempre ímpar)",
      "-10^9 <= nums[i] <= 10^9",
      "Exatamente um valor aparece uma vez; todos os outros, exatamente duas."
    ],
    tags: ["Bits", "XOR"],
    functionSpec: { name: "numeroSolitario", params: [{ name: "nums", type: "int[]" }], returns: "int" },
    publicCases: [call([[7, 3, 5, 3, 7]], 5), call([[9, 4, 9]], 4)],
    hiddenCases: [...literal.map((values) => call([values], lonelyOf(values))), ...big.map((values) => call([values.spec], lonelyOf(values.value)))],
    hints: [
      "O XOR (^) tem duas propriedades úteis: x ^ x = 0 e x ^ 0 = x. Além disso, a ordem das operações não importa.",
      "Faça o XOR de todos os números do vetor: cada par se cancela, e o que sobra é o solitário. Uma passada, uma variável."
    ],
    editorial: [
      "**Ideia.** O XOR é comutativo e associativo, `x ^ x = 0` e `x ^ 0 = x`. Ao acumular o XOR de todo o vetor, podemos imaginar os pares reagrupados lado a lado: cada par vira 0, e sobra só o número solitário.",
      "",
      "Exemplo: `7 ^ 3 ^ 5 ^ 3 ^ 7 = (7 ^ 7) ^ (3 ^ 3) ^ 5 = 0 ^ 0 ^ 5 = 5`.",
      "",
      "```python",
      "def numeroSolitario(nums):",
      "    resultado = 0",
      "    for x in nums:",
      "        resultado ^= x  # pares se anulam",
      "    return resultado",
      "```",
      "",
      "**Custo.** Tempo `O(n)`, espaço `O(1)`. Funciona também com negativos, porque o XOR age sobre a representação em complemento de dois.",
      "",
      "Alternativas: um mapa de contagem (`O(n)` de tempo, mas `O(n)` de memória) ou ordenar e comparar vizinhos (`O(n log n)`). Contar cada número percorrendo o vetor inteiro custa `O(n²)` e estoura o tempo."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function potenciaDeDois(): Challenge {
  const values = [
    0, 1, -1, 2, -2, 3, -8, 6, 1024, 1023, 1025, 2 ** 30, 2 ** 31, 2 ** 32, 2 ** 32 + 2 ** 33, 2 ** 40, 2 ** 40 + 2 ** 20,
    2 ** 49, 2 ** 49 + 1, 2 ** 49 * 3, 2 ** 50 - 1, 2 ** 50, -(2 ** 50), 999999999999999
  ];
  return defineChallenge({
    slug: "potencia-de-dois",
    title: "Potência de dois",
    difficulty: "easy",
    moduleId: bitsModule,
    position: 2,
    description: [
      "Implemente `potenciaDeDois(n)`, que retorna `true` se `n` é uma potência de dois (`1, 2, 4, 8, 16, …`, ou seja, `n = 2^k` para algum inteiro `k >= 0`) e `false` caso contrário.",
      "",
      "- `0` e os números negativos **não** são potências de dois.",
      "- `1 = 2^0` **é** potência de dois.",
      "",
      "Em binário, uma potência de dois tem **exatamente um** bit ligado: `16` é `10000`. Esse fato leva a uma resposta de uma linha.",
      "",
      "**Atenção:** `n` pode chegar a `2^50`. Em JavaScript, os operadores bit a bit (`&`, `|`, `>>`) convertem o número para 32 bits e perdem os bits altos; use `BigInt` ou aritmética comum. E comparações com `Math.log2` sofrem com arredondamento de ponto flutuante perto de `2^50`."
    ].join("\n"),
    constraints: ["-2^50 <= n <= 2^50", "Retorne um booleano."],
    tags: ["Bits"],
    functionSpec: { name: "potenciaDeDois", params: [{ name: "n", type: "long" }], returns: "bool" },
    publicCases: [call([16], true), call([12], false)],
    hiddenCases: values.map((n) => call([n], isPowerOfTwo(n))),
    hints: [
      "Uma potência de dois positiva tem um único bit 1. Lembra do truque n & (n - 1), que apaga o bit 1 mais baixo?",
      "n é potência de dois se e só se n > 0 e n & (n - 1) == 0. Em C use long long; em JavaScript converta para BigInt antes (BigInt(n) & (BigInt(n) - 1n))."
    ],
    editorial: [
      "**Ideia.** Se `n > 0` tem um único bit ligado, `n - 1` liga todos os bits abaixo dele e desliga o próprio: `10000 - 1 = 01111`. Logo `n & (n - 1) == 0`. Se houver dois ou mais bits ligados, apagar o mais baixo ainda deixa algum ligado.",
      "",
      "```c",
      "bool potenciaDeDois(long long n) {",
      "    return n > 0 && (n & (n - 1)) == 0;",
      "}",
      "```",
      "",
      "Em JavaScript, `&` trabalha com 32 bits: `2^32 + 2^33` viraria `0` e pareceria potência. Com `BigInt` a conta é exata:",
      "",
      "```js",
      "function potenciaDeDois(n) {",
      "  const x = BigInt(n);",
      "  return x > 0n && (x & (x - 1n)) === 0n;",
      "}",
      "```",
      "",
      "**Custo.** `O(1)` de tempo e espaço. A alternativa por divisões sucessivas (`while (n % 2 == 0) n /= 2`) custa `O(log n)` e também é correta."
    ].join("\n"),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function distanciaDeHamming(): Challenge {
  const random = createRandom(701201);
  const MAX = 4294967295;
  const pairs: Array<[number, number]> = [
    [0, 0],
    [7, 7],
    [0, 1],
    [1, 4],
    [0, MAX],
    [MAX, MAX],
    [2147483648, 0],
    [2147483648, 2147483647],
    [3000000000, 1],
    [MAX, 1],
    [1431655765, 2863311530]
  ];
  while (pairs.length < 20) pairs.push([randomInt(random, 0, MAX), randomInt(random, 0, MAX)]);
  const hamming = (x: number, y: number) => popcount((x ^ y) >>> 0);
  return defineChallenge({
    slug: "distancia-de-hamming",
    title: "Distância de Hamming",
    difficulty: "medium",
    moduleId: bitsModule,
    position: 3,
    description: [
      "A **distância de Hamming** entre dois inteiros é a quantidade de posições em que seus bits diferem. Implemente `distanciaDeHamming(x, y)`, que a retorna para dois inteiros não negativos de até 32 bits.",
      "",
      "Exemplo: `5 = 0101` e `9 = 1001` diferem nos bits das posições 2 e 3, então a distância é **2**.",
      "",
      "Os valores vão até `2^32 - 1 = 4294967295`. Em C, eles chegam como `long long`. Em JavaScript, o resultado de `x ^ y` é um inteiro de 32 bits **com sinal**: quando o bit 31 está ligado, ele fica negativo. Use `>>>` (deslocamento sem sinal) ou `>>> 0` para tratá-lo como sem sinal."
    ].join("\n"),
    constraints: ["0 <= x, y <= 2^32 - 1"],
    tags: ["Bits", "XOR"],
    functionSpec: {
      name: "distanciaDeHamming",
      params: [
        { name: "x", type: "long" },
        { name: "y", type: "long" }
      ],
      returns: "int"
    },
    publicCases: [call([5, 9], hamming(5, 9)), call([0, 15], hamming(0, 15))],
    hiddenCases: pairs.map(([x, y]) => call([x, y], hamming(x, y))),
    hints: [
      "O XOR liga exatamente os bits em que x e y diferem. A resposta é a quantidade de bits 1 em x ^ y.",
      "Conte os bits de x ^ y com n & (n - 1) ou com (n & 1) e deslocamento. Em JavaScript, faça (x ^ y) >>> 0 antes, para o bit 31 não virar sinal negativo."
    ],
    editorial: [
      "**Ideia.** `x ^ y` tem bit 1 exatamente nas posições em que `x` e `y` diferem. Basta contar os bits ligados do XOR, como em *Contar bits ligados*.",
      "",
      "```js",
      "function distanciaDeHamming(x, y) {",
      "  let diferenca = (x ^ y) >>> 0; // sem sinal: o bit 31 não vira negativo",
      "  let total = 0;",
      "  while (diferenca !== 0) {",
      "    diferenca &= diferenca - 1; // apaga o bit 1 mais baixo",
      "    diferenca >>>= 0;",
      "    total++;",
      "  }",
      "  return total;",
      "}",
      "```",
      "",
      "Em C, com `long long`, `x ^ y` é exato e o mesmo laço funciona; em Python, os inteiros não têm limite de bits.",
      "",
      "**Custo.** `O(1)` (no máximo 32 iterações) de tempo e espaço.",
      "",
      "**Armadilha.** Em JavaScript, `x ^ y` para `x = 2^31` dá `-2147483648`; um laço `while (v > 0)` nem começa e responde 0."
    ].join("\n"),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

const TWO_LONELY_MESSAGE = "Resolva com O(1) de memória extra: sem mapas, conjuntos, dicionários nem ordenação. Use XOR.";
const twoLonelyRule = (pattern: string): SourceRule => ({ kind: "forbid", pattern, message: TWO_LONELY_MESSAGE });

function doisSolitarios(): Challenge {
  const random = createRandom(701301);
  const literal: number[][] = [
    [1, 2],
    [0, -1],
    [-1000000000, 1000000000],
    [5, 5, 6, 7],
    [4, 4, 8, 16],
    shuffle(random, [3, 3, -3, -3, 0, 12]),
    shuffle(random, [1, 3, 5, 7, 9, 1, 3, 5, 11, 13, 9, 7]),
    shuffle(random, [...Array.from({ length: 300 }, (_, index) => index * 2), ...Array.from({ length: 300 }, (_, index) => index * 2), 1, 1001]),
    [7, -7],
    [999999999, 5, -999999999, 5],
    [1 << 29, 3, 0, 3],
    [-8, -3, -8, 4, 4, -1],
    shuffle(random, [...Array.from({ length: 2500 }, (_, index) => -index * 7 - 2), ...Array.from({ length: 2500 }, (_, index) => -index * 7 - 2), 1000000000, -1000000000])
  ];
  const big = [
    gen({
      $gen: "concat",
      parts: [{ $gen: "perm", n: 100000, seed: 701302, start: 1 }, -5, { $gen: "perm", n: 99998, seed: 701303, start: 1 }, 100000]
    }),
    gen({
      $gen: "concat",
      parts: [
        { $gen: "ints", n: 50000, min: -1000000000, max: 1000000000, seed: 701304, distinct: true },
        { $gen: "ints", n: 50000, min: -1000000000, max: 1000000000, seed: 701304, distinct: true },
        999999999,
        -999999999
      ]
    })
  ];
  const cases = [...literal.map((values) => ({ arg: values as unknown, values })), ...big.map((values) => ({ arg: values.spec as unknown, values: values.value as number[] }))];
  return defineChallenge({
    slug: "dois-solitarios",
    title: "Dois solitários",
    difficulty: "hard",
    moduleId: bitsModule,
    position: 4,
    isBoss: true,
    description: [
      "Agora são **dois** os solitários: em `nums`, todo número aparece exatamente duas vezes, menos dois números diferentes, que aparecem uma vez cada. Implemente `doisSolitarios(nums)`, que retorna esses dois números em **ordem crescente**.",
      "",
      "Exemplo: em `[3, 8, 3, 1, 8, 6]`, os solitários são `1` e `6`; retorne `[1, 6]`.",
      "",
      "Resolva em **O(n)** de tempo e **O(1)** de memória extra: mapas, conjuntos, dicionários e ordenação **não são aceitos**. O XOR de todo o vetor dá `a ^ b` (os dois solitários misturados); falta descobrir como separá-los.",
      "",
      "**Em C:** retorne um vetor de 2 posições (alocado com `malloc` ou `static`) e preencha `*returnSize` com 2."
    ].join("\n"),
    constraints: [
      "2 <= nums.length <= 2 · 10^5 (sempre par)",
      "-10^9 <= nums[i] <= 10^9",
      "Exatamente dois valores aparecem uma vez; os outros, exatamente duas.",
      "Memória extra O(1): sem Map/Set/dict e sem ordenação."
    ],
    tags: ["Bits", "XOR"],
    functionSpec: { name: "doisSolitarios", params: [{ name: "nums", type: "int[]" }], returns: "int[]" },
    languages: [
      language("javascript", [twoLonelyRule("\\b(Map|Set|WeakMap|WeakSet)\\b|\\.sort\\s*\\(|=\\s*\\{\\s*\\}")]),
      language("python", [twoLonelyRule("\\b(dict|set|frozenset|Counter|defaultdict|sorted)\\b|\\.sort\\s*\\(|\\{")]),
      language("c", [twoLonelyRule("\\bqsort\\s*\\(")])
    ],
    publicCases: [call([[3, 8, 3, 1, 8, 6]], [1, 6]), call([[2, -7]], [-7, 2])],
    hiddenCases: cases.map(({ arg, values }) => call([arg], twoLonely(values))),
    hints: [
      "Seja x o XOR de todo o vetor. Os pares se anulam, então x = a ^ b, e x não é zero porque a e b são diferentes.",
      "Qualquer bit ligado em x é um bit em que a e b diferem. O bit 1 mais baixo sai de x & -x.",
      "Separe o vetor em dois grupos: números com esse bit ligado e números com ele desligado. Cada par cai inteiro num grupo, e a e b caem em grupos diferentes. O XOR de cada grupo dá um dos solitários."
    ],
    editorial: [
      "**Ideia.** O XOR de tudo dá `x = a ^ b`. Um bit ligado em `x` distingue `a` de `b`; usamos o mais baixo, `bit = x & -x`. Todo número com esse bit ligado vai para um grupo e os demais para outro. Os pares nunca se separam (os dois iguais têm o mesmo bit), então o XOR de cada grupo é exatamente um dos solitários.",
      "",
      "**Passo a passo.**",
      "",
      "1. `x = XOR de todos`.",
      "2. `bit = x & -x` (em C, faça a conta com `unsigned` para não transbordar).",
      "3. `a = XOR dos números com (num & bit) != 0`; `b = x ^ a`.",
      "4. Retorne `[min(a, b), max(a, b)]`.",
      "",
      "```c",
      "int* doisSolitarios(int* nums, int numsSize, int* returnSize) {",
      "    unsigned x = 0;",
      "    for (int i = 0; i < numsSize; i++) x ^= (unsigned)nums[i];",
      "    unsigned bit = x & (~x + 1u);          // bit 1 mais baixo",
      "    unsigned a = 0;",
      "    for (int i = 0; i < numsSize; i++)",
      "        if ((unsigned)nums[i] & bit) a ^= (unsigned)nums[i];",
      "    int p = (int)a, q = (int)(x ^ a);",
      "    int* resposta = malloc(2 * sizeof(int));",
      "    resposta[0] = p < q ? p : q;",
      "    resposta[1] = p < q ? q : p;",
      "    *returnSize = 2;",
      "    return resposta;",
      "}",
      "```",
      "",
      "**Custo.** Duas passadas: tempo `O(n)`, espaço `O(1)`."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

export function buildAlgoritmosAvancadosChallenges(): Challenge[] {
  return [
    todosOsSubconjuntos(),
    permutacoes(),
    combinacoesComSomaAlvo(),
    nRainhas(),
    resolverSudoku(),
    assaltoAsCasas(),
    caminhosComObstaculos(),
    maiorSubsequenciaComum(),
    mochila01(),
    distanciaDeEdicao(),
    contarBitsLigados(),
    numeroSolitario(),
    potenciaDeDois(),
    distanciaDeHamming(),
    doisSolitarios()
  ];
}
