import type { Challenge, SourceRule } from "../../domain/types.js";
import { call, createRandom, defineChallenge, gen, language, randomArray, randomInt, randomWord, type CaseDefinition } from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Algoritmos e Padrões", módulos de dois ponteiros, janela deslizante,
 * prefixo acumulado e guloso. Todos no modo função (JavaScript, Python e C).
 * Aqui a complexidade é o ponto: sempre que o padrão troca O(n²) por O(n), há
 * casos gerados com n ~ 2·10^5 que derrubam a solução ingênua por tempo.
 * Sementes na faixa 600000–699999.
 */

// ---------- Utilidades ----------
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const ascending = (a: number, b: number) => a - b;

function distinctSorted(random: () => number, n: number, min: number, max: number): number[] {
  const seen = new Set<number>();
  while (seen.size < n) seen.add(randomInt(random, min, max));
  return [...seen].sort(ascending);
}

function randomText(random: () => number, n: number, alphabet: string): string {
  return randomWord(random, n, n, alphabet);
}

// =====================================================================
// Dois ponteiros
// =====================================================================

function contarPares(nums: number[], alvo: number): number {
  const frequencia = new Map<number, number>();
  let pares = 0;
  for (const valor of nums) {
    pares += frequencia.get(alvo - valor) ?? 0;
    frequencia.set(valor, (frequencia.get(valor) ?? 0) + 1);
  }
  return pares;
}

function parComSomaRef(nums: number[], alvo: number): number[] {
  let esquerda = 0;
  let direita = nums.length - 1;
  while (esquerda < direita) {
    const soma = nums[esquerda] + nums[direita];
    if (soma === alvo) return [esquerda, direita];
    if (soma < alvo) esquerda += 1;
    else direita -= 1;
  }
  throw new Error("par-com-soma-no-ordenado: caso sem par");
}

