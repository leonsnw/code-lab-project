import type { Challenge, SourceRule } from "../../domain/types.js";
import {
  call,
  createRandom,
  defineChallenge,
  gen,
  language,
  pick,
  randomArray,
  randomInt,
  randomWord,
  shuffle,
  type CaseDefinition
} from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Fundamentos de Programação", módulos Vetores, Matrizes e Strings.
 * Todos os desafios estão no modo função e aceitam JavaScript, Python e C.
 * Sementes na faixa 200000–299999.
 */

const VETORES = moduleId("vetores");
const MATRIZES = moduleId("matrizes");
const STRINGS = moduleId("strings");

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// ============================================================
// Vetores
// ============================================================

function somaDoVetor(): Challenge {
  const random = createRandom(200100);
  const hidden: CaseDefinition[] = [];
  const add = (nums: number[]) => hidden.push(call([nums], sum(nums)));
  add([]);
  add([42]);
  add([-7]);
  add([0, 0, 0]);
  add([1000000000, 1000000000, 1000000000]);
  add([-1000000000, -1000000000, -1000000000, -1000000000]);
  add([1000000000, -1000000000, 1000000000, -1000000000, 7]);
  add([999999999, 999999999, 999999999, 999999999, 999999999, 999999999]);
  add(randomArray(random, 10, -100, 100));
  add(randomArray(random, 50, 1, 9));
  add(randomArray(random, 1000, -1000000000, 1000000000));
  add(randomArray(random, 5000, -1000000, 1000000));
  for (const spec of [
    gen({ $gen: "ints", n: 100000, min: -1000000000, max: 1000000000, seed: 200101 }),
    gen({ $gen: "repeat", n: 200000, value: 1000000000 })
  ]) {
    hidden.push(call([spec.spec], sum(spec.value)));
  }

  return defineChallenge({
    slug: "soma-do-vetor",
    title: "Soma do vetor",
    difficulty: "easy",
    moduleId: VETORES,
    position: 0,
    description: `Implemente a função \`somaDoVetor(nums)\`, que recebe um vetor de inteiros e retorna a **soma de todos os elementos**.

A ideia é usar um **acumulador**: uma variável que começa em zero e recebe cada elemento, um de cada vez, enquanto você percorre o vetor do primeiro ao último índice.

- Se o vetor estiver **vazio**, a soma é \`0\`.
- Os valores podem ser **negativos**.
- A soma pode passar de 2 bilhões, que é mais do que cabe num \`int\` de 32 bits. Em C o retorno é \`long long\`: use um acumulador desse tipo.

**Exemplo:** para \`[3, 1, 4, 1, 5]\`, a resposta é \`3 + 1 + 4 + 1 + 5 = 14\`.

Em C, a função recebe também \`numsSize\`, a quantidade de elementos do vetor.`,
    constraints: [
      "0 <= tamanho de nums <= 2 * 10^5",
      "-10^9 <= nums[i] <= 10^9",
      "Retorne o valor; não é preciso ler a entrada nem imprimir."
    ],
    tags: ["Vetores", "Acumulador"],
    functionSpec: { name: "somaDoVetor", params: [{ name: "nums", type: "int[]" }], returns: "long" },
    publicCases: [call([[3, 1, 4, 1, 5]], 14), call([[-5, 10, -3]], 2)],
    hiddenCases: hidden,
    hints: [
      "Crie uma variável que começa em 0 e, dentro de um laço, some a ela cada elemento do vetor.",
      "Se o vetor for vazio, o laço não executa nenhuma vez e o acumulador continua valendo 0, que é a resposta certa.",
      "Em C, declare o acumulador como long long: com 200 mil valores de até 10^9, a soma chega a 2 * 10^14."
    ],
    editorial: `## Ideia

Percorra o vetor uma única vez, somando cada elemento a um acumulador que começa em zero. O vetor vazio não precisa de tratamento especial: o laço simplesmente não roda e a função retorna 0.

## Passo a passo

1. Declare \`soma = 0\` (em C, do tipo \`long long\`).
2. Para cada índice \`i\` de 0 até \`numsSize - 1\`, faça \`soma += nums[i]\`.
3. Retorne \`soma\`.

\`\`\`c
long long somaDoVetor(int* nums, int numsSize) {
    long long soma = 0;
    for (int i = 0; i < numsSize; i++) {
        soma += nums[i];
    }
    return soma;
}
\`\`\`

## Armadilha

Com \`int soma\`, a soma de três valores de 10^9 já estoura o limite de 32 bits (cerca de 2,1 * 10^9). Com \`float\`, sobram só uns 7 dígitos significativos e somas grandes perdem precisão.

## Custo

Cada elemento é visitado uma vez: tempo O(n) e memória extra O(1).`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function maiorEMenor(): Challenge {
  const random = createRandom(200200);
  const answer = (nums: number[]) => {
    let maior = nums[0];
    let menor = nums[0];
    for (const value of nums) {
      if (value > maior) maior = value;
      if (value < menor) menor = value;
    }
    return [maior, menor];
  };
  const hidden: CaseDefinition[] = [];
  const add = (nums: number[]) => hidden.push(call([nums], answer(nums)));
  add([-3]);
  add([-5, -1, -9]);
  add([0]);
  add([0, 0, 0]);
  add([1000000000, -1000000000]);
  add([-1000000000]);
  add([2, 2, 2, 2]);
  add([-2, -2]);
  add([1, 2, 3, 4, 5, 6]);
  add([6, 5, 4, 3, 2, 1]);
  add(randomArray(random, 20, -50, 50));
  add(randomArray(random, 1000, -1000000000, -1));
  for (const spec of [
    gen({ $gen: "ints", n: 100000, min: -1000000000, max: 1000000000, seed: 200201 }),
    gen({ $gen: "ints", n: 100000, min: -1000, max: 1000, seed: 200203, set: { "0": -5000, "99999": 5000 } })
  ]) {
    hidden.push(call([spec.spec], answer(spec.value)));
  }

  return defineChallenge({
    slug: "maior-e-menor",
    title: "Maior e menor do vetor",
    difficulty: "easy",
    moduleId: VETORES,
    position: 1,
    description: `Implemente a função \`maiorEMenor(nums)\`, que recebe um vetor de inteiros com **pelo menos um elemento** e retorna um vetor com dois valores: \`[maior, menor]\`.

Para encontrar o maior, guarde um "candidato" e percorra o vetor: sempre que aparecer um valor maior que o candidato, ele passa a ser o novo candidato. O menor funciona do mesmo jeito, com a comparação invertida.

- Os valores podem ser **todos negativos**.
- Se o vetor tiver um só elemento, ele é ao mesmo tempo o maior e o menor.

**Exemplo:** para \`[3, 9, -2, 7]\`, a resposta é \`[9, -2]\`.

Em C, aloque o vetor de resposta com \`malloc\` (2 posições) e informe o tamanho em \`*returnSize = 2\`.`,
    constraints: [
      "1 <= tamanho de nums <= 2 * 10^5",
      "-10^9 <= nums[i] <= 10^9",
      "Retorne [maior, menor], nessa ordem."
    ],
    tags: ["Vetores", "Busca linear"],
    functionSpec: { name: "maiorEMenor", params: [{ name: "nums", type: "int[]" }], returns: "int[]" },
    publicCases: [call([[3, 9, -2, 7]], [9, -2]), call([[5]], [5, 5])],
    hiddenCases: hidden,
    hints: [
      "Você precisa de duas variáveis, uma para o maior e outra para o menor, atualizadas no mesmo laço.",
      "Com que valor elas devem começar? Pense num vetor em que todos os números são negativos.",
      "Comece as duas com o primeiro elemento do vetor, nums[0]: ele sempre existe e é um candidato válido."
    ],
    editorial: `## Ideia

Uma única passada pelo vetor basta: mantemos o maior e o menor vistos até agora e comparamos cada novo elemento com os dois.

## O valor inicial

Começar o maior com \`0\` parece natural, mas está errado: em \`[-5, -1, -9]\` nenhum elemento é maior que 0 e a função responderia 0, um número que nem está no vetor. O jeito seguro é começar **com o primeiro elemento**.

\`\`\`js
function maiorEMenor(nums) {
  let maior = nums[0];
  let menor = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] > maior) maior = nums[i];
    if (nums[i] < menor) menor = nums[i];
  }
  return [maior, menor];
}
\`\`\`

## Custo

Tempo O(n) e memória extra O(1).`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

const NO_REVERSE_SHORTCUT: SourceRule = {
  kind: "forbid",
  pattern: "\\.reverse\\b|\\.toReversed\\b|\\breversed\\s*\\(|\\[\\s*:\\s*:\\s*-",
  message: "Inverta o vetor com um laço: atalhos prontos como reverse(), toReversed(), reversed() e o fatiamento [::-1] não são permitidos."
};

function inverterVetor(): Challenge {
  const random = createRandom(200300);
  const reverse = (nums: number[]) => [...nums].reverse();
  const hidden: CaseDefinition[] = [];
  const add = (nums: number[]) => hidden.push(call([nums], reverse(nums)));
  add([]);
  add([7]);
  add([1, 1, 2]);
  add([1, 2, 1]);
  add([0, 0]);
  add([-1, -2, -3, -4]);
  add([10000, -10000]);
  add(randomArray(random, 10, -100, 100));
  add(randomArray(random, 101, -10000, 10000));
  add(randomArray(random, 1000, -10000, 10000));
  for (const spec of [
    gen({ $gen: "range", n: 5000, start: 1 }),
    gen({ $gen: "ints", n: 5000, min: -10000, max: 10000, seed: 200301 }),
    gen({ $gen: "ints", n: 4999, min: -10000, max: 10000, seed: 200302 }),
    gen({ $gen: "repeat", n: 5000, value: -9999 })
  ]) {
    hidden.push(call([spec.spec], reverse(spec.value)));
  }

  return defineChallenge({
    slug: "inverter-vetor",
    title: "Inverter vetor",
    difficulty: "easy",
    moduleId: VETORES,
    position: 2,
    description: `Implemente a função \`inverterVetor(nums)\`, que retorna os elementos de \`nums\` em **ordem inversa**: o último vira o primeiro, o penúltimo vira o segundo, e assim por diante.

O objetivo é praticar o trabalho com **índices**, então os atalhos prontos das linguagens estão proibidos: nada de \`reverse()\`, \`toReversed()\`, \`reversed()\` ou do fatiamento \`[::-1]\`. Use um laço.

- O vetor pode estar **vazio**; nesse caso, retorne um vetor vazio.
- Você pode montar um vetor novo ou trocar os elementos dentro do próprio vetor e retorná-lo.

**Exemplo:** para \`[1, 2, 3, 4, 5]\`, a resposta é \`[5, 4, 3, 2, 1]\`.

Em C, retorne um vetor (pode ser o próprio \`nums\`) e informe o tamanho em \`*returnSize\`.`,
    constraints: [
      "0 <= tamanho de nums <= 5000",
      "-10^4 <= nums[i] <= 10^4",
      "Proibido: reverse(), toReversed(), reversed() e [::-1]."
    ],
    tags: ["Vetores", "Índices"],
    functionSpec: { name: "inverterVetor", params: [{ name: "nums", type: "int[]" }], returns: "int[]" },
    languages: [language("javascript", [NO_REVERSE_SHORTCUT]), language("python", [NO_REVERSE_SHORTCUT]), language("c")],
    publicCases: [call([[1, 2, 3, 4, 5]], [5, 4, 3, 2, 1]), call([[10, -3]], [-3, 10])],
    hiddenCases: hidden,
    hints: [
      "Num vetor de tamanho n, o elemento da posição i vai para a posição n - 1 - i.",
      "Outra forma: use dois índices, um no começo e outro no fim, troque os elementos e aproxime os índices até eles se cruzarem."
    ],
    editorial: `## Ideia

Use dois índices: \`i\` começa no primeiro elemento e \`j\` no último. Troque \`nums[i]\` com \`nums[j]\`, avance \`i\` e recue \`j\`. Quando \`i\` alcançar \`j\`, o vetor está invertido. Se o tamanho for ímpar, o elemento do meio fica onde está.

\`\`\`c
int* inverterVetor(int* nums, int numsSize, int* returnSize) {
    int i = 0, j = numsSize - 1;
    while (i < j) {
        int temp = nums[i];
        nums[i] = nums[j];
        nums[j] = temp;
        i++;
        j--;
    }
    *returnSize = numsSize;
    return nums;
}
\`\`\`

## Armadilha

Se o laço for até o fim do vetor (e não só até a metade), cada par é trocado duas vezes e o vetor volta à ordem original.

## Custo

Tempo O(n) e memória extra O(1) (as trocas são feitas no próprio vetor).`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function contarOcorrencias(): Challenge {
  const random = createRandom(200400);
  const count = (nums: number[], x: number) => nums.filter((value) => value === x).length;
  const hidden: CaseDefinition[] = [];
  const add = (nums: number[], x: number) => hidden.push(call([nums, x], count(nums, x)));
  add([5], 5);
  add([], 3);
  add([5], 4);
  add([1, 2, 3], 3);
  add([8, 8, 8, 8], 8);
  add([0, 3, 3, 0, 3, 9, 3], 3);
  add([-1, 2, -1, 3, -1], -1);
  add([1, 2, 3, 4], 0);
  add([1000000000, -1000000000, 1000000000], 1000000000);
  const small = randomArray(random, 30, 0, 5);
  add(small, 2);
  const medium = randomArray(random, 2000, -10, 10);
  add(medium, -10);
  const tail = randomArray(random, 100, 1, 3);
  add(tail, tail[tail.length - 1]);
  const cases: Array<[{ spec: any; value: any }, number]> = [
    [gen({ $gen: "ints", n: 100000, min: -1000000000, max: 1000000000, seed: 200402, set: { "7": 123456789, "99999": 123456789 } }), 123456789],
    [gen({ $gen: "repeat", n: 200000, value: 7 }), 7]
  ];
  for (const [spec, x] of cases) hidden.push(call([spec.spec, x], count(spec.value, x)));

  return defineChallenge({
    slug: "contar-ocorrencias",
    title: "Contar ocorrências",
    difficulty: "easy",
    moduleId: VETORES,
    position: 3,
    description: `Implemente a função \`contarOcorrencias(nums, x)\`, que retorna **quantas vezes** o valor \`x\` aparece no vetor \`nums\`.

Este é o padrão do **contador**: uma variável que começa em zero e é incrementada toda vez que a condição (\`nums[i] == x\`) for verdadeira.

- Se \`x\` não aparecer, ou se o vetor estiver vazio, a resposta é \`0\`.
- Confira todas as posições, **inclusive a primeira e a última**.

**Exemplo:** em \`[1, 2, 3, 2, 2, 5]\`, o valor \`2\` aparece \`3\` vezes.

Em C, a função recebe também \`numsSize\`, a quantidade de elementos do vetor.`,
    constraints: [
      "0 <= tamanho de nums <= 2 * 10^5",
      "-10^9 <= nums[i], x <= 10^9"
    ],
    tags: ["Vetores", "Contador"],
    functionSpec: {
      name: "contarOcorrencias",
      params: [{ name: "nums", type: "int[]" }, { name: "x", type: "int" }],
      returns: "int"
    },
    publicCases: [call([[1, 2, 3, 2, 2, 5], 2], 3), call([[7, 1, 7, 3], 9], 0)],
    hiddenCases: hidden,
    hints: [
      "Percorra o vetor inteiro e, a cada elemento igual a x, some 1 a um contador.",
      "Revise os limites do seu laço: com n elementos, os índices vão de 0 até n - 1, inclusive."
    ],
    editorial: `## Ideia

Visite cada posição uma vez e conte as que têm o valor procurado.

\`\`\`python
def contarOcorrencias(nums, x):
    contador = 0
    for valor in nums:
        if valor == x:
            contador += 1
    return contador
\`\`\`

## Armadilha

Um laço como \`for (i = 0; i < n - 1; i++)\` deixa a última posição de fora. Ele passa em muitos testes e só falha quando \`x\` está justamente no fim do vetor, o que torna o erro difícil de perceber. Teste sempre um vetor de um elemento só.

## Custo

Tempo O(n) e memória extra O(1).`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function removerDuplicados(): Challenge {
  const random = createRandom(200500);
  const dedupe = (nums: number[]) => nums.filter((value, index) => index === 0 || value !== nums[index - 1]);
  const sortedRandom = (n: number, min: number, max: number) => randomArray(random, n, min, max).sort((a, b) => a - b);
  const hidden: CaseDefinition[] = [];
  const add = (nums: number[]) => hidden.push(call([nums], dedupe(nums)));
  add([7, 7, 7]);
  add([]);
  add([4]);
  add([1, 2, 3]);
  add([5, 5, 5, 5, 5]);
  add([-3, -3, -3, -1, 0, 0, 0, 0, 2]);
  add([-10000, 10000]);
  add(sortedRandom(20, 0, 5));
  add(sortedRandom(200, -50, 50));
  add(sortedRandom(3000, -10000, 10000));
  for (const spec of [
    gen({ $gen: "ints", n: 40000, min: -2000, max: 2000, seed: 200501, sorted: "asc" }),
    gen({ $gen: "repeat", n: 50000, value: -10000 }),
    gen({ $gen: "range", n: 5000, start: -2500 }),
    gen({
      $gen: "concat",
      parts: [
        { $gen: "repeat", n: 30000, value: -5 },
        { $gen: "repeat", n: 30000, value: 0 },
        { $gen: "repeat", n: 1, value: 3 },
        { $gen: "repeat", n: 39999, value: 10000 }
      ]
    })
  ]) {
    hidden.push(call([spec.spec], dedupe(spec.value)));
  }

  return defineChallenge({
    slug: "remover-duplicados-de-ordenado",
    title: "Remover duplicados de um vetor ordenado",
    difficulty: "medium",
    moduleId: VETORES,
    position: 4,
    description: `Implemente a função \`removerDuplicados(nums)\`. O vetor \`nums\` já vem **ordenado em ordem crescente** e pode ter valores repetidos. Retorne um vetor com cada valor **uma única vez**, mantendo a ordem crescente.

Como o vetor está ordenado, os valores iguais ficam **sempre lado a lado**. Isso simplifica bastante: para saber se um elemento é repetido, basta compará-lo com o elemento anterior.

- Um mesmo valor pode aparecer muitas vezes seguidas (não só duas).
- O vetor pode estar vazio; nesse caso, retorne um vetor vazio.

**Exemplo:** para \`[1, 1, 2, 3, 3]\`, a resposta é \`[1, 2, 3]\`.

Em C, você pode escrever o resultado no início do próprio \`nums\` (ou num vetor alocado com \`malloc\`) e informar a quantidade de valores em \`*returnSize\`.`,
    constraints: [
      "0 <= tamanho de nums <= 10^5",
      "-10^4 <= nums[i] <= 10^4",
      "nums está em ordem crescente (não decrescente)."
    ],
    tags: ["Vetores", "Dois índices"],
    functionSpec: { name: "removerDuplicados", params: [{ name: "nums", type: "int[]" }], returns: "int[]" },
    publicCases: [call([[1, 1, 2, 3, 3]], [1, 2, 3]), call([[-2, 0, 0, 5]], [-2, 0, 5])],
    hiddenCases: hidden,
    hints: [
      "Um elemento entra na resposta se for o primeiro do vetor ou se for diferente do elemento imediatamente anterior.",
      "Para fazer isso sem vetor extra, use um índice de escrita: ele marca onde o próximo valor novo deve ser colocado."
    ],
    editorial: `## Ideia

Os repetidos estão agrupados. Percorremos o vetor com um índice de leitura \`i\` e mantemos um índice de escrita \`k\`, que indica quantos valores distintos já foram guardados. Sempre que \`nums[i]\` for diferente do último valor guardado, ele é copiado para a posição \`k\`.

\`\`\`c
int* removerDuplicados(int* nums, int numsSize, int* returnSize) {
    int k = 0;
    for (int i = 0; i < numsSize; i++) {
        if (k == 0 || nums[i] != nums[k - 1]) {
            nums[k] = nums[i];
            k++;
        }
    }
    *returnSize = k;
    return nums;
}
\`\`\`

## Armadilha

Pular dois elementos quando encontra um par igual funciona com \`[1, 1, 2]\`, mas não com \`[7, 7, 7]\`: um valor pode se repetir quantas vezes quiser. Compare sempre com o último valor aceito.

## Custo

Tempo O(n) e memória extra O(1), já que o resultado é escrito no próprio vetor.`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function segundoMaior(): Challenge {
  const random = createRandom(200600);
  const answer = (nums: number[]) => {
    const maior = nums.reduce((best, value) => Math.max(best, value), -Infinity);
    let segundo = -Infinity;
    for (const value of nums) if (value < maior && value > segundo) segundo = value;
    if (segundo === -Infinity) throw new Error("segundo-maior: caso sem dois valores distintos");
    return segundo;
  };
  const hidden: CaseDefinition[] = [];
  const add = (nums: number[]) => hidden.push(call([nums], answer(nums)));
  add([9, 9, 4]);
  add([5, 5, 5, 2, 5]);
  add([-1, -2]);
  add([-5, -5, -3, -3]);
  add([1000000000, -1000000000]);
  add([1, 2, 2]);
  add([0, 1, 1, 1]);
  add([2, 1]);
  add([3, 0, 3, 1, 3, 2, 0]);
  add([3, 3, 3, 3, 3, 3, 3, 4]);
  add(randomArray(random, 15, -20, 20));
  add(randomArray(random, 1000, -1000000000, 1000000000));
  add(randomArray(random, 3000, -1000000000, -1).sort((a, b) => b - a));
  for (const spec of [
    gen({ $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 200601 }),
    gen({ $gen: "ints", n: 100000, min: -100, max: 100, seed: 200603, set: { "5": 1000, "100": 1000, "70000": 1000, "99999": 1000 } })
  ]) {
    hidden.push(call([spec.spec], answer(spec.value)));
  }

  return defineChallenge({
    slug: "segundo-maior",
    title: "Segundo maior valor",
    difficulty: "medium",
    moduleId: VETORES,
    position: 5,
    description: `Implemente a função \`segundoMaior(nums)\`, que retorna o **segundo maior valor distinto** do vetor.

"Distinto" quer dizer que valores repetidos contam uma vez só. Em \`[9, 9, 4]\` o maior é \`9\` e o segundo maior é \`4\` (e não \`9\` de novo).

- O vetor tem **pelo menos dois valores diferentes**, então a resposta sempre existe.
- Os valores podem ser negativos, e o maior pode aparecer várias vezes, em qualquer posição.

**Exemplos:**

- \`[4, 9, 1, 7]\` → \`7\`
- \`[5, 5, 5, 2, 5]\` → \`2\`

Tente resolver em **uma só passada** pelo vetor, sem ordená-lo.

Em C, a função recebe também \`numsSize\`, a quantidade de elementos do vetor.`,
    constraints: [
      "2 <= tamanho de nums <= 2 * 10^5",
      "-10^9 <= nums[i] <= 10^9",
      "Há pelo menos dois valores distintos em nums."
    ],
    tags: ["Vetores", "Busca linear"],
    functionSpec: { name: "segundoMaior", params: [{ name: "nums", type: "int[]" }], returns: "int" },
    publicCases: [call([[4, 9, 1, 7]], 7), call([[3, 5]], 3)],
    hiddenCases: hidden,
    hints: [
      "Ordenar e pegar o penúltimo elemento falha quando o maior valor se repete. Pense em [9, 9, 4].",
      "Guarde duas variáveis: o maior e o segundo maior vistos até agora.",
      "Para cada valor v: se v > maior, o antigo maior vira o segundo e v vira o maior; senão, se v < maior e v > segundo, v vira o segundo."
    ],
    editorial: `## Ideia

Mantenha o maior e o segundo maior encontrados até agora. Um valor novo pode:

1. ser **maior que o maior**: o maior antigo desce para segundo, e o valor novo assume o primeiro lugar;
2. ficar **estritamente entre** o segundo e o maior: ele vira o novo segundo;
3. ser igual ao maior ou menor que o segundo: não muda nada.

A condição \`v < maior\` do caso 2 é o que garante que repetições do maior sejam ignoradas.

\`\`\`js
function segundoMaior(nums) {
  let maior = -Infinity;
  let segundo = -Infinity;
  for (const v of nums) {
    if (v > maior) {
      segundo = maior;
      maior = v;
    } else if (v < maior && v > segundo) {
      segundo = v;
    }
  }
  return segundo;
}
\`\`\`

Em C, sem \`-Infinity\`, comece \`maior\` com \`nums[0]\` e use uma variável booleana para saber se o segundo já foi encontrado (ou um \`long long\` com valor menor que qualquer entrada, como \`-2000000000LL\`).

## Custo

Tempo O(n) e memória extra O(1). Ordenar resolveria em O(n log n), mas ainda exigiria pular os repetidos do fim.`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function rotacionarVetor(): Challenge {
  const random = createRandom(200700);
  const rotate = (nums: number[], k: number) => {
    const n = nums.length;
    const shift = k % n;
    return nums.map((_, index) => nums[(index - shift + n) % n]);
  };
  const hidden: CaseDefinition[] = [];
  const add = (nums: number[], k: number) => hidden.push(call([nums, k], rotate(nums, k)));
  add([7], 0);
  add([7], 1000000000);
  add([1, 2], 1);
  add([1, 2, 3, 4, 5], 0);
  add([1, 2, 3, 4, 5], 7);
  add([1, 2, 3, 4, 5], 5);
  add([1, 2, 3, 4, 5], 4);
  add([-1, -100, 3, 99], 1000000000);
  add(randomArray(random, 100, -100000, 100000), randomInt(random, 0, 1000000000));
  add(randomArray(random, 1000, -100000, 100000), 999);
  const cases: Array<[{ spec: any; value: any }, number]> = [
    [gen({ $gen: "ints", n: 5000, min: -100000, max: 100000, seed: 200701 }), 999999999],
    [gen({ $gen: "range", n: 5000, start: 1 }), 1000000000],
    [gen({ $gen: "ints", n: 4999, min: -100000, max: 100000, seed: 200702 }), 4999 * 200000],
    [gen({ $gen: "ints", n: 5000, min: 0, max: 9, seed: 200703 }), 4999],
    [gen({ $gen: "ints", n: 3571, min: -100000, max: 100000, seed: 200704 }), 123456789]
  ];
  for (const [spec, k] of cases) hidden.push(call([spec.spec, k], rotate(spec.value, k)));

  return defineChallenge({
    slug: "rotacionar-vetor",
    title: "Rotacionar vetor",
    difficulty: "medium",
    moduleId: VETORES,
    position: 6,
    isBoss: true,
    description: `**Desafio do módulo.** Implemente a função \`rotacionarVetor(nums, k)\`, que retorna o vetor **rotacionado \`k\` posições para a direita**.

Rotacionar uma posição para a direita significa que cada elemento anda uma casa para a frente e o último elemento "dá a volta" e passa a ser o primeiro:

- \`[1, 2, 3, 4, 5]\` rotacionado 1 vez → \`[5, 1, 2, 3, 4]\`
- rotacionado 2 vezes → \`[4, 5, 1, 2, 3]\`

Atenção: \`k\` pode ser **enorme** (até um bilhão). Rotacionar uma posição de cada vez, \`k\` vezes, seria lento demais. Observe que, num vetor de tamanho \`n\`, rotacionar \`n\` vezes devolve o vetor original. Então só o **resto** \`k % n\` importa.

Depois disso, calcule diretamente para onde cada elemento vai: o elemento do índice \`i\` termina no índice \`(i + k) % n\`.

- O vetor tem pelo menos um elemento.
- \`k = 0\` (ou \`k\` múltiplo de \`n\`) devolve o vetor como está.

Em C, aloque o vetor de resposta com \`malloc\` e informe o tamanho em \`*returnSize\`.`,
    constraints: [
      "1 <= tamanho de nums <= 5000",
      "-10^5 <= nums[i] <= 10^5",
      "0 <= k <= 10^9"
    ],
    tags: ["Vetores", "Resto da divisão"],
    functionSpec: {
      name: "rotacionarVetor",
      params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
      returns: "int[]"
    },
    publicCases: [call([[1, 2, 3, 4, 5], 2], [4, 5, 1, 2, 3]), call([[10, 20, 30], 3], [10, 20, 30])],
    hiddenCases: hidden,
    hints: [
      "Rotacionar um vetor de tamanho n exatamente n vezes não muda nada. O que isso diz sobre um k muito grande?",
      "Troque k por k % n. Agora k é menor que n.",
      "Monte um vetor novo em que resultado[(i + k) % n] = nums[i], para cada i. Outra opção é inverter o vetor inteiro e depois inverter os k primeiros e os n - k últimos."
    ],
    editorial: `## Ideia

Duas observações resolvem o problema:

1. **Só o resto importa.** Depois de \`n\` rotações o vetor volta ao original, então rotacionar \`k\` vezes é o mesmo que rotacionar \`k % n\` vezes.
2. **Cada elemento tem um destino calculável.** Rotacionando \`k\` casas para a direita, o elemento do índice \`i\` vai para o índice \`(i + k) % n\`. O \`% n\` faz os índices que passam do fim "darem a volta".

\`\`\`c
#include <stdlib.h>

int* rotacionarVetor(int* nums, int numsSize, int k, int* returnSize) {
    int n = numsSize;
    k = k % n;
    int* resultado = malloc(sizeof(int) * n);
    for (int i = 0; i < n; i++) {
        resultado[(i + k) % n] = nums[i];
    }
    *returnSize = n;
    return resultado;
}
\`\`\`

## Alternativa sem vetor extra

Inverta o vetor inteiro; depois inverta os \`k\` primeiros elementos e, por fim, os \`n - k\` restantes. Com \`[1, 2, 3, 4, 5]\` e \`k = 2\`: \`[5, 4, 3, 2, 1]\` → \`[4, 5, 3, 2, 1]\` → \`[4, 5, 1, 2, 3]\`. É a técnica do desafio "Inverter vetor" aplicada três vezes.

## Por que a versão ingênua falha

Mover o último elemento para o começo, uma posição por vez, custa O(n) por rotação. Com \`k = 10^9\` e \`n = 5000\`, são trilhões de operações.

## Custo

Tempo O(n), independente do tamanho de \`k\`. Memória extra O(n) na versão com vetor novo, ou O(1) na versão com inversões.`,
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

// ============================================================
// Matrizes
// ============================================================

const randomMatrix = (random: () => number, rows: number, cols: number, min: number, max: number) =>
  Array.from({ length: rows }, () => randomArray(random, cols, min, max));

function somaDasDiagonais(): Challenge {
  const random = createRandom(200800);
  const diagonals = (matrix: number[][]) => {
    const n = matrix.length;
    let total = 0;
    for (let i = 0; i < n; i += 1) {
      total += matrix[i][i];
      if (i !== n - 1 - i) total += matrix[i][n - 1 - i];
    }
    return total;
  };
  const hidden: CaseDefinition[] = [];
  const add = (matrix: number[][]) => hidden.push(call([matrix], diagonals(matrix)));
  add([[7]]);
  add([[-3]]);
  add([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  add([[-1, -2], [-3, -4]]);
  add([[-10000, -10000, -10000], [-10000, -10000, -10000], [-10000, -10000, -10000]]);
  add([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  add([[10000, 1, 10000], [1, 10000, 1], [10000, 1, 10000]]);
  add(randomMatrix(random, 5, 5, -10, 10));
  add(randomMatrix(random, 6, 6, -100, 100));
  add(randomMatrix(random, 10, 10, -10000, 10000));
  add(randomMatrix(random, 11, 11, -10000, 10000));
  add(randomMatrix(random, 51, 51, 0, 10000));
  for (const spec of [
    gen({ $gen: "matrix", rows: 500, cols: 500, min: -10000, max: 10000, seed: 200801 }),
    gen({ $gen: "matrix", rows: 199, cols: 199, min: -10000, max: 10000, seed: 200802 })
  ]) {
    hidden.push(call([spec.spec], diagonals(spec.value)));
  }

  return defineChallenge({
    slug: "soma-das-diagonais",
    title: "Soma das diagonais",
    difficulty: "easy",
    moduleId: MATRIZES,
    position: 0,
    description: `Implemente a função \`somaDasDiagonais(matriz)\`, que recebe uma matriz **quadrada** \`n x n\` de inteiros e retorna a soma dos elementos das suas **duas diagonais**:

- a **diagonal principal** liga o canto superior esquerdo ao inferior direito: posições \`[i][i]\`;
- a **diagonal secundária** liga o canto superior direito ao inferior esquerdo: posições \`[i][n - 1 - i]\`.

Quando \`n\` é ímpar, as duas diagonais se cruzam no elemento central. Ele deve ser **somado uma vez só**.

**Exemplo:** na matriz

\`\`\`
1 2 3
4 5 6
7 8 9
\`\`\`

a principal é \`1 + 5 + 9\` e a secundária é \`3 + 5 + 7\`. Como o \`5\` é o centro, a resposta é \`1 + 5 + 9 + 3 + 7 = 25\`.

Em C, a matriz chega como \`int** matriz\`, com \`matrizSize\` linhas e \`matrizColSize[i]\` colunas na linha \`i\` (aqui, todas iguais a \`n\`).`,
    constraints: [
      "1 <= n <= 500",
      "-10^4 <= matriz[i][j] <= 10^4",
      "A matriz é quadrada: n linhas e n colunas."
    ],
    tags: ["Matrizes", "Diagonais"],
    functionSpec: { name: "somaDasDiagonais", params: [{ name: "matriz", type: "int[][]" }], returns: "int" },
    publicCases: [
      call([[[1, 2], [3, 4]]], 10),
      call([[[5, 1, 2, 8], [3, 6, 7, 4], [9, 0, 1, 2], [4, 3, 5, 7]]], 38)
    ],
    hiddenCases: hidden,
    hints: [
      "Um único laço de i = 0 até n - 1 alcança as duas diagonais: matriz[i][i] e matriz[i][n - 1 - i].",
      "As duas posições coincidem quando i == n - 1 - i. Só some a segunda quando elas forem diferentes."
    ],
    editorial: `## Ideia

Não é preciso percorrer a matriz inteira: em cada linha \`i\` há exatamente um elemento de cada diagonal. Somamos os dois e tomamos cuidado com o centro, que em matrizes de tamanho ímpar pertence às duas diagonais.

\`\`\`c
int somaDasDiagonais(int** matriz, int matrizSize, int* matrizColSize) {
    int n = matrizSize;
    int soma = 0;
    for (int i = 0; i < n; i++) {
        soma += matriz[i][i];
        if (i != n - 1 - i) {
            soma += matriz[i][n - 1 - i];
        }
    }
    return soma;
}
\`\`\`

Outra forma é somar tudo e, no fim, subtrair \`matriz[n / 2][n / 2]\` quando \`n\` for ímpar.

## Custo

Um laço de \`n\` passos: tempo O(n) e memória extra O(1).`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function transposta(): Challenge {
  const random = createRandom(200900);
  const transpose = (matrix: number[][]) => matrix[0].map((_, col) => matrix.map((row) => row[col]));
  const hidden: CaseDefinition[] = [];
  const add = (matrix: number[][]) => hidden.push(call([matrix], transpose(matrix)));
  add([[1, 2], [3, 4], [5, 6]]);
  add([[1, 2, 3]]);
  add([[1], [2], [3]]);
  add([[5]]);
  add([[-1, 0, 1, 2], [3, 4, 5, 6]]);
  add(randomMatrix(random, 4, 7, -9, 9));
  add(randomMatrix(random, 7, 4, -9, 9));
  add(randomMatrix(random, 5, 5, -1000, 1000));
  add(randomMatrix(random, 60, 60, -1000, 1000));
  add(randomMatrix(random, 60, 1, -1000, 1000));
  add(randomMatrix(random, 1, 60, -1000, 1000));
  add(randomMatrix(random, 30, 45, -1000, 1000));
  add(randomMatrix(random, 45, 30, -1000, 1000));
  add(randomMatrix(random, 60, 59, -1000, 1000));
  add(randomMatrix(random, 2, 60, 0, 1));

  return defineChallenge({
    slug: "transposta",
    title: "Matriz transposta",
    difficulty: "easy",
    moduleId: MATRIZES,
    position: 1,
    description: `Implemente a função \`transposta(matriz)\`, que recebe uma matriz com \`m\` linhas e \`n\` colunas e retorna a sua **transposta**: uma matriz com \`n\` linhas e \`m\` colunas em que **as linhas viram colunas**.

Em termos de índices: \`resultado[j][i] = matriz[i][j]\`.

A matriz **não precisa ser quadrada**. Por exemplo, a matriz 2 x 3

\`\`\`
1 2 3
4 5 6
\`\`\`

tem como transposta a matriz 3 x 2

\`\`\`
1 4
2 5
3 6
\`\`\`

ou seja, \`[[1, 2, 3], [4, 5, 6]]\` → \`[[1, 4], [2, 5], [3, 6]]\`.

Em C, a matriz chega como \`int** matriz\`, com \`matrizSize\` linhas e \`matrizColSize[0]\` colunas. Aloque a resposta com \`malloc\`, informe o número de linhas em \`*returnSize\` e crie o vetor \`*returnColumnSizes\` com a quantidade de colunas de cada linha.`,
    constraints: [
      "1 <= m, n <= 60",
      "-1000 <= matriz[i][j] <= 1000",
      "Todas as linhas têm o mesmo número de colunas."
    ],
    tags: ["Matrizes", "Transposição"],
    functionSpec: { name: "transposta", params: [{ name: "matriz", type: "int[][]" }], returns: "int[][]" },
    publicCases: [
      call([[[1, 2], [3, 4]]], [[1, 3], [2, 4]]),
      call([[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], [[1, 4, 7], [2, 5, 8], [3, 6, 9]])
    ],
    hiddenCases: hidden,
    hints: [
      "Se a matriz tem m linhas e n colunas, a resposta tem n linhas e m colunas. Use m e n separados, não um único tamanho.",
      "Para cada coluna j da matriz original, a linha j da resposta é formada por matriz[0][j], matriz[1][j], ..., matriz[m - 1][j]."
    ],
    editorial: `## Ideia

A linha \`j\` da transposta é a coluna \`j\` da original. Descobrimos \`m\` (linhas) e \`n\` (colunas) e montamos uma matriz \`n x m\`.

\`\`\`js
function transposta(matriz) {
  const m = matriz.length;
  const n = matriz[0].length;
  const resultado = [];
  for (let j = 0; j < n; j++) {
    const linha = [];
    for (let i = 0; i < m; i++) linha.push(matriz[i][j]);
    resultado.push(linha);
  }
  return resultado;
}
\`\`\`

Em C, são três alocações: o vetor de ponteiros para as \`n\` linhas, cada linha com \`m\` inteiros e o vetor \`*returnColumnSizes\`, com \`n\` posições valendo \`m\`.

## Armadilha

Usar \`matriz.length\` para as duas dimensões funciona com matrizes quadradas e quebra nas retangulares: ou sobram posições vazias, ou faltam colunas.

## Custo

Cada elemento é copiado uma vez: tempo O(m * n) e memória O(m * n) para a resposta.`,
    complexity: { time: "O(m * n)", space: "O(m * n)" }
  });
}

function multiplicacaoDeMatrizes(): Challenge {
  const random = createRandom(201000);
  const multiply = (a: number[][], b: number[][]) => {
    if (a[0].length !== b.length) return [];
    return a.map((row) => b[0].map((_, j) => row.reduce((total, value, k) => total + value * b[k][j], 0)));
  };
  const hidden: CaseDefinition[] = [];
  const add = (a: number[][], b: number[][]) => hidden.push(call([a, b], multiply(a, b)));
  add([[1, 2], [3, 4]], [[1, 0], [0, 1], [2, 2]]);
  add([[3]], [[-4]]);
  add([[1, 2, 3], [4, 5, 6]], [[7, 8], [9, 10], [11, 12]]);
  add([[1, 2], [3, 4], [5, 6]], [[1, 2, 3], [4, 5, 6]]);
  add([[1, 2, 3], [4, 5, 6]], [[1, 2], [3, 4]]);
  add([[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[5, -2, 7], [0, 3, 1], [-1, -1, 4]]);
  add([[0, 0], [0, 0]], [[9, 8], [7, 6]]);
  add([[-1, -2]], [[-3], [-4]]);
  add([[2, 3]], [[1, 2]]);
  add(randomMatrix(random, 4, 3, -10, 10), randomMatrix(random, 3, 5, -10, 10));
  add(randomMatrix(random, 50, 50, -100, 100), randomMatrix(random, 50, 50, -100, 100));
  add(randomMatrix(random, 50, 1, -100, 100), randomMatrix(random, 1, 50, -100, 100));
  add(randomMatrix(random, 1, 50, -100, 100), randomMatrix(random, 50, 1, -100, 100));
  add(randomMatrix(random, 20, 50, 100, 100), randomMatrix(random, 50, 30, 100, 100));
  add(randomMatrix(random, 50, 49, -100, 100), randomMatrix(random, 50, 50, -100, 100));
  add(randomMatrix(random, 37, 23, -100, 100), randomMatrix(random, 23, 41, -100, 100));

  return defineChallenge({
    slug: "multiplicacao-de-matrizes",
    title: "Multiplicação de matrizes",
    difficulty: "medium",
    moduleId: MATRIZES,
    position: 2,
    description: `Implemente a função \`multiplicarMatrizes(a, b)\`, que retorna o **produto** \`a x b\` de duas matrizes de inteiros.

Se \`a\` tem \`m\` linhas e \`n\` colunas e \`b\` tem \`n\` linhas e \`p\` colunas, o produto é uma matriz \`m x p\`. Cada elemento é a combinação de **uma linha de \`a\` com uma coluna de \`b\`**:

\`resultado[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + ... + a[i][n - 1] * b[n - 1][j]\`

**Exemplo:**

\`\`\`
| 1 2 |   | 5 6 |   | 1*5 + 2*7   1*6 + 2*8 |   | 19 22 |
| 3 4 | x | 7 8 | = | 3*5 + 4*7   3*6 + 4*8 | = | 43 50 |
\`\`\`

A multiplicação só existe quando o **número de colunas de \`a\` é igual ao número de linhas de \`b\`**. Quando isso não acontece, retorne uma matriz vazia, \`[]\`. Por exemplo, uma matriz 2 x 2 não pode ser multiplicada por uma 3 x 2.

Em C, cada matriz chega com seu número de linhas (\`aSize\`, \`bSize\`) e o vetor de colunas por linha (\`aColSize\`, \`bColSize\`). Aloque a resposta com \`malloc\`, informe as linhas em \`*returnSize\` e as colunas de cada linha em \`*returnColumnSizes\`. Para a matriz vazia, use \`*returnSize = 0\`.`,
    constraints: [
      "1 <= linhas e colunas de a e de b <= 50",
      "-100 <= a[i][j], b[i][j] <= 100",
      "Retorne [] se o número de colunas de a for diferente do número de linhas de b."
    ],
    tags: ["Matrizes", "Laços aninhados"],
    functionSpec: {
      name: "multiplicarMatrizes",
      params: [{ name: "a", type: "int[][]" }, { name: "b", type: "int[][]" }],
      returns: "int[][]"
    },
    publicCases: [
      call([[[1, 2], [3, 4]], [[5, 6], [7, 8]]], [[19, 22], [43, 50]]),
      call([[[1, 0, 2]], [[3], [1], [2]]], [[7]])
    ],
    hiddenCases: hidden,
    hints: [
      "Antes de tudo, compare o número de colunas de a com o número de linhas de b. Se forem diferentes, a resposta é [].",
      "São três laços: i percorre as linhas de a, j percorre as colunas de b e k percorre a dimensão em comum, acumulando a[i][k] * b[k][j].",
      "O acumulador de cada resultado[i][j] precisa voltar a 0 antes do laço de k."
    ],
    editorial: `## Ideia

Primeiro validamos as dimensões. Depois, para cada par (linha \`i\` de \`a\`, coluna \`j\` de \`b\`), somamos os produtos dos elementos correspondentes.

\`\`\`python
def multiplicarMatrizes(a, b):
    m, n = len(a), len(a[0])
    if n != len(b):
        return []
    p = len(b[0])
    resultado = []
    for i in range(m):
        linha = []
        for j in range(p):
            soma = 0
            for k in range(n):
                soma += a[i][k] * b[k][j]
            linha.append(soma)
        resultado.append(linha)
    return resultado
\`\`\`

## Armadilhas

- Esquecer a validação: com uma \`a\` 2 x 2 e uma \`b\` 3 x 2, o laço de \`k\` para em 2 e produz números que parecem certos, mas a multiplicação nem está definida.
- Confundir os papéis: o laço de \`j\` vai até o número de **colunas de \`b\`**, e o de \`k\` até as **colunas de \`a\`** (que são as linhas de \`b\`).

## Custo

Para uma \`a\` m x n e uma \`b\` n x p, são \`m * p\` elementos com \`n\` multiplicações cada: tempo O(m * n * p). A resposta ocupa O(m * p).`,
    complexity: { time: "O(m * n * p)", space: "O(m * p)" }
  });
}

function percursoEmEspiral(): Challenge {
  const random = createRandom(201100);
  const spiral = (matrix: number[][]) => {
    const result: number[] = [];
    let top = 0;
    let bottom = matrix.length - 1;
    let left = 0;
    let right = matrix[0].length - 1;
    while (top <= bottom && left <= right) {
      for (let j = left; j <= right; j += 1) result.push(matrix[top][j]);
      top += 1;
      for (let i = top; i <= bottom; i += 1) result.push(matrix[i][right]);
      right -= 1;
      if (top <= bottom) {
        for (let j = right; j >= left; j -= 1) result.push(matrix[bottom][j]);
        bottom -= 1;
      }
      if (left <= right) {
        for (let i = bottom; i >= top; i -= 1) result.push(matrix[i][left]);
        left += 1;
      }
    }
    return result;
  };
  const sequential = (rows: number, cols: number) =>
    Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => i * cols + j + 1));
  const hidden: CaseDefinition[] = [];
  const add = (matrix: number[][]) => hidden.push(call([matrix], spiral(matrix)));
  add(sequential(1, 4));
  add(sequential(4, 1));
  add([[42]]);
  add(sequential(2, 3));
  add(sequential(3, 2));
  add(sequential(3, 4));
  add(sequential(4, 3));
  add(sequential(5, 5));
  add(sequential(2, 2));
  add(randomMatrix(random, 6, 9, -1000, 1000));
  add(randomMatrix(random, 60, 60, -1000, 1000));
  add(randomMatrix(random, 60, 1, -1000, 1000));
  add(randomMatrix(random, 1, 60, -1000, 1000));
  add(randomMatrix(random, 10, 37, -1000, 1000));
  add(randomMatrix(random, 37, 10, -1000, 1000));
  add(randomMatrix(random, 59, 60, -1000, 1000));

  return defineChallenge({
    slug: "percurso-em-espiral",
    title: "Percurso em espiral",
    difficulty: "medium",
    moduleId: MATRIZES,
    position: 3,
    description: `Implemente a função \`espiral(matriz)\`, que retorna todos os elementos de uma matriz \`m x n\` na ordem de um **percurso em espiral no sentido horário**, começando pelo canto superior esquerdo.

O percurso segue as bordas de fora para dentro: vai pela primeira linha da esquerda para a direita, desce pela última coluna, volta pela última linha da direita para a esquerda, sobe pela primeira coluna e repete o processo com a "camada" de dentro, até visitar todos os elementos.

**Exemplo:** para

\`\`\`
1 2 3
4 5 6
7 8 9
\`\`\`

a resposta é \`[1, 2, 3, 6, 9, 8, 7, 4, 5]\`.

A matriz pode ser **retangular**, inclusive com uma única linha (\`1 x n\`) ou uma única coluna (\`m x 1\`). Cada elemento deve aparecer **exatamente uma vez** na resposta.

Em C, a matriz chega como \`int** matriz\`, com \`matrizSize\` linhas e \`matrizColSize[0]\` colunas. Aloque o vetor de resposta com \`malloc\` e informe o tamanho em \`*returnSize\`.`,
    constraints: [
      "1 <= m, n <= 60",
      "-1000 <= matriz[i][j] <= 1000"
    ],
    tags: ["Matrizes", "Simulação"],
    functionSpec: { name: "espiral", params: [{ name: "matriz", type: "int[][]" }], returns: "int[]" },
    publicCases: [
      call([[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], [1, 2, 3, 6, 9, 8, 7, 4, 5]),
      call([[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]], [1, 2, 3, 4, 8, 12, 16, 15, 14, 13, 9, 5, 6, 7, 11, 10])
    ],
    hiddenCases: hidden,
    hints: [
      "Guarde quatro limites: topo, baixo, esquerda e direita. Cada lado percorrido \"encolhe\" um deles.",
      "Depois de percorrer a linha de cima, incremente topo; depois da coluna da direita, decremente direita; e assim por diante.",
      "Antes de voltar pela linha de baixo, confira se topo <= baixo; antes de subir pela coluna da esquerda, confira se esquerda <= direita. Sem isso, matrizes de uma linha ou uma coluna repetem elementos."
    ],
    editorial: `## Ideia

Simulamos o percurso com quatro limites que marcam a camada atual: \`topo\`, \`baixo\`, \`esq\` e \`dir\`. Cada um dos quatro lados é percorrido e, em seguida, o limite correspondente anda uma casa para dentro.

\`\`\`c
#include <stdlib.h>

int* espiral(int** matriz, int matrizSize, int* matrizColSize, int* returnSize) {
    int m = matrizSize, n = matrizColSize[0];
    int* resultado = malloc(sizeof(int) * m * n);
    int k = 0, topo = 0, baixo = m - 1, esq = 0, dir = n - 1;
    while (topo <= baixo && esq <= dir) {
        for (int j = esq; j <= dir; j++) resultado[k++] = matriz[topo][j];
        topo++;
        for (int i = topo; i <= baixo; i++) resultado[k++] = matriz[i][dir];
        dir--;
        if (topo <= baixo) {
            for (int j = dir; j >= esq; j--) resultado[k++] = matriz[baixo][j];
            baixo--;
        }
        if (esq <= dir) {
            for (int i = baixo; i >= topo; i--) resultado[k++] = matriz[i][esq];
            esq++;
        }
    }
    *returnSize = k;
    return resultado;
}
\`\`\`

## Armadilha

Os dois \`if\` do meio são o coração do problema. Numa matriz \`1 x 4\`, depois de percorrer a única linha, \`topo\` passa de \`baixo\`; sem a verificação, o laço da "linha de baixo" percorreria de novo a mesma linha, ao contrário.

## Custo

Cada elemento é visitado uma vez: tempo O(m * n) e memória O(m * n) para a resposta.`,
    complexity: { time: "O(m * n)", space: "O(m * n)" }
  });
}

// ---------- Jogo da velha ----------
const TIC_TAC_TOE_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

function winsWith(cells: string, player: string): boolean {
  return TIC_TAC_TOE_LINES.some((line) => line.every((index) => cells[index] === player));
}

function ticTacToeStatus(board: string[]): string {
  const cells = board.join("");
  if (winsWith(cells, "X")) return "X";
  if (winsWith(cells, "O")) return "O";
  return cells.includes(".") ? "EM ANDAMENTO" : "EMPATE";
}

function assertValidBoard(board: string[]) {
  const cells = board.join("");
  const x = [...cells].filter((cell) => cell === "X").length;
  const o = [...cells].filter((cell) => cell === "O").length;
  const xWins = winsWith(cells, "X");
  const oWins = winsWith(cells, "O");
  const valid =
    board.length === 3 &&
    board.every((row) => /^[XO.]{3}$/.test(row)) &&
    (x === o || x === o + 1) &&
    !(xWins && oWins) &&
    (!xWins || x === o + 1) &&
    (!oWins || x === o);
  if (!valid) throw new Error(`Tabuleiro invalido no jogo da velha: ${board.join("/")}`);
}

function vencedorDoJogoDaVelha(): Challenge {
  const random = createRandom(201200);
  const handmade: string[][] = [
    ["X.O", ".XO", "..X"],
    ["XXO", "XO.", "O.."],
    ["XOX", "OXO", "OXX"],
    ["...", "...", "..."],
    ["X..", "...", "..."],
    ["OXX", "XXO", "OOX"],
    ["XOX", "OOX", "XXO"],
    ["XXX", "OXO", "OXO"],
    ["OOO", "X.X", "X.."],
    ["XOO", ".X.", "..X"]
  ];
  const seen = new Set<string>([
    "XXXOO....", "XOXXO..O.", "XOXXOOOXX",
    ...handmade.map((board) => board.join(""))
  ]);
  const boards: string[][] = [...handmade];
  const wanted: Record<string, number> = { X: 3, O: 3, EMPATE: 2, "EM ANDAMENTO": 2 };
  for (let attempt = 0; attempt < 5000 && Object.values(wanted).some((count) => count > 0); attempt += 1) {
    const cells = Array.from({ length: 9 }, () => ".");
    const stopAt = randomInt(random, 3, 9);
    for (let move = 0; move < stopAt; move += 1) {
      if (winsWith(cells.join(""), "X") || winsWith(cells.join(""), "O")) break;
      const empty = cells.flatMap((cell, index) => (cell === "." ? [index] : []));
      cells[pick(random, empty)] = move % 2 === 0 ? "X" : "O";
    }
    const board = [cells.slice(0, 3).join(""), cells.slice(3, 6).join(""), cells.slice(6, 9).join("")];
    const status = ticTacToeStatus(board);
    const key = cells.join("");
    if (seen.has(key) || !wanted[status]) continue;
    seen.add(key);
    wanted[status] -= 1;
    boards.push(board);
  }
  const hidden = boards.map((board) => {
    assertValidBoard(board);
    return call([board], ticTacToeStatus(board));
  });
  const publicBoards = [["XXX", "OO.", "..."], ["XOX", "XO.", ".O."], ["XOX", "XOO", "OXX"]];
  publicBoards.forEach(assertValidBoard);

  return defineChallenge({
    slug: "vencedor-do-jogo-da-velha",
    title: "Vencedor do jogo da velha",
    difficulty: "medium",
    moduleId: MATRIZES,
    position: 4,
    isBoss: true,
    description: `**Desafio do módulo.** Implemente a função \`vencedorJogoDaVelha(tabuleiro)\`, que analisa um tabuleiro de jogo da velha e diz como está a partida.

O tabuleiro é um vetor com **3 strings de 3 caracteres**, uma por linha. Cada caractere é \`"X"\`, \`"O"\` ou \`"."\` (casa vazia). Pense nele como uma matriz 3 x 3: \`tabuleiro[i][j]\` é a casa da linha \`i\`, coluna \`j\`.

Um jogador vence quando ocupa uma **linha**, uma **coluna** ou uma das **duas diagonais** inteiras. Retorne:

- \`"X"\` se o X venceu;
- \`"O"\` se o O venceu;
- \`"EMPATE"\` se o tabuleiro está cheio e ninguém venceu;
- \`"EM ANDAMENTO"\` se ninguém venceu e ainda há casas vazias.

**Exemplo:** o tabuleiro \`["XXX", "OO.", "..."]\` representa

\`\`\`
X X X
O O .
. . .
\`\`\`

e a resposta é \`"X"\`.

Todos os tabuleiros vêm de partidas **válidas**: o X sempre começa, os jogadores se alternam e a partida para assim que alguém vence. Por isso nunca há dois vencedores. Atenção: um tabuleiro cheio **com** vencedor não é empate.

Em C, o tabuleiro chega como \`char** tabuleiro\` (com \`tabuleiroSize = 3\`), e a função retorna uma string, por exemplo \`return "EMPATE";\`.`,
    constraints: [
      "tabuleiro tem 3 strings, cada uma com 3 caracteres entre 'X', 'O' e '.'.",
      "O tabuleiro corresponde a uma partida válida (no máximo um vencedor).",
      "Retorne exatamente \"X\", \"O\", \"EMPATE\" ou \"EM ANDAMENTO\"."
    ],
    tags: ["Matrizes", "Simulação"],
    functionSpec: {
      name: "vencedorJogoDaVelha",
      params: [{ name: "tabuleiro", type: "string[]" }],
      returns: "string"
    },
    publicCases: publicBoards.map((board) => call([board], ticTacToeStatus(board))),
    hiddenCases: hidden,
    hints: [
      "Escreva uma função auxiliar venceu(tabuleiro, jogador) que confere as 8 linhas possíveis: 3 linhas, 3 colunas e 2 diagonais.",
      "As diagonais são as casas [0][0], [1][1], [2][2] e [0][2], [1][1], [2][0]. Não se esqueça delas.",
      "Só depois de descartar os dois vencedores procure uma casa vazia: se existir, a partida está em andamento; senão, é empate."
    ],
    editorial: `## Ideia

A resposta depende de duas perguntas, nesta ordem: **alguém venceu?** e, se não, **ainda há casa vazia?** Uma função auxiliar confere as oito formas de vencer para um jogador.

\`\`\`js
function venceu(t, p) {
  for (let i = 0; i < 3; i++) {
    if (t[i][0] === p && t[i][1] === p && t[i][2] === p) return true; // linha i
    if (t[0][i] === p && t[1][i] === p && t[2][i] === p) return true; // coluna i
  }
  if (t[0][0] === p && t[1][1] === p && t[2][2] === p) return true; // diagonal principal
  return t[0][2] === p && t[1][1] === p && t[2][0] === p;           // diagonal secundária
}

function vencedorJogoDaVelha(tabuleiro) {
  if (venceu(tabuleiro, "X")) return "X";
  if (venceu(tabuleiro, "O")) return "O";
  const temVazia = tabuleiro.some((linha) => linha.includes("."));
  return temVazia ? "EM ANDAMENTO" : "EMPATE";
}
\`\`\`

## Armadilhas

- Esquecer as diagonais: o programa acerta vitórias em linha e coluna, mas chama de "EMPATE" ou "EM ANDAMENTO" uma partida já decidida.
- Testar o empate antes da vitória: se o último lance completa uma linha e enche o tabuleiro, o resultado é a vitória, não o empate.

## Custo

O tabuleiro tem tamanho fixo (9 casas), então tempo e memória são O(1).`,
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

// ============================================================
// Strings
// ============================================================

const TEXT_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-";

function randomText(random: () => number, length: number, alphabet = TEXT_ALPHABET) {
  let text = "";
  for (let index = 0; index < length; index += 1) text += alphabet[randomInt(random, 0, alphabet.length - 1)];
  return text;
}

function contarVogais(): Challenge {
  const random = createRandom(201300);
  const vowels = (text: string) => [...text].filter((char) => "aeiouAEIOU".includes(char)).length;
  const hidden: CaseDefinition[] = [];
  const add = (text: string) => hidden.push(call([text], vowels(text)));
  add("AEIOU");
  add("");
  add("bcdfg");
  add("Hello World");
  add("yY");
  add("123 !? ...");
  add("aAaA");
  add("UMA FRASE EM CAIXA ALTA");
  add("O Rato Roeu A Roupa Do Rei De Roma");
  add(randomText(random, 200));
  add(randomText(random, 5000));
  add(randomText(random, 3000, "bcdfghBCDFGH xyzXYZ"));
  for (const spec of [
    gen({ $gen: "string", n: 100000, seed: 201301, alphabet: TEXT_ALPHABET }),
    gen({ $gen: "string", n: 100000, seed: 201302, alphabet: "aeiouAEIOU" }),
    gen({ $gen: "string", n: 100000, seed: 201304, alphabet: "aAbB" })
  ]) {
    hidden.push(call([spec.spec], vowels(spec.value)));
  }

  return defineChallenge({
    slug: "contar-vogais",
    title: "Contar vogais",
    difficulty: "easy",
    moduleId: STRINGS,
    position: 0,
    description: `Implemente a função \`contarVogais(texto)\`, que retorna **quantas vogais** existem no texto.

As vogais são \`a\`, \`e\`, \`i\`, \`o\` e \`u\`, tanto **minúsculas quanto maiúsculas**. O texto usa apenas caracteres ASCII (letras sem acento, dígitos, espaços e pontuação). A letra \`y\` não é vogal.

- O texto pode estar vazio; nesse caso, a resposta é \`0\`.

**Exemplos:**

- \`"banana split"\` → \`4\` (a, a, a, i)
- \`"Hello World"\` → \`3\` (e, o, o)

Em C, a string termina no caractere \`'\\0'\`: percorra até encontrá-lo (ou use \`strlen\`).`,
    constraints: [
      "0 <= tamanho de texto <= 10^5",
      "texto contém apenas caracteres ASCII imprimíveis."
    ],
    tags: ["Strings", "Contador"],
    functionSpec: { name: "contarVogais", params: [{ name: "texto", type: "string" }], returns: "int" },
    publicCases: [call(["banana split"], 4), call(["codigo limpo"], 5)],
    hiddenCases: hidden,
    hints: [
      "Percorra o texto caractere a caractere e conte os que forem vogais.",
      "Não esqueça das maiúsculas: \"A\" e \"a\" são caracteres diferentes. Você pode converter cada caractere para minúsculo antes de comparar (tolower em C, toLowerCase em JS, lower em Python)."
    ],
    editorial: `## Ideia

Uma string é uma sequência de caracteres, e dá para percorrê-la como um vetor. Para cada caractere, verificamos se ele está no conjunto de vogais, considerando as duas caixas.

\`\`\`c
#include <ctype.h>

int contarVogais(char* texto) {
    int contador = 0;
    for (int i = 0; texto[i] != '\\0'; i++) {
        char c = tolower((unsigned char) texto[i]);
        if (c == 'a' || c == 'e' || c == 'i' || c == 'o' || c == 'u') {
            contador++;
        }
    }
    return contador;
}
\`\`\`

Em Python, \`sum(1 for c in texto if c in "aeiouAEIOU")\` faz o mesmo em uma linha.

## Custo

Tempo O(n), com n o tamanho do texto, e memória extra O(1).`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function inverterPalavras(): Challenge {
  const random = createRandom(201400);
  const reverseWords = (text: string) => text.split(" ").filter(Boolean).reverse().join(" ");
  const WORD_ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.!?";
  const spaces = (min: number, max: number) => " ".repeat(randomInt(random, min, max));
  const sentence = (words: number, maxSpaces: number) => {
    let text = spaces(0, maxSpaces);
    for (let index = 0; index < words; index += 1) {
      text += randomWord(random, 1, 12, WORD_ALPHABET);
      text += index === words - 1 ? spaces(0, maxSpaces) : spaces(1, maxSpaces);
    }
    return text;
  };
  const hidden: CaseDefinition[] = [];
  const add = (text: string) => hidden.push(call([text], reverseWords(text)));
  add("  espacos no inicio");
  add("fim com espacos   ");
  add("muitos     espacos    no   meio");
  add("");
  add("   ");
  add("palavra");
  add("a b c d e");
  add("Hello, World! 123");
  add("   um   ");
  add(sentence(10, 1).trim());
  add(sentence(30, 4));
  add(sentence(300, 3));
  add(sentence(800, 5).slice(0, 10000));
  add(sentence(1500, 1).trim().slice(0, 10000));

  return defineChallenge({
    slug: "inverter-palavras",
    title: "Inverter a ordem das palavras",
    difficulty: "easy",
    moduleId: STRINGS,
    position: 1,
    description: `Implemente a função \`inverterPalavras(frase)\`, que retorna as **palavras** da frase em **ordem inversa**, separadas por **exatamente um espaço**.

Uma palavra é uma sequência de caracteres sem espaço. A frase pode ter espaços sobrando: **no início, no fim ou vários seguidos** entre duas palavras. Esses espaços extras não fazem parte da resposta.

- As letras de cada palavra **não** são invertidas; só a ordem das palavras muda.
- Se a frase não tiver nenhuma palavra (vazia ou só com espaços), retorne \`""\`.

**Exemplos:**

- \`"o rato roeu a roupa"\` → \`"roupa a roeu rato o"\`
- \`"  muitos   espacos  "\` → \`"espacos muitos"\`

Em C, aloque a string de resposta com \`malloc\` (o tamanho da frase mais 1 é suficiente) e termine-a com \`'\\0'\`.`,
    constraints: [
      "0 <= tamanho de frase <= 10^4",
      "frase contém letras, dígitos, pontuação e espaços (' '), todos ASCII."
    ],
    tags: ["Strings", "Palavras"],
    functionSpec: { name: "inverterPalavras", params: [{ name: "frase", type: "string" }], returns: "string" },
    publicCases: [call(["o rato roeu a roupa"], "roupa a roeu rato o"), call(["ola mundo"], "mundo ola")],
    hiddenCases: hidden,
    hints: [
      "Primeiro separe as palavras, ignorando os pedaços vazios que aparecem entre dois espaços seguidos.",
      "Em JS e Python, dividir por um único espaço gera strings vazias quando há espaços repetidos: filtre-as (ou use split() sem argumentos em Python).",
      "Em C, percorra a frase de trás para a frente: ao achar o fim e o começo de cada palavra, copie-a para a resposta, colocando um espaço antes de toda palavra que não for a primeira."
    ],
    editorial: `## Ideia

O problema tem duas partes: **separar** as palavras, descartando espaços extras, e **juntá-las** na ordem inversa com um espaço entre cada par.

\`\`\`python
def inverterPalavras(frase):
    palavras = frase.split()  # sem argumento: ignora espaços repetidos
    resultado = []
    for i in range(len(palavras) - 1, -1, -1):
        resultado.append(palavras[i])
    return " ".join(resultado)
\`\`\`

Em C não há \`split\`, então percorremos a frase do fim para o começo. Pulamos os espaços, marcamos onde a palavra termina, recuamos até o espaço anterior (ou o início) e copiamos a palavra para a resposta.

\`\`\`c
#include <stdlib.h>
#include <string.h>

char* inverterPalavras(char* frase) {
    int n = strlen(frase), k = 0;
    char* resultado = malloc(n + 1);
    int i = n - 1;
    while (i >= 0) {
        while (i >= 0 && frase[i] == ' ') i--;
        if (i < 0) break;
        int fim = i;
        while (i >= 0 && frase[i] != ' ') i--;
        if (k > 0) resultado[k++] = ' ';
        for (int j = i + 1; j <= fim; j++) resultado[k++] = frase[j];
    }
    resultado[k] = '\\0';
    return resultado;
}
\`\`\`

## Armadilha

\`frase.split(" ")\` transforma \`"a  b"\` em \`["a", "", "b"]\`. Juntar de volta produz espaços duplicados na resposta.

## Custo

Tempo O(n) e memória O(n) para a resposta.`,
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

function palindromoDeFrase(): Challenge {
  const random = createRandom(201500);
  const isPalindrome = (text: string) => {
    const clean = text.toLowerCase().replace(/[^a-z0-9]/g, "");
    return clean === [...clean].reverse().join("");
  };
  const flipCase = (char: string) => (random() < 0.5 ? char.toUpperCase() : char.toLowerCase());
  const noisyPalindrome = (half: number) => {
    const core = randomText(random, half, "abcdefghijklmnopqrstuvwxyz0123456789");
    const mirrored = core + [...core].reverse().join("");
    let text = "";
    for (const char of mirrored) {
      text += flipCase(char);
      if (random() < 0.2) text += pick(random, [" ", ",", ".", "!", "?", "-", "  "]);
    }
    return text;
  };
  const hidden: CaseDefinition[] = [];
  const add = (text: string) => hidden.push(call([text], isPalindrome(text)));
  add("Ame a ema");
  add("");
  add("!!!");
  add("A");
  add("ab");
  add("Aa");
  add("race a car");
  add("0P");
  add("1a2 2A1");
  add("No 'x' in Nixon");
  add("Socorram-me, subi no Onibus em Marrocos.");
  add(noisyPalindrome(40));
  const big = noisyPalindrome(30000);
  add(big);
  const middle = Math.floor(big.length / 2);
  const brokenIndex = [...big].findIndex((char, index) => index >= middle && /[a-zA-Z]/.test(char));
  const broken = big.slice(0, brokenIndex) + (big[brokenIndex].toLowerCase() === "z" ? "y" : "z") + big.slice(brokenIndex + 1);
  add(broken);
  const randomSpec = gen({ $gen: "string", n: 100000, seed: 201501, alphabet: "abAB12 ,." });
  hidden.push(call([randomSpec.spec], isPalindrome(randomSpec.value)));
  const allSame = gen({ $gen: "string", n: 100000, seed: 201502, alphabet: "aA .,!" });
  hidden.push(call([allSame.spec], isPalindrome(allSame.value)));

  return defineChallenge({
    slug: "palindromo-de-frase",
    title: "Palíndromo de frase",
    difficulty: "easy",
    moduleId: STRINGS,
    position: 2,
    description: `Implemente a função \`ehPalindromo(frase)\`, que retorna \`true\` se a frase for um **palíndromo** e \`false\` caso contrário.

Um palíndromo é lido da mesma forma da esquerda para a direita e da direita para a esquerda. Aqui, para comparar, considere **apenas letras e dígitos** (ASCII) e **ignore a diferença entre maiúsculas e minúsculas**. Espaços, pontuação e outros símbolos não contam.

- Uma frase sem nenhuma letra ou dígito (por exemplo, vazia) é considerada palíndromo.

**Exemplos:**

- \`"arara"\` → \`true\`
- \`"Ame a ema"\` → \`true\` (vira \`ameaema\`)
- \`"abc"\` → \`false\`

Dica de eficiência: use dois índices, um em cada ponta, e aproxime-os pulando os caracteres que não contam.

Em C, retorne \`true\` ou \`false\` (de \`<stdbool.h>\`); as funções \`isalnum\` e \`tolower\` de \`<ctype.h>\` ajudam.`,
    constraints: [
      "0 <= tamanho de frase <= 10^5",
      "frase contém apenas caracteres ASCII imprimíveis."
    ],
    tags: ["Strings", "Dois índices"],
    functionSpec: { name: "ehPalindromo", params: [{ name: "frase", type: "string" }], returns: "bool" },
    publicCases: [
      call(["arara"], true),
      call(["socorram-me, subi no onibus em marrocos"], true),
      call(["abc"], false)
    ],
    hiddenCases: hidden,
    hints: [
      "Uma forma direta: monte uma string só com as letras e dígitos, todos em minúsculo, e compare-a com a sua inversa.",
      "Sem string extra: coloque i no início e j no fim. Avance i e recue j enquanto apontarem para caracteres que não são letra nem dígito; então compare as duas letras em minúsculo.",
      "Não esqueça de converter para minúsculo: 'A' e 'a' devem ser considerados iguais."
    ],
    editorial: `## Ideia

Comparamos o primeiro caractere válido com o último, o segundo com o penúltimo, e assim por diante. Dois índices fazem isso sem criar outra string.

\`\`\`c
#include <ctype.h>
#include <stdbool.h>
#include <string.h>

bool ehPalindromo(char* frase) {
    int i = 0, j = (int) strlen(frase) - 1;
    while (i < j) {
        if (!isalnum((unsigned char) frase[i])) { i++; continue; }
        if (!isalnum((unsigned char) frase[j])) { j--; continue; }
        if (tolower((unsigned char) frase[i]) != tolower((unsigned char) frase[j])) {
            return false;
        }
        i++;
        j--;
    }
    return true;
}
\`\`\`

## Armadilhas

- Comparar sem converter para minúsculo: \`"Ame a ema"\` deixaria de ser palíndromo.
- Remover só os espaços e esquecer a pontuação.

## Custo

Cada caractere é visitado no máximo uma vez: tempo O(n) e memória extra O(1).`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function anagramas(): Challenge {
  const random = createRandom(201600);
  const isAnagram = (a: string, b: string) => {
    if (a.length !== b.length) return false;
    const counts = new Array(26).fill(0);
    for (let index = 0; index < a.length; index += 1) {
      counts[a.charCodeAt(index) - 97] += 1;
      counts[b.charCodeAt(index) - 97] -= 1;
    }
    return counts.every((count) => count === 0);
  };
  const hidden: CaseDefinition[] = [];
  const add = (a: string, b: string) => hidden.push(call([a, b], isAnagram(a, b)));
  add("ac", "bb");
  add("", "");
  add("a", "");
  add("a", "a");
  add("ab", "ba");
  add("aab", "abb");
  add("listen", "silent");
  add("aabbcc", "abcabc");
  add("ad", "bc");
  add("abc", "abcd");
  const word = randomWord(random, 200, 200);
  add(word, shuffle(random, [...word]).join(""));
  const other = randomWord(random, 300, 300, "abc");
  add(other, shuffle(random, [...other]).join("").replace("a", "b").replace("c", "a"));
  const part = (n: number, seed: number) => ({ $gen: "string" as const, n, seed });
  const pairs: Array<[{ spec: any; value: any }, { spec: any; value: any }]> = [
    [
      gen({ $gen: "concat", parts: [part(50000, 201601), part(50000, 201602)] }),
      gen({ $gen: "concat", parts: [part(50000, 201602), part(50000, 201601)] })
    ],
    [
      gen({ $gen: "concat", parts: [part(50000, 201603), "ad", part(49998, 201604)] }),
      gen({ $gen: "concat", parts: [part(49998, 201604), "bc", part(50000, 201603)] })
    ],
    [gen({ $gen: "string", n: 100000, seed: 201607, alphabet: "z" }), gen({ $gen: "string", n: 99999, seed: 201607, alphabet: "z" })]
  ];
  for (const [a, b] of pairs) hidden.push(call([a.spec, b.spec], isAnagram(a.value, b.value)));

  return defineChallenge({
    slug: "anagramas",
    title: "Anagramas",
    difficulty: "medium",
    moduleId: STRINGS,
    position: 3,
    description: `Implemente a função \`saoAnagramas(a, b)\`, que retorna \`true\` se \`b\` for um **anagrama** de \`a\` e \`false\` caso contrário.

Duas palavras são anagramas quando usam **exatamente as mesmas letras, na mesma quantidade**, só que em outra ordem. \`"roma"\` e \`"amor"\` são anagramas; \`"aab"\` e \`"abb"\` não são (as letras são as mesmas, mas as quantidades não).

- As strings têm apenas letras minúsculas de \`a\` a \`z\`.
- As duas podem ter tamanhos diferentes (e então não são anagramas) e podem ser vazias.
- Cada string pode ter até **100 mil** caracteres, então compare cada letra com todas as outras (O(n²)) seria lento demais.

**Exemplos:**

- \`"roma"\`, \`"amor"\` → \`true\`
- \`"abc"\`, \`"abd"\` → \`false\`

Dica: um vetor de 26 contadores, um para cada letra, resolve o problema em uma passada.`,
    constraints: [
      "0 <= tamanho de a, tamanho de b <= 10^5",
      "a e b contêm apenas letras minúsculas de 'a' a 'z'."
    ],
    tags: ["Strings", "Contagem de frequência"],
    functionSpec: {
      name: "saoAnagramas",
      params: [{ name: "a", type: "string" }, { name: "b", type: "string" }],
      returns: "bool"
    },
    publicCases: [call(["roma", "amor"], true), call(["abc", "abd"], false)],
    hiddenCases: hidden,
    hints: [
      "Se os tamanhos forem diferentes, a resposta já é false.",
      "Somar os códigos das letras não basta: \"ad\" e \"bc\" têm a mesma soma. O que precisa bater é a quantidade de cada letra.",
      "Crie um vetor contagem[26] zerado. Para cada letra de a, some 1 na posição (letra - 'a'); para cada letra de b, subtraia 1. No fim, todas as posições devem ser zero."
    ],
    editorial: `## Ideia

Duas strings são anagramas se e somente se cada letra aparece o mesmo número de vezes nas duas. Com só 26 letras possíveis, um vetor de 26 inteiros guarda todas as contagens. O índice de uma letra é a sua distância até \`'a'\`: \`'a'\` → 0, \`'b'\` → 1, ..., \`'z'\` → 25.

\`\`\`c
#include <stdbool.h>
#include <string.h>

bool saoAnagramas(char* a, char* b) {
    int n = strlen(a);
    if (n != (int) strlen(b)) return false;
    int contagem[26] = {0};
    for (int i = 0; i < n; i++) {
        contagem[a[i] - 'a']++;
        contagem[b[i] - 'a']--;
    }
    for (int letra = 0; letra < 26; letra++) {
        if (contagem[letra] != 0) return false;
    }
    return true;
}
\`\`\`

## Alternativas

Ordenar as duas strings e compará-las também funciona, em O(n log n). Já remover cada letra de \`b\` procurando-a em \`a\` custa O(n²) e não termina a tempo com 100 mil caracteres.

## Custo

Tempo O(n) e memória O(1): o vetor tem sempre 26 posições, seja qual for o tamanho das strings.`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function compressaoRle(): Challenge {
  const random = createRandom(201700);
  const rle = (text: string) => {
    let result = "";
    for (let index = 0; index < text.length; ) {
      let end = index;
      while (end < text.length && text[end] === text[index]) end += 1;
      result += `${text[index]}${end - index}`;
      index = end;
    }
    return result;
  };
  const runs = (count: number, maxRun: number, alphabet = "abcdefghijklmnopqrstuvwxyz") => {
    let text = "";
    let previous = "";
    for (let index = 0; index < count; index += 1) {
      let char = pick(random, [...alphabet]);
      while (char === previous) char = pick(random, [...alphabet]);
      text += char.repeat(randomInt(random, 1, maxRun));
      previous = char;
    }
    return text;
  };
  const hidden: CaseDefinition[] = [];
  const add = (text: string) => hidden.push(call([text], rle(text)));
  add("aaaaaaaaaa");
  add("");
  add("a");
  add("abab");
  add("aabbbaa");
  add("zzzzzzzzzzzzzzzzzzzzzzzzz");
  add("abcdefghijklmnopqrstuvwxyz");
  add("q".repeat(99) + "r".repeat(100) + "s".repeat(101));
  add(runs(30, 5));
  add(runs(200, 40));
  add(runs(800, 25).slice(0, 20000));
  for (const spec of [
    gen({ $gen: "string", n: 20000, seed: 201701, alphabet: "a" }),
    gen({ $gen: "string", n: 20000, seed: 201702, alphabet: "ab" }),
    gen({ $gen: "string", n: 20000, seed: 201703 }),
    gen({ $gen: "concat", parts: [{ $gen: "string", n: 12345, seed: 1, alphabet: "x" }, { $gen: "string", n: 7655, seed: 1, alphabet: "y" }] })
  ]) {
    hidden.push(call([spec.spec], rle(spec.value)));
  }

  return defineChallenge({
    slug: "compressao-rle",
    title: "Compressão RLE",
    difficulty: "medium",
    moduleId: STRINGS,
    position: 4,
    description: `Implemente a função \`comprimir(texto)\`, que aplica a **codificação por comprimento de sequência** (RLE, do inglês *run-length encoding*).

A ideia é trocar cada bloco de letras iguais e **consecutivas** pela letra seguida da **quantidade** de repetições. Por exemplo, \`"aaabcc"\` tem os blocos \`aaa\`, \`b\` e \`cc\`, e vira \`"a3b1c2"\`.

- Letras iguais separadas por outras formam blocos diferentes: \`"abab"\` → \`"a1b1a1b1"\`.
- A quantidade pode ter **mais de um dígito**: \`"aaaaaaaaaaaa"\` (12 letras) → \`"a12"\`.
- O texto vazio vira \`""\`.

**Exemplos:**

- \`"aaabcc"\` → \`"a3b1c2"\`
- \`"xyz"\` → \`"x1y1z1"\`

Em C, aloque a resposta com \`malloc\`: \`2 * tamanho + 1\` bytes são sempre suficientes. Para escrever um número dentro da string, \`sprintf\` ajuda.`,
    constraints: [
      "0 <= tamanho de texto <= 2 * 10^4",
      "texto contém apenas letras minúsculas de 'a' a 'z'."
    ],
    tags: ["Strings", "Blocos consecutivos"],
    functionSpec: { name: "comprimir", params: [{ name: "texto", type: "string" }], returns: "string" },
    publicCases: [call(["aaabcc"], "a3b1c2"), call(["xyz"], "x1y1z1")],
    hiddenCases: hidden,
    hints: [
      "Percorra o texto contando quantas vezes seguidas a letra atual se repete. Quando a letra mudar (ou o texto acabar), escreva a letra e a contagem.",
      "A contagem pode passar de 9. Em C, somar '0' à contagem só funciona para um dígito; use sprintf(resposta + k, \"%d\", contagem), que devolve quantos caracteres escreveu."
    ],
    editorial: `## Ideia

Percorremos o texto em blocos. Na posição \`i\`, avançamos um segundo índice \`j\` enquanto \`texto[j]\` for igual a \`texto[i]\`. O bloco tem \`j - i\` letras; escrevemos a letra e esse número e continuamos a partir de \`j\`.

\`\`\`c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char* comprimir(char* texto) {
    int n = strlen(texto), k = 0;
    char* resposta = malloc(2 * n + 1);
    int i = 0;
    while (i < n) {
        int j = i;
        while (j < n && texto[j] == texto[i]) j++;
        resposta[k++] = texto[i];
        k += sprintf(resposta + k, "%d", j - i);
        i = j;
    }
    resposta[k] = '\\0';
    return resposta;
}
\`\`\`

## Armadilhas

- Escrever a contagem como um único caractere (\`'0' + contagem\`): com 10 repetições, sai \`':'\` em vez de \`"10"\`.
- Esquecer o último bloco quando a comparação é feita só "ao trocar de letra".

## Custo

Cada caractere é lido uma vez: tempo O(n). A resposta tem no máximo 2n caracteres.`,
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

// ---------- CPF ----------
function cpfCheckDigits(base: number[]): number[] {
  const digit = (values: number[]) => {
    const weightStart = values.length + 1;
    const total = values.reduce((acc, value, index) => acc + value * (weightStart - index), 0);
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = digit(base);
  const second = digit([...base, first]);
  return [first, second];
}

function isValidCpf(text: string): boolean {
  const digits = text.replace(/[.-]/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const values = [...digits].map(Number);
  const [first, second] = cpfCheckDigits(values.slice(0, 9));
  return values[9] === first && values[10] === second;
}

const formatCpf = (digits: string) => `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;

function validarCpf(): Challenge {
  const random = createRandom(201800);
  const validCpf = () => {
    let base: number[];
    do base = Array.from({ length: 9 }, () => randomInt(random, 0, 9));
    while (base.every((value) => value === base[0]));
    return [...base, ...cpfCheckDigits(base)].join("");
  };
  const breakCheckDigit = (digits: string, position: 9 | 10) => {
    const wrong = (Number(digits[position]) + randomInt(random, 1, 9)) % 10;
    return digits.slice(0, position) + wrong + digits.slice(position + 1);
  };
  const hidden: CaseDefinition[] = [];
  const add = (text: string) => hidden.push(call([text], isValidCpf(text)));
  add("000.000.000-00");
  add("99999999999");
  add("111.111.111-11");
  add("");
  add("1234567890");
  add("123.456.789-091");
  add("123456789-09");
  add("12345678909");
  add("123.456.789-00");
  add("123.456.789-90");
  for (let index = 0; index < 4; index += 1) {
    const cpf = validCpf();
    add(index % 2 === 0 ? formatCpf(cpf) : cpf);
  }
  for (let index = 0; index < 4; index += 1) {
    const cpf = breakCheckDigit(validCpf(), index % 2 === 0 ? 9 : 10);
    add(index < 2 ? formatCpf(cpf) : cpf);
  }
  // Troca dois dígitos vizinhos da base: os pesos diferentes denunciam a troca.
  for (let index = 0; index < 2; index += 1) {
    let cpf = validCpf();
    let swapped = cpf;
    for (let tries = 0; tries < 20 && swapped === cpf; tries += 1) {
      const at = randomInt(random, 0, 7);
      swapped = cpf.slice(0, at) + cpf[at + 1] + cpf[at] + cpf.slice(at + 2);
      if (swapped === cpf) cpf = validCpf();
    }
    add(formatCpf(swapped));
  }
  // Base cujo primeiro dígito verificador dá resto < 2 (dígito 0).
  let zeroDigit = validCpf();
  while (zeroDigit[9] !== "0") zeroDigit = validCpf();
  add(formatCpf(zeroDigit));

  return defineChallenge({
    slug: "validar-cpf",
    title: "Validar CPF",
    difficulty: "medium",
    moduleId: STRINGS,
    position: 5,
    isBoss: true,
    description: `**Desafio do módulo.** Implemente a função \`validarCpf(cpf)\`, que retorna \`true\` se o CPF for válido e \`false\` caso contrário.

Um CPF tem **11 dígitos**. Os 9 primeiros formam a base, e os 2 últimos são **dígitos verificadores**, calculados a partir da base. O CPF pode vir sem pontuação (\`"12345678909"\`) ou formatado (\`"123.456.789-09"\`). Os caracteres \`.\` e \`-\` devem ser **ignorados**.

**Como calcular os dígitos verificadores:**

1. **Primeiro dígito:** multiplique os 9 primeiros dígitos pelos pesos 10, 9, 8, ..., 2 (o primeiro dígito pelo 10, o segundo pelo 9, e assim por diante) e some tudo. Calcule o resto da divisão dessa soma por 11. Se o resto for menor que 2, o dígito é \`0\`; senão, é \`11 - resto\`.
2. **Segundo dígito:** faça o mesmo com os 10 primeiros dígitos (a base mais o primeiro verificador), usando os pesos 11, 10, ..., 2.

O CPF é válido quando os dois dígitos calculados são **iguais** ao 10º e ao 11º dígitos informados.

**Exemplo:** para \`123.456.789-09\`, a soma do primeiro dígito é \`1*10 + 2*9 + 3*8 + 4*7 + 5*6 + 6*5 + 7*4 + 8*3 + 9*2 = 210\`. Como \`210 % 11 = 1\` (menor que 2), o primeiro verificador é \`0\`. O segundo dá \`9\`. Os dígitos informados são \`0\` e \`9\`, então o CPF é válido.

Regras adicionais:

- Se, depois de remover \`.\` e \`-\`, não sobrarem **exatamente 11 dígitos**, o CPF é inválido.
- CPFs com **todos os dígitos iguais** (\`000.000.000-00\`, \`111.111.111-11\`, ...) são **inválidos**, mesmo que a conta dos verificadores "feche".

Em C, a string termina em \`'\\0'\`; o valor numérico de um caractere dígito \`c\` é \`c - '0'\`.`,
    constraints: [
      "0 <= tamanho de cpf <= 20",
      "cpf contém apenas dígitos, pontos ('.') e hífens ('-')."
    ],
    tags: ["Strings", "Dígitos verificadores"],
    functionSpec: { name: "validarCpf", params: [{ name: "cpf", type: "string" }], returns: "bool" },
    publicCases: [call(["123.456.789-09"], true), call(["12345678900"], false)],
    hiddenCases: hidden,
    hints: [
      "Comece extraindo só os dígitos para um vetor de inteiros (c - '0' em C, Number(c) em JS, int(c) em Python). Se não forem 11, retorne false.",
      "Escreva uma função auxiliar que recebe os dígitos e o peso inicial (10 ou 11) e devolve o verificador: soma dos produtos, resto por 11, e 0 se o resto for menor que 2.",
      "Antes da conta, verifique se todos os dígitos são iguais ao primeiro: nesse caso o CPF é inválido, embora os verificadores confiram."
    ],
    editorial: `## Ideia

O desafio junta várias ideias do módulo: percorrer uma string, filtrar caracteres, converter dígitos em números e acumular somas com pesos.

1. Percorra a string guardando só os dígitos. Se não forem exatamente 11, o CPF é inválido.
2. Se todos os dígitos forem iguais, o CPF é inválido.
3. Calcule o primeiro verificador com os pesos 10 a 2 sobre os 9 primeiros dígitos e o segundo com os pesos 11 a 2 sobre os 10 primeiros.
4. Compare com os dois últimos dígitos.

\`\`\`c
#include <stdbool.h>

static int verificador(int* d, int quantidade) {
    int soma = 0;
    for (int i = 0; i < quantidade; i++) {
        soma += d[i] * (quantidade + 1 - i);
    }
    int resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}

bool validarCpf(char* cpf) {
    int d[11], n = 0;
    for (int i = 0; cpf[i] != '\\0'; i++) {
        if (cpf[i] == '.' || cpf[i] == '-') continue;
        if (n == 11) return false;  /* dígitos demais */
        d[n++] = cpf[i] - '0';
    }
    if (n != 11) return false;

    bool todosIguais = true;
    for (int i = 1; i < 11; i++) {
        if (d[i] != d[0]) todosIguais = false;
    }
    if (todosIguais) return false;

    return verificador(d, 9) == d[9] && verificador(d, 10) == d[10];
}
\`\`\`

## Por que a regra dos dígitos iguais existe

Para \`111.111.111-11\`, a primeira soma é \`1 * (10 + 9 + ... + 2) = 54\`, e \`54 % 11 = 10\`, o que dá o verificador \`1\`. A segunda também dá \`1\`. A conta "fecha", mas esses números não são CPFs de verdade, então a regra precisa ser verificada à parte.

## Custo

A entrada é pequena e cada caractere é visitado uma vez: tempo O(n) e memória O(1).`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

export function buildFundamentosColecoesChallenges(): Challenge[] {
  return [
    somaDoVetor(),
    maiorEMenor(),
    inverterVetor(),
    contarOcorrencias(),
    removerDuplicados(),
    segundoMaior(),
    rotacionarVetor(),
    somaDasDiagonais(),
    transposta(),
    multiplicacaoDeMatrizes(),
    percursoEmEspiral(),
    vencedorDoJogoDaVelha(),
    contarVogais(),
    inverterPalavras(),
    palindromoDeFrase(),
    anagramas(),
    compressaoRle(),
    validarCpf()
  ];
}
