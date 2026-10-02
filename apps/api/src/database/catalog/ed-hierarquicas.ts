import type { Challenge, SourceRule } from "../../domain/types.js";
import {
  call,
  createRandom,
  defineChallenge,
  gen,
  language,
  randomArray,
  randomInt,
  randomWord,
  rules,
  shuffle,
  type CaseDefinition
} from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Estrutura de Dados", segunda metade: tabelas hash, árvores, heaps e
 * grafos. Desafios no modo função (JavaScript, Python e C), exceto a tabela
 * hash com encadeamento, que é em C no modo stdio porque o assunto é a
 * própria struct com malloc. Sementes na faixa 500000–599999.
 */

const F = "```";

// ---------- Árvores (referência) ----------
interface TNode {
  val: number;
  left: TNode | null;
  right: TNode | null;
}

const node = (val: number): TNode => ({ val, left: null, right: null });

/** Ordem de níveis com null nos filhos ausentes, sem nulls no fim (formato do juiz). */
function toLevelOrder(root: TNode | null): Array<number | null> {
  const values: Array<number | null> = [];
  const queue: Array<TNode | null> = [root];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) {
      values.push(null);
      continue;
    }
    values.push(current.val);
    queue.push(current.left, current.right);
  }
  while (values.length && values[values.length - 1] === null) values.pop();
  return values;
}

function fromLevelOrder(values: Array<number | null>): TNode | null {
  if (!values.length || values[0] === null) return null;
  const root = node(values[0]);
  const queue = [root];
  let index = 1;
  for (let head = 0; head < queue.length && index < values.length; head += 1) {
    const current = queue[head];
    const left = values[index++];
    if (left !== null && left !== undefined) queue.push((current.left = node(left)));
    const right = index < values.length ? values[index++] : null;
    if (right !== null && right !== undefined) queue.push((current.right = node(right)));
  }
  return root;
}

/** Árvore de formato aleatório: cada nó novo desce da raiz sorteando o lado até achar vaga. */
function randomTree(random: () => number, values: number[]): TNode | null {
  if (!values.length) return null;
  const root = node(values[0]);
  for (const value of values.slice(1)) {
    let current = root;
    for (;;) {
      if (random() < 0.5) {
        if (!current.left) {
          current.left = node(value);
          break;
        }
        current = current.left;
      } else {
        if (!current.right) {
          current.right = node(value);
          break;
        }
        current = current.right;
      }
    }
  }
  return root;
}

/** Árvore degenerada (uma lista): sempre à esquerda, sempre à direita ou em zigue-zague. */
function chainTree(values: number[], side: "left" | "right" | "zigzag"): TNode | null {
  if (!values.length) return null;
  const root = node(values[0]);
  let current = root;
  values.slice(1).forEach((value, index) => {
    const goLeft = side === "left" || (side === "zigzag" && index % 2 === 0);
    const child = node(value);
    if (goLeft) current.left = child;
    else current.right = child;
    current = child;
  });
  return root;
}

/** Árvore completa: os valores já estão em ordem de níveis. */
const completeTree = (values: number[]) => fromLevelOrder(values);

function treeHeight(root: TNode | null): number {
  // Iterativo: a referência não pode depender da pilha do Node.
  let height = 0;
  let level: TNode[] = root ? [root] : [];
  while (level.length) {
    height += 1;
    const next: TNode[] = [];
    for (const current of level) {
      if (current.left) next.push(current.left);
      if (current.right) next.push(current.right);
    }
    level = next;
  }
  return height;
}

/** Nós em pós-ordem, sem recursão (filhos antes dos pais). */
function postOrderNodes(root: TNode | null): TNode[] {
  const stack: TNode[] = root ? [root] : [];
  const reversed: TNode[] = [];
  while (stack.length) {
    const current = stack.pop()!;
    reversed.push(current);
    if (current.left) stack.push(current.left);
    if (current.right) stack.push(current.right);
  }
  return reversed.reverse();
}

function traversals(root: TNode | null): number[][] {
  const pre: number[] = [];
  const inorder: number[] = [];
  const post = postOrderNodes(root).map((current) => current.val);
  const stack: TNode[] = root ? [root] : [];
  while (stack.length) {
    const current = stack.pop()!;
    pre.push(current.val);
    if (current.right) stack.push(current.right);
    if (current.left) stack.push(current.left);
  }
  const path: TNode[] = [];
  let cursor = root;
  while (cursor || path.length) {
    while (cursor) {
      path.push(cursor);
      cursor = cursor.left;
    }
    const current = path.pop()!;
    inorder.push(current.val);
    cursor = current.right;
  }
  return [pre, inorder, post];
}

function insertBst(root: TNode | null, value: number): TNode {
  if (!root) return node(value);
  let current = root;
  for (;;) {
    if (value === current.val) return root;
    if (value < current.val) {
      if (!current.left) {
        current.left = node(value);
        return root;
      }
      current = current.left;
    } else {
      if (!current.right) {
        current.right = node(value);
        return root;
      }
      current = current.right;
    }
  }
}

const buildBst = (values: number[]) => values.reduce<TNode | null>((root, value) => insertBst(root, value), null);

/** BST perfeitamente equilibrada a partir de valores ordenados. */
function balancedFromSorted(values: number[]): TNode | null {
  const build = (low: number, high: number): TNode | null => {
    if (low > high) return null;
    const middle = (low + high) >> 1;
    const current = node(values[middle]);
    current.left = build(low, middle - 1);
    current.right = build(middle + 1, high);
    return current;
  };
  return build(0, values.length - 1);
}

function isBalanced(root: TNode | null): boolean {
  const heights = new Map<TNode, number>();
  for (const current of postOrderNodes(root)) {
    const left = current.left ? heights.get(current.left)! : 0;
    const right = current.right ? heights.get(current.right)! : 0;
    if (Math.abs(left - right) > 1) return false;
    heights.set(current, 1 + Math.max(left, right));
  }
  return true;
}

/** Somas de todos os caminhos raiz-folha. */
function leafSums(root: TNode | null): number[] {
  const sums: number[] = [];
  const stack: Array<[TNode, number]> = root ? [[root, root.val]] : [];
  while (stack.length) {
    const [current, sum] = stack.pop()!;
    if (!current.left && !current.right) sums.push(sum);
    if (current.left) stack.push([current.left, sum + current.left.val]);
    if (current.right) stack.push([current.right, sum + current.right.val]);
  }
  return sums;
}

// ---------- Heap (referência) ----------
/** Heap máximo de números em vetor tipado (rápido para as referências grandes). */
class MaxHeap {
  private readonly items: Float64Array;
  size = 0;
  constructor(capacity: number) {
    this.items = new Float64Array(Math.max(1, capacity));
  }

  push(value: number) {
    const items = this.items;
    let index = this.size++;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (items[parent] >= value) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = value;
  }

  pop(): number {
    const items = this.items;
    const top = items[0];
    const last = items[--this.size];
    let index = 0;
    for (;;) {
      let child = 2 * index + 1;
      if (child >= this.size) break;
      if (child + 1 < this.size && items[child + 1] > items[child]) child += 1;
      if (items[child] <= last) break;
      items[index] = items[child];
      index = child;
    }
    items[index] = last;
    return top;
  }
}

// =====================================================================
// Módulo: Tabelas hash
// =====================================================================

function frequenciaDePalavras(): Challenge {
  const random = createRandom(500100);
  const contar = (palavras: string[]) => {
    const counts = new Map<string, number>();
    for (const palavra of palavras) counts.set(palavra, (counts.get(palavra) ?? 0) + 1);
    return [...counts].map(([palavra, total]) => `${palavra}: ${total}`);
  };
  const vocabulary = (size: number, minLength: number, maxLength: number, alphabet?: string) => {
    const words = new Set<string>();
    while (words.size < size) words.add(randomWord(random, minLength, maxLength, alphabet));
    return [...words];
  };
  const sample = (words: string[], count: number) => Array.from({ length: count }, () => words[randomInt(random, 0, words.length - 1)]);

  const hidden: string[][] = [
    [],
    ["eco"],
    Array(1000).fill("eco"),
    ["constructor", "toString", "constructor", "__proto__", "valor", "__proto__"],
    ["10", "2", "10", "1", "2", "10"],
    ["Casa", "casa", "CASA", "casa"],
    ["a", "b", "c", "d", "e", "f"],
    ["hasOwnProperty", "valueOf", "hasOwnProperty", "isPrototypeOf"],
    ["x_1", "x1", "X_1", "x_1", "_", "__", "_"],
    ["abcdefghijklmnopqrst", "abcdefghijklmnopqrst", "abcdefghijklmnopqrs"],
    sample(vocabulary(30, 2, 6), 200),
    sample(vocabulary(5, 1, 3), 5000),
    vocabulary(2000, 3, 8),
    sample(vocabulary(300, 3, 7), 18000),
    sample(vocabulary(150, 1, 8, "abcXYZ019_"), 3000),
    shuffle(random, [...Array(40).fill("sol"), ...Array(25).fill("lua"), ...Array(3).fill("constructor"), "mar"])
  ];

  return defineChallenge({
    slug: "frequencia-de-palavras",
    title: "Frequência de palavras",
    difficulty: "easy",
    moduleId: moduleId("hash"),
    position: 0,
    description: `
Implemente a função \`contarPalavras(palavras)\`, que recebe um vetor de palavras e retorna um vetor de textos no formato \`"palavra: n"\`, em que **n** é quantas vezes a palavra aparece.

- Cada palavra distinta aparece **uma única vez** no resultado.
- A ordem do resultado é a da **primeira aparição** de cada palavra no vetor de entrada.
- Maiúsculas e minúsculas são diferentes: \`Casa\` e \`casa\` são palavras distintas.
- Um vetor vazio produz um resultado vazio.

**Exemplo:** para \`["o", "rato", "roeu", "o", "queijo", "o"]\`, o retorno é \`["o: 3", "rato: 1", "roeu: 1", "queijo: 1"]\`.

Uma tabela hash (\`Map\` em JavaScript, \`dict\` em Python, uma tabela própria em C) conta cada palavra em tempo constante médio.
`.trim(),
    constraints: [
      "0 <= palavras.length <= 20000",
      "Cada palavra tem de 1 a 20 caracteres: letras sem acento, dígitos ou _ (sem espaços).",
      "Qualquer texto desse formato é uma palavra válida, inclusive nomes como constructor ou __proto__.",
      "Em C, retorne um vetor alocado com malloc e preencha *returnSize."
    ],
    tags: ["Hash", "Contagem"],
    functionSpec: { name: "contarPalavras", params: [{ name: "palavras", type: "string[]" }], returns: "string[]" },
    publicCases: [
      call([["o", "rato", "roeu", "o", "queijo", "o"]], contar(["o", "rato", "roeu", "o", "queijo", "o"])),
      call([["bola", "Bola", "bola"]], contar(["bola", "Bola", "bola"]))
    ],
    hiddenCases: hidden.map((palavras) => call([palavras], contar(palavras))),
    hints: [
      "Você precisa de duas coisas: quantas vezes cada palavra apareceu e em que ordem elas apareceram pela primeira vez.",
      "Um Map de JavaScript (ou um dict de Python) guarda as chaves na ordem de inserção. Cuidado com objetos literais {} em JavaScript: chaves como \"constructor\" já existem no protótipo e chaves numéricas mudam de ordem.",
      "Em C, monte uma tabela hash de strings (função de hash como djb2 e sondagem linear) que guarde o índice de cada palavra distinta em um vetor na ordem de chegada."
    ],
    editorial: `
**Ideia.** Percorra as palavras uma vez. Para cada uma, consulte a tabela hash: se ela é nova, registre-a na lista de ordem com contagem 1; se já existe, some 1. No fim, monte os textos na ordem registrada.

1. Crie um mapa \`palavra → contagem\` que preserve a ordem de inserção.
2. Para cada palavra, incremente a contagem (criando com 0 se não existir).
3. Converta cada par em \`"palavra: n"\`.

${F}js
function contarPalavras(palavras) {
  const contagem = new Map();
  for (const palavra of palavras) {
    contagem.set(palavra, (contagem.get(palavra) ?? 0) + 1);
  }
  return [...contagem].map(([palavra, n]) => palavra + ": " + n);
}
${F}

Com um objeto literal (\`{}\`) o código parece funcionar, mas quebra com palavras como \`constructor\` (já herdada do protótipo) e reordena chaves numéricas como \`"10"\` e \`"2"\`. \`Map\` não tem esses problemas.

**Custo:** O(n · L) no total, em que L é o tamanho das palavras; cada consulta à tabela é O(1) em média.
`.trim(),
    complexity: { time: "O(n · L)", space: "O(n · L)" }
  });
}

