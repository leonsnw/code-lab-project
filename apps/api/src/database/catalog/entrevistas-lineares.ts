import type { Challenge, SourceRule } from "../../domain/types.js";
import type { GeneratedSpec } from "../../modules/submissions/generated-input.js";
import { call, createRandom, defineChallenge, gen, language, pick, randomArray, randomInt, shuffle, type CaseDefinition } from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Preparação para Entrevistas", parte linear: vetores e hash, strings
 * e janelas, pilhas/busca binária/intervalos e listas encadeadas. Todos no
 * modo função (JavaScript, Python e C), com dicas progressivas, solução
 * comentada, complexidade esperada e perguntas de acompanhamento. Os casos
 * enormes usam argumentos gerados pelo juiz para derrubar soluções ingênuas.
 */

/** Markdown com crases: escreva "§" no lugar de "`" (evita escapar em template literals). */
const md = (strings: TemplateStringsArray, ...values: unknown[]) => String.raw(strings, ...values).replace(/§/g, "`").trim();

const VETORES_HASH = moduleId("entrevista-vetores-hash");
const STRINGS_JANELAS = moduleId("entrevista-strings-janelas");
const PILHAS_INTERVALOS = moduleId("entrevista-pilhas-intervalos");
const LISTAS = moduleId("entrevista-listas");

const LIMITE_VALOR = 500_000_000;
const PRINTABLE = Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index)).join("");

// =====================================================================
// Módulo: vetores e hash
// =====================================================================

/** Conta os pares i < j com soma alvo; `par` é o último encontrado. */
function contarPares(nums: number[], alvo: number): { total: number; par: number[] } {
  const vistos = new Map<number, { count: number; first: number }>();
  let total = 0;
  let par: number[] = [];
  nums.forEach((valor, j) => {
    const anterior = vistos.get(alvo - valor);
    if (anterior) {
      total += anterior.count;
      par = [anterior.first, j];
    }
    const atual = vistos.get(valor);
    if (atual) atual.count += 1;
    else vistos.set(valor, { count: 1, first: j });
  });
  return { total, par };
}

function casoPequenoDoisNumeros(random: () => number, maxN: number, span: number): CaseDefinition {
  for (;;) {
    const n = randomInt(random, 2, maxN);
    const nums = randomArray(random, n, -span, span);
    const i = randomInt(random, 0, n - 2);
    const j = randomInt(random, i + 1, n - 1);
    const alvo = nums[i] + nums[j];
    const { total, par } = contarPares(nums, alvo);
    if (total === 1) return call([nums, alvo], par);
  }
}

/**
 * Caso enorme com par único: a base (valores distintos em [-span, span]) não
 * tem nenhum par com soma alvo, porque |alvo| > 2·span; as posições p e q
 * recebem a e b = alvo - a, ambos ausentes da base.
 */
function casoGrandeDoisNumeros(seed: number, n: number, span: number, alvo: number, p: number, q: number): CaseDefinition {
  if (Math.abs(alvo) <= 2 * span) throw new Error("dois-numeros-alvo: alvo precisa ficar fora do alcance da base.");
  const base = gen({ $gen: "ints", n, min: -span, max: span, seed, distinct: true }).value as number[];
  const presentes = new Set(base);
  const random = createRandom(seed + 1);
  const lo = Math.max(-LIMITE_VALOR, alvo - LIMITE_VALOR);
  const hi = Math.min(LIMITE_VALOR, alvo + LIMITE_VALOR);
  let a = 0;
  let b = 0;
  do {
    a = randomInt(random, lo, hi);
    b = alvo - a;
  } while (a === b || presentes.has(a) || presentes.has(b));
  const spec: GeneratedSpec = { $gen: "ints", n, min: -span, max: span, seed, distinct: true, set: { [String(p)]: a, [String(q)]: b } };
  // Par único por construção: nenhum par da base alcança o alvo, e a + x == alvo só com x == b.
  return call([spec, alvo], [Math.min(p, q), Math.max(p, q)]);
}

function doisNumerosAlvo(): Challenge {
  const random = createRandom(800001);
  const fixos: Array<[number[], number]> = [
    [[3, 3], 6],
    [[5, 1, 5], 10],
    [[4, 6, 1], 5],
    [[3, 2, 4], 6],
    [[0, 7, -3, 0], 0],
    [[-8, -3, -12, 1], -20],
    [[-500000000, 12, 500000000], 0],
    [[500000000, 1, 500000000], 1000000000],
    [[9, 2, 7, 11, 15, -4], 26],
    [[1, 2, 3, 4, 5, 6, 7, 8], 15],
    [[-1, 1], 0]
  ];
  const hiddenCases = fixos.map(([nums, alvo]) => {
    const { total, par } = contarPares(nums, alvo);
    if (total !== 1) throw new Error(`dois-numeros-alvo: caso fixo sem par único: ${JSON.stringify(nums)}`);
    return call([nums, alvo], par);
  });
  for (let index = 0; index < 4; index += 1) hiddenCases.push(casoPequenoDoisNumeros(random, 12, 30));
  hiddenCases.push(casoPequenoDoisNumeros(random, 2000, 1000000));
  hiddenCases.push(
    casoGrandeDoisNumeros(800101, 200000, 200000000, 487654321, 199998, 199999),
    casoGrandeDoisNumeros(800102, 200000, 100000000, -300000001, 150000, 199999),
    casoGrandeDoisNumeros(800104, 200000, 240000000, -987654321, 199999, 180000)
  );

  return defineChallenge({
    slug: "dois-numeros-alvo",
    title: "Dois números que somam o alvo",
    difficulty: "easy",
    moduleId: VETORES_HASH,
    position: 0,
    description: md`
Implemente §doisNumerosAlvo(nums, alvo)§. A função recebe um vetor de inteiros §nums§ e um inteiro §alvo§ e retorna um vetor com **dois índices** §[i, j]§, com §i < j§, tais que §nums[i] + nums[j] == alvo§.

Cada caso tem **exatamente um** par de posições que funciona. O mesmo índice não pode ser usado duas vezes, mas dois índices diferentes podem guardar o mesmo valor: em §[3, 3]§ com alvo §6§, a resposta é §[0, 1]§.

**Exemplo:** §nums = [8, 1, 12, 6]§ e §alvo = 7§ retorna §[1, 3]§, porque §1 + 6 = 7§.

O vetor pode ter até 200 000 elementos: testar todos os pares, O(n²), não cabe no tempo. Espera-se uma única passada, O(n).
`,
    constraints: [
      "2 <= n <= 2 * 10^5",
      "-5 * 10^8 <= nums[i] <= 5 * 10^8",
      "-10^9 <= alvo <= 10^9",
      "Existe exatamente um par de índices i < j com nums[i] + nums[j] == alvo.",
      "Retorne [i, j] com i < j."
    ],
    tags: ["Hash", "Complemento"],
    functionSpec: {
      name: "doisNumerosAlvo",
      params: [{ name: "nums", type: "int[]" }, { name: "alvo", type: "int" }],
      returns: "int[]"
    },
    publicCases: [call([[8, 1, 12, 6], 7], [1, 3]), call([[-4, 10, 5, 2], 1], [0, 2])],
    hiddenCases,
    hints: [
      "Fixe um elemento nums[j]. Qual valor exato precisaria ter aparecido antes dele para fechar o alvo?",
      "Esse valor é o complemento alvo - nums[j]. Perguntar \"já vi este valor?\" em O(1) é trabalho para um mapa (hash).",
      "Percorra o vetor uma vez: para cada j, procure alvo - nums[j] no mapa; se estiver lá, retorne [mapa[complemento], j]. Só depois guarde nums[j] -> j no mapa (assim o elemento não se combina consigo mesmo)."
    ],
    editorial: md`
## Abordagem ingênua
Testar todos os pares §(i, j)§ com dois laços encontra a resposta, mas custa O(n²): com n = 200 000 são cerca de 2·10^10 somas, muito além do limite de tempo.

## Abordagem ótima: complemento com hash
Para cada posição §j§, o único parceiro possível é o valor §alvo - nums[j]§ (o **complemento**). Se guardarmos num mapa "valor -> índice" tudo o que já passou, a pergunta "o complemento já apareceu?" custa O(1) em média.

1. Crie um mapa vazio.
2. Para cada §j§ da esquerda para a direita, calcule §falta = alvo - nums[j]§.
3. Se §falta§ está no mapa, retorne §[mapa[falta], j]§ — o índice guardado é sempre menor que §j§.
4. Senão, guarde §nums[j] -> j§.

Consultar **antes** de inserir evita usar o mesmo elemento duas vezes (alvo 6 com um único 3) e resolve naturalmente valores repetidos (§[3, 3]§).

§§§js
function doisNumerosAlvo(nums, alvo) {
  const posicao = new Map(); // valor -> índice onde apareceu
  for (let j = 0; j < nums.length; j++) {
    const falta = alvo - nums[j];
    if (posicao.has(falta)) return [posicao.get(falta), j];
    posicao.set(nums[j], j);
  }
  return [];
}
§§§

Em C não há mapa pronto: uma tabela com endereçamento aberto (vetor de tamanho potência de 2, sondagem linear) resolve. Outra opção é ordenar pares (valor, índice) e usar dois ponteiros, em O(n log n).

## Custo
Tempo O(n) em média (uma passada, operações O(1) no mapa); memória O(n) para o mapa.
`,
    complexity: { time: "O(n)", space: "O(n)" },
    followUps: [
      "E se o vetor já viesse ordenado? Dá para resolver com O(1) de memória extra?",
      "Como você devolveria todos os pares distintos de valores que somam o alvo, sem repetir pares?",
      "Se o vetor não coubesse na memória (um fluxo enorme), o que mudaria na sua solução?"
    ]
  });
}

// ---------------------------------------------------------------------

const NO_DIVISION: SourceRule = {
  kind: "forbid",
  pattern: "/|\\*\\*\\s*\\(?\\s*-|\\bMath\\.pow\\b|\\bpow\\s*\\(|\\b(div|ldiv|lldiv|divmod|truediv|floordiv|itruediv|ifloordiv)\\b",
  message: "Não use divisão: o operador / e atalhos como potência com expoente negativo estão proibidos. Combine produtos de prefixo e de sufixo."
};

function produtoExceto(nums: number[]): number[] {
  const resposta = new Array<number>(nums.length).fill(1);
  let prefixo = 1;
  for (let index = 0; index < nums.length; index += 1) {
    resposta[index] = prefixo;
    prefixo *= nums[index];
  }
  let sufixo = 1;
  for (let index = nums.length - 1; index >= 0; index -= 1) {
    resposta[index] *= sufixo;
    sufixo *= nums[index];
  }
  return resposta.map((value) => (value === 0 ? 0 : value));
}

/** Garante que todo prefixo e sufixo (e, portanto, toda resposta) cabe em int32. */
function casoProduto(nums: number[]): CaseDefinition {
  let absoluto = 1n;
  for (const value of nums) if (value !== 0) absoluto *= BigInt(Math.abs(value));
  if (absoluto > 2147483647n) throw new Error("produto-exceto-a-posicao: produto fora de int32.");
  return call([nums], produtoExceto(nums));
}

