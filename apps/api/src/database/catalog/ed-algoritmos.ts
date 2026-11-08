import type { Challenge, SourceRule } from "../../domain/types.js";
import { call, createRandom, defineChallenge, gen, language, pick, randomArray, randomInt, rules, shuffle } from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Estrutura de Dados", parte algorítmica: recursividade, complexidade,
 * busca e ordenação. Modo função em JavaScript, Python e C. Os casos grandes
 * usam argumentos gerados (`gen`) para derrubar as soluções ingênuas.
 * Sementes na faixa 300000–399999.
 */

// ---------- Regras ----------
/**
 * Recursão em Python: o detector genérico procura funções no estilo C
 * (`nome(...) {`), então em Python exigimos um `def nome(...)` cujo nome
 * volte a ser chamado depois da definição.
 */
const PY_RECURSION: SourceRule = {
  kind: "require",
  pattern: "\\bdef\\s+(\\w+)\\s*\\([^)]*\\)[^:]*:[\\s\\S]*?\\b\\1\\s*\\(",
  message: "Resolva com uma função recursiva (uma função que chama a si mesma)."
};
const NO_REVERSE: SourceRule = {
  kind: "forbid",
  pattern: "\\.reverse\\s*\\(|\\breversed\\s*\\(|\\[\\s*:\\s*:\\s*-\\s*1\\s*\\]",
  message: "Não use funções prontas de inverter (reverse, reversed ou [::-1]): compare as pontas com recursão."
};
const NO_POW: SourceRule = {
  kind: "forbid",
  pattern: "\\b(pow|powl|powf|modPow)\\s*\\(",
  message: "Não use pow pronto: implemente a exponenciação com a sua própria função recursiva."
};
const NO_SQRT: SourceRule = {
  kind: "forbid",
  pattern: "\\b(sqrt|sqrtl|sqrtf|isqrt|cbrt|hypot|pow|powl|powf)\\s*\\(|\\*\\*\\s*\\(?\\s*(0?\\.5|1\\s*/\\s*2)",
  message: "Calcule a raiz com busca binária: sqrt, isqrt, pow e potências fracionárias (** 0.5) não são permitidos."
};

const recursiveNoLoops = (extra: SourceRule[] = [], cDepth?: number) => [
  language("javascript", [rules.recursion(), rules.noLoops, ...extra]),
  language("python", [PY_RECURSION, rules.noLoops, ...extra]),
  language("c", [rules.recursion(cDepth), rules.noLoops, ...extra])
];
const everyLanguage = (sourceRules: SourceRule[]) => [
  language("javascript", sourceRules),
  language("python", sourceRules),
  language("c", sourceRules)
];

const MOD = 1000000007;

// =====================================================================
// Recursividade
// =====================================================================

function potenciaRecursiva(): Challenge {
  const M = 1000003;
  const modPow = (base: number, exp: number) => {
    let result = 1 % M;
    let b = base % M;
    let e = exp;
    while (e > 0) {
      if (e % 2 === 1) result = (result * b) % M;
      b = (b * b) % M;
      e = Math.floor(e / 2);
    }
    return result;
  };
  const random = createRandom(300101);
  const hidden: Array<[number, number]> = [
    [0, 0], [7, 1], [1, 1000000000], [2, 1000000000], [0, 5], [1000003, 5], [2000006, 0],
    [10, 6], [10, 7], [1000002, 2], [1000002, 999999999], [999999999, 999999999], [3, 1000002]
  ];
  while (hidden.length < 18) hidden.push([randomInt(random, 0, 1000000000), randomInt(random, 0, 1000000000)]);
  while (hidden.length < 20) hidden.push([randomInt(random, 2, 50), randomInt(random, 0, 40)]);
  return defineChallenge({
    slug: "potencia-recursiva",
    title: "Potência recursiva rápida",
    difficulty: "medium",
    moduleId: moduleId("recursividade"),
    position: 3,
    description: `Implemente a função \`potencia(base, expoente)\`, que retorna **base elevado a expoente, módulo 1000003**, ou seja, o resto da divisão de base^expoente por 1000003.

O expoente pode chegar a 10^9, então multiplicar a base expoente vezes (ou fazer uma recursão que diminui o expoente de 1 em 1) é lento demais e estoura a pilha de chamadas. Use a **exponenciação rápida**, definida recursivamente:

- base^0 = 1;
- se o expoente é par, base^e = (base^(e/2))²;
- se o expoente é ímpar, base^e = base · base^(e−1).

Assim o expoente cai pela metade a cada duas chamadas, e a profundidade da recursão fica em torno de 2·log₂(expoente).

Regras: a solução precisa ser **recursiva** e **sem laços** (\`for\`, \`while\`); \`pow\` pronto não é permitido. Por convenção, 0^0 = 1.

Tire o módulo depois de cada multiplicação: como 1000003 é pequeno, o produto de dois restos fica abaixo de 10^12 e cabe com folga num \`long long\` em C e num \`number\` em JavaScript.`,
    constraints: [
      "0 <= base <= 10^9",
      "0 <= expoente <= 10^9",
      "Retorne base^expoente mod 1000003.",
      "Obrigatório: função recursiva, sem for/while e sem pow."
    ],
    tags: ["Recursão", "Divisão e conquista"],
    functionSpec: {
      name: "potencia",
      params: [{ name: "base", type: "int" }, { name: "expoente", type: "int" }],
      returns: "int"
    },
    languages: recursiveNoLoops([NO_POW], 20),
    publicCases: [call([2, 10], 1024), call([5, 3], 125)],
    hiddenCases: hidden.map(([b, e]) => call([b, e], modPow(b, e))),
    hints: [
      "Se você já souber quanto vale base^(e/2), quantas multiplicações faltam para chegar a base^e?",
      "Calcule a metade uma única vez, guarde numa variável e multiplique por ela mesma; chamar a função duas vezes desfaz o ganho.",
      "Reduza a base com % 1000003 logo no começo e depois de cada produto. Em C, faça as contas em long long."
    ],
    editorial: `**Ideia.** base^e = (base^(e/2))² quando e é par, e base · base^(e−1) quando é ímpar. Cada chamada par corta o expoente pela metade.

1. Caso base: expoente 0 devolve 1.
2. Calcule \`metade = potencia(base, e / 2)\` **uma vez**.
3. Eleve ao quadrado (mod M) e, se e for ímpar, multiplique mais uma vez pela base.

\`\`\`c
#define M 1000003

int potencia(int base, int expoente) {
    if (expoente == 0) return 1;
    long long metade = potencia(base, expoente / 2);
    long long resultado = metade * metade % M;
    if (expoente % 2 == 1) resultado = resultado * (base % M) % M;
    return (int)resultado;
}
\`\`\`

**Custo.** O expoente cai pela metade a cada nível: O(log e) chamadas, cerca de 30 para e = 10^9. A versão ingênua, \`base * potencia(base, e - 1)\`, faria 10^9 chamadas e estouraria a pilha.`,
    complexity: { time: "O(log e)", space: "O(log e) de pilha" }
  });
}