function primeiroCaractereUnico(): Challenge {
  const random = createRandom(500200);
  const semZ = "abcdefghijklmnopqrstuvwxy";
  const firstUnique = (text: string) => {
    const counts = new Array(26).fill(0);
    for (const char of text) counts[char.charCodeAt(0) - 97] += 1;
    for (let index = 0; index < text.length; index += 1) if (counts[text.charCodeAt(index) - 97] === 1) return index;
    return -1;
  };
  const literal = [
    "z", "zz", "abc", "aabbc", "abcabcd", "aabbccddeeffgghhiijjkkllmmnnooppqqrrssttuuvvwwxxyyzz", "zyxwvutsrqponmlkjihgfedcbaz",
    "leetleet", "qwertyuiopasdfghjklzxcvbnmq", "bbbbbbbbba", "m" + "abcdefghijklnopqrstuvwxyz".repeat(400)
  ];
  while (literal.length < 13) {
    const length = randomInt(random, 5, 60);
    let text = "";
    for (let index = 0; index < length; index += 1) text += "abcdefg"[randomInt(random, 0, 6)];
    literal.push(text);
  }
  // Casos enormes com resposta conhecida pela construção (cada letra de a a y
  // aparece milhares de vezes; o único z está na posição indicada).
  const big: Array<[unknown, number]> = [
    [{ $gen: "concat", parts: [{ $gen: "string", n: 100000, seed: 500201, alphabet: semZ }, "z", { $gen: "string", n: 99999, seed: 500202, alphabet: semZ }] }, 100000],
    [{ $gen: "string", n: 200000, seed: 500203 }, -1],
    [{ $gen: "concat", parts: [{ $gen: "string", n: 199990, seed: 500204, alphabet: semZ }, "z", "abcdefghi"] }, 199990]
  ];

  return defineChallenge({
    slug: "primeiro-caractere-unico",
    title: "Primeiro caractere único",
    difficulty: "medium",
    moduleId: moduleId("hash"),
    position: 1,
    description: `
Implemente a função \`primeiroUnico(s)\`, que recebe um texto \`s\` formado só por letras minúsculas de \`a\` a \`z\` e retorna o **índice** (a partir de 0) do primeiro caractere que aparece **exatamente uma vez** em todo o texto. Se nenhum caractere for único, retorne \`-1\`.

**Exemplos:**

- \`"abacabad"\`: \`a\` aparece 4 vezes e \`b\` 2 vezes; \`c\`, na posição 3, é o primeiro que aparece uma vez só. Retorno: \`3\`.
- \`"xxyy"\`: todos se repetem. Retorno: \`-1\`.

O texto pode ter até 200 mil caracteres: contar as ocorrências de cada caractere percorrendo o texto inteiro de novo, para cada posição, é lento demais.
`.trim(),
    constraints: [
      "1 <= s.length <= 2 · 10^5",
      "s contém apenas letras minúsculas de a a z.",
      "Retorne o índice (base 0) ou -1."
    ],
    tags: ["Hash", "Contagem", "Strings"],
    functionSpec: { name: "primeiroUnico", params: [{ name: "s", type: "string" }], returns: "int" },
    publicCases: [call(["abacabad"], 3), call(["xxyy"], -1)],
    hiddenCases: [
      ...literal.map((text) => call([text], firstUnique(text))),
      ...big.map(([text, answer]) => call([text], answer))
    ],
    hints: [
      "Resolva em duas passadas pelo texto, não em uma passada por caractere.",
      "Na primeira passada, conte quantas vezes cada letra aparece (um vetor de 26 posições funciona como tabela hash). Na segunda, devolva a primeira posição cuja letra tem contagem 1."
    ],
    editorial: `
**Ideia.** A pergunta "este caractere aparece uma vez só?" depende do texto inteiro, então primeiro conte tudo e depois procure.

1. Crie um vetor \`contagem\` com 26 zeros, um para cada letra.
2. Percorra o texto somando 1 em \`contagem[letra - 'a']\`.
3. Percorra o texto de novo; a primeira posição cuja letra tem contagem 1 é a resposta.
4. Se nenhuma tiver, retorne -1.

${F}c
int primeiroUnico(char* s) {
    int contagem[26] = {0};
    for (int i = 0; s[i]; i++) contagem[s[i] - 'a']++;
    for (int i = 0; s[i]; i++)
        if (contagem[s[i] - 'a'] == 1) return i;
    return -1;
}
${F}

A versão ingênua, que para cada posição conta de novo as ocorrências no texto todo, faz n² operações: com n = 200 mil são 4 · 10^10 passos.

**Custo:** O(n) de tempo e O(1) de memória extra (26 contadores).
`.trim(),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function duplicadoProximo(): Challenge {
  const random = createRandom(500300);
  const answer = (nums: number[], k: number) => {
    const last = new Map<number, number>();
    for (let index = 0; index < nums.length; index += 1) {
      const previous = last.get(nums[index]);
      if (previous !== undefined && index - previous <= k) return true;
      last.set(nums[index], index);
    }
    return false;
  };
  const literal: Array<[number[], number]> = [
    [[5], 0],
    [[7, 7], 0],
    [[7, 7], 1],
    [[1, 0, 1, 1], 1],
    [[-1, -1], 5],
    [[1, 2, 1], 1],
    [[1, 2, 3, 4, 5, 1], 4],
    [[1, 2, 3, 4, 5, 1], 5],
    [[-1000000000, 1000000000, -1000000000], 2],
    [[4, 1, 2, 3, 1, 5, 4], 3],
    [[9, 8, 7, 6, 5, 4, 3, 2, 1, 9], 8],
    [[9, 8, 7, 6, 5, 4, 3, 2, 1, 9], 9]
  ];
  while (literal.length < 13) {
    const length = randomInt(random, 5, 200);
    literal.push([randomArray(random, length, -50, 50), randomInt(random, 0, 10)]);
  }
  // Casos enormes com resposta conhecida pela construção:
  // - permutação: 200 mil valores distintos, sem duplicado;
  // - a mesma permutação duas vezes: cada valor repete a distância exata de 100000;
  // - 1..199999 e depois 150000 de novo: a repetição está a distância 50000.
  const big: Array<[unknown, number, boolean]> = [
    [{ $gen: "perm", n: 200000, seed: 500301, start: -100000 }, 100000, false],
    [{ $gen: "concat", parts: [{ $gen: "perm", n: 100000, seed: 500302 }, { $gen: "perm", n: 100000, seed: 500302 }] }, 99999, false],
    [{ $gen: "concat", parts: [{ $gen: "range", n: 199999, start: 1 }, [150000]] }, 49999, false]
  ];
  const dense = gen({ $gen: "ints", n: 200000, min: 0, max: 1000, seed: 500303 });

  return defineChallenge({
    slug: "duplicado-proximo",
    title: "Duplicado próximo",
    difficulty: "medium",
    moduleId: moduleId("hash"),
    position: 2,
    description: `
Implemente a função \`temDuplicadoProximo(nums, k)\`, que retorna \`true\` se existem dois índices **diferentes** \`i\` e \`j\` com \`nums[i] == nums[j]\` e \`|i − j| <= k\`, e \`false\` caso contrário.

**Exemplos:**

- \`nums = [1, 2, 3, 1]\`, \`k = 3\`: o valor 1 aparece nas posições 0 e 3, distância 3. Retorno: \`true\`.
- \`nums = [1, 2, 3, 1, 2, 3]\`, \`k = 2\`: cada repetição está a distância 3. Retorno: \`false\`.

Com \`k = 0\` a resposta é sempre \`false\`, porque os índices precisam ser diferentes. O vetor pode ter até 200 mil elementos e \`k\` pode ser tão grande quanto o vetor: comparar cada posição com as \`k\` seguintes é lento demais.
`.trim(),
    constraints: [
      "1 <= nums.length <= 2 · 10^5",
      "-10^9 <= nums[i] <= 10^9",
      "0 <= k <= 2 · 10^5"
    ],
    tags: ["Hash", "Janela deslizante"],
    functionSpec: {
      name: "temDuplicadoProximo",
      params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
      returns: "bool"
    },
    publicCases: [call([[1, 2, 3, 1], 3], true), call([[1, 2, 3, 1, 2, 3], 2], false)],
    hiddenCases: [
      ...literal.map(([nums, k]) => call([nums, k], answer(nums, k))),
      ...big.map(([nums, k, expected]) => call([nums, k], expected)),
      call([dense.spec, 1], answer(dense.value, 1))
    ],
    hints: [
      "Para decidir sobre a posição i, basta saber onde o mesmo valor apareceu pela última vez.",
      "Guarde em uma tabela hash o último índice de cada valor. Ao chegar em i, se o valor já está na tabela e i − último <= k, a resposta é true; em qualquer caso, atualize o último índice para i."
    ],
    editorial: `
**Ideia.** Das ocorrências anteriores de um valor, a mais próxima de \`i\` é sempre a última. Então uma tabela \`valor → último índice\` responde tudo em uma passada.

1. Percorra \`nums\` da esquerda para a direita.
2. Se \`nums[i]\` já está na tabela e \`i - tabela[nums[i]] <= k\`, retorne \`true\`.
3. Grave \`tabela[nums[i]] = i\`.
4. Se o laço terminar, retorne \`false\`.

${F}python
def temDuplicadoProximo(nums, k):
    ultimo = {}
    for i, valor in enumerate(nums):
        if valor in ultimo and i - ultimo[valor] <= k:
            return True
        ultimo[valor] = i
    return False
${F}

Em C não há dicionário pronto: uma tabela com endereçamento aberto (vetor de 2^19 posições, sondagem linear) guarda pares valor/índice.

**Custo:** O(n) de tempo médio e O(n) de memória. A versão que compara cada posição com as k seguintes custa O(n · k), cerca de 2 · 10^10 comparações no pior caso.
`.trim(),
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

function tabelaHashComEncadeamento(): Challenge {
  const random = createRandom(500400);
  type Command = ["inserir" | "buscar" | "remover", number];
  const render = (commands: Command[]): CaseDefinition => {
    const set = new Set<number>();
    const output: string[] = [];
    for (const [command, value] of commands) {
      if (command === "inserir") set.add(value);
      else if (command === "buscar") output.push(set.has(value) ? "encontrado" : "ausente");
      else output.push(set.delete(value) ? "removido" : "ausente");
    }
    output.push(`total: ${set.size}`);
    return {
      input: [...commands.map(([command, value]) => `${command} ${value}`), "fim"].join("\n"),
      output: output.join("\n")
    };
  };
  const inserts = (values: number[]): Command[] => values.map((value) => ["inserir", value]);
  const mixed = (inserted: number[], queries: number, removals: number, min: number, max: number): Command[] => {
    const commands: Command[] = inserts(inserted);
    const probe = () => (random() < 0.5 ? inserted[randomInt(random, 0, inserted.length - 1)] : randomInt(random, min, max));
    const tail: Command[] = [
      ...Array.from({ length: queries }, (): Command => ["buscar", probe()]),
      ...Array.from({ length: removals }, (): Command => ["remover", probe()]),
      ...Array.from({ length: Math.floor(queries / 4) }, (): Command => [random() < 0.5 ? "inserir" : "buscar", probe()])
    ];
    return [...commands, ...shuffle(random, tail)];
  };
  // Todos no mesmo balde de uma tabela de 1009 posições.
  const colliding = [5, 1014, 2023, 3032, -1004];

  const hidden: Command[][] = [
    [],
    [["buscar", 0], ["remover", 0]],
    [["inserir", 0], ["inserir", 0], ["buscar", 0], ["remover", 0], ["buscar", 0], ["remover", 0]],
    [["inserir", -7], ["inserir", 7], ["buscar", -7], ["buscar", 7], ["remover", -7], ["buscar", -7], ["buscar", 7]],
    [...inserts(colliding.slice(0, 3)), ["remover", 1014], ["buscar", 1014], ["buscar", 2023], ["buscar", 5]],
    [...inserts(colliding), ["remover", 5], ["remover", 3032], ["remover", -1004], ["buscar", 1014], ["buscar", 2023], ["buscar", 5], ["remover", 5]],
    [["inserir", 1000000000], ["inserir", -1000000000], ["buscar", 1000000000], ["buscar", -1000000000], ["remover", 1000000000], ["buscar", 1000000000]],
    [...inserts([10, 20, 30, 40, 50]), ["remover", 30], ["inserir", 30], ["buscar", 30], ["remover", 10], ["remover", 50], ["buscar", 40]],
    mixed(randomArray(random, 60, -30, 30), 40, 30, -30, 30),
    mixed(randomArray(random, 300, -1000, 1000), 150, 150, -1000, 1000),
    // Muitos múltiplos de 1000: colisões em tabelas com tamanho que divide 1000.
    mixed(randomArray(random, 3000, -99, 99).map((value) => value * 1000), 800, 700, -99000, 99000),
    // Grandes: mais de dez mil comandos, dentro de 192 KB de entrada.
    mixed(randomArray(random, 7000, 0, 99999), 1600, 1600, 0, 99999),
    mixed(randomArray(random, 7000, -49999, 49999), 1500, 1700, -49999, 49999),
    mixed(randomArray(random, 5000, -1000000000, 1000000000), 1200, 1200, -1000000000, 1000000000),
    (() => {
      // Insere e remove tudo, várias vezes: os nós do meio das listas precisam sair.
      const values = shuffle(random, Array.from({ length: 2500 }, (_, index) => index * 37 - 40000));
      const round = (): Command[] => [...inserts(values), ...shuffle(random, values).map((value): Command => ["remover", value])];
      return [...round(), ...inserts(values.slice(0, 1000)), ...shuffle(random, values).slice(0, 500).map((value): Command => ["buscar", value])];
    })(),
    mixed(randomArray(random, 9000, 0, 9999), 1500, 1500, 0, 9999)
  ];

  const bucketRule: SourceRule = {
    kind: "require",
    pattern: "\\*\\s*\\w+\\s*\\[|\\*\\*\\s*\\w+",
    message: "Use um vetor de listas: por exemplo, No *tabela[TAMANHO] (ou No **tabela alocado), com uma lista encadeada por posição."
  };

  return defineChallenge({
    slug: "tabela-hash-com-encadeamento",
    title: "Tabela hash com encadeamento",
    difficulty: "hard",
    moduleId: moduleId("hash"),
    position: 3,
    description: `
Implemente em C uma **tabela hash de inteiros com encadeamento separado**: um vetor de listas encadeadas, em que cada posição (balde) guarda os valores cujo hash cai nela. Cada nó é uma \`struct\` alocada com \`malloc\`.

O programa lê comandos, um por linha, até a linha \`fim\`:

| Comando | Efeito | Saída |
| --- | --- | --- |
| \`inserir x\` | insere x; se x já está na tabela, não faz nada | nenhuma |
| \`buscar x\` | procura x | \`encontrado\` ou \`ausente\` |
| \`remover x\` | remove x, se estiver lá | \`removido\` ou \`ausente\` |
| \`fim\` | encerra | \`total: N\`, com N = quantidade de valores guardados |

Cada saída ocupa uma linha. A tabela funciona como um **conjunto**: não guarda repetidos.

**Exemplo de entrada:**

${F}
inserir 10
inserir 20
inserir 10
buscar 20
remover 20
buscar 20
remover 99
fim
${F}

**Saída:**

${F}
encontrado
removido
ausente
ausente
total: 1
${F}

Atenção a dois detalhes: em C, \`-7 % 10\` vale \`-7\` (o índice do balde precisa ser corrigido para valores negativos), e remover um valor que está no **meio** de uma lista exige religar o nó anterior ao seguinte.
`.trim(),
    constraints: [
      "Até 16000 comandos por caso (a entrada tem no máximo 192 KB).",
      "-10^9 <= x <= 10^9",
      "Obrigatório: struct com ponteiro para o próximo nó, malloc para cada nó e um vetor de listas (os baldes).",
      "Escolha um tamanho de tabela razoável (um primo como 10007 funciona bem) para que as listas fiquem curtas."
    ],
    tags: ["Hash", "Listas encadeadas", "Ponteiros"],
    languages: [language("c", [rules.usesStruct, rules.usesMalloc, rules.selfReferencingNode, bucketRule])],
    publicCases: [
      render([["inserir", 10], ["inserir", 20], ["inserir", 10], ["buscar", 20], ["remover", 20], ["buscar", 20], ["remover", 99]]),
      render([["inserir", -5], ["inserir", 7], ["buscar", -5], ["buscar", 8], ["remover", -5], ["inserir", 8]])
    ],
    hiddenCases: hidden.map(render),
    hints: [
      "Declare o nó (typedef struct no { int valor; struct no *prox; } No;) e a tabela como No *tabela[M], com todas as posições começando em NULL.",
      "O balde de x é ((x % M) + M) % M: a soma de M corrige o resto negativo. Inserir é colocar um nó novo no início da lista do balde, depois de conferir que x ainda não está lá.",
      "Para remover, percorra a lista do balde guardando o nó anterior: se o alvo é o primeiro, atualize tabela[h]; senão, faça anterior->prox = alvo->prox. Depois, free no nó."
    ],
    editorial: `
**Ideia.** A função de hash espalha os valores entre M baldes; cada balde é uma lista encadeada curta. Buscar, inserir e remover percorrem só a lista de um balde, então custam O(1) em média.

1. \`No *tabela[M]\` começa com \`NULL\` em todas as posições.
2. \`h(x) = ((x % M) + M) % M\`, com M primo (10007).
3. **inserir:** se \`x\` não está na lista de \`h(x)\`, crie um nó com \`malloc\` e ponha no início.
4. **buscar:** percorra a lista de \`h(x)\`.
5. **remover:** percorra com um ponteiro para o anterior e religue a lista.

${F}c
#define M 10007
typedef struct no { int valor; struct no *prox; } No;
No *tabela[M];

int hash(int x) { return ((x % M) + M) % M; }

int remover(int x) {
    No **ligacao = &tabela[hash(x)];      /* ponteiro para o campo que aponta o nó */
    while (*ligacao && (*ligacao)->valor != x) ligacao = &(*ligacao)->prox;
    if (!*ligacao) return 0;
    No *alvo = *ligacao;
    *ligacao = alvo->prox;                /* serve para o primeiro nó e para o meio */
    free(alvo);
    return 1;
}
${F}

O ponteiro para ponteiro (\`No **\`) evita tratar à parte o primeiro nó da lista. Um erro comum é só conferir o primeiro nó do balde ao remover: funciona enquanto não há colisões e falha quando dois valores caem no mesmo balde.

**Custo:** O(1) em média por comando (listas com cerca de N/M nós); O(N) no pior caso, se tudo colidir. Memória O(M + N).
`.trim(),
    complexity: { time: "O(1) médio por comando", space: "O(M + N)" }
  });
}

function agruparAnagramas(): Challenge {
  const random = createRandom(500500);
  const group = (words: string[]) => {
    const groups = new Map<string, string[]>();
    for (const word of words) {
      const key = [...word].sort().join("");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(word);
    }
    return [...groups.values()].map((items) => items.join(" "));
  };
  const scramble = (word: string) => shuffle(random, [...word]).join("");
  const family = (bases: string[], count: number) =>
    Array.from({ length: count }, () => scramble(bases[randomInt(random, 0, bases.length - 1)]));
  const bases = (size: number, min: number, max: number, alphabet?: string) => {
    const keys = new Set<string>();
    const words: string[] = [];
    while (words.length < size) {
      const word = randomWord(random, min, max, alphabet);
      const key = [...word].sort().join("");
      if (!keys.has(key)) {
        keys.add(key);
        words.push(word);
      }
    }
    return words;
  };

  const hidden: string[][] = [
    [],
    ["a"],
    ["ab", "ba", "ab"],
    ["ad", "bc", "da", "cb"],
    ["aab", "abb", "bab", "aba"],
    ["abc", "def", "ghi"],
    ["ac", "bb", "ca", "bb"],
    ["listen", "silent", "enlist", "tinsel", "inlets", "google", "gogole"],
    ["z", "zz", "zzz", "z", "zz"],
    ["abcdefghijkl", "lkjihgfedcba", "abcdefghijkm"],
    family(bases(8, 2, 4, "abcd"), 60),
    family(bases(40, 3, 7), 400),
    family(bases(400, 3, 8), 4000),
    bases(3000, 4, 9),
    family(bases(3, 5, 5, "ab"), 500),
    family(bases(60, 1, 3, "abcdef"), 2000)
  ];

  return defineChallenge({
    slug: "agrupar-anagramas",
    title: "Agrupar anagramas",
    difficulty: "medium",
    moduleId: moduleId("hash"),
    position: 4,
    isBoss: true,
    description: `
Duas palavras são **anagramas** quando usam exatamente as mesmas letras, com as mesmas quantidades, em qualquer ordem: \`amor\`, \`roma\` e \`ramo\` são anagramas entre si; \`aab\` e \`abb\` não são.

Implemente a função \`agruparAnagramas(palavras)\`, que recebe um vetor de palavras e retorna um vetor de **grupos**. Cada grupo é um texto com as palavras de um mesmo conjunto de anagramas separadas por **um espaço**, na ordem em que aparecem na entrada.

- Os grupos podem vir **em qualquer ordem** no vetor retornado.
- Palavras repetidas aparecem repetidas dentro do grupo.
- Um vetor vazio produz um resultado vazio.

**Exemplo:** para \`["amor", "roma", "ramo", "sol", "los", "mora", "asa"]\`, um retorno correto é \`["amor roma ramo mora", "sol los", "asa"]\` (ou os mesmos três textos em outra ordem).
`.trim(),
    constraints: [
      "0 <= palavras.length <= 5000",
      "Cada palavra tem de 1 a 12 letras minúsculas de a a z.",
      "Dentro de cada grupo, mantenha a ordem de entrada; a ordem dos grupos é livre.",
      "Em C, retorne um vetor de strings alocado com malloc e preencha *returnSize."
    ],
    tags: ["Hash", "Strings", "Ordenação"],
    functionSpec: { name: "agruparAnagramas", params: [{ name: "palavras", type: "string[]" }], returns: "string[]" },
    checker: { kind: "unordered-lines" },
    publicCases: [
      call([["amor", "roma", "ramo", "sol", "los", "mora", "asa"]], group(["amor", "roma", "ramo", "sol", "los", "mora", "asa"])),
      call([["pato", "topa", "gato", "toga", "a"]], group(["pato", "topa", "gato", "toga", "a"]))
    ],
    hiddenCases: hidden.map((words) => call([words], group(words))),
    hints: [
      "Anagramas precisam cair na mesma chave de uma tabela hash. Que representação de uma palavra é igual para todos os seus anagramas e diferente para o resto?",
      "Somar os códigos das letras não serve: \"ad\" e \"bc\" têm a mesma soma. Um conjunto de letras também não: \"aab\" e \"abb\" têm as mesmas letras.",
      "Use como chave a palavra com as letras ordenadas (\"roma\" vira \"amor\") ou a contagem das 26 letras. Mapeie chave → lista de palavras e, no fim, junte cada lista com espaços."
    ],
    editorial: `
**Ideia.** A assinatura de uma palavra é a sequência das suas letras em ordem alfabética: todos os anagramas têm a mesma assinatura, e palavras diferentes em alguma contagem de letra têm assinaturas diferentes. Uma tabela hash \`assinatura → palavras\` faz o agrupamento em uma passada.

1. Para cada palavra, calcule a assinatura (ordene as letras; com só 26 letras possíveis, uma contagem por letra também serve).
2. Acrescente a palavra à lista da sua assinatura (criando a lista na primeira vez).
3. Retorne cada lista unida por espaços.

${F}js
function agruparAnagramas(palavras) {
  const grupos = new Map();
  for (const palavra of palavras) {
    const chave = [...palavra].sort().join("");
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(palavra);
  }
  return [...grupos.values()].map((grupo) => grupo.join(" "));
}
${F}

Em C, uma alternativa sem tabela hash é ordenar os índices das palavras pela assinatura (com desempate pelo índice, para manter a ordem de entrada) e juntar as sequências de assinaturas iguais.

**Custo:** O(n · L log L), com L o tamanho máximo das palavras (ordenar as letras de cada uma); O(n · L) de memória.
`.trim(),
    complexity: { time: "O(n · L log L)", space: "O(n · L)" }
  });
}

// =====================================================================
// Módulo: Árvores
// =====================================================================

const TREE_NOTE =
  "A árvore chega como um nó `TreeNode` com os campos `val`, `left` e `right` (em C, `struct TreeNode*`, já definida pelo juiz); uma árvore vazia chega como `null` (`None` em Python, `NULL` em C). Nos exemplos, a árvore aparece em **ordem de níveis**, com `null` no lugar dos filhos ausentes: `[1, 2, 3, null, 4]` é a raiz 1, com filhos 2 e 3, e 4 como filho direito de 2.";

const distinctValues = (random: () => number, count: number, min: number, max: number) => {
  const seen = new Set<number>();
  const values: number[] = [];
  while (values.length < count) {
    const value = randomInt(random, min, max);
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
  }
  return values;
};

const range = (count: number, start = 1) => Array.from({ length: count }, (_, index) => start + index);

function percursosDaArvore(): Challenge {
  const random = createRandom(501000);
  const values = (count: number) => randomArray(random, count, -1000, 1000);
  const trees: Array<TNode | null> = [
    null,
    node(5),
    chainTree([1, 2, 3, 4, 5], "left"),
    chainTree([1, 2, 3, 4, 5], "right"),
    chainTree(values(9), "zigzag"),
    completeTree(range(15)),
    completeTree([8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15]),
    fromLevelOrder([1, 2, 3, null, 4, 5, null, null, null, 6]),
    fromLevelOrder([0, 0, 0, 0, null, null, 0]),
    fromLevelOrder([-1, -2, -3, -4, -5, -6, -7]),
    randomTree(random, values(12)),
    randomTree(random, values(50)),
    randomTree(random, values(300)),
    randomTree(random, values(1000)),
    randomTree(random, values(2000)),
    chainTree(values(2000), "left"),
    chainTree(values(2000), "right"),
    completeTree(values(2000))
  ];
  const example = (levels: Array<number | null>) => call([levels], traversals(fromLevelOrder(levels)));

  return defineChallenge({
    slug: "percursos-da-arvore",
    title: "Percursos da árvore",
    difficulty: "easy",
    moduleId: moduleId("arvores"),
    position: 0,
    description: `
Implemente a função \`percursos(raiz)\`, que recebe a raiz de uma árvore binária e retorna um vetor com **três vetores**, nesta ordem:

1. **pré-ordem:** visita o nó, depois a subárvore esquerda, depois a direita;
2. **em-ordem:** subárvore esquerda, o nó, subárvore direita;
3. **pós-ordem:** subárvore esquerda, subárvore direita e, por último, o nó.

Para a árvore vazia, retorne \`[[], [], []]\`.

${TREE_NOTE}

**Exemplo:** a árvore \`[1, 2, 3]\` (raiz 1, filhos 2 e 3) tem pré-ordem \`[1, 2, 3]\`, em-ordem \`[2, 1, 3]\` e pós-ordem \`[2, 3, 1]\`; o retorno é \`[[1, 2, 3], [2, 1, 3], [2, 3, 1]]\`.
`.trim(),
    constraints: [
      "0 <= número de nós <= 2000",
      "-1000 <= val <= 1000 (valores podem se repetir)",
      "A árvore pode ser degenerada (uma lista com 2000 nós); recursão funciona nas três linguagens com essa profundidade.",
      "Em C, retorne um int** com 3 linhas, preencha *returnSize = 3 e *returnColumnSizes com o tamanho de cada linha."
    ],
    tags: ["Árvores", "Recursão"],
    functionSpec: { name: "percursos", params: [{ name: "raiz", type: "tree" }], returns: "int[][]" },
    publicCases: [example([1, 2, 3]), example([7, null, 9, 8])],
    hiddenCases: trees.map((root) => call([toLevelOrder(root)], traversals(root))),
    hints: [
      "Os três percursos têm a mesma estrutura recursiva; só muda o momento em que o valor do nó é anotado.",
      "Escreva uma função auxiliar visitar(no) que, se no não for nulo, anota o valor antes (pré), entre (em) e depois (pós) das chamadas para os dois filhos, cada um no seu vetor. Uma fila no lugar da recursão produz a ordem por níveis, que é outra coisa."
    ],
    editorial: `
**Ideia.** Uma única função recursiva preenche os três vetores de uma vez: ao entrar no nó anota a pré-ordem, entre os dois filhos anota a em-ordem e ao sair anota a pós-ordem.

${F}js
function percursos(raiz) {
  const pre = [], em = [], pos = [];
  function visitar(no) {
    if (!no) return;
    pre.push(no.val);
    visitar(no.left);
    em.push(no.val);
    visitar(no.right);
    pos.push(no.val);
  }
  visitar(raiz);
  return [pre, em, pos];
}
${F}

Em C, aloque as três linhas com \`n\` posições (conte os nós antes ou use 2000, o máximo) e avance um índice por percurso.

**Armadilha.** Percorrer com uma fila dá a **ordem por níveis** (\`[1, 2, 3, 4, ...]\` numa árvore completa), que só coincide com a pré-ordem em árvores muito pequenas ou em listas.

**Custo:** O(n) de tempo; O(h) de pilha de recursão, com h a altura da árvore.
`.trim(),
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

function alturaDaArvore(): Challenge {
  const random = createRandom(501100);
  const values = (count: number) => randomArray(random, count, -10000, 10000);
  const trees: Array<TNode | null> = [
    null,
    node(42),
    fromLevelOrder([1, 2]),
    fromLevelOrder([1, null, 2]),
    fromLevelOrder([1, 2, 3, null, null, 4, null, null, 5]),
    completeTree(range(7)),
    completeTree(range(8)),
    chainTree(values(10), "zigzag"),
    randomTree(random, values(20)),
    randomTree(random, values(200)),
    randomTree(random, values(5000)),
    completeTree(values(4095)),
    chainTree(values(5000), "left"),
    chainTree(values(5000), "right"),
    chainTree(values(5000), "zigzag"),
    (() => {
      // Raiz com uma subárvore esquerda rasa e uma lista longa à direita.
      const root = node(0);
      root.left = completeTree(values(31));
      root.right = chainTree(values(3000), "right");
      return root;
    })()
  ];

  return defineChallenge({
    slug: "altura-da-arvore",
    title: "Altura da árvore",
    difficulty: "easy",
    moduleId: moduleId("arvores"),
    position: 1,
    description: `
Implemente a função \`altura(raiz)\`, que retorna a **altura** de uma árvore binária: a quantidade de nós no caminho mais longo da raiz até uma folha.

- A árvore vazia tem altura \`0\`.
- Uma árvore com um só nó tem altura \`1\`.

${TREE_NOTE}

**Exemplos:** \`[5, 3, 8, 1, 4]\` tem altura \`3\` (o caminho 5 → 3 → 1, por exemplo); \`[10]\` tem altura \`1\`.

A árvore pode ser **degenerada**: uma lista com até 5000 nós, todos de um lado só ou alternando os lados.
`.trim(),
    constraints: [
      "0 <= número de nós <= 5000",
      "-10^4 <= val <= 10^4",
      "Recursão com profundidade 5000 funciona nas três linguagens do juiz (JavaScript aguenta cerca de 7 mil chamadas simples; Python está com limite de 20000; em C a pilha é de 64 MB)."
    ],
    tags: ["Árvores", "Recursão"],
    functionSpec: { name: "altura", params: [{ name: "raiz", type: "tree" }], returns: "int" },
    publicCases: [call([[5, 3, 8, 1, 4]], 3), call([[10]], 1)],
    hiddenCases: trees.map((root) => call([toLevelOrder(root)], treeHeight(root))),
    hints: [
      "A altura de uma árvore se escreve em termos da altura das subárvores.",
      "altura(nulo) = 0 e altura(no) = 1 + maior(altura(no.left), altura(no.right)). Não basta descer por um lado só: o caminho mais longo pode estar em qualquer lugar."
    ],
    editorial: `
**Ideia.** A altura de um nó é 1 (ele mesmo) mais a maior altura entre os filhos; a árvore vazia tem altura 0. É a recursão mais direta sobre árvores.

${F}python
def altura(raiz):
    if raiz is None:
        return 0
    return 1 + max(altura(raiz.left), altura(raiz.right))
${F}

**Profundidade da recursão.** Numa árvore degenerada com n nós, a recursão desce n níveis. No juiz, isso funciona com folga até 5000 nós: o JavaScript estoura por volta de 7 a 8 mil chamadas, o Python aceita até 20000 (o juiz ajusta \`sys.setrecursionlimit\`) e o C tem 64 MB de pilha. Para árvores ainda maiores, a alternativa é iterativa: percorra por níveis com uma fila e conte quantos níveis existem.

**Custo:** O(n) de tempo; O(h) de pilha, com h a altura.
`.trim(),
    complexity: { time: "O(n)", space: "O(h)" }
  });
}

function inserirNaBst(): Challenge {
  const random = createRandom(501200);
  const lists: number[][] = [
    [],
    [5],
    [5, 5, 5],
    [2, 1, 3],
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1],
    [4, 2, 6, 1, 3, 5, 7, 4, 2, 6],
    [0, -1, 1, -1, 0, 1],
    [-10000, 10000, 0, -10000, 10000],
    randomArray(random, 20, -10, 10),
    randomArray(random, 200, -1000, 1000),
    randomArray(random, 3000, -10000, 10000),
    range(2000),
    range(2000).map((value) => -value),
    range(1000).flatMap((value) => [value, 2001 - value]),
    randomArray(random, 3000, 0, 50),
    (() => {
      // Ordem de inserção que produz uma árvore equilibrada.
      const order: number[] = [];
      const visit = (low: number, high: number) => {
        if (low > high) return;
        const middle = (low + high) >> 1;
        order.push(middle);
        visit(low, middle - 1);
        visit(middle + 1, high);
      };
      visit(1, 2047);
      return order;
    })()
  ];
  const example = (values: number[]) => call([values], toLevelOrder(buildBst(values)));

  return defineChallenge({
    slug: "inserir-na-bst",
    title: "Inserir na árvore de busca",
    difficulty: "medium",
    moduleId: moduleId("arvores"),
    position: 2,
    description: `
Numa **árvore binária de busca** (BST), todo valor da subárvore esquerda de um nó é **menor** que o valor do nó, e todo valor da subárvore direita é **maior**.

Implemente a função \`construirBST(valores)\`, que começa com uma árvore vazia, insere os valores **na ordem em que aparecem** no vetor e retorna a raiz da árvore resultante. Cada inserção desce a partir da raiz: vai para a esquerda se o valor é menor que o do nó atual, para a direita se é maior, e cria um nó novo na primeira vaga encontrada. **Valores repetidos são ignorados** (a árvore não guarda duplicatas).

A árvore retornada é comparada em ordem de níveis, com \`null\` nos filhos ausentes (em C, retorne \`struct TreeNode*\` com nós alocados por \`malloc\`, e filhos ausentes iguais a \`NULL\`). Para um vetor vazio, retorne a árvore vazia.

**Exemplo:** inserindo \`[5, 3, 8, 1, 4]\`, o 3 vai à esquerda de 5, o 8 à direita, o 1 à esquerda de 3 e o 4 à direita de 3: o retorno é \`[5, 3, 8, 1, 4]\`. Inserindo \`[2, 7, 2]\`, o segundo 2 é ignorado e o retorno é \`[2, null, 7]\`.
`.trim(),
    constraints: [
      "0 <= valores.length <= 3000",
      "-10^4 <= valores[i] <= 10^4",
      "Valores já ordenados produzem uma árvore degenerada (nos testes, com até 2000 níveis)."
    ],
    tags: ["Árvores", "BST"],
    functionSpec: { name: "construirBST", params: [{ name: "valores", type: "int[]" }], returns: "tree" },
    publicCases: [example([5, 3, 8, 1, 4]), example([40, 20, 60, 50, 70, 10])],
    hiddenCases: lists.map(example),
    hints: [
      "Cada inserção é uma descida a partir da raiz, decidindo entre esquerda e direita pela comparação com o valor do nó.",
      "Trate os três casos: menor (esquerda), maior (direita) e igual (não faça nada). Esquecer o caso igual coloca duplicatas na árvore."
    ],
    editorial: `
**Ideia.** Insira um valor de cada vez. A partir da raiz, compare: se o valor é menor, desça para a esquerda; se é maior, para a direita; se é igual, pare sem inserir. Quando o filho escolhido não existe, crie o nó ali.

${F}c
struct TreeNode* novoNo(int valor) {
    struct TreeNode* no = calloc(1, sizeof(struct TreeNode)); /* filhos NULL */
    no->val = valor;
    return no;
}

struct TreeNode* construirBST(int* valores, int valoresSize) {
    struct TreeNode* raiz = NULL;
    for (int i = 0; i < valoresSize; i++) {
        struct TreeNode** vaga = &raiz;
        while (*vaga && (*vaga)->val != valores[i])
            vaga = valores[i] < (*vaga)->val ? &(*vaga)->left : &(*vaga)->right;
        if (!*vaga) *vaga = novoNo(valores[i]);
    }
    return raiz;
}
${F}

O ponteiro para ponteiro (\`struct TreeNode**\`) aponta para o campo onde o novo nó será pendurado, então a raiz não precisa de tratamento especial.

**Custo:** O(h) por inserção, com h a altura atual. Em ordem aleatória h fica perto de log n; com valores já ordenados a árvore vira uma lista e o total chega a O(n²) (com 2000 valores, cerca de 2 milhões de passos: rápido, mas prefira a descida iterativa, que não gasta pilha).
`.trim(),
    complexity: { time: "O(n · h)", space: "O(n)" }
  });
}

/** Árvore perfeita de altura h, com valores sequenciais a partir de next.value. */
function perfectTree(height: number, next: { value: number }): TNode | null {
  if (height === 0) return null;
  const root = node(next.value++);
  root.left = perfectTree(height - 1, next);
  root.right = perfectTree(height - 1, next);
  return root;
}

/** Árvore de Fibonacci: a AVL com menos nós para a altura h (diferença exatamente 1 em cada nó interno). */
function fibonacciTree(height: number, next: { value: number }): TNode | null {
  if (height <= 0) return null;
  const root = node(next.value++);
  root.left = fibonacciTree(height - 1, next);
  root.right = fibonacciTree(height - 2, next);
  return root;
}

function arvoreBalanceada(): Challenge {
  const random = createRandom(501300);
  const join = (left: TNode | null, right: TNode | null) => {
    const root = node(0);
    root.left = left;
    root.right = right;
    return root;
  };
  const counter = () => ({ value: 1 });
  const trees: Array<TNode | null> = [
    null,
    node(1),
    fromLevelOrder([1, 2]),
    fromLevelOrder([1, null, 2, null, 3]),
    fromLevelOrder([1, 2, 2, 3, null, null, 3, 4, null, null, 4]),
    fromLevelOrder([1, 2, 3, 4, 5, null, 6, 7, null, null, null, null, 8]),
    completeTree(range(6)),
    perfectTree(10, counter()),
    fibonacciTree(15, counter()),
    // As duas subárvores da raiz têm a mesma altura, mas a esquerda é desequilibrada por dentro.
    join(join(perfectTree(8, counter()), perfectTree(6, counter())), perfectTree(9, counter())),
    join(fibonacciTree(12, counter()), join(fibonacciTree(10, counter()), fibonacciTree(8, counter()))),
    join(perfectTree(7, counter()), fibonacciTree(8, counter())),
    balancedFromSorted(range(4000)),
    completeTree(randomArray(random, 3000, -100, 100)),
    randomTree(random, randomArray(random, 3000, -100, 100)),
    randomTree(random, randomArray(random, 7, 0, 9)),
    chainTree(range(5000), "left"),
    join(chainTree(range(2500), "left"), chainTree(range(2499), "right"))
  ];

  return defineChallenge({
    slug: "arvore-balanceada",
    title: "Árvore balanceada",
    difficulty: "medium",
    moduleId: moduleId("arvores"),
    position: 3,
    description: `
Uma árvore binária é **balanceada** (no sentido das árvores AVL) quando, em **todo** nó, as alturas da subárvore esquerda e da subárvore direita diferem em no máximo 1. A altura da árvore vazia é 0.

Implemente a função \`estaBalanceada(raiz)\`, que retorna \`true\` se a árvore é balanceada e \`false\` caso contrário. A árvore vazia é balanceada.

${TREE_NOTE}

**Exemplos:**

- \`[3, 1, 7, null, 2, 5, 9]\`: em todos os nós a diferença é no máximo 1. Retorno: \`true\`.
- \`[1, 2, null, 3]\`: na raiz, a esquerda tem altura 2 e a direita 0. Retorno: \`false\`.

Atenção: não basta olhar a raiz. As duas subárvores da raiz podem ter a mesma altura e, mesmo assim, um nó lá embaixo estar desequilibrado.
`.trim(),
    constraints: [
      "0 <= número de nós <= 5000",
      "-10^4 <= val <= 10^4",
      "A árvore pode ser degenerada, com até 5000 níveis."
    ],
    tags: ["Árvores", "Recursão", "AVL"],
    functionSpec: { name: "estaBalanceada", params: [{ name: "raiz", type: "tree" }], returns: "bool" },
    publicCases: [call([[3, 1, 7, null, 2, 5, 9]], true), call([[1, 2, null, 3]], false)],
    hiddenCases: trees.map((root) => call([toLevelOrder(root)], isBalanced(root))),
    hints: [
      "A condição vale para todos os nós, não só para a raiz. Para cada nó você precisa das alturas das duas subárvores.",
      "Calcular a altura de novo em cada nó funciona, mas repete trabalho. Faça uma única função recursiva que devolva a altura da subárvore ou -1 quando encontrar um desequilíbrio, e propague o -1 para cima."
    ],
    editorial: `
**Ideia.** Percorra em pós-ordem: primeiro resolva os filhos, depois o nó. Cada chamada devolve a altura da subárvore, ou -1 se ela já está desequilibrada. Assim cada nó é visitado uma vez.

${F}js
function estaBalanceada(raiz) {
  function alturaOuFalha(no) {
    if (!no) return 0;
    const esquerda = alturaOuFalha(no.left);
    if (esquerda < 0) return -1;
    const direita = alturaOuFalha(no.right);
    if (direita < 0) return -1;
    if (Math.abs(esquerda - direita) > 1) return -1;
    return 1 + Math.max(esquerda, direita);
  }
  return alturaOuFalha(raiz) >= 0;
}
${F}

**Armadilha.** Comparar só as alturas dos filhos da raiz aceita árvores como \`[1, 2, 2, 3, null, null, 3, 4, null, null, 4]\`: a raiz está equilibrada (3 e 3), mas o nó 2 da esquerda tem subárvores de alturas 2 e 0.

**Custo:** O(n) de tempo e O(h) de pilha. A versão que chama uma função de altura separada em cada nó custa O(n log n) em árvores equilibradas e O(n²) nas degeneradas.
`.trim(),
    complexity: { time: "O(n)", space: "O(h)" }
  });
}

function somaDeCaminho(): Challenge {
  const random = createRandom(501400);
  const has = (root: TNode | null, target: number) => leafSums(root).includes(target);
  const cases: Array<[TNode | null, number]> = [
    [null, 0],
    [fromLevelOrder([1, 2]), 1],
    [fromLevelOrder([1, 2]), 3],
    [node(-3), -3],
    [fromLevelOrder([5, 10, null, -6]), 9],
    [fromLevelOrder([1, -2, -3, 1, 3, -2, null, -1]), -1],
    [fromLevelOrder([0, 0, 0]), 0],
    [fromLevelOrder([1, 2, 3]), 5],
    [fromLevelOrder([-1, -2, -3, 4, null, null, -4]), 1],
    [fromLevelOrder([10, 20, 30, -25, null, null, -35]), 5]
  ];
  const withTarget = (root: TNode | null, present: boolean): [TNode | null, number] => {
    const sums = leafSums(root);
    if (present) return [root, sums[randomInt(random, 0, sums.length - 1)]];
    const set = new Set(sums);
    let target = sums[randomInt(random, 0, sums.length - 1)] + 1;
    while (set.has(target)) target += 1;
    return [root, target];
  };
  for (const [size, present] of [[30, true], [30, false], [500, true], [500, false], [5000, true], [5000, false]] as const) {
    cases.push(withTarget(randomTree(random, randomArray(random, size, -1000, 1000)), present));
  }
  const longChain = chainTree(randomArray(random, 5000, -1000, 1000), "zigzag");
  cases.push(withTarget(longChain, true), withTarget(longChain, false));
  cases.push(withTarget(completeTree(randomArray(random, 4095, -1000, 1000)), true));

  return defineChallenge({
    slug: "soma-de-caminho",
    title: "Soma de caminho",
    difficulty: "medium",
    moduleId: moduleId("arvores"),
    position: 4,
    description: `
Implemente a função \`temCaminhoComSoma(raiz, alvo)\`, que retorna \`true\` se existe algum caminho **da raiz até uma folha** cuja soma dos valores é exatamente \`alvo\`, e \`false\` caso contrário.

- Uma **folha** é um nó sem nenhum filho. Um nó com um filho só não é folha, mesmo que falte o outro.
- A árvore vazia não tem caminhos: retorne \`false\` (inclusive com \`alvo = 0\`).
- Os valores podem ser **negativos**, então uma soma parcial maior que o alvo ainda pode diminuir mais adiante.

${TREE_NOTE}

**Exemplos:**

- \`[6, 3, 9, 1, 4, null, 2]\` com \`alvo = 13\`: o caminho 6 → 3 → 4 soma 13. Retorno: \`true\`.
- \`[2, 7, 5, null, null, 8, 1]\` com \`alvo = 20\`: as somas raiz-folha são 9, 15 e 8. Retorno: \`false\`.
`.trim(),
    constraints: [
      "0 <= número de nós <= 5000",
      "-1000 <= val <= 1000",
      "-5 · 10^6 <= alvo <= 5 · 10^6",
      "A árvore pode ser degenerada, com até 5000 níveis."
    ],
    tags: ["Árvores", "Recursão", "DFS"],
    functionSpec: {
      name: "temCaminhoComSoma",
      params: [{ name: "raiz", type: "tree" }, { name: "alvo", type: "int" }],
      returns: "bool"
    },
    publicCases: [call([[6, 3, 9, 1, 4, null, 2], 13], true), call([[2, 7, 5, null, null, 8, 1], 20], false)],
    hiddenCases: cases.map(([root, target]) => call([toLevelOrder(root), target], has(root, target))),
    hints: [
      "Em vez de carregar a soma acumulada, carregue quanto ainda falta: ao descer para um filho, o alvo diminui do valor do nó.",
      "O teste de sucesso só pode acontecer numa folha (sem filho esquerdo e sem direito). Não corte a busca quando a soma passa do alvo: com valores negativos ela ainda pode voltar."
    ],
    editorial: `
**Ideia.** Desça pela árvore subtraindo o valor de cada nó do alvo. Ao chegar numa folha, o caminho serve se o que sobrou é exatamente o valor da folha.

${F}python
def temCaminhoComSoma(raiz, alvo):
    if raiz is None:
        return False
    if raiz.left is None and raiz.right is None:
        return raiz.val == alvo
    resto = alvo - raiz.val
    return temCaminhoComSoma(raiz.left, resto) or temCaminhoComSoma(raiz.right, resto)
${F}

**Armadilhas.**

- Testar a soma num filho nulo em vez de numa folha: em \`[1, 2]\` com alvo 1, o filho direito nulo da raiz faria o código responder \`true\`, mas 1 não é folha.
- Podar quando a soma parcial passa do alvo: só vale com valores não negativos. Em \`[5, 10, null, -6]\` com alvo 9, a soma passa por 15 e volta a 9.

**Custo:** O(n) de tempo; O(h) de pilha.
`.trim(),
    complexity: { time: "O(n)", space: "O(h)" }
  });
}

function reconstruirArvore(): Challenge {
  const random = createRandom(501500);
  const distinct = (count: number) => distinctValues(random, count, -100000, 100000);
  const trees: Array<TNode | null> = [
    null,
    node(7),
    fromLevelOrder([1, 2, 3]),
    fromLevelOrder([1, 2]),
    fromLevelOrder([1, null, 2]),
    fromLevelOrder([10, 5, 3, null, 8, 1, null, 2]),
    fromLevelOrder([-1, -2, -3, -4, -5, -6, -7, -8]),
    completeTree(distinct(15)),
    chainTree(distinct(12), "zigzag"),
    randomTree(random, distinct(40)),
    randomTree(random, distinct(400)),
    randomTree(random, distinct(3000)),
    completeTree(distinct(2047)),
    chainTree(distinct(3000), "left"),
    chainTree(distinct(3000), "right"),
    chainTree(distinct(3000), "zigzag"),
    buildBst(distinct(1000))
  ];
  const example = (root: TNode | null) => {
    const [pre, inorder] = traversals(root);
    return call([pre, inorder], toLevelOrder(root));
  };

  return defineChallenge({
    slug: "reconstruir-arvore",
    title: "Reconstruir a árvore",
    difficulty: "hard",
    moduleId: moduleId("arvores"),
    position: 5,
    isBoss: true,
    description: `
Uma árvore binária com valores **distintos** fica determinada pelos seus percursos em **pré-ordem** (nó, esquerda, direita) e **em-ordem** (esquerda, nó, direita).

Implemente a função \`reconstruirArvore(preordem, emordem)\`, que recebe os dois percursos de uma mesma árvore e retorna a raiz da árvore original. A árvore não é necessariamente uma árvore de busca: os valores podem estar em qualquer posição.

A árvore retornada é comparada em ordem de níveis, com \`null\` nos filhos ausentes (em C, retorne \`struct TreeNode*\` com nós alocados por \`malloc\` e filhos ausentes iguais a \`NULL\`). Para vetores vazios, retorne a árvore vazia.

**Exemplo:** \`preordem = [8, 3, 1, 6, 10, 14]\` e \`emordem = [1, 3, 6, 8, 10, 14]\`. A raiz é 8 (primeiro da pré-ordem); na em-ordem, \`[1, 3, 6]\` fica à esquerda de 8 e \`[10, 14]\` à direita. Repetindo o raciocínio em cada lado, o retorno é \`[8, 3, 10, 1, 6, null, 14]\`.
`.trim(),
    constraints: [
      "0 <= n <= 3000, com preordem.length == emordem.length == n",
      "-10^5 <= valores <= 10^5, todos distintos",
      "Os dois vetores são percursos válidos da mesma árvore, que pode ser degenerada (até 3000 níveis)."
    ],
    tags: ["Árvores", "Recursão", "Hash"],
    functionSpec: {
      name: "reconstruirArvore",
      params: [{ name: "preordem", type: "int[]" }, { name: "emordem", type: "int[]" }],
      returns: "tree"
    },
    publicCases: [example(fromLevelOrder([8, 3, 10, 1, 6, null, 14])), example(fromLevelOrder([4, 2, 6, 1, 3]))],
    hiddenCases: trees.map(example),
    hints: [
      "O primeiro valor da pré-ordem é sempre a raiz. Onde ele aparece na em-ordem?",
      "Na em-ordem, tudo à esquerda da raiz forma a subárvore esquerda, e tudo à direita forma a direita. O tamanho do lado esquerdo diz quantos elementos da pré-ordem, logo depois da raiz, pertencem à subárvore esquerda.",
      "Para não procurar a raiz na em-ordem a cada chamada, guarde antes em uma tabela hash a posição de cada valor na em-ordem. Consuma a pré-ordem com um índice global que avança a cada nó criado."
    ],
    editorial: `
**Ideia.** A pré-ordem lista as raízes na ordem em que a recursão as cria: raiz, depois toda a subárvore esquerda, depois toda a direita. A em-ordem diz, para cada raiz, quais valores ficam de cada lado.

1. Monte um mapa \`valor → posição na em-ordem\`.
2. \`construir(ini, fim)\` reconstrói a subárvore cujos valores ocupam \`emordem[ini..fim]\`:
   - se \`ini > fim\`, retorne vazio;
   - a raiz é o próximo valor da pré-ordem (avance o índice);
   - com \`m\` = posição da raiz na em-ordem, construa a esquerda com \`(ini, m - 1)\` e **depois** a direita com \`(m + 1, fim)\`.

${F}js
function reconstruirArvore(preordem, emordem) {
  const posicao = new Map(emordem.map((valor, i) => [valor, i]));
  let proximo = 0;
  function construir(ini, fim) {
    if (ini > fim) return null;
    const raiz = new TreeNode(preordem[proximo++]);
    const m = posicao.get(raiz.val);
    raiz.left = construir(ini, m - 1);
    raiz.right = construir(m + 1, fim);
    return raiz;
  }
  return construir(0, emordem.length - 1);
}
${F}

A ordem das chamadas importa: a esquerda precisa ser construída antes da direita, porque é assim que os valores aparecem na pré-ordem.

**Armadilha.** Inserir a pré-ordem numa árvore de busca reproduz a árvore só quando ela já era uma BST (quando a em-ordem está ordenada); em qualquer outra árvore o resultado é diferente.

**Custo:** O(n) de tempo com o mapa (O(n²) procurando a raiz linearmente) e O(n) de memória.
`.trim(),
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

// =====================================================================
// Módulo: Heaps e fila de prioridade
// =====================================================================

/** Transforma o vetor em heap máximo (descendo cada pai, de trás para frente). */
function maxHeapify(values: number[]): number[] {
  const heap = [...values];
  const siftDown = (start: number) => {
    let index = start;
    for (;;) {
      const left = 2 * index + 1;
      const right = left + 1;
      let largest = index;
      if (left < heap.length && heap[left] > heap[largest]) largest = left;
      if (right < heap.length && heap[right] > heap[largest]) largest = right;
      if (largest === index) return;
      [heap[index], heap[largest]] = [heap[largest], heap[index]];
      index = largest;
    }
  };
  for (let index = (heap.length >> 1) - 1; index >= 0; index -= 1) siftDown(index);
  return heap;
}

function isMaxHeap(values: number[]): boolean {
  for (let index = 1; index < values.length; index += 1) if (values[(index - 1) >> 1] < values[index]) return false;
  return true;
}

/** Ordenação numérica rápida para a referência (vetor tipado). */
const sortedNumbers = (values: number[]) => Array.from(Float64Array.from(values).sort());

function validarHeap(): Challenge {
  const random = createRandom(502000);
  const literal: number[][] = [
    [],
    [1],
    [9, 5, 10],
    [3, 3, 3],
    [1, 2],
    [2, 1],
    [10, 9, 8, 7, 6, 5, 4],
    [10, 9, 8, 7, 6, 5, 11],
    [-1, -1, -2, -5, -1],
    [1000000000, -1000000000, 999999999],
    maxHeapify(randomArray(random, 50, -100, 100)),
    randomArray(random, 50, -100, 100),
    maxHeapify(randomArray(random, 1000, 0, 5)),
    maxHeapify(randomArray(random, 10000, -1000000, 1000000)),
    (() => {
      const heap = maxHeapify(randomArray(random, 10000, -1000000, 1000000));
      heap[9998] = 2000000; // filho direito lá no fundo, maior que o pai
      return heap;
    })()
  ];
  // Vetores decrescentes (sempre heaps) com 200 mil posições, montados pelo juiz.
  const descending = (n: number, start: number) => ({ $gen: "range" as const, n, start, step: -1 });
  // Posição 100002 é o filho direito da 50000; 100001, o esquerdo. O valor 10^9
  // plantado ali é maior que o pai (cerca de 950000): nesses dois casos não é heap.
  const big: Array<[unknown, boolean]> = [
    [descending(200000, 1000000), true],
    [{ $gen: "concat", parts: [descending(100002, 1000000), [1000000000], descending(99997, 1000000 - 100003)] }, false],
    [{ $gen: "concat", parts: [descending(100001, 1000000), [1000000000], descending(99998, 1000000 - 100002)] }, false]
  ];

  return defineChallenge({
    slug: "validar-heap",
    title: "Validar heap máximo",
    difficulty: "easy",
    moduleId: moduleId("heaps"),
    position: 0,
    description: `
Um **heap máximo** guardado em vetor é uma árvore binária completa em que cada pai é **maior ou igual** aos seus filhos. No vetor, os filhos da posição \`i\` ficam nas posições \`2i + 1\` (esquerdo) e \`2i + 2\` (direito), quando existem.

Implemente a função \`ehHeapMaximo(v)\`, que retorna \`true\` se o vetor \`v\` é um heap máximo e \`false\` caso contrário.

- Valores iguais são permitidos (pai igual ao filho está certo).
- O vetor vazio e o vetor com um elemento são heaps.

**Exemplos:**

- \`[9, 5, 8, 1, 3]\`: 9 ≥ 5 e 9 ≥ 8; 5 ≥ 1 e 5 ≥ 3. Retorno: \`true\`.
- \`[5, 9, 3]\`: o filho esquerdo 9 é maior que o pai 5. Retorno: \`false\`.
`.trim(),
    constraints: [
      "0 <= v.length <= 2 · 10^5",
      "-10^9 <= v[i] <= 10^9",
      "Confira os dois filhos de cada pai."
    ],
    tags: ["Heap", "Vetores"],
    functionSpec: { name: "ehHeapMaximo", params: [{ name: "v", type: "int[]" }], returns: "bool" },
    publicCases: [call([[9, 5, 8, 1, 3]], true), call([[5, 9, 3]], false)],
    hiddenCases: [
      ...literal.map((values) => call([values], isMaxHeap(values))),
      ...big.map(([values, expected]) => call([values], expected))
    ],
    hints: [
      "Em vez de olhar de cada pai para os filhos, olhe de cada filho para o pai: o pai da posição i (i > 0) é (i − 1) / 2, com divisão inteira.",
      "Basta um laço de i = 1 até o fim: se algum v[i] for maior que o seu pai, não é heap. Esquecer o filho direito (posição 2i + 2) é o erro mais comum."
    ],
    editorial: `
**Ideia.** A propriedade de heap é local: vale se cada elemento, menos a raiz, é menor ou igual ao seu pai. Percorrendo os filhos, cada comparação é feita uma única vez e nenhum filho fica de fora.

${F}c
bool ehHeapMaximo(int* v, int vSize) {
    for (int i = 1; i < vSize; i++)
        if (v[(i - 1) / 2] < v[i]) return false;
    return true;
}
${F}

Olhando dos pais para os filhos, o laço vai até \`n / 2 - 1\` e precisa conferir \`2i + 1\` e \`2i + 2\`, testando se cada índice existe.

**Custo:** O(n) de tempo e O(1) de memória.
`.trim(),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function heapsort(): Challenge {
  const random = createRandom(502100);
  const lists: number[][] = [
    [],
    [1],
    [2, 1],
    [1, 2, 3, 4, 5, 6],
    [6, 5, 4, 3, 2, 1],
    [7, 7, 7, 7],
    [0, -1, 1, -100000, 100000],
    randomArray(random, 10, -10, 10),
    randomArray(random, 100, -1000, 1000),
    randomArray(random, 1000, -100000, 100000),
    randomArray(random, 6000, -100000, 100000),
    randomArray(random, 6000, 0, 10),
    range(6000).map((value) => 6001 - value),
    range(6000).map((value) => (value % 2 ? value : -value)),
    shuffle(random, range(5999, -3000))
  ];

  return defineChallenge({
    slug: "heapsort",
    title: "Heapsort",
    difficulty: "medium",
    moduleId: moduleId("heaps"),
    position: 1,
    description: `
Implemente a função \`heapsort(v)\`, que retorna os valores de \`v\` em **ordem crescente**, usando o método **heapsort**:

1. transforme o vetor num **heap máximo** (cada pai maior ou igual aos filhos, com os filhos de \`i\` em \`2i + 1\` e \`2i + 2\`);
2. repetidamente, troque a raiz (o maior) com o último elemento da parte ainda não ordenada, diminua essa parte em 1 e faça o novo elemento da raiz **descer** até o lugar certo.

Funções prontas de ordenação (\`sort\`, \`sorted\`, \`qsort\`) **não são permitidas**. Valores repetidos e negativos podem aparecer; para o vetor vazio, retorne um vetor vazio.

**Exemplo:** \`[5, 2, 9, 1, 5, 6]\` → \`[1, 2, 5, 5, 6, 9]\`.
`.trim(),
    constraints: [
      "0 <= v.length <= 6000",
      "-10^5 <= v[i] <= 10^5",
      "Proibido: sort, sorted e qsort. Implemente o heap.",
      "Em C, você pode ordenar o próprio vetor recebido e retorná-lo, preenchendo *returnSize."
    ],
    tags: ["Heap", "Ordenação"],
    functionSpec: { name: "heapsort", params: [{ name: "v", type: "int[]" }], returns: "int[]" },
    languages: [
      language("javascript", [rules.noBuiltinSort]),
      language("python", [rules.noBuiltinSort]),
      language("c", [rules.noBuiltinSort])
    ],
    publicCases: [call([[5, 2, 9, 1, 5, 6]], [1, 2, 5, 5, 6, 9]), call([[3, -1, 0]], [-1, 0, 3])],
    hiddenCases: lists.map((values) => call([values], sortedNumbers(values))),
    hints: [
      "A operação central é descer(v, i, tamanho): enquanto algum filho de i (dentro do tamanho) for maior que v[i], troque v[i] com o maior filho e continue a partir dele.",
      "Para montar o heap, chame descer para cada pai, de n/2 − 1 até 0. Depois, para fim de n − 1 até 1: troque v[0] com v[fim] e chame descer(v, 0, fim)."
    ],
    editorial: `
**Ideia.** No heap máximo o maior elemento está sempre na posição 0. Trocando-o com o último da parte ativa, ele vai para o lugar definitivo; basta consertar o heap na raiz, que ficou fora de ordem, e repetir.

${F}js
function descer(v, i, tamanho) {
  for (;;) {
    const esq = 2 * i + 1, dir = esq + 1;
    let maior = i;
    if (esq < tamanho && v[esq] > v[maior]) maior = esq;
    if (dir < tamanho && v[dir] > v[maior]) maior = dir;
    if (maior === i) return;
    [v[i], v[maior]] = [v[maior], v[i]];
    i = maior;
  }
}

function heapsort(v) {
  for (let i = (v.length >> 1) - 1; i >= 0; i--) descer(v, i, v.length);
  for (let fim = v.length - 1; fim > 0; fim--) {
    [v[0], v[fim]] = [v[fim], v[0]];
    descer(v, 0, fim);
  }
  return v;
}
${F}

Montar o heap de baixo para cima custa O(n) (a maior parte dos nós está perto das folhas e desce pouco). Cada uma das n extrações desce no máximo log n níveis.

**Custo:** O(n log n) de tempo, O(1) de memória extra (ordena no próprio vetor). Não é estável.
`.trim(),
    complexity: { time: "O(n log n)", space: "O(1)" }
  });
}

function kMaiores(): Challenge {
  const random = createRandom(502200);
  const answer = (nums: number[], k: number) => sortedNumbers(nums).slice(-k).reverse();
  const literal: Array<[number[], number]> = [
    [[5, 5, 5, 1], 2],
    [[7], 1],
    [[1, 2, 3], 3],
    [[-5, -1, -3, -1], 2],
    [[4, 4, 4, 4, 4], 5],
    [[1000000000, -1000000000, 0], 1],
    [randomArray(random, 30, -10, 10), 7],
    [randomArray(random, 100, 0, 3), 100],
    [randomArray(random, 5000, -1000000, 1000000), 50]
  ];
  while (literal.length < 12) {
    const length = randomInt(random, 10, 500);
    literal.push([randomArray(random, length, -1000, 1000), randomInt(random, 1, Math.min(length, 100))]);
  }
  const wide = gen({ $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 502201 });

  return defineChallenge({
    slug: "k-maiores",
    title: "Os k maiores",
    difficulty: "medium",
    moduleId: moduleId("heaps"),
    position: 2,
    description: `
Implemente a função \`kMaiores(nums, k)\`, que retorna os \`k\` maiores valores de \`nums\` em **ordem decrescente**.

- Valores repetidos contam separadamente: em \`[5, 5, 5, 1]\` com \`k = 2\`, a resposta é \`[5, 5]\`.
- Sempre vale \`1 <= k <= nums.length\` e \`k <= 100\`.

**Exemplos:**

- \`nums = [3, 1, 4, 1, 5, 9, 2, 6]\`, \`k = 3\` → \`[9, 6, 5]\`.
- \`nums = [-2, -7, -1]\`, \`k = 2\` → \`[-1, -2]\`.

O vetor pode ter até 200 mil elementos. Um **heap mínimo de tamanho k** resolve em O(n log k): ele guarda os k maiores vistos até agora, com o menor deles no topo, pronto para ser trocado.
`.trim(),
    constraints: [
      "1 <= nums.length <= 2 · 10^5",
      "-10^9 <= nums[i] <= 10^9",
      "1 <= k <= min(nums.length, 100)",
      "Em C, retorne um vetor alocado com malloc e preencha *returnSize = k."
    ],
    tags: ["Heap", "Fila de prioridade"],
    functionSpec: { name: "kMaiores", params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }], returns: "int[]" },
    publicCases: [call([[3, 1, 4, 1, 5, 9, 2, 6], 3], [9, 6, 5]), call([[-2, -7, -1], 2], [-1, -2])],
    hiddenCases: [
      ...literal.map(([nums, k]) => call([nums, k], answer(nums, k))),
      call([wide.spec, 100], answer(wide.value, 100)),
      // 200 mil valores entre 0 e 10: cerca de 18 mil são 10, então os 100 maiores são todos 10.
      call([{ $gen: "ints", n: 200000, min: 0, max: 10, seed: 502202 }, 100], Array(100).fill(10)),
      call([{ $gen: "range", n: 200000, start: -100000 }, 1], [99999])
    ],
    hints: [
      "Você não precisa ordenar tudo: só interessa quem está entre os k maiores.",
      "Mantenha um heap mínimo com no máximo k elementos. Para cada valor: se o heap tem menos de k, insira; senão, se o valor é maior que o topo (o menor dos k), troque o topo por ele e desça. No fim, retire tudo do heap e inverta a ordem."
    ],
    editorial: `
**Ideia.** O heap mínimo de tamanho k funciona como uma "peneira": o topo é o menor dos k maiores vistos até agora, então qualquer valor que não o supere não pode estar na resposta.

${F}python
import heapq

def kMaiores(nums, k):
    heap = []
    for valor in nums:
        if len(heap) < k:
            heapq.heappush(heap, valor)
        elif valor > heap[0]:
            heapq.heapreplace(heap, valor)
    resultado = [heapq.heappop(heap) for _ in range(len(heap))]
    return resultado[::-1]
${F}

Em JavaScript e em C não há heap pronto: implemente \`subir\` e \`descer\` sobre um vetor de k posições. Ordenar tudo e pegar o fim também passa (O(n log n)), mas não usa o que o módulo ensina.

**Armadilha.** Descartar repetidos (com um \`Set\`, por exemplo) muda a resposta quando o maior valor aparece mais de uma vez.

**Custo:** O(n log k) de tempo e O(k) de memória.
`.trim(),
    complexity: { time: "O(n log k)", space: "O(k)" }
  });
}

function ultimaPedra(): Challenge {
  const random = createRandom(502300);
  const simulate = (weights: number[]) => {
    const heap = new MaxHeap(weights.length);
    for (const weight of weights) heap.push(weight);
    while (heap.size > 1) {
      const first = heap.pop();
      const second = heap.pop();
      if (first !== second) heap.push(first - second);
    }
    return heap.size ? heap.pop() : 0;
  };
  const literal: number[][] = [
    [7],
    [10, 4],
    [1, 1, 1],
    [5, 5, 5, 5],
    range(10),
    [1000000000, 1],
    [1000000000, 1000000000, 999999999],
    [2, 2, 3]
  ];
  while (literal.length < 13) literal.push(randomArray(random, randomInt(random, 2, 300), 1, randomInt(random, 2, 1000)));
  const big = [
    gen({ $gen: "ints", n: 100000, min: 1, max: 1000000000, seed: 502301 }),
    gen({ $gen: "ints", n: 100000, min: 1, max: 1000, seed: 502302 })
  ];

  return defineChallenge({
    slug: "ultima-pedra",
    title: "A última pedra",
    difficulty: "medium",
    moduleId: moduleId("heaps"),
    position: 3,
    description: `
Há um monte de pedras, cada uma com um peso inteiro positivo. A cada rodada, pegue as **duas mais pesadas**, com pesos \`x >= y\`, e esmague uma contra a outra:

- se \`x == y\`, as duas somem;
- se \`x > y\`, a de peso \`y\` some e sobra uma pedra de peso \`x − y\`, que volta para o monte.

As rodadas continuam enquanto houver pelo menos duas pedras. Implemente a função \`ultimaPedra(pesos)\`, que retorna o peso da pedra que sobrou no fim, ou \`0\` se não sobrou nenhuma.

**Exemplo:** \`[3, 8, 5, 2]\`: esmaga 8 e 5, sobra 3 → \`[3, 2, 3]\`; esmaga 3 e 3, somem → \`[2]\`. Retorno: \`2\`.

Com até 100 mil pedras, reordenar o monte inteiro a cada rodada é lento demais: use um **heap máximo** para achar as duas maiores em O(log n).
`.trim(),
    constraints: [
      "1 <= pesos.length <= 10^5",
      "1 <= pesos[i] <= 10^9"
    ],
    tags: ["Heap", "Simulação"],
    functionSpec: { name: "ultimaPedra", params: [{ name: "pesos", type: "int[]" }], returns: "int" },
    publicCases: [call([[3, 8, 5, 2]], 2), call([[6, 6]], 0)],
    hiddenCases: [
      ...literal.map((weights) => call([weights], simulate(weights))),
      ...big.map((weights) => call([weights.spec], simulate(weights.value))),
      // 99999 pedras iguais: elas se anulam aos pares e sobra uma.
      call([{ $gen: "repeat", n: 99999, value: 5 }], 5)
    ],
    hints: [
      "Cada rodada precisa das duas maiores pedras e às vezes devolve uma pedra nova: é exatamente o que uma fila de prioridade faz bem.",
      "Monte um heap máximo com todos os pesos. Enquanto ele tiver 2 ou mais elementos, retire dois (x e y); se forem diferentes, insira x − y. No fim, o heap tem 0 ou 1 elemento. (Em Python, heapq é um heap mínimo: guarde os pesos com sinal trocado.)"
    ],
    editorial: `
**Ideia.** Simule o processo com um heap máximo. Cada rodada faz duas remoções e no máximo uma inserção, todas O(log n), e o número de pedras cai a cada rodada, então há menos de n rodadas.

${F}python
import heapq

def ultimaPedra(pesos):
    heap = [-p for p in pesos]   # heapq é mínimo: sinal trocado vira máximo
    heapq.heapify(heap)
    while len(heap) > 1:
        x = -heapq.heappop(heap)
        y = -heapq.heappop(heap)
        if x != y:
            heapq.heappush(heap, -(x - y))
    return -heap[0] if heap else 0
${F}

**Por que não ordenar a cada rodada?** Com n = 10^5, são até 10^5 rodadas, e cada ordenação custa pelo menos O(n): 10^10 operações.

**Custo:** O(n log n) de tempo e O(n) de memória.
`.trim(),
    complexity: { time: "O(n log n)", space: "O(n)" }
  });
}

function mesclarKVetores(): Challenge {
  const random = createRandom(502400);
  const merge = (vectors: number[][]) => sortedNumbers(vectors.flat());
  const sortedVector = (length: number, min: number, max: number) => sortedNumbers(randomArray(random, length, min, max));
  const randomVectors = (count: number, maxLength: number) =>
    Array.from({ length: count }, () => sortedVector(randomInt(random, 0, maxLength), -10000, 10000));
  const hidden: number[][][] = [
    [],
    [[]],
    [[], [1]],
    [[1], [2, 3, 4]],
    [[5]],
    [[1, 1, 1], [1, 1], [1]],
    [[-10000, 10000], [], [0], [-5, -5, 5]],
    [[10, 20, 30], [1, 2, 3], [11, 21, 31, 41]],
    Array.from({ length: 2000 }, () => [randomInt(random, -10000, 10000)]),
    [sortedVector(6000, -10000, 10000)],
    randomVectors(10, 20),
    randomVectors(50, 240),
    randomVectors(1000, 11),
    [sortedVector(3000, 0, 100), sortedVector(3000, 0, 100)],
    [range(3000), range(3000, 3001)],
    Array.from({ length: 300 }, (_, index) => range(20, index * 20).reverse().reverse())
  ];

  return defineChallenge({
    slug: "mesclar-k-vetores",
    title: "Mesclar k vetores ordenados",
    difficulty: "hard",
    moduleId: moduleId("heaps"),
    position: 4,
    isBoss: true,
    description: `
Implemente a função \`mesclarVetores(vetores)\`, que recebe \`k\` vetores, **cada um já em ordem crescente**, e retorna um único vetor em ordem crescente com **todos** os valores (repetidos incluídos).

- Os vetores podem ter tamanhos diferentes, e alguns podem estar vazios.
- Se não houver vetores (ou todos estiverem vazios), retorne um vetor vazio.
- Funções prontas de ordenação (\`sort\`, \`sorted\`, \`qsort\`) **não são permitidas**: aproveite que cada vetor já está ordenado.

**Exemplo:** \`[[1, 4, 7], [2, 5, 8], [3, 6, 9]]\` → \`[1, 2, 3, 4, 5, 6, 7, 8, 9]\`.

A cada passo, o próximo valor da resposta é o menor entre os **primeiros ainda não usados** de cada vetor. Um **heap mínimo** com um candidato por vetor encontra esse menor em O(log k).
`.trim(),
    constraints: [
      "0 <= k <= 2000",
      "O total de valores N é no máximo 6000 (o limite vem do tamanho da resposta).",
      "-10^4 <= valores <= 10^4; cada vetor está em ordem crescente (não estrita).",
      "Proibido: sort, sorted e qsort.",
      "Em C, os tamanhos chegam em vetoresColSize[i]; retorne um vetor alocado com malloc e preencha *returnSize."
    ],
    tags: ["Heap", "Fila de prioridade", "Intercalação"],
    functionSpec: { name: "mesclarVetores", params: [{ name: "vetores", type: "int[][]" }], returns: "int[]" },
    languages: [
      language("javascript", [rules.noBuiltinSort]),
      language("python", [rules.noBuiltinSort]),
      language("c", [rules.noBuiltinSort])
    ],
    publicCases: [
      call([[[1, 4, 7], [2, 5, 8], [3, 6, 9]]], [1, 2, 3, 4, 5, 6, 7, 8, 9]),
      call([[[-3, 0, 10], [-5, 2, 2]]], [-5, -3, 0, 2, 2, 10])
    ],
    hiddenCases: hidden.map((vectors) => call([vectors], merge(vectors))),
    hints: [
      "Pense em k ponteiros, um no início de cada vetor. O próximo valor da resposta é sempre o menor entre os valores apontados.",
      "Procurar esse menor olhando os k ponteiros custa O(k) por passo. Um heap mínimo de pares (valor, índice do vetor) faz isso em O(log k).",
      "Coloque no heap o primeiro elemento de cada vetor não vazio. Repita: retire o menor, anote-o na resposta e, se o vetor dele ainda tiver elementos, insira o próximo desse mesmo vetor."
    ],
    editorial: `
**Ideia.** O heap guarda, para cada vetor, o menor elemento que ainda não foi para a resposta. O topo do heap é o menor de todos; depois de usá-lo, o candidato daquele vetor avança uma posição.

${F}python
import heapq

def mesclarVetores(vetores):
    heap = [(v[0], i, 0) for i, v in enumerate(vetores) if v]
    heapq.heapify(heap)
    resultado = []
    while heap:
        valor, i, j = heapq.heappop(heap)
        resultado.append(valor)
        if j + 1 < len(vetores[i]):
            heapq.heappush(heap, (vetores[i][j + 1], i, j + 1))
    return resultado
${F}

Em C e em JavaScript, implemente o heap mínimo sobre um vetor de índices de vetor, comparando pelo valor atual de cada um. Uma alternativa com o mesmo custo é mesclar os vetores dois a dois, em rodadas (como no Merge Sort).

**Sobre o tamanho dos testes.** A resposta é o vetor inteiro, e a saída do juiz é limitada; por isso o total fica em 6000 valores. Com esse tamanho, até soluções O(N · k) passam no tempo: o que o desafio cobra é a técnica (sem ordenação pronta) e o cuidado com vetores vazios e de tamanhos diferentes.

**Custo:** O(N log k) de tempo e O(k) de memória extra, além da resposta.
`.trim(),
    complexity: { time: "O(N log k)", space: "O(N + k)" }
  });
}

// =====================================================================
// Módulo: Grafos
// =====================================================================

const GRAPH_NOTE =
  "Os vértices são numerados de `0` a `n − 1` e as arestas chegam como um vetor de pares `[u, v]` (em C, `int** arestas` com `arestasSize` linhas; `arestasColSize[i]` vale 2).";

/** Lista de adjacência compacta (CSR): vizinhos de v em targets[start[v] .. start[v + 1]). */
function adjacency(n: number, edges: number[][], directed: boolean) {
  const degree = new Int32Array(n + 1);
  for (const [u, v] of edges) {
    degree[u] += 1;
    if (!directed) degree[v] += 1;
  }
  const start = new Int32Array(n + 1);
  for (let v = 0; v < n; v += 1) start[v + 1] = start[v] + degree[v];
  const fill = start.slice(0, n);
  const targets = new Int32Array(start[n]);
  const weights = new Float64Array(start[n]);
  for (const [u, v, w = 0] of edges) {
    targets[fill[u]] = v;
    weights[fill[u]++] = w;
    if (!directed) {
      targets[fill[v]] = u;
      weights[fill[v]++] = w;
    }
  }
  return { start, targets, weights };
}

function bfsDistances(n: number, edges: number[][], source: number): number[] {
  const { start, targets } = adjacency(n, edges, false);
  const distance = new Array<number>(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  distance[source] = 0;
  queue[tail++] = source;
  while (head < tail) {
    const u = queue[head++];
    for (let index = start[u]; index < start[u + 1]; index += 1) {
      const v = targets[index];
      if (distance[v] < 0) {
        distance[v] = distance[u] + 1;
        queue[tail++] = v;
      }
    }
  }
  return distance;
}

/** Union-find: devolve o número de componentes e se alguma aresta fechou ciclo. */
function unionFind(n: number, edges: number[][]) {
  const parent = Int32Array.from({ length: n }, (_, index) => index);
  const find = (x: number) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  let components = n;
  let cycle = false;
  for (const [u, v] of edges) {
    const a = find(u);
    const b = find(v);
    if (a === b) cycle = true;
    else {
      parent[a] = b;
      components -= 1;
    }
  }
  return { components, cycle };
}

function grauDosVertices(): Challenge {
  const random = createRandom(503000);
  const degrees = (n: number, edges: number[][]) => {
    const result = new Array<number>(n).fill(0);
    for (const [u, v] of edges) {
      result[u] += 1;
      result[v] += 1;
    }
    return result;
  };
  const randomEdges = (n: number, m: number) =>
    Array.from({ length: m }, () => {
      const u = randomInt(random, 0, n - 1);
      let v = randomInt(random, 0, n - 2);
      if (v >= u) v += 1;
      return [u, v];
    });
  const literal: Array<[number, number[][]]> = [
    [1, []],
    [5, []],
    [6, [[0, 1], [1, 2], [2, 3], [3, 0]]],
    [2, [[0, 1], [1, 0], [0, 1]]],
    [7, [[0, 6], [3, 6], [6, 5]]],
    [4, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]],
    [10, randomEdges(8, 15)],
    [50, randomEdges(50, 200)],
    [1000, randomEdges(1000, 5000)],
    [3000, randomEdges(2000, 8000)],
    [10000, randomEdges(10000, 3000)],
    [10000, []]
  ];
  const big: Array<[number, { spec: unknown; value: any }]> = [
    [10000, gen({ $gen: "edges", n: 10000, m: 200000, seed: 503001 })],
    [10000, gen({ $gen: "edges", n: 10000, seed: 503002, tree: true })]
  ];

  return defineChallenge({
    slug: "grau-dos-vertices",
    title: "Grau dos vértices",
    difficulty: "easy",
    moduleId: moduleId("grafos"),
    position: 0,
    description: `
Num grafo **não dirigido**, o **grau** de um vértice é a quantidade de arestas que tocam nele.

Implemente a função \`graus(n, arestas)\`, que recebe o número de vértices \`n\` e a lista de arestas, e retorna um vetor com \`n\` posições em que a posição \`v\` é o grau do vértice \`v\`.

${GRAPH_NOTE}

- Cada aresta \`[u, v]\` soma 1 ao grau de \`u\` **e** 1 ao grau de \`v\`.
- Arestas repetidas contam cada vez que aparecem.
- Vértices sem nenhuma aresta têm grau 0 e também aparecem no resultado.

**Exemplo:** \`n = 4\`, \`arestas = [[0, 1], [1, 2], [1, 3]]\` → \`[1, 3, 1, 1]\`.
`.trim(),
    constraints: [
      "1 <= n <= 10^4",
      "0 <= arestas.length <= 2 · 10^5",
      "0 <= u, v < n e u != v",
      "Em C, retorne um vetor alocado com malloc (ou calloc) e preencha *returnSize = n."
    ],
    tags: ["Grafos", "Contagem"],
    functionSpec: {
      name: "graus",
      params: [{ name: "n", type: "int" }, { name: "arestas", type: "int[][]" }],
      returns: "int[]"
    },
    publicCases: [
      call([4, [[0, 1], [1, 2], [1, 3]]], [1, 3, 1, 1]),
      call([3, [[0, 1], [0, 2], [1, 2], [0, 1]]], [3, 3, 2])
    ],
    hiddenCases: [
      ...literal.map(([n, edges]) => call([n, edges], degrees(n, edges))),
      ...big.map(([n, edges]) => call([n, edges.spec], degrees(n, edges.value)))
    ],
    hints: [
      "Você não precisa montar a lista de adjacência: basta um contador por vértice.",
      "Crie um vetor de n zeros (o tamanho vem de n, não do maior vértice que aparece nas arestas) e, para cada aresta [u, v], some 1 em u e 1 em v."
    ],
    editorial: `
**Ideia.** Cada aresta contribui com 1 para cada uma das suas duas pontas. Um vetor de contadores com \`n\` posições resolve em uma passada.

${F}c
int* graus(int n, int** arestas, int arestasSize, int* arestasColSize, int* returnSize) {
    int* grau = calloc(n, sizeof(int));
    for (int i = 0; i < arestasSize; i++) {
        grau[arestas[i][0]]++;
        grau[arestas[i][1]]++;
    }
    *returnSize = n;
    return grau;
}
${F}

A soma de todos os graus é sempre 2m (cada aresta é contada duas vezes): uma boa conferência.

**Armadilha.** Deduzir a quantidade de vértices pelo maior índice das arestas perde os vértices isolados do fim.

**Custo:** O(n + m) de tempo e O(n) de memória.
`.trim(),
    complexity: { time: "O(n + m)", space: "O(n)" }
  });
}

function distanciasBfs(): Challenge {
  const random = createRandom(503100);
  const randomEdges = (n: number, m: number) =>
    Array.from({ length: m }, () => {
      const u = randomInt(random, 0, n - 1);
      let v = randomInt(random, 0, n - 2);
      if (v >= u) v += 1;
      return [u, v];
    });
  const path = (n: number) => {
    const labels = shuffle(random, range(n, 0));
    return { labels, edges: shuffle(random, range(n - 1, 0).map((index) => [labels[index], labels[index + 1]])) };
  };
  const longPath = path(8000);
  const literal: Array<[number, number[][], number]> = [
    [1, [], 0],
    [4, [[0, 1], [1, 2], [2, 3], [3, 0]], 0],
    [5, [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4]], 0],
    [6, [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]], 4],
    [3, [[0, 1], [0, 1], [1, 2]], 2],
    [7, [[1, 2], [2, 3], [4, 5]], 6],
    [6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 3]], 1],
    [20, randomEdges(20, 25), 0],
    [200, randomEdges(200, 300), 7],
    [2000, randomEdges(2000, 2500), 1999],
    [8000, longPath.edges, longPath.labels[0]],
    [8000, longPath.edges, longPath.labels[4000]]
  ];
  const big: Array<[number, { spec: unknown; value: any }, number]> = [
    [10000, gen({ $gen: "edges", n: 10000, m: 200000, seed: 503101 }), 0],
    [10000, gen({ $gen: "edges", n: 10000, m: 9000, seed: 503102 }), 9999]
  ];

  return defineChallenge({
    slug: "distancias-bfs",
    title: "Distâncias com BFS",
    difficulty: "medium",
    moduleId: moduleId("grafos"),
    position: 1,
    description: `
Implemente a função \`distancias(n, arestas, origem)\`, que recebe um grafo **não dirigido** e um vértice de origem, e retorna um vetor com \`n\` posições em que a posição \`v\` é a **menor quantidade de arestas** num caminho de \`origem\` até \`v\`.

${GRAPH_NOTE}

- A distância da origem até ela mesma é \`0\`.
- Se não há caminho até \`v\`, a posição \`v\` vale \`-1\`.
- Pode haver arestas repetidas.

**Exemplo:** \`n = 5\`, \`arestas = [[0, 1], [0, 2], [1, 3], [3, 4]]\`, \`origem = 0\` → \`[0, 1, 1, 2, 3]\`.

A busca em largura (BFS) visita os vértices em ordem de distância; uma busca em profundidade (DFS) não, e pode chegar a um vértice primeiro por um caminho mais longo.
`.trim(),
    constraints: [
      "1 <= n <= 10^4",
      "0 <= arestas.length <= 2 · 10^5",
      "0 <= u, v, origem < n e u != v",
      "Em C, retorne um vetor alocado com malloc e preencha *returnSize = n."
    ],
    tags: ["Grafos", "BFS", "Filas"],
    functionSpec: {
      name: "distancias",
      params: [{ name: "n", type: "int" }, { name: "arestas", type: "int[][]" }, { name: "origem", type: "int" }],
      returns: "int[]"
    },
    publicCases: [
      call([5, [[0, 1], [0, 2], [1, 3], [3, 4]], 0], [0, 1, 1, 2, 3]),
      call([4, [[1, 2]], 1], [-1, 0, 1, -1])
    ],
    hiddenCases: [
      ...literal.map(([n, edges, source]) => call([n, edges, source], bfsDistances(n, edges, source))),
      ...big.map(([n, edges, source]) => call([n, edges.spec, source], bfsDistances(n, edges.value, source)))
    ],
    hints: [
      "Monte a lista de adjacência: para cada vértice, os vizinhos. Como o grafo é não dirigido, a aresta [u, v] entra na lista de u e na de v.",
      "Use uma fila: comece com a origem (distância 0). Ao tirar u da fila, cada vizinho v ainda sem distância recebe dist[u] + 1 e entra na fila. Marque a distância ao enfileirar, não ao desenfileirar."
    ],
    editorial: `
**Ideia.** A BFS processa os vértices em camadas: primeiro os de distância 0, depois todos os de distância 1, e assim por diante. Por isso, a primeira vez que um vértice é alcançado já é pelo caminho mais curto.

1. Monte a lista de adjacência.
2. \`dist\` começa com -1 em tudo; \`dist[origem] = 0\` e a origem entra na fila.
3. Enquanto a fila não esvaziar: retire \`u\`; para cada vizinho \`v\` com \`dist[v] == -1\`, faça \`dist[v] = dist[u] + 1\` e enfileire \`v\`.

${F}js
function distancias(n, arestas, origem) {
  const vizinhos = Array.from({ length: n }, () => []);
  for (const [u, v] of arestas) {
    vizinhos[u].push(v);
    vizinhos[v].push(u);
  }
  const dist = new Array(n).fill(-1);
  const fila = [origem];
  dist[origem] = 0;
  for (let i = 0; i < fila.length; i++) {       // índice em vez de shift(): O(1)
    const u = fila[i];
    for (const v of vizinhos[u]) {
      if (dist[v] === -1) {
        dist[v] = dist[u] + 1;
        fila.push(v);
      }
    }
  }
  return dist;
}
${F}

**Custo:** O(n + m) de tempo e de memória. Em JavaScript, \`fila.shift()\` custa O(tamanho da fila); percorrer com um índice evita isso.
`.trim(),
    complexity: { time: "O(n + m)", space: "O(n + m)" }
  });
}

function componentesConexos(): Challenge {
  const random = createRandom(503200);
  const count = (n: number, edges: number[][]) => unionFind(n, edges).components;
  const randomEdges = (n: number, m: number) =>
    Array.from({ length: m }, () => {
      const u = randomInt(random, 0, n - 1);
      let v = randomInt(random, 0, n - 2);
      if (v >= u) v += 1;
      return [u, v];
    });
  const literal: Array<[number, number[][]]> = [
    [1, []],
    [5, []],
    [2, [[0, 1], [1, 0]]],
    [4, [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]],
    [6, [[0, 1], [2, 3], [4, 5], [1, 2]]],
    [7, [[6, 5], [5, 4], [0, 1]]],
    [10, randomEdges(10, 6)],
    [100, randomEdges(100, 60)],
    [1000, randomEdges(1000, 700)],
    [5000, randomEdges(5000, 5000)],
    [200000, []]
  ];
  const randomBig = gen({ $gen: "edges", n: 200000, m: 200000, seed: 503201 });

  return defineChallenge({
    slug: "componentes-conexos",
    title: "Componentes conexos",
    difficulty: "medium",
    moduleId: moduleId("grafos"),
    position: 2,
    description: `
Um **componente conexo** de um grafo não dirigido é um grupo máximo de vértices em que qualquer um alcança qualquer outro andando pelas arestas. Um vértice sem arestas forma, sozinho, um componente.

Implemente a função \`contarComponentes(n, arestas)\`, que retorna quantos componentes conexos o grafo tem.

${GRAPH_NOTE} Pode haver arestas repetidas.

**Exemplo:** \`n = 5\`, \`arestas = [[0, 1], [1, 2], [3, 4]]\` → \`2\` (os grupos \`{0, 1, 2}\` e \`{3, 4}\`).

Com até 200 mil vértices e 200 mil arestas, a solução precisa ser O(n + m) ou perto disso. Cuidado com DFS recursiva: num componente grande, a profundidade da recursão pode passar do que a pilha aguenta.
`.trim(),
    constraints: [
      "1 <= n <= 2 · 10^5",
      "0 <= arestas.length <= 2 · 10^5",
      "0 <= u, v < n e u != v"
    ],
    tags: ["Grafos", "Union-find", "BFS"],
    functionSpec: {
      name: "contarComponentes",
      params: [{ name: "n", type: "int" }, { name: "arestas", type: "int[][]" }],
      returns: "int"
    },
    publicCases: [call([5, [[0, 1], [1, 2], [3, 4]]], 2), call([3, []], 3)],
    hiddenCases: [
      ...literal.map(([n, edges]) => call([n, edges], count(n, edges))),
      call([200000, randomBig.spec], count(200000, randomBig.value)),
      // Uma árvore com todos os vértices: um único componente.
      call([200000, { $gen: "edges", n: 200000, seed: 503203, tree: true }], 1),
      // Árvore sobre os 100 mil primeiros vértices; os outros 100 mil ficam isolados.
      call([200000, { $gen: "edges", n: 100000, seed: 503202, tree: true }], 100001)
    ],
    hints: [
      "Cada vez que você começa uma busca (BFS ou DFS) a partir de um vértice ainda não visitado, encontrou um componente novo.",
      "Outra saída é o union-find: comece com n grupos e, para cada aresta que liga dois grupos diferentes, una-os e subtraia 1 do total. Com compressão de caminho, cada operação é praticamente O(1).",
      "Se usar DFS, faça-a com uma pilha explícita em vez de recursão: um componente com 100 mil vértices estoura a pilha de chamadas do JavaScript."
    ],
    editorial: `
**Ideia (union-find).** Mantenha uma floresta em que cada árvore é um componente, representado pela sua raiz. \`encontrar(x)\` sobe até a raiz; \`unir(a, b)\` pendura uma raiz na outra. Cada aresta que une duas raízes diferentes reduz em 1 o número de componentes.

${F}js
function contarComponentes(n, arestas) {
  const pai = Array.from({ length: n }, (_, i) => i);
  function encontrar(x) {
    while (pai[x] !== x) {
      pai[x] = pai[pai[x]];   // compressão de caminho (pela metade)
      x = pai[x];
    }
    return x;
  }
  let componentes = n;
  for (const [u, v] of arestas) {
    const a = encontrar(u), b = encontrar(v);
    if (a !== b) {
      pai[a] = b;
      componentes--;
    }
  }
  return componentes;
}
${F}

Com BFS: percorra os vértices; ao achar um não visitado, some 1 e visite todo o componente dele com uma fila.

**Armadilha.** "Renomear" o rótulo de todo um grupo a cada união custa O(n) por aresta: com 200 mil de cada, são dezenas de bilhões de passos.

**Custo:** O((n + m) · α(n)), praticamente linear, com O(n) de memória.
`.trim(),
    complexity: { time: "O((n + m) · α(n))", space: "O(n)" }
  });
}

function grafoTemCiclo(): Challenge {
  const random = createRandom(503300);
  const hasCycle = (n: number, edges: number[][]) => unionFind(n, edges).cycle;
  const randomForest = (n: number, trees: number) => {
    const labels = shuffle(random, range(n, 0));
    const edges: number[][] = [];
    for (let index = 1; index < n; index += 1) {
      if (index % Math.ceil(n / trees) === 0) continue; // começa uma árvore nova
      edges.push([labels[randomInt(random, Math.floor(index / Math.ceil(n / trees)) * Math.ceil(n / trees), index - 1)], labels[index]]);
    }
    return shuffle(random, edges);
  };
  const literal: Array<[number, number[][]]> = [
    [1, []],
    [2, [[0, 1]]],
    [2, [[0, 1], [1, 0]]],
    [2, [[0, 1], [0, 1]]],
    [3, [[1, 1]]],
    [3, [[0, 1], [1, 2], [2, 0]]],
    [6, [[0, 1], [1, 2], [3, 4], [4, 5]]],
    [6, [[0, 1], [1, 2], [3, 4], [4, 5], [5, 3]]],
    [5, [[0, 1], [0, 2], [0, 3], [0, 4]]],
    [30, randomForest(30, 3)],
    [1000, randomForest(1000, 10)],
    [1000, [...randomForest(1000, 10), [17, 17]]]
  ];
  // Respostas conhecidas pela construção: o gerador "tree" liga cada vértice v a
  // um pai sorteado entre 0 e v − 1 (o vértice 1 sempre a 0). Uma aresta a mais
  // entre dois vértices da árvore fecha ciclo; [1, 0] repete a aresta [0, 1].
  const tree = { $gen: "edges" as const, n: 200000, seed: 503301, tree: true };
  const big: Array<[number, unknown, boolean]> = [
    [200000, tree, false],
    [200000, { $gen: "concat", parts: [tree, [[123456, 654]]] }, true],
    [200000, { $gen: "concat", parts: [tree, [[1, 0]]] }, true],
    [200000, { $gen: "edges", n: 100000, seed: 503302, tree: true }, false]
  ];

  return defineChallenge({
    slug: "grafo-tem-ciclo",
    title: "O grafo tem ciclo?",
    difficulty: "medium",
    moduleId: moduleId("grafos"),
    position: 3,
    description: `
Implemente a função \`temCiclo(n, arestas)\`, que retorna \`true\` se o grafo **não dirigido** tem algum ciclo e \`false\` caso contrário.

${GRAPH_NOTE}

Neste desafio, contam como ciclo:

- um caminho que sai de um vértice e volta a ele sem repetir arestas (como \`0 – 1 – 2 – 0\`);
- **arestas repetidas** entre os mesmos dois vértices, em qualquer sentido: \`[0, 1]\` e \`[1, 0]\` juntas formam um ciclo de duas arestas;
- um **laço**, aresta de um vértice para ele mesmo, como \`[3, 3]\`.

O grafo pode ter vários componentes; basta um deles ter ciclo.

**Exemplos:**

- \`n = 4\`, \`arestas = [[0, 1], [1, 2], [2, 0], [2, 3]]\` → \`true\`.
- \`n = 4\`, \`arestas = [[0, 1], [1, 2], [1, 3]]\` → \`false\` (é uma árvore).
`.trim(),
    constraints: [
      "1 <= n <= 2 · 10^5",
      "0 <= arestas.length <= 2 · 10^5",
      "0 <= u, v < n (u == v é um laço)"
    ],
    tags: ["Grafos", "Union-find", "DFS"],
    functionSpec: {
      name: "temCiclo",
      params: [{ name: "n", type: "int" }, { name: "arestas", type: "int[][]" }],
      returns: "bool"
    },
    publicCases: [
      call([4, [[0, 1], [1, 2], [2, 0], [2, 3]]], true),
      call([4, [[0, 1], [1, 2], [1, 3]]], false)
    ],
    hiddenCases: [
      ...literal.map(([n, edges]) => call([n, edges], hasCycle(n, edges))),
      ...big.map(([n, edges, expected]) => call([n, edges], expected))
    ],
    hints: [
      "Uma aresta fecha um ciclo exatamente quando suas duas pontas já estavam ligadas por algum caminho antes dela.",
      "Com union-find: para cada aresta [u, v], se encontrar(u) == encontrar(v), há ciclo; senão, una os dois grupos. Isso trata laços e arestas repetidas sem nenhum caso especial.",
      "Com DFS, cuidado ao pular o vértice pai: se a lista de vizinhos descartar repetições (um Set, por exemplo), a segunda aresta entre dois vértices some e o ciclo [0, 1] + [1, 0] passa despercebido. Mantenha as arestas repetidas ou compare pelo índice da aresta."
    ],
    editorial: `
**Ideia.** Processe as arestas uma a uma mantendo os componentes num union-find. Se as duas pontas de uma aresta já estão no mesmo componente, existe outro caminho entre elas, e a aresta fecha um ciclo.

${F}python
def temCiclo(n, arestas):
    pai = list(range(n))

    def encontrar(x):
        while pai[x] != x:
            pai[x] = pai[pai[x]]
            x = pai[x]
        return x

    for u, v in arestas:
        a, b = encontrar(u), encontrar(v)
        if a == b:
            return True       # laço, aresta repetida ou caminho alternativo
        pai[a] = b
    return False
${F}

Uma conferência rápida: um grafo sem ciclos (uma floresta) com c componentes tem exatamente n − c arestas.

**Armadilha.** Na DFS que pula o vértice pai, guardar os vizinhos num conjunto (que descarta repetições) apaga a segunda cópia de \`[0, 1]\`, e o ciclo formado por \`[0, 1]\` e \`[1, 0]\` passa despercebido.

**Custo:** O((n + m) · α(n)) de tempo e O(n) de memória.
`.trim(),
    complexity: { time: "O((n + m) · α(n))", space: "O(n)" }
  });
}

function menorCaminhoNaGrade(): Challenge {
  const random = createRandom(503400);
  const shortest = (grid: string[]) => {
    const rows = grid.length;
    const cols = grid[0].length;
    const distance = new Int32Array(rows * cols).fill(-1);
    const queue = new Int32Array(rows * cols);
    let head = 0;
    let tail = 0;
    for (let r = 0; r < rows; r += 1) {
      const c = grid[r].indexOf("S");
      if (c >= 0) {
        distance[r * cols + c] = 0;
        queue[tail++] = r * cols + c;
      }
    }
    while (head < tail) {
      const cell = queue[head++];
      const r = Math.floor(cell / cols);
      const c = cell % cols;
      if (grid[r][c] === "E") return distance[cell];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || grid[nr][nc] === "#") continue;
        const next = nr * cols + nc;
        if (distance[next] < 0) {
          distance[next] = distance[cell] + 1;
          queue[tail++] = next;
        }
      }
    }
    return -1;
  };
  const randomGrid = (rows: number, cols: number, wall: number) => {
    const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (random() < wall ? "#" : ".")));
    const cells = shuffle(random, range(rows * cols, 0)).slice(0, 2);
    grid[Math.floor(cells[0] / cols)][cells[0] % cols] = "S";
    grid[Math.floor(cells[1] / cols)][cells[1] % cols] = "E";
    return grid.map((row) => row.join(""));
  };
  /** Labirinto em serpentina: corredores horizontais ligados alternadamente pela direita e pela esquerda. */
  const serpentine = (rows: number, cols: number) =>
    Array.from({ length: rows }, (_, r) => {
      if (r % 2 === 0) {
        const row = ".".repeat(cols).split("");
        if (r === 0) row[0] = "S";
        if (r === rows - 1) row[(rows >> 1) % 2 === 0 ? 0 : cols - 1] = "E";
        return row.join("");
      }
      const gapRight = (r >> 1) % 2 === 0;
      return gapRight ? "#".repeat(cols - 1) + "." : "." + "#".repeat(cols - 1);
    });
  const literal: string[][] = [
    ["SE"],
    ["S", "E"],
    ["S#E"],
    ["S.E"],
    ["S.E", "...", "..."],
    ["S..", "...", "..E"],
    ["S.#", "..#", "##E"],
    ["...", "S#E", "..."],
    ["S....", ".###.", ".#E#.", ".#.#.", "...#."],
    ["E....", "####.", "S...."],
    randomGrid(10, 10, 0.2),
    randomGrid(40, 60, 0.3),
    randomGrid(100, 100, 0.35),
    serpentine(201, 200)
  ];
  const open = (cols: number, last: boolean) => (last ? ".".repeat(cols - 1) + "E" : "S" + ".".repeat(cols - 1));
  const randomBig = gen({
    $gen: "concat",
    parts: [[open(500, false)], { $gen: "grid", rows: 398, cols: 500, seed: 503401, alphabet: ".#", weights: [7, 3] }, [open(500, true)]]
  });
  // Respostas conhecidas: grade 500 × 500 sem paredes (S e E em cantos opostos:
  // 499 + 499 passos) e grade com uma linha inteira de paredes no meio (-1).
  const knownBig: Array<[unknown, number]> = [
    [{ $gen: "concat", parts: [[open(500, false)], { $gen: "repeat", n: 498, value: ".".repeat(500) }, [open(500, true)]] }, 998],
    [{
      $gen: "concat",
      parts: [
        [open(500, false)],
        { $gen: "grid", rows: 200, cols: 500, seed: 503402, alphabet: ".#", weights: [4, 1] },
        ["#".repeat(500)],
        { $gen: "grid", rows: 197, cols: 500, seed: 503403, alphabet: ".#", weights: [4, 1] },
        [open(500, true)]
      ]
    }, -1]
  ];

  return defineChallenge({
    slug: "menor-caminho-na-grade",
    title: "Menor caminho na grade",
    difficulty: "medium",
    moduleId: moduleId("grafos"),
    position: 4,
    description: `
Uma grade é dada como um vetor de textos, todos com o mesmo tamanho. Cada caractere é uma célula:

- \`.\` é uma célula livre;
- \`#\` é uma parede;
- \`S\` é o início e \`E\` é o fim (as duas são livres, e cada uma aparece exatamente uma vez).

A cada passo você anda para uma célula vizinha **na horizontal ou na vertical** (não na diagonal), sem entrar em paredes nem sair da grade. Implemente a função \`menorCaminho(grade)\`, que retorna o **menor número de passos** de \`S\` até \`E\`, ou \`-1\` se não há caminho.

**Exemplo:**

${F}
S.#...
#.#.#.
#...#E
${F}

O único caminho desce pelo corredor, contorna as paredes e chega em \`E\` com \`11\` passos.

Cada célula é um vértice de um grafo, ligado às vizinhas livres: a BFS a partir de \`S\` dá a distância mínima. A grade pode ter até 250 mil células.
`.trim(),
    constraints: [
      "1 <= linhas, colunas <= 500 e linhas × colunas <= 2,5 · 10^5",
      "Todas as linhas têm o mesmo tamanho.",
      "Exatamente um S e um E; os demais caracteres são . ou #."
    ],
    tags: ["Grafos", "BFS", "Matrizes"],
    functionSpec: { name: "menorCaminho", params: [{ name: "grade", type: "string[]" }], returns: "int" },
    publicCases: [call([["S.#...", "#.#.#.", "#...#E"]], 11), call([["S#E"]], -1)],
    hiddenCases: [
      ...literal.map((grid) => call([grid], shortest(grid))),
      call([randomBig.spec], shortest(randomBig.value)),
      ...knownBig.map(([grid, expected]) => call([grid], expected))
    ],
    hints: [
      "Pense em cada célula livre como um vértice ligado às até quatro vizinhas livres. A pergunta vira: qual a distância em arestas de S até E?",
      "Faça uma BFS a partir de S com uma fila de posições (linha, coluna) e uma matriz de distâncias (ou de visitados). Marque a célula como visitada ao colocá-la na fila; a primeira vez que E sair da fila, a distância dela é a resposta.",
      "Guarde os visitados numa matriz (ou num conjunto), nunca numa lista percorrida com in/includes: essa busca linear deixa a BFS quadrática."
    ],
    editorial: `
**Ideia.** A BFS explora a grade em ondas: primeiro as células a 1 passo de S, depois as a 2 passos, e assim por diante. A primeira vez que alcança E, é pelo menor caminho.

${F}js
function menorCaminho(grade) {
  const L = grade.length, C = grade[0].length;
  const dist = Array.from({ length: L }, () => new Array(C).fill(-1));
  const fila = [];
  for (let r = 0; r < L; r++) {
    const c = grade[r].indexOf("S");
    if (c >= 0) { dist[r][c] = 0; fila.push([r, c]); }
  }
  const passos = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let i = 0; i < fila.length; i++) {
    const [r, c] = fila[i];
    if (grade[r][c] === "E") return dist[r][c];
    for (const [dr, dc] of passos) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= L || nc >= C) continue;
      if (grade[nr][nc] === "#" || dist[nr][nc] !== -1) continue;
      dist[nr][nc] = dist[r][c] + 1;
      fila.push([nr, nc]);
    }
  }
  return -1;
}
${F}

**Armadilhas.**

- Uma DFS acha **um** caminho, não necessariamente o menor.
- Marcar a célula como visitada só ao tirá-la da fila deixa a mesma célula entrar várias vezes.

**Custo:** O(L · C) de tempo e de memória: cada célula entra na fila no máximo uma vez.
`.trim(),
    complexity: { time: "O(L · C)", space: "O(L · C)" }
  });
}

function dijkstra(): Challenge {
  const random = createRandom(503500);
  const distancesFrom = (n: number, edges: number[][], source: number) => {
    const { start, targets, weights } = adjacency(n, edges, true);
    const distance = new Float64Array(n).fill(Infinity);
    // Heap mínimo de pares (distância, vértice) em dois vetores tipados.
    const keys = new Float64Array(edges.length + 1);
    const vertices = new Int32Array(edges.length + 1);
    let size = 0;
    const push = (key: number, vertex: number) => {
      let index = size++;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (keys[parent] <= key) break;
        keys[index] = keys[parent];
        vertices[index] = vertices[parent];
        index = parent;
      }
      keys[index] = key;
      vertices[index] = vertex;
    };
    const pop = () => {
      const lastKey = keys[--size];
      const lastVertex = vertices[size];
      let index = 0;
      for (;;) {
        let child = 2 * index + 1;
        if (child >= size) break;
        if (child + 1 < size && keys[child + 1] < keys[child]) child += 1;
        if (keys[child] >= lastKey) break;
        keys[index] = keys[child];
        vertices[index] = vertices[child];
        index = child;
      }
      keys[index] = lastKey;
      vertices[index] = lastVertex;
    };
    distance[source] = 0;
    push(0, source);
    while (size) {
      const d = keys[0];
      const u = vertices[0];
      pop();
      if (d > distance[u]) continue;
      for (let index = start[u]; index < start[u + 1]; index += 1) {
        const v = targets[index];
        const candidate = d + weights[index];
        if (candidate < distance[v]) {
          distance[v] = candidate;
          push(candidate, v);
        }
      }
    }
    return distance;
  };
  const cost = (n: number, edges: number[][], source: number, target: number) => {
    const distance = distancesFrom(n, edges, source)[target];
    return Number.isFinite(distance) ? distance : -1;
  };
  const randomWeighted = (n: number, m: number, max: number) =>
    Array.from({ length: m }, () => [randomInt(random, 0, n - 1), randomInt(random, 0, n - 1), randomInt(random, 0, max)]);
  const literal: Array<[number, number[][], number, number]> = [
    [1, [], 0, 0],
    [2, [], 0, 1],
    [2, [[1, 0, 5]], 0, 1],
    [2, [[0, 1, 5]], 0, 1],
    [3, [[0, 2, 10], [0, 1, 1], [1, 2, 1]], 0, 2],
    [3, [[0, 1, 7], [0, 1, 3], [1, 2, 0]], 0, 2],
    [4, [[0, 1, 0], [1, 2, 0], [2, 3, 0], [0, 3, 1]], 0, 3],
    [5, [[0, 1, 1000000000], [1, 2, 1000000000], [2, 3, 1000000000], [3, 4, 1000000000]], 0, 4],
    [4, [[0, 1, 2], [1, 0, 2], [2, 3, 1]], 1, 3],
    [6, [[0, 1, 4], [0, 2, 1], [2, 1, 2], [1, 3, 1], [2, 3, 5], [3, 4, 3], [4, 5, 1], [3, 5, 6]], 0, 5],
    [50, randomWeighted(50, 200, 100), 0, 49],
    [2000, randomWeighted(2000, 10000, 1000000), 3, 1999]
  ];
  const chainLength = 7000;
  const chain = shuffle(
    random,
    range(chainLength - 1, 0).map((index) => [index, index + 1, randomInt(random, 900000000, 1000000000)])
  );
  literal.push([chainLength, chain, 0, chainLength - 1]);

  const graphA = gen({ $gen: "edges", n: 100000, m: 200000, seed: 503501, weight: { min: 1, max: 1000000000 } });
  // A origem 3 alcança cerca de 80% dos vértices (o vértice 0 não tem arestas de saída).
  const distA = distancesFrom(100000, graphA.value, 3);
  const farthest = (distance: Float64Array) => {
    let best = 0;
    distance.forEach((value, index) => {
      if (Number.isFinite(value) && value > distance[best]) best = index;
    });
    return best;
  };
  const unreachable = distA.findIndex((value) => !Number.isFinite(value));
  const targetA = farthest(distA);

  return defineChallenge({
    slug: "dijkstra",
    title: "Menor custo com Dijkstra",
    difficulty: "hard",
    moduleId: moduleId("grafos"),
    position: 5,
    isBoss: true,
    description: `
Um mapa de rotas tem \`n\` cidades (vértices \`0\` a \`n − 1\`) e estradas de **mão única**: cada aresta \`[u, v, peso]\` permite ir de \`u\` para \`v\` pagando \`peso\` (em C, \`arestasColSize[i]\` vale 3).

Implemente a função \`menorCusto(n, arestas, origem, destino)\`, que retorna o **menor custo total** para ir de \`origem\` até \`destino\`, ou \`-1\` se não há caminho.

- Os pesos são inteiros entre 0 e 10^9. Um caminho pode ter milhares de arestas, então o custo pode passar de 2^31: use \`long long\` em C.
- Pode haver arestas repetidas (com pesos diferentes) e laços.
- Se \`origem == destino\`, o custo é \`0\`.

**Exemplo:** \`n = 3\`, \`arestas = [[0, 2, 10], [0, 1, 1], [1, 2, 1]]\`, \`origem = 0\`, \`destino = 2\` → \`2\` (o desvio por 1 é mais barato que a aresta direta).

Com até 10^5 vértices e 2 · 10^5 arestas, procurar o vértice de menor distância percorrendo todos a cada passo (O(n²)) é lento demais: use Dijkstra com um **heap mínimo**.
`.trim(),
    constraints: [
      "1 <= n <= 10^5",
      "0 <= arestas.length <= 2 · 10^5",
      "0 <= u, v, origem, destino < n",
      "0 <= peso <= 10^9; a resposta cabe em 64 bits (long long em C)."
    ],
    tags: ["Grafos", "Dijkstra", "Heap"],
    functionSpec: {
      name: "menorCusto",
      params: [
        { name: "n", type: "int" },
        { name: "arestas", type: "int[][]" },
        { name: "origem", type: "int" },
        { name: "destino", type: "int" }
      ],
      returns: "long"
    },
    publicCases: [
      call([3, [[0, 2, 10], [0, 1, 1], [1, 2, 1]], 0, 2], 2),
      call([4, [[0, 1, 5], [2, 1, 1], [1, 3, 2]], 0, 2], -1)
    ],
    hiddenCases: [
      ...literal.map(([n, edges, source, target]) => call([n, edges, source, target], cost(n, edges, source, target))),
      call([100000, graphA.spec, 3, targetA], distA[targetA]),
      call([100000, graphA.spec, 3, unreachable], -1)
    ],
    hints: [
      "Dijkstra mantém, para cada vértice, a melhor distância conhecida, e sempre fecha o vértice aberto de menor distância: com pesos não negativos, nenhuma rota futura consegue melhorá-lo.",
      "Guarde pares (distância, vértice) num heap mínimo. Ao retirar um par cuja distância é maior que a registrada para o vértice, ignore-o (é uma entrada velha). Senão, relaxe as arestas de saída: se dist[u] + peso < dist[v], atualize dist[v] e insira (dist[v], v) no heap.",
      "Em C, use long long para as distâncias e um heap de pares com capacidade m + 1 (cada relaxamento insere no máximo um par). Em Python, heapq com tuplas; em JavaScript, implemente o heap."
    ],
    editorial: `
**Ideia.** Com pesos não negativos, o vértice aberto de menor distância já tem a distância definitiva. O heap entrega esse vértice em O(log m); cada aresta é relaxada uma vez, quando sua origem é fechada.

${F}python
import heapq

def menorCusto(n, arestas, origem, destino):
    saida = [[] for _ in range(n)]
    for u, v, peso in arestas:
        saida[u].append((v, peso))
    dist = [None] * n
    dist[origem] = 0
    heap = [(0, origem)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist[u]:
            continue                      # entrada velha
        if u == destino:
            return d
        for v, peso in saida[u]:
            nova = d + peso
            if dist[v] is None or nova < dist[v]:
                dist[v] = nova
                heapq.heappush(heap, (nova, v))
    return -1
${F}

Parar quando o destino sai do heap é seguro: a partir daí sua distância não muda mais.

**Custo:** O((n + m) log m) de tempo e O(n + m) de memória. A versão sem heap, que procura o menor entre todos os vértices a cada passo, custa O(n²): 10^10 operações com n = 10^5. Bellman-Ford, O(n · m), é ainda pior.
`.trim(),
    complexity: { time: "O((n + m) log m)", space: "O(n + m)" }
  });
}

export function buildEdHierarquicasChallenges(): Challenge[] {
  return [
    frequenciaDePalavras(),
    primeiroCaractereUnico(),
    duplicadoProximo(),
    tabelaHashComEncadeamento(),
    agruparAnagramas(),
    percursosDaArvore(),
    alturaDaArvore(),
    inserirNaBst(),
    arvoreBalanceada(),
    somaDeCaminho(),
    reconstruirArvore(),
    validarHeap(),
    heapsort(),
    kMaiores(),
    ultimaPedra(),
    mesclarKVetores(),
    grauDosVertices(),
    distanciasBfs(),
    componentesConexos(),
    grafoTemCiclo(),
    menorCaminhoNaGrade(),
    dijkstra()
  ];
}