function vetorDeProduto(random: () => number, n: number, limite: number, zeros = 0): number[] {
  const nums: number[] = Array.from({ length: n }, () => (random() < 0.5 ? 1 : -1));
  let produto = 1;
  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    const value = pick(random, [2, -2, 3, -3, 5, -5, 7, 4, -6]);
    if (produto * Math.abs(value) > limite) break;
    produto *= Math.abs(value);
    nums[randomInt(random, 0, n - 1)] = value;
  }
  for (let index = 0; index < zeros; index += 1) nums[randomInt(random, 0, n - 1)] = 0;
  return nums;
}

function produtoExcetoAPosicao(): Challenge {
  const random = createRandom(800201);
  const fixos: number[][] = [
    [2, 3],
    [0, 0],
    [0, 4, 5],
    [1, 0, 3, 0],
    [-1, -1, -1],
    [5, -2, 7, 0, 3],
    [-3, 4, -2, 5],
    [1, 1, 1, 1, 1],
    Array.from({ length: 30 }, () => 2),
    [-1, ...Array.from({ length: 30 }, () => 2)],
    [...Array.from({ length: 19 }, () => 3), 1],
    [7, -1, 1, -1, 7, -7]
  ];
  const hiddenCases = fixos.map(casoProduto);
  for (let index = 0; index < 4; index += 1) hiddenCases.push(casoProduto(vetorDeProduto(random, randomInt(random, 2, 40), 100000)));
  hiddenCases.push(casoProduto(vetorDeProduto(random, 5000, 50000)));
  hiddenCases.push(casoProduto(vetorDeProduto(random, 5000, 40000, 1)));

  const geradores: GeneratedSpec[] = [
    { $gen: "repeat", n: 5000, value: 1 },
    { $gen: "ints", n: 5000, min: -1, max: 1, seed: 800202 },
    { $gen: "concat", parts: [{ $gen: "repeat", n: 2499, value: -1 }, [3], { $gen: "repeat", n: 2500, value: 1 }] },
    { $gen: "concat", parts: [[0], { $gen: "repeat", n: 4998, value: -1 }, [6]] }
  ];
  for (const spec of geradores) {
    const nums = gen(spec).value as number[];
    const caso = casoProduto(nums);
    hiddenCases.push(call([spec], JSON.parse(caso.output)));
  }

  return defineChallenge({
    slug: "produto-exceto-a-posicao",
    title: "Produto exceto a própria posição",
    difficulty: "medium",
    moduleId: VETORES_HASH,
    position: 1,
    description: md`
Implemente §produtoExcetoPosicao(nums)§. A função recebe um vetor de inteiros e retorna um vetor §resposta§ do mesmo tamanho em que §resposta[i]§ é o **produto de todos os elementos de §nums§, menos o da posição §i§**.

**Regra:** não use divisão. O operador §/§ (e atalhos como potência com expoente negativo) é proibido pela correção. Pense em como combinar o que está à esquerda e o que está à direita de cada posição.

**Exemplo:** §[2, 5, 3, 4]§ retorna §[60, 24, 40, 30]§ — por exemplo, §resposta[1] = 2 · 3 · 4 = 24§.

Zeros são permitidos e merecem atenção: com um único zero, só a posição dele tem produto diferente de zero; com dois ou mais zeros, tudo vira zero.

É garantido que o produto de qualquer conjunto de elementos cabe em um inteiro de 32 bits com sinal.
`,
    constraints: [
      "2 <= n <= 5000",
      "-30 <= nums[i] <= 30",
      "O produto de qualquer subconjunto dos elementos cabe em int32.",
      "Proibido usar divisão (/, pow com expoente negativo e similares)."
    ],
    tags: ["Prefixo e sufixo"],
    functionSpec: { name: "produtoExcetoPosicao", params: [{ name: "nums", type: "int[]" }], returns: "int[]" },
    languages: [language("javascript", [NO_DIVISION]), language("python", [NO_DIVISION]), language("c", [NO_DIVISION])],
    publicCases: [call([[2, 5, 3, 4]], [60, 24, 40, 30]), call([[-1, 2, 0, 3]], [0, 0, -6, 0])],
    hiddenCases,
    hints: [
      "O produto de todos menos nums[i] é (produto de tudo à esquerda de i) vezes (produto de tudo à direita de i).",
      "Guarde em resposta[i] o produto do prefixo nums[0..i-1], numa passada da esquerda para a direita.",
      "Numa segunda passada, da direita para a esquerda, mantenha um acumulador do sufixo e multiplique resposta[i] por ele antes de incluir nums[i]. Assim a memória extra é O(1) além da saída."
    ],
    editorial: md`
## Abordagem ingênua
Para cada posição, multiplicar todos os outros elementos custa O(n²). Outra saída ingênua é multiplicar tudo e dividir por §nums[i]§ — proibida aqui e, além disso, frágil: quebra com zeros e exige tratar à parte o caso de um zero e de vários.

## Abordagem ótima: prefixo × sufixo
§resposta[i]§ = (produto de §nums[0..i-1]§) × (produto de §nums[i+1..n-1]§).

1. Passada da esquerda para a direita com um acumulador §prefixo = 1§: grave §resposta[i] = prefixo§ e depois faça §prefixo *= nums[i]§.
2. Passada da direita para a esquerda com §sufixo = 1§: faça §resposta[i] *= sufixo§ e depois §sufixo *= nums[i]§.

Os zeros não precisam de nenhum tratamento especial: eles entram nos produtos como qualquer outro número.

§§§js
function produtoExcetoPosicao(nums) {
  const n = nums.length;
  const resposta = new Array(n);
  let prefixo = 1;
  for (let i = 0; i < n; i++) {
    resposta[i] = prefixo; // produto de tudo à esquerda de i
    prefixo *= nums[i];
  }
  let sufixo = 1;
  for (let i = n - 1; i >= 0; i--) {
    resposta[i] *= sufixo; // agora inclui tudo à direita de i
    sufixo *= nums[i];
  }
  return resposta;
}
§§§

## Custo
Tempo O(n) (duas passadas); memória O(1) além do vetor de saída.
`,
    complexity: { time: "O(n)", space: "O(1) além da saída" },
    followUps: [
      "Se a divisão fosse permitida, que casos com zero você precisaria tratar à parte?",
      "E se o produto pudesse estourar 64 bits? Como você responderia, por exemplo, módulo 10^9 + 7?",
      "Como adaptar a ideia para responder a soma de todos exceto i, ou o máximo de todos exceto i?"
    ]
  });
}

// ---------------------------------------------------------------------

/** Valores distintos em ordem crescente e suas contagens (ordenação numérica nativa). */
function comprimir(nums: number[]): { valores: number[]; contagens: number[] } {
  const ordenados = Float64Array.from(nums).sort();
  const valores: number[] = [];
  const contagens: number[] = [];
  for (let index = 0; index < ordenados.length; index += 1) {
    if (index > 0 && ordenados[index] === ordenados[index - 1]) contagens[contagens.length - 1] += 1;
    else {
      valores.push(ordenados[index]);
      contagens.push(1);
    }
  }
  return { valores, contagens };
}

function maisFrequentes(nums: number[], k: number): number[] {
  const { valores, contagens } = comprimir(nums);
  // Baldes por contagem; dentro de cada balde os valores já estão em ordem crescente.
  const baldes = new Map<number, number[]>();
  valores.forEach((value, index) => {
    const balde = baldes.get(contagens[index]);
    if (balde) balde.push(value);
    else baldes.set(contagens[index], [value]);
  });
  const resposta: number[] = [];
  for (const contagem of [...baldes.keys()].sort((a, b) => b - a)) {
    for (const value of baldes.get(contagem)!) {
      if (resposta.length === k) return resposta;
      resposta.push(value);
    }
  }
  return resposta;
}

function kMaisFrequentes(): Challenge {
  const random = createRandom(800301);
  const fixos: Array<[number[], number]> = [
    [[5], 1],
    [[1, 1, 2, 2, 3], 2],
    [[4, 4, -1, -1, 7], 2],
    [[9, 8, 7, 6], 4],
    [[9, 8, 7, 6], 1],
    [[3, 3, 3, -2, -2, 0, 0, 0, 0], 2],
    [[-5, -5, 5, 5, 0], 3],
    [[1000000000, -1000000000, 1000000000], 2],
    [[2, 1, 2, 1, 3, 3, 4], 3]
  ];
  const hiddenCases = fixos.map(([nums, k]) => call([nums, k], maisFrequentes(nums, k)));
  for (let index = 0; index < 4; index += 1) {
    const nums = randomArray(random, randomInt(random, 1, 60), -8, 8);
    const distintos = new Set(nums).size;
    const k = randomInt(random, 1, distintos);
    hiddenCases.push(call([nums, k], maisFrequentes(nums, k)));
  }
  const grandes: Array<[GeneratedSpec, number]> = [
    [{ $gen: "ints", n: 200000, min: -10000, max: 10000, seed: 800302 }, 10],
    [{ $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 800303 }, 1000],
    [{ $gen: "concat", parts: [{ $gen: "repeat", n: 100000, value: 7 }, { $gen: "repeat", n: 100000, value: 3 }] }, 2],
    [{ $gen: "concat", parts: [{ $gen: "ints", n: 150000, min: 1, max: 30000, seed: 800306 }, { $gen: "repeat", n: 60, value: -42 }] }, 20]
  ];
  for (const [spec, k] of grandes) hiddenCases.push(call([spec, k], maisFrequentes(gen(spec).value as number[], k)));

  return defineChallenge({
    slug: "k-mais-frequentes",
    title: "Os k valores mais frequentes",
    difficulty: "medium",
    moduleId: VETORES_HASH,
    position: 2,
    description: md`
Implemente §kMaisFrequentes(nums, k)§. A função recebe um vetor de inteiros e um inteiro §k§ e retorna os §k§ valores que mais aparecem em §nums§.

A ordem da resposta é **determinística**:

- primeiro por frequência, da maior para a menor;
- em caso de empate na frequência, pelo valor, do menor para o maior.

**Exemplo:** em §[4, 1, 4, 2, 1, 4]§ o 4 aparece três vezes, o 1 duas e o 2 uma. Com §k = 2§ a resposta é §[4, 1]§.

**Empate:** em §[6, 6, 2, 2, 9]§ com §k = 2§, o 6 e o 2 empatam com duas ocorrências; o menor vem primeiro: §[2, 6]§.

O vetor pode ter 200 000 elementos e dezenas de milhares de valores distintos: contar cada valor percorrendo o vetor inteiro de novo não cabe no tempo.
`,
    constraints: [
      "1 <= n <= 2 * 10^5",
      "-10^9 <= nums[i] <= 10^9",
      "1 <= k <= quantidade de valores distintos de nums",
      "Ordene por frequência decrescente e, no empate, por valor crescente."
    ],
    tags: ["Hash", "Contagem de frequência", "Ordenação"],
    functionSpec: {
      name: "kMaisFrequentes",
      params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
      returns: "int[]"
    },
    publicCases: [call([[4, 1, 4, 2, 1, 4], 2], [4, 1]), call([[2, 3, 2, 3, 1], 2], [2, 3])],
    hiddenCases,
    hints: [
      "Antes de escolher os k primeiros, você precisa saber quantas vezes cada valor aparece — de preferência numa única passada.",
      "Um mapa valor -> contagem resolve a contagem em O(n). Depois, o problema vira ordenar os pares (valor, contagem) com o critério pedido.",
      "Ordene os pares distintos por contagem decrescente e, no empate, por valor crescente, e pegue os k primeiros. Cuidado: Counter.most_common e ordenações só por frequência desempatam pela ordem de aparição, não pelo valor."
    ],
    editorial: md`
## Abordagem ingênua
Para cada valor distinto, contar suas ocorrências percorrendo o vetor todo custa O(n · d), em que d é o número de distintos. Com 200 000 elementos quase todos distintos, isso vira O(n²).

## Abordagem ótima: mapa de frequência + ordenação dos distintos
1. Conte com um mapa §valor -> contagem§ numa passada: O(n).
2. Monte a lista de pares distintos e ordene com a chave (contagem decrescente, valor crescente): O(d log d).
3. Retorne os valores dos k primeiros pares.

O critério de desempate é parte do contrato: sem ele, duas respostas "certas" seriam diferentes. Deixe-o explícito no comparador.

§§§python
from collections import Counter

def kMaisFrequentes(nums, k):
    contagem = Counter(nums)
    ordem = sorted(contagem, key=lambda valor: (-contagem[valor], valor))
    return ordem[:k]
§§§

Em C, ordene uma cópia do vetor com §qsort§, comprima em pares (valor, contagem) percorrendo os blocos iguais e ordene os pares com o comparador acima.

## Custo
Tempo O(n + d log d) — no pior caso, O(n log n); memória O(d) para as contagens.

Um *bucket sort* por frequência (baldes de 1 a n) evita a ordenação quando o desempate não importa, chegando a O(n).
`,
    complexity: { time: "O(n log n)", space: "O(n)" },
    followUps: [
      "Com um heap de tamanho k, qual seria o custo? Quando isso é melhor que ordenar tudo?",
      "Como chegar a O(n) com baldes por frequência? O que fazer com o desempate por valor nesse caso?",
      "E se os números chegassem em fluxo contínuo e você só pudesse guardar uma fração deles?"
    ]
  });
}