function parComSomaNoOrdenado(): Challenge {
  const random = createRandom(600100);
  const caso = (nums: number[], alvo: number) => {
    if (contarPares(nums, alvo) !== 1) throw new Error(`par-com-soma-no-ordenado: resposta não única para alvo ${alvo}`);
    return call([nums, alvo], parComSomaRef(nums, alvo));
  };
  const aleatorio = (n: number, min: number, max: number) => {
    for (;;) {
      const nums = distinctSorted(random, n, min, max);
      const i = randomInt(random, 0, n - 2);
      const j = randomInt(random, i + 1, n - 1);
      const alvo = nums[i] + nums[j];
      if (contarPares(nums, alvo) === 1) return call([nums, alvo], [i, j]);
    }
  };
  // Casos grandes: múltiplos de 4 com dois valores ≡ 1 (mod 4) plantados.
  // Só a soma dos dois plantados é ≡ 2 (mod 4), então a resposta é única.
  const grande = (parts: unknown[], alvo: number) => {
    const nums = gen({ $gen: "concat", parts });
    return { input: JSON.stringify([nums.spec, alvo]), output: JSON.stringify(parComSomaRefChecked(nums.value, alvo)) };
  };
  const parComSomaRefChecked = (nums: number[], alvo: number) => {
    // Unicidade garantida pela construção (mod 4); aqui só a ordem é conferida.
    for (let index = 1; index < nums.length; index += 1) if (nums[index - 1] > nums[index]) throw new Error("vetor fora de ordem");
    return parComSomaRef(nums, alvo);
  };

  const hidden: CaseDefinition[] = [
    caso([-5, 5], 0),
    caso([1, 2, 2, 9], 4),
    caso([-10, -3, 0, 4, 8], -13),
    caso([-10, -3, 0, 4, 8], 12),
    caso([0, 0], 0),
    caso([-1000000000, 1000000000], 0),
    caso([999999999, 1000000000], 1999999999),
    caso([-7, -7, 1, 3], -14),
    aleatorio(10, -50, 50),
    aleatorio(60, -1000, 1000),
    aleatorio(300, -100000, 100000),
    aleatorio(1000, -1000000000, 1000000000),
    aleatorio(1000, 0, 1000000000),
    aleatorio(1000, -1000000000, 0),
    grande(
      [{ $gen: "range", n: 100000, start: -400000, step: 4 }, 1, { $gen: "range", n: 60000, start: 4, step: 4 }, 240001, { $gen: "range", n: 39998, start: 240004, step: 4 }],
      240002
    ),
    grande([{ $gen: "range", n: 120000, start: -1000000, step: 4 }, -499999, { $gen: "range", n: 79998, start: -499996, step: 4 }, -180007], -680006),
    grande([-999999999, { $gen: "range", n: 199998, start: -800000, step: 4 }, 999999997], -2)
  ];

  return defineChallenge({
    slug: "par-com-soma-no-ordenado",
    title: "Par com soma no vetor ordenado",
    difficulty: "easy",
    moduleId: moduleId("dois-ponteiros"),
    position: 0,
    description: [
      "Implemente `parComSoma(nums, alvo)`. O vetor `nums` chega **em ordem crescente** (pode ter valores repetidos) e existe **exatamente um** par de posições `i < j` com `nums[i] + nums[j] == alvo`.",
      "",
      "Retorne um vetor com os dois índices, na base 0: `[i, j]`.",
      "",
      "Por exemplo, em `[1, 3, 4, 6, 9]` com alvo `13`, só `4 + 9` dá 13, então a resposta é `[2, 4]`.",
      "",
      "O vetor pode ter até 2·10^5 elementos. Testar todos os pares custa O(n²) e estoura o tempo: aproveite a ordenação."
    ].join("\n"),
    constraints: [
      "2 <= nums.length <= 2·10^5",
      "-10^9 <= nums[i], alvo <= 10^9",
      "nums está em ordem crescente (não decrescente).",
      "A resposta existe e é única; retorne [i, j] com i < j.",
      "Em C, preencha *returnSize com 2 e retorne um vetor alocado com malloc."
    ],
    tags: ["Dois ponteiros", "Vetor ordenado"],
    functionSpec: { name: "parComSoma", params: [{ name: "nums", type: "int[]" }, { name: "alvo", type: "int" }], returns: "int[]" },
    publicCases: [caso([1, 3, 4, 6, 9], 13), caso([-6, -2, 3, 8], 1)],
    hiddenCases: hidden,
    hints: [
      "Olhe para a soma do menor com o maior elemento. Se ela passou do alvo, o maior elemento pode fazer par com alguém?",
      "Mantenha um índice no começo e outro no fim. Se a soma é pequena, avance o da esquerda; se é grande, recue o da direita.",
      "Cada passo descarta um elemento para sempre, então o laço roda no máximo n - 1 vezes."
    ],
    editorial: [
      "**Ideia.** Com o vetor ordenado, a soma `nums[i] + nums[j]` cresce quando `i` avança e diminui quando `j` recua. Começamos com `i` no início e `j` no fim.",
      "",
      "1. Se a soma é o alvo, achamos o par.",
      "2. Se a soma é menor que o alvo, `nums[i]` é pequeno demais até para o maior valor restante: avance `i`.",
      "3. Se a soma é maior, `nums[j]` é grande demais até para o menor valor restante: recue `j`.",
      "",
      "```js",
      "function parComSoma(nums, alvo) {",
      "  let i = 0, j = nums.length - 1;",
      "  while (i < j) {",
      "    const soma = nums[i] + nums[j];",
      "    if (soma === alvo) return [i, j];",
      "    if (soma < alvo) i++;",
      "    else j--;",
      "  }",
      "  return [];",
      "}",
      "```",
      "",
      "**Custo.** Cada iteração descarta um índice: O(n) de tempo e O(1) de memória extra. A força bruta com dois laços aninhados é O(n²) e não passa nos casos com 2·10^5 elementos."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function moverZerosParaOFim(): Challenge {
  const random = createRandom(600200);
  const ref = (nums: number[]) => [...nums.filter((value) => value !== 0), ...nums.filter((value) => value === 0)];
  const caso = (nums: number[]) => call([nums], ref(nums));
  const aleatorio = (n: number, zeroChance: number, limit: number) =>
    caso(Array.from({ length: n }, () => (random() < zeroChance ? 0 : randomInt(random, -limit, limit) || 1)));

  return defineChallenge({
    slug: "mover-zeros-para-o-fim",
    title: "Mover zeros para o fim",
    difficulty: "easy",
    moduleId: moduleId("dois-ponteiros"),
    position: 1,
    description: [
      "Implemente `moverZeros(nums)`, que retorna um vetor com os mesmos elementos de `nums`, mas com todos os **zeros no fim**.",
      "",
      "Os elementos **não nulos** (positivos e negativos) precisam manter a **ordem relativa original**. Por exemplo, `[0, 1, 0, 3, 12]` vira `[1, 3, 12, 0, 0]`.",
      "",
      "Tente fazer em uma única passada, com um ponteiro de leitura e outro de escrita, como se estivesse arrumando o próprio vetor no lugar. O vetor pode estar vazio."
    ].join("\n"),
    constraints: [
      "0 <= nums.length <= 5000",
      "-10^5 <= nums[i] <= 10^5",
      "Não nulo quer dizer diferente de zero: negativos também ficam na frente.",
      "Em C, você pode reorganizar o próprio nums e retorná-lo, com *returnSize = numsSize."
    ],
    tags: ["Dois ponteiros", "Vetores"],
    functionSpec: { name: "moverZeros", params: [{ name: "nums", type: "int[]" }], returns: "int[]" },
    publicCases: [caso([0, 1, 0, 3, 12]), caso([4, 0, 5])],
    hiddenCases: [
      caso([-1, 0, 2]),
      caso([]),
      caso([0]),
      caso([7]),
      caso([0, 0, 0]),
      caso([1, 2, 3]),
      caso([0, 0, -5, 3]),
      caso([-3, -2, -1]),
      caso([5, 0, 0, 0]),
      caso([0, 0, 0, 9]),
      caso([0, -100000, 0, 100000, 0]),
      aleatorio(20, 0.4, 9),
      aleatorio(100, 0.3, 100),
      aleatorio(1000, 0.5, 100000),
      aleatorio(5000, 0.3, 100000),
      aleatorio(5000, 0.9, 100000),
      aleatorio(5000, 0, 100000)
    ],
    hints: [
      "Pense em dois índices: um que lê cada elemento e outro que marca onde o próximo não nulo deve ser escrito.",
      "Sempre que ler um não nulo, copie para a posição de escrita e avance a escrita. No fim, preencha o resto com zeros.",
      "Cuidado com a condição: `x > 0` descarta os negativos. O teste certo é `x != 0`."
    ],
    editorial: [
      "**Ideia.** Um ponteiro `leitura` percorre o vetor; outro, `escrita`, aponta para a próxima posição livre da parte arrumada. Como a escrita nunca passa da leitura, dá para fazer no próprio vetor.",
      "",
      "```c",
      "int* moverZeros(int* nums, int numsSize, int* returnSize) {",
      "    int escrita = 0;",
      "    for (int leitura = 0; leitura < numsSize; leitura++)",
      "        if (nums[leitura] != 0) nums[escrita++] = nums[leitura];",
      "    while (escrita < numsSize) nums[escrita++] = 0;",
      "    *returnSize = numsSize;",
      "    return nums;",
      "}",
      "```",
      "",
      "**Custo.** Uma passada: O(n) de tempo e O(1) de memória extra. A ordem dos não nulos se mantém porque eles são copiados na ordem em que aparecem."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

const SEM_ORDENACAO: SourceRule = {
  kind: "forbid",
  pattern: "\\.sort\\s*\\(|\\.toSorted\\s*\\(|\\bsorted\\s*\\(|\\bqsort\\s*\\(",
  message: "Não use ordenação pronta (sort, toSorted, sorted ou qsort): o vetor já chega ordenado; monte a resposta com dois ponteiros."
};

function quadradosEmOrdem(): Challenge {
  const random = createRandom(600300);
  const ref = (nums: number[]) => nums.map((value) => value * value).sort(ascending);
  const caso = (nums: number[]) => call([nums], ref(nums));
  const aleatorio = (n: number, min: number, max: number) => caso(randomArray(random, n, min, max).sort(ascending));

  return defineChallenge({
    slug: "quadrados-em-ordem",
    title: "Quadrados em ordem",
    difficulty: "medium",
    moduleId: moduleId("dois-ponteiros"),
    position: 2,
    description: [
      "Implemente `quadradosOrdenados(nums)`. O vetor `nums` está em **ordem crescente** e pode ter negativos. Retorne um vetor com o **quadrado** de cada elemento, também em ordem crescente.",
      "",
      "Exemplo: `[-4, -1, 0, 3, 10]` vira `[0, 1, 9, 16, 100]`. Repare que o maior quadrado pode vir de qualquer uma das pontas.",
      "",
      "**Regra:** não use funções prontas de ordenação (`sort`, `sorted`, `qsort`). A resposta deve sair em O(n), aproveitando a ordem que o vetor já tem."
    ].join("\n"),
    constraints: [
      "1 <= nums.length <= 4000",
      "-10^4 <= nums[i] <= 10^4",
      "nums está em ordem crescente (não decrescente).",
      "Proibido: sort, toSorted, sorted e qsort."
    ],
    tags: ["Dois ponteiros", "Vetor ordenado"],
    functionSpec: { name: "quadradosOrdenados", params: [{ name: "nums", type: "int[]" }], returns: "int[]" },
    languages: (["javascript", "python", "c"] as const).map((name) => language(name, [SEM_ORDENACAO])),
    publicCases: [caso([-4, -1, 0, 3, 10]), caso([-7, -3, 2, 3, 11])],
    hiddenCases: [
      caso([5]),
      caso([-5]),
      caso([0]),
      caso([-3, -2, -1]),
      caso([1, 2, 3]),
      caso([-2, -2, 2, 2]),
      caso([-10000, 10000]),
      caso([-1, 0, 0, 1]),
      caso([-10000, -9999, 0, 1]),
      aleatorio(10, -10, 10),
      aleatorio(100, -100, 50),
      aleatorio(1000, -10000, 10000),
      aleatorio(4000, -10000, 10000),
      aleatorio(4000, -10000, -1),
      aleatorio(4000, 0, 10000),
      aleatorio(4000, -3, 3)
    ],
    hints: [
      "Onde estão os maiores quadrados de um vetor ordenado com negativos? No meio ou nas pontas?",
      "Compare o quadrado da ponta esquerda com o da ponta direita: o maior deles é o maior de todos os que sobraram.",
      "Preencha o resultado de trás para frente: a cada passo, escreva o maior quadrado das pontas na última posição livre e mova aquela ponta."
    ],
    editorial: [
      "**Ideia.** Os quadrados são grandes nas pontas (negativos muito negativos ou positivos muito positivos) e pequenos perto do zero. Então o maior quadrado restante está sempre em uma das duas pontas.",
      "",
      "1. `esquerda = 0`, `direita = n - 1`, `pos = n - 1`.",
      "2. Compare `nums[esquerda]²` com `nums[direita]²`, escreva o maior em `resultado[pos]` e mova a ponta usada.",
      "3. Repita até as pontas se cruzarem.",
      "",
      "```js",
      "function quadradosOrdenados(nums) {",
      "  const resultado = new Array(nums.length);",
      "  let esquerda = 0, direita = nums.length - 1;",
      "  for (let pos = nums.length - 1; pos >= 0; pos--) {",
      "    const a = nums[esquerda] * nums[esquerda];",
      "    const b = nums[direita] * nums[direita];",
      "    if (a > b) { resultado[pos] = a; esquerda++; }",
      "    else { resultado[pos] = b; direita--; }",
      "  }",
      "  return resultado;",
      "}",
      "```",
      "",
      "**Custo.** O(n) de tempo e O(n) para o vetor de saída. Elevar ao quadrado e ordenar custaria O(n log n) e jogaria fora a informação de que a entrada já está ordenada."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(n) para a saída" }
  });
}

function reservatorioRef(alturas: number[]): number {
  let esquerda = 0;
  let direita = alturas.length - 1;
  let melhor = 0;
  while (esquerda < direita) {
    melhor = Math.max(melhor, (direita - esquerda) * Math.min(alturas[esquerda], alturas[direita]));
    if (alturas[esquerda] < alturas[direita]) esquerda += 1;
    else direita -= 1;
  }
  return melhor;
}

function maiorReservatorio(): Challenge {
  const random = createRandom(600400);
  const caso = (alturas: number[]) => call([alturas], reservatorioRef(alturas));
  const grande = (spec: Parameters<typeof gen>[0]) => {
    const alturas = gen(spec);
    return call([alturas.spec], reservatorioRef(alturas.value));
  };

  return defineChallenge({
    slug: "maior-reservatorio",
    title: "Maior reservatório",
    difficulty: "medium",
    moduleId: moduleId("dois-ponteiros"),
    position: 3,
    description: [
      "Uma fileira de paredes verticais está em um terreno plano; a parede `i` tem altura `alturas[i]` e as paredes estão a 1 metro umas das outras.",
      "",
      "Escolhendo **duas** paredes `i < j`, elas formam um reservatório com capacidade `(j - i) * min(alturas[i], alturas[j])` (a água transborda pela parede mais baixa; as paredes do meio não atrapalham).",
      "",
      "Implemente `maiorReservatorio(alturas)`, que retorna a **maior capacidade** possível. Em `[3, 1, 4, 1, 5, 9, 2, 6]`, as paredes 0 e 7 dão `7 * 3 = 21`, a melhor escolha.",
      "",
      "Com até 2·10^5 paredes, testar todos os pares (O(n²)) estoura o tempo."
    ].join("\n"),
    constraints: [
      "2 <= alturas.length <= 2·10^5",
      "0 <= alturas[i] <= 10^9",
      "A resposta pode passar de 2^31: use long long em C."
    ],
    tags: ["Dois ponteiros", "Guloso"],
    functionSpec: { name: "maiorReservatorio", params: [{ name: "alturas", type: "int[]" }], returns: "long" },
    publicCases: [caso([3, 1, 4, 1, 5, 9, 2, 6]), caso([2, 5, 5, 2])],
    hiddenCases: [
      caso([0, 0]),
      caso([1, 1000000000]),
      caso([1000000000, 1000000000]),
      caso([5, 4, 3, 2, 1]),
      caso([1, 2, 3, 4, 5]),
      caso([1, 100, 100, 1]),
      caso([7, 0, 0, 0, 0, 7]),
      caso([0, 9, 0, 0, 9, 0]),
      caso(randomArray(random, 10, 0, 20)),
      caso(randomArray(random, 100, 0, 1000)),
      caso(randomArray(random, 2000, 0, 1000000000)),
      grande({ $gen: "ints", n: 200000, min: 0, max: 1000000000, seed: 600401 }),
      grande({ $gen: "range", n: 200000, start: 1, step: 1 }),
      grande({ $gen: "repeat", n: 200000, value: 1000000000 })
    ],
    hints: [
      "Comece com as duas paredes das pontas: é a maior largura possível. Qual delas limita a capacidade?",
      "Mover a parede mais alta para dentro nunca melhora: a largura diminui e a altura continua limitada pela mais baixa.",
      "Então sempre descarte a parede mais baixa (avance a esquerda ou recue a direita) e guarde o melhor valor visto."
    ],
    editorial: [
      "**Ideia.** Com `i = 0` e `j = n - 1` temos a maior largura. Seja `alturas[i] <= alturas[j]`. Qualquer reservatório que use a parede `i` com outra parede `k < j` tem largura menor e altura no máximo `alturas[i]`: nenhum supera o atual. Logo a parede `i` pode ser descartada. O mesmo vale, simetricamente, para `j`.",
      "",
      "```js",
      "function maiorReservatorio(alturas) {",
      "  let i = 0, j = alturas.length - 1, melhor = 0;",
      "  while (i < j) {",
      "    melhor = Math.max(melhor, (j - i) * Math.min(alturas[i], alturas[j]));",
      "    if (alturas[i] < alturas[j]) i++;",
      "    else j--;",
      "  }",
      "  return melhor;",
      "}",
      "```",
      "",
      "**Custo.** Cada passo descarta uma parede: O(n) de tempo, O(1) de memória. Em C, calcule o produto em `long long`: `(long long)(j - i) * altura` pode chegar a 2·10^14."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function triosRef(nums: number[]): number[][] {
  const a = [...nums].sort(ascending);
  const trios: number[][] = [];
  for (let i = 0; i < a.length - 2; i += 1) {
    if (a[i] > 0) break;
    if (i > 0 && a[i] === a[i - 1]) continue;
    let esquerda = i + 1;
    let direita = a.length - 1;
    while (esquerda < direita) {
      const soma = a[i] + a[esquerda] + a[direita];
      if (soma < 0) esquerda += 1;
      else if (soma > 0) direita -= 1;
      else {
        trios.push([a[i], a[esquerda], a[direita]]);
        while (esquerda < direita && a[esquerda] === a[esquerda + 1]) esquerda += 1;
        while (esquerda < direita && a[direita] === a[direita - 1]) direita -= 1;
        esquerda += 1;
        direita -= 1;
      }
    }
  }
  return trios;
}

function triosComSomaZero(): Challenge {
  const random = createRandom(600500);
  const caso = (nums: number[]) => call([nums], triosRef(nums));
  const grande = (spec: Parameters<typeof gen>[0]) => {
    const nums = gen(spec);
    return call([nums.spec], triosRef(nums.value));
  };

  return defineChallenge({
    slug: "trios-com-soma-zero",
    title: "Trios com soma zero",
    difficulty: "hard",
    moduleId: moduleId("dois-ponteiros"),
    position: 4,
    isBoss: true,
    description: [
      "Implemente `triosSomaZero(nums)`, que encontra todos os trios **de valores** `[a, b, c]` retirados de posições diferentes de `nums` com `a + b + c == 0`.",
      "",
      "- Cada trio vem em ordem crescente: `a <= b <= c`.",
      "- Não repita trios: `[-1, 0, 1]` aparece uma vez só, mesmo que haja vários `-1` no vetor.",
      "- A lista de trios vem em **ordem lexicográfica** (compare o primeiro valor; em empate, o segundo; depois o terceiro).",
      "- Se não houver nenhum trio, retorne `[]`.",
      "",
      "Exemplo: em `[2, -1, 0, -1, 1, -2]` os trios são `[[-2, 0, 2], [-1, -1, 2], [-1, 0, 1]]`.",
      "",
      "O vetor tem até 3000 elementos: três laços aninhados (O(n³)) estouram o tempo. Ordene e, para cada primeiro elemento, procure os outros dois com dois ponteiros."
    ].join("\n"),
    constraints: [
      "0 <= nums.length <= 3000",
      "-10^8 <= nums[i] <= 10^8",
      "Em C, preencha *returnSize com o número de trios e *returnColumnSizes com um vetor (alocado) em que cada posição vale 3."
    ],
    tags: ["Dois ponteiros", "Ordenação"],
    functionSpec: { name: "triosSomaZero", params: [{ name: "nums", type: "int[]" }], returns: "int[][]" },
    // Folga para o O(n²) em Python; o O(n³) leva dezenas de segundos com n = 3000.
    timeLimitMs: 2000,
    publicCases: [caso([2, -1, 0, -1, 1, -2]), caso([1, 2, -4, 5])],
    hiddenCases: [
      caso([0, 0, 0]),
      caso([0, 0, 0, 0, 0]),
      caso([1, 2, 3]),
      caso([-1, -1, 2]),
      caso([-2, 0, 1, 1, 2]),
      caso([]),
      caso([1, -1]),
      caso([3, -3, 0, 3, -3, 0]),
      caso([-100000000, 50000000, 50000000, 100000000, 0]),
      caso(randomArray(random, 10, -5, 5)),
      caso(randomArray(random, 50, -20, 20)),
      caso(randomArray(random, 200, -100, 100)),
      caso(randomArray(random, 300, -3000, 3000)),
      grande({ $gen: "ints", n: 3000, min: -100000000, max: 100000000, seed: 600501, set: { "10": 7, "500": 11, "2999": -18, "1234": -30000000, "77": 30000000, "1500": 0 } }),
      grande({ $gen: "ints", n: 3000, min: -40, max: 40, seed: 600502 }),
      grande({ $gen: "repeat", n: 3000, value: 0 }),
      grande({ $gen: "ints", n: 3000, min: 1, max: 100000000, seed: 600503 })
    ],
    hints: [
      "Ordenar o vetor ajuda duas vezes: trios saem em ordem naturalmente e fica fácil pular valores repetidos.",
      "Fixe o primeiro elemento `a[i]`. O que falta é achar pares com soma `-a[i]` no trecho à direita, que está ordenado: isso é o desafio do par com dois ponteiros.",
      "Para não repetir trios, pule `i` quando `a[i] == a[i - 1]` e, depois de achar um trio, avance os ponteiros enquanto repetirem o valor."
    ],
    editorial: [
      "**Ideia.** Ordene. Para cada `i` (pulando valores repetidos), rode dois ponteiros no trecho `i+1 .. n-1` procurando soma `-a[i]`.",
      "",
      "1. Se a soma dos três é negativa, avance a esquerda; se é positiva, recue a direita.",
      "2. Ao achar um trio, guarde-o e mova os dois ponteiros até valores diferentes, para não repetir.",
      "3. Se `a[i] > 0`, pare: com o vetor ordenado, os outros dois também são positivos.",
      "",
      "```python",
      "def triosSomaZero(nums):",
      "    a = sorted(nums)",
      "    trios = []",
      "    for i in range(len(a) - 2):",
      "        if i > 0 and a[i] == a[i - 1]:",
      "            continue",
      "        esq, dir = i + 1, len(a) - 1",
      "        while esq < dir:",
      "            soma = a[i] + a[esq] + a[dir]",
      "            if soma < 0:",
      "                esq += 1",
      "            elif soma > 0:",
      "                dir -= 1",
      "            else:",
      "                trios.append([a[i], a[esq], a[dir]])",
      "                while esq < dir and a[esq] == a[esq + 1]:",
      "                    esq += 1",
      "                esq += 1",
      "                dir -= 1",
      "    return trios",
      "```",
      "",
      "**Custo.** Ordenar custa O(n log n) e cada `i` faz uma passada de dois ponteiros: O(n²) no total, com O(1) de memória além da saída. Com n = 3000, isso são uns 4,5 milhões de passos; três laços aninhados seriam 4,5 bilhões."
    ].join("\n"),
    complexity: { time: "O(n²)", space: "O(1) além da saída" }
  });
}

// =====================================================================
// Janela deslizante
// =====================================================================

function maiorSomaDeKRef(nums: number[], k: number): number {
  let janela = 0;
  for (let index = 0; index < k; index += 1) janela += nums[index];
  let melhor = janela;
  for (let index = k; index < nums.length; index += 1) {
    janela += nums[index] - nums[index - k];
    melhor = Math.max(melhor, janela);
  }
  return melhor;
}

function maiorSomaDeKSeguidos(): Challenge {
  const random = createRandom(600600);
  const caso = (nums: number[], k: number) => call([nums, k], maiorSomaDeKRef(nums, k));
  const grande = (spec: Parameters<typeof gen>[0], k: number) => {
    const nums = gen(spec);
    return call([nums.spec, k], maiorSomaDeKRef(nums.value, k));
  };

  return defineChallenge({
    slug: "maior-soma-de-k-seguidos",
    title: "Maior soma de k seguidos",
    difficulty: "easy",
    moduleId: moduleId("janela-deslizante"),
    position: 0,
    description: [
      "Implemente `maiorSomaDeK(nums, k)`, que retorna a **maior soma** entre todos os trechos de exatamente `k` elementos **consecutivos** de `nums`.",
      "",
      "Em `[2, -1, 3, 5, -2, 4]` com `k = 3`, os trechos somam 4, 7, 6 e 7, então a resposta é `7`.",
      "",
      "Os valores podem ser negativos (a resposta também). Com até 2·10^5 elementos e `k` grande, somar cada trecho do zero custa O(n·k) e estoura o tempo: ao deslizar a janela, só um elemento entra e só um sai."
    ].join("\n"),
    constraints: [
      "1 <= k <= nums.length <= 2·10^5",
      "-10^9 <= nums[i] <= 10^9",
      "A soma pode passar de 2^31: use long long em C."
    ],
    tags: ["Janela deslizante"],
    functionSpec: { name: "maiorSomaDeK", params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }], returns: "long" },
    publicCases: [caso([2, -1, 3, 5, -2, 4], 3), caso([4, 4, 1], 1)],
    hiddenCases: [
      caso([-5, -2, -9], 2),
      caso([7], 1),
      caso([-7], 1),
      caso([1, 2, 3, 4], 4),
      caso([5, -10, 5], 1),
      caso([0, 0, 0, 0], 2),
      caso([1000000000, 1000000000, 1000000000], 3),
      caso([-1000000000, -1000000000], 1),
      caso(randomArray(random, 30, -20, 20), 5),
      caso(randomArray(random, 1000, -1000000000, 1000000000), 17),
      caso(randomArray(random, 1000, -100, 100), 1000),
      grande({ $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 600601 }, 100000),
      grande({ $gen: "repeat", n: 200000, value: -1000000000 }, 200000),
      caso(randomArray(random, 3000, -1000000000, -1), 1500)
    ],
    hints: [
      "Some os `k` primeiros elementos: essa é a primeira janela.",
      "Para passar da janela que começa em `i - k` para a que termina em `i`, some `nums[i]` e subtraia `nums[i - k]`.",
      "Comece o máximo com a soma da primeira janela, não com 0: todas as somas podem ser negativas."
    ],
    editorial: [
      "**Ideia.** Duas janelas vizinhas compartilham `k - 1` elementos. Em vez de somar tudo de novo, atualize a soma: entra o elemento da direita, sai o da esquerda.",
      "",
      "```js",
      "function maiorSomaDeK(nums, k) {",
      "  let janela = 0;",
      "  for (let i = 0; i < k; i++) janela += nums[i];",
      "  let melhor = janela;",
      "  for (let i = k; i < nums.length; i++) {",
      "    janela += nums[i] - nums[i - k];",
      "    melhor = Math.max(melhor, janela);",
      "  }",
      "  return melhor;",
      "}",
      "```",
      "",
      "**Custo.** O(n) de tempo e O(1) de memória. Em C, a janela precisa ser `long long`: 2·10^5 valores de até 10^9 somam 2·10^14."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function menorSubvetorRef(nums: number[], alvo: number): number {
  let inicio = 0;
  let soma = 0;
  let melhor = Infinity;
  for (let fim = 0; fim < nums.length; fim += 1) {
    soma += nums[fim];
    while (soma >= alvo) {
      melhor = Math.min(melhor, fim - inicio + 1);
      soma -= nums[inicio];
      inicio += 1;
    }
  }
  return melhor === Infinity ? 0 : melhor;
}

function menorSubvetorComSomaMinima(): Challenge {
  const random = createRandom(600700);
  const caso = (nums: number[], alvo: number) => call([nums, alvo], menorSubvetorRef(nums, alvo));
  const grandes = (seed: number, alvos: (total: number) => number[]) => {
    const nums = gen({ $gen: "ints", n: 200000, min: 1, max: 5000, seed });
    const total = sum(nums.value);
    return alvos(total).map((alvo) => call([nums.spec, alvo], menorSubvetorRef(nums.value, alvo)));
  };

  return defineChallenge({
    slug: "menor-subvetor-com-soma-minima",
    title: "Menor subvetor com soma mínima",
    difficulty: "medium",
    moduleId: moduleId("janela-deslizante"),
    position: 1,
    description: [
      "Implemente `menorSubvetor(nums, alvo)`. Todos os valores de `nums` são **positivos**. Retorne o **tamanho** do menor trecho contíguo cuja soma seja **maior ou igual** a `alvo`, ou `0` se nenhum trecho alcançar o alvo.",
      "",
      "Em `[1, 2, 3, 4, 5]` com alvo `11`, o trecho `[3, 4, 5]` soma 12 e nenhum trecho de dois elementos chega a 11: a resposta é `3`.",
      "",
      "A janela aqui tem tamanho **variável**: cresce pela direita até a soma bastar e encolhe pela esquerda enquanto ainda bastar."
    ].join("\n"),
    constraints: [
      "1 <= nums.length <= 2·10^5",
      "1 <= nums[i] <= 10^4",
      "1 <= alvo <= 10^9",
      "A condição é soma >= alvo (igualdade conta)."
    ],
    tags: ["Janela deslizante", "Dois ponteiros"],
    functionSpec: { name: "menorSubvetor", params: [{ name: "nums", type: "int[]" }, { name: "alvo", type: "int" }], returns: "int" },
    publicCases: [caso([2, 1, 5, 2, 8], 7), caso([1, 1, 1, 1], 10), caso([1, 2, 3, 4, 5], 11)],
    hiddenCases: [
      caso([3, 4], 7),
      caso([10], 10),
      caso([10], 11),
      caso([1, 1, 1, 1, 1], 5),
      caso([5, 1, 1, 1, 5], 6),
      caso([1, 4, 4], 4),
      caso([10000, 1, 10000], 20000),
      caso(randomArray(random, 50, 1, 10), 40),
      caso(randomArray(random, 500, 1, 100), 3000),
      caso(randomArray(random, 5000, 1, 10000), 1000000),
      caso(randomArray(random, 5000, 1, 10000), 1000000000),
      ...grandes(600701, (total) => [Math.floor(total / 2), total, total + 1]),
      ...grandes(600702, () => [4999, 250000000])
    ],
    hints: [
      "Como os valores são positivos, aumentar a janela sempre aumenta a soma e diminuir sempre diminui.",
      "Avance o fim da janela somando. Enquanto a soma for pelo menos o alvo, registre o tamanho e tire o elemento do início.",
      "Cada índice entra e sai da janela no máximo uma vez, então os dois laços juntos fazem O(n) passos."
    ],
    editorial: [
      "**Ideia.** Para cada fim `f`, o melhor início é o maior `i` com `soma(i..f) >= alvo`. Quando `f` avança, esse início nunca volta para trás (os valores são positivos), então os dois ponteiros só andam para a frente.",
      "",
      "```js",
      "function menorSubvetor(nums, alvo) {",
      "  let inicio = 0, soma = 0, melhor = Infinity;",
      "  for (let fim = 0; fim < nums.length; fim++) {",
      "    soma += nums[fim];",
      "    while (soma >= alvo) {",
      "      melhor = Math.min(melhor, fim - inicio + 1);",
      "      soma -= nums[inicio++];",
      "    }",
      "  }",
      "  return melhor === Infinity ? 0 : melhor;",
      "}",
      "```",
      "",
      "**Custo.** O(n) de tempo, O(1) de memória. Atenção à comparação: `>=`, não `>`. Com valores negativos a janela deixaria de funcionar, porque encolher poderia aumentar a soma."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function anagramasRef(texto: string, padrao: string): number {
  const m = padrao.length;
  if (m > texto.length) return 0;
  const diferenca = new Array(26).fill(0);
  for (const char of padrao) diferenca[char.charCodeAt(0) - 97] -= 1;
  let zeros = diferenca.filter((value) => value === 0).length;
  const ajusta = (index: number, delta: number) => {
    if (diferenca[index] === 0) zeros -= 1;
    diferenca[index] += delta;
    if (diferenca[index] === 0) zeros += 1;
  };
  let total = 0;
  for (let index = 0; index < texto.length; index += 1) {
    ajusta(texto.charCodeAt(index) - 97, 1);
    if (index >= m) ajusta(texto.charCodeAt(index - m) - 97, -1);
    if (index >= m - 1 && zeros === 26) total += 1;
  }
  return total;
}

function contarAnagramasNaJanela(): Challenge {
  const random = createRandom(600800);
  const caso = (texto: string, padrao: string) => call([texto, padrao], anagramasRef(texto, padrao));
  const aleatorio = (n: number, m: number, alphabet: string) => caso(randomText(random, n, alphabet), randomText(random, m, alphabet));
  const grande = (texto: Parameters<typeof gen>[0], padrao: Parameters<typeof gen>[0] | string) => {
    const t = gen(texto);
    const p = typeof padrao === "string" ? { spec: padrao, value: padrao } : gen(padrao);
    return call([t.spec, p.spec], anagramasRef(t.value, p.value));
  };

  return defineChallenge({
    slug: "contar-anagramas-na-janela",
    title: "Contar anagramas na janela",
    difficulty: "medium",
    moduleId: moduleId("janela-deslizante"),
    position: 2,
    description: [
      "Implemente `contarAnagramas(texto, padrao)`, que conta quantos trechos contíguos de `texto` são **anagramas** de `padrao`, isto é, têm exatamente as mesmas letras com as mesmas quantidades, em qualquer ordem.",
      "",
      "Trechos em posições diferentes contam separadamente, mesmo que se sobreponham. Em `\"bacabcab\"` com padrão `\"abc\"`, os trechos de 3 letras são `bac`, `aca`, `cab`, `abc`, `bca` e `cab`: cinco deles são anagramas, então a resposta é `5`.",
      "",
      "Se `padrao` for maior que `texto`, a resposta é `0`. O texto pode ter 2·10^5 letras e o padrão dezenas de milhares: comparar cada trecho do zero estoura o tempo."
    ].join("\n"),
    constraints: [
      "1 <= texto.length, padrao.length <= 2·10^5",
      "texto e padrao têm só letras minúsculas de a a z.",
      "A quantidade de cada letra importa: \"aab\" não é anagrama de \"abb\"."
    ],
    tags: ["Janela deslizante", "Contagem"],
    functionSpec: { name: "contarAnagramas", params: [{ name: "texto", type: "string" }, { name: "padrao", type: "string" }], returns: "int" },
    publicCases: [caso("bacabcab", "abc"), caso("aaaa", "aa")],
    hiddenCases: [
      caso("abbab", "aab"),
      caso("a", "a"),
      caso("a", "b"),
      caso("ab", "abc"),
      caso("zzzz", "zzzz"),
      caso("abcdefghijklmnopqrstuvwxyz", "zyx"),
      caso("aabbaabb", "ab"),
      aleatorio(100, 2, "ab"),
      aleatorio(1000, 4, "abc"),
      aleatorio(5000, 30, "ab"),
      aleatorio(5000, 5, "abcdefghijklmnopqrstuvwxyz"),
      grande({ $gen: "string", n: 200000, seed: 600801, alphabet: "ab" }, { $gen: "string", n: 50000, seed: 600802, alphabet: "ab" }),
      grande({ $gen: "string", n: 200000, seed: 600805, alphabet: "abc" }, "abc"),
      grande({ $gen: "string", n: 200000, seed: 600806 }, { $gen: "string", n: 2000, seed: 600807 }),
      grande({ $gen: "string", n: 200000, seed: 600808, alphabet: "a" }, { $gen: "string", n: 100000, seed: 600809, alphabet: "a" })
    ],
    hints: [
      "Todas as janelas têm o tamanho do padrão. Dois textos são anagramas quando as contagens das 26 letras coincidem.",
      "Guarde as contagens da janela atual. Ao deslizar, some 1 na letra que entra e subtraia 1 na que sai: não recalcule tudo.",
      "Para comparar em O(1), mantenha quantas das 26 letras já têm a mesma contagem que no padrão e atualize esse número a cada entrada ou saída."
    ],
    editorial: [
      "**Ideia.** Janela de tamanho fixo `m = padrao.length`. Mantenha `diferenca[letra] = contagem na janela - contagem no padrão` e quantas letras têm diferença zero. A janela é anagrama quando as 26 letras estão zeradas.",
      "",
      "```js",
      "function contarAnagramas(texto, padrao) {",
      "  const m = padrao.length;",
      "  if (m > texto.length) return 0;",
      "  const dif = new Array(26).fill(0);",
      "  for (const c of padrao) dif[c.charCodeAt(0) - 97]--;",
      "  let zeradas = dif.filter((d) => d === 0).length, total = 0;",
      "  const ajusta = (i, delta) => {",
      "    if (dif[i] === 0) zeradas--;",
      "    dif[i] += delta;",
      "    if (dif[i] === 0) zeradas++;",
      "  };",
      "  for (let i = 0; i < texto.length; i++) {",
      "    ajusta(texto.charCodeAt(i) - 97, +1);",
      "    if (i >= m) ajusta(texto.charCodeAt(i - m) - 97, -1);",
      "    if (i >= m - 1 && zeradas === 26) total++;",
      "  }",
      "  return total;",
      "}",
      "```",
      "",
      "**Custo.** O(n + m) de tempo e O(26) de memória. Ordenar cada janela custaria O(n · m log m); comparar os 26 contadores a cada passo (O(26·n)) também passa."
    ].join("\n"),
    complexity: { time: "O(n + m)", space: "O(1) (26 contadores)" }
  });
}

function maiorSequenciaRef(bits: number[], k: number): number {
  let inicio = 0;
  let zeros = 0;
  let melhor = 0;
  for (let fim = 0; fim < bits.length; fim += 1) {
    if (bits[fim] === 0) zeros += 1;
    while (zeros > k) {
      if (bits[inicio] === 0) zeros -= 1;
      inicio += 1;
    }
    melhor = Math.max(melhor, fim - inicio + 1);
  }
  return melhor;
}

function maiorSequenciaDeUnsComKTrocas(): Challenge {
  const random = createRandom(600900);
  const caso = (bits: number[], k: number) => call([bits, k], maiorSequenciaRef(bits, k));
  const grande = (spec: Parameters<typeof gen>[0], k: number) => {
    const bits = gen(spec);
    return call([bits.spec, k], maiorSequenciaRef(bits.value, k));
  };
  const bitsGerados = (seed: number) => ({ $gen: "ints", n: 200000, min: 0, max: 1, seed }) as const;

  return defineChallenge({
    slug: "maior-sequencia-de-uns-com-k-trocas",
    title: "Maior sequência de uns com k trocas",
    difficulty: "medium",
    moduleId: moduleId("janela-deslizante"),
    position: 3,
    description: [
      "O vetor `bits` só tem 0 e 1. Você pode transformar **no máximo `k` zeros** em uns.",
      "",
      "Implemente `maiorSequencia(bits, k)`, que retorna o tamanho do **maior trecho contíguo só de uns** que dá para obter.",
      "",
      "Em `[1, 1, 0, 0, 1, 1, 1, 0, 1]` com `k = 1`, trocando o zero da posição 7 obtemos `1, 1, 1, 1, 1` nas posições 4 a 8: resposta `5`.",
      "",
      "Dica de leitura: a pergunta equivale a \"qual o maior trecho com no máximo `k` zeros?\"."
    ].join("\n"),
    constraints: ["1 <= bits.length <= 2·10^5", "bits[i] é 0 ou 1", "0 <= k <= bits.length"],
    tags: ["Janela deslizante"],
    functionSpec: { name: "maiorSequencia", params: [{ name: "bits", type: "int[]" }, { name: "k", type: "int" }], returns: "int" },
    publicCases: [caso([1, 1, 0, 0, 1, 1, 1, 0, 1], 1), caso([0, 0, 1, 0], 2)],
    hiddenCases: [
      caso([1], 0),
      caso([0], 0),
      caso([0], 1),
      caso([1, 1, 1, 1], 0),
      caso([0, 0, 0, 0], 4),
      caso([0, 0, 0, 0], 2),
      caso([1, 0, 1, 0, 1], 0),
      caso([0, 1, 1, 0, 1, 1, 1, 0], 1),
      caso(randomArray(random, 20, 0, 1), 3),
      caso(randomArray(random, 200, 0, 1), 10),
      caso(randomArray(random, 2000, 0, 1), 0),
      grande(bitsGerados(600901), 50000),
      grande({ $gen: "concat", parts: [{ $gen: "ints", n: 150000, min: 0, max: 1, seed: 600904 }, { $gen: "repeat", n: 50000, value: 1 }] }, 60000),
      grande({ $gen: "repeat", n: 200000, value: 0 }, 123456)
    ],
    hints: [
      "Troque a pergunta: qual é o maior trecho contíguo que contém no máximo `k` zeros?",
      "Estenda a janela pela direita contando os zeros. Quando passar de `k`, encolha pela esquerda até voltar a `k`.",
      "Depois de cada ajuste, o tamanho da janela é um candidato à resposta."
    ],
    editorial: [
      "**Ideia.** Qualquer trecho com no máximo `k` zeros vira só de uns. Então procuramos o maior trecho com no máximo `k` zeros, com uma janela de tamanho variável.",
      "",
      "```c",
      "int maiorSequencia(int* bits, int bitsSize, int k) {",
      "    int inicio = 0, zeros = 0, melhor = 0;",
      "    for (int fim = 0; fim < bitsSize; fim++) {",
      "        if (bits[fim] == 0) zeros++;",
      "        while (zeros > k) {",
      "            if (bits[inicio] == 0) zeros--;",
      "            inicio++;",
      "        }",
      "        if (fim - inicio + 1 > melhor) melhor = fim - inicio + 1;",
      "    }",
      "    return melhor;",
      "}",
      "```",
      "",
      "**Custo.** Cada posição entra e sai da janela uma vez: O(n) de tempo e O(1) de memória. Testar todos os inícios e estender até estourar `k` seria O(n²)."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function menorJanelaRef(texto: string, alvo: string): string {
  const falta = new Array(128).fill(0);
  for (const char of alvo) falta[char.charCodeAt(0)] += 1;
  let faltando = alvo.length;
  let inicio = 0;
  let melhorInicio = 0;
  let melhorTamanho = Infinity;
  for (let fim = 0; fim < texto.length; fim += 1) {
    const code = texto.charCodeAt(fim);
    if (falta[code] > 0) faltando -= 1;
    falta[code] -= 1;
    while (faltando === 0) {
      if (fim - inicio + 1 < melhorTamanho) {
        melhorTamanho = fim - inicio + 1;
        melhorInicio = inicio;
      }
      const sai = texto.charCodeAt(inicio);
      falta[sai] += 1;
      if (falta[sai] > 0) faltando += 1;
      inicio += 1;
    }
  }
  return melhorTamanho === Infinity ? "" : texto.slice(melhorInicio, melhorInicio + melhorTamanho);
}

function menorJanelaQueContem(): Challenge {
  const random = createRandom(601000);
  const caso = (texto: string, alvo: string) => call([texto, alvo], menorJanelaRef(texto, alvo));
  const aleatorio = (n: number, m: number, alphabet: string) => caso(randomText(random, n, alphabet), randomText(random, m, alphabet));
  const grande = (texto: Parameters<typeof gen>[0], alvo: Parameters<typeof gen>[0] | string) => {
    const t = gen(texto);
    const a = typeof alvo === "string" ? { spec: alvo, value: alvo } : gen(alvo);
    return call([t.spec, a.spec], menorJanelaRef(t.value, a.value));
  };
  const LETRAS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

  return defineChallenge({
    slug: "menor-janela-que-contem",
    title: "Menor janela que contém",
    difficulty: "hard",
    moduleId: moduleId("janela-deslizante"),
    position: 4,
    isBoss: true,
    description: [
      "Implemente `menorJanela(texto, alvo)`, que retorna o **menor trecho contíguo** de `texto` que contém todas as letras de `alvo`, **respeitando as quantidades**: se `alvo` tem duas letras `a`, o trecho precisa ter pelo menos duas.",
      "",
      "- Maiúsculas e minúsculas são letras diferentes.",
      "- Se houver mais de um trecho com o menor tamanho, retorne o **mais à esquerda**.",
      "- Se nenhum trecho servir, retorne a string vazia `\"\"`.",
      "",
      "Em `\"programacao\"` com alvo `\"mao\"`, os trechos `\"ogram\"` e `\"macao\"` têm 5 letras e contêm `m`, `a` e `o`; o mais à esquerda é `\"ogram\"`.",
      "",
      "Com textos de 2·10^5 letras, testar cada início separadamente é O(n²). Use uma janela que cresce pela direita até cobrir o alvo e encolhe pela esquerda enquanto continuar cobrindo."
    ].join("\n"),
    constraints: [
      "1 <= texto.length, alvo.length <= 2·10^5",
      "texto e alvo têm só letras de a a z e de A a Z.",
      "Em C, retorne uma string alocada com malloc (terminada em '\\0')."
    ],
    tags: ["Janela deslizante", "Contagem"],
    functionSpec: { name: "menorJanela", params: [{ name: "texto", type: "string" }, { name: "alvo", type: "string" }], returns: "string" },
    publicCases: [caso("programacao", "mao"), caso("banana", "nab"), caso("abc", "d")],
    hiddenCases: [
      caso("aab", "aa"),
      caso("a", "a"),
      caso("a", "aa"),
      caso("Aa", "a"),
      caso("ab", "ba"),
      caso("xyzzyx", "zz"),
      caso("abcabcabc", "cba"),
      caso("aaaaaaaaab", "ab"),
      aleatorio(30, 3, "abc"),
      aleatorio(300, 6, "abcd"),
      aleatorio(3000, 12, LETRAS),
      grande({ $gen: "string", n: 200000, seed: 601001 }, "zyxwvutsrq"),
      grande(
        { $gen: "concat", parts: [{ $gen: "string", n: 100000, seed: 601002, alphabet: "ab" }, "c", { $gen: "string", n: 99999, seed: 601003, alphabet: "ab" }] },
        "acb"
      ),
      grande({ $gen: "string", n: 200000, seed: 601004, alphabet: "abcdefghijklmnopqrstuvwxy" }, "az"),
      grande({ $gen: "string", n: 200000, seed: 601005, alphabet: "abcde" }, { $gen: "string", n: 1000, seed: 601006, alphabet: "abcde" })
    ],
    hints: [
      "Guarde quantas vezes cada letra ainda falta e um contador geral de letras faltando. A janela cobre o alvo quando o contador chega a zero.",
      "Avance o fim da janela. Assim que cobrir o alvo, avance o início enquanto continuar cobrindo, registrando cada janela válida.",
      "Só troque a melhor resposta quando encontrar uma janela estritamente menor: assim, em empate, fica a mais à esquerda."
    ],
    editorial: [
      "**Ideia.** Janela de tamanho variável com uma tabela `falta[c]` (quantas cópias de `c` ainda faltam; pode ficar negativa quando sobra) e um contador `faltando` de letras do alvo ainda não cobertas.",
      "",
      "1. Ao incluir `texto[fim]`: se `falta[c] > 0`, ele cobre uma letra do alvo (`faltando--`). Depois `falta[c]--`.",
      "2. Enquanto `faltando == 0`, a janela é válida: compare com a melhor e retire `texto[inicio]` (`falta[c]++`; se ficou positivo, voltou a faltar).",
      "",
      "```js",
      "function menorJanela(texto, alvo) {",
      "  const falta = new Array(128).fill(0);",
      "  for (const c of alvo) falta[c.charCodeAt(0)]++;",
      "  let faltando = alvo.length, inicio = 0, melhorInicio = 0, melhor = Infinity;",
      "  for (let fim = 0; fim < texto.length; fim++) {",
      "    const c = texto.charCodeAt(fim);",
      "    if (falta[c]-- > 0) faltando--;",
      "    while (faltando === 0) {",
      "      if (fim - inicio + 1 < melhor) { melhor = fim - inicio + 1; melhorInicio = inicio; }",
      "      if (++falta[texto.charCodeAt(inicio++)] > 0) faltando++;",
      "    }",
      "  }",
      "  return melhor === Infinity ? \"\" : texto.slice(melhorInicio, melhorInicio + melhor);",
      "}",
      "```",
      "",
      "**Custo.** Cada letra entra e sai da janela uma vez: O(n + m) de tempo e O(1) de memória (128 contadores). Ignorar as quantidades (usar um conjunto de letras) erra quando o alvo repete letras."
    ].join("\n"),
    complexity: { time: "O(n + m)", space: "O(1) (tabela de 128 posições)" }
  });
}

// =====================================================================
// Prefixo acumulado
// =====================================================================

function prefixos(nums: number[]): number[] {
  const prefixo = [0];
  for (const value of nums) prefixo.push(prefixo[prefixo.length - 1] + value);
  return prefixo;
}

function somaDeIntervalosRef(nums: number[], consultas: number[][]): number {
  const prefixo = prefixos(nums);
  let total = 0;
  for (const [a, b] of consultas) {
    const l = Math.min(a, b);
    const r = Math.max(a, b);
    total += prefixo[r + 1] - prefixo[l];
  }
  return total;
}

function somaDeIntervalos(): Challenge {
  const random = createRandom(601100);
  const caso = (nums: number[], consultas: number[][]) => call([nums, consultas], somaDeIntervalosRef(nums, consultas));
  const aleatorio = (n: number, q: number, limit: number) => {
    const nums = randomArray(random, n, -limit, limit);
    const consultas = Array.from({ length: q }, () => [randomInt(random, 0, n - 1), randomInt(random, 0, n - 1)]);
    return caso(nums, consultas);
  };
  const grande = (numsSpec: Parameters<typeof gen>[0], n: number, q: number, seed: number) => {
    const nums = gen(numsSpec);
    const consultas = gen({ $gen: "matrix", rows: q, cols: 2, min: 0, max: n - 1, seed });
    return call([nums.spec, consultas.spec], somaDeIntervalosRef(nums.value, consultas.value));
  };

  return defineChallenge({
    slug: "soma-de-intervalos",
    title: "Soma de intervalos",
    difficulty: "easy",
    moduleId: moduleId("prefixo"),
    position: 0,
    description: [
      "Implemente `somaDeIntervalos(nums, consultas)`. Cada consulta é um par `[a, b]` de posições (base 0) e pede a soma de `nums` desde a menor até a maior dessas posições, **incluindo as duas pontas**.",
      "",
      "**Atenção:** as pontas podem vir em qualquer ordem: `[4, 1]` pede o mesmo trecho que `[1, 4]`.",
      "",
      "Como pode haver 10^5 consultas, em vez de devolver um vetor com as 10^5 respostas a função retorna **um único número: a soma das respostas de todas as consultas**. Isso mantém a saída pequena e ainda confere cada consulta.",
      "",
      "Exemplo: com `nums = [3, -1, 4, 1, 5]` e consultas `[0, 2]`, `[1, 3]` e `[4, 4]`, as respostas são 6, 4 e 5; retorne `15`.",
      "",
      "Somar cada trecho percorrendo o vetor custa O(n) por consulta e estoura o tempo com 10^5 consultas. Monte um vetor de prefixos uma vez e responda cada consulta em O(1)."
    ].join("\n"),
    constraints: [
      "1 <= nums.length <= 10^5",
      "-10^4 <= nums[i] <= 10^4",
      "1 <= consultas.length <= 10^5; cada consulta tem 2 posições válidas (0 <= a, b < nums.length).",
      "O total pode passar de 2^31: use long long em C."
    ],
    tags: ["Prefixo acumulado"],
    functionSpec: {
      name: "somaDeIntervalos",
      params: [{ name: "nums", type: "int[]" }, { name: "consultas", type: "int[][]" }],
      returns: "long"
    },
    publicCases: [caso([3, -1, 4, 1, 5], [[0, 2], [1, 3], [4, 4]]), caso([2, 7, 1], [[0, 0], [0, 2]])],
    hiddenCases: [
      caso([1, 2, 3], [[2, 0]]),
      caso([5], [[0, 0]]),
      caso([-4, 9], [[1, 0], [0, 1], [1, 1]]),
      caso([0, 0, 0, 0], [[0, 3], [3, 0]]),
      caso([10000, -10000, 10000], [[0, 2], [0, 1], [2, 1]]),
      caso([-1, -2, -3, -4], [[3, 3], [0, 3], [3, 0], [1, 2]]),
      aleatorio(10, 10, 10),
      aleatorio(100, 200, 100),
      aleatorio(1000, 1000, 10000),
      aleatorio(3000, 3000, 10000),
      grande({ $gen: "ints", n: 100000, min: -10000, max: 10000, seed: 601101 }, 100000, 100000, 601102),
      grande({ $gen: "repeat", n: 100000, value: 10000 }, 100000, 40000, 601103),
    ],
    hints: [
      "Defina `prefixo[i]` como a soma dos `i` primeiros elementos, com `prefixo[0] = 0`.",
      "A soma de `l` até `r` (inclusive) é `prefixo[r + 1] - prefixo[l]`.",
      "Antes de usar a fórmula, troque as pontas se `a > b`."
    ],
    editorial: [
      "**Ideia.** Pré-processe uma vez: `prefixo[i + 1] = prefixo[i] + nums[i]`. Toda soma de trecho vira uma subtração de dois prefixos.",
      "",
      "```js",
      "function somaDeIntervalos(nums, consultas) {",
      "  const prefixo = [0];",
      "  for (const x of nums) prefixo.push(prefixo[prefixo.length - 1] + x);",
      "  let total = 0;",
      "  for (const [a, b] of consultas) {",
      "    const l = Math.min(a, b), r = Math.max(a, b);",
      "    total += prefixo[r + 1] - prefixo[l];",
      "  }",
      "  return total;",
      "}",
      "```",
      "",
      "**Custo.** O(n) para montar os prefixos e O(1) por consulta: O(n + q) no total, com O(n) de memória. Em C, use `long long` no prefixo e no total."
    ].join("\n"),
    complexity: { time: "O(n + q)", space: "O(n)" }
  });
}

function equilibrioRef(nums: number[]): number {
  const total = sum(nums);
  let esquerda = 0;
  for (let index = 0; index < nums.length; index += 1) {
    if (esquerda === total - esquerda - nums[index]) return index;
    esquerda += nums[index];
  }
  return -1;
}

function indiceDeEquilibrio(): Challenge {
  const random = createRandom(601200);
  const caso = (nums: number[]) => call([nums], equilibrioRef(nums));
  const plantado = (n: number, limit: number, p: number, seed: number) => {
    const base = gen({ $gen: "ints", n, min: -limit, max: limit, seed }).value as number[];
    const esquerda = sum(base.slice(0, p));
    const direita = sum(base.slice(p + 1));
    const ultimo = base[n - 1] + esquerda - direita;
    // Mesmo vetor que o juiz expande: o gerador aplica `set` depois de sortear.
    const nums = [...base.slice(0, n - 1), ultimo];
    return call([{ $gen: "ints", n, min: -limit, max: limit, seed, set: { [String(n - 1)]: ultimo } }], equilibrioRef(nums));
  };
  const grande = (spec: Parameters<typeof gen>[0]) => {
    const nums = gen(spec);
    return call([nums.spec], equilibrioRef(nums.value));
  };
  const comEquilibrio = (n: number, limit: number) => {
    const nums = randomArray(random, n, -limit, limit);
    const p = randomInt(random, 0, n - 2);
    nums[n - 1] += sum(nums.slice(0, p)) - sum(nums.slice(p + 1));
    return caso(nums);
  };

  return defineChallenge({
    slug: "indice-de-equilibrio",
    title: "Índice de equilíbrio",
    difficulty: "easy",
    moduleId: moduleId("prefixo"),
    position: 1,
    description: [
      "Um índice `i` é de **equilíbrio** quando a soma dos elementos à esquerda dele é igual à soma dos elementos à direita (o próprio `nums[i]` não entra em nenhum dos lados). Se não houver nada de um lado, a soma daquele lado é 0.",
      "",
      "Implemente `indiceDeEquilibrio(nums)`, que retorna o **menor** índice de equilíbrio, ou `-1` se não houver nenhum.",
      "",
      "Em `[2, 3, -1, 8, 4]`, o índice 3 tem `2 + 3 + (-1) = 4` à esquerda e `4` à direita: resposta `3`.",
      "",
      "Recalcular as duas somas para cada índice é O(n²). Com a soma total em mãos, a soma da direita sai de uma conta."
    ].join("\n"),
    constraints: [
      "1 <= nums.length <= 2·10^5",
      "-10^9 <= nums[i] <= 10^9",
      "As somas podem passar de 2^31: use long long em C."
    ],
    tags: ["Prefixo acumulado"],
    functionSpec: { name: "indiceDeEquilibrio", params: [{ name: "nums", type: "int[]" }], returns: "int" },
    publicCases: [caso([2, 3, -1, 8, 4]), caso([1, 2, 3])],
    hiddenCases: [
      caso([0, 0, 0]),
      caso([5]),
      caso([0]),
      caso([1, -1, 1]),
      caso([-1, -1, -1, 0, 1, 1]),
      caso([3, 1, 2]),
      caso([1, 2]),
      caso([1000000000, 1000000000, -1000000000, 1000000000, 1000000000]),
      comEquilibrio(10, 10),
      comEquilibrio(100, 1000),
      comEquilibrio(2000, 1000000),
      caso(randomArray(random, 2000, -1000, 1000)),
      plantado(200000, 10000, 100000, 601201),
      caso(randomArray(random, 3000, 1, 1000000000)),
      grande({ $gen: "repeat", n: 200000, value: 0 }),
      grande({ $gen: "concat", parts: [{ $gen: "repeat", n: 199999, value: 1 }, -1000000000] })
    ],
    hints: [
      "A soma da direita é `total - esquerda - nums[i]`.",
      "Calcule o total uma vez e percorra o vetor mantendo a soma da esquerda.",
      "Teste o índice antes de somar `nums[i]` à esquerda e pare no primeiro que funcionar: a pergunta é pelo menor."
    ],
    editorial: [
      "**Ideia.** Prefixo acumulado sem vetor: a soma da esquerda cresce elemento a elemento e a da direita sai do total.",
      "",
      "```c",
      "int indiceDeEquilibrio(int* nums, int numsSize) {",
      "    long long total = 0, esquerda = 0;",
      "    for (int i = 0; i < numsSize; i++) total += nums[i];",
      "    for (int i = 0; i < numsSize; i++) {",
      "        if (esquerda == total - esquerda - nums[i]) return i;",
      "        esquerda += nums[i];",
      "    }",
      "    return -1;",
      "}",
      "```",
      "",
      "**Custo.** Duas passadas: O(n) de tempo e O(1) de memória. Percorrer de trás para frente acharia o maior índice, não o menor."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function somaKRef(nums: number[], k: number): number {
  const vistos = new Map<number, number>([[0, 1]]);
  let prefixo = 0;
  let total = 0;
  for (const value of nums) {
    prefixo += value;
    total += vistos.get(prefixo - k) ?? 0;
    vistos.set(prefixo, (vistos.get(prefixo) ?? 0) + 1);
  }
  return total;
}

function subvetoresComSomaK(): Challenge {
  const random = createRandom(601300);
  const caso = (nums: number[], k: number) => call([nums, k], somaKRef(nums, k));
  const grande = (spec: Parameters<typeof gen>[0], k: number) => {
    const nums = gen(spec);
    return call([nums.spec, k], somaKRef(nums.value, k));
  };

  return defineChallenge({
    slug: "subvetores-com-soma-k",
    title: "Subvetores com soma k",
    difficulty: "medium",
    moduleId: moduleId("prefixo"),
    position: 2,
    description: [
      "Implemente `contarSubvetores(nums, k)`, que retorna **quantos** trechos contíguos (não vazios) de `nums` têm soma exatamente `k`.",
      "",
      "Os valores podem ser **negativos** e zero, então a janela deslizante não funciona: aumentar a janela pode diminuir a soma. Em `[1, 2, 3, 1, 2]` com `k = 3`, os trechos `[1, 2]`, `[3]` e `[1, 2]` (no fim) somam 3: resposta `3`.",
      "",
      "A quantidade pode chegar a ~2·10^10 (por exemplo, 2·10^5 zeros com `k = 0`), então o retorno é um inteiro longo."
    ].join("\n"),
    constraints: [
      "1 <= nums.length <= 2·10^5",
      "-1000 <= nums[i] <= 1000",
      "-10^9 <= k <= 10^9",
      "Em C, retorne long long e implemente sua própria tabela hash (ou outra estrutura) para contar os prefixos."
    ],
    tags: ["Prefixo acumulado", "Hash"],
    functionSpec: { name: "contarSubvetores", params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }], returns: "long" },
    publicCases: [caso([1, 2, 3, 1, 2], 3), caso([5, 5, 5], 10)],
    hiddenCases: [
      caso([1, -1, 1], 1),
      caso([-1, -1, 1], 0),
      caso([0, 0, 0], 0),
      caso([7], 7),
      caso([7], -7),
      caso([3, -3, 3, -3], 0),
      caso([-2, -3, -5], -5),
      caso([1000, -1000, 1000], 1000000000),
      caso(randomArray(random, 50, -3, 3), 2),
      caso(randomArray(random, 500, -10, 10), 0),
      caso(randomArray(random, 5000, -1000, 1000), 777),
      grande({ $gen: "repeat", n: 200000, value: 0 }, 0),
      grande({ $gen: "ints", n: 200000, min: -2, max: 2, seed: 601301 }, 3),
      grande({ $gen: "ints", n: 200000, min: -1000, max: 1000, seed: 601302 }, 0)
    ],
    hints: [
      "A soma do trecho `(i, j]` é `prefixo[j] - prefixo[i]`. Ela vale `k` quando `prefixo[i] = prefixo[j] - k`.",
      "Percorra o vetor mantendo o prefixo atual e um mapa com quantas vezes cada prefixo já apareceu.",
      "Comece o mapa com o prefixo 0 aparecendo uma vez (o trecho que começa na posição 0) e, a cada passo, some ao total quantas vezes `prefixo - k` já apareceu."
    ],
    editorial: [
      "**Ideia.** Cada trecho que termina na posição `j` corresponde a um prefixo anterior. Contar trechos com soma `k` terminando em `j` é contar quantos prefixos anteriores valem `prefixo[j] - k`: uma consulta ao mapa.",
      "",
      "```js",
      "function contarSubvetores(nums, k) {",
      "  const vistos = new Map([[0, 1]]);",
      "  let prefixo = 0, total = 0;",
      "  for (const x of nums) {",
      "    prefixo += x;",
      "    total += vistos.get(prefixo - k) ?? 0;",
      "    vistos.set(prefixo, (vistos.get(prefixo) ?? 0) + 1);",
      "  }",
      "  return total;",
      "}",
      "```",
      "",
      "**Custo.** O(n) de tempo médio e O(n) de memória para o mapa. Em C, uma tabela hash com endereçamento aberto de 2^19 posições resolve. Testar todos os pares de início e fim é O(n²); a janela deslizante só funcionaria com valores positivos."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

function retangulosRef(matriz: number[][], consultas: number[][]): number {
  const linhas = matriz.length;
  const colunas = matriz[0].length;
  const prefixo = Array.from({ length: linhas + 1 }, () => new Array(colunas + 1).fill(0));
  for (let r = 0; r < linhas; r += 1) {
    for (let c = 0; c < colunas; c += 1) {
      prefixo[r + 1][c + 1] = matriz[r][c] + prefixo[r][c + 1] + prefixo[r + 1][c] - prefixo[r][c];
    }
  }
  let total = 0;
  for (const [a, b, c, d] of consultas) {
    const r1 = Math.min(a, c);
    const r2 = Math.max(a, c);
    const c1 = Math.min(b, d);
    const c2 = Math.max(b, d);
    total += prefixo[r2 + 1][c2 + 1] - prefixo[r1][c2 + 1] - prefixo[r2 + 1][c1] + prefixo[r1][c1];
  }
  return total;
}

function somaEmRetangulos(): Challenge {
  const random = createRandom(601400);
  const caso = (matriz: number[][], consultas: number[][]) => call([matriz, consultas], retangulosRef(matriz, consultas));
  const aleatorio = (linhas: number, colunas: number, q: number, limit: number) => {
    const matriz = Array.from({ length: linhas }, () => randomArray(random, colunas, -limit, limit));
    const consultas = Array.from({ length: q }, () => [
      randomInt(random, 0, linhas - 1),
      randomInt(random, 0, colunas - 1),
      randomInt(random, 0, linhas - 1),
      randomInt(random, 0, colunas - 1)
    ]);
    return caso(matriz, consultas);
  };
  const grande = (matrizSpec: Parameters<typeof gen>[0], lado: number, q: number, seed: number) => {
    const matriz = gen(matrizSpec);
    const consultas = gen({ $gen: "matrix", rows: q, cols: 4, min: 0, max: lado - 1, seed });
    return call([matriz.spec, consultas.spec], retangulosRef(matriz.value, consultas.value));
  };

  return defineChallenge({
    slug: "soma-em-retangulos",
    title: "Soma em retângulos",
    difficulty: "medium",
    moduleId: moduleId("prefixo"),
    position: 3,
    description: [
      "Implemente `somaEmRetangulos(matriz, consultas)`. Cada consulta `[r1, c1, r2, c2]` dá dois **cantos opostos** de um retângulo da matriz, `(r1, c1)` e `(r2, c2)`, e pede a soma de todas as células dentro dele (bordas incluídas).",
      "",
      "Os cantos podem vir em qualquer ordem: o retângulo vai da menor à maior linha e da menor à maior coluna entre os dois.",
      "",
      "Assim como em *Soma de intervalos*, a função retorna **a soma das respostas de todas as consultas** (um único número), para caber 10^5 consultas na saída.",
      "",
      "Em `[[1, 2, 3], [4, 5, 6], [7, 8, 9]]`, as consultas `[0, 0, 1, 1]`, `[1, 1, 2, 2]` e `[2, 0, 2, 2]` valem 12, 28 e 24: retorne `64`.",
      "",
      "Com uma matriz de 450 × 450 e 10^5 consultas, somar célula por célula estoura o tempo. Use prefixos em duas dimensões."
    ].join("\n"),
    constraints: [
      "1 <= linhas, colunas <= 500",
      "-1000 <= matriz[r][c] <= 1000",
      "1 <= consultas.length <= 10^5; cada consulta tem 4 valores, com linhas e colunas válidas.",
      "O total pode passar de 2^31: use long long em C."
    ],
    tags: ["Prefixo acumulado", "Matrizes"],
    functionSpec: {
      name: "somaEmRetangulos",
      params: [{ name: "matriz", type: "int[][]" }, { name: "consultas", type: "int[][]" }],
      returns: "long"
    },
    publicCases: [
      caso([[1, 2, 3], [4, 5, 6], [7, 8, 9]], [[0, 0, 1, 1], [1, 1, 2, 2], [2, 0, 2, 2]]),
      caso([[5, -2], [-3, 4]], [[1, 1, 0, 0], [1, 0, 1, 0]])
    ],
    hiddenCases: [
      caso([[7]], [[0, 0, 0, 0]]),
      caso([[1, 2, 3, 4]], [[0, 3, 0, 0], [0, 1, 0, 2]]),
      caso([[1], [2], [3]], [[2, 0, 0, 0], [1, 0, 1, 0]]),
      caso([[1, 2], [3, 4]], [[0, 1, 1, 0], [1, 0, 0, 1]]),
      caso([[-1000, -1000], [-1000, -1000]], [[0, 0, 1, 1]]),
      aleatorio(5, 5, 10, 10),
      aleatorio(20, 30, 100, 1000),
      aleatorio(60, 40, 1000, 1000),
      aleatorio(1, 200, 500, 1000),
      aleatorio(200, 1, 500, 1000),
      aleatorio(100, 100, 3000, 1000),
      grande({ $gen: "matrix", rows: 450, cols: 450, min: -1000, max: 1000, seed: 601401 }, 450, 60000, 601402),
      grande({ $gen: "repeat", n: 450, value: new Array(450).fill(1000) }, 450, 20000, 601404)
    ],
    hints: [
      "Defina `P[r][c]` como a soma do retângulo que vai de `(0, 0)` até `(r - 1, c - 1)`, com linha e coluna 0 zeradas.",
      "Monte `P` com inclusão e exclusão: `P[r+1][c+1] = m[r][c] + P[r][c+1] + P[r+1][c] - P[r][c]`.",
      "Depois de ordenar os cantos, a soma é `P[r2+1][c2+1] - P[r1][c2+1] - P[r2+1][c1] + P[r1][c1]`."
    ],
    editorial: [
      "**Ideia.** O prefixo 2D guarda a soma de cada retângulo encostado no canto superior esquerdo. Qualquer retângulo é esse retângulo grande menos duas faixas, somando de volta o canto que foi subtraído duas vezes.",
      "",
      "```js",
      "function somaEmRetangulos(m, consultas) {",
      "  const L = m.length, C = m[0].length;",
      "  const P = Array.from({ length: L + 1 }, () => new Array(C + 1).fill(0));",
      "  for (let r = 0; r < L; r++)",
      "    for (let c = 0; c < C; c++)",
      "      P[r + 1][c + 1] = m[r][c] + P[r][c + 1] + P[r + 1][c] - P[r][c];",
      "  let total = 0;",
      "  for (const [a, b, c, d] of consultas) {",
      "    const r1 = Math.min(a, c), r2 = Math.max(a, c);",
      "    const c1 = Math.min(b, d), c2 = Math.max(b, d);",
      "    total += P[r2 + 1][c2 + 1] - P[r1][c2 + 1] - P[r2 + 1][c1] + P[r1][c1];",
      "  }",
      "  return total;",
      "}",
      "```",
      "",
      "**Custo.** O(L·C) para montar e O(1) por consulta: O(L·C + q) de tempo e O(L·C) de memória. Somar célula por célula custaria O(L·C) por consulta."
    ].join("\n"),
    complexity: { time: "O(L·C + q)", space: "O(L·C)" }
  });
}

function divisiveisRef(nums: number[], k: number): number {
  const contagem = new Array(k).fill(0);
  contagem[0] = 1;
  let resto = 0;
  let total = 0;
  for (const value of nums) {
    resto = (((resto + value) % k) + k) % k;
    total += contagem[resto];
    contagem[resto] += 1;
  }
  return total;
}

function subvetoresDivisiveisPorK(): Challenge {
  const random = createRandom(601500);
  const caso = (nums: number[], k: number) => call([nums, k], divisiveisRef(nums, k));
  const grande = (spec: Parameters<typeof gen>[0], k: number) => {
    const nums = gen(spec);
    return call([nums.spec, k], divisiveisRef(nums.value, k));
  };

  const mesmoVetor = (spec: Parameters<typeof gen>[0], ks: number[]) => {
    const nums = gen(spec);
    return ks.map((k) => call([nums.spec, k], divisiveisRef(nums.value, k)));
  };

  return defineChallenge({
    slug: "subvetores-divisiveis-por-k",
    title: "Subvetores divisíveis por k",
    difficulty: "hard",
    moduleId: moduleId("prefixo"),
    position: 4,
    isBoss: true,
    description: [
      "Implemente `contarDivisiveis(nums, k)`, que retorna quantos trechos contíguos (não vazios) de `nums` têm soma **divisível por `k`** (resto zero; a soma 0 também conta).",
      "",
      "Em `[3, 1, 2, 6]` com `k = 3`, os trechos `[3]`, `[3, 1, 2]`, `[3, 1, 2, 6]`, `[1, 2]`, `[1, 2, 6]` e `[6]` servem: resposta `6`.",
      "",
      "Os valores podem ser **negativos**. Cuidado: em JavaScript, C e muitas outras linguagens, `-7 % 3` vale `-1`, não `2`. Dois prefixos com restos `-1` e `2` são equivalentes módulo 3, e o seu código precisa enxergar isso.",
      "",
      "Com 2·10^5 elementos, testar todos os pares de início e fim (O(n²)) estoura o tempo."
    ].join("\n"),
    constraints: [
      "1 <= nums.length <= 2·10^5",
      "-10^4 <= nums[i] <= 10^4",
      "1 <= k <= 10^4",
      "A quantidade pode passar de 2^31: use long long em C."
    ],
    tags: ["Prefixo acumulado", "Resto da divisão"],
    functionSpec: { name: "contarDivisiveis", params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }], returns: "long" },
    publicCases: [caso([3, 1, 2, 6], 3), caso([4, 1, 5, 2], 5)],
    hiddenCases: [
      caso([-1, 2, -1], 2),
      caso([-7, 3, 1], 3),
      caso([-3], 3),
      caso([-4], 3),
      caso([5], 1),
      caso([0, 0, 0], 7),
      caso([-10000, 10000, -9999], 10000),
      caso([2, -2, 2, -2], 4),
      caso(randomArray(random, 40, -10, 10), 4),
      caso(randomArray(random, 1000, -10000, 10000), 97),
      caso(randomArray(random, 5000, -10000, -1), 6),
      ...mesmoVetor({ $gen: "ints", n: 200000, min: -10000, max: 10000, seed: 601501 }, [7, 10000]),
      grande({ $gen: "repeat", n: 200000, value: -5 }, 5)
    ],
    hints: [
      "A soma do trecho `(i, j]` é divisível por `k` exatamente quando `prefixo[i]` e `prefixo[j]` deixam o mesmo resto na divisão por `k`.",
      "Conte quantos prefixos já tiveram cada resto (um vetor de tamanho `k` basta); cada novo prefixo forma um trecho válido com cada prefixo anterior de mesmo resto.",
      "Normalize o resto para ficar entre 0 e k - 1: `((r % k) + k) % k`. Sem isso, prefixos negativos caem em restos negativos e deixam de ser contados."
    ],
    editorial: [
      "**Ideia.** Prefixo com contagem, como em *Subvetores com soma k*, mas agrupando os prefixos pelo resto módulo `k`. Como só existem `k` restos, um vetor substitui o mapa.",
      "",
      "```c",
      "long long contarDivisiveis(int* nums, int numsSize, int k) {",
      "    long long *contagem = calloc(k, sizeof(long long)), total = 0;",
      "    int resto = 0;",
      "    contagem[0] = 1;",
      "    for (int i = 0; i < numsSize; i++) {",
      "        resto = ((resto + nums[i]) % k + k) % k;",
      "        total += contagem[resto]++;",
      "    }",
      "    free(contagem);",
      "    return total;",
      "}",
      "```",
      "",
      "**Custo.** O(n + k) de tempo e O(k) de memória. Guardar só o resto do prefixo (e não o prefixo inteiro) também evita qualquer estouro. Em Python, `%` já devolve resto não negativo; em JavaScript e C, não."
    ].join("\n"),
    complexity: { time: "O(n + k)", space: "O(k)" }
  });
}

// =====================================================================
// Guloso
// =====================================================================

function atividadesRef(intervalos: number[][]): number {
  const ordenados = [...intervalos].sort((a, b) => a[1] - b[1]);
  let livreEm = -Infinity;
  let total = 0;
  for (const [inicio, fim] of ordenados) {
    if (inicio >= livreEm) {
      total += 1;
      livreEm = fim;
    }
  }
  return total;
}

function maximoDeAtividades(): Challenge {
  const random = createRandom(601600);
  const caso = (intervalos: number[][]) => call([intervalos], atividadesRef(intervalos));
  const aleatorio = (n: number, horizonte: number, duracaoMaxima: number) =>
    caso(
      Array.from({ length: n }, () => {
        const inicio = randomInt(random, 0, horizonte - 1);
        return [inicio, Math.min(horizonte, inicio + randomInt(random, 1, duracaoMaxima))];
      })
    );

  return defineChallenge({
    slug: "maximo-de-atividades",
    title: "Máximo de atividades",
    difficulty: "easy",
    moduleId: moduleId("guloso"),
    position: 0,
    description: [
      "Uma sala recebe pedidos de uso. Cada pedido é um intervalo `[inicio, fim)`: a atividade ocupa a sala do instante `inicio` até **antes** de `fim`. Assim, uma atividade que termina em 5 e outra que começa em 5 **não** se sobrepõem.",
      "",
      "Implemente `maximoDeAtividades(intervalos)`, que retorna o **maior número de atividades** que cabem na sala sem sobreposição.",
      "",
      "Em `[[1, 4], [4, 5], [5, 7]]` cabem as três. Já em `[[0, 10], [1, 2], [3, 4]]` é melhor recusar a atividade longa e ficar com duas.",
      "",
      "Pense em qual atividade escolher primeiro. Nem todo critério que parece razoável funciona."
    ].join("\n"),
    constraints: [
      "1 <= intervalos.length <= 2000",
      "0 <= inicio < fim <= 10^9",
      "Intervalos podem se repetir."
    ],
    tags: ["Guloso", "Ordenação", "Intervalos"],
    functionSpec: { name: "maximoDeAtividades", params: [{ name: "intervalos", type: "int[][]" }], returns: "int" },
    publicCases: [caso([[1, 4], [4, 5], [5, 7]]), caso([[5, 9], [1, 2], [2, 5], [1, 3]])],
    hiddenCases: [
      caso([[0, 10], [1, 2], [3, 4]]),
      caso([[0, 1]]),
      caso([[2, 3], [2, 3], [2, 3]]),
      caso([[1, 10], [2, 9], [3, 8], [4, 7]]),
      caso([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]),
      caso([[0, 3], [2, 5], [4, 7], [6, 9]]),
      caso([[0, 1000000000], [0, 1], [999999999, 1000000000]]),
      caso([[5, 6], [1, 7], [2, 3], [3, 4]]),
      aleatorio(10, 30, 8),
      aleatorio(100, 1000, 100),
      aleatorio(500, 10000, 3000),
      aleatorio(2000, 1000000000, 1000000),
      aleatorio(2000, 1000000000, 500000000),
      aleatorio(2000, 5000, 3),
      aleatorio(2000, 100, 100)
    ],
    hints: [
      "Ordenar por início falha quando a primeira atividade é longa: ela bloqueia várias curtas.",
      "Qual atividade deixa a sala livre o mais cedo possível? Escolhê-la nunca atrapalha as escolhas seguintes.",
      "Ordene por fim e percorra: aceite a atividade se ela começa quando a sala já está livre (inicio >= fim da última aceita)."
    ],
    editorial: [
      "**Ideia.** Entre todas as atividades, a que termina primeiro é uma escolha segura: se uma solução ótima começa com outra atividade, trocar essa pela que termina primeiro não cria sobreposição e mantém a contagem. Repita com as que começam depois.",
      "",
      "```js",
      "function maximoDeAtividades(intervalos) {",
      "  const ordenados = [...intervalos].sort((a, b) => a[1] - b[1]);",
      "  let livreEm = -Infinity, total = 0;",
      "  for (const [inicio, fim] of ordenados) {",
      "    if (inicio >= livreEm) { total++; livreEm = fim; }",
      "  }",
      "  return total;",
      "}",
      "```",
      "",
      "**Custo.** O(n log n) pela ordenação e O(n) na passada. Ordenar por início ou pela menor duração tem contraexemplos; o critério do menor fim é o que tem prova de troca."
    ].join("\n"),
    complexity: { time: "O(n log n)", space: "O(n) para a cópia ordenada" }
  });
}

function biscoitosRef(fome: number[], biscoitos: number[]): number {
  const criancas = Float64Array.from(fome).sort();
  const tamanhos = Float64Array.from(biscoitos).sort();
  let satisfeitas = 0;
  for (const tamanho of tamanhos) {
    if (satisfeitas < criancas.length && tamanho >= criancas[satisfeitas]) satisfeitas += 1;
  }
  return satisfeitas;
}

function distribuirBiscoitos(): Challenge {
  const random = createRandom(601700);
  const caso = (fome: number[], biscoitos: number[]) => call([fome, biscoitos], biscoitosRef(fome, biscoitos));
  const grande = (fome: Parameters<typeof gen>[0], biscoitos: Parameters<typeof gen>[0]) => {
    const f = gen(fome);
    const b = gen(biscoitos);
    return call([f.spec, b.spec], biscoitosRef(f.value, b.value));
  };

  return defineChallenge({
    slug: "distribuir-biscoitos",
    title: "Distribuir biscoitos",
    difficulty: "easy",
    moduleId: moduleId("guloso"),
    position: 1,
    description: [
      "Cada criança `i` tem uma fome `fome[i]` e cada biscoito `j` tem um tamanho `biscoitos[j]`. A criança fica satisfeita se receber **um** biscoito de tamanho **maior ou igual** à sua fome. Cada criança recebe no máximo um biscoito e cada biscoito vai para no máximo uma criança.",
      "",
      "Implemente `distribuirBiscoitos(fome, biscoitos)`, que retorna o **maior número de crianças satisfeitas**.",
      "",
      "Com fomes `[1, 2, 3]` e biscoitos `[1, 1]`, só uma criança fica satisfeita. Com fomes `[4, 1]` e biscoitos `[5, 1]`, as duas ficam: o biscoito 5 precisa ir para a criança de fome 4.",
      "",
      "Pode haver 10^5 crianças e 10^5 biscoitos, em qualquer ordem."
    ].join("\n"),
    constraints: [
      "1 <= fome.length <= 10^5",
      "0 <= biscoitos.length <= 10^5",
      "1 <= fome[i], biscoitos[j] <= 10^9"
    ],
    tags: ["Guloso", "Ordenação", "Dois ponteiros"],
    functionSpec: {
      name: "distribuirBiscoitos",
      params: [{ name: "fome", type: "int[]" }, { name: "biscoitos", type: "int[]" }],
      returns: "int"
    },
    publicCases: [caso([1, 2, 3], [1, 1]), caso([1, 2], [1, 2, 3])],
    hiddenCases: [
      caso([4, 1], [5, 1]),
      caso([1, 2], [5, 1]),
      caso([3], []),
      caso([5], [4]),
      caso([5], [5]),
      caso([2, 2, 2], [3, 3]),
      caso([10, 9, 8, 7], [7, 8, 9, 10]),
      caso([1000000000, 1], [1, 1000000000]),
      caso(randomArray(random, 20, 1, 10), randomArray(random, 15, 1, 10)),
      caso(randomArray(random, 300, 1, 1000), randomArray(random, 500, 1, 1000)),
      caso(randomArray(random, 2000, 1, 1000000000), randomArray(random, 2000, 1, 1000000000)),
      grande({ $gen: "ints", n: 100000, min: 1, max: 1000000000, seed: 601701 }, { $gen: "ints", n: 100000, min: 1, max: 1000000000, seed: 601702 }),
      grande({ $gen: "perm", n: 100000, seed: 601705 }, { $gen: "perm", n: 100000, seed: 601706 })
    ],
    hints: [
      "Um biscoito grande dado a uma criança de pouca fome pode fazer falta para uma criança com muita fome.",
      "Ordene as fomes e os biscoitos. Percorra os biscoitos do menor para o maior e tente satisfazer a criança menos faminta que ainda falta.",
      "Se o biscoito atual não satisfaz essa criança, ele não satisfaz nenhuma outra: descarte-o."
    ],
    editorial: [
      "**Ideia.** Satisfaça sempre a criança de menor fome com o menor biscoito que serve. Se existe uma distribuição ótima diferente, dá para trocar biscoitos até chegar nessa sem perder crianças satisfeitas.",
      "",
      "```python",
      "def distribuirBiscoitos(fome, biscoitos):",
      "    fome = sorted(fome)",
      "    biscoitos = sorted(biscoitos)",
      "    satisfeitas = 0",
      "    for tamanho in biscoitos:",
      "        if satisfeitas < len(fome) and tamanho >= fome[satisfeitas]:",
      "            satisfeitas += 1",
      "    return satisfeitas",
      "```",
      "",
      "**Custo.** O(n log n + m log m) pelas ordenações e O(n + m) na passada com dois ponteiros. Dar à criança o primeiro biscoito que serve, na ordem da entrada, desperdiça biscoitos grandes."
    ].join("\n"),
    complexity: { time: "O(n log n + m log m)", space: "O(n + m)" }
  });
}

function podeChegarRef(saltos: number[]): boolean {
  let alcance = 0;
  for (let index = 0; index < saltos.length; index += 1) {
    if (index > alcance) return false;
    alcance = Math.max(alcance, index + saltos[index]);
  }
  return true;
}

function podeChegarAoFim(): Challenge {
  const random = createRandom(601800);
  const caso = (saltos: number[]) => call([saltos], podeChegarRef(saltos));
  const grande = (spec: Parameters<typeof gen>[0]) => {
    const saltos = gen(spec);
    return call([saltos.spec], podeChegarRef(saltos.value));
  };
  const aleatorio = (n: number, max: number) => caso(randomArray(random, n, 0, max));

  return defineChallenge({
    slug: "pode-chegar-ao-fim",
    title: "Pode chegar ao fim?",
    difficulty: "medium",
    moduleId: moduleId("guloso"),
    position: 2,
    description: [
      "Você começa na posição 0 do vetor `saltos`. Estando na posição `i`, pode pular para qualquer posição de `i + 1` até `i + saltos[i]` (um valor 0 significa que dali não sai).",
      "",
      "Implemente `podeChegarAoFim(saltos)`, que retorna `true` se dá para chegar à **última posição** e `false` caso contrário. Com um único elemento, você já está no fim.",
      "",
      "Em `[1, 2, 0, 1, 3]` o caminho 0 → 1 → 3 → 4 funciona. Em `[1, 1, 0, 2, 5]` todo caminho para no zero da posição 2.",
      "",
      "Com 2·10^5 posições e saltos longos, marcar todas as posições alcançáveis a partir de cada uma (O(n²)) estoura o tempo."
    ].join("\n"),
    constraints: ["1 <= saltos.length <= 2·10^5", "0 <= saltos[i] <= 10^5"],
    tags: ["Guloso"],
    functionSpec: { name: "podeChegarAoFim", params: [{ name: "saltos", type: "int[]" }], returns: "bool" },
    publicCases: [caso([2, 1, 1, 3, 1]), caso([1, 1, 0, 2, 5])],
    hiddenCases: [
      caso([2, 0, 1]),
      caso([0]),
      caso([0, 1]),
      caso([1, 0]),
      caso([3, 0, 0, 0]),
      caso([2, 0, 0, 0]),
      caso([1, 2, 0, 1, 3]),
      caso([4, 0, 0, 0, 0, 0]),
      caso([5, 0, 0, 0, 0, 1, 0]),
      aleatorio(20, 3),
      aleatorio(200, 9),
      aleatorio(2000, 4),
      caso([...randomArray(random, 1500, 3, 9), 0, 0, 5, ...randomArray(random, 1500, 0, 2)]),
      grande({ $gen: "concat", parts: [{ $gen: "ints", n: 90000, min: 1, max: 100000, seed: 601801 }, { $gen: "repeat", n: 110000, value: 0 }] }),
      grande({ $gen: "concat", parts: [{ $gen: "range", n: 100000, start: 100000, step: -1 }, { $gen: "repeat", n: 100000, value: 0 }] }),
      grande({ $gen: "concat", parts: [{ $gen: "range", n: 100000, start: 100000, step: -1 }, 100000, { $gen: "repeat", n: 99999, value: 0 }] })
    ],
    hints: [
      "Não é preciso saber o caminho, só até onde dá para chegar.",
      "Percorra o vetor da esquerda para a direita mantendo o alcance máximo visto até agora.",
      "Se a posição atual passou do alcance, ela é inalcançável e o fim também. Se o alcance chegou ao último índice, a resposta é `true`."
    ],
    editorial: [
      "**Ideia.** O conjunto de posições alcançáveis é sempre um prefixo `0..alcance` (se chego em `j`, chego em todas antes dela pelo mesmo salto). Então basta manter o maior alcance.",
      "",
      "```js",
      "function podeChegarAoFim(saltos) {",
      "  let alcance = 0;",
      "  for (let i = 0; i < saltos.length; i++) {",
      "    if (i > alcance) return false;",
      "    alcance = Math.max(alcance, i + saltos[i]);",
      "  }",
      "  return true;",
      "}",
      "```",
      "",
      "**Custo.** Uma passada: O(n) de tempo e O(1) de memória. A programação dinâmica que marca `i+1..i+saltos[i]` para cada posição custa a soma dos saltos, até O(n²). Um zero no meio não é o problema; o problema é um zero que nenhum salto anterior consegue pular."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function postoRef(gasolina: number[], custo: number[]): number {
  let total = 0;
  let tanque = 0;
  let inicio = 0;
  for (let index = 0; index < gasolina.length; index += 1) {
    const saldo = gasolina[index] - custo[index];
    total += saldo;
    tanque += saldo;
    if (tanque < 0) {
      tanque = 0;
      inicio = index + 1;
    }
  }
  return total < 0 ? -1 : inicio;
}

/** Quantos postos de partida completam a volta (para garantir resposta única). */
function partidasValidas(gasolina: number[], custo: number[]): number {
  const n = gasolina.length;
  const q = [0];
  for (let index = 0; index < n; index += 1) q.push(q[index] + gasolina[index] - custo[index]);
  const total = q[n];
  if (total < 0) return 0;
  const sufixo = new Array(n + 1).fill(Infinity);
  for (let s = n - 1; s >= 0; s -= 1) sufixo[s] = Math.min(sufixo[s + 1], q[s + 1]);
  let prefixo = Infinity;
  let validas = 0;
  for (let s = 0; s < n; s += 1) {
    if (q[s] <= sufixo[s] && q[s] <= prefixo + total) validas += 1;
    prefixo = Math.min(prefixo, q[s]);
  }
  return validas;
}

function completaVolta(gasolina: number[], custo: number[], inicio: number): boolean {
  let tanque = 0;
  for (let passo = 0; passo < gasolina.length; passo += 1) {
    const index = (inicio + passo) % gasolina.length;
    tanque += gasolina[index] - custo[index];
    if (tanque < 0) return false;
  }
  return true;
}

function postoDePartida(): Challenge {
  const random = createRandom(601900);
  const caso = (gasolina: number[], custo: number[]) => {
    const resposta = postoRef(gasolina, custo);
    if (resposta >= 0 && (partidasValidas(gasolina, custo) !== 1 || !completaVolta(gasolina, custo, resposta))) {
      throw new Error("posto-de-partida: resposta não única ou inválida");
    }
    return call([gasolina, custo], resposta);
  };
  // Com total exatamente 0, só o posto em que o prefixo atinge o mínimo
  // completa a volta; sorteia até esse mínimo ser único.
  const aleatorio = (n: number, max: number, possivel: boolean) => {
    for (;;) {
      let gasolina = randomArray(random, n, 0, max);
      let custo = randomArray(random, n, 0, max);
      if (!possivel) {
        if (postoRef(gasolina, custo) < 0) return call([gasolina, custo], -1);
        continue;
      }
      let excesso = sum(gasolina) - sum(custo);
      if (excesso < 0) {
        [gasolina, custo] = [custo, gasolina];
        excesso = -excesso;
      }
      const deslocamento = randomInt(random, 0, n - 1);
      for (let passo = 0; excesso > 0 && passo < n; passo += 1) {
        const index = (deslocamento + passo) % n;
        const tira = Math.min(excesso, gasolina[index]);
        gasolina[index] -= tira;
        excesso -= tira;
      }
      if (partidasValidas(gasolina, custo) === 1) return caso(gasolina, custo);
    }
  };
  // Trechos: A (saldo positivo), B (negativo, drena A) e C (positivo) com o
  // tamanho de C ajustado para o total ficar em [0, 10^4). O primeiro saldo de C
  // é 10^4, maior que o total, então só o início de C completa a volta.
  const estruturado = (seed: number, tamanhoA: number, tamanhoB: number, fechaVolta: boolean) => {
    const positivo = (n: number, s: number, set?: Record<string, number>) => ({
      gas: { $gen: "ints", n, min: 5001, max: 10000, seed: s, ...(set ? { set } : {}) } as const,
      custo: { $gen: "ints", n, min: 0, max: 5000, seed: s + 1, ...(set ? { set: { "0": 0 } } : {}) } as const
    });
    const negativo = (n: number, s: number) => ({
      gas: { $gen: "ints", n, min: 0, max: 4999, seed: s } as const,
      custo: { $gen: "ints", n, min: 5000, max: 10000, seed: s + 1 } as const
    });
    // Cada trecho é expandido uma vez só; o valor concatenado é montado à mão
    // (o gerador sorteia em sequência, então os primeiros t valores de um
    // trecho com n elementos são os mesmos de um trecho com t elementos).
    const a = positivo(tamanhoA, seed);
    const b = negativo(tamanhoB, seed + 2);
    const valores = [a, b].map((parte) => ({ gas: gen(parte.gas).value as number[], custo: gen(parte.custo).value as number[] }));
    const parcial = valores.reduce((total, parte) => total + sum(parte.gas) - sum(parte.custo), 0);
    const partes = [a, b];
    if (fechaVolta) {
      const cheio = positivo(200000 - tamanhoA - tamanhoB, seed + 4, { "0": 10000 });
      const gasC = gen(cheio.gas).value as number[];
      const custoC = gen(cheio.custo).value as number[];
      let saldo = parcial;
      let tamanhoC = 0;
      while (saldo < 0) {
        if (tamanhoC >= gasC.length) throw new Error("posto-de-partida: trecho C curto demais");
        saldo += gasC[tamanhoC] - custoC[tamanhoC];
        tamanhoC += 1;
      }
      partes.push(positivo(tamanhoC, seed + 4, { "0": 10000 }));
      valores.push({ gas: gasC.slice(0, tamanhoC), custo: custoC.slice(0, tamanhoC) });
    }
    const gasolina = valores.flatMap((parte) => parte.gas);
    const custo = valores.flatMap((parte) => parte.custo);
    const resposta = postoRef(gasolina, custo);
    const valido = fechaVolta
      ? resposta >= 0 && partidasValidas(gasolina, custo) === 1 && completaVolta(gasolina, custo, resposta)
      : resposta < 0;
    if (!valido) throw new Error("posto-de-partida: caso grande fora do esperado");
    const specs = (campo: "gas" | "custo") => ({ $gen: "concat", parts: partes.map((parte) => parte[campo]) });
    return call([specs("gas"), specs("custo")], resposta);
  };

  return defineChallenge({
    slug: "posto-de-partida",
    title: "Posto de partida",
    difficulty: "medium",
    moduleId: moduleId("guloso"),
    position: 3,
    description: [
      "Há `n` postos em uma estrada circular. No posto `i` você abastece `gasolina[i]` litros e, para ir dele até o posto `i + 1` (o seguinte ao último é o posto 0), gasta `custo[i]` litros. O tanque começa vazio e não tem limite de capacidade.",
      "",
      "Implemente `postoDePartida(gasolina, custo)`, que retorna o índice do posto de onde dá para **completar uma volta inteira** sem o tanque ficar negativo em nenhum trecho, ou `-1` se isso for impossível. Os casos garantem que, quando existe, esse posto é **único**.",
      "",
      "Com `gasolina = [4, 1, 5, 2]` e `custo = [3, 3, 2, 4]`, saindo do posto 2 o tanque fica com 3, 1, 2 e 0 litros ao fim de cada trecho: resposta `2`.",
      "",
      "Simular a volta a partir de cada posto custa O(n²) no pior caso."
    ].join("\n"),
    constraints: [
      "1 <= n <= 2·10^5 (gasolina e custo têm o mesmo tamanho)",
      "0 <= gasolina[i], custo[i] <= 10^4",
      "Chegar a um posto com o tanque exatamente em 0 é permitido.",
      "Quando existe, o posto de partida é único."
    ],
    tags: ["Guloso", "Prefixo acumulado"],
    functionSpec: {
      name: "postoDePartida",
      params: [{ name: "gasolina", type: "int[]" }, { name: "custo", type: "int[]" }],
      returns: "int"
    },
    publicCases: [caso([4, 1, 5, 2], [3, 3, 2, 4]), caso([2, 2, 2], [3, 3, 1])],
    hiddenCases: [
      caso([3, 0, 2, 0], [0, 4, 0, 1]),
      caso([5], [5]),
      caso([4], [5]),
      caso([0], [0]),
      caso([1, 2], [2, 1]),
      caso([0, 0, 10], [3, 3, 4]),
      caso([10000, 0, 0], [0, 5000, 5000]),
      aleatorio(8, 10, true),
      aleatorio(50, 100, true),
      aleatorio(50, 100, false),
      aleatorio(2000, 10000, true),
      estruturado(601901, 70000, 80000, true),
      estruturado(601921, 60000, 140000, false)
    ],
    hints: [
      "Se a soma de toda a gasolina é menor que a soma de todos os custos, nenhum posto serve.",
      "Simule a partir do posto 0. Se o tanque ficar negativo ao sair do posto `i`, nenhum posto entre o início atual e `i` serve como partida.",
      "Então recomece a partir de `i + 1` com o tanque zerado. Se o total for não negativo, o último recomeço é a resposta."
    ],
    editorial: [
      "**Ideia.** Suponha que, saindo de `s`, o tanque fique negativo pela primeira vez no trecho que sai de `i`. Qualquer posto `t` entre `s` e `i` chegaria em `i` com **menos** combustível (perderia o saldo não negativo de `s..t-1`), então também falharia. Podemos pular direto para `i + 1`.",
      "",
      "```js",
      "function postoDePartida(gasolina, custo) {",
      "  let total = 0, tanque = 0, inicio = 0;",
      "  for (let i = 0; i < gasolina.length; i++) {",
      "    const saldo = gasolina[i] - custo[i];",
      "    total += saldo;",
      "    tanque += saldo;",
      "    if (tanque < 0) { tanque = 0; inicio = i + 1; }",
      "  }",
      "  return total < 0 ? -1 : inicio;",
      "}",
      "```",
      "",
      "**Custo.** Uma passada: O(n) de tempo e O(1) de memória. Quando o total é não negativo, o último recomeço cobre o resto da volta porque o saldo que sobra compensa os trechos negativos do começo."
    ].join("\n"),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function salasRef(reunioes: number[][]): number {
  const inicios = Float64Array.from(reunioes, ([inicio]) => inicio).sort();
  const fins = Float64Array.from(reunioes, ([inicio, duracao]) => inicio + duracao).sort();
  let ocupadas = 0;
  let maximo = 0;
  let j = 0;
  for (const inicio of inicios) {
    while (fins[j] <= inicio) {
      j += 1;
      ocupadas -= 1;
    }
    ocupadas += 1;
    maximo = Math.max(maximo, ocupadas);
  }
  return maximo;
}

function minimoDeSalas(): Challenge {
  const random = createRandom(602000);
  const caso = (reunioes: number[][]) => call([reunioes], salasRef(reunioes));
  const aleatorio = (n: number, horizonte: number, duracaoMaxima: number) =>
    caso(Array.from({ length: n }, () => [randomInt(random, 0, horizonte), randomInt(random, 1, duracaoMaxima)]));
  const grande = (spec: Parameters<typeof gen>[0]) => {
    const reunioes = gen(spec);
    return call([reunioes.spec], salasRef(reunioes.value));
  };

  return defineChallenge({
    slug: "minimo-de-salas",
    title: "Mínimo de salas",
    difficulty: "hard",
    moduleId: moduleId("guloso"),
    position: 4,
    isBoss: true,
    description: [
      "Uma empresa recebeu a agenda do dia: cada reunião é um par `[inicio, duracao]` e ocupa uma sala no intervalo `[inicio, inicio + duracao)`. Uma reunião que termina no instante `t` libera a sala para outra que começa em `t`.",
      "",
      "Implemente `minimoDeSalas(reunioes)`, que retorna o **menor número de salas** para realizar todas as reuniões sem conflito.",
      "",
      "Com `[[9, 2], [10, 3], [14, 1]]` (das 9 às 11, das 10 às 13 e das 14 às 15), as duas primeiras se sobrepõem: resposta `2`.",
      "",
      "A resposta é o maior número de reuniões acontecendo ao mesmo tempo. Com 10^5 reuniões, comparar todas com todas (O(n²)) estoura o tempo: ordene os eventos de início e fim, ou use um heap com os horários de término."
    ].join("\n"),
    constraints: [
      "1 <= reunioes.length <= 10^5",
      "0 <= inicio <= 10^9 e 1 <= duracao <= 10^9 (o fim cabe em int: no máximo 2·10^9)",
      "Os intervalos são semiabertos: terminar em t e começar em t não é conflito."
    ],
    tags: ["Guloso", "Ordenação", "Intervalos"],
    functionSpec: { name: "minimoDeSalas", params: [{ name: "reunioes", type: "int[][]" }], returns: "int" },
    publicCases: [caso([[9, 2], [10, 3], [14, 1]]), caso([[0, 30], [5, 5], [15, 5]])],
    hiddenCases: [
      caso([[1, 2], [3, 2]]),
      caso([[5, 1]]),
      caso([[0, 10], [0, 10], [0, 10]]),
      caso([[0, 1], [1, 1], [2, 1], [3, 1]]),
      caso([[0, 5], [5, 5], [2, 6], [8, 1]]),
      caso([[1000000000, 1000000000], [0, 1000000000], [999999999, 2]]),
      caso([[10, 5], [0, 100], [20, 5], [12, 10], [30, 1]]),
      aleatorio(10, 20, 5),
      aleatorio(100, 1000, 100),
      aleatorio(1000, 100000, 5000),
      aleatorio(2000, 1000000000, 1000000000),
      aleatorio(2000, 20, 20),
      grande({ $gen: "matrix", rows: 100000, cols: 2, min: 1, max: 100000, seed: 602001 }),
      grande({ $gen: "repeat", n: 100000, value: [7, 1] })
    ],
    hints: [
      "Em que momento o número de salas ocupadas aumenta? E quando diminui?",
      "Separe os horários de início e os de fim e ordene cada lista. Percorra os inícios; antes de contar cada um, libere as salas de todas as reuniões que já terminaram (fim <= inicio).",
      "Alternativa: ordene as reuniões por início e mantenha um heap de mínimo com os fins das reuniões em andamento; o tamanho máximo do heap é a resposta."
    ],
    editorial: [
      "**Ideia.** Varra a linha do tempo. Cada início ocupa uma sala e cada fim libera uma. A resposta é o pico de salas ocupadas. Com os inícios e os fins ordenados separadamente, dois ponteiros fazem a varredura; em empate, o fim vem antes (intervalo semiaberto).",
      "",
      "```js",
      "function minimoDeSalas(reunioes) {",
      "  const inicios = reunioes.map(([i]) => i).sort((a, b) => a - b);",
      "  const fins = reunioes.map(([i, d]) => i + d).sort((a, b) => a - b);",
      "  let ocupadas = 0, pico = 0, j = 0;",
      "  for (const inicio of inicios) {",
      "    while (fins[j] <= inicio) { j++; ocupadas--; }",
      "    ocupadas++;",
      "    pico = Math.max(pico, ocupadas);",
      "  }",
      "  return pico;",
      "}",
      "```",
      "",
      "**Custo.** O(n log n) pelas ordenações e O(n) na varredura, com O(n) de memória. Usar `fim < inicio` no laço (tratando o intervalo como fechado) conta uma sala a mais quando uma reunião começa exatamente quando outra termina."
    ].join("\n"),
    complexity: { time: "O(n log n)", space: "O(n)" }
  });
}

export function buildAlgoritmosPadroesChallenges(): Challenge[] {
  return [
    parComSomaNoOrdenado(),
    moverZerosParaOFim(),
    quadradosEmOrdem(),
    maiorReservatorio(),
    triosComSomaZero(),
    maiorSomaDeKSeguidos(),
    menorSubvetorComSomaMinima(),
    contarAnagramasNaJanela(),
    maiorSequenciaDeUnsComKTrocas(),
    menorJanelaQueContem(),
    somaDeIntervalos(),
    indiceDeEquilibrio(),
    subvetoresComSomaK(),
    somaEmRetangulos(),
    subvetoresDivisiveisPorK(),
    maximoDeAtividades(),
    distribuirBiscoitos(),
    podeChegarAoFim(),
    postoDePartida(),
    minimoDeSalas()
  ];
}