function palindromoRecursivo(): Challenge {
  const isPalindrome = (text: string) => {
    const letters = text.replace(/ /g, "").toLowerCase();
    return letters === [...letters].reverse().join("");
  };
  const random = createRandom(300201);
  const randomCase = (letters: string) =>
    [...letters].map((char) => (random() < 0.3 ? char.toUpperCase() : char)).join("");
  const withSpaces = (letters: string) => {
    let text = "";
    for (const char of letters) {
      if (random() < 0.15) text += " ".repeat(randomInt(random, 1, 3));
      text += char;
    }
    return text;
  };
  const palindrome = (half: number, odd: boolean, alphabet = "abcdefghijklmnopqrstuvwxyz") => {
    let left = "";
    for (let index = 0; index < half; index += 1) left += alphabet[randomInt(random, 0, alphabet.length - 1)];
    const middle = odd ? alphabet[randomInt(random, 0, alphabet.length - 1)] : "";
    return left + middle + [...left].reverse().join("");
  };
  const breakMiddle = (text: string) => {
    const index = Math.floor(text.length / 2) - 1;
    const replacement = text[index] === "z" ? "y" : "z";
    return text.slice(0, index) + replacement + text.slice(index + 1);
  };
  const hidden = [
    "", " ", "a", "ab", "aa", "Aa", "aB", "  a  ", "abca", "Oso",
    "A man a plan a canal Panama",
    "Socorram me subi no onibus em Marrocos",
    "Roma me tem amor",
    "Nem todo palindromo e simples",
    randomCase(withSpaces(palindrome(700, true))),
    randomCase(withSpaces(palindrome(650, false))),
    randomCase(withSpaces(breakMiddle(palindrome(650, false)))),
    randomCase(withSpaces(palindrome(700, true, "ab"))),
    randomCase(palindrome(999, false)),
    "x" + " ".repeat(1998) + "X"
  ];
  if (hidden.some((text) => text.length > 2000)) throw new Error("palindromo-recursivo: texto maior que 2000.");
  return defineChallenge({
    slug: "palindromo-recursivo",
    title: "Palíndromo recursivo",
    difficulty: "medium",
    moduleId: moduleId("recursividade"),
    position: 4,
    description: `Implemente a função \`ehPalindromo(texto)\`, que retorna \`true\` se o texto for um **palíndromo** (lê-se igual da esquerda para a direita e da direita para a esquerda) e \`false\` caso contrário.

Para a comparação:

- **ignore os espaços**;
- **ignore a diferença entre maiúsculas e minúsculas** (\`"A"\` e \`"a"\` são a mesma letra).

O texto tem só letras sem acento (\`A\`–\`Z\`, \`a\`–\`z\`) e espaços. Um texto vazio, ou só com espaços, é palíndromo.

A solução precisa ser **recursiva e sem laços**: compare a primeira e a última letra e deixe a recursão cuidar do miolo. Funções prontas de inverter (\`reverse\`, \`reversed\`, \`[::-1]\`) não são permitidas.

Exemplo: em \`"Ame a ema"\`, sem espaços e em minúsculas, fica \`"ameaema"\`, que é palíndromo.`,
    constraints: [
      "0 <= comprimento do texto <= 2000",
      "O texto contém apenas letras de A a Z (maiúsculas ou minúsculas) e espaços.",
      "Obrigatório: função recursiva, sem for/while e sem inverter o texto com funções prontas."
    ],
    tags: ["Recursão", "Strings"],
    functionSpec: { name: "ehPalindromo", params: [{ name: "texto", type: "string" }], returns: "bool" },
    languages: recursiveNoLoops([NO_REVERSE], 100),
    publicCases: [call(["Ame a ema"], true), call(["Recursao"], false)],
    hiddenCases: hidden.map((text) => call([text], isPalindrome(text))),
    hints: [
      "Use dois índices, um em cada ponta do texto, como parâmetros de uma função auxiliar recursiva.",
      "Se a ponta esquerda for espaço, avance só ela; se a direita for espaço, recue só ela. Senão, compare as duas letras em minúsculas.",
      "O caso base é quando os índices se cruzam (esquerda >= direita): aí o texto é palíndromo. Evite criar substrings a cada chamada, que custa O(n) cada."
    ],
    editorial: `**Ideia.** Um texto é palíndromo se a primeira e a última letra coincidem e o miolo também é palíndromo. Os espaços são pulados, um de cada vez.

1. \`verifica(texto, i, j)\`: se \`i >= j\`, devolva verdadeiro.
2. Se \`texto[i]\` for espaço, chame \`verifica(texto, i + 1, j)\`; se \`texto[j]\` for espaço, \`verifica(texto, i, j - 1)\`.
3. Compare as letras em minúsculas; se forem diferentes, falso; senão, \`verifica(texto, i + 1, j - 1)\`.

\`\`\`c
#include <ctype.h>
#include <string.h>

static bool verifica(const char *s, int i, int j) {
    if (i >= j) return true;
    if (s[i] == ' ') return verifica(s, i + 1, j);
    if (s[j] == ' ') return verifica(s, i, j - 1);
    if (tolower((unsigned char)s[i]) != tolower((unsigned char)s[j])) return false;
    return verifica(s, i + 1, j - 1);
}

bool ehPalindromo(char* texto) {
    return verifica(texto, 0, (int)strlen(texto) - 1);
}
\`\`\`

**Custo.** Cada chamada anda pelo menos uma posição: O(n) chamadas e O(n) de pilha. Passar índices em vez de recortar o texto evita o custo O(n²) das substrings.`,
    complexity: { time: "O(n)", space: "O(n) de pilha" }
  });
}

function caminhosNaGrade(): Challenge {
  const count = (grid: string[]) => {
    const cols = grid[0].length;
    const row = new Array<number>(cols).fill(0);
    grid.forEach((line, r) => {
      for (let c = 0; c < cols; c += 1) {
        if (line[c] === "#") row[c] = 0;
        else if (r === 0 && c === 0) row[c] = 1;
        else row[c] = (row[c] + (c > 0 ? row[c - 1] : 0)) % MOD;
      }
    });
    return row[cols - 1];
  };
  const random = createRandom(300301);
  const randomGrid = (rows: number, cols: number, blocked: number, keepEnds = true) => {
    const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (random() < blocked ? "#" : ".")));
    if (keepEnds) {
      grid[0][0] = ".";
      grid[rows - 1][cols - 1] = ".";
    }
    return grid.map((line) => line.join(""));
  };
  const open = (rows: number, cols: number) => Array.from({ length: rows }, () => ".".repeat(cols));
  const wall = open(60, 60).map((line, r) => (r === 30 ? "#".repeat(60) : line));
  const diagonal = open(60, 60).map((line, r) => line.split("").map((char, c) => (c === r + 5 || c === r - 5 ? "#" : char)).join(""));
  const hidden: string[][] = [
    ["."],
    ["#"],
    ["#.", ".."],
    ["..", ".#"],
    ["......"],
    ["...#.."],
    [".", ".", ".", "."],
    [".", "#", "."],
    ["...", "...", "..."],
    randomGrid(8, 9, 0.2),
    randomGrid(15, 15, 0.15),
    open(20, 20),
    open(60, 60),
    open(1, 60),
    open(60, 1),
    randomGrid(60, 60, 0.1),
    randomGrid(60, 60, 0.25),
    randomGrid(45, 60, 0.3),
    wall,
    diagonal,
    randomGrid(60, 60, 0.05, false)
  ];
  return defineChallenge({
    slug: "caminhos-na-grade",
    title: "Caminhos na grade",
    difficulty: "hard",
    moduleId: moduleId("recursividade"),
    position: 5,
    isBoss: true,
    description: `Um robô está no canto **superior esquerdo** de uma grade e precisa chegar ao canto **inferior direito**. A cada passo ele anda **uma casa para a direita ou uma casa para baixo**, nunca para cima ou para a esquerda.

Implemente \`contarCaminhos(grade)\`, que recebe a grade como um vetor de strings (uma string por linha, todas do mesmo tamanho), onde \`"."\` é uma casa livre e \`"#"\` é um obstáculo, e retorna **quantos caminhos diferentes** levam o robô do início ao fim sem pisar em obstáculos.

Como o número de caminhos cresce muito depressa (uma grade 60 × 60 livre tem mais de 10^34 caminhos), retorne o resultado **módulo 1000000007**.

Se o início ou o fim for obstáculo, a resposta é 0. Uma grade 1 × 1 livre tem 1 caminho (o robô já está no destino).

Pense recursivamente: o número de caminhos a partir de uma casa é a soma dos caminhos a partir da casa da direita e da casa de baixo. A recursão pura recalcula as mesmas casas um número exponencial de vezes; guarde cada resposta numa tabela (**memoização**) para calcular cada casa uma única vez.

Regra: a solução precisa usar uma **função recursiva**.`,
    constraints: [
      "1 <= número de linhas, número de colunas <= 60",
      "Cada caractere da grade é '.' (livre) ou '#' (obstáculo).",
      "Retorne a quantidade de caminhos módulo 1000000007.",
      "Obrigatório: função recursiva (com memoização)."
    ],
    tags: ["Recursão", "Memoização"],
    functionSpec: { name: "contarCaminhos", params: [{ name: "grade", type: "string[]" }], returns: "int" },
    languages: everyLanguage([]).map((entry) => ({
      ...entry,
      sourceRules: [entry.language === "python" ? PY_RECURSION : rules.recursion()]
    })),
    publicCases: [call([["...", ".#.", "..."]], 2), call([["....", "..#.", "...."]], 4)],
    hiddenCases: hidden.map((grid) => call([grid], count(grid))),
    hints: [
      "Defina caminhos(i, j) = número de caminhos da casa (i, j) até o destino. Quanto vale no destino? E numa casa fora da grade ou com obstáculo?",
      "caminhos(i, j) = caminhos(i + 1, j) + caminhos(i, j + 1). Sem memória, essa recursão visita as mesmas casas bilhões de vezes.",
      "Crie uma tabela linhas × colunas preenchida com -1; antes de calcular, consulte a tabela e, depois de calcular, guarde o resultado. Some com % 1000000007."
    ],
    editorial: `**Ideia.** De cada casa livre saem dois subproblemas: seguir pela direita ou por baixo. A resposta de uma casa não depende do caminho que levou até ela, então pode ser calculada uma vez e reaproveitada.

1. \`ir(i, j)\`: fora da grade ou obstáculo → 0; destino → 1.
2. Se \`memo[i][j]\` já foi calculado, devolva-o.
3. Senão, \`memo[i][j] = (ir(i + 1, j) + ir(i, j + 1)) % MOD\`.

\`\`\`js
function contarCaminhos(grade) {
  const linhas = grade.length, colunas = grade[0].length;
  const memo = Array.from({ length: linhas }, () => new Array(colunas).fill(-1));
  function ir(i, j) {
    if (i >= linhas || j >= colunas || grade[i][j] === "#") return 0;
    if (i === linhas - 1 && j === colunas - 1) return 1;
    if (memo[i][j] === -1) memo[i][j] = (ir(i + 1, j) + ir(i, j + 1)) % 1000000007;
    return memo[i][j];
  }
  return ir(0, 0);
}
\`\`\`

**Custo.** Cada uma das L × C casas é calculada uma vez, com trabalho constante: O(L · C) de tempo e de memória. A pilha chega a L + C chamadas. Sem a memoização, o custo é exponencial: uma grade 60 × 60 livre tem cerca de 10^34 caminhos para visitar.`,
    complexity: { time: "O(L · C)", space: "O(L · C)" }
  });
}