// ---------------------------------------------------------------------

function maiorSequencia(nums: number[]): number {
  const { valores } = comprimir(nums);
  let melhor = valores.length ? 1 : 0;
  let atual = 1;
  for (let index = 1; index < valores.length; index += 1) {
    atual = valores[index] === valores[index - 1] + 1 ? atual + 1 : 1;
    melhor = Math.max(melhor, atual);
  }
  return melhor;
}

function maiorSequenciaConsecutiva(): Challenge {
  const random = createRandom(800401);
  const fixos: number[][] = [
    [],
    [7],
    [1, 1, 1],
    [-2, -1, 0, 1],
    [10, 5, 12, 3, 55, 11, 4, 13],
    [1, 3, 5, 7],
    [-1000000000, 1000000000, 999999999],
    [0, -1, 1, 2, -2, 5, 6, 7, 8, 9, 10],
    [3, 2, 2, 1, 1, 0],
    [8, 7, 6, 5, 4, 3, 2, 1]
  ];
  const hiddenCases = fixos.map((nums) => call([nums], maiorSequencia(nums)));
  for (let index = 0; index < 4; index += 1) {
    const nums = randomArray(random, randomInt(random, 1, 80), -40, 40);
    hiddenCases.push(call([nums], maiorSequencia(nums)));
  }
  const grandes: GeneratedSpec[] = [
    { $gen: "perm", n: 200000, seed: 800402 },
    { $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 800403 },
    { $gen: "concat", parts: [{ $gen: "range", n: 100000, start: 1 }, { $gen: "repeat", n: 100000, value: 1 }] },
    { $gen: "range", n: 200000, start: 1000000000, step: -1 }
  ];
  for (const spec of grandes) hiddenCases.push(call([spec], maiorSequencia(gen(spec).value as number[])));

  return defineChallenge({
    slug: "maior-sequencia-consecutiva",
    title: "Maior sequência de consecutivos",
    difficulty: "hard",
    moduleId: VETORES_HASH,
    position: 3,
    isBoss: true,
    description: md`
Implemente §maiorSequenciaConsecutiva(nums)§. A função recebe um vetor de inteiros **fora de ordem** e retorna o tamanho da maior sequência de inteiros consecutivos (x, x+1, x+2, ...) que pode ser formada com os valores do vetor. Os valores podem estar em quaisquer posições.

**Exemplo:** §[20, 4, 101, 1, 3, 2]§ retorna §4§: os valores 1, 2, 3 e 4 estão todos presentes.

Detalhes:

- valores repetidos contam uma vez só: §[1, 2, 2, 3]§ retorna §3§;
- vetor vazio retorna §0§;
- negativos valem normalmente: §[-1, 0, 1]§ forma uma sequência de tamanho 3.

Espera-se O(n). O vetor pode ter 200 000 elementos, e os casos grandes incluem sequências enormes e muitos valores repetidos.
`,
    constraints: [
      "0 <= n <= 2 * 10^5",
      "-10^9 <= nums[i] <= 10^9",
      "Valores repetidos são permitidos e contam uma única vez."
    ],
    tags: ["Hash", "Conjunto"],
    functionSpec: { name: "maiorSequenciaConsecutiva", params: [{ name: "nums", type: "int[]" }], returns: "int" },
    publicCases: [call([[20, 4, 101, 1, 3, 2]], 4), call([[9, 1, -3, 2, 8, 10, 0, -1, 7]], 4)],
    hiddenCases,
    hints: [
      "Ordenar resolve em O(n log n). Para O(n), você precisa responder \"o valor x está no vetor?\" em O(1).",
      "Coloque tudo num conjunto (hash set). Uma sequência só precisa ser medida a partir do seu primeiro elemento: x é início quando x - 1 não está no conjunto.",
      "Percorra o conjunto (não o vetor, que pode ter o mesmo início repetido milhares de vezes); para cada início x, avance enquanto x + 1, x + 2, ... existirem. Cada valor é visitado no máximo duas vezes."
    ],
    editorial: md`
## Abordagem ingênua
Para cada valor x, contar quantos de x+1, x+2, ... existem procurando no vetor custa O(n) por passo — O(n³) no pior caso. Com um conjunto a busca fica O(1), mas medir a sequência **a partir de cada elemento** ainda é O(n²) quando o vetor é uma sequência longa (a partir de 1 anda n passos, a partir de 2 anda n-1, ...).

Ordenar e contar blocos consecutivos (pulando repetidos) funciona em O(n log n) e é uma boa primeira resposta numa entrevista.

## Abordagem ótima: conjunto + só começar pelos inícios
1. Coloque todos os valores num conjunto (isso também elimina os repetidos).
2. Para cada valor §x§ do **conjunto**, se §x - 1§ também está no conjunto, pule: §x§ não é início de sequência.
3. Se §x§ é início, avance §fim§ enquanto §fim + 1§ existir e atualize o melhor tamanho.

Cada valor é tocado uma vez no passo 2 e no máximo uma vez como parte de uma caminhada no passo 3, então o total é O(n).

§§§js
function maiorSequenciaConsecutiva(nums) {
  const conjunto = new Set(nums);
  let melhor = 0;
  for (const x of conjunto) {
    if (conjunto.has(x - 1)) continue; // x não é o começo de uma sequência
    let fim = x;
    while (conjunto.has(fim + 1)) fim++;
    melhor = Math.max(melhor, fim - x + 1);
  }
  return melhor;
}
§§§

Duas armadilhas derrubam soluções nos casos grandes: esquecer a verificação de início (vira O(n²) numa sequência de 200 000) e iterar sobre o vetor em vez do conjunto (o mesmo início repetido 100 000 vezes refaz a mesma caminhada).

## Custo
Tempo O(n) em média; memória O(n) para o conjunto.
`,
    complexity: { time: "O(n)", space: "O(n)" },
    followUps: [
      "Por que a verificação \"x - 1 não está no conjunto\" transforma O(n²) em O(n)? Faça a conta amortizada.",
      "Como você devolveria também a própria sequência (o primeiro e o último valor), e não só o tamanho?",
      "Se a memória fosse muito limitada, qual abordagem você escolheria e qual o custo?"
    ]
  });
}

// =====================================================================
// Módulo: strings e janelas
// =====================================================================

function maiorSemRepeticao(texto: string): number {
  const ultima = new Map<string, number>();
  let inicio = 0;
  let melhor = 0;
  for (let index = 0; index < texto.length; index += 1) {
    const anterior = ultima.get(texto[index]);
    if (anterior !== undefined && anterior >= inicio) inicio = anterior + 1;
    ultima.set(texto[index], index);
    melhor = Math.max(melhor, index - inicio + 1);
  }
  return melhor;
}

