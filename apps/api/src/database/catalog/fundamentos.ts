import type { Challenge } from "../../domain/types.js";
import { call, createRandom, defineChallenge, randomInt } from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Fundamentos de Programação": desafios no modo função, aceitos em
 * JavaScript, Python e C. O aluno implementa só a função pedida.
 */

function somaDeDoisNumeros(): Challenge {
  const random = createRandom(20260928);
  const hidden: Array<[number, number]> = [
    [-2, 10], [0, 0], [-1000, -1000], [1000, 1000], [-7, 7], [1000, -1], [0, -999], [123, 456]
  ];
  while (hidden.length < 22) hidden.push([randomInt(random, -1000, 1000), randomInt(random, -1000, 1000)]);
  return defineChallenge({
    slug: "soma-de-dois-numeros",
    id: "challenge-soma",
    caseIdPrefix: "tc-soma",
    title: "Soma de dois números",
    difficulty: "easy",
    points: 100,
    moduleId: moduleId("entrada-saida"),
    position: 0,
    description: "Implemente a função somar(a, b), que recebe dois números inteiros e retorna a soma entre eles.",
    constraints: ["-1000 <= a, b <= 1000", "Retorne o valor; não é preciso ler a entrada nem imprimir."],
    tags: ["Operadores", "Funções"],
    functionSpec: { name: "somar", params: [{ name: "a", type: "int" }, { name: "b", type: "int" }], returns: "int" },
    publicCases: [call([3, 5], 8), call([10, -4], 6)],
    hiddenCases: hidden.map(([a, b]) => call([a, b], a + b)),
    hints: [
      "Os valores já chegam nos parâmetros a e b: não é preciso ler nada do teclado.",
      "Use `return` para devolver o resultado; imprimir com console.log, print ou printf não conta como resposta.",
      "Os números podem ser negativos: a soma comum (a + b) já trata esse caso."
    ],
    editorial: [
      "**Ideia:** devolver a + b.",
      "",
      "No modo função, o juiz chama a sua função com os valores do caso de teste e compara o que ela **retorna** com a resposta esperada. Por isso não há leitura de entrada nem impressão: basta calcular e retornar.",
      "",
      "```js",
      "function somar(a, b) {",
      "  return a + b;",
      "}",
      "```",
      "",
      "Em Python é `return a + b` dentro de `def somar(a, b):`, e em C, `int somar(int a, int b) { return a + b; }`.",
      "",
      "**Custo:** O(1) de tempo e de memória."
    ].join("\n"),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function parOuImpar(): Challenge {
  const random = createRandom(4242);
  const parity = (value: number) => (value % 2 === 0 ? "PAR" : "IMPAR");
  const hidden = [7, 0, -3, -8, 1, 2, 1000000000, -999999999, -1, 15];
  while (hidden.length < 22) hidden.push(randomInt(random, -1000000000, 1000000000));
  return defineChallenge({
    slug: "par-ou-impar",
    id: "challenge-par-ou-impar",
    caseIdPrefix: "tc-par",
    title: "Par ou ímpar",
    difficulty: "easy",
    points: 80,
    moduleId: moduleId("condicionais"),
    position: 0,
    description: 'Implemente a função parOuImpar(n), que retorna "PAR" se n for divisível por 2 e "IMPAR" caso contrário. Atenção aos números negativos.',
    constraints: ["-10^9 <= n <= 10^9", 'Retorne exatamente "PAR" ou "IMPAR".'],
    tags: ["Condicionais", "Resto da divisão"],
    functionSpec: { name: "parOuImpar", params: [{ name: "n", type: "long" }], returns: "string" },
    publicCases: [call([4], "PAR"), call([9], "IMPAR")],
    hiddenCases: hidden.map((value) => call([value], parity(value))),
    hints: [
      "O operador de resto (%) diz se a divisão por 2 é exata.",
      "Em várias linguagens, o resto de um número negativo ímpar por 2 é -1, não 1.",
      "Teste `n % 2 == 0` (é par) em vez de `n % 2 == 1` (que falha para ímpares negativos em JavaScript e C)."
    ],
    editorial: [
      "**Ideia:** um número é par quando o resto da divisão por 2 é zero.",
      "",
      "O detalhe está nos negativos: em JavaScript e em C, `-3 % 2` vale `-1`. Quem testa `n % 2 == 1` para detectar ímpares erra todos os ímpares negativos. Testar a igualdade com zero funciona para qualquer sinal.",
      "",
      "```c",
      "char* parOuImpar(long long n) {",
      "    return n % 2 == 0 ? \"PAR\" : \"IMPAR\";",
      "}",
      "```",
      "",
      "Em C, devolver uma string literal é seguro: ela existe durante todo o programa.",
      "",
      "**Custo:** O(1)."
    ].join("\n"),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function maiorDeTres(): Challenge {
  const random = createRandom(31337);
  const hidden: Array<[number, number, number]> = [
    [-5, -2, -9], [7, 7, 1], [1, 2, 3], [3, 2, 1], [2, 3, 1], [0, 0, 0],
    [-10000, -10000, -10000], [10000, -10000, 0], [-1, -1, -2], [5, 9, 9]
  ];
  while (hidden.length < 24) {
    hidden.push([randomInt(random, -10000, 10000), randomInt(random, -10000, 10000), randomInt(random, -10000, 10000)]);
  }
  return defineChallenge({
    slug: "maior-de-tres-numeros",
    id: "challenge-maior-de-tres",
    caseIdPrefix: "tc-maior",
    title: "Maior de três números",
    difficulty: "easy",
    points: 100,
    moduleId: moduleId("condicionais"),
    position: 1,
    description: "Implemente a função maiorDeTres(a, b, c), que retorna o maior dos três inteiros recebidos.",
    constraints: ["-10000 <= a, b, c <= 10000", "Resolva com comparações (if/else)."],
    tags: ["Condicionais", "Comparações"],
    functionSpec: {
      name: "maiorDeTres",
      params: [{ name: "a", type: "int" }, { name: "b", type: "int" }, { name: "c", type: "int" }],
      returns: "int"
    },
    publicCases: [call([3, 8, 5], 8), call([10, 2, 7], 10)],
    hiddenCases: hidden.map((values) => call(values, Math.max(...values))),
    hints: [
      "Compare a com b primeiro e guarde o maior; depois compare esse resultado com c.",
      "Os números podem ser iguais ou negativos: comece com `maior = a` (e não com 0) e use `>` nas comparações.",
      "Duas comparações bastam: `if (b > maior) maior = b;` e `if (c > maior) maior = c;`."
    ],
    editorial: [
      "**Ideia:** manter o maior valor visto até agora.",
      "",
      "1. Comece com `maior = a`.",
      "2. Se `b` for maior, ele passa a ser o maior.",
      "3. Se `c` for maior que o maior atual, ele passa a ser o maior.",
      "",
      "```js",
      "function maiorDeTres(a, b, c) {",
      "  let maior = a;",
      "  if (b > maior) maior = b;",
      "  if (c > maior) maior = c;",
      "  return maior;",
      "}",
      "```",
      "",
      "Começar com `maior = 0` é um erro comum: se os três números forem negativos, a função devolveria 0. A mesma ideia de \"guardar o melhor até agora\" volta nos laços, para achar o maior de um vetor inteiro.",
      "",
      "**Custo:** O(1)."
    ].join("\n"),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

export function buildFundamentosChallenges(): Challenge[] {
  return [somaDeDoisNumeros(), parOuImpar(), maiorDeTres()];
}