// =====================================================================
// Complexidade
// =====================================================================

function fibonacciModular(): Challenge {
  const values = [10, 1, 0, 2, 3, 20, 30, 45, 50, 90, 100, 1000, 100000, 1000000, 999999, 500000];
  const random = createRandom(300401);
  while (values.length < 22) values.push(randomInt(random, 1000, 1000000));
  const max = Math.max(...values);
  const fib = new Array<number>(max + 1);
  fib[0] = 0;
  fib[1] = 1;
  for (let index = 2; index <= max; index += 1) fib[index] = (fib[index - 1] + fib[index - 2]) % MOD;
  const [first, second, ...hidden] = values;
  return defineChallenge({
    slug: "fibonacci-modular",
    title: "Fibonacci modular",
    difficulty: "easy",
    moduleId: moduleId("complexidade"),
    position: 0,
    description: `A sequência de Fibonacci começa com F(0) = 0 e F(1) = 1, e cada termo seguinte é a soma dos dois anteriores: F(n) = F(n − 1) + F(n − 2). Os primeiros termos são 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55…

Implemente \`fibonacci(n)\`, que retorna **F(n) módulo 1000000007**, para n até 10^6.

**Por que o módulo?** F(n) cresce muito rápido (F(100) já tem 21 dígitos). Tirando o resto por 1000000007 a cada soma, os valores ficam sempre abaixo de 2 · 10^9.

**Por que a recursão direta não serve?** A definição \`fib(n) = fib(n - 1) + fib(n - 2)\` refaz as mesmas contas: o número de chamadas cresce como 1,6^n, e fib(45) sozinho já passa de 2 bilhões de chamadas. Guardando só os dois últimos termos e avançando de um em um, o custo cai para **O(n)**: um milhão de somas, que qualquer linguagem faz em milissegundos.`,
    constraints: ["0 <= n <= 10^6", "Retorne F(n) mod 1000000007.", "Tempo limite: 1,5 s (3 s em Python)."],
    tags: ["Complexidade", "Programação dinâmica"],
    functionSpec: { name: "fibonacci", params: [{ name: "n", type: "int" }], returns: "int" },
    publicCases: [call([first], fib[first]), call([second], fib[second])],
    hiddenCases: hidden.map((n) => call([n], fib[n])),
    hints: [
      "Quantas vezes a recursão direta calcula fib(2) quando você pede fib(30)? Conte a árvore de chamadas.",
      "Para calcular o próximo termo, você só precisa dos dois anteriores. Guarde-os em duas variáveis.",
      "Faça (a + b) % 1000000007 a cada passo; a soma de dois restos cabe em int64 e também em number do JavaScript."
    ],
    editorial: `**Ideia.** Em vez de descer recursivamente, suba de F(0) até F(n) guardando os dois últimos termos.

\`\`\`python
def fibonacci(n):
    anterior, atual = 0, 1
    for _ in range(n):
        anterior, atual = atual, (anterior + atual) % 1000000007
    return anterior
\`\`\`

Depois de k passos, \`anterior\` vale F(k); por isso, após n passos, a resposta está em \`anterior\`.

**Custo.** n iterações com trabalho constante: O(n) de tempo e O(1) de memória. A recursão sem memória custa O(φ^n), com φ ≈ 1,618: para n = 45 isso passa de 10^9 chamadas.`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function contarParesIguais(): Challenge {
  const pairs = (values: number[]) => {
    const ordered = Float64Array.from(values).sort();
    let total = 0;
    let run = 0;
    for (let index = 0; index < ordered.length; index += 1) {
      run = index > 0 && ordered[index] === ordered[index - 1] ? run + 1 : 0;
      total += run;
    }
    return total;
  };
  const random = createRandom(300501);
  const literal: number[][] = [
    [], [4], [2, 2], [0, 0, 0, 0, 0], [-3, 3, -3, 3, -3], [1000000000, -1000000000, 1000000000],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  ];
  for (let index = 0; index < 4; index += 1) literal.push(randomArray(random, randomInt(random, 10, 60), -5, 5));
  const generated = [
    gen({ $gen: "repeat", n: 200000, value: 7 }),
    gen({ $gen: "ints", n: 200000, min: 1, max: 1000, seed: 300511 }),
    gen({ $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 300512 })
  ];
  return defineChallenge({
    slug: "contar-pares-iguais",
    title: "Contar pares iguais",
    difficulty: "medium",
    moduleId: moduleId("complexidade"),
    position: 1,
    description: `Implemente \`contarPares(nums)\`, que retorna **quantos pares de índices (i, j), com i < j, têm \`nums[i] == nums[j]\`**.

Exemplo: em \`[1, 2, 1, 1]\` o valor 1 aparece nos índices 0, 2 e 3, formando os pares (0, 2), (0, 3) e (2, 3). A resposta é 3.

O vetor pode ter até 200 000 elementos. Comparar todos os pares custa cerca de n²/2 = 2 · 10^10 comparações: dezenas de segundos. Pense em como contar **sem comparar par a par**: se um valor aparece k vezes, ele forma k · (k − 1) / 2 pares. Com uma tabela de contagem (hash) o custo é **O(n)**; ordenando o vetor e contando os blocos de valores iguais, **O(n log n)**. As duas passam.

A resposta pode passar de 2^31 (chega a quase 2 · 10^10), então use um inteiro de 64 bits (\`long long\` em C).`,
    constraints: [
      "0 <= n <= 200 000",
      "-10^9 <= nums[i] <= 10^9",
      "Retorne um inteiro de 64 bits.",
      "Tempo limite: 1,5 s (3 s em Python)."
    ],
    tags: ["Complexidade", "Contagem"],
    functionSpec: { name: "contarPares", params: [{ name: "nums", type: "int[]" }], returns: "long" },
    publicCases: [call([[1, 2, 1, 1]], 3), call([[5, 6, 7]], 0)],
    hiddenCases: [
      ...literal.map((values) => call([values], pairs(values))),
      ...generated.map((item) => call([item.spec], pairs(item.value)))
    ],
    hints: [
      "Se o valor 7 aparece 4 vezes, quantos pares ele forma? Isso não depende de onde ficam os 7.",
      "Percorra o vetor uma vez: ao encontrar um valor que já apareceu k vezes, ele forma k pares novos com os anteriores.",
      "Em Python e JavaScript, use um dicionário/Map de contagens. Em C, ordene uma cópia com qsort e conte cada bloco de iguais. Acumule em 64 bits."
    ],
    editorial: `**Ideia.** Cada novo elemento forma um par com cada ocorrência anterior do mesmo valor. Basta saber quantas vezes o valor já apareceu.

\`\`\`js
function contarPares(nums) {
  const vistos = new Map();
  let pares = 0;
  for (const valor of nums) {
    const k = vistos.get(valor) ?? 0;
    pares += k;
    vistos.set(valor, k + 1);
  }
  return pares;
}
\`\`\`

Em C, sem tabela hash pronta, ordene com \`qsort\`: valores iguais ficam vizinhos, e um bloco de tamanho k contribui com k · (k − 1) / 2.

**Custo.** O(n) com hash (O(n log n) ordenando), contra O(n²) do laço duplo. Para n = 200 000: 2 · 10^5 operações contra 2 · 10^10.`,
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

/** Quantidade de primos <= n para cada n pedido (um crivo só, guardado entre builds). */
const primeCountCache = new Map<number, number>();
function primeCounts(values: number[]): number[] {
  const missing = values.filter((n) => !primeCountCache.has(n));
  if (missing.length) {
    const limit = Math.max(...missing, 2);
    const composite = new Uint8Array(limit + 1);
    for (let p = 2; p * p <= limit; p += 1) {
      if (!composite[p]) for (let multiple = p * p; multiple <= limit; multiple += p) composite[multiple] = 1;
    }
    const wanted = [...new Set(missing)].sort((a, b) => a - b);
    let total = 0;
    let next = 0;
    for (let value = 0; value <= limit && next < wanted.length; value += 1) {
      if (value >= 2 && !composite[value]) total += 1;
      while (next < wanted.length && wanted[next] === value) primeCountCache.set(wanted[next++], total);
    }
  }
  return values.map((n) => primeCountCache.get(n)!);
}

function crivoDeEratostenes(): Challenge {
  const values = [0, 1, 2, 3, 4, 100, 1000, 7919, 7920, 100000, 1000000, 5000000, 9999991, 10000000];
  const random = createRandom(300601);
  while (values.length < 16) values.push(randomInt(random, 10000, 2000000));
  values.push(randomInt(random, 6000000, 9000000));
  return defineChallenge({
    slug: "crivo-de-eratostenes",
    title: "Crivo de Eratóstenes",
    difficulty: "medium",
    moduleId: moduleId("complexidade"),
    position: 2,
    description: `Implemente \`contarPrimos(n)\`, que retorna **quantos números primos existem entre 2 e n** (inclusive). Um número primo tem exatamente dois divisores: 1 e ele mesmo. Para n < 2, a resposta é 0.

Exemplo: até 10 os primos são 2, 3, 5 e 7, então \`contarPrimos(10)\` retorna 4.

n chega a 10^7. Testar cada número por divisão (tentar todos os divisores até √x) custa perto de n·√n / log n operações, alguns segundos para n = 10^7, e estoura o tempo limite.

Use o **Crivo de Eratóstenes**: crie um vetor de marcas de 0 a n, e para cada número p ainda não marcado (que é primo) marque como composto todos os múltiplos p², p² + p, p² + 2p, … até n. No fim, conte os que não foram marcados. O custo total é **O(n log log n)**, praticamente linear.`,
    constraints: ["0 <= n <= 10^7", "Tempo limite: 1,5 s (3 s em Python).", "Memória: um vetor de n + 1 bytes (ou booleanos) cabe com folga."],
    tags: ["Complexidade", "Matemática"],
    functionSpec: { name: "contarPrimos", params: [{ name: "n", type: "int" }], returns: "int" },
    publicCases: [call([10], 4), call([30], 10)],
    hiddenCases: primeCounts(values).map((count, index) => call([values[index]], count)),
    hints: [
      "Em vez de perguntar \"x é primo?\" para cada x, deixe cada primo eliminar os próprios múltiplos.",
      "Ao encontrar um primo p, comece a marcar em p · p: os múltiplos menores já foram marcados por primos menores. Pare quando p · p > n.",
      "Em C, use um vetor de char alocado com malloc (ou calloc). Em Python, bytearray e atribuição por fatia (crivo[p*p::p] = ...) são bem rápidos."
    ],
    editorial: `**Ideia.** Todo número composto tem um fator primo ≤ √n. Então, riscando os múltiplos de cada primo até √n, sobram exatamente os primos.

\`\`\`c
int contarPrimos(int n) {
    if (n < 2) return 0;
    char *composto = calloc(n + 1, 1);
    for (long long p = 2; p * p <= n; p++)
        if (!composto[p])
            for (long long m = p * p; m <= n; m += p) composto[m] = 1;
    int total = 0;
    for (int x = 2; x <= n; x++) total += !composto[x];
    free(composto);
    return total;
}
\`\`\`

**Custo.** Cada primo p risca n/p posições; a soma n/2 + n/3 + n/5 + … vale O(n log log n). Com n = 10^7, são uns 25 milhões de marcações, contra algumas centenas de milhões de divisões na divisão por tentativa.`,
    complexity: { time: "O(n log log n)", space: "O(n)" }
  });
}

function maiorLucroNaBolsa(): Challenge {
  const best = (prices: number[]) => {
    let minimum = Infinity;
    let profit = 0;
    for (const price of prices) {
      minimum = Math.min(minimum, price);
      profit = Math.max(profit, price - minimum);
    }
    return profit;
  };
  const random = createRandom(300701);
  const literal: number[][] = [
    [5], [3, 3, 3], [1, 1000000000], [1000000000, 0], [4, 1, 2], [2, 9, 1, 3],
    [8, 6, 7, 1, 2], [0, 0, 5, 0]
  ];
  for (let index = 0; index < 4; index += 1) literal.push(randomArray(random, randomInt(random, 5, 40), 0, 100));
  const generated = [
    gen({ $gen: "range", n: 200000, start: 1000000000, step: -5000 }),
    gen({ $gen: "ints", n: 200000, min: 0, max: 1000000000, seed: 300712 }),
    gen({ $gen: "concat", parts: [{ $gen: "range", n: 199999, start: 600000, step: -3 }, 1000000000] })
  ];
  return defineChallenge({
    slug: "maior-lucro-na-bolsa",
    title: "Maior lucro na bolsa",
    difficulty: "medium",
    moduleId: moduleId("complexidade"),
    position: 3,
    description: `Você recebe \`precos\`, o preço de uma ação em cada dia, em ordem cronológica. Você pode **comprar uma vez e vender uma vez**, e a venda precisa acontecer **depois** da compra.

Implemente \`maiorLucro(precos)\`, que retorna o **maior lucro possível**, isto é, o maior valor de \`precos[j] − precos[i]\` com i < j. Se nenhuma operação der lucro (por exemplo, os preços só caem), retorne **0**.

Exemplo: em \`[9, 4, 6, 2, 8, 5]\` o melhor é comprar a 2 (dia 3) e vender a 8 (dia 4): lucro 6. Repare que comprar no menor preço de todos nem sempre funciona, porque ele pode estar no último dia.

Com até 200 000 dias, testar todos os pares (i, j) custa 2 · 10^10 operações. Existe uma solução de **uma passada só, O(n)**: ao chegar no dia j, a melhor compra possível é o **menor preço visto até ali**.`,
    constraints: ["1 <= n <= 200 000", "0 <= precos[i] <= 10^9", "Tempo limite: 1,5 s (3 s em Python)."],
    tags: ["Complexidade", "Vetores"],
    functionSpec: { name: "maiorLucro", params: [{ name: "precos", type: "int[]" }], returns: "int" },
    publicCases: [call([[9, 4, 6, 2, 8, 5]], 6), call([[10, 8, 5, 1]], 0)],
    hiddenCases: [
      ...literal.map((prices) => call([prices], best(prices))),
      ...generated.map((item) => call([item.spec], best(item.value)))
    ],
    hints: [
      "Fixe o dia da venda j. Qual é a melhor compra para ele?",
      "A melhor compra para o dia j é o menor preço entre os dias 0 e j − 1. Dá para manter esse mínimo enquanto percorre o vetor.",
      "Numa única passada: atualize o lucro com preco − menor e depois atualize o menor. Comece o lucro em 0."
    ],
    editorial: `**Ideia.** Percorra os dias guardando o menor preço visto até agora. Em cada dia, vender hoje rende \`preco - menor\`; fique com o maior desses valores.

\`\`\`c
int maiorLucro(int* precos, int precosSize) {
    int menor = precos[0], lucro = 0;
    for (int j = 1; j < precosSize; j++) {
        if (precos[j] - menor > lucro) lucro = precos[j] - menor;
        if (precos[j] < menor) menor = precos[j];
    }
    return lucro;
}
\`\`\`

**Custo.** Uma passada, O(n) de tempo e O(1) de memória. O laço duplo sobre todos os pares é O(n²): para n = 200 000, 20 bilhões de subtrações.`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

/** Inversões de uma permutação de 1..n com uma árvore de Fenwick: O(n log n) sem alocações. */
function countInversions(values: number[]): number {
  const n = values.length;
  const tree = new Int32Array(n + 1);
  let total = 0;
  for (let index = n - 1; index >= 0; index -= 1) {
    // Quantos elementos à direita são menores que values[index].
    for (let position = values[index] - 1; position > 0; position -= position & -position) total += tree[position];
    for (let position = values[index]; position <= n; position += position & -position) tree[position] += 1;
  }
  return total;
}

function contarInversoes(): Challenge {
  const random = createRandom(300801);
  const permutation = (n: number) => shuffle(random, Array.from({ length: n }, (_, index) => index + 1));
  const nearlySorted = Array.from({ length: 50 }, (_, index) => index + 1);
  for (let index = 0; index + 1 < nearlySorted.length; index += 7) {
    [nearlySorted[index], nearlySorted[index + 1]] = [nearlySorted[index + 1], nearlySorted[index]];
  }
  const literal: number[][] = [
    [], [1], [2, 1], [1, 2], [3, 2, 1], [2, 3, 1], [5, 4, 3, 2, 1, 6], nearlySorted,
    permutation(10), permutation(100), permutation(1000)
  ];
  const generated = [
    gen({ $gen: "perm", n: 200000, seed: 300811 }),
    gen({ $gen: "range", n: 200000, start: 200000, step: -1 }),
    gen({ $gen: "concat", parts: [{ $gen: "range", n: 100000, start: 100001 }, { $gen: "range", n: 100000, start: 1 }] })
  ];
  return defineChallenge({
    slug: "contar-inversoes",
    title: "Contar inversões",
    difficulty: "hard",
    moduleId: moduleId("complexidade"),
    position: 4,
    isBoss: true,
    description: `Uma **inversão** num vetor é um par de posições (i, j) com i < j e \`nums[i] > nums[j]\`: dois elementos que estão "fora de ordem" entre si. O número de inversões mede o quanto o vetor está desordenado: um vetor crescente tem 0, e um vetor decrescente de n elementos tem n · (n − 1) / 2.

Implemente \`contarInversoes(nums)\`, que recebe uma **permutação** dos números 1, 2, …, n e retorna quantas inversões ela tem.

Exemplo: \`[2, 4, 1, 3, 5]\` tem 3 inversões: (2, 1), (4, 1) e (4, 3).

n chega a 200 000, e a resposta pode passar de 2 · 10^10: use 64 bits (\`long long\` em C). Comparar todos os pares é O(n²) e estoura o tempo. Adapte o **Merge Sort** (O(n log n)): na hora de intercalar as duas metades já ordenadas, quando um elemento da metade direita passa na frente, ele forma uma inversão com **todos os elementos que ainda restam na metade esquerda**.`,
    constraints: [
      "0 <= n <= 200 000",
      "nums é uma permutação de 1..n (sem repetições).",
      "Retorne um inteiro de 64 bits.",
      "Tempo limite: 2 s (4 s em Python)."
    ],
    tags: ["Complexidade", "Merge Sort", "Divisão e conquista"],
    timeLimitMs: 2000,
    functionSpec: { name: "contarInversoes", params: [{ name: "nums", type: "int[]" }], returns: "long" },
    publicCases: [call([[2, 4, 1, 3, 5]], 3), call([[1, 2, 3]], 0)],
    hiddenCases: [
      ...literal.map((values) => call([values], countInversions(values))),
      ...generated.map((item) => call([item.spec], countInversions(item.value)))
    ],
    hints: [
      "Divida o vetor ao meio. Toda inversão está inteira na metade esquerda, inteira na direita, ou tem um elemento em cada metade.",
      "As inversões \"cruzadas\" são fáceis de contar se as duas metades estiverem ordenadas: é exatamente o que o Merge Sort entrega antes de intercalar.",
      "Na intercalação, quando esquerda[i] > direita[j], some (tamanho da esquerda − i) ao total e avance j. Acumule tudo em 64 bits."
    ],
    editorial: `**Ideia.** Ordene com Merge Sort e conte as inversões durante a intercalação. Se \`esq[i] > dir[j]\`, então todos os elementos de \`esq[i..]\` (já ordenados, maiores ou iguais a \`esq[i]\`) também são maiores que \`dir[j]\`.

\`\`\`c
static long long ordena(int *v, int *aux, int ini, int fim) {
    if (fim - ini <= 1) return 0;
    int meio = (ini + fim) / 2;
    long long total = ordena(v, aux, ini, meio) + ordena(v, aux, meio, fim);
    int i = ini, j = meio, k = ini;
    while (i < meio && j < fim) {
        if (v[i] <= v[j]) aux[k++] = v[i++];
        else { total += meio - i; aux[k++] = v[j++]; }
    }
    while (i < meio) aux[k++] = v[i++];
    while (j < fim) aux[k++] = v[j++];
    memcpy(v + ini, aux + ini, (fim - ini) * sizeof(int));
    return total;
}
\`\`\`

**Custo.** O mesmo do Merge Sort: O(n log n) de tempo e O(n) de memória auxiliar. Para n = 200 000, cerca de 3,5 milhões de passos na intercalação, contra 2 · 10^10 comparações do laço duplo.`,
    complexity: { time: "O(n log n)", space: "O(n)" }
  });
}

// =====================================================================
// Busca
// =====================================================================

function todasAsPosicoes(): Challenge {
  const positions = (values: number[], x: number) =>
    values.flatMap((value, index) => (value === x ? [index] : []));
  const random = createRandom(300901);
  const literal: Array<[number[], number]> = [
    [[], 3],
    [[5], 5],
    [[5], 4],
    [[2, 9, 4], 2],
    [[1, 8, 3, 8], 8],
    [[-1, -2, -1, 0, -1], -1],
    [new Array(1000).fill(6), 6],
    [[0, 0, 1, 0], 1],
    [[10, 20, 30, 40], 40]
  ];
  for (let index = 0; index < 3; index += 1) {
    const values = randomArray(random, randomInt(random, 20, 200), -10, 10);
    literal.push([values, pick(random, values)]);
  }
  const big1 = gen({ $gen: "ints", n: 60000, min: 1, max: 100, seed: 300911 });
  const big2 = gen({ $gen: "ints", n: 60000, min: -1000000000, max: 1000000000, seed: 300912, set: { "0": 42, "59999": 42 } });
  const big3 = gen({ $gen: "ints", n: 40000, min: 0, max: 50, seed: 300913 });
  return defineChallenge({
    slug: "todas-as-posicoes",
    title: "Todas as posições",
    difficulty: "easy",
    moduleId: moduleId("busca"),
    position: 0,
    description: `Implemente \`todasAsPosicoes(nums, x)\`, que retorna um vetor com **todos os índices** em que o valor \`x\` aparece em \`nums\`, em **ordem crescente**. Se \`x\` não aparecer, retorne um vetor vazio.

Esta é a **busca sequencial**: como o vetor não está ordenado, não há atalho, e é preciso olhar cada posição, do índice 0 até o último. O custo é O(n).

Exemplo: em \`[4, 7, 1, 7, 9]\`, o valor 7 está nos índices 1 e 3, então a resposta é \`[1, 3]\`.

Em C, a função recebe \`int* returnSize\`: escreva nele o tamanho do vetor retornado (alocado com \`malloc\`).`,
    constraints: [
      "0 <= n <= 200 000",
      "-10^9 <= nums[i], x <= 10^9",
      "Os índices começam em 0 e devem vir em ordem crescente."
    ],
    tags: ["Busca sequencial", "Vetores"],
    functionSpec: {
      name: "todasAsPosicoes",
      params: [{ name: "nums", type: "int[]" }, { name: "x", type: "int" }],
      returns: "int[]"
    },
    publicCases: [call([[4, 7, 1, 7, 9], 7], [1, 3]), call([[3, 8, 2], 5], [])],
    hiddenCases: [
      ...literal.map(([values, x]) => call([values, x], positions(values, x))),
      call([big1.spec, 37], positions(big1.value, 37)),
      call([big2.spec, 42], positions(big2.value, 42)),
      call([big3.spec, 0], positions(big3.value, 0))
    ],
    hints: [
      "Percorra o vetor do começo ao fim e anote cada índice em que nums[i] é igual a x.",
      "Confira o laço nas duas pontas: o índice 0 e o índice n − 1 também precisam ser examinados.",
      "Em C, aloque um vetor de tamanho numsSize (o máximo possível), preencha as posições e ajuste *returnSize para a quantidade encontrada."
    ],
    editorial: `**Ideia.** Busca sequencial: examine cada posição uma vez e guarde as que casam.

\`\`\`c
int* todasAsPosicoes(int* nums, int numsSize, int x, int* returnSize) {
    int *resposta = malloc(sizeof(int) * (numsSize > 0 ? numsSize : 1));
    int total = 0;
    for (int i = 0; i < numsSize; i++)
        if (nums[i] == x) resposta[total++] = i;
    *returnSize = total;
    return resposta;
}
\`\`\`

**Custo.** O(n) de tempo, e O(k) de memória para os k índices encontrados. Num vetor sem ordem nenhuma não dá para fazer melhor: qualquer posição não examinada poderia conter x.`,
    complexity: { time: "O(n)", space: "O(k)" }
  });
}

function buscaBinaria(): Challenge {
  const total = (values: number[], queries: number[]) => {
    let sum = 0;
    for (const query of queries) {
      let lo = 0;
      let hi = values.length - 1;
      let found = -1;
      while (lo <= hi && found < 0) {
        const mid = (lo + hi) >> 1;
        if (values[mid] === query) found = mid;
        else if (values[mid] < query) lo = mid + 1;
        else hi = mid - 1;
      }
      sum += found;
    }
    return sum;
  };
  const random = createRandom(301001);
  const literal: Array<[number[], number[]]> = [
    [[], [1, 2]],
    [[5], []],
    [[5], [5, 4, 6, 5]],
    [[1, 2], [1, 2, 0, 3]],
    [[-9, -4, 0, 3, 8, 21], [-9, 21, 0, -5, 22, -10]],
    [[-1000000000, 1000000000], [1000000000, -1000000000, 0]],
    [[2, 4, 6, 8, 10, 12, 14], [1, 3, 5, 7, 9, 11, 13, 15]]
  ];
  for (let index = 0; index < 5; index += 1) {
    const values = [...new Set(randomArray(random, randomInt(random, 10, 300), -1000, 1000))].sort((a, b) => a - b);
    literal.push([values, randomArray(random, randomInt(random, 10, 300), -1100, 1100)]);
  }
  const generated: Array<[ReturnType<typeof gen>, ReturnType<typeof gen>]> = [
    [
      gen({ $gen: "ints", n: 100000, min: 0, max: 199999, seed: 301011, sorted: "asc", distinct: true }),
      gen({ $gen: "ints", n: 200000, min: 0, max: 199999, seed: 301012 })
    ],
    [gen({ $gen: "range", n: 200000, start: 0, step: 2 }), gen({ $gen: "range", n: 200000, start: 399999, step: -2 })],
    [gen({ $gen: "range", n: 200000, start: -100000 }), gen({ $gen: "perm", n: 200000, seed: 301015, start: -100000 })]
  ];
  return defineChallenge({
    slug: "busca-binaria",
    title: "Busca binária em lote",
    difficulty: "medium",
    moduleId: moduleId("busca"),
    position: 1,
    description: `Você recebe um vetor \`nums\` **ordenado em ordem crescente e sem valores repetidos** e um vetor \`consultas\`. Para cada consulta \`q\`, a busca devolve o **índice de \`q\` em \`nums\`**, ou **−1** se \`q\` não estiver lá.

Implemente \`somaDasBuscas(nums, consultas)\`, que faz todas as buscas e retorna a **soma dos resultados** (índices encontrados e −1 dos não encontrados). Devolver só a soma mantém a resposta pequena mesmo com 200 000 consultas; o que importa aqui é **como** cada busca é feita.

Exemplo: com \`nums = [1, 3, 5, 7, 9, 11]\` e \`consultas = [7, 4, 1]\`, as buscas devolvem 3, −1 e 0; a resposta é 3 + (−1) + 0 = **2**.

Tanto \`nums\` quanto \`consultas\` podem ter 200 000 elementos. Uma busca sequencial para cada consulta custa até n · m = 4 · 10^10 comparações. Use a **busca binária**: compare a consulta com o elemento do meio do intervalo e descarte a metade em que ela não pode estar. Cada busca custa O(log n), cerca de 18 comparações.

A soma pode passar de 2^31: use 64 bits (\`long long\` em C).`,
    constraints: [
      "0 <= n, m <= 200 000",
      "nums está em ordem estritamente crescente.",
      "-10^9 <= nums[i], consultas[j] <= 10^9",
      "Tempo limite: 2 s (4 s em Python)."
    ],
    tags: ["Busca binária"],
    timeLimitMs: 2000,
    functionSpec: {
      name: "somaDasBuscas",
      params: [{ name: "nums", type: "int[]" }, { name: "consultas", type: "int[]" }],
      returns: "long"
    },
    publicCases: [
      call([[1, 3, 5, 7, 9, 11], [7, 4, 1]], 2),
      call([[-10, -2, 0, 15], [15, -10, 20, -2]], 3)
    ],
    hiddenCases: [
      ...literal.map(([values, queries]) => call([values, queries], total(values, queries))),
      ...generated.map(([values, queries]) => call([values.spec, queries.spec], total(values.value, queries.value)))
    ],
    hints: [
      "Escreva primeiro uma função buscar(nums, q) que devolve o índice ou −1, e some os resultados.",
      "Mantenha um intervalo [ini, fim] onde q ainda pode estar. Compare q com nums[meio]: se for maior, ini = meio + 1; se for menor, fim = meio − 1.",
      "O laço termina quando ini > fim (não achou). Calcule meio = ini + (fim − ini) / 2 e acumule a soma num inteiro de 64 bits."
    ],
    editorial: `**Ideia.** Num vetor ordenado, cada comparação com o elemento do meio elimina metade dos candidatos.

\`\`\`c
static int buscar(int *nums, int n, int q) {
    int ini = 0, fim = n - 1;
    while (ini <= fim) {
        int meio = ini + (fim - ini) / 2;
        if (nums[meio] == q) return meio;
        if (nums[meio] < q) ini = meio + 1;
        else fim = meio - 1;
    }
    return -1;
}

long long somaDasBuscas(int* nums, int numsSize, int* consultas, int consultasSize) {
    long long soma = 0;
    for (int j = 0; j < consultasSize; j++) soma += buscar(nums, numsSize, consultas[j]);
    return soma;
}
\`\`\`

**Custo.** O(log n) por consulta, O(m log n) no total: cerca de 3,6 milhões de comparações para n = m = 200 000. A busca sequencial faria O(n · m).`,
    complexity: { time: "O(m log n)", space: "O(1)" }
  });
}

function primeiraEUltimaPosicao(): Challenge {
  const range = (values: number[], target: number) => {
    const first = values.indexOf(target);
    return first < 0 ? [-1, -1] : [first, values.lastIndexOf(target)];
  };
  const random = createRandom(301101);
  const literal: Array<[number[], number]> = [
    [[], 4],
    [[5], 5],
    [[5], 3],
    [[1, 5, 5], 5],
    [[7, 7, 7, 7], 7],
    [[2, 2, 3], 2],
    [[1, 2, 3, 4, 5], 5],
    [[1, 2, 3, 4, 5], 0],
    [[1, 2, 3, 4, 5], 6],
    [[1, 1, 2, 2, 4, 4], 3],
    [[-8, -8, -3, 0, 0, 0], 0]
  ];
  for (let index = 0; index < 2; index += 1) {
    const values = randomArray(random, randomInt(random, 30, 300), -20, 20).sort((a, b) => a - b);
    literal.push([values, pick(random, values)]);
  }
  const many = gen({ $gen: "ints", n: 50000, min: 0, max: 500, seed: 301111, sorted: "asc" });
  const sparse = gen({ $gen: "range", n: 100000, start: -1000000000, step: 7919 });
  const repeated = gen({ $gen: "repeat", n: 200000, value: 7 });
  const tail = gen({ $gen: "concat", parts: [{ $gen: "range", n: 50000, start: 0 }, { $gen: "repeat", n: 50000, value: 50000 }] });
  return defineChallenge({
    slug: "primeira-e-ultima-posicao",
    title: "Primeira e última posição",
    difficulty: "medium",
    moduleId: moduleId("busca"),
    position: 2,
    description: `Você recebe um vetor \`nums\` **ordenado em ordem crescente**, que **pode ter valores repetidos**, e um valor \`alvo\`.

Implemente \`primeiraEUltima(nums, alvo)\`, que retorna um vetor de duas posições: \`[primeira, ultima]\`, com o **primeiro** e o **último** índice em que \`alvo\` aparece. Se \`alvo\` não estiver no vetor, retorne \`[-1, -1]\`.

Exemplo: em \`[1, 2, 2, 2, 5, 8]\`, o valor 2 ocupa os índices 1 a 3: a resposta é \`[1, 3]\`.

A busca binária comum para assim que encontra **alguma** ocorrência, que pode estar no meio do bloco de repetidos. Faça duas buscas binárias: uma que, ao achar o alvo, continua procurando **à esquerda** (primeira ocorrência) e outra que continua **à direita** (última). Cuidado com o alvo na primeira ou na última posição do vetor.

Em C, retorne um vetor alocado com \`malloc\` e escreva 2 em \`*returnSize\`.`,
    constraints: [
      "0 <= n <= 200 000",
      "nums está em ordem crescente (não estrita).",
      "-10^9 <= nums[i], alvo <= 10^9",
      "Meta: O(log n) por busca."
    ],
    tags: ["Busca binária"],
    functionSpec: {
      name: "primeiraEUltima",
      params: [{ name: "nums", type: "int[]" }, { name: "alvo", type: "int" }],
      returns: "int[]"
    },
    publicCases: [call([[1, 2, 2, 2, 5, 8], 2], [1, 3]), call([[3, 3, 4], 7], [-1, -1])],
    hiddenCases: [
      ...literal.map(([values, target]) => call([values, target], range(values, target))),
      call([many.spec, 500], range(many.value, 500)),
      call([many.spec, 0], range(many.value, 0)),
      call([sparse.spec, sparse.value[65432]], [65432, 65432]),
      call([repeated.spec, 7], [0, 199999]),
      call([tail.spec, 50000], [50000, 99999]),
      call([sparse.spec, sparse.value[5000] + 1], [-1, -1])
    ],
    hints: [
      "Rode a busca binária normalmente, mas quando nums[meio] == alvo não pare: anote meio como candidato e continue procurando de um dos lados.",
      "Para a primeira ocorrência, depois de anotar, faça fim = meio − 1; para a última, ini = meio + 1.",
      "Use o intervalo fechado [0, n − 1] nas duas buscas e só termine quando ini > fim; assim as pontas do vetor também são examinadas."
    ],
    editorial: `**Ideia.** Duas buscas binárias que não param no primeiro acerto: guardam o índice e seguem para um dos lados.

\`\`\`js
function primeiraEUltima(nums, alvo) {
  const buscar = (paraEsquerda) => {
    let ini = 0, fim = nums.length - 1, achou = -1;
    while (ini <= fim) {
      const meio = (ini + fim) >> 1;
      if (nums[meio] === alvo) {
        achou = meio;
        if (paraEsquerda) fim = meio - 1; else ini = meio + 1;
      } else if (nums[meio] < alvo) ini = meio + 1;
      else fim = meio - 1;
    }
    return achou;
  };
  return [buscar(true), buscar(false)];
}
\`\`\`

**Custo.** Duas buscas de O(log n): O(log n) de tempo e O(1) de memória. Encontrar uma ocorrência e "andar" até as pontas do bloco degrada para O(n) quando o alvo se repete muito.`,
    complexity: { time: "O(log n)", space: "O(1)" }
  });
}

function raizQuadradaInteira(): Challenge {
  const isqrt = (x: number) => {
    let root = Math.floor(Math.sqrt(x));
    while (root * root > x) root -= 1;
    while ((root + 1) * (root + 1) <= x) root += 1;
    return root;
  };
  const top = 31622776;
  const random = createRandom(301201);
  const values = [
    0, 1, 2, 3, 4, 8, 99, 100, 1000000, 999999999999999, 1000000000000000, top * top, top * top - 1,
    562949953421312, 2147483647, 4294967296
  ];
  while (values.length < 22) values.push(randomInt(random, 0, 1000000000000000));
  return defineChallenge({
    slug: "raiz-quadrada-inteira",
    title: "Raiz quadrada inteira",
    difficulty: "medium",
    moduleId: moduleId("busca"),
    position: 3,
    description: `Implemente \`raizInteira(x)\`, que retorna a **parte inteira da raiz quadrada** de \`x\`: o maior inteiro \`r\` tal que \`r · r <= x\`.

Exemplo: √17 ≈ 4,12, então \`raizInteira(17)\` retorna 4; \`raizInteira(49)\` retorna 7.

A ideia é fazer uma **busca binária na resposta**: a condição "r · r <= x" é verdadeira para r = 0, 1, …, até a raiz, e falsa daí em diante. Procure a última posição em que ela é verdadeira dentro de um intervalo que certamente contém a resposta.

Regras: não use funções prontas de raiz ou potência (\`sqrt\`, \`Math.sqrt\`, \`math.isqrt\`, \`pow\`, \`** 0.5\`).

Cuidado com **overflow**: x chega a 10^15, e se o intervalo começar em [0, x], o produto \`meio · meio\` passa de 10^29. Como a raiz de 10^15 é menor que 31 622 777, basta procurar em [0, min(x, 31622777)]. Em C, use \`long long\`.`,
    constraints: [
      "0 <= x <= 10^15",
      "Retorne um inteiro (64 bits em C).",
      "Proibido: sqrt, isqrt, pow e ** 0.5 (ou 1/2)."
    ],
    tags: ["Busca binária", "Matemática"],
    functionSpec: { name: "raizInteira", params: [{ name: "x", type: "long" }], returns: "long" },
    languages: everyLanguage([NO_SQRT]),
    publicCases: [call([17], 4), call([49], 7)],
    hiddenCases: values.map((x) => call([x], isqrt(x))),
    hints: [
      "Se r · r <= x, então todo número menor que r também satisfaz a condição. Isso é o que permite a busca binária.",
      "Busque em [0, min(x, 31622777)]: se meio · meio <= x, guarde meio como candidato e vá para a direita; senão, vá para a esquerda.",
      "Em C, faça as contas em long long; em JavaScript, com o intervalo limitado, meio · meio fica abaixo de 2^53 e é exato."
    ],
    editorial: `**Ideia.** A função f(r) = (r · r <= x) é "verdadeiro, verdadeiro, …, falso, falso". A busca binária acha a última posição verdadeira em O(log x).

\`\`\`c
long long raizInteira(long long x) {
    long long ini = 0, fim = x < 31622777 ? x : 31622777, resposta = 0;
    while (ini <= fim) {
        long long meio = ini + (fim - ini) / 2;
        if (meio * meio <= x) { resposta = meio; ini = meio + 1; }
        else fim = meio - 1;
    }
    return resposta;
}
\`\`\`

**Custo.** Cerca de 25 iterações (log₂ 31 622 777): O(log x) de tempo e O(1) de memória. Limitar o intervalo evita tanto o overflow quanto a perda de precisão dos números em ponto flutuante.`,
    complexity: { time: "O(log x)", space: "O(1)" }
  });
}

function capacidadeMinimaDoCaminhao(): Challenge {
  const minimum = (weights: number[], days: number) => {
    const fits = (capacity: number) => {
      let used = 1;
      let load = 0;
      for (const weight of weights) {
        if (load + weight > capacity) {
          used += 1;
          load = 0;
        }
        load += weight;
      }
      return used <= days;
    };
    let lo = Math.max(...weights);
    let hi = weights.reduce((sum, weight) => sum + weight, 0);
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (fits(mid)) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
  const random = createRandom(301301);
  const literal: Array<[number[], number]> = [
    [[7], 1],
    [[4, 4, 4, 4], 4],
    [[4, 4, 4, 4], 1],
    [[4, 4, 4, 4], 3],
    [[1, 1, 1, 10], 2],
    [[10, 1, 1, 1], 2],
    [[500, 1, 500, 1], 2],
    [[3, 1, 4, 1, 5, 9, 2, 6, 5, 3], 5]
  ];
  for (let index = 0; index < 3; index += 1) {
    const weights = randomArray(random, randomInt(random, 10, 200), 1, 500);
    literal.push([weights, randomInt(random, 1, weights.length)]);
  }
  const bigA = gen({ $gen: "ints", n: 100000, min: 1, max: 500, seed: 301311 });
  const bigB = gen({ $gen: "ints", n: 20000, min: 1, max: 500, seed: 301312 });
  const bigC = gen({ $gen: "ints", n: 20000, min: 1, max: 10, seed: 301313, set: { "10000": 500 } });
  const bigD = gen({ $gen: "repeat", n: 100000, value: 500 });
  const generated: Array<[typeof bigA, number]> = [
    [bigA, 1], [bigB, 1000], [bigC, 3], [bigD, 7]
  ];
  return defineChallenge({
    slug: "capacidade-minima-do-caminhao",
    title: "Capacidade mínima do caminhão",
    difficulty: "hard",
    moduleId: moduleId("busca"),
    position: 4,
    isBoss: true,
    description: `Uma transportadora precisa entregar pacotes **na ordem em que estão na esteira**: \`pesos[i]\` é o peso do pacote i. Todo dia um caminhão sai carregado com os **próximos pacotes da fila**, em sequência, desde que a soma dos pesos não passe da **capacidade** do caminhão. Um pacote nunca é dividido nem pulado.

Implemente \`capacidadeMinima(pesos, dias)\`, que retorna a **menor capacidade** que permite entregar todos os pacotes em **no máximo \`dias\` dias**.

Exemplo: com \`pesos = [3, 2, 2, 4, 1, 4]\` e \`dias = 3\`, a capacidade 6 funciona: [3, 2] no 1º dia, [2, 4] no 2º, [1, 4] no 3º. A capacidade 5 exigiria 4 dias ([3, 2], [2], [4, 1], [4]). A resposta é **6**.

Observe:

- a capacidade nunca pode ser menor que o pacote mais pesado, e com a soma de todos os pesos um único dia basta;
- se uma capacidade C funciona, qualquer capacidade maior também funciona.

Por isso dá para fazer **busca binária na resposta**, entre o maior peso e a soma dos pesos, testando cada candidato com uma simulação gulosa em O(n). Testar as capacidades uma a uma pode exigir dezenas de milhões de simulações.`,
    constraints: [
      "1 <= n <= 100 000",
      "1 <= pesos[i] <= 500",
      "1 <= dias <= n",
      "Tempo limite: 1,5 s (3 s em Python)."
    ],
    tags: ["Busca binária", "Guloso"],
    functionSpec: {
      name: "capacidadeMinima",
      params: [{ name: "pesos", type: "int[]" }, { name: "dias", type: "int" }],
      returns: "int"
    },
    publicCases: [call([[3, 2, 2, 4, 1, 4], 3], 6), call([[1, 2, 3, 1, 1], 4], 3)],
    hiddenCases: [
      ...literal.map(([weights, days]) => call([weights, days], minimum(weights, days))),
      ...generated.map(([weights, days]) => call([weights.spec, days], minimum(weights.value, days)))
    ],
    hints: [
      "Dada uma capacidade C, como saber quantos dias são necessários? Encha o caminhão até o próximo pacote não caber e comece um novo dia.",
      "Se C basta, C + 1 também basta. Então existe uma fronteira entre as capacidades que não funcionam e as que funcionam.",
      "Busque em [maior peso, soma dos pesos]: se meio funciona, fim = meio; senão, ini = meio + 1. Pare quando ini == fim."
    ],
    editorial: `**Ideia.** Transforme a pergunta "qual a menor capacidade?" em "a capacidade C funciona?", que se responde com uma simulação gulosa. Como a resposta é monotônica, a busca binária encontra a fronteira.

\`\`\`python
def capacidadeMinima(pesos, dias):
    def dias_necessarios(capacidade):
        usados, carga = 1, 0
        for peso in pesos:
            if carga + peso > capacidade:
                usados += 1
                carga = 0
            carga += peso
        return usados

    ini, fim = max(pesos), sum(pesos)
    while ini < fim:
        meio = (ini + fim) // 2
        if dias_necessarios(meio) <= dias:
            fim = meio
        else:
            ini = meio + 1
    return ini
\`\`\`

A simulação gulosa é ótima para uma capacidade fixa: carregar o máximo possível hoje nunca atrapalha os dias seguintes.

**Custo.** O(n) por simulação e O(log S) simulações, com S a soma dos pesos (até 5 · 10^7, cerca de 26 rodadas): O(n log S). Testar as capacidades em sequência pode custar O(n · S).`,
    complexity: { time: "O(n log S)", space: "O(1)" }
  });
}

// =====================================================================
// Ordenação
// =====================================================================

function countingSortDeNotas(): Challenge {
  const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
  const random = createRandom(301401);
  const literal: number[][] = [
    [], [42], [100, 100, 100], [0, 0], [0, 100, 0, 100], [1, 2, 3, 4, 5], [100, 90, 80, 70, 0],
    Array.from({ length: 101 }, (_, index) => 100 - index)
  ];
  for (let index = 0; index < 4; index += 1) literal.push(randomArray(random, randomInt(random, 10, 500), 0, 100));
  const generated = [
    gen({ $gen: "ints", n: 10000, min: 0, max: 100, seed: 301411 }),
    gen({ $gen: "ints", n: 10000, min: 60, max: 70, seed: 301412 }),
    gen({ $gen: "ints", n: 10000, min: 0, max: 100, seed: 301413, sorted: "desc" }),
    gen({ $gen: "repeat", n: 10000, value: 7 })
  ];
  return defineChallenge({
    slug: "counting-sort-de-notas",
    title: "Counting Sort de notas",
    difficulty: "medium",
    moduleId: moduleId("ordenacao"),
    position: 6,
    description: `Uma turma grande fez uma prova e as notas são **inteiros de 0 a 100**. Implemente \`ordenarNotas(notas)\`, que retorna as notas em **ordem crescente**.

Funções prontas de ordenação (\`sort\`, \`sorted\`, \`qsort\`) não são permitidas. Como as notas cabem num intervalo pequeno e conhecido, dá para ordenar **sem comparar elementos**, com o **Counting Sort** (ordenação por contagem):

1. crie um vetor \`contagem\` de 101 posições, todas com zero;
2. percorra as notas somando 1 em \`contagem[nota]\`;
3. percorra \`contagem\` de 0 a 100 e escreva cada nota \`v\` exatamente \`contagem[v]\` vezes na saída.

O custo é **O(n + k)**, com n notas e k = 101 valores possíveis: linear, mais rápido que os O(n log n) de qualquer ordenação por comparação.

Em C, retorne um vetor alocado com \`malloc\` e escreva o tamanho em \`*returnSize\`.`,
    constraints: [
      "0 <= n <= 10 000",
      "0 <= notas[i] <= 100",
      "Proibido: sort, sorted e qsort."
    ],
    tags: ["Ordenação", "Counting Sort"],
    functionSpec: { name: "ordenarNotas", params: [{ name: "notas", type: "int[]" }], returns: "int[]" },
    languages: everyLanguage([rules.noBuiltinSort]),
    publicCases: [call([[7, 10, 3, 7, 0]], [0, 3, 7, 7, 10]), call([[100, 50]], [50, 100])],
    hiddenCases: [
      ...literal.map((values) => call([values], sorted(values))),
      ...generated.map((item) => call([item.spec], sorted(item.value)))
    ],
    hints: [
      "Você não precisa comparar notas entre si: basta saber quantas vezes cada valor de 0 a 100 aparece.",
      "Um vetor de 101 contadores resolve a contagem. Qual índice incrementar para a nota 73?",
      "Para montar a saída, percorra os valores de 0 a 100 e repita cada um contagem[valor] vezes."
    ],
    editorial: `**Ideia.** Conte quantas vezes cada nota aparece e reescreva as notas em ordem a partir das contagens.

\`\`\`c
int* ordenarNotas(int* notas, int notasSize, int* returnSize) {
    int contagem[101] = {0};
    for (int i = 0; i < notasSize; i++) contagem[notas[i]]++;
    int *saida = malloc(sizeof(int) * (notasSize > 0 ? notasSize : 1));
    int k = 0;
    for (int v = 0; v <= 100; v++)
        for (int c = 0; c < contagem[v]; c++) saida[k++] = v;
    *returnSize = notasSize;
    return saida;
}
\`\`\`

**Custo.** Uma passada para contar (O(n)) e uma para escrever (O(n + k)): O(n + k) de tempo e O(k) de memória extra, fora a saída. O Counting Sort só compensa quando o intervalo de valores k é pequeno perto de n.`,
    complexity: { time: "O(n + k)", space: "O(k)" }
  });
}

const FIRST_NAMES = [
  "Ana", "Bruno", "Caio", "Duda", "Elisa", "Felipe", "Gabi", "Heitor", "Iris", "Joao", "Katia", "Leo",
  "Maya", "Nina", "Otto", "Paula", "Quim", "Rita", "Sofia", "Tales", "Ursula", "Vitor", "Wesley", "Yara", "Zeca"
];
const LAST_NAMES = [
  "Alves", "Barros", "Costa", "Dias", "Esteves", "Farias", "Gomes", "Horta", "Lima", "Moura", "Nunes",
  "Prado", "Queiroz", "Rocha", "Santos", "Teixeira", "Vieira", "Xavier"
];

function ordenacaoEstavelDeAlunos(): Challenge {
  const stableSort = (names: string[], grades: number[]) =>
    names
      .map((name, index) => ({ name, grade: grades[index], index }))
      .sort((a, b) => b.grade - a.grade || a.index - b.index)
      .map((item) => item.name);
  const random = createRandom(301501);
  const student = () => `${pick(random, FIRST_NAMES)} ${pick(random, LAST_NAMES)}`;
  const classOf = (n: number, minGrade: number, maxGrade: number): [string[], number[]] => [
    Array.from({ length: n }, student),
    randomArray(random, n, minGrade, maxGrade)
  ];
  const literal: Array<[string[], number[]]> = [
    [[], []],
    [["Ana"], [80]],
    [["Ana", "Bruno", "Caio"], [50, 50, 90]],
    [["Duda", "Elisa", "Felipe", "Gabi"], [70, 70, 70, 70]],
    [["Iris", "Joao", "Katia", "Leo", "Maya"], [60, 90, 60, 90, 60]],
    [["Nina", "Otto", "Paula"], [10, 20, 30]],
    [["Quim", "Rita", "Sofia", "Tales"], [100, 0, 100, 0]],
    classOf(12, 5, 8),
    classOf(40, 0, 3),
    classOf(200, 0, 100),
    classOf(500, 50, 60),
    classOf(1000, 0, 10),
    classOf(2500, 0, 100),
    classOf(2500, 90, 100),
    classOf(2000, 0, 1)
  ];
  return defineChallenge({
    slug: "ordenacao-estavel-de-alunos",
    title: "Ordenação estável de alunos",
    difficulty: "hard",
    moduleId: moduleId("ordenacao"),
    position: 7,
    isBoss: true,
    description: `A secretaria quer publicar a classificação de uma prova. Você recebe dois vetores do mesmo tamanho: \`nomes[i]\` é o nome do aluno i e \`notas[i]\` é a nota dele (0 a 100). Os alunos estão em **ordem de inscrição**.

Implemente \`ordenarAlunos(nomes, notas)\`, que retorna os **nomes ordenados por nota, da maior para a menor**. Em caso de **empate**, os alunos devem aparecer **na mesma ordem relativa em que estavam na entrada** (quem se inscreveu antes vem antes).

Um método de ordenação que sempre preserva a ordem relativa dos empatados se chama **estável**. Insertion Sort e Merge Sort são estáveis; Selection Sort e Quick Sort, na forma clássica, **não são**: uma troca pode levar um aluno para trás de outro com a mesma nota.

Exemplo: com \`nomes = ["Ana", "Bruno", "Caio"]\` e \`notas = [50, 50, 90]\`, a resposta é \`["Caio", "Ana", "Bruno"]\`: Caio tem a maior nota, e Ana vem antes de Bruno porque se inscreveu antes.

Funções prontas de ordenação (\`sort\`, \`sorted\`, \`qsort\`) não são permitidas. Nomes podem se repetir; ordene as **posições** (ou pares nome–nota), nunca só os nomes.

Em C, retorne um vetor de \`char*\` alocado com \`malloc\` (pode apontar para as strings recebidas) e escreva o tamanho em \`*returnSize\`.`,
    constraints: [
      "0 <= n <= 2500",
      "0 <= notas[i] <= 100",
      "nomes[i] tem letras sem acento e espaços.",
      "Proibido: sort, sorted e qsort. A ordenação precisa ser estável."
    ],
    tags: ["Ordenação", "Estabilidade", "Merge Sort"],
    functionSpec: {
      name: "ordenarAlunos",
      params: [{ name: "nomes", type: "string[]" }, { name: "notas", type: "int[]" }],
      returns: "string[]"
    },
    languages: everyLanguage([rules.noBuiltinSort]),
    publicCases: [
      call([["Ana", "Bruno", "Caio", "Duda"], [70, 95, 80, 60]], ["Bruno", "Caio", "Ana", "Duda"]),
      call([["Lia", "Rui", "Teo"], [50, 90, 50]], ["Rui", "Lia", "Teo"])
    ],
    hiddenCases: literal.map(([names, grades]) => call([names, grades], stableSort(names, grades))),
    hints: [
      "Trabalhe com os índices 0..n−1: ordene os índices comparando notas[i], e só no fim troque cada índice pelo nome.",
      "Insertion Sort é estável se você só deslocar elementos com nota estritamente menor que a do elemento sendo inserido.",
      "No Merge Sort, ao intercalar, em caso de empate pegue primeiro o elemento da metade esquerda (use >= na comparação da ordem decrescente)."
    ],
    editorial: `**Ideia.** Ordene os índices com um método estável. No Merge Sort, a estabilidade vem de um detalhe: no empate, o elemento da metade esquerda (que veio antes na entrada) sai primeiro.

\`\`\`js
function ordenarAlunos(nomes, notas) {
  const ordena = (idx) => {
    if (idx.length <= 1) return idx;
    const meio = idx.length >> 1;
    const esq = ordena(idx.slice(0, meio)), dir = ordena(idx.slice(meio));
    const saida = [];
    let i = 0, j = 0;
    while (i < esq.length && j < dir.length) {
      // >= mantém a ordem original nos empates
      if (notas[esq[i]] >= notas[dir[j]]) saida.push(esq[i++]);
      else saida.push(dir[j++]);
    }
    return saida.concat(esq.slice(i), dir.slice(j));
  };
  return ordena(nomes.map((_, i) => i)).map((i) => nomes[i]);
}
\`\`\`

Trocar \`>=\` por \`>\` ainda ordena pelas notas, mas deixa os empates fora da ordem de inscrição.

**Custo.** O(n log n) de tempo e O(n) de memória. Um Insertion Sort estável também passa (O(n²), 6 milhões de passos para n = 2500). Um Selection Sort passa nos exemplos, mas embaralha os empates.`,
    complexity: { time: "O(n log n)", space: "O(n)" }
  });
}

export function buildEdAlgoritmosChallenges(): Challenge[] {
  return [
    potenciaRecursiva(),
    palindromoRecursivo(),
    caminhosNaGrade(),
    fibonacciModular(),
    contarParesIguais(),
    crivoDeEratostenes(),
    maiorLucroNaBolsa(),
    contarInversoes(),
    todasAsPosicoes(),
    buscaBinaria(),
    primeiraEUltimaPosicao(),
    raizQuadradaInteira(),
    capacidadeMinimaDoCaminhao(),
    countingSortDeNotas(),
    ordenacaoEstavelDeAlunos()
  ];
}