function maiorSubstringSemRepeticao(): Challenge {
  const random = createRandom(800501);
  const fixos = [
    "",
    " ",
    "abba",
    "tmmzuxt",
    "dvdf",
    "aab",
    "a b c a",
    'Ele disse "oi" \\ e saiu',
    PRINTABLE,
    PRINTABLE + [...PRINTABLE].reverse().join(""),
    "zzzzzzzzza",
    "abcdefghijklmnopqrstuvwxyza"
  ];
  const hiddenCases = fixos.map((texto) => call([texto], maiorSemRepeticao(texto)));
  for (let index = 0; index < 4; index += 1) {
    let texto = "";
    const tamanho = randomInt(random, 5, 60);
    for (let pos = 0; pos < tamanho; pos += 1) texto += pick(random, [..."abcdefg"]);
    hiddenCases.push(call([texto], maiorSemRepeticao(texto)));
  }
  hiddenCases.push(call([PRINTABLE.repeat(1000)], maiorSemRepeticao(PRINTABLE.repeat(1000))));
  const grandes: GeneratedSpec[] = [
    { $gen: "string", n: 200000, seed: 800502, alphabet: PRINTABLE },
    { $gen: "string", n: 200000, seed: 800503, alphabet: "ab" },
    {
      $gen: "concat",
      parts: [
        { $gen: "string", n: 100000, seed: 800505, alphabet: "xy" },
        PRINTABLE.replace("x", "").replace("y", ""),
        { $gen: "string", n: 100000, seed: 800506, alphabet: "z" }
      ]
    }
  ];
  for (const spec of grandes) hiddenCases.push(call([spec], maiorSemRepeticao(gen(spec).value as string)));

  return defineChallenge({
    slug: "maior-substring-sem-repeticao",
    title: "Maior substring sem repetição",
    difficulty: "medium",
    moduleId: STRINGS_JANELAS,
    position: 0,
    description: md`
Implemente §maiorSubstringSemRepeticao(s)§. A função recebe uma string e retorna o **tamanho** do maior trecho contíguo (substring) em que nenhum caractere aparece duas vezes.

**Exemplo:** em §"xadrez-da"§, o trecho §"xadrez-"§ tem 7 caracteres todos diferentes; acrescentar o §d§ seguinte repetiria o §d§. A resposta é §7§.

Detalhes:

- a string tem apenas caracteres ASCII imprimíveis (códigos 32 a 126): letras, dígitos, pontuação e **espaço**, que conta como caractere;
- maiúsculas e minúsculas são caracteres diferentes;
- string vazia retorna §0§;
- substring é contígua: em §"abca"§, §"abc"§ vale, mas pular letras não.

A string pode ter 200 000 caracteres.
`,
    constraints: [
      "0 <= s.length <= 2 * 10^5",
      "s contém apenas caracteres ASCII imprimíveis (32 a 126).",
      "Retorne apenas o tamanho do maior trecho sem repetição."
    ],
    tags: ["Janela deslizante", "Hash"],
    functionSpec: { name: "maiorSubstringSemRepeticao", params: [{ name: "s", type: "string" }], returns: "int" },
    publicCases: [call(["xadrez-da"], 7), call(["bbbbb"], 1), call(["pwwkew"], 3)],
    hiddenCases,
    hints: [
      "Mantenha uma janela [inicio, fim] que nunca tem repetição e só cresce para a direita. O que fazer quando o novo caractere já está dentro dela?",
      "Guarde a última posição em que cada caractere apareceu. Se o caractere novo foi visto dentro da janela, o início pula para logo depois dessa posição.",
      "Cuidado com posições antigas: o início só pode andar para a frente. Use inicio = max(inicio, ultima[c] + 1) — em \"abba\", ao ler o último a, a última posição de a (0) já está fora da janela."
    ],
    editorial: md`
## Abordagem ingênua
Testar cada início e estender até achar uma repetição custa O(n · Σ), em que Σ é o tamanho do alfabeto (aqui, 95), e testar cada substring do zero custa O(n²) ou O(n³). Funciona, mas refaz o mesmo trabalho a cada início.

## Abordagem ótima: janela deslizante com última posição
A janela §[inicio, i]§ é sempre válida (sem repetição). Para cada novo caractere §c§ na posição §i§:

1. Se §c§ foi visto em §ultima[c] >= inicio§, ele está dentro da janela: mova §inicio§ para §ultima[c] + 1§.
2. Atualize §ultima[c] = i§.
3. A janela tem §i - inicio + 1§ caracteres; guarde o maior.

O detalhe que reprova em entrevista é o passo 1: sem a condição §ultima[c] >= inicio§ (ou o §max§), o início pode **voltar** para trás e a janela passa a conter repetições.

§§§js
function maiorSubstringSemRepeticao(s) {
  const ultima = new Map(); // caractere -> última posição vista
  let inicio = 0, melhor = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (ultima.has(c) && ultima.get(c) >= inicio) inicio = ultima.get(c) + 1;
    ultima.set(c, i);
    melhor = Math.max(melhor, i - inicio + 1);
  }
  return melhor;
}
§§§

Em C, um vetor §int ultima[128]§ iniciado com -1 substitui o mapa.

## Custo
Tempo O(n): cada posição é lida uma vez e o início só avança. Memória O(Σ), constante para o alfabeto ASCII.
`,
    complexity: { time: "O(n)", space: "O(min(n, Σ))" },
    followUps: [
      "E se a pergunta fosse o maior trecho com no máximo k caracteres distintos?",
      "Como devolver o próprio trecho, e não só o tamanho? E o mais à esquerda em caso de empate?",
      "Se a entrada fosse Unicode arbitrário, o que muda na sua estrutura de \"última posição\"?"
    ]
  });
}

// ---------------------------------------------------------------------

function kadane(nums: number[]): number {
  let melhor = nums[0];
  let atual = nums[0];
  for (let index = 1; index < nums.length; index += 1) {
    atual = Math.max(nums[index], atual + nums[index]);
    melhor = Math.max(melhor, atual);
  }
  return melhor;
}

function maiorSomaDeSubvetor(): Challenge {
  const random = createRandom(800601);
  const fixos: number[][] = [
    [5],
    [-3],
    [-5, -2, -9],
    [0, 0, 0],
    [2, -1, 2],
    [-1, 3, -1, 3, -10, 4],
    [1000000000, 1000000000, 1000000000, 1000000000, 1000000000],
    [-1000000000, -1000000000],
    [-2, 0, -1],
    [4, -5, 4, -5, 4],
    [-7, 1, 2, 3, -100, 5]
  ];
  const hiddenCases = fixos.map((nums) => call([nums], kadane(nums)));
  for (let index = 0; index < 5; index += 1) {
    const nums = randomArray(random, randomInt(random, 1, 60), -50, 50);
    hiddenCases.push(call([nums], kadane(nums)));
  }
  const grandes: GeneratedSpec[] = [
    { $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 800602 },
    { $gen: "ints", n: 200000, min: -1000000000, max: -1, seed: 800603 },
    { $gen: "ints", n: 200000, min: 0, max: 1000000000, seed: 800604 },
    {
      $gen: "concat",
      parts: [
        { $gen: "ints", n: 100000, min: -1000, max: -1, seed: 800606 },
        [1000000000],
        { $gen: "ints", n: 99999, min: -1000, max: -1, seed: 800607 }
      ]
    }
  ];
  for (const spec of grandes) hiddenCases.push(call([spec], kadane(gen(spec).value as number[])));

  return defineChallenge({
    slug: "maior-soma-de-subvetor",
    title: "Maior soma de subvetor",
    difficulty: "medium",
    moduleId: STRINGS_JANELAS,
    position: 1,
    description: md`
Implemente §maiorSomaSubvetor(nums)§. A função recebe um vetor de inteiros **não vazio** e retorna a maior soma possível de um **subvetor contíguo e não vazio**.

**Exemplo:** em §[3, -4, 5, -1, 2, -6, 4]§ o melhor trecho é §[5, -1, 2]§, com soma §6§.

Atenção:

- o subvetor precisa ter pelo menos um elemento. Se todos os números forem negativos, a resposta é o maior deles (por exemplo, §[-5, -2, -9]§ retorna §-2§), e não 0;
- com 200 000 elementos de até 10^9 em módulo, a soma pode passar de 2^31: use um inteiro de 64 bits (§long long§ em C).

Espera-se uma única passada, O(n).
`,
    constraints: [
      "1 <= n <= 2 * 10^5",
      "-10^9 <= nums[i] <= 10^9",
      "O retorno pode exceder 32 bits (tipo long)."
    ],
    tags: ["Kadane", "Programação dinâmica"],
    functionSpec: { name: "maiorSomaSubvetor", params: [{ name: "nums", type: "int[]" }], returns: "long" },
    publicCases: [call([[3, -4, 5, -1, 2, -6, 4]], 6), call([[2, 3, -10, 4]], 5)],
    hiddenCases,
    hints: [
      "Pense no melhor subvetor que termina exatamente na posição i. Como ele se relaciona com o melhor que termina em i - 1?",
      "Ou você estende o trecho anterior (atual + nums[i]) ou começa um novo em i (só nums[i]) — o que for maior.",
      "Guarde atual (melhor soma terminando em i) e melhor (maior visto até agora), ambos iniciados com nums[0], não com 0: assim um vetor todo negativo devolve o maior elemento."
    ],
    editorial: md`
## Abordagem ingênua
Somar todos os subvetores §[i, j]§ com somas acumuladas custa O(n²): com 200 000 elementos são 2·10^10 pares.

## Abordagem ótima: algoritmo de Kadane
Seja §atual§ a maior soma de um subvetor que **termina** na posição §i§. Esse subvetor ou estende o melhor que terminava em §i - 1§, ou começa do zero em §i§:

§atual = max(nums[i], atual + nums[i])§

A resposta é o maior §atual§ visto em todas as posições. Um prefixo com soma negativa nunca ajuda: por isso "recomeçar" é o mesmo que descartá-lo.

§§§js
function maiorSomaSubvetor(nums) {
  let atual = nums[0], melhor = nums[0];
  for (let i = 1; i < nums.length; i++) {
    atual = Math.max(nums[i], atual + nums[i]); // estende ou recomeça em i
    melhor = Math.max(melhor, atual);
  }
  return melhor;
}
§§§

Dois erros clássicos: iniciar §melhor§ com 0 (errado quando todos são negativos) e acumular em §int§ de 32 bits em C (estoura com somas acima de 2^31).

## Custo
Tempo O(n); memória O(1).
`,
    complexity: { time: "O(n)", space: "O(1)" },
    followUps: [
      "Como devolver também os índices de início e fim do melhor trecho?",
      "E se o vetor fosse circular (o trecho pode dar a volta do fim para o começo)?",
      "Como resolver com divisão e conquista em O(n log n)? Em que situação essa versão seria útil?"
    ]
  });
}

// ---------------------------------------------------------------------

function palindromoMaisLongo(texto: string): string {
  const codigos = Uint8Array.from(texto, (char) => char.charCodeAt(0));
  const n = codigos.length;
  let inicio = 0;
  let tamanho = n ? 1 : 0;
  for (let centro = 0; centro < n; centro += 1) {
    for (let par = 0; par <= 1; par += 1) {
      let esquerda = centro;
      let direita = centro + par;
      while (esquerda >= 0 && direita < n && codigos[esquerda] === codigos[direita]) {
        esquerda -= 1;
        direita += 1;
      }
      const atual = direita - esquerda - 1;
      if (atual > tamanho || (atual === tamanho && esquerda + 1 < inicio)) {
        inicio = esquerda + 1;
        tamanho = atual;
      }
    }
  }
  return texto.slice(inicio, inicio + tamanho);
}

