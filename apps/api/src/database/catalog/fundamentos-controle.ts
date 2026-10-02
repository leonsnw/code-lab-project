import type { Challenge } from "../../domain/types.js";
import { call, createRandom, defineChallenge, language, pick, randomInt, type CaseDefinition } from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Fundamentos de Programação", módulos de entrada e saída,
 * condicionais, laços e funções. Todos aceitam JavaScript, Python e C; só
 * "saudacao" usa o modo stdio (para ensinar a ler a entrada padrão), os
 * demais são no modo função. Sementes na faixa 100000–199999.
 */

const C_VETOR =
  "Em C, a assinatura segue o estilo do LeetCode: além dos parâmetros, a função recebe `int* returnSize`. Aloque o vetor de resposta com `malloc`, preencha-o e informe o tamanho com `*returnSize = ...` antes de retornar.";
const C_TEXTO = "Em C, retorne um `char*` alocado com `malloc`, com espaço para o `'\\0'` que termina a string.";

const md = (...lines: string[]) => lines.join("\n");

// ======================================================================
// Módulo: entrada-saida (posição 0 é soma-de-dois-numeros)
// ======================================================================

function saudacao(): Challenge {
  const random = createRandom(100001);
  const nomes = ["Ana", "João", "Maria", "José", "Lúcia", "Pedro", "Íris", "Luís", "Beatriz", "Otávio", "Cecília", "Tânia", "Sérgio", "Raí"];
  const sobrenomes = ["Souza", "Silva", "Conceição", "Araújo", "Gonçalves", "Lima", "Nóbrega", "Brandão", "Assunção", "Oliveira"];
  const fixos = [
    "Ana Clara",
    "José da Silva",
    "Zé",
    "X",
    "Maria Eduarda Souza",
    "Ângela",
    "Joana D'Arc",
    "Ana-Luísa Gonçalves",
    "Pedro de Alcântara João Carlos Leopoldo Salvador Bibiano Francisco Xavier de Paula",
    "Mestre Yoda 2"
  ];
  const aleatorios: string[] = [];
  while (aleatorios.length < 6) {
    const partes = [pick(random, nomes)];
    const extras = randomInt(random, 0, 3);
    for (let index = 0; index < extras; index += 1) partes.push(pick(random, sobrenomes));
    aleatorios.push(partes.join(" "));
  }
  // Alguns casos terminam com quebra de linha, como quando o usuário digita e aperta Enter.
  const caso = (nome: string, quebra = false): CaseDefinition => ({ input: quebra ? `${nome}\n` : nome, output: `Olá, ${nome}!` });
  return defineChallenge({
    slug: "saudacao",
    title: "Saudação",
    difficulty: "easy",
    moduleId: moduleId("entrada-saida"),
    position: 1,
    mode: "stdio",
    description: md(
      "Este é um desafio no **modo entrada e saída**: em vez de implementar uma função, você escreve um programa completo que **lê da entrada padrão** e **escreve na saída padrão**.",
      "",
      "A entrada tem **uma única linha** com o nome de uma pessoa. O nome pode ter espaços (nome e sobrenome), acentos, hífen ou apóstrofo. Seu programa deve imprimir a saudação:",
      "",
      "```",
      "Olá, <nome>!",
      "```",
      "",
      "Repare nos detalhes: `Olá` com acento, uma vírgula, **um** espaço, o nome exatamente como foi lido e um ponto de exclamação no final.",
      "",
      "Como ler uma linha inteira em cada linguagem:",
      "",
      "- **JavaScript:** `require(\"fs\").readFileSync(0, \"utf8\")` devolve toda a entrada; tire a quebra de linha do final.",
      "- **Python:** `input()` lê uma linha (sem o `\\n`).",
      "- **C:** `fgets(nome, sizeof nome, stdin)` lê a linha inteira, com espaços. Cuidado: `scanf(\"%s\", nome)` para no primeiro espaço!",
      "",
      "A linha pode ou não terminar com uma quebra de linha (`\\n`); ela não faz parte do nome."
    ),
    constraints: [
      "O nome tem de 1 a 100 caracteres e não começa nem termina com espaço.",
      "A saída deve ser exatamente `Olá, <nome>!` (espaços no fim da linha são ignorados).",
      "Leia da entrada padrão e imprima na saída padrão."
    ],
    tags: ["Entrada e saída", "Strings"],
    publicCases: [caso("Maria"), caso("João", true)],
    hiddenCases: [
      caso(fixos[0]),
      caso(fixos[1], true),
      caso(fixos[2]),
      caso(fixos[3], true),
      caso(fixos[4]),
      caso(fixos[5]),
      caso(fixos[6], true),
      caso(fixos[7]),
      caso(fixos[8], true),
      caso(fixos[9]),
      ...aleatorios.map((nome, index) => caso(nome, index % 2 === 0))
    ],
    hints: [
      "Leia a linha inteira de uma vez, e não palavra por palavra: o nome pode ter espaços.",
      "Depois de ler, remova a quebra de linha do final (`\\n` e, por garantia, `\\r`) antes de montar a frase.",
      "Em C, use `fgets` e troque o `'\\n'` final por `'\\0'`; em JavaScript, `trimEnd()` na entrada resolve."
    ],
    editorial: md(
      "**Ideia:** ler a linha completa, limpar a quebra de linha e imprimir a frase montada.",
      "",
      "1. Leia toda a linha da entrada padrão.",
      "2. Remova o `\\n` (e um eventual `\\r`) do final.",
      "3. Imprima `Olá, ` + nome + `!`.",
      "",
      "```c",
      "#include <stdio.h>",
      "#include <string.h>",
      "",
      "int main(void) {",
      "    char nome[256];",
      "    if (!fgets(nome, sizeof nome, stdin)) return 0;",
      "    nome[strcspn(nome, \"\\r\\n\")] = '\\0';  /* corta a quebra de linha */",
      "    printf(\"Olá, %s!\\n\", nome);",
      "    return 0;",
      "}",
      "```",
      "",
      "O erro mais comum é usar `scanf(\"%s\")`, que lê só até o primeiro espaço: \"Ana Clara\" viraria \"Ana\".",
      "",
      "**Custo:** O(n) no tamanho do nome, só para ler e imprimir."
    ),
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

function mediaDeTresNotas(): Challenge {
  const random = createRandom(100002);
  const media = (a: number, b: number, c: number) => (a + b + c) / 3;
  const hidden: Array<[number, number, number]> = [
    [7.5, 8, 9], [0, 0, 0], [10, 10, 10], [0, 0, 10], [10, 0, 0], [9.5, 9.5, 10],
    [6.3, 7.1, 5.9], [1, 2, 2], [3.33, 3.33, 3.34], [0.1, 0.2, 0.3], [4, 5, 5]
  ];
  while (hidden.length < 18) {
    hidden.push([randomInt(random, 0, 100) / 10, randomInt(random, 0, 100) / 10, randomInt(random, 0, 1000) / 100]);
  }
  return defineChallenge({
    slug: "media-de-tres-notas",
    title: "Média de três notas",
    difficulty: "easy",
    moduleId: moduleId("entrada-saida"),
    position: 2,
    description: md(
      "Implemente a função `mediaDeTres(n1, n2, n3)`, que recebe as três notas de um aluno e **retorna a média aritmética** delas.",
      "",
      "As notas são números reais (podem ter casas decimais, como `7.5`), e a média também: não arredonde nem trunque o resultado.",
      "",
      "> A média aritmética é a soma dos valores dividida pela quantidade de valores. Lembre-se da **precedência**: `a + b + c / 3` divide só o `c`! Use parênteses.",
      "",
      "A resposta é aceita se estiver a no máximo `0.000001` da resposta certa, então não se preocupe com a última casa decimal."
    ),
    constraints: ["0 <= n1, n2, n3 <= 10", "As notas podem ter até duas casas decimais.", "Retorne um número real (double)."],
    tags: ["Operadores", "Números reais"],
    functionSpec: {
      name: "mediaDeTres",
      params: [{ name: "n1", type: "double" }, { name: "n2", type: "double" }, { name: "n3", type: "double" }],
      returns: "double"
    },
    checker: { kind: "tolerance", epsilon: 1e-6 },
    publicCases: [call([7, 8, 9], 8), call([5, 6, 10], 7)],
    hiddenCases: hidden.map((notas) => call(notas, media(...notas))),
    hints: [
      "Some as três notas e divida por 3, usando parênteses para a soma acontecer primeiro.",
      "Em C, guarde a soma em uma variável `double`: se ela for `int`, as casas decimais das notas se perdem."
    ],
    editorial: md(
      "**Ideia:** aplicar a fórmula da média, `(n1 + n2 + n3) / 3`.",
      "",
      "Dois cuidados: os parênteses (sem eles, só `n3` seria dividido) e o tipo. Em C, `int soma = n1 + n2 + n3` joga fora as casas decimais: 7.5 + 8 + 9 viraria 24, e a média, 8 em vez de 8.1666…",
      "",
      "```c",
      "double mediaDeTres(double n1, double n2, double n3) {",
      "    return (n1 + n2 + n3) / 3.0;",
      "}",
      "```",
      "",
      "**Custo:** O(1) de tempo e de memória."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function celsiusParaFahrenheit(): Challenge {
  const random = createRandom(100003);
  const converter = (celsius: number) => (celsius * 9) / 5 + 32;
  const hidden = [-40, 37, 36.6, -273.15, 1000, 25.5, -17.7, 0.5, -300, 21.3, 100.1, -0.1];
  while (hidden.length < 18) hidden.push(randomInt(random, -3000, 10000) / 10);
  return defineChallenge({
    slug: "celsius-para-fahrenheit",
    title: "Celsius para Fahrenheit",
    difficulty: "easy",
    moduleId: moduleId("entrada-saida"),
    position: 3,
    description: md(
      "Implemente a função `celsiusParaFahrenheit(celsius)`, que recebe uma temperatura em graus Celsius e **retorna a mesma temperatura em graus Fahrenheit**.",
      "",
      "A fórmula de conversão é:",
      "",
      "```",
      "F = C × 9 / 5 + 32",
      "```",
      "",
      "Por exemplo, a água ferve a 100 °C, que são 212 °F. A temperatura pode ser negativa e ter casas decimais; o resultado **não deve ser arredondado**. A resposta é aceita se estiver a no máximo `0.000001` da certa."
    ),
    constraints: ["-300 <= celsius <= 1000", "Retorne um número real (double), sem arredondar."],
    tags: ["Operadores", "Números reais"],
    functionSpec: { name: "celsiusParaFahrenheit", params: [{ name: "celsius", type: "double" }], returns: "double" },
    checker: { kind: "tolerance", epsilon: 1e-6 },
    publicCases: [call([0], 32), call([100], 212)],
    hiddenCases: hidden.map((celsius) => call([celsius], converter(celsius))),
    hints: [
      "Multiplique por 9, divida por 5 e some 32, nessa ordem.",
      "Em C, `9 / 5` entre inteiros vale 1, não 1.8. Escreva `9.0 / 5.0` ou multiplique `celsius * 9` primeiro."
    ],
    editorial: md(
      "**Ideia:** aplicar a fórmula diretamente, sem arredondar.",
      "",
      "O cuidado está na divisão: em C (e em muitas linguagens), `9 / 5` entre dois inteiros é uma **divisão inteira** e vale 1. Como `celsius` é `double`, calcular `celsius * 9 / 5` já faz a conta toda em ponto flutuante.",
      "",
      "```js",
      "function celsiusParaFahrenheit(celsius) {",
      "  return celsius * 9 / 5 + 32;",
      "}",
      "```",
      "",
      "Arredondar com `Math.round` passaria nos exemplos (0 e 100 dão resultados inteiros), mas erraria 37 °C, que são 98,6 °F.",
      "",
      "**Custo:** O(1)."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function divisaoInteiraEResto(): Challenge {
  const random = createRandom(100004);
  const hidden: Array<[number, number]> = [
    [19, 5], [0, 7], [5, 7], [7, 2], [1000000000, 1], [1000000000, 1000000000],
    [999999999, 1000000000], [1, 1], [100, 3], [99, 100], [1000000000, 3], [123456789, 1000]
  ];
  while (hidden.length < 18) {
    const b = random() < 0.5 ? randomInt(random, 1, 100) : randomInt(random, 1, 1000000000);
    hidden.push([randomInt(random, 0, 1000000000), b]);
  }
  return defineChallenge({
    slug: "divisao-inteira-e-resto",
    title: "Divisão inteira e resto",
    difficulty: "easy",
    moduleId: moduleId("entrada-saida"),
    position: 4,
    description: md(
      "Implemente a função `divisaoEResto(a, b)`, que recebe dois inteiros e **retorna um vetor com dois números**: `[quociente, resto]` da divisão inteira de `a` por `b`.",
      "",
      "Na divisão inteira, o quociente é quantas vezes `b` cabe inteiro em `a`, e o resto é o que sobra. Por exemplo, 17 dividido por 5 dá quociente 3 e resto 2, porque `5 × 3 + 2 = 17`.",
      "",
      "- O quociente deve ser um inteiro: descarte a parte fracionária (não arredonde).",
      "- O resto sempre fica entre `0` e `b - 1`.",
      "",
      "Operadores úteis: `%` (resto) em todas as linguagens; `//` em Python e `Math.floor(a / b)` em JavaScript para o quociente; em C, `/` entre inteiros já é divisão inteira.",
      "",
      C_VETOR
    ),
    constraints: ["0 <= a <= 10^9", "1 <= b <= 10^9", "Retorne [quociente, resto]."],
    tags: ["Operadores", "Resto da divisão"],
    functionSpec: {
      name: "divisaoEResto",
      params: [{ name: "a", type: "int" }, { name: "b", type: "int" }],
      returns: "int[]"
    },
    publicCases: [call([17, 5], [3, 2]), call([20, 4], [5, 0])],
    hiddenCases: hidden.map(([a, b]) => call([a, b], [Math.floor(a / b), a % b])),
    hints: [
      "O resto sai direto do operador `%`.",
      "O quociente não pode ser arredondado: 19 / 5 = 3,8, mas o quociente inteiro é 3. Use divisão inteira (ou descarte a parte fracionária)."
    ],
    editorial: md(
      "**Ideia:** usar os operadores de divisão inteira e de resto.",
      "",
      "Como `a >= 0` e `b >= 1`, basta `quociente = a / b` (divisão inteira) e `resto = a % b`. Vale sempre `b × quociente + resto = a`.",
      "",
      "```c",
      "#include <stdlib.h>",
      "",
      "int* divisaoEResto(int a, int b, int* returnSize) {",
      "    int* resposta = malloc(2 * sizeof(int));",
      "    resposta[0] = a / b;  /* entre inteiros, / descarta a parte fracionária */",
      "    resposta[1] = a % b;",
      "    *returnSize = 2;",
      "    return resposta;",
      "}",
      "```",
      "",
      "Em JavaScript, `a / b` dá um número com casas decimais: use `Math.floor(a / b)`. `Math.round` é um erro comum: acerta 17 / 5, mas erra 19 / 5.",
      "",
      "**Custo:** O(1)."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function segundosParaRelogio(): Challenge {
  const random = createRandom(100005);
  const pad = (value: number) => String(value).padStart(2, "0");
  const formatar = (total: number) => `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  const hidden = [0, 59, 60, 61, 3599, 3600, 3661, 359999, 86400, 7, 600, 36000, 35999, 90061];
  while (hidden.length < 20) hidden.push(randomInt(random, 0, 359999));
  return defineChallenge({
    slug: "segundos-para-relogio",
    title: "Segundos para relógio",
    difficulty: "medium",
    moduleId: moduleId("entrada-saida"),
    position: 5,
    description: md(
      "Implemente a função `formatarRelogio(segundos)`, que recebe uma duração em segundos e **retorna uma string no formato `\"HH:MM:SS\"`** (horas, minutos e segundos).",
      "",
      "- Cada parte tem **sempre dois dígitos**, com zero à esquerda quando precisar: 5 minutos viram `05`.",
      "- Minutos e segundos vão de `00` a `59`. As horas não voltam para zero depois de 24: 90000 segundos são `\"25:00:00\"`.",
      "",
      "Por exemplo, 3661 segundos são 1 hora, 1 minuto e 1 segundo: `\"01:01:01\"`.",
      "",
      "Dica de contas: uma hora tem 3600 segundos e um minuto tem 60. A divisão inteira e o resto (`%`) fazem todo o trabalho.",
      "",
      C_TEXTO
    ),
    constraints: ["0 <= segundos <= 359999 (as horas cabem em dois dígitos)", "Retorne exatamente \"HH:MM:SS\"."],
    tags: ["Operadores", "Resto da divisão", "Strings"],
    functionSpec: { name: "formatarRelogio", params: [{ name: "segundos", type: "int" }], returns: "string" },
    publicCases: [call([45296], "12:34:56"), call([86399], "23:59:59")],
    hiddenCases: hidden.map((total) => call([total], formatar(total))),
    hints: [
      "Horas = segundos / 3600 (divisão inteira). O que sobra, `segundos % 3600`, vira minutos e segundos.",
      "Minutos = (segundos % 3600) / 60 e segundos restantes = segundos % 60.",
      "Complete com zero à esquerda: `padStart(2, \"0\")` em JavaScript, `f\"{h:02d}\"` em Python e `\"%02d\"` no `sprintf` do C."
    ],
    editorial: md(
      "**Ideia:** decompor o total em horas, minutos e segundos com divisão inteira e resto, e formatar com dois dígitos.",
      "",
      "1. `h = total / 3600` (inteira).",
      "2. `m = (total % 3600) / 60`.",
      "3. `s = total % 60`.",
      "4. Monte a string completando cada parte com zero à esquerda.",
      "",
      "```c",
      "#include <stdio.h>",
      "#include <stdlib.h>",
      "",
      "char* formatarRelogio(int segundos) {",
      "    char* texto = malloc(16);",
      "    sprintf(texto, \"%02d:%02d:%02d\", segundos / 3600, segundos % 3600 / 60, segundos % 60);",
      "    return texto;",
      "}",
      "```",
      "",
      "Esquecer o zero à esquerda passa nos exemplos (todas as partes já têm dois dígitos), mas falha em 3661, que daria `\"1:1:1\"`.",
      "",
      "**Custo:** O(1)."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function trocoEmCedulas(): Challenge {
  const random = createRandom(100006);
  const valores = [200, 100, 50, 20, 10, 5, 2, 1];
  const troco = (total: number) => {
    let resto = total;
    return valores.map((valor) => {
      const quantidade = Math.floor(resto / valor);
      resto -= quantidade * valor;
      return quantidade;
    });
  };
  const hidden = [0, 1, 1000, 99, 4, 3, 999999999, 1000000000, 777, 40, 9, 199, 201, 1234567];
  while (hidden.length < 20) hidden.push(random() < 0.5 ? randomInt(random, 0, 1000) : randomInt(random, 0, 1000000000));
  return defineChallenge({
    slug: "troco-em-cedulas",
    title: "Troco em cédulas",
    difficulty: "medium",
    moduleId: moduleId("entrada-saida"),
    position: 6,
    isBoss: true,
    description: md(
      "Um caixa eletrônico precisa entregar um valor usando **a menor quantidade possível** de cédulas e moedas. Estão disponíveis cédulas de R$ 200, 100, 50, 20, 10, 5 e 2, e moedas de R$ 1.",
      "",
      "Implemente a função `trocoEmCedulas(valor)`, que recebe um valor inteiro em reais e **retorna um vetor com 8 números**: a quantidade de cada cédula/moeda, **nesta ordem**:",
      "",
      "```",
      "[200, 100, 50, 20, 10, 5, 2, 1]",
      "```",
      "",
      "Por exemplo, R$ 18 = uma de 10 + uma de 5 + uma de 2 + uma moeda de 1, então a resposta é `[0, 0, 0, 0, 1, 1, 1, 1]`.",
      "",
      "Para este conjunto de valores, a estratégia de sempre usar o maior valor possível (quantas cédulas de 200 cabem, depois de 100 com o que sobrou, e assim por diante) sempre dá a menor quantidade. Cuidado: uma mesma cédula pode ser usada **várias vezes** (R$ 40 são duas de 20).",
      "",
      C_VETOR
    ),
    constraints: ["0 <= valor <= 10^9", "Retorne sempre 8 números, na ordem [200, 100, 50, 20, 10, 5, 2, 1]."],
    tags: ["Operadores", "Resto da divisão"],
    functionSpec: { name: "trocoEmCedulas", params: [{ name: "valor", type: "int" }], returns: "int[]" },
    publicCases: [call([388], troco(388)), call([18], troco(18))],
    hiddenCases: hidden.map((valor) => call([valor], troco(valor))),
    hints: [
      "Comece pela cédula de 200: quantas cabem no valor? E quanto sobra?",
      "A quantidade de cada cédula é `resto / valorDaCedula` (divisão inteira); o novo resto é `resto % valorDaCedula`.",
      "Guarde os 8 valores num vetor e percorra-o, repetindo as duas contas acima para cada um."
    ],
    editorial: md(
      "**Ideia:** para cada cédula, da maior para a menor, usar o máximo possível e seguir com o que sobrou.",
      "",
      "Com divisão inteira e resto, cada cédula custa só duas contas: `quantidade = resto / cedula` e `resto = resto % cedula`. Não é preciso subtrair uma cédula de cada vez (com 10^9 reais seriam milhões de repetições).",
      "",
      "```js",
      "function trocoEmCedulas(valor) {",
      "  const cedulas = [200, 100, 50, 20, 10, 5, 2, 1];",
      "  const resposta = [];",
      "  let resto = valor;",
      "  for (const cedula of cedulas) {",
      "    resposta.push(Math.floor(resto / cedula));",
      "    resto = resto % cedula;",
      "  }",
      "  return resposta;",
      "}",
      "```",
      "",
      "Um erro frequente é usar cada cédula no máximo uma vez (com `if` em vez de divisão): funciona para 388 e 18, mas R$ 40 precisa de duas cédulas de 20.",
      "",
      "**Custo:** O(1): são sempre 8 cédulas, qualquer que seja o valor."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

// ======================================================================
// Módulo: condicionais (posições 0 e 1 já existem)
// ======================================================================

const ehBissextoRef = (ano: number) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

function anoBissexto(): Challenge {
  const random = createRandom(100007);
  const hidden = [2023, 2020, 1900, 2000, 2100, 2400, 1600, 1700, 1, 4, 100, 400, 1000000000, 999999996, 2024, 1800];
  while (hidden.length < 20) hidden.push(random() < 0.5 ? randomInt(random, 1, 3000) : randomInt(random, 1, 250000) * 4);
  return defineChallenge({
    slug: "ano-bissexto",
    title: "Ano bissexto",
    difficulty: "easy",
    moduleId: moduleId("condicionais"),
    position: 2,
    description: md(
      "Implemente a função `ehBissexto(ano)`, que **retorna `true` se o ano for bissexto** e `false` caso contrário.",
      "",
      "No calendário gregoriano, um ano é bissexto quando:",
      "",
      "1. é divisível por **4**, **mas não** por **100**; ou",
      "2. é divisível por **400**.",
      "",
      "Exemplos: 2024 é bissexto (divisível por 4 e não por 100). 1900 **não** é (divisível por 100, mas não por 400). 2000 **é** (divisível por 400).",
      "",
      "Em Python, retorne `True` ou `False`; em C, `true` ou `false` (de `stdbool.h`)."
    ),
    constraints: ["1 <= ano <= 10^9", "Retorne um booleano."],
    tags: ["Condicionais", "Operadores lógicos", "Resto da divisão"],
    functionSpec: { name: "ehBissexto", params: [{ name: "ano", type: "int" }], returns: "bool" },
    publicCases: [call([2024], true), call([2023], false)],
    hiddenCases: hidden.map((ano) => call([ano], ehBissextoRef(ano))),
    hints: [
      "\"x é divisível por d\" se escreve `x % d == 0`.",
      "Só olhar a divisão por 4 não basta: teste 1900 e 2000 no papel.",
      "Junte tudo numa condição: `(ano % 4 == 0 && ano % 100 != 0) || ano % 400 == 0`."
    ],
    editorial: md(
      "**Ideia:** traduzir a regra do calendário para operadores lógicos.",
      "",
      "A regra tem uma exceção (anos divisíveis por 100) e uma exceção da exceção (anos divisíveis por 400). Em forma de condição:",
      "",
      "```js",
      "function ehBissexto(ano) {",
      "  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;",
      "}",
      "```",
      "",
      "Também dá para escrever com `if` em cascata, testando da regra mais específica para a mais geral: divisível por 400 → `true`; senão, por 100 → `false`; senão, por 4 → `true`; senão `false`.",
      "",
      "**Custo:** O(1)."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function classificarTriangulo(): Challenge {
  const random = createRandom(100008);
  const classificar = (a: number, b: number, c: number) => {
    if (a <= 0 || b <= 0 || c <= 0 || a + b <= c || a + c <= b || b + c <= a) return "INVALIDO";
    if (a === b && b === c) return "EQUILATERO";
    if (a === b || b === c || a === c) return "ISOSCELES";
    return "ESCALENO";
  };
  const hidden: Array<[number, number, number]> = [
    [10, 1, 1], [1, 2, 3], [0, 0, 0], [-3, -3, -3], [5, 5, 8], [5, 8, 5], [8, 5, 5], [2, 2, 5],
    [1000000, 1000000, 1], [1, 1, 1000000], [0, 4, 5], [7, 10, 5], [3, 7, 4], [1, 10, 1],
    [1000000, 1000000, 1000000], [6, -8, 10]
  ];
  while (hidden.length < 22) {
    const a = randomInt(random, 1, 20);
    const b = random() < 0.3 ? a : randomInt(random, 1, 20);
    const c = random() < 0.2 ? b : randomInt(random, 1, 40);
    hidden.push([a, b, c]);
  }
  return defineChallenge({
    slug: "classificar-triangulo",
    title: "Classificar triângulo",
    difficulty: "easy",
    moduleId: moduleId("condicionais"),
    position: 3,
    description: md(
      "Implemente a função `classificarTriangulo(a, b, c)`, que recebe os comprimentos de três lados e **retorna uma destas strings**:",
      "",
      "- `\"INVALIDO\"`: os lados não formam um triângulo;",
      "- `\"EQUILATERO\"`: os três lados são iguais;",
      "- `\"ISOSCELES\"`: exatamente dois lados são iguais;",
      "- `\"ESCALENO\"`: os três lados são diferentes.",
      "",
      "Três lados formam um triângulo quando **todos são positivos** e vale a **desigualdade triangular**: cada lado é **menor** que a soma dos outros dois (`a < b + c`, `b < a + c` e `c < a + b`). Se um lado for exatamente igual à soma dos outros dois, os lados ficam \"deitados\" em linha reta e **não** formam triângulo.",
      "",
      "Verifique primeiro se o triângulo é válido; só depois classifique. Os lados podem vir em qualquer ordem."
    ),
    constraints: ["-1000 <= a, b, c <= 10^6", "Retorne exatamente uma das quatro strings, sem acento."],
    tags: ["Condicionais", "Operadores lógicos"],
    functionSpec: {
      name: "classificarTriangulo",
      params: [{ name: "a", type: "int" }, { name: "b", type: "int" }, { name: "c", type: "int" }],
      returns: "string"
    },
    publicCases: [call([3, 3, 3], "EQUILATERO"), call([3, 4, 5], "ESCALENO")],
    hiddenCases: hidden.map((lados) => call(lados, classificar(...lados))),
    hints: [
      "Separe o problema em duas perguntas: \"é um triângulo?\" e, se for, \"quantos lados iguais ele tem?\".",
      "A desigualdade triangular precisa valer para os três lados, não só para um: 10, 1, 1 passa em `b + c > a`? E em `a + b > c`?",
      "Lados iguais a zero ou negativos, e casos como 1, 2, 3 (1 + 2 = 3), são inválidos."
    ],
    editorial: md(
      "**Ideia:** validar antes de classificar.",
      "",
      "1. Se algum lado for `<= 0`, ou se algum lado for `>=` à soma dos outros dois, retorne `\"INVALIDO\"`.",
      "2. Se os três forem iguais, `\"EQUILATERO\"`.",
      "3. Se algum par for igual, `\"ISOSCELES\"`.",
      "4. Senão, `\"ESCALENO\"`.",
      "",
      "```js",
      "function classificarTriangulo(a, b, c) {",
      "  if (a <= 0 || b <= 0 || c <= 0) return \"INVALIDO\";",
      "  if (a >= b + c || b >= a + c || c >= a + b) return \"INVALIDO\";",
      "  if (a === b && b === c) return \"EQUILATERO\";",
      "  if (a === b || b === c || a === c) return \"ISOSCELES\";",
      "  return \"ESCALENO\";",
      "}",
      "```",
      "",
      "A ordem importa: 0, 0, 0 tem três lados iguais, mas é inválido; se você testar \"equilátero\" primeiro, erra.",
      "",
      "**Custo:** O(1)."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function calculadoraSimples(): Challenge {
  const random = createRandom(100009);
  const calcular = (a: number, op: string, b: number) => {
    if (op === "+") return String(a + b);
    if (op === "-") return String(a - b);
    if (op === "*") return String(a * b);
    if (op === "/") return b === 0 ? "ERRO" : String(Math.trunc(a / b));
    return "ERRO";
  };
  const hidden: Array<[number, string, number]> = [
    [-7, "/", 2], [7, "/", -2], [-7, "/", -2], [5, "/", 0], [0, "/", 0], [0, "*", 5], [3, "%", 2],
    [3, "x", 2], [4, "**", 2], [4, "", 2], [8, "//", 2], [-10000, "*", 10000], [10000, "-", -10000],
    [9, "/", 3], [1, "/", 3], [-1, "/", 3], [-10000, "+", -10000]
  ];
  while (hidden.length < 23) {
    hidden.push([randomInt(random, -10000, 10000), pick(random, ["+", "-", "*", "/"]), randomInt(random, -10000, 10000)]);
  }
  return defineChallenge({
    slug: "calculadora-simples",
    title: "Calculadora simples",
    difficulty: "medium",
    moduleId: moduleId("condicionais"),
    position: 4,
    description: md(
      "Implemente a função `calcular(a, op, b)`, uma calculadora de quatro operações. Ela recebe dois inteiros `a` e `b` e uma string `op` com o operador, e **retorna o resultado como string**.",
      "",
      "- `\"+\"`: soma; `\"-\"`: subtração; `\"*\"`: multiplicação;",
      "- `\"/\"`: divisão **inteira truncada em direção a zero**, isto é, descarte a parte fracionária: `7 / 2` dá `\"3\"` e `-7 / 2` dá `\"-3\"` (e não -4).",
      "",
      "Retorne `\"ERRO\"` em dois casos: **divisão por zero** e **operador inválido** (qualquer string que não seja exatamente um dos quatro operadores, como `\"%\"`, `\"x\"`, `\"**\"` ou a string vazia).",
      "",
      "Para converter o número em string: `String(x)` em JavaScript, `str(x)` em Python e `sprintf` em C.",
      "",
      "> **Atenção em Python:** o operador `//` arredonda para **baixo** (`-7 // 2 == -4`), não em direção a zero.",
      "",
      C_TEXTO + " Para comparar o operador, use `strcmp(op, \"+\") == 0`."
    ),
    constraints: ["-10000 <= a, b <= 10000", "op tem de 0 a 2 caracteres.", "Retorne o resultado inteiro como string, ou \"ERRO\"."],
    tags: ["Condicionais", "Strings"],
    functionSpec: {
      name: "calcular",
      params: [{ name: "a", type: "int" }, { name: "op", type: "string" }, { name: "b", type: "int" }],
      returns: "string"
    },
    publicCases: [call([7, "+", 3], "10"), call([20, "/", 6], "3")],
    hiddenCases: hidden.map(([a, op, b]) => call([a, op, b], calcular(a, op, b))),
    hints: [
      "Use uma cadeia de `if / else if` (ou `switch`) para cada operador, com um `else` final que devolve \"ERRO\".",
      "Antes de dividir, confira se `b` é zero.",
      "Truncar em direção a zero: `Math.trunc(a / b)` em JavaScript; em Python, `int(a / b)` funciona para estes limites; em C, `a / b` entre inteiros já trunca."
    ],
    editorial: md(
      "**Ideia:** escolher a operação com condicionais e tratar os dois casos de erro antes de calcular.",
      "",
      "1. Compare `op` com cada um dos quatro operadores.",
      "2. Na divisão, se `b == 0`, retorne `\"ERRO\"`; senão, divida truncando em direção a zero.",
      "3. Qualquer outro operador também é `\"ERRO\"`.",
      "",
      "```c",
      "#include <stdio.h>",
      "#include <stdlib.h>",
      "#include <string.h>",
      "",
      "char* calcular(int a, char* op, int b) {",
      "    char* texto = malloc(16);",
      "    if (strcmp(op, \"+\") == 0) sprintf(texto, \"%d\", a + b);",
      "    else if (strcmp(op, \"-\") == 0) sprintf(texto, \"%d\", a - b);",
      "    else if (strcmp(op, \"*\") == 0) sprintf(texto, \"%d\", a * b);",
      "    else if (strcmp(op, \"/\") == 0 && b != 0) sprintf(texto, \"%d\", a / b);",
      "    else strcpy(texto, \"ERRO\");",
      "    return texto;",
      "}",
      "```",
      "",
      "Armadilhas: em Python, `a // b` arredonda para baixo (erra `-7 / 2`); em C, olhar só `op[0]` aceitaria `\"**\"` como multiplicação.",
      "",
      "**Custo:** O(1)."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function faixaDeImc(): Challenge {
  const random = createRandom(100010);
  const limites = [18.5, 25, 30, 35, 40];
  const categoria = (imc: number) =>
    imc < 18.5 ? "MAGREZA" : imc < 25 ? "NORMAL" : imc < 30 ? "SOBREPESO" : imc < 35 ? "OBESIDADE I" : imc < 40 ? "OBESIDADE II" : "OBESIDADE III";
  // Casos de limite com alturas exatas em binário (2, 1.5, 1.25, 1): qualquer
  // ordem de contas (peso / (h*h) ou peso / h / h) chega ao mesmo IMC.
  const hidden: Array<[number, number]> = [
    [100, 2], [74, 2], [73.9, 2], [120, 2], [140, 2], [160, 2], [56.25, 1.5], [41.625, 1.5],
    [67.5, 1.5], [78.75, 1.5], [90, 1.5], [39.0625, 1.25], [18.5, 1], [40, 1], [159.9, 2]
  ];
  while (hidden.length < 23) {
    const peso = randomInt(random, 300, 2000) / 10;
    const altura = randomInt(random, 140, 210) / 100;
    const imc = peso / (altura * altura);
    const longeDosLimites = limites.every((limite) => Math.abs(imc - limite) > 1e-6);
    if (longeDosLimites && categoria(imc) === categoria(peso / altura / altura)) hidden.push([peso, altura]);
  }
  return defineChallenge({
    slug: "faixa-de-imc",
    title: "Faixa de IMC",
    difficulty: "medium",
    moduleId: moduleId("condicionais"),
    position: 5,
    description: md(
      "O Índice de Massa Corporal (IMC) é calculado dividindo o peso (em kg) pelo quadrado da altura (em metros):",
      "",
      "```",
      "IMC = peso / (altura × altura)",
      "```",
      "",
      "Implemente a função `classificarImc(peso, altura)`, que calcula o IMC e **retorna a categoria** de acordo com a tabela:",
      "",
      "| IMC | Categoria |",
      "| --- | --- |",
      "| menor que 18,5 | `\"MAGREZA\"` |",
      "| de 18,5 até menos de 25 | `\"NORMAL\"` |",
      "| de 25 até menos de 30 | `\"SOBREPESO\"` |",
      "| de 30 até menos de 35 | `\"OBESIDADE I\"` |",
      "| de 35 até menos de 40 | `\"OBESIDADE II\"` |",
      "| 40 ou mais | `\"OBESIDADE III\"` |",
      "",
      "**Cuidado com os limites:** um IMC de exatamente 25 já é `\"SOBREPESO\"`, e exatamente 18,5 já é `\"NORMAL\"`. Cada limite pertence à faixa de **cima**.",
      "",
      "(Esta tabela é só um exercício de condicionais, não uma orientação de saúde.)"
    ),
    constraints: ["10 <= peso <= 200 (em kg, pode ter casas decimais)", "1 <= altura <= 2.1 (em metros)", "Retorne exatamente uma das seis strings, sem acento."],
    tags: ["Condicionais", "Números reais"],
    functionSpec: {
      name: "classificarImc",
      params: [{ name: "peso", type: "double" }, { name: "altura", type: "double" }],
      returns: "string"
    },
    publicCases: [call([70, 1.75], "NORMAL"), call([95, 1.7], "OBESIDADE I")],
    hiddenCases: hidden.map(([peso, altura]) => call([peso, altura], categoria(peso / (altura * altura)))),
    hints: [
      "Calcule o IMC uma vez, guarde numa variável e depois compare com os limites.",
      "Teste as faixas em ordem crescente com `if / else if`: se chegou no segundo teste, você já sabe que o IMC não é menor que 18,5.",
      "Use `<` (menor estrito) para cada limite superior: `imc < 25` é NORMAL; exatamente 25 cai no próximo teste."
    ],
    editorial: md(
      "**Ideia:** calcular o IMC e percorrer as faixas em ordem, com `else if`.",
      "",
      "Como cada teste só é feito se os anteriores falharam, basta comparar com o limite superior de cada faixa, sempre com `<`:",
      "",
      "```js",
      "function classificarImc(peso, altura) {",
      "  const imc = peso / (altura * altura);",
      "  if (imc < 18.5) return \"MAGREZA\";",
      "  else if (imc < 25) return \"NORMAL\";",
      "  else if (imc < 30) return \"SOBREPESO\";",
      "  else if (imc < 35) return \"OBESIDADE I\";",
      "  else if (imc < 40) return \"OBESIDADE II\";",
      "  return \"OBESIDADE III\";",
      "}",
      "```",
      "",
      "O erro clássico é trocar `<` por `<=` (ou testar de cima para baixo com `>`): tudo funciona, menos os valores exatamente no limite, como 100 kg e 2 m (IMC 25).",
      "",
      "**Custo:** O(1)."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function dataValida(): Challenge {
  const random = createRandom(100011);
  const diasNoMes = (mes: number, ano: number) => [31, ehBissextoRef(ano) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  const valida = (dia: number, mes: number, ano: number) => mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasNoMes(mes, ano);
  const hidden: Array<[number, number, number]> = [
    [28, 2, 2023], [29, 2, 2000], [29, 2, 1900], [29, 2, 2023], [31, 12, 9999], [1, 1, 1], [0, 1, 2020],
    [1, 0, 2020], [1, 13, 2020], [32, 1, 2020], [31, 1, 2020], [30, 2, 2024], [31, 6, 2021], [30, 6, 2021],
    [31, 7, 2021], [31, 8, 2021], [31, 9, 2021], [31, 11, 2021], [-5, 3, 2020], [15, -3, 2020], [29, 2, 2400],
    [29, 2, 2100], [1000, 1000, 2020]
  ];
  while (hidden.length < 30) {
    const ano = random() < 0.5 ? randomInt(random, 1, 9999) : randomInt(random, 1, 2500) * 4;
    hidden.push([randomInt(random, -1, 32), randomInt(random, 0, 13), ano]);
  }
  return defineChallenge({
    slug: "data-valida",
    title: "Data válida",
    difficulty: "medium",
    moduleId: moduleId("condicionais"),
    position: 6,
    isBoss: true,
    description: md(
      "Implemente a função `dataValida(dia, mes, ano)`, que **retorna `true` se a data existir** no calendário gregoriano e `false` caso contrário.",
      "",
      "Uma data é válida quando:",
      "",
      "- o mês está entre 1 e 12;",
      "- o dia está entre 1 e a quantidade de dias daquele mês.",
      "",
      "| Dias | Meses |",
      "| --- | --- |",
      "| 31 | janeiro, março, maio, julho, agosto, outubro, dezembro |",
      "| 30 | abril, junho, setembro, novembro |",
      "| 28 ou 29 | fevereiro (29 só em ano bissexto) |",
      "",
      "Use a regra do desafio **Ano bissexto**: divisível por 4 e não por 100, ou divisível por 400. Assim, 29/02/2000 existe, mas 29/02/1900 não.",
      "",
      "Dia e mês podem vir com valores absurdos (zero, negativos ou grandes demais): nesses casos a data é inválida."
    ),
    constraints: ["-1000 <= dia, mes <= 1000", "1 <= ano <= 9999", "Retorne um booleano."],
    tags: ["Condicionais", "Operadores lógicos"],
    functionSpec: {
      name: "dataValida",
      params: [{ name: "dia", type: "int" }, { name: "mes", type: "int" }, { name: "ano", type: "int" }],
      returns: "bool"
    },
    publicCases: [call([29, 2, 2024], true), call([31, 4, 2023], false)],
    hiddenCases: hidden.map((data) => call(data, valida(...data))),
    hints: [
      "Primeiro descarte meses fora de 1 a 12; só depois descubra quantos dias o mês tem.",
      "Escreva uma função auxiliar `diasNoMes(mes, ano)` e outra `ehBissexto(ano)`: o código principal fica com uma linha.",
      "Fevereiro de 1900 tem 28 dias: divisível por 4 não basta para ser bissexto."
    ],
    editorial: md(
      "**Ideia:** validar o mês, descobrir quantos dias ele tem (tratando fevereiro) e conferir o dia.",
      "",
      "1. Se `mes < 1` ou `mes > 12`, a data é inválida.",
      "2. Calcule o máximo de dias: 31, 30 ou, em fevereiro, 29 se o ano for bissexto e 28 se não for.",
      "3. A data é válida se `1 <= dia <= maximo`.",
      "",
      "```c",
      "#include <stdbool.h>",
      "",
      "static bool ehBissexto(int ano) {",
      "    return (ano % 4 == 0 && ano % 100 != 0) || ano % 400 == 0;",
      "}",
      "",
      "bool dataValida(int dia, int mes, int ano) {",
      "    if (mes < 1 || mes > 12) return false;",
      "    int maximo = 31;",
      "    if (mes == 4 || mes == 6 || mes == 9 || mes == 11) maximo = 30;",
      "    else if (mes == 2) maximo = ehBissexto(ano) ? 29 : 28;",
      "    return dia >= 1 && dia <= maximo;",
      "}",
      "```",
      "",
      "Validar o mês **antes** evita acessar uma tabela `dias[mes - 1]` fora dos limites quando o mês é 0 ou 13.",
      "",
      "**Custo:** O(1)."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

// ======================================================================
// Módulo: lacos
// ======================================================================

function somaDe1AN(): Challenge {
  const random = createRandom(100012);
  const hidden = [0, 1, 2, 3, 100, 1000, 65535, 65536, 999999, 1000000, 46341, 12345];
  while (hidden.length < 18) hidden.push(randomInt(random, 0, 1000000));
  return defineChallenge({
    slug: "soma-de-1-a-n",
    title: "Soma de 1 a N",
    difficulty: "easy",
    moduleId: moduleId("lacos"),
    position: 0,
    description: md(
      "Implemente a função `somaAteN(n)`, que **retorna a soma de todos os inteiros de 1 até `n`**: `1 + 2 + 3 + ... + n`.",
      "",
      "Esta é a situação clássica do **acumulador**: uma variável começa em 0 e, a cada volta do laço, recebe o próximo número. Se `n` for 0, não há nada para somar e a resposta é 0.",
      "",
      "**Atenção ao tamanho do resultado:** com `n = 10^6` a soma passa de 500 bilhões, que **não cabe em `int`** (o limite é cerca de 2,1 bilhões). Em C, o retorno é `long long`: declare o acumulador também como `long long`."
    ),
    constraints: ["0 <= n <= 10^6", "O resultado cabe em um inteiro de 64 bits (long long em C)."],
    tags: ["Laços", "Acumulador"],
    functionSpec: { name: "somaAteN", params: [{ name: "n", type: "int" }], returns: "long" },
    publicCases: [call([5], 15), call([10], 55)],
    hiddenCases: hidden.map((n) => call([n], (n * (n + 1)) / 2)),
    hints: [
      "Crie `soma = 0` e um laço `for` com `i` indo de 1 até `n`, inclusive.",
      "Com `n = 0`, o laço não deve executar nenhuma vez: prefira `for`/`while`, que testam a condição antes, a `do-while`.",
      "Existe também a fórmula de Gauss, `n * (n + 1) / 2`; em C, faça a conta com `long long` para não estourar."
    ],
    editorial: md(
      "**Ideia:** somar os números um a um num acumulador.",
      "",
      "```c",
      "long long somaAteN(int n) {",
      "    long long soma = 0;  /* long long: a soma passa de 2^31 */",
      "    for (int i = 1; i <= n; i++) {",
      "        soma += i;",
      "    }",
      "    return soma;",
      "}",
      "```",
      "",
      "Com `int soma`, o programa em C estoura a partir de `n = 65536` (a soma passa de 2.147.483.647) e o juiz acusa overflow.",
      "",
      "Um `do-while` começando em 1 executa o corpo pelo menos uma vez e devolve 1 para `n = 0`.",
      "",
      "**Custo:** O(n) com o laço; O(1) com a fórmula de Gauss `n(n + 1) / 2`."
    ),
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function tabuada(): Challenge {
  const random = createRandom(100013);
  const linhas = (n: number) => Array.from({ length: 10 }, (_, index) => `${n} x ${index + 1} = ${n * (index + 1)}`);
  const hidden = [0, 1, 10, 10000, -10000, -3, 1234, -100, 9, 99, 5000];
  while (hidden.length < 16) hidden.push(randomInt(random, -10000, 10000));
  return defineChallenge({
    slug: "tabuada",
    title: "Tabuada",
    difficulty: "easy",
    moduleId: moduleId("lacos"),
    position: 1,
    description: md(
      "Implemente a função `tabuada(n)`, que **retorna um vetor de 10 strings** com a tabuada de multiplicação de `n`, de 1 a 10.",
      "",
      "Cada string tem o formato `\"n x i = resultado\"`, com um espaço de cada lado do `x` e do `=`. Para `n = 3`:",
      "",
      "```",
      "3 x 1 = 3",
      "3 x 2 = 6",
      "...",
      "3 x 10 = 30",
      "```",
      "",
      "`n` pode ser zero ou negativo; o número aparece como de costume (`-3 x 2 = -6`).",
      "",
      "Em C, a função retorna `char**` (um vetor de strings): aloque o vetor de 10 ponteiros com `malloc`, aloque cada string com espaço suficiente para a linha mais longa (`\"-10000 x 10 = -100000\"` tem 21 caracteres) e faça `*returnSize = 10`."
    ),
    constraints: ["-10000 <= n <= 10000", "Retorne exatamente 10 strings, de n x 1 até n x 10."],
    tags: ["Laços", "Strings"],
    functionSpec: { name: "tabuada", params: [{ name: "n", type: "int" }], returns: "string[]" },
    publicCases: [call([3], linhas(3)), call([7], linhas(7))],
    hiddenCases: hidden.map((n) => call([n], linhas(n))),
    hints: [
      "Use um laço com `i` de 1 até 10 e, a cada volta, monte uma linha e guarde no vetor.",
      "Em JavaScript, junte as partes com `+`: `n + \" x \" + i + \" = \" + n * i`; em Python, uma f-string resolve: `f\"{n} x {i} = {n * i}\"`.",
      "Em C, `sprintf(linha, \"%d x %d = %d\", n, i, n * i)` monta a linha; reserve pelo menos 22 bytes para cada uma."
    ],
    editorial: md(
      "**Ideia:** repetir 10 vezes a mesma montagem de texto, mudando só o multiplicador.",
      "",
      "```js",
      "function tabuada(n) {",
      "  const linhas = [];",
      "  for (let i = 1; i <= 10; i++) {",
      "    linhas.push(n + \" x \" + i + \" = \" + n * i);",
      "  }",
      "  return linhas;",
      "}",
      "```",
      "",
      "Em C, o cuidado é o tamanho de cada string: um buffer de 16 bytes serve para \"7 x 10 = 70\", mas corta \"10000 x 10 = 100000\". Calcule o pior caso (21 caracteres + o `'\\0'`).",
      "",
      "**Custo:** O(1): sempre 10 linhas."
    ),
    complexity: { time: "O(1)", space: "O(1)" }
  });
}

function contarDigitos(): Challenge {
  const random = createRandom(100014);
  const digitos = (n: number) => String(Math.abs(n)).length;
  const hidden = [0, -45, -7, 10, 9, 100, 999999999999999, 1000000000000000, -1000000000000000, 1000000, -1, 99];
  while (hidden.length < 20) {
    const tamanho = randomInt(random, 1, 15);
    const valor = randomInt(random, 10 ** (tamanho - 1), 10 ** tamanho - 1);
    hidden.push(random() < 0.4 ? -valor : valor);
  }
  return defineChallenge({
    slug: "contar-digitos",
    title: "Contar dígitos",
    difficulty: "easy",
    moduleId: moduleId("lacos"),
    position: 2,
    description: md(
      "Implemente a função `contarDigitos(n)`, que **retorna quantos dígitos** tem o inteiro `n` (em base 10).",
      "",
      "- O sinal de menos não é dígito: `-45` tem 2 dígitos.",
      "- O número `0` tem **1** dígito.",
      "",
      "Resolva com um laço: dividir um número por 10 (divisão inteira) remove o último dígito. Conte quantas divisões são necessárias até o número virar 0.",
      "",
      "Em JavaScript, use `Math.trunc(n / 10)` para a divisão inteira; em C, o parâmetro é `long long`."
    ),
    constraints: ["-10^15 <= n <= 10^15", "Retorne um inteiro de 1 a 16."],
    tags: ["Laços", "Contador"],
    functionSpec: { name: "contarDigitos", params: [{ name: "n", type: "long" }], returns: "int" },
    publicCases: [call([12345], 5), call([7], 1)],
    hiddenCases: hidden.map((n) => call([n], digitos(n))),
    hints: [
      "Cada divisão inteira por 10 \"come\" um dígito: 12345 → 1234 → 123 → 12 → 1 → 0.",
      "Um laço `while (n > 0)` nunca executa para `n = 0` nem para negativos. Trate o sinal antes (valor absoluto).",
      "Para garantir que 0 conte como 1 dígito, use `do-while`, ou trate o 0 como caso especial."
    ],
    editorial: md(
      "**Ideia:** contar quantas vezes dá para dividir por 10 até zerar, tratando o sinal e o zero.",
      "",
      "1. Troque `n` pelo seu valor absoluto.",
      "2. Conte as divisões por 10 até `n` virar 0, executando o corpo **pelo menos uma vez** (assim o 0 conta 1 dígito).",
      "",
      "```c",
      "int contarDigitos(long long n) {",
      "    if (n < 0) n = -n;",
      "    int digitos = 0;",
      "    do {",
      "        digitos++;",
      "        n /= 10;",
      "    } while (n > 0);",
      "    return digitos;",
      "}",
      "```",
      "",
      "Aqui o `do-while` é a escolha certa: ao contrário de `while (n > 0)`, ele executa uma vez mesmo quando `n` já começa em 0.",
      "",
      "**Custo:** O(d), onde d é o número de dígitos (no máximo 16)."
    ),
    complexity: { time: "O(log n)", space: "O(1)" }
  });
}

function numeroPrimo(): Challenge {
  const random = createRandom(100015);
  const ehPrimo = (n: number) => {
    if (n < 2) return false;
    if (n % 2 === 0) return n === 2;
    for (let divisor = 3; divisor * divisor <= n; divisor += 2) if (n % divisor === 0) return false;
    return true;
  };
  // Primos perto de 10^12 obrigam a parar em √n: testar todos os divisores estoura o tempo.
  const grandes: Array<[number, boolean]> = [
    [999999999989, true], [999999999961, true], [999999999959, true], [999999999937, true],
    [999966000289, false], [999962000357, false], [1000000000000, false], [1099511627776, false]
  ];
  const pequenos = [0, 1, 2, 3, 4, 9, 25, 49, 97, 999983, 1000003, 600851475143, 1000001];
  const hidden: CaseDefinition[] = [
    ...pequenos.map((n) => call([n], ehPrimo(n))),
    ...grandes.map(([n, primo]) => call([n], primo))
  ];
  while (hidden.length < 26) {
    const n = randomInt(random, 2, 1000000);
    hidden.push(call([n], ehPrimo(n)));
  }
  return defineChallenge({
    slug: "numero-primo",
    title: "Número primo",
    difficulty: "medium",
    moduleId: moduleId("lacos"),
    position: 3,
    description: md(
      "Implemente a função `ehPrimo(n)`, que **retorna `true` se `n` for primo** e `false` caso contrário.",
      "",
      "Um número é primo quando é **maior que 1** e só é divisível por 1 e por ele mesmo. Assim, 0 e 1 não são primos, 2 é o único primo par, e 9 não é primo (9 = 3 × 3).",
      "",
      "**Desempenho importa:** `n` pode chegar a 10^12 (um trilhão). Testar todos os divisores de 2 até `n - 1` levaria horas. Observe que, se `n = a × b`, um dos dois fatores é no máximo `√n`: basta testar divisores até a raiz quadrada de `n`, cerca de um milhão de testes no pior caso.",
      "",
      "Em C, o parâmetro é `long long`; use também `long long` no divisor para que `divisor * divisor` não estoure."
    ),
    constraints: ["0 <= n <= 10^12", "Retorne um booleano.", "A solução precisa terminar em bem menos de 1 segundo para n perto de 10^12."],
    tags: ["Laços", "Matemática"],
    functionSpec: { name: "ehPrimo", params: [{ name: "n", type: "long" }], returns: "bool" },
    publicCases: [call([7], true), call([12], false)],
    hiddenCases: hidden,
    hints: [
      "Trate à parte os números menores que 2 (não são primos).",
      "Não é preciso testar divisores maiores que √n: use a condição `divisor * divisor <= n` no laço (evita contas com raiz em ponto flutuante).",
      "O `<=` é importante: com `<`, quadrados perfeitos como 9 e 25 passariam por primos. Pular os pares depois do 2 deixa tudo duas vezes mais rápido."
    ],
    editorial: md(
      "**Ideia:** procurar um divisor só até √n.",
      "",
      "Se `n` tem um divisor `d > √n`, então `n / d` é um divisor menor que √n, que já teria sido encontrado. Por isso, parar em √n é suficiente.",
      "",
      "```c",
      "#include <stdbool.h>",
      "",
      "bool ehPrimo(long long n) {",
      "    if (n < 2) return false;",
      "    if (n % 2 == 0) return n == 2;",
      "    for (long long d = 3; d * d <= n; d += 2) {",
      "        if (n % d == 0) return false;",
      "    }",
      "    return true;",
      "}",
      "```",
      "",
      "Para 999.999.999.989 (um primo), o laço faz cerca de 500 mil voltas, contra quase um trilhão na versão que testa todos os divisores.",
      "",
      "**Custo:** O(√n) de tempo e O(1) de memória."
    ),
    complexity: { time: "O(√n)", space: "O(1)" }
  });
}

function passosDeCollatz(): Challenge {
  const random = createRandom(100016);
  const passos = (inicio: number) => {
    let n = inicio;
    let contagem = 0;
    while (n !== 1) {
      n = n % 2 === 0 ? n / 2 : 3 * n + 1;
      contagem += 1;
    }
    return contagem;
  };
  const hidden = [1, 2, 3, 7, 97, 871, 113383, 837799, 1000000, 626331, 999999, 4, 16, 77031];
  while (hidden.length < 20) hidden.push(randomInt(random, 1, 1000000));
  return defineChallenge({
    slug: "passos-de-collatz",
    title: "Passos de Collatz",
    difficulty: "medium",
    moduleId: moduleId("lacos"),
    position: 4,
    description: md(
      "A **conjectura de Collatz** diz que, começando de qualquer inteiro positivo e repetindo a regra abaixo, sempre se chega a 1:",
      "",
      "- se o número é **par**, divida por 2;",
      "- se é **ímpar**, multiplique por 3 e some 1.",
      "",
      "Implemente a função `passosCollatz(n)`, que **retorna quantos passos** são necessários para chegar a 1 partindo de `n`. Partindo de 6: 6 → 3 → 10 → 5 → 16 → 8 → 4 → 2 → 1, ou seja, **8 passos**. Se `n` já é 1, a resposta é 0.",
      "",
      "Você não sabe de antemão quantas repetições serão necessárias: este é um caso típico de `while` com uma **condição de parada**.",
      "",
      "**Atenção em C:** mesmo com `n` até 10^6, os valores intermediários podem passar de 2^31 (partindo de 113383 a sequência chega a mais de 2 bilhões). Copie `n` para uma variável `long long` antes de começar."
    ),
    constraints: ["1 <= n <= 10^6", "Os valores intermediários cabem em 64 bits.", "Retorne o número de passos (0 se n = 1)."],
    tags: ["Laços", "Condição de parada"],
    functionSpec: { name: "passosCollatz", params: [{ name: "n", type: "int" }], returns: "int" },
    publicCases: [call([6], 8), call([27], 111)],
    hiddenCases: hidden.map((n) => call([n], passos(n))),
    hints: [
      "Use `while (x != 1)` e um contador que aumenta a cada volta.",
      "Teste a condição **antes** do primeiro passo: com `n = 1`, o laço não deve rodar nenhuma vez.",
      "Em C, `long long x = n;` evita o overflow de `3 * x + 1`."
    ],
    editorial: md(
      "**Ideia:** simular a regra enquanto o número for diferente de 1, contando os passos.",
      "",
      "```c",
      "int passosCollatz(int n) {",
      "    long long x = n;  /* os valores intermediários passam de 2^31 */",
      "    int passos = 0;",
      "    while (x != 1) {",
      "        if (x % 2 == 0) x = x / 2;",
      "        else x = 3 * x + 1;",
      "        passos++;",
      "    }",
      "    return passos;",
      "}",
      "```",
      "",
      "Dois erros comuns: usar `do-while` (para `n = 1` ele dá 1 → 4 → 2 → 1 e conta 3 passos) e usar `int` em C (a conta `3 * x + 1` estoura).",
      "",
      "**Custo:** O(p), onde p é o número de passos (no máximo 524 para n ≤ 10^6)."
    ),
    complexity: { time: "O(p)", space: "O(1)" }
  });
}

function mdcEMmc(): Challenge {
  const random = createRandom(100017);
  const mdc = (a: number, b: number): number => (b === 0 ? a : mdc(b, a % b));
  const resposta = (a: number, b: number) => {
    const d = mdc(a, b);
    return [d, (a / d) * b];
  };
  const hidden: Array<[number, number]> = [
    [1, 1], [1, 40000], [40000, 40000], [21, 6], [100, 75], [17, 34], [32768, 40000], [40000, 1],
    [39999, 40000], [39989, 39983], [40000, 39999], [39971, 39979], [2, 3], [36000, 24000]
  ];
  while (hidden.length < 20) hidden.push([randomInt(random, 1, 40000), randomInt(random, 1, 40000)]);
  return defineChallenge({
    slug: "mdc-e-mmc",
    title: "MDC e MMC",
    difficulty: "medium",
    moduleId: moduleId("lacos"),
    position: 5,
    isBoss: true,
    description: md(
      "Implemente a função `mdcEMmc(a, b)`, que **retorna um vetor `[mdc, mmc]`** com o máximo divisor comum e o mínimo múltiplo comum de dois inteiros positivos.",
      "",
      "- O **MDC** é o maior número que divide `a` e `b` ao mesmo tempo. MDC(12, 18) = 6.",
      "- O **MMC** é o menor número positivo que é múltiplo de `a` e de `b`. MMC(12, 18) = 36.",
      "",
      "Use o **algoritmo de Euclides** para o MDC: enquanto `b` for diferente de 0, troque o par `(a, b)` por `(b, a % b)`; quando `b` zerar, `a` é o MDC. Exemplo: (12, 18) → (18, 12) → (12, 6) → (6, 0), então MDC = 6.",
      "",
      "Depois, o MMC sai da relação `mdc × mmc = a × b`.",
      "",
      "**Desempenho e overflow:** o MMC pode chegar a 1,6 bilhão. Procurar o MMC testando os números um a um fica lento demais, e em C a conta `a * b` pode passar do limite de `int`. Calcule `a / mdc * b` (primeiro divide, depois multiplica): o resultado cabe em `int`.",
      "",
      C_VETOR
    ),
    constraints: ["1 <= a, b <= 40000", "O MMC cabe em int (é no máximo 1.599.960.000).", "Retorne [mdc, mmc]."],
    tags: ["Laços", "Matemática"],
    functionSpec: {
      name: "mdcEMmc",
      params: [{ name: "a", type: "int" }, { name: "b", type: "int" }],
      returns: "int[]"
    },
    publicCases: [call([12, 18], [6, 36]), call([7, 5], [1, 35])],
    hiddenCases: hidden.map(([a, b]) => call([a, b], resposta(a, b))),
    hints: [
      "O laço de Euclides: `while (b != 0) { resto = a % b; a = b; b = resto; }`. Guarde cópias de `a` e `b` antes, porque você vai precisar delas para o MMC.",
      "Com o MDC em mãos, MMC = a × b / MDC. Não é preciso procurar o MMC com outro laço.",
      "Faça a divisão antes da multiplicação (`a / mdc * b`) para não estourar `int` em C."
    ],
    editorial: md(
      "**Ideia:** MDC com o algoritmo de Euclides e MMC pela relação `mdc × mmc = a × b`.",
      "",
      "Euclides funciona porque todo divisor comum de `a` e `b` também divide `a % b`. A cada volta os números diminuem muito rápido.",
      "",
      "```c",
      "#include <stdlib.h>",
      "",
      "int* mdcEMmc(int a, int b, int* returnSize) {",
      "    int x = a, y = b;",
      "    while (y != 0) {",
      "        int resto = x % y;",
      "        x = y;",
      "        y = resto;",
      "    }",
      "    int* resposta = malloc(2 * sizeof(int));",
      "    resposta[0] = x;",
      "    resposta[1] = a / x * b;  /* divide antes para não estourar int */",
      "    *returnSize = 2;",
      "    return resposta;",
      "}",
      "```",
      "",
      "Procurar o MMC somando 1 a partir de `max(a, b)` até achar um múltiplo comum faz até 1,6 bilhão de voltas e estoura o tempo.",
      "",
      "**Custo:** O(log(min(a, b))) para Euclides; O(1) de memória."
    ),
    complexity: { time: "O(log min(a, b))", space: "O(1)" }
  });
}

// ======================================================================
// Módulo: funcoes
// ======================================================================

function inverterDigitos(): Challenge {
  const random = createRandom(100018);
  const inverter = (n: number) => Number(String(n).split("").reverse().join(""));
  const hidden = [1020, 7, 10, 100, 1000000000, 999999999, 120034, 900000009, 101, 0, 1, 50, 123456789];
  while (hidden.length < 18) hidden.push(randomInt(random, 0, 1000000000));
  return defineChallenge({
    slug: "inverter-digitos",
    title: "Inverter dígitos",
    difficulty: "easy",
    moduleId: moduleId("funcoes"),
    position: 0,
    description: md(
      "Implemente a função `inverterDigitos(n)`, que recebe um inteiro não negativo e **retorna o número formado pelos seus dígitos em ordem inversa**.",
      "",
      "Por exemplo, `123` vira `321`. Zeros que ficariam à esquerda desaparecem, porque o retorno é um **número**: `4500` vira `54` e `1020` vira `201` (o zero do meio fica).",
      "",
      "Tente resolver só com aritmética: `n % 10` dá o último dígito e `n / 10` (divisão inteira) o remove. Ao mesmo tempo, monte o resultado com `resultado = resultado * 10 + digito`.",
      "",
      "Esta função vai ser útil de novo no desafio **Palíndromo numérico**."
    ),
    constraints: ["0 <= n <= 10^9", "O resultado sempre cabe em int."],
    tags: ["Funções", "Laços"],
    functionSpec: { name: "inverterDigitos", params: [{ name: "n", type: "int" }], returns: "int" },
    publicCases: [call([123], 321), call([4500], 54)],
    hiddenCases: hidden.map((n) => call([n], inverter(n))),
    hints: [
      "Tire os dígitos um a um pelo final: `digito = n % 10` e depois `n = n / 10` (inteira).",
      "Cada dígito tirado entra no fim do resultado: `resultado = resultado * 10 + digito`.",
      "Não remova os zeros \"na mão\": a conta acima já faz os zeros da esquerda sumirem e mantém os do meio."
    ],
    editorial: md(
      "**Ideia:** desmontar `n` pelo último dígito e montar o resultado pelo primeiro.",
      "",
      "Para 1020: tira 0 (resultado 0), tira 2 (resultado 2), tira 0 (resultado 20), tira 1 (resultado 201).",
      "",
      "```python",
      "def inverterDigitos(n):",
      "    resultado = 0",
      "    while n > 0:",
      "        resultado = resultado * 10 + n % 10",
      "        n //= 10",
      "    return resultado",
      "```",
      "",
      "Converter para texto e inverter também funciona. Mas cuidado com atalhos como apagar todos os `\"0\"` do texto para sumir com os da esquerda: 1020 viraria 21.",
      "",
      "**Custo:** O(d), com d = número de dígitos."
    ),
    complexity: { time: "O(log n)", space: "O(1)" }
  });
}

function raizDigital(): Challenge {
  const random = createRandom(100019);
  const raiz = (inicio: number) => {
    let n = inicio;
    while (n >= 10) n = String(n).split("").reduce((soma, digito) => soma + Number(digito), 0);
    return n;
  };
  const hidden = [0, 9, 10, 18, 999999999999999, 1000000000000000, 19, 38, 5, 99999, 123456789];
  while (hidden.length < 18) hidden.push(randomInt(random, 0, 1000000000000000));
  return defineChallenge({
    slug: "raiz-digital",
    title: "Raiz digital",
    difficulty: "easy",
    moduleId: moduleId("funcoes"),
    position: 1,
    description: md(
      "A **raiz digital** de um número é obtida somando seus dígitos e repetindo o processo com o resultado **até restar um único dígito**.",
      "",
      "Exemplo com 132189: 1 + 3 + 2 + 1 + 8 + 9 = 24; depois 2 + 4 = 6. A raiz digital é **6**.",
      "",
      "Implemente a função `raizDigital(n)`. Organize o código com uma **função auxiliar** `somaDosDigitos(x)`, que devolve a soma dos dígitos de `x`, e use-a num laço: enquanto o número tiver mais de um dígito, troque-o pela soma dos seus dígitos.",
      "",
      "A raiz digital de um número de um dígito (inclusive 0) é ele mesmo. Em C, o parâmetro é `long long`."
    ),
    constraints: ["0 <= n <= 10^15", "Retorne um inteiro de 0 a 9."],
    tags: ["Funções", "Laços"],
    functionSpec: { name: "raizDigital", params: [{ name: "n", type: "long" }], returns: "int" },
    publicCases: [call([16], 7), call([132189], 6)],
    hiddenCases: hidden.map((n) => call([n], raiz(n))),
    hints: [
      "Escreva primeiro `somaDosDigitos(x)`: some `x % 10` enquanto divide `x` por 10.",
      "Na função principal: `while (n >= 10) n = somaDosDigitos(n);`.",
      "Se usar a fórmula `1 + (n - 1) % 9`, confira o que ela devolve para n = 0 na sua linguagem."
    ],
    editorial: md(
      "**Ideia:** uma função auxiliar faz a soma dos dígitos; a principal repete essa soma até sobrar um dígito.",
      "",
      "```js",
      "function somaDosDigitos(x) {",
      "  let soma = 0;",
      "  while (x > 0) {",
      "    soma += x % 10;",
      "    x = Math.floor(x / 10);",
      "  }",
      "  return soma;",
      "}",
      "",
      "function raizDigital(n) {",
      "  while (n >= 10) n = somaDosDigitos(n);",
      "  return n;",
      "}",
      "```",
      "",
      "Separar em duas funções deixa cada uma simples de entender e de testar. Há também uma fórmula (a raiz digital de n > 0 é `1 + (n - 1) % 9`), mas ela exige tratar o 0 à parte: em Python, `(0 - 1) % 9` vale 8 e a fórmula devolve 9.",
      "",
      "**Custo:** O(d) na primeira soma (d ≤ 16 dígitos); as seguintes são desprezíveis."
    ),
    complexity: { time: "O(log n)", space: "O(1)" }
  });
}

function palindromoNumerico(): Challenge {
  const random = createRandom(100020);
  const palindromo = (n: number) => n >= 0 && String(n) === String(n).split("").reverse().join("");
  const hidden = [
    -121, 0, 7, 10, 11, 1001, 1000021, 123454321, 999999999999999, 100000000000001, 1000000000000000, -1, 12321,
    123321, 1221, 1231, -1000000000000000
  ];
  while (hidden.length < 24) {
    const metade = String(randomInt(random, 1, 9999999));
    const espelho = metade.split("").reverse().join("");
    const valor = Number(random() < 0.5 ? metade + espelho : metade + espelho.slice(1));
    hidden.push(random() < 0.5 ? valor : valor + randomInt(random, 1, 9));
  }
  return defineChallenge({
    slug: "palindromo-numerico",
    title: "Palíndromo numérico",
    difficulty: "easy",
    moduleId: moduleId("funcoes"),
    position: 2,
    description: md(
      "Um número é **palíndromo** quando fica igual lido da esquerda para a direita e da direita para a esquerda, como 121 ou 4554.",
      "",
      "Implemente a função `ehPalindromo(n)`, que **retorna `true` se `n` for palíndromo** e `false` caso contrário.",
      "",
      "- **Números negativos não são palíndromos**: `-121` lido ao contrário é `121-`.",
      "- Todo número de um dígito (inclusive 0) é palíndromo.",
      "",
      "Reaproveite a ideia do desafio **Inverter dígitos**: escreva uma função auxiliar que inverte os dígitos e compare o resultado com o número original. Em C, o parâmetro é `long long`."
    ),
    constraints: ["-10^15 <= n <= 10^15", "Retorne um booleano."],
    tags: ["Funções", "Laços"],
    functionSpec: { name: "ehPalindromo", params: [{ name: "n", type: "long" }], returns: "bool" },
    publicCases: [call([121], true), call([123], false)],
    hiddenCases: hidden.map((n) => call([n], palindromo(n))),
    hints: [
      "Crie `inverter(x)`, que devolve os dígitos de `x` ao contrário (como no desafio anterior).",
      "`n` é palíndromo se `inverter(n) == n`.",
      "Antes de tudo, se `n < 0`, retorne falso: o sinal só aparece de um lado."
    ],
    editorial: md(
      "**Ideia:** um número é palíndromo se for igual ao seu inverso; negativos nunca são.",
      "",
      "```c",
      "#include <stdbool.h>",
      "",
      "static long long inverter(long long x) {",
      "    long long resultado = 0;",
      "    while (x > 0) {",
      "        resultado = resultado * 10 + x % 10;",
      "        x /= 10;",
      "    }",
      "    return resultado;",
      "}",
      "",
      "bool ehPalindromo(long long n) {",
      "    if (n < 0) return false;",
      "    return inverter(n) == n;",
      "}",
      "```",
      "",
      "Usar o valor absoluto parece inofensivo, mas faz `-121` virar palíndromo. Números terminados em 0 (como 10) nunca são palíndromos, e a comparação já cuida disso: o inverso de 10 é 1.",
      "",
      "**Custo:** O(d), com d = número de dígitos."
    ),
    complexity: { time: "O(log n)", space: "O(1)" }
  });
}

function decimalParaBinario(): Challenge {
  const random = createRandom(100021);
  const binario = (n: number) => n.toString(2);
  const hidden = [0, 1, 2, 3, 255, 256, 1023, 1024, 1000000000000000, 562949953421312, 1125899906842623, 7, 8, 65535];
  while (hidden.length < 20) hidden.push(random() < 0.5 ? randomInt(random, 0, 100000) : randomInt(random, 0, 1000000000000000));
  const PROIBIDO_JS = {
    kind: "forbid" as const,
    pattern: "\\.toString\\s*\\(\\s*[^)\\s]",
    message: "Converta com divisões sucessivas por 2: toString com base (como toString(2)) não é permitido."
  };
  const PROIBIDO_PY = {
    kind: "forbid" as const,
    pattern: "\\bbin\\s*\\(|\\bformat\\s*\\(|\\b(?:[fF][rR]?|[rR][fF])[\"']",
    message: "Converta com divisões sucessivas por 2: bin(), format() e f-strings não são permitidos neste desafio."
  };
  const PROIBIDO_C = {
    kind: "forbid" as const,
    pattern: "\\b_?itoa\\s*\\(|\\b(?:s|sn|as)printf\\s*\\(",
    message: "Converta com divisões sucessivas por 2: itoa e sprintf não são permitidos neste desafio."
  };
  return defineChallenge({
    slug: "decimal-para-binario",
    title: "Decimal para binário",
    difficulty: "medium",
    moduleId: moduleId("funcoes"),
    position: 3,
    description: md(
      "Implemente a função `paraBinario(n)`, que recebe um inteiro não negativo e **retorna uma string com sua representação em base 2** (binário), sem zeros à esquerda.",
      "",
      "O método das **divisões sucessivas**: divida o número por 2 e anote o resto (0 ou 1); repita com o quociente até ele chegar a 0. Os restos, **lidos de trás para frente**, formam o número em binário.",
      "",
      "```",
      "10 / 2 = 5, resto 0",
      " 5 / 2 = 2, resto 1",
      " 2 / 2 = 1, resto 0",
      " 1 / 2 = 0, resto 1   →  lendo de baixo para cima: \"1010\"",
      "```",
      "",
      "Caso especial: `paraBinario(0)` é `\"0\"`.",
      "",
      "**Regra do desafio:** o objetivo é implementar a conversão. Por isso, atalhos prontos são recusados pelo juiz: `toString(2)` em JavaScript; `bin()`, `format()` e f-strings em Python; `itoa` e `sprintf` em C.",
      "",
      C_TEXTO + " Um número até 10^15 tem no máximo 50 dígitos binários. O parâmetro é `long long`."
    ),
    constraints: ["0 <= n <= 10^15", "Retorne a string binária sem zeros à esquerda (\"0\" para n = 0).", "Sem funções prontas de conversão de base."],
    tags: ["Funções", "Laços", "Strings"],
    functionSpec: { name: "paraBinario", params: [{ name: "n", type: "long" }], returns: "string" },
    languages: [language("javascript", [PROIBIDO_JS]), language("python", [PROIBIDO_PY]), language("c", [PROIBIDO_C])],
    publicCases: [call([5], "101"), call([10], "1010")],
    hiddenCases: hidden.map((n) => call([n], binario(n))),
    hints: [
      "Cada resto `n % 2` é um bit, começando pelo **último** (o menos significativo). Depois divida `n` por 2 (divisão inteira).",
      "Como os bits saem de trás para frente, coloque cada novo bit **na frente** da string (ou junte tudo e inverta no final).",
      "Com `while (n > 0)`, o 0 não gera nenhum bit: trate `n == 0` antes, devolvendo \"0\"."
    ],
    editorial: md(
      "**Ideia:** divisões sucessivas por 2, guardando os restos e invertendo a ordem.",
      "",
      "```js",
      "function paraBinario(n) {",
      "  if (n === 0) return \"0\";",
      "  let bits = \"\";",
      "  while (n > 0) {",
      "    bits = (n % 2) + bits;  // o bit novo entra na frente",
      "    n = Math.floor(n / 2);",
      "  }",
      "  return bits;",
      "}",
      "```",
      "",
      "Em C, preencha um vetor de `char` de trás para frente (a partir do fim, colocando o `'\\0'` primeiro) e devolva o ponteiro para o primeiro bit escrito; ou preencha na ordem dos restos e inverta a string no final.",
      "",
      "**Custo:** O(log n): o número é dividido por 2 a cada volta (no máximo 50 voltas)."
    ),
    complexity: { time: "O(log n)", space: "O(log n)" }
  });
}

function numerosDeArmstrong(): Challenge {
  const random = createRandom(100022);
  const ARMSTRONG = [1, 2, 3, 4, 5, 6, 7, 8, 9, 153, 370, 371, 407, 1634, 8208, 9474, 54748, 92727, 93084, 548834];
  const intervalo = (a: number, b: number) => ARMSTRONG.filter((n) => n >= a && n <= b);
  const hidden: Array<[number, number]> = [
    [1, 9], [1, 10], [10, 100], [1, 1000000], [1000, 10000], [548834, 548834], [548835, 1000000], [9474, 54748],
    [500000, 600000], [1, 1], [10, 10], [400000, 1000000], [1, 999999], [92727, 93084], [370, 371]
  ];
  while (hidden.length < 20) {
    const a = randomInt(random, 1, 100000);
    hidden.push([a, Math.min(1000000, a + randomInt(random, 0, 100000))]);
  }
  return defineChallenge({
    slug: "numeros-de-armstrong",
    title: "Números de Armstrong",
    difficulty: "medium",
    moduleId: moduleId("funcoes"),
    position: 4,
    isBoss: true,
    description: md(
      "Um **número de Armstrong** é igual à soma dos seus dígitos, cada um elevado ao **número de dígitos** do número.",
      "",
      "- 153 tem 3 dígitos: 1³ + 5³ + 3³ = 1 + 125 + 27 = **153**. É de Armstrong.",
      "- 1634 tem 4 dígitos: 1⁴ + 6⁴ + 3⁴ + 4⁴ = 1 + 1296 + 81 + 256 = **1634**. Também é.",
      "- Todo número de 1 a 9 é de Armstrong (7¹ = 7).",
      "",
      "Implemente a função `numerosDeArmstrong(a, b)`, que **retorna um vetor com todos os números de Armstrong entre `a` e `b`** (inclusive), em ordem crescente. Se não houver nenhum, retorne um vetor vazio.",
      "",
      "Este é o desafio final do módulo de funções: divida o problema em **funções auxiliares** pequenas, cada uma com uma responsabilidade:",
      "",
      "1. `contarDigitos(x)`: quantos dígitos `x` tem;",
      "2. `potencia(base, expoente)`: a potência calculada com um laço de multiplicações, só com inteiros;",
      "3. `ehArmstrong(x)`: usa as duas anteriores para decidir se `x` é de Armstrong;",
      "4. `numerosDeArmstrong(a, b)`: percorre o intervalo e junta os que passam no teste.",
      "",
      "O intervalo pode ter até um milhão de números, então cada teste precisa ser rápido.",
      "",
      C_VETOR + " Há no máximo 20 números de Armstrong no intervalo permitido."
    ),
    constraints: ["1 <= a <= b <= 10^6", "Retorne os números em ordem crescente (vetor vazio se não houver)."],
    tags: ["Funções", "Laços"],
    functionSpec: {
      name: "numerosDeArmstrong",
      params: [{ name: "a", type: "int" }, { name: "b", type: "int" }],
      returns: "int[]"
    },
    timeLimitMs: 3000,
    publicCases: [call([100, 999], intervalo(100, 999)), call([150, 160], intervalo(150, 160))],
    hiddenCases: hidden.map(([a, b]) => call([a, b], intervalo(a, b))),
    hints: [
      "O expoente não é sempre 3: é a quantidade de dígitos do número testado (153 usa cubos, 1634 usa quarta potência, 7 usa expoente 1).",
      "Para somar as potências, tire os dígitos com `% 10` e `/ 10`, chamando `potencia(digito, k)` para cada um.",
      "Para ganhar tempo (principalmente em Python), calcule as potências dos dígitos 0 a 9 uma vez para cada quantidade de dígitos e guarde num vetor. Em C, evite `pow()`: ela trabalha com `double`."
    ],
    editorial: md(
      "**Ideia:** testar cada número do intervalo com uma função `ehArmstrong`, montada a partir de funções auxiliares.",
      "",
      "```c",
      "#include <stdbool.h>",
      "#include <stdlib.h>",
      "",
      "static int contarDigitos(int x) {",
      "    int k = 0;",
      "    do { k++; x /= 10; } while (x > 0);",
      "    return k;",
      "}",
      "",
      "static int potencia(int base, int expoente) {",
      "    int resultado = 1;",
      "    for (int i = 0; i < expoente; i++) resultado *= base;",
      "    return resultado;",
      "}",
      "",
      "static bool ehArmstrong(int x) {",
      "    int k = contarDigitos(x), soma = 0;",
      "    for (int resto = x; resto > 0; resto /= 10) soma += potencia(resto % 10, k);",
      "    return soma == x;",
      "}",
      "",
      "int* numerosDeArmstrong(int a, int b, int* returnSize) {",
      "    int* resposta = malloc(20 * sizeof(int));",
      "    *returnSize = 0;",
      "    for (int x = a; x <= b; x++) {",
      "        if (ehArmstrong(x)) resposta[(*returnSize)++] = x;",
      "    }",
      "    return resposta;",
      "}",
      "```",
      "",
      "Um erro comum é elevar sempre ao cubo (a definição mais conhecida, de 153): funciona para números de 3 dígitos e erra todo o resto.",
      "",
      "**Custo:** O((b − a) · d²) com a potência em laço, ou O((b − a) · d) guardando as potências dos dígitos, onde d ≤ 7 é o número de dígitos."
    ),
    complexity: { time: "O((b - a) · d)", space: "O(1)" }
  });
}

export function buildFundamentosControleChallenges(): Challenge[] {
  return [
    saudacao(),
    mediaDeTresNotas(),
    celsiusParaFahrenheit(),
    divisaoInteiraEResto(),
    segundosParaRelogio(),
    trocoEmCedulas(),
    anoBissexto(),
    classificarTriangulo(),
    calculadoraSimples(),
    faixaDeImc(),
    dataValida(),
    somaDe1AN(),
    tabuada(),
    contarDigitos(),
    numeroPrimo(),
    passosDeCollatz(),
    mdcEMmc(),
    inverterDigitos(),
    raizDigital(),
    palindromoNumerico(),
    decimalParaBinario(),
    numerosDeArmstrong()
  ];
}