function maiorPalindromo(): Challenge {
  const random = createRandom(800701);
  const fixos = [
    "x",
    "ab",
    "aa",
    "abcd",
    "cbbd",
    "abacdfgdcaba",
    "racecarxyz",
    "xyzracecar",
    "abaxyzzyxf",
    "aaaabaaa",
    "zzzyzzzzz",
    "abcbaxabccba"
  ];
  const hiddenCases = fixos.map((texto) => call([texto], palindromoMaisLongo(texto)));
  for (const alfabeto of ["ab", "abc", "ab", "abcd"]) {
    let texto = "";
    const tamanho = randomInt(random, 5, 80);
    for (let pos = 0; pos < tamanho; pos += 1) texto += pick(random, [...alfabeto]);
    hiddenCases.push(call([texto], palindromoMaisLongo(texto)));
  }
  const alternado = "ab".repeat(2500);
  hiddenCases.push(call([alternado], palindromoMaisLongo(alternado)));
  let embutido = "";
  for (let pos = 0; pos < 1000; pos += 1) embutido += pick(random, [..."abcdefghij"]);
  let meio = "";
  for (let pos = 0; pos < 1500; pos += 1) meio += pick(random, [..."xyz"]);
  embutido += meio + [...meio].reverse().join("");
  for (let pos = 0; pos < 1000; pos += 1) embutido += pick(random, [..."abcdefghij"]);
  hiddenCases.push(call([embutido], palindromoMaisLongo(embutido)));
  const grandes: GeneratedSpec[] = [
    { $gen: "string", n: 5000, seed: 800702, alphabet: "a" },
    {
      $gen: "concat",
      parts: [
        { $gen: "string", n: 2000, seed: 800703, alphabet: "a" },
        "b",
        { $gen: "string", n: 2999, seed: 800704, alphabet: "a" }
      ]
    },
    { $gen: "string", n: 5000, seed: 800705, alphabet: "ab" },
    { $gen: "string", n: 5000, seed: 800706 },
    { $gen: "concat", parts: [{ $gen: "string", n: 2500, seed: 800707, alphabet: "c" }, { $gen: "string", n: 2500, seed: 800708, alphabet: "d" }] }
  ];
  for (const spec of grandes) hiddenCases.push(call([spec], palindromoMaisLongo(gen(spec).value as string)));

  return defineChallenge({
    slug: "maior-palindromo",
    title: "Maior substring palíndroma",
    difficulty: "hard",
    moduleId: STRINGS_JANELAS,
    position: 2,
    isBoss: true,
    timeLimitMs: 3000,
    description: md`
Implemente §maiorPalindromo(s)§. A função recebe uma string de letras minúsculas e retorna a **maior substring contígua que é um palíndromo** (lida igual de trás para a frente).

Se houver mais de uma com o tamanho máximo, retorne a **mais à esquerda** (a que começa no menor índice).

**Exemplos:**

- §"banana"§ retorna §"anana"§;
- §"abccbx"§ retorna §"bccb"§ (palíndromos de tamanho par também valem);
- §"ab"§ retorna §"a"§: §"a"§ e §"b"§ empatam, e §"a"§ começa antes.

A string tem até 5000 caracteres. Uma solução O(n²) passa com folga; testar cada substring do zero, O(n³), não passa.
`,
    constraints: [
      "1 <= s.length <= 5000",
      "s contém apenas letras minúsculas (a-z).",
      "Em caso de empate no tamanho, retorne a substring que começa mais à esquerda."
    ],
    tags: ["Expansão pelo centro", "Strings"],
    functionSpec: { name: "maiorPalindromo", params: [{ name: "s", type: "string" }], returns: "string" },
    publicCases: [call(["banana"], "anana"), call(["abccbx"], "bccb")],
    hiddenCases,
    hints: [
      "Todo palíndromo tem um centro. Em vez de escolher início e fim, escolha o centro e cresça para os dois lados.",
      "Há 2n - 1 centros possíveis: cada caractere (palíndromos de tamanho ímpar) e cada espaço entre dois caracteres vizinhos (tamanho par).",
      "Para cada centro, expanda enquanto s[esq] == s[dir]; o tamanho é dir - esq - 1. Percorrendo os centros da esquerda para a direita e trocando a resposta só quando o tamanho for estritamente maior, o empate fica com o mais à esquerda."
    ],
    editorial: md`
## Abordagem ingênua
Gerar as O(n²) substrings e verificar cada uma em O(n) custa O(n³). Com n = 5000 e uma string como §"aaaa...a"§ (em que toda substring é palíndroma), são cerca de 2·10^10 comparações.

## Abordagem ótima: expansão pelo centro
Um palíndromo é determinado pelo centro e pelo raio. Para cada um dos 2n - 1 centros:

1. Comece com §esq = dir = i§ (tamanho ímpar) ou §esq = i, dir = i + 1§ (tamanho par).
2. Enquanto §esq >= 0§, §dir < n§ e §s[esq] == s[dir]§, abra: §esq--§, §dir++§.
3. O palíndromo encontrado é §s[esq+1 .. dir-1]§, com tamanho §dir - esq - 1§.

Dois palíndromos de mesmo tamanho têm a mesma paridade; entre centros da mesma paridade, o que está mais à esquerda começa antes. Por isso, trocar a resposta só com §>§ estrito já garante o desempate pedido.

§§§js
function maiorPalindromo(s) {
  let inicio = 0, tamanho = 1;
  const expandir = (esq, dir) => {
    while (esq >= 0 && dir < s.length && s[esq] === s[dir]) { esq--; dir++; }
    if (dir - esq - 1 > tamanho) { inicio = esq + 1; tamanho = dir - esq - 1; }
  };
  for (let i = 0; i < s.length; i++) {
    expandir(i, i);     // centro num caractere
    expandir(i, i + 1); // centro entre dois caracteres
  }
  return s.slice(inicio, inicio + tamanho);
}
§§§

Em C, guarde início e tamanho e só no fim copie o trecho para um buffer novo (com §malloc§ e o §'\0'§ final).

## Custo
Tempo O(n²) no pior caso (cada centro pode expandir O(n)); memória O(1) além da resposta.
`,
    complexity: { time: "O(n²)", space: "O(1)" },
    followUps: [
      "Como a programação dinâmica (tabela eh[i][j]) resolve o mesmo problema? Compare tempo e memória com a expansão.",
      "O algoritmo de Manacher resolve em O(n). Qual é a ideia central dele?",
      "E se a pergunta fosse contar quantas substrings palíndromas existem?"
    ]
  });
}

// =====================================================================
// Módulo: pilhas, busca binária e intervalos
// =====================================================================

const PARES_PARENTESES: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function parentesesOk(texto: string): boolean {
  const pilha: string[] = [];
  for (const char of texto) {
    if (char === "(" || char === "[" || char === "{") pilha.push(char);
    else if (pilha.pop() !== PARES_PARENTESES[char]) return false;
  }
  return pilha.length === 0;
}

function sequenciaValida(random: () => number, tamanho: number): string {
  const fechamento: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const pilha: string[] = [];
  let texto = "";
  for (let index = 0; index < tamanho; index += 1) {
    const restante = tamanho - index;
    if (pilha.length && (pilha.length === restante || random() < 0.5)) texto += pilha.pop();
    else {
      const abre = pick(random, ["(", "[", "{"]);
      pilha.push(fechamento[abre]);
      texto += abre;
    }
  }
  return texto;
}

function parentesesValidos(): Challenge {
  const random = createRandom(800801);
  const fixos = ["", "(", ")", ")(", "([)]", "{[()()]}", "((", "(((())))", "}{", "([]{})", "[(])", "{{}}[]()", "(()"];
  const hiddenCases = fixos.map((texto) => call([texto], parentesesOk(texto)));
  const valida = sequenciaValida(random, 60);
  hiddenCases.push(call([valida], true));
  const trocada = valida.slice(0, 30) + (valida[30] === ")" ? "]" : ")") + valida.slice(31);
  hiddenCases.push(call([trocada], parentesesOk(trocada)));
  const grandeValida = sequenciaValida(random, 100000);
  hiddenCases.push(call([grandeValida], true));
  const bloco = (char: string, n: number, seed: number): GeneratedSpec => ({ $gen: "string", n, seed, alphabet: char });
  const grandes: GeneratedSpec[] = [
    { $gen: "concat", parts: [bloco("(", 100000, 800802), bloco(")", 100000, 800803)] },
    { $gen: "concat", parts: [bloco("(", 50000, 800806), bloco("[", 50000, 800807), bloco(")", 50000, 800808), bloco("]", 50000, 800809)] },
    { $gen: "string", n: 200000, seed: 800812, alphabet: "()[]{}" }
  ];
  for (const spec of grandes) hiddenCases.push(call([spec], parentesesOk(gen(spec).value as string)));

  return defineChallenge({
    slug: "parenteses-validos",
    title: "Parênteses válidos",
    difficulty: "easy",
    moduleId: PILHAS_INTERVALOS,
    position: 0,
    description: md`
Implemente §parentesesValidos(s)§. A função recebe uma string formada apenas pelos caracteres §(§, §)§, §[§, §]§, §{§ e §}§ e retorna §true§ se ela está **bem formada**, e §false§ caso contrário.

Uma string está bem formada quando:

- todo símbolo que abre é fechado pelo símbolo do **mesmo tipo**;
- os fechamentos acontecem na **ordem certa**: o último aberto é o primeiro a ser fechado (§"([])"§ vale; §"([)]"§ não vale);
- nenhum símbolo fecha sem ter sido aberto antes (§")("§ não vale).

A string vazia é bem formada. A entrada pode ter 200 000 caracteres.
`,
    constraints: [
      "0 <= s.length <= 2 * 10^5",
      "s contém apenas os caracteres ()[]{}",
      "Retorne true ou false."
    ],
    tags: ["Pilha"],
    functionSpec: { name: "parentesesValidos", params: [{ name: "s", type: "string" }], returns: "bool" },
    publicCases: [call(["()[]{}"], true), call(["(]"], false), call(["{[]}"], true)],
    hiddenCases,
    hints: [
      "Contar quantos abrem e quantos fecham não basta: \"([)]\" e \")(\" têm as contagens certas e estão errados. A ordem importa.",
      "Quando chega um símbolo que fecha, ele precisa combinar com o último símbolo aberto que ainda não foi fechado. Que estrutura dá acesso rápido ao último inserido?",
      "Use uma pilha: empilhe cada abertura; em cada fechamento, a pilha não pode estar vazia e o topo precisa ser do mesmo tipo (desempilhe). No fim, a pilha precisa estar vazia."
    ],
    editorial: md`
## Abordagem ingênua
Apagar pares vizinhos §()§, §[]§ e §{}§ repetidamente até não sobrar nenhum funciona, mas cada rodada percorre a string inteira: numa entrada como §"((((...))))"§ com 200 000 caracteres são 100 000 rodadas, O(n²).

## Abordagem ótima: pilha
O símbolo que fecha precisa casar com a abertura **mais recente** ainda pendente — exatamente o comportamento LIFO de uma pilha.

1. Para cada caractere que abre, empilhe.
2. Para cada caractere que fecha: se a pilha está vazia ou o topo não é do mesmo tipo, retorne §false§; senão, desempilhe.
3. No fim, retorne §true§ só se a pilha estiver vazia (sobraram aberturas? então é §false§).

§§§js
function parentesesValidos(s) {
  const par = { ")": "(", "]": "[", "}": "{" };
  const pilha = [];
  for (const c of s) {
    if (c === "(" || c === "[" || c === "{") pilha.push(c);
    else if (pilha.pop() !== par[c]) return false; // pilha vazia devolve undefined
  }
  return pilha.length === 0;
}
§§§

Em C, um vetor de §char§ com o tamanho da string e um índice de topo fazem o papel da pilha. Um atalho útil: string de tamanho ímpar nunca é válida.

## Custo
Tempo O(n); memória O(n) no pior caso (só aberturas).
`,
    complexity: { time: "O(n)", space: "O(n)" },
    followUps: [
      "Se houvesse um único tipo de parêntese, dá para resolver com O(1) de memória? Como?",
      "Como você devolveria o tamanho do maior trecho contíguo bem formado?",
      "E se a string também tivesse letras e números misturados, o que muda?"
    ]
  });
}

// ---------------------------------------------------------------------

function buscarRotacionado(nums: number[], alvo: number): number {
  let inicio = 0;
  let fim = nums.length - 1;
  while (inicio <= fim) {
    const meio = (inicio + fim) >> 1;
    if (nums[meio] === alvo) return meio;
    if (nums[inicio] <= nums[meio]) {
      if (nums[inicio] <= alvo && alvo < nums[meio]) fim = meio - 1;
      else inicio = meio + 1;
    } else if (nums[meio] < alvo && alvo <= nums[fim]) inicio = meio + 1;
    else fim = meio - 1;
  }
  return -1;
}

function somaDasBuscas(nums: number[], consultas: number[]): number {
  let soma = 0;
  for (const alvo of consultas) {
    const indice = buscarRotacionado(nums, alvo);
    if (indice >= 0 && nums[indice] !== alvo) throw new Error("busca-em-vetor-rotacionado: referência inconsistente.");
    soma += indice;
  }
  return soma;
}

function rotacionado(base: number[], k: number): number[] {
  return [...base.slice(k), ...base.slice(0, k)];
}

function buscaEmVetorRotacionado(): Challenge {
  const random = createRandom(800901);
  const fixos: Array<[number[], number[]]> = [
    [[5], [5, 1]],
    [[1, 3], [1, 3, 2, 0, 4]],
    [[3, 1], [1, 3, 2]],
    [[30, 40, 50, 10, 20], [10, 20, 30, 40, 50, 35, 5, 60]],
    [[9, 1, 2, 3, 4, 5, 6, 7, 8], [9, 8, 1, 5, 0, 10]],
    [[2, 3, 4, 5, 6, 7, 8, 9, 1], [1, 2, 9, 5]],
    [[-5, -1, 0, 7, -20, -10], [-20, -10, -5, 7, -6, 8]],
    [[1000000000, -1000000000], [-1000000000, 1000000000, 0]]
  ];
  const hiddenCases = fixos.map(([nums, consultas]) => call([nums, consultas], somaDasBuscas(nums, consultas)));
  for (let index = 0; index < 6; index += 1) {
    const n = randomInt(random, 1, 40);
    const base = [...new Set(randomArray(random, n * 2, -100, 100))].sort((a, b) => a - b).slice(0, n);
    const nums = rotacionado(base, randomInt(random, 0, base.length - 1));
    const consultas = randomArray(random, randomInt(random, 1, 30), -105, 105);
    hiddenCases.push(call([nums, consultas], somaDasBuscas(nums, consultas)));
  }
  /** Vetor ordenado start, start + step, ... rotacionado em k: concat de dois range. */
  const grande = (n: number, start: number, step: number, k: number, seed: number): CaseDefinition => {
    const numsSpec: GeneratedSpec = {
      $gen: "concat",
      parts: [
        { $gen: "range", n: n - k, start: start + k * step, step },
        { $gen: "range", n: k, start, step }
      ]
    };
    const consultasSpec: GeneratedSpec = {
      $gen: "ints",
      n: 100000,
      min: Math.max(-1000000000, start - step),
      max: Math.min(1000000000, start + n * step),
      seed
    };
    const nums = gen(numsSpec).value as number[];
    const consultas = gen(consultasSpec).value as number[];
    return call([numsSpec, consultasSpec], somaDasBuscas(nums, consultas));
  };
  hiddenCases.push(
    grande(200000, -1000000000, 3, 123457, 800902),
    grande(200000, 5, 5000, 199999, 800904),
    grande(199999, 0, 1, 99999, 800906)
  );

  return defineChallenge({
    slug: "busca-em-vetor-rotacionado",
    title: "Busca em vetor rotacionado",
    difficulty: "medium",
    moduleId: PILHAS_INTERVALOS,
    position: 1,
    timeLimitMs: 2000,
    description: md`
Um vetor ordenado de forma crescente, **sem valores repetidos**, foi rotacionado: um bloco do começo foi movido, na mesma ordem, para o fim. Por exemplo, §[10, 20, 30, 40, 50, 60]§ rotacionado em 3 posições vira §[40, 50, 60, 10, 20, 30]§. A rotação pode ser zero (o vetor continua ordenado).

Implemente §buscaEmRotacionado(nums, consultas)§. Para **cada** valor de §consultas§, encontre o índice em que ele está em §nums§, ou §-1§ se ele não estiver lá. Retorne a **soma** de todas essas respostas.

**Exemplo:** §nums = [40, 50, 60, 10, 20, 30]§ e §consultas = [10, 60, 35]§: 10 está no índice 3, 60 no índice 2 e 35 não existe (-1). O retorno é §3 + 2 + (-1) = 4§.

Por que a soma? Ela mantém a resposta pequena mesmo com 100 000 consultas e obriga cada consulta a ser rápida: com até 200 000 elementos e 100 000 consultas, a busca linear (O(n) por consulta) não passa no tempo. Espera-se uma **busca binária adaptada**, O(log n) por consulta, sem pré-processar o vetor.

A soma pode passar de 2^31: use um inteiro de 64 bits (§long long§ em C).
`,
    constraints: [
      "1 <= n <= 2 * 10^5 e 1 <= consultas.length <= 10^5",
      "-10^9 <= nums[i], consultas[j] <= 10^9",
      "nums não tem valores repetidos e é um vetor crescente rotacionado (rotação entre 0 e n - 1).",
      "Retorne a soma dos índices encontrados, contando -1 para cada consulta ausente (tipo long)."
    ],
    tags: ["Busca binária"],
    functionSpec: {
      name: "buscaEmRotacionado",
      params: [{ name: "nums", type: "int[]" }, { name: "consultas", type: "int[]" }],
      returns: "long"
    },
    publicCases: [
      call([[40, 50, 60, 10, 20, 30], [10, 60, 35]], 4),
      call([[7, 9, 2, 4], [9, 7, 4, 5]], 3)
    ],
    hiddenCases,
    hints: [
      "Corte o vetor ao meio em qualquer ponto: pelo menos uma das duas metades está perfeitamente ordenada. Como descobrir qual?",
      "Compare nums[inicio] com nums[meio]: se nums[inicio] <= nums[meio], a metade esquerda [inicio, meio] está ordenada; senão, a direita [meio, fim] está.",
      "Numa metade ordenada, dá para saber em O(1) se o alvo está dentro dela (entre as pontas). Se estiver, continue nela; se não, continue na outra. Use <= na comparação: quando inicio == meio, a metade esquerda tem um elemento só."
    ],
    editorial: md`
## Abordagem ingênua
Percorrer o vetor para cada consulta custa O(n) por consulta, O(n · q) no total: 2·10^10 comparações nos casos grandes. Um mapa valor -> índice também é rápido, mas usa O(n) de memória e foge do que a entrevista quer avaliar: a busca binária.

## Abordagem ótima: busca binária na metade ordenada
Em cada passo, com §inicio§, §fim§ e §meio§:

1. Se §nums[meio] == alvo§, achou.
2. Se §nums[inicio] <= nums[meio]§, a metade esquerda está ordenada. Se §nums[inicio] <= alvo < nums[meio]§, siga para a esquerda (§fim = meio - 1§); senão, para a direita (§inicio = meio + 1§).
3. Senão, a metade direita está ordenada. Se §nums[meio] < alvo <= nums[fim]§, siga para a direita; senão, para a esquerda.

Cada passo descarta metade do intervalo, então cada consulta custa O(log n).

§§§js
function buscar(nums, alvo) {
  let inicio = 0, fim = nums.length - 1;
  while (inicio <= fim) {
    const meio = (inicio + fim) >> 1;
    if (nums[meio] === alvo) return meio;
    if (nums[inicio] <= nums[meio]) { // esquerda ordenada
      if (nums[inicio] <= alvo && alvo < nums[meio]) fim = meio - 1;
      else inicio = meio + 1;
    } else { // direita ordenada
      if (nums[meio] < alvo && alvo <= nums[fim]) inicio = meio + 1;
      else fim = meio - 1;
    }
  }
  return -1;
}

function buscaEmRotacionado(nums, consultas) {
  let soma = 0;
  for (const alvo of consultas) soma += buscar(nums, alvo);
  return soma;
}
§§§

O erro mais comum é usar §<§ em vez de §<=§ no passo 2: com dois elementos (§inicio == meio§), a metade esquerda de um elemento é tratada como "não ordenada" e o alvo pode ser descartado.

## Custo
Tempo O(q log n); memória O(1).
`,
    complexity: { time: "O(log n) por consulta", space: "O(1)" },
    followUps: [
      "Como encontrar o ponto de rotação (o índice do menor elemento) com busca binária?",
      "E se o vetor pudesse ter valores repetidos? O que acontece no pior caso?",
      "Por que um mapa valor -> índice não seria a resposta que o entrevistador espera, mesmo sendo rápido?"
    ]
  });
}

// ---------------------------------------------------------------------

/**
 * União de intervalos fechados por varredura: inícios e fins ordenados em
 * separado (ordenação numérica nativa). Num mesmo ponto, inícios vêm antes
 * dos fins, então intervalos que só se tocam se unem.
 */
function mesclar(intervalos: number[][]): number[][] {
  const inicios = Float64Array.from(intervalos, (item) => item[0]).sort();
  const fins = Float64Array.from(intervalos, (item) => item[1]).sort();
  const resultado: number[][] = [];
  let abertos = 0;
  let comeco = 0;
  for (let i = 0, j = 0; j < fins.length; ) {
    if (i < inicios.length && inicios[i] <= fins[j]) {
      if (abertos === 0) comeco = inicios[i];
      abertos += 1;
      i += 1;
    } else {
      abertos -= 1;
      if (abertos === 0) resultado.push([comeco, fins[j]]);
      j += 1;
    }
  }
  return resultado;
}

function mesclarIntervalos(): Challenge {
  const random = createRandom(801001);
  const fixos: number[][][] = [
    [],
    [[5, 5]],
    [[1, 4], [4, 5]],
    [[1, 10], [2, 3], [4, 5]],
    [[6, 8], [1, 3], [2, 4], [9, 10]],
    [[3, 3], [3, 3]],
    [[-5, -1], [-1, 0], [2, 2]],
    [[1, 2], [3, 4]],
    [[2, 6], [1, 1]],
    [[0, 0], [1, 1], [0, 1]],
    [[-1000000000, 0], [0, 1000000000]],
    [[10, 20], [0, 5], [5, 10], [21, 30]]
  ];
  const hiddenCases = fixos.map((intervalos) => call([intervalos], mesclar(intervalos)));
  for (let index = 0; index < 5; index += 1) {
    const intervalos = Array.from({ length: randomInt(random, 1, 25) }, () => {
      const inicio = randomInt(random, -50, 50);
      return [inicio, inicio + randomInt(random, 0, 8)];
    });
    hiddenCases.push(call([intervalos], mesclar(intervalos)));
  }
  // Literais grandes (o gerador não produz intervalos disjuntos): ~12 000 intervalos.
  const espalhados = Array.from({ length: 12000 }, () => {
    const inicio = randomInt(random, 0, 40000);
    return [inicio, inicio + randomInt(random, 0, 10)];
  });
  hiddenCases.push(call([espalhados], mesclar(espalhados)));
  const engolidos = [...shuffle(random, Array.from({ length: 12000 }, (_, index) => [2 * index, 2 * index])), [0, 24000]];
  hiddenCases.push(call([engolidos], mesclar(engolidos)));
  const grandes: GeneratedSpec[] = [
    { $gen: "edges", n: 200001, seed: 801002, tree: true },
    { $gen: "concat", parts: [{ $gen: "repeat", n: 100000, value: [150000, 150000] }, { $gen: "edges", n: 100000, seed: 801005, tree: true }] }
  ];
  for (const spec of grandes) hiddenCases.push(call([spec], mesclar(gen(spec).value as number[][])));

  return defineChallenge({
    slug: "mesclar-intervalos",
    title: "Mesclar intervalos",
    difficulty: "medium",
    moduleId: PILHAS_INTERVALOS,
    position: 2,
    isBoss: true,
    description: md`
Implemente §mesclarIntervalos(intervalos)§. A função recebe uma lista de intervalos fechados §[inicio, fim]§ (com §inicio <= fim§), **em qualquer ordem**, e retorna a lista de intervalos que resulta de juntar todos os que se sobrepõem.

Regras:

- dois intervalos que compartilham pelo menos um ponto viram um só. Isso inclui os que **apenas se tocam**: §[1, 3]§ e §[3, 5]§ viram §[1, 5]§;
- §[1, 2]§ e §[3, 4]§ **não** se tocam (não há ponto em comum) e continuam separados;
- a resposta deve vir **ordenada pelo início**, sem intervalos sobrepostos;
- lista vazia retorna lista vazia.

**Exemplo:** §[[8, 10], [1, 3], [2, 6], [15, 18]]§ retorna §[[1, 6], [8, 10], [15, 18]]§.

A entrada pode ter 200 000 intervalos: comparar todos os pares, O(n²), não cabe no tempo.
`,
    constraints: [
      "0 <= n <= 2 * 10^5",
      "-10^9 <= inicio <= fim <= 10^9",
      "A entrada pode vir fora de ordem; a saída deve vir ordenada pelo início.",
      "Intervalos que apenas se tocam (fim de um igual ao início do outro) se unem."
    ],
    tags: ["Intervalos", "Ordenação"],
    functionSpec: { name: "mesclarIntervalos", params: [{ name: "intervalos", type: "int[][]" }], returns: "int[][]" },
    publicCases: [
      call([[[1, 3], [2, 6], [8, 10], [15, 18]]], [[1, 6], [8, 10], [15, 18]]),
      call([[[1, 3], [3, 5], [7, 7]]], [[1, 5], [7, 7]])
    ],
    hiddenCases,
    hints: [
      "Se os intervalos estivessem ordenados pelo início, os que se sobrepõem ficariam lado a lado. O que isso permite?",
      "Ordene pelo início. Então cada intervalo novo só pode se juntar ao último intervalo do resultado — nunca a um anterior.",
      "Percorra os ordenados: se inicio <= fim do último do resultado (<=, porque encostar também une), estenda esse fim com max(fim do último, fim atual); senão, comece um intervalo novo. Não esqueça do max: [1, 10] seguido de [2, 3] não pode encolher para [1, 3]."
    ],
    editorial: md`
## Abordagem ingênua
Comparar cada par de intervalos e juntar os que se sobrepõem, repetindo até nada mudar, custa pelo menos O(n²) por rodada. Com 200 000 intervalos são 2·10^10 comparações.

## Abordagem ótima: ordenar pelo início e varrer
Depois de ordenar pelo início, se um intervalo não encosta no último intervalo mesclado, ele também não encosta em nenhum anterior (todos terminam antes). Então basta olhar o último:

1. Ordene os intervalos por §inicio§.
2. Para cada §[a, b]§: se o resultado está vazio ou §a > ultimo.fim§, acrescente §[a, b]§.
3. Senão, §ultimo.fim = max(ultimo.fim, b)§.

§§§python
def mesclarIntervalos(intervalos):
    resultado = []
    for inicio, fim in sorted(intervalos):
        if resultado and inicio <= resultado[-1][1]:
            resultado[-1][1] = max(resultado[-1][1], fim)  # encosta ou sobrepõe
        else:
            resultado.append([inicio, fim])
    return resultado
§§§

Em C, ordene um vetor de ponteiros para as linhas com §qsort§ (comparando o início), aloque o resultado com até n linhas e preencha §*returnSize§ e §*returnColumnSizes§ (todas as linhas com 2 colunas).

## Custo
Tempo O(n log n), dominado pela ordenação; a varredura é O(n). Memória O(n) para a saída (e para a ordenação).
`,
    complexity: { time: "O(n log n)", space: "O(n)" },
    followUps: [
      "Como inserir um intervalo novo numa lista já mesclada e ordenada, em O(n) e sem ordenar de novo?",
      "Qual o número mínimo de salas de reunião para atender todos os intervalos ao mesmo tempo?",
      "E se os intervalos chegassem um por vez (fluxo) e você precisasse manter a lista mesclada sempre atualizada?"
    ]
  });
}

// =====================================================================
// Módulo: listas encadeadas
// =====================================================================

const NO_NEW_NODES: Record<"javascript" | "python" | "c", SourceRule> = {
  javascript: {
    kind: "forbid",
    pattern: "\\bnew\\s+ListNode\\b",
    message: "Inverta reaproveitando os nós que já existem: não crie nós novos (new ListNode)."
  },
  python: {
    kind: "forbid",
    pattern: "\\bListNode\\s*\\(",
    message: "Inverta reaproveitando os nós que já existem: não crie nós novos (ListNode(...))."
  },
  c: {
    kind: "forbid",
    pattern: "\\b(malloc|calloc|realloc)\\s*\\(",
    message: "Inverta reaproveitando os nós que já existem: não aloque nós novos (malloc, calloc ou realloc)."
  }
};

function inverterListaEncadeada(): Challenge {
  const random = createRandom(801101);
  const fixos: number[][] = [[], [7], [1, 2], [3, 3, 3], [-1, 0, 1], [0, -5, 0, -5], [1000000000, -1000000000]];
  const hiddenCases = fixos.map((valores) => call([valores], [...valores].reverse()));
  for (let index = 0; index < 6; index += 1) {
    const valores = randomArray(random, randomInt(random, 2, 50), -100, 100);
    hiddenCases.push(call([valores], [...valores].reverse()));
  }
  const grandes: GeneratedSpec[] = [
    { $gen: "ints", n: 5000, min: -1000, max: 1000, seed: 801102 },
    { $gen: "range", n: 5000, start: 1 },
    { $gen: "perm", n: 5000, seed: 801103 }
  ];
  for (const spec of grandes) hiddenCases.push(call([spec], [...(gen(spec).value as number[])].reverse()));

  return defineChallenge({
    slug: "inverter-lista-encadeada",
    title: "Inverter lista encadeada",
    difficulty: "easy",
    moduleId: LISTAS,
    position: 0,
    description: md`
Implemente §inverterLista(head)§. A função recebe o primeiro nó de uma lista simplesmente encadeada (ou §null§/§None§/§NULL§, se a lista for vazia) e retorna o primeiro nó da lista **invertida**.

Cada nó tem os campos §val§ e §next§ (em C, §struct ListNode§ com §val§ e §next§; o juiz já define a estrutura). Nos exemplos, a lista aparece como vetor: §[4, 8, 15, 16]§ significa §4 -> 8 -> 15 -> 16 -> null§.

**Exemplo:** §[4, 8, 15, 16]§ vira §[16, 15, 8, 4]§.

**Regra:** reaproveite os nós existentes, apenas trocando os ponteiros §next§. Criar nós novos (§new ListNode§, §ListNode(...)§ ou §malloc§) é proibido pela correção.
`,
    constraints: [
      "0 <= número de nós <= 5000",
      "-10^9 <= val <= 10^9",
      "Proibido criar nós novos: reorganize os ponteiros next."
    ],
    tags: ["Lista encadeada", "Três ponteiros"],
    functionSpec: { name: "inverterLista", params: [{ name: "head", type: "list" }], returns: "list" },
    languages: [
      language("javascript", [NO_NEW_NODES.javascript]),
      language("python", [NO_NEW_NODES.python]),
      language("c", [NO_NEW_NODES.c])
    ],
    publicCases: [call([[4, 8, 15, 16]], [16, 15, 8, 4]), call([[9, -2]], [-2, 9])],
    hiddenCases,
    hints: [
      "Inverter é fazer cada nó apontar para quem vinha antes dele. Mas, ao trocar atual.next, você perde o caminho para o resto da lista.",
      "Use três referências: anterior (começa em null), atual (começa em head) e uma terceira, o próximo, que guarda atual.next antes da troca.",
      "Em cada passo: guarde o próximo (atual.next); faça atual.next = anterior; avance anterior para atual e atual para o próximo guardado. Quando atual for null, anterior é a nova cabeça."
    ],
    editorial: md`
## Abordagem ingênua
Copiar os valores para um vetor e montar uma lista nova ao contrário funciona, mas gasta O(n) de memória extra e cria nós novos (proibido aqui). Outra ideia ingênua — ir até o fim da lista para buscar o último, várias vezes — custa O(n²).

## Abordagem ótima: três ponteiros
Percorra a lista uma vez virando cada seta para trás:

1. §anterior = null§, §atual = head§.
2. Enquanto §atual§ existir: guarde §proximo = atual.next§; faça §atual.next = anterior§; avance §anterior = atual§ e §atual = proximo§.
3. Retorne §anterior§.

A lista vazia e a lista de um nó saem certas sem nenhum §if§ especial.

§§§c
struct ListNode* inverterLista(struct ListNode* head) {
    struct ListNode *anterior = NULL, *atual = head;
    while (atual) {
        struct ListNode *proximo = atual->next; /* guarda o resto */
        atual->next = anterior;                  /* vira a seta */
        anterior = atual;
        atual = proximo;
    }
    return anterior;
}
§§§

Também existe a versão recursiva: inverta o resto da lista e faça §head.next.next = head§ e §head.next = null§. Ela usa O(n) de pilha de chamadas.

## Custo
Tempo O(n); memória O(1) na versão iterativa.
`,
    complexity: { time: "O(n)", space: "O(1)" },
    followUps: [
      "Escreva a versão recursiva. Quanto de memória ela usa e por quê?",
      "Como inverter apenas o trecho entre as posições m e n, numa única passada?",
      "Como inverter a lista em grupos de k nós?"
    ]
  });
}

// ---------------------------------------------------------------------

function detectarCiclo(): Challenge {
  const random = createRandom(801201);
  const fixos: Array<[number[], number]> = [
    [[], -1],
    [[1], -1],
    [[1], 0],
    [[1, 2], 0],
    [[1, 2], 1],
    [[1, 2], -1],
    [[5, 5, 5, 5], -1],
    [[3, 2, 0, -4], 1],
    [[7, 7, 7], 2],
    [[1, 2, 3, 4, 5, 6], 3]
  ];
  const hiddenCases = fixos.map(([valores, pos]) => call([valores, pos], pos >= 0));
  for (let index = 0; index < 4; index += 1) {
    const valores = randomArray(random, randomInt(random, 1, 60), -5, 5);
    const pos = random() < 0.5 ? -1 : randomInt(random, 0, valores.length - 1);
    hiddenCases.push(call([valores, pos], pos >= 0));
  }
  const grandes: Array<[GeneratedSpec, number]> = [
    [{ $gen: "ints", n: 200000, min: -100000, max: 100000, seed: 801202 }, -1],
    [{ $gen: "range", n: 200000, start: 0 }, 0],
    [{ $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 801203 }, 199999],
    [{ $gen: "repeat", n: 200000, value: 1 }, -1]
  ];
  for (const [spec, pos] of grandes) hiddenCases.push(call([spec, pos], pos >= 0));

  return defineChallenge({
    slug: "detectar-ciclo",
    title: "Detectar ciclo em lista encadeada",
    difficulty: "medium",
    moduleId: LISTAS,
    position: 1,
    description: md`
Implemente §temCiclo(head)§. A função recebe o primeiro nó de uma lista simplesmente encadeada e retorna §true§ se a lista tem um **ciclo** — isto é, se seguindo §next§ a partir de §head§ você volta a um nó já visitado — e §false§ se a lista termina em §null§.

**Como os casos são descritos:** cada caso traz dois argumentos, a lista como vetor e um inteiro §pos§. O juiz monta a lista e, se §pos >= 0§, liga o §next§ do último nó ao nó de índice §pos§ (se §pos = -1§, não há ciclo). **A função recebe apenas §head§**: §pos§ é usado só pelo juiz para montar a lista e não é passado para você.

**Exemplo:** §[3, 1, 4, 1]§ com §pos = 2§ forma §3 -> 1 -> 4 -> 1 -> (volta ao 4)§: retorne §true§.

Os valores podem se repetir — dois nós com o mesmo §val§ continuam sendo nós diferentes. Não modifique a lista. A lista pode ter 200 000 nós.
`,
    constraints: [
      "0 <= número de nós <= 2 * 10^5",
      "-10^9 <= val <= 10^9",
      "pos é -1 ou um índice válido da lista; ele não é passado para a função.",
      "Não altere a lista."
    ],
    tags: ["Lista encadeada", "Lebre e tartaruga"],
    functionSpec: { name: "temCiclo", params: [{ name: "head", type: "list" }], returns: "bool", cycleParam: "head" },
    publicCases: [call([[3, 1, 4, 1], 2], true), call([[8, 6], -1], false)],
    hiddenCases,
    hints: [
      "Comparar valores não funciona: nós diferentes podem ter o mesmo val. O que identifica um nó é a referência (o endereço).",
      "Guardar as referências visitadas num conjunto (hash set) resolve em O(n) de tempo e de memória. Dá para usar O(1) de memória?",
      "Use dois ponteiros: a tartaruga anda um nó por vez e a lebre anda dois. Se a lebre chegar a null, não há ciclo; se as duas se encontrarem, há."
    ],
    editorial: md`
## Abordagem ingênua
Guardar os nós visitados numa lista e procurar cada novo nó nela custa O(n²). Contar passos até um limite ("se passar de 10 000 passos, deve ter ciclo") simplesmente erra em listas longas.

Um conjunto de referências visitadas resolve em O(n) de tempo, mas usa O(n) de memória.

## Abordagem ótima: lebre e tartaruga (Floyd)
Dois ponteiros partem de §head§: §lento§ anda um passo e §rapido§ anda dois.

- Sem ciclo, §rapido§ chega ao fim (§null§) e a resposta é §false§.
- Com ciclo, os dois acabam presos nele; a cada rodada a distância entre eles diminui em 1, então §rapido§ alcança §lento§ em no máximo o tamanho do ciclo de rodadas depois de ambos entrarem nele.

§§§js
function temCiclo(head) {
  let lento = head, rapido = head;
  while (rapido && rapido.next) {
    lento = lento.next;
    rapido = rapido.next.next;
    if (lento === rapido) return true; // compara referências, não valores
  }
  return false;
}
§§§

Em C, a comparação é entre ponteiros (§lento == rapido§); em Python, use §is§.

## Custo
Tempo O(n); memória O(1).
`,
    complexity: { time: "O(n)", space: "O(1)" },
    followUps: [
      "Resolva com O(1) de memória (Floyd). Por que a lebre nunca \"pula\" a tartaruga sem encontrá-la?",
      "Como encontrar o nó onde o ciclo começa, ainda com O(1) de memória?",
      "Como calcular o tamanho do ciclo depois de detectar o encontro?"
    ]
  });
}

// ---------------------------------------------------------------------

const NO_ALLOC_MERGE: SourceRule = {
  kind: "forbid",
  pattern: "\\b(malloc|calloc|realloc)\\s*\\(",
  message: "Mescle reaproveitando os nós das duas listas: não aloque nós novos (use um nó sentinela na pilha, por exemplo struct ListNode sentinela;)."
};

function mesclarListasOrdenadas(): Challenge {
  const random = createRandom(801301);
  const mesclarValores = (a: number[], b: number[]) => [...a, ...b].sort((x, y) => x - y);
  const fixos: Array<[number[], number[]]> = [
    [[], []],
    [[], [5]],
    [[5], []],
    [[1, 1, 1], [1, 1]],
    [[-3, 0, 7], [-5, 10]],
    [[1, 2, 3], [4, 5, 6]],
    [[4, 5, 6], [1, 2, 3]],
    [[2], [1]],
    [[-1000000000, 1000000000], [0]]
  ];
  const hiddenCases = fixos.map(([a, b]) => call([a, b], mesclarValores(a, b)));
  for (let index = 0; index < 6; index += 1) {
    const a = randomArray(random, randomInt(random, 0, 40), -60, 60).sort((x, y) => x - y);
    const b = randomArray(random, randomInt(random, 0, 40), -60, 60).sort((x, y) => x - y);
    hiddenCases.push(call([a, b], mesclarValores(a, b)));
  }
  const grandes: Array<[GeneratedSpec, GeneratedSpec]> = [
    [
      { $gen: "ints", n: 2500, min: -10000, max: 10000, seed: 801302, sorted: "asc" },
      { $gen: "ints", n: 2500, min: -10000, max: 10000, seed: 801303, sorted: "asc" }
    ],
    [{ $gen: "range", n: 5000, start: -2500 }, { $gen: "range", n: 0 }],
    [{ $gen: "range", n: 2500, start: 0, step: 2 }, { $gen: "range", n: 2500, start: 1, step: 2 }],
    [{ $gen: "repeat", n: 2500, value: 0 }, { $gen: "repeat", n: 2500, value: 0 }],
    [
      { $gen: "ints", n: 4000, min: 0, max: 5000, seed: 801304, sorted: "asc" },
      { $gen: "ints", n: 1000, min: -5000, max: 0, seed: 801305, sorted: "asc" }
    ]
  ];
  for (const [specA, specB] of grandes) {
    hiddenCases.push(call([specA, specB], mesclarValores(gen(specA).value as number[], gen(specB).value as number[])));
  }

  return defineChallenge({
    slug: "mesclar-listas-ordenadas",
    title: "Mesclar duas listas ordenadas",
    difficulty: "medium",
    moduleId: LISTAS,
    position: 2,
    isBoss: true,
    description: md`
Implemente §mesclarListas(l1, l2)§. A função recebe os primeiros nós de duas listas simplesmente encadeadas, cada uma **em ordem não decrescente**, e retorna o primeiro nó de uma única lista, também em ordem não decrescente, com todos os nós das duas.

A lista resultante deve ser formada **reaproveitando os nós** de §l1§ e §l2§, apenas religando os ponteiros §next§ — sem copiar valores para nós novos. Em C, alocar memória (§malloc§/§calloc§) é proibido pela correção; um nó sentinela declarado como variável local (§struct ListNode sentinela;§) resolve.

Qualquer uma das listas (ou as duas) pode ser vazia. Valores repetidos são permitidos.

**Exemplo:** §[1, 4, 6]§ e §[2, 4, 5, 9]§ resultam em §[1, 2, 4, 4, 5, 6, 9]§.
`,
    constraints: [
      "0 <= número de nós em cada lista <= 5000 (no máximo 5000 no total)",
      "-10^9 <= val <= 10^9",
      "l1 e l2 estão em ordem não decrescente.",
      "Reaproveite os nós; em C, malloc/calloc/realloc são proibidos."
    ],
    tags: ["Lista encadeada", "Nó sentinela"],
    functionSpec: {
      name: "mesclarListas",
      params: [{ name: "l1", type: "list" }, { name: "l2", type: "list" }],
      returns: "list"
    },
    languages: ["javascript", "python", language("c", [NO_ALLOC_MERGE])],
    publicCases: [call([[1, 4, 6], [2, 4, 5, 9]], [1, 2, 4, 4, 5, 6, 9]), call([[], [3, 8]], [3, 8])],
    hiddenCases,
    hints: [
      "Olhe só para as cabeças das duas listas: a menor delas é, com certeza, o próximo nó da resposta.",
      "Para não tratar a primeira inserção como caso especial, comece com um nó sentinela (falso) e um ponteiro cauda que aponta para o último nó já ligado.",
      "Enquanto as duas listas tiverem nós, ligue cauda.next ao menor dos dois e avance essa lista. Quando uma acabar, ligue cauda.next ao que sobrou da outra — não esqueça de nenhum dos dois lados. Retorne sentinela.next."
    ],
    editorial: md`
## Abordagem ingênua
Copiar os valores das duas listas para um vetor, ordenar e criar uma lista nova funciona em O((n + m) log(n + m)), mas ignora que as listas já estão ordenadas e cria nós novos (em C, proibido aqui).

## Abordagem ótima: intercalação com nó sentinela
É a etapa de "merge" do merge sort, só que com ponteiros:

1. Crie um nó sentinela e faça §cauda§ apontar para ele.
2. Enquanto §l1§ e §l2§ não forem nulos: ligue §cauda.next§ ao menor (em empate, tanto faz; pegar de §l1§ mantém a ordem estável), avance essa lista e avance §cauda§.
3. Ligue §cauda.next§ à lista que sobrou (uma delas já é nula).
4. Retorne §sentinela.next§.

O sentinela elimina o §if§ "a lista resultante ainda está vazia?".

§§§c
struct ListNode* mesclarListas(struct ListNode* l1, struct ListNode* l2) {
    struct ListNode sentinela = {0, NULL};
    struct ListNode *cauda = &sentinela;
    while (l1 && l2) {
        if (l1->val <= l2->val) { cauda->next = l1; l1 = l1->next; }
        else                    { cauda->next = l2; l2 = l2->next; }
        cauda = cauda->next;
    }
    cauda->next = l1 ? l1 : l2; /* o resto já está ordenado */
    return sentinela.next;
}
§§§

## Custo
Tempo O(n + m): cada nó é ligado uma vez. Memória O(1) além dos nós já existentes (a versão recursiva usa O(n + m) de pilha).
`,
    complexity: { time: "O(n + m)", space: "O(1)" },
    followUps: [
      "Como mesclar k listas ordenadas? Compare mesclar uma a uma com usar um heap.",
      "Escreva a versão recursiva. Qual o risco dela para listas muito longas?",
      "Como usar esta função para ordenar uma lista encadeada inteira em O(n log n)?"
    ]
  });
}

let cache: Challenge[] | null = null;

/**
 * Os casos grandes custam para gerar; a construção é determinística, então
 * ela é feita uma vez e cada chamada recebe uma cópia independente.
 */
export function buildEntrevistasLinearesChallenges(): Challenge[] {
  cache ??= buildAll();
  return structuredClone(cache);
}

function buildAll(): Challenge[] {
  return [
    doisNumerosAlvo(),
    produtoExcetoAPosicao(),
    kMaisFrequentes(),
    maiorSequenciaConsecutiva(),
    maiorSubstringSemRepeticao(),
    maiorSomaDeSubvetor(),
    maiorPalindromo(),
    parentesesValidos(),
    buscaEmVetorRotacionado(),
    mesclarIntervalos(),
    inverterListaEncadeada(),
    detectarCiclo(),
    mesclarListasOrdenadas()
  ];
}
