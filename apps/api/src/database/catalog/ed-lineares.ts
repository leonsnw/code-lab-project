import type { Challenge, SourceRule } from "../../domain/types.js";
import {
  byteOrder,
  call,
  createRandom,
  defineChallenge,
  gen,
  language,
  pick,
  randomArray,
  randomInt,
  randomWord,
  rules,
  shuffle,
  type CaseDefinition
} from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Estrutura de Dados", parte linear: ponteiros, listas estáticas,
 * listas encadeadas, pilhas e filas. Os desafios de assunto específico de C
 * (ponteiros, malloc, vetores de tamanho fixo) são só em C, no modo stdio,
 * com regras de código; os demais são no modo função, em JavaScript, Python
 * e C. Soluções e burlas ficam em desafios/<slug>/.
 */

const code = (lang: string, source: string) => ["```" + lang, source.trim(), "```"].join("\n");
const cOnly = (...sourceRules: SourceRule[]) => [language("c", sourceRules)];
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// ---------- Regras de código-fonte ----------
const MALLOC_VECTOR: SourceRule = {
  kind: "require",
  pattern: "\\b(malloc|calloc)\\s*\\(",
  message: "Aloque o vetor com malloc (ou calloc): o tamanho só é conhecido durante a execução."
};
const NO_BRACKETS: SourceRule = {
  kind: "forbid",
  pattern: "\\[",
  message: "Não use colchetes (v[i]): percorra o vetor com aritmética de ponteiros, como *(v + i) ou p++."
};
const USES_FREE: SourceRule = {
  kind: "require",
  pattern: "\\bfree\\s*\\(",
  message: "Libere com free toda a memória que você alocou antes de terminar o programa."
};
const SWAP_SIGNATURE: SourceRule = {
  kind: "require",
  pattern: "\\bvoid\\s+trocar\\s*\\(\\s*int\\s*\\*\\s*\\w+\\s*,\\s*int\\s*\\*\\s*\\w+\\s*\\)\\s*\\{",
  message: "Implemente a função void trocar(int *a, int *b), que recebe os endereços das duas variáveis."
};
const SWAP_CALL: SourceRule = {
  kind: "require",
  pattern: "\\btrocar\\s*\\(\\s*&",
  message: "Chame trocar passando os endereços das variáveis, por exemplo trocar(&a, &b)."
};
const MALLOC_STRING: SourceRule = {
  kind: "require",
  pattern: "\\b(malloc|calloc)\\s*\\(",
  message: "Aloque a string concatenada com malloc, com o tamanho exato: as duas linhas mais 1 byte para o '\\0'."
};
const NO_STRING_COPY: SourceRule = {
  kind: "forbid",
  pattern: "\\b(strcat|strncat|strcpy|strncpy|stpcpy|sprintf|snprintf|memcpy|memmove|strdup|strndup)\\s*\\(",
  message: "Copie os caracteres você mesmo, com um laço: strcpy, strcat, sprintf, memcpy e strdup não são permitidas neste desafio."
};
const POINTER_TO_POINTER: SourceRule = {
  kind: "require",
  pattern: "\\bint\\s*\\*\\s*\\*",
  message: "Guarde a matriz como int ** (um vetor de ponteiros para as linhas), alocando cada linha com malloc."
};
const NO_FIXED_MATRIX: SourceRule = {
  kind: "forbid",
  pattern: "\\b(int|long|short)\\s+\\w+\\s*\\[[^\\]]*\\]\\s*\\[",
  message: "Não declare a matriz com tamanho fixo (int m[L][C]): aloque o vetor de linhas e cada linha dinamicamente."
};
const USES_REALLOC: SourceRule = {
  kind: "require",
  pattern: "\\brealloc\\s*\\(",
  message: "Faça o vetor crescer (e encolher) com realloc."
};
const NO_FIXED_INT_ARRAY: SourceRule = {
  kind: "forbid",
  pattern: "\\b(int|long)\\s+\\w+\\s*\\[",
  message: "Não use vetor de tamanho fixo para os valores: o vetor começa pequeno e muda de tamanho com realloc."
};
const NO_QSORT_ORDERED: SourceRule = {
  kind: "forbid",
  pattern: "\\bqsort\\s*\\(",
  message: "Mantenha a lista ordenada inserindo cada elemento na posição certa: qsort não é permitido."
};
const USES_MODULO: SourceRule = {
  kind: "require",
  pattern: "%",
  message: "Use o operador de resto (%) para dar a volta no vetor, por exemplo fim = (fim + 1) % capacidade."
};
const STATIC_ONLY = rules.staticOnly;
const USES_STRUCT = rules.usesStruct;

// ---------- Ponteiros ----------

/**
 * numerator / denominator com duas casas, como printf("%.2f") imprime.
 * Devolve null quando há empate exato na terceira casa (printf arredonda
 * para o par e JavaScript para cima) ou quando printf imprimiria "-0.00".
 */
function roundedRatio(numerator: number, denominator: number): string | null {
  const scaled = Math.abs(numerator) * 100;
  let quotient = Math.floor(scaled / denominator);
  let rest = scaled - quotient * denominator;
  while (rest < 0) {
    quotient -= 1;
    rest += denominator;
  }
  while (rest >= denominator) {
    quotient += 1;
    rest -= denominator;
  }
  if (rest * 2 === denominator) return null;
  const rounded = rest * 2 > denominator ? quotient + 1 : quotient;
  if (numerator < 0 && rounded === 0) return null;
  return `${numerator < 0 ? "-" : ""}${Math.floor(rounded / 100)}.${String(rounded % 100).padStart(2, "0")}`;
}

function somaComPonteiros(): Challenge {
  const random = createRandom(401000);
  const render = (values: number[]): CaseDefinition => {
    const total = sum(values);
    const mean = roundedRatio(total, values.length);
    if (mean === null) throw new Error("soma-com-ponteiros: media com empate de arredondamento");
    return { input: `${values.length}\n${values.join(" ")}`, output: `Soma: ${total}\nMedia: ${mean}` };
  };
  const randomValues = (length: number, limit: number): number[] => {
    for (;;) {
      const values = randomArray(random, length, -limit, limit);
      if (roundedRatio(sum(values), length) !== null) return values;
    }
  };
  const hidden: number[][] = [
    [42],
    [-17],
    [0, 0, 0, 0],
    [1, 2],
    [-1, -2],
    [1, 1, 2],
    [-1, 0, 0],
    [5, -5, 5, -5, 5],
    [1000000, 1000000, 1000000],
    // A soma passa de 2^31: quem acumula em int estoura.
    Array(20000).fill(1000000),
    Array(20000).fill(-1000000),
    Array.from({ length: 20000 }, (_, index) => (index % 2 ? 999999 : -1000000))
  ];
  while (hidden.length < 18) {
    const small = hidden.length % 2 === 0;
    hidden.push(randomValues(randomInt(random, 2, small ? 60 : 20000), small ? 10 : 1000000));
  }
  return defineChallenge({
    slug: "soma-com-ponteiros",
    title: "Soma e média com ponteiros",
    difficulty: "easy",
    moduleId: moduleId("ponteiros"),
    position: 0,
    description: `Leia um inteiro \`n\` e, em seguida, \`n\` inteiros. Guarde os valores em um vetor **alocado com \`malloc\`** (o tamanho só é conhecido durante a execução) e percorra-o **apenas com aritmética de ponteiros**: em vez de \`v[i]\`, use \`*(v + i)\` ou um ponteiro que anda pelo vetor com \`p++\`.

Imprima duas linhas:

- \`Soma: S\`, a soma de todos os valores;
- \`Media: M\`, a média com **duas casas decimais** (\`printf("%.2f")\`).

Atenção: com até 20000 valores de módulo até 10^6, a soma pode passar de 2 bilhões e não cabe em \`int\`. Use \`long long\` (\`%lld\`) para acumular.`,
    constraints: [
      "Entrada: n (1 <= n <= 20000) e depois n inteiros entre -1000000 e 1000000.",
      "Saída: \"Soma: S\" e \"Media: M\", com a média em duas casas decimais.",
      "Obrigatório: vetor alocado com malloc (ou calloc).",
      "Proibido: colchetes no código, inclusive em declarações como char *argv[]; use int main(void)."
    ],
    tags: ["Ponteiros", "Alocação dinâmica"],
    languages: cOnly(MALLOC_VECTOR, NO_BRACKETS),
    publicCases: [render([3, 8, 4, 10]), render([7, -2, 4])],
    hiddenCases: hidden.map(render),
    hints: [
      "O nome do vetor já é um ponteiro para o primeiro elemento: v + i aponta para o i-ésimo, e *(v + i) é o valor guardado ali.",
      "Um laço como for (int *p = v; p < v + n; p++) visita todos os elementos; scanf(\"%d\", p) lê direto no endereço apontado.",
      "Acumule em long long e divida convertendo para double: (double) soma / n. Não esqueça do free(v) no fim."
    ],
    editorial: `**Ideia.** \`malloc(n * sizeof(int))\` devolve o endereço de um bloco com espaço para \`n\` inteiros. Um ponteiro \`p\` que começa em \`v\` e avança com \`p++\` anda exatamente \`sizeof(int)\` bytes por vez, então visita cada elemento sem precisar de índices.

**Passo a passo.**

1. Leia \`n\` e aloque o vetor.
2. Leia os valores com \`scanf("%d", p)\`: \`p\` já é o endereço onde o valor deve ficar.
3. Percorra de novo somando \`*p\` em um \`long long\`.
4. Imprima a soma e a média (\`(double) soma / n\`) e libere o bloco.

${code("c", String.raw`
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 0;
    int *v = malloc(n * sizeof(int));
    for (int *p = v; p < v + n; p++) scanf("%d", p);

    long long soma = 0;
    for (int *p = v; p < v + n; p++) soma += *p;

    printf("Soma: %lld\nMedia: %.2f\n", soma, (double) soma / n);
    free(v);
    return 0;
}
`)}

**Custo.** Cada elemento é lido e somado uma vez: O(n) de tempo e O(n) de memória para o vetor.`,
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

function trocaPorReferencia(): Challenge {
  const random = createRandom(402000);
  const INT_MAX = 2147483647;
  const INT_MIN = -2147483648;
  const render = (pairs: Array<[number, number]>): CaseDefinition => ({
    input: [String(pairs.length), ...pairs.map(([a, b]) => `${a} ${b}`)].join("\n"),
    output: pairs.map(([a, b]) => `${b} ${a}`).join("\n")
  });
  const hidden: Array<Array<[number, number]>> = [
    [[1, 2]],
    [[5, 5]],
    [[0, -1], [-1, 0]],
    // Troca por soma e subtração (a = a + b; ...) estoura com estes valores.
    [[INT_MAX, INT_MAX]],
    [[INT_MIN, INT_MAX], [INT_MAX, INT_MIN]],
    [[INT_MIN, INT_MIN], [INT_MIN, -1]],
    [[7, 7], [7, 8], [8, 7]]
  ];
  while (hidden.length < 18) {
    const count = randomInt(random, 2, hidden.length > 14 ? 1000 : 50);
    const limit = hidden.length % 2 ? INT_MAX : 1000;
    hidden.push(Array.from({ length: count }, (): [number, number] => [randomInt(random, -limit, limit), randomInt(random, -limit, limit)]));
  }
  return defineChallenge({
    slug: "troca-por-referencia",
    title: "Troca por referência",
    difficulty: "easy",
    moduleId: moduleId("ponteiros"),
    position: 1,
    description: `Em C, os argumentos de uma função são **cópias**: uma função \`trocar(int a, int b)\` troca só as cópias e o chamador não vê nada. Para alterar as variáveis de quem chama, a função precisa receber os **endereços** delas.

Implemente a função

${code("c", "void trocar(int *a, int *b);")}

que troca os valores apontados por \`a\` e \`b\`. No \`main\`, leia \`n\` pares de inteiros; para cada par, chame \`trocar(&x, &y)\` e imprima \`x y\` (já trocados), um par por linha.

Os valores podem ser qualquer \`int\`, inclusive os extremos \`-2147483648\` e \`2147483647\`. Use uma variável auxiliar: truques como \`a = a + b; b = a - b; a = a - b;\` estouram o \`int\`.`,
    constraints: [
      "Entrada: n (1 <= n <= 1000) e depois n linhas com dois inteiros do tipo int.",
      "Saída: n linhas, cada uma com o par trocado, separado por um espaço.",
      "Obrigatório: implementar void trocar(int *a, int *b) e chamá-la com os endereços, como trocar(&x, &y)."
    ],
    tags: ["Ponteiros", "Funções"],
    languages: cOnly(SWAP_SIGNATURE, SWAP_CALL),
    publicCases: [render([[3, 9], [-4, 12]]), render([[100, 0]])],
    hiddenCases: hidden.map(render),
    hints: [
      "Dentro de trocar, a e b são endereços; *a é o valor guardado no primeiro endereço.",
      "Guarde *a em uma variável temporária, copie *b para *a e depois a temporária para *b."
    ],
    editorial: `**Ideia.** A passagem por referência em C é feita com ponteiros: quem chama entrega \`&x\` e \`&y\`, e a função escreve nesses endereços com \`*a = ...\`.

**Passo a passo.** Leia cada par em \`x\` e \`y\`, chame \`trocar(&x, &y)\` e imprima. Dentro de \`trocar\`, use uma variável auxiliar: ela funciona para quaisquer valores, sem risco de estouro.

${code("c", String.raw`
#include <stdio.h>

void trocar(int *a, int *b) {
    int aux = *a;
    *a = *b;
    *b = aux;
}

int main(void) {
    int n, x, y;
    scanf("%d", &n);
    for (int i = 0; i < n; i++) {
        scanf("%d %d", &x, &y);
        trocar(&x, &y);
        printf("%d %d\n", x, y);
    }
    return 0;
}
`)}

**Custo.** O(1) por troca e O(n) no total; memória O(1).`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function concatenarComMalloc(): Challenge {
  const random = createRandom(403000);
  const PRINTABLE = Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index)).join("");
  const render = ([first, second]: [string, string]): CaseDefinition => ({
    input: `${first}\n${second}\n`,
    output: `${first}${second}\nTamanho: ${first.length + second.length}`
  });
  const text = (min: number, max: number, alphabet = PRINTABLE) => randomWord(random, min, max, alphabet);
  const hidden: Array<[string, string]> = [
    ["", "abc"],
    ["abc", ""],
    ["", ""],
    ["a", "b"],
    ["   ", " "],
    // Quem imprime com printf(texto) interpreta os % como formato.
    ["100% de ", "50%d%s%%"],
    ["aspas \" e barra \\ ", "no meio"],
    ["x".repeat(20000), "y".repeat(20000)],
    [text(20000, 20000), text(1, 1)],
    [text(1, 1), text(20000, 20000)]
  ];
  while (hidden.length < 18) hidden.push([text(0, 3000), text(0, 3000)]);
  return defineChallenge({
    slug: "concatenar-com-malloc",
    title: "Concatenar com malloc",
    difficulty: "medium",
    moduleId: moduleId("ponteiros"),
    position: 2,
    description: `Leia duas linhas de texto e construa uma **nova string** com a primeira seguida da segunda. A string resultante deve ser alocada com \`malloc\` usando **exatamente** o espaço necessário: o tamanho das duas linhas mais 1 byte para o terminador \`'\\0'\`.

As funções prontas de cópia (\`strcpy\`, \`strcat\`, \`sprintf\`, \`memcpy\`, \`strdup\` e variantes) são proibidas: copie os caracteres com um laço, de um ponteiro para outro. Ler as linhas com \`fgets\` (ou \`getline\`) e medir com \`strlen\` é permitido.

Imprima duas linhas:

- a string concatenada;
- \`Tamanho: N\`, a quantidade de caracteres dela (sem contar o \`'\\0'\`).

As linhas podem conter espaços, sinais como \`%\` e aspas, e podem estar **vazias**. O \`'\\n'\` do fim de cada linha não faz parte do texto.`,
    constraints: [
      "Entrada: duas linhas, cada uma com 0 a 20000 caracteres ASCII imprimíveis, cada uma terminada por quebra de linha.",
      "Saída: a concatenação e \"Tamanho: N\".",
      "Obrigatório: resultado alocado com malloc e liberado com free.",
      "Proibido: strcpy, strncpy, strcat, strncat, stpcpy, sprintf, snprintf, memcpy, memmove, strdup e strndup."
    ],
    tags: ["Ponteiros", "Strings", "Alocação dinâmica"],
    languages: cOnly(MALLOC_STRING, NO_STRING_COPY, USES_FREE),
    publicCases: [render(["Code", "Lab"]), render(["Estrutura de", " Dados em C"])],
    hiddenCases: hidden.map(render),
    hints: [
      "Leia cada linha em um buffer com espaço sobrando (20002 bytes) e troque o '\\n' final por '\\0'.",
      "O resultado precisa de tamA + tamB + 1 bytes. Copie com dois laços: while (*origem) *destino++ = *origem++; e feche com *destino = '\\0'.",
      "Imprima com printf(\"%s\\n\", resultado) ou puts(resultado): passar o texto como formato (printf(resultado)) quebra quando a linha tem %."
    ],
    editorial: `**Ideia.** Uma string em C é só um vetor de \`char\` terminado por \`'\\0'\`. Para concatenar, meça as duas partes, aloque o bloco exato e copie byte a byte com ponteiros.

**Passo a passo.**

1. Leia as duas linhas com \`fgets\` e remova o \`'\\n'\` (uma linha vazia vira a string \`""\`).
2. Aloque \`tamA + tamB + 1\` bytes.
3. Copie a primeira, depois a segunda, avançando o ponteiro de destino, e escreva o \`'\\0'\`.
4. Imprima com \`%s\`, mostre o tamanho e libere o bloco.

${code("c", String.raw`
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static char a[20002], b[20002];

static void ler_linha(char *buffer) {
    if (!fgets(buffer, 20002, stdin)) buffer[0] = '\0';
    buffer[strcspn(buffer, "\n")] = '\0';
}

int main(void) {
    ler_linha(a);
    ler_linha(b);
    size_t tamanho = strlen(a) + strlen(b);
    char *resultado = malloc(tamanho + 1);
    char *destino = resultado;
    for (const char *p = a; *p; p++) *destino++ = *p;
    for (const char *p = b; *p; p++) *destino++ = *p;
    *destino = '\0';
    printf("%s\nTamanho: %zu\n", resultado, tamanho);
    free(resultado);
    return 0;
}
`)}

**Custo.** O(|a| + |b|) de tempo e de memória.`,
    complexity: { time: "O(|a| + |b|)", space: "O(|a| + |b|)" }
  });
}

function matrizDinamica(): Challenge {
  const random = createRandom(404000);
  const render = (matrix: number[][]): CaseDefinition => {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const transposed = Array.from({ length: cols }, (_, j) => matrix.map((row) => row[j]).join(" "));
    return {
      input: [`${rows} ${cols}`, ...matrix.map((row) => row.join(" "))].join("\n"),
      output: transposed.join("\n")
    };
  };
  const randomMatrix = (rows: number, cols: number, limit = 1000) =>
    Array.from({ length: rows }, () => randomArray(random, cols, -limit, limit));
  const hidden: number[][][] = [
    [[7]],
    [[-1000]],
    [[1, 2, 3, 4, 5]],
    [[1], [2], [3], [4], [5]],
    [[1, 2, 3], [4, 5, 6]],
    [[0, 0], [0, 0]],
    [[1, -2, 3], [-4, 5, -6], [7, -8, 9]],
    randomMatrix(100, 50),
    randomMatrix(50, 100),
    randomMatrix(1, 100),
    randomMatrix(100, 1),
    randomMatrix(70, 70)
  ];
  while (hidden.length < 18) hidden.push(randomMatrix(randomInt(random, 1, 40), randomInt(random, 1, 40), 50));
  return defineChallenge({
    slug: "matriz-dinamica",
    title: "Matriz dinâmica transposta",
    difficulty: "medium",
    moduleId: moduleId("ponteiros"),
    position: 3,
    description: `Leia as dimensões \`l\` (linhas) e \`c\` (colunas) de uma matriz de inteiros e, em seguida, seus \`l · c\` valores, linha por linha. Imprima a **transposta**: \`c\` linhas com \`l\` valores cada, em que a linha \`j\` da saída é a coluna \`j\` da matriz lida.

A matriz deve ser alocada **linha a linha**:

1. um vetor de \`l\` ponteiros (\`int **m = malloc(l * sizeof(int *))\`);
2. cada linha com seu próprio \`malloc(c * sizeof(int))\`.

No fim, libere cada linha e depois o vetor de ponteiros (\`free\` na ordem inversa da alocação). Matrizes de tamanho fixo, como \`int m[100][100]\` ou \`int m[l][c]\`, não são permitidas.`,
    constraints: [
      "Entrada: l e c (1 <= l, c <= 100 e l · c <= 5000) e depois l linhas com c inteiros entre -1000 e 1000.",
      "Saída: c linhas, cada uma com l valores separados por um espaço.",
      "Obrigatório: int ** alocado com malloc, uma alocação por linha e free no fim."
    ],
    tags: ["Ponteiros", "Alocação dinâmica", "Matrizes"],
    languages: cOnly(MALLOC_VECTOR, POINTER_TO_POINTER, NO_FIXED_MATRIX, USES_FREE),
    publicCases: [render([[1, 2, 3], [4, 5, 6]]), render([[9, -1], [0, 4], [8, 8]])],
    hiddenCases: hidden.map(render),
    hints: [
      "m[i] é um int * que aponta para o começo da linha i; m[i][j] funciona igual a uma matriz comum.",
      "Na saída, o laço de fora percorre as colunas (j) e o de dentro as linhas (i): imprima m[i][j].",
      "Para liberar: for (i = 0; i < l; i++) free(m[i]); e só depois free(m). Liberar m primeiro perde os endereços das linhas."
    ],
    editorial: `**Ideia.** Uma matriz dinâmica em C é um vetor de ponteiros, e cada ponteiro aponta para um bloco com uma linha. Isso permite dimensões lidas em tempo de execução e linhas independentes na memória.

**Passo a passo.**

1. Aloque \`l\` ponteiros e, para cada um, uma linha de \`c\` inteiros.
2. Leia os valores em \`m[i][j]\`.
3. Imprima a transposta trocando a ordem dos laços.
4. Libere as linhas e depois o vetor de ponteiros.

${code("c", String.raw`
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int l, c;
    scanf("%d %d", &l, &c);
    int **m = malloc(l * sizeof(int *));
    for (int i = 0; i < l; i++) {
        m[i] = malloc(c * sizeof(int));
        for (int j = 0; j < c; j++) scanf("%d", &m[i][j]);
    }
    for (int j = 0; j < c; j++)
        for (int i = 0; i < l; i++)
            printf(i + 1 < l ? "%d " : "%d\n", m[i][j]);
    for (int i = 0; i < l; i++) free(m[i]);
    free(m);
    return 0;
}
`)}

**Custo.** O(l · c) de tempo e de memória.`,
    complexity: { time: "O(l · c)", space: "O(l · c)" }
  });
}

type VectorCommand = ["push", number] | ["pop"] | ["get", number] | ["size"];

function vetorDinamico(): Challenge {
  const random = createRandom(405000);
  const render = (commands: VectorCommand[]): CaseDefinition => {
    const values: number[] = [];
    let capacity = 1;
    const output: string[] = [];
    for (const command of commands) {
      if (command[0] === "push") {
        if (values.length === capacity) capacity *= 2;
        values.push(command[1]);
      } else if (command[0] === "pop") {
        if (!values.length) {
          output.push("VAZIO");
          continue;
        }
        output.push(String(values.pop()));
        if (capacity > 1 && values.length * 4 <= capacity) capacity /= 2;
      } else if (command[0] === "get") {
        const index = command[1];
        output.push(index >= 0 && index < values.length ? String(values[index]) : "INDICE INVALIDO");
      } else {
        output.push(`Tamanho: ${values.length}, Capacidade: ${capacity}`);
      }
    }
    return { input: [...commands.map((command) => command.join(" ")), "fim"].join("\n"), output: output.join("\n") };
  };
  const value = () => randomInt(random, -1000000, 1000000);
  const pushes = (count: number): VectorCommand[] => Array.from({ length: count }, (): VectorCommand => ["push", value()]);
  const pops = (count: number): VectorCommand[] => Array.from({ length: count }, (): VectorCommand => ["pop"]);
  /** Fases de crescimento e encolhimento, com consultas espalhadas. */
  const phases = (steps: number, maxBurst: number): VectorCommand[] => {
    const commands: VectorCommand[] = [];
    let size = 0;
    for (let step = 0; step < steps; step += 1) {
      const burst = randomInt(random, 1, maxBurst);
      const grow = size === 0 || random() < 0.55;
      for (let index = 0; index < burst; index += 1) {
        if (grow) {
          commands.push(["push", value()]);
          size += 1;
        } else if (size > 0) {
          commands.push(["pop"]);
          size -= 1;
        }
        const roll = random();
        if (roll < 0.04) commands.push(["size"]);
        else if (roll < 0.07) commands.push(["get", randomInt(random, -2, size + 1)]);
      }
      commands.push(["size"]);
    }
    return commands;
  };
  const hidden: VectorCommand[][] = [
    [["size"], ["pop"], ["get", 0]],
    [["push", 1], ["size"], ["push", 2], ["size"], ["push", 3], ["size"], ["push", 4], ["size"], ["push", 5], ["size"]],
    // Encolhimento: 4 -> 2 -> 1.
    [["push", 1], ["push", 2], ["push", 3], ["size"], ["pop"], ["size"], ["pop"], ["size"], ["pop"], ["size"], ["pop"], ["size"]],
    [["push", 10], ["get", -1], ["get", 1], ["get", 0], ["pop"], ["get", 0], ["pop"], ["size"]],
    [...pushes(8), ["size"], ["pop"], ["pop"], ["pop"], ["pop"], ["pop"], ["size"], ["pop"], ["size"], ["get", 1], ["get", 2]],
    [...pushes(1024), ["size"], ["get", 1023], ["push", -1], ["size"], ["get", 1024], ["get", 1025]],
    [...pushes(3000), ["size"], ...pops(2990), ["size"], ["get", 9], ["get", 10]],
    [...pushes(4000), ["size"], ...pops(4000), ["size"], ["pop"], ["size"], ["push", 7], ["size"]],
    [["push", 2147483647], ["push", -2147483648], ["get", 0], ["get", 1], ["size"]]
  ];
  while (hidden.length < 18) hidden.push(phases(randomInt(random, 5, 35), hidden.length < 13 ? 20 : 200));
  return defineChallenge({
    slug: "vetor-dinamico",
    title: "Vetor dinâmico com realloc",
    difficulty: "hard",
    moduleId: moduleId("ponteiros"),
    position: 4,
    isBoss: true,
    description: `Implemente um **vetor dinâmico** de inteiros, a estrutura por trás do \`ArrayList\` do Java e da \`list\` do Python. Ele guarda um ponteiro para o bloco alocado, o **tamanho** (quantos elementos estão em uso) e a **capacidade** (quantos cabem no bloco).

Regras de capacidade (siga à risca, a capacidade aparece na saída):

- o vetor começa vazio, com capacidade **1**;
- \`push x\`: se o vetor estiver cheio (tamanho igual à capacidade), **dobre** a capacidade com \`realloc\`; depois coloque \`x\` no fim;
- \`pop\`: remove e imprime o último elemento, ou imprime \`VAZIO\` se não houver nenhum. Depois de remover, se a capacidade for maior que 1 e \`tamanho * 4 <= capacidade\`, **reduza a capacidade à metade** com \`realloc\`.

Outros comandos, um por linha, até \`fim\`:

- \`get i\`: imprime o elemento da posição \`i\` (começando em 0) ou \`INDICE INVALIDO\` se \`i\` estiver fora de \`0..tamanho-1\` (inclusive negativo);
- \`size\`: imprime \`Tamanho: T, Capacidade: C\`.

\`push\` não imprime nada. Dobrar a capacidade faz cada \`push\` custar O(1) em média (custo amortizado), e esperar o vetor ficar com um quarto de ocupação para encolher evita que uma alternância de \`push\` e \`pop\` na fronteira faça um \`realloc\` a cada comando.`,
    constraints: [
      "Entrada: até 12000 comandos, terminados por \"fim\"; valores do tipo int; em get, -10^6 <= i <= 10^6.",
      "Saída: uma linha para cada pop, get e size.",
      "Obrigatório: realloc para mudar a capacidade; vetores de tamanho fixo para os valores não são permitidos."
    ],
    tags: ["Ponteiros", "Alocação dinâmica", "Custo amortizado"],
    languages: cOnly(USES_REALLOC, NO_FIXED_INT_ARRAY, USES_FREE),
    publicCases: [
      render([["push", 5], ["push", 7], ["push", 9], ["size"], ["get", 1], ["get", 3], ["pop"], ["size"]]),
      render([["pop"], ["size"], ["get", 0], ["push", -3], ["size"]])
    ],
    hiddenCases: hidden.map(render),
    hints: [
      "Guarde três coisas: int *dados, int tamanho e int capacidade. Comece com dados = malloc(sizeof(int)) e capacidade = 1.",
      "realloc pode devolver outro endereço: sempre atribua o retorno (dados = realloc(dados, nova * sizeof(int))).",
      "O encolhimento é testado nos casos ocultos: depois de cada pop bem-sucedido, confira capacidade > 1 && tamanho * 4 <= capacidade."
    ],
    editorial: `**Ideia.** O vetor dinâmico troca de bloco só de vez em quando: dobrar a capacidade quando lota faz a soma de todas as cópias ficar proporcional ao número de \`push\` (1 + 2 + 4 + ... < 2n), então cada operação custa O(1) amortizado. Encolher à metade só com um quarto de ocupação mantém essa garantia também para \`pop\`.

**Passo a passo.**

1. Leia cada comando com \`scanf("%s")\`.
2. \`push\`: se \`tamanho == capacidade\`, dobre com \`realloc\`; grave o valor em \`dados[tamanho++]\`.
3. \`pop\`: se vazio, \`VAZIO\`; senão imprima \`dados[--tamanho]\` e aplique a regra de encolher.
4. \`get\` e \`size\` só consultam; no \`fim\`, \`free(dados)\`.

${code("c", String.raw`
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void) {
    int tamanho = 0, capacidade = 1, x;
    int *dados = malloc(sizeof(int));
    char comando[8];
    while (scanf("%7s", comando) == 1 && strcmp(comando, "fim") != 0) {
        if (!strcmp(comando, "push")) {
            scanf("%d", &x);
            if (tamanho == capacidade) {
                capacidade *= 2;
                dados = realloc(dados, capacidade * sizeof(int));
            }
            dados[tamanho++] = x;
        } else if (!strcmp(comando, "pop")) {
            if (tamanho == 0) { puts("VAZIO"); continue; }
            printf("%d\n", dados[--tamanho]);
            if (capacidade > 1 && tamanho * 4 <= capacidade) {
                capacidade /= 2;
                dados = realloc(dados, capacidade * sizeof(int));
            }
        } else if (!strcmp(comando, "get")) {
            scanf("%d", &x);
            if (x >= 0 && x < tamanho) printf("%d\n", dados[x]);
            else puts("INDICE INVALIDO");
        } else {
            printf("Tamanho: %d, Capacidade: %d\n", tamanho, capacidade);
        }
    }
    free(dados);
    return 0;
}
`)}

**Custo.** O(1) amortizado por comando, O(q) no total para q comandos; memória O(n), nunca mais que 4 vezes o número de elementos em uso.`,
    complexity: { time: "O(1) amortizado por comando", space: "O(n)" }
  });
}

// ---------- Listas estáticas ----------
const STATIC_CAPACITY = 50;

function insercaoOrdenadaEstatica(): Challenge {
  const random = createRandom(406000);
  const render = (values: number[]): CaseDefinition => {
    const list: number[] = [];
    const output: string[] = [];
    for (const value of values) {
      if (list.length === STATIC_CAPACITY) {
        output.push(`LISTA CHEIA: ${value} descartado`);
        continue;
      }
      let index = list.length;
      while (index > 0 && list[index - 1] > value) index -= 1;
      list.splice(index, 0, value);
      output.push(`Inserido ${value} no indice ${index}`);
    }
    output.push(`Lista: ${list.join(" ")}`);
    return { input: `${values.length}\n${values.join(" ")}`, output: output.join("\n") };
  };
  const ascending = Array.from({ length: 50 }, (_, index) => index * 3 - 60);
  const hidden: number[][] = [
    [5],
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1],
    [3, 3, 3],
    [2, 1, 2, 1, 2],
    [-5, 10, -5, 0, 10, -1000000, 1000000],
    ascending,
    [...ascending].reverse(),
    [...ascending, 999, -999],
    Array(60).fill(7),
    shuffle(random, [...ascending, ...ascending.slice(0, 30)])
  ];
  while (hidden.length < 18) {
    const count = randomInt(random, 2, 80);
    const range = hidden.length % 2 ? 5 : 1000000;
    hidden.push(randomArray(random, count, -range, range));
  }
  return defineChallenge({
    slug: "insercao-ordenada-estatica",
    title: "Inserção ordenada em lista estática",
    difficulty: "medium",
    moduleId: moduleId("listas-estaticas"),
    position: 2,
    description: `Mantenha uma **lista estática ordenada** de inteiros: um vetor de capacidade fixa **50** e um contador de quantos elementos estão em uso. Leia \`n\` valores e insira cada um na posição que mantém a lista em ordem crescente, **deslocando uma casa para a direita** os elementos maiores que ele.

Para cada valor lido, imprima uma linha:

- \`Inserido x no indice i\`, em que \`i\` é a posição (a partir de 0) onde \`x\` ficou;
- \`LISTA CHEIA: x descartado\`, se a lista já tiver 50 elementos (o valor é ignorado).

Com valores repetidos, o novo valor entra **depois** dos iguais que já estão na lista. Por exemplo, inserir \`4\` em \`[1, 4, 9]\` resulta em \`[1, 4, 4, 9]\` com o novo \`4\` no índice 2.

No fim, imprima \`Lista: \` seguido dos elementos separados por espaço.`,
    constraints: [
      "Entrada: n (1 <= n <= 80) e depois n inteiros entre -1000000 e 1000000.",
      "Saída: uma linha por valor lido e, por último, a lista final.",
      "Obrigatório: vetor de tamanho fixo, sem malloc/calloc/realloc; qsort não é permitido."
    ],
    tags: ["Listas estáticas", "Vetores", "Insertion Sort"],
    languages: cOnly(STATIC_ONLY, NO_QSORT_ORDERED),
    publicCases: [render([7, 2, 9, 4]), render([10, -3, 5])],
    hiddenCases: hidden.map(render),
    hints: [
      "Comece pelo fim da parte ocupada: enquanto o elemento à esquerda for maior que x, copie-o uma casa para a direita.",
      "Pare quando o elemento à esquerda for menor ou igual a x: é isso que coloca o novo valor depois dos iguais.",
      "Teste a lotação antes de deslocar: com 50 elementos, escrever em v[50] passa do fim do vetor."
    ],
    editorial: `**Ideia.** É o passo interno do Insertion Sort: a parte ocupada do vetor já está ordenada, então basta abrir espaço para o novo valor deslocando os maiores.

**Passo a passo.**

1. Se \`tamanho == 50\`, informe que a lista está cheia.
2. Senão, comece com \`i = tamanho\` e, enquanto \`i > 0 && v[i - 1] > x\`, faça \`v[i] = v[i - 1]\` e \`i--\`.
3. Grave \`v[i] = x\`, incremente o tamanho e informe o índice \`i\`.

${code("c", String.raw`
#include <stdio.h>
#define CAPACIDADE 50

int main(void) {
    int v[CAPACIDADE], tamanho = 0, n, x;
    scanf("%d", &n);
    while (n--) {
        scanf("%d", &x);
        if (tamanho == CAPACIDADE) {
            printf("LISTA CHEIA: %d descartado\n", x);
            continue;
        }
        int i = tamanho;
        while (i > 0 && v[i - 1] > x) {
            v[i] = v[i - 1];
            i--;
        }
        v[i] = x;
        tamanho++;
        printf("Inserido %d no indice %d\n", x, i);
    }
    printf("Lista:");
    for (int i = 0; i < tamanho; i++) printf(" %d", v[i]);
    printf("\n");
    return 0;
}
`)}

**Custo.** Cada inserção desloca até \`tamanho\` elementos: O(n) por inserção e O(n²) no pior caso (entrada decrescente). Memória O(1) além do vetor fixo.`,
    complexity: { time: "O(n) por inserção", space: "O(1) além do vetor" }
  });
}

function remocaoEmListaEstatica(): Challenge {
  const random = createRandom(407000);
  const render = ([initial, removals]: [number[], number[]]): CaseDefinition => {
    const list = [...initial];
    const output: string[] = [];
    for (const value of removals) {
      const index = list.indexOf(value);
      if (index < 0) {
        output.push("NAO ENCONTRADO");
        continue;
      }
      list.splice(index, 1);
      output.push(`Removido ${value} do indice ${index}`);
    }
    output.push(list.length ? `Lista: ${list.join(" ")}` : "Lista vazia");
    return {
      input: [String(initial.length), initial.join(" "), String(removals.length), removals.join(" ")].join("\n"),
      output: output.join("\n")
    };
  };
  const full = Array.from({ length: 100 }, (_, index) => index + 1);
  const hidden: Array<[number[], number[]]> = [
    [[], [1]],
    [[42], [42]],
    [[42], [7, 42, 42]],
    [[1, 2, 3], [1, 2, 3]],
    [[1, 2, 3], [3, 2, 1]],
    [[5, 5, 5, 5], [5]],
    [[5, 1, 5, 2, 5], [5, 5, 9, 5]],
    [[-1, 0, 1], [0, -1, 1, 0]],
    [full, [1, 100, 50, 51, 1000]],
    [full, [...full].reverse()],
    [Array(100).fill(3), Array(30).fill(3)]
  ];
  while (hidden.length < 18) {
    const range = hidden.length % 2 ? 6 : 999;
    const initial = randomArray(random, randomInt(random, 1, 100), -range, range);
    const removals = randomArray(random, randomInt(random, 1, 100), -range, range);
    hidden.push([initial, removals]);
  }
  return defineChallenge({
    slug: "remocao-em-lista-estatica",
    title: "Remoção em lista estática",
    difficulty: "medium",
    moduleId: moduleId("listas-estaticas"),
    position: 3,
    description: `Leia uma lista estática de inteiros (vetor de capacidade fixa **100**, na ordem em que os valores chegam) e depois uma sequência de valores a remover. Para cada valor \`x\`:

- se \`x\` estiver na lista, remova a **primeira ocorrência** (a de menor índice), **deslocando uma casa para a esquerda** todos os elementos depois dela, e imprima \`Removido x do indice i\`, em que \`i\` é o índice (a partir de 0) que ele ocupava;
- senão, imprima \`NAO ENCONTRADO\`.

A ordem dos elementos restantes não muda. No fim, imprima \`Lista: \` seguido dos elementos separados por espaço ou, se não sobrar nenhum, \`Lista vazia\`.

Exemplo: em \`[4, 8, 4]\`, remover \`4\` tira só o primeiro \`4\` e deixa \`[8, 4]\`.`,
    constraints: [
      "Entrada: n (0 <= n <= 100); na linha seguinte, n inteiros; depois m (1 <= m <= 100) e, na linha seguinte, m inteiros a remover.",
      "Valores entre -999 e 999.",
      "Saída: uma linha por remoção e, por último, a lista final ou \"Lista vazia\".",
      "Obrigatório: vetor de tamanho fixo, sem malloc/calloc/realloc."
    ],
    tags: ["Listas estáticas", "Vetores"],
    languages: cOnly(STATIC_ONLY),
    publicCases: [render([[4, 8, 15, 16, 23], [15, 99, 4]]), render([[7, 3], [3, 7, 7]])],
    hiddenCases: hidden.map(render),
    hints: [
      "Primeiro encontre o índice i da primeira ocorrência com uma busca sequencial que para no primeiro acerto.",
      "Depois desloque: for (j = i; j < tamanho - 1; j++) v[j] = v[j + 1]; e diminua o tamanho.",
      "Remova só uma ocorrência por comando: se o valor aparece duas vezes, é preciso pedir a remoção duas vezes."
    ],
    editorial: `**Ideia.** Numa lista estática, os elementos ficam contíguos no começo do vetor. Remover do meio deixa um buraco, que se fecha puxando cada elemento seguinte uma casa para a esquerda.

**Passo a passo.**

1. Busque o primeiro índice \`i\` com \`v[i] == x\`.
2. Se não houver, imprima \`NAO ENCONTRADO\`.
3. Senão, desloque \`v[i + 1 .. tamanho - 1]\` para a esquerda, decremente \`tamanho\` e informe \`i\`.

${code("c", String.raw`
int remover(int v[], int *tamanho, int x) {
    int i = 0;
    while (i < *tamanho && v[i] != x) i++;
    if (i == *tamanho) return -1;
    for (int j = i; j < *tamanho - 1; j++) v[j] = v[j + 1];
    (*tamanho)--;
    return i;
}
`)}

**Custo.** A busca e o deslocamento percorrem no máximo o vetor inteiro: O(n) por remoção. Memória O(1) além do vetor fixo.`,
    complexity: { time: "O(n) por remoção", space: "O(1) além do vetor" }
  });
}

type AgendaCommand = ["inserir", string, string] | ["remover", string] | ["buscar", string] | ["listar"];

function agendaEstatica(): Challenge {
  const random = createRandom(408000);
  const CAPACITY = 20;
  const render = (commands: AgendaCommand[]): CaseDefinition => {
    const contacts: Array<[string, string]> = [];
    const output: string[] = [];
    const find = (name: string) => contacts.findIndex(([other]) => other === name);
    for (const command of commands) {
      if (command[0] === "inserir") {
        const [, name, phone] = command;
        if (find(name) >= 0) output.push("JA CADASTRADO");
        else if (contacts.length === CAPACITY) output.push("LISTA CHEIA");
        else {
          let index = contacts.length;
          while (index > 0 && byteOrder(contacts[index - 1][0], name) > 0) index -= 1;
          contacts.splice(index, 0, [name, phone]);
          output.push("INSERIDO");
        }
      } else if (command[0] === "remover") {
        const index = find(command[1]);
        if (index < 0) output.push("NAO ENCONTRADO");
        else {
          contacts.splice(index, 1);
          output.push("REMOVIDO");
        }
      } else if (command[0] === "buscar") {
        const index = find(command[1]);
        output.push(index < 0 ? "NAO ENCONTRADO" : `${contacts[index][0]}: ${contacts[index][1]}`);
      } else if (!contacts.length) output.push("AGENDA VAZIA");
      else contacts.forEach(([name, phone], index) => output.push(`${index + 1}. ${name} - ${phone}`));
    }
    return { input: [...commands.map((command) => command.join(" ")), "fim"].join("\n"), output: output.join("\n") };
  };
  const NAMES = [
    "Ana", "ana", "Bruno", "bruno", "Carla", "Daniel", "Eduarda", "Fernanda", "Gabriel", "Helena", "Igor", "Joao",
    "joao", "Lucas", "Mariana", "Otavio", "Pedro", "Rafael", "Sofia", "Tiago", "Vitor", "Wagner", "Xavier", "Yara",
    "Zeca", "beatriz", "Beatriz", "carla", "AnaPaula", "Anabela", "Ze", "ZECA"
  ];
  const phone = () => `9${randomInt(random, 1000, 9999)}-${randomInt(random, 1000, 9999)}`;
  const insert = (name: string): AgendaCommand => ["inserir", name, phone()];
  const randomCommands = (count: number, pool: string[]): AgendaCommand[] =>
    Array.from({ length: count }, (): AgendaCommand => {
      const roll = random();
      if (roll < 0.5) return insert(pick(random, pool));
      if (roll < 0.7) return ["remover", pick(random, pool)];
      if (roll < 0.92) return ["buscar", pick(random, pool)];
      return ["listar"];
    });
  const first20 = NAMES.slice(0, 20);
  const hidden: AgendaCommand[][] = [
    [["listar"], ["buscar", "Ana"], ["remover", "Ana"]],
    [insert("Zeca"), insert("Ana"), insert("Mariana"), ["listar"]],
    // Maiúsculas vêm antes das minúsculas (strcmp), e "ana" é diferente de "Ana".
    [insert("bruno"), insert("Carla"), insert("ana"), insert("Ana"), ["listar"], ["buscar", "ANA"], ["buscar", "ana"]],
    [insert("Ana"), insert("Anabela"), insert("AnaPaula"), insert("An"), ["listar"]],
    [insert("Joao"), insert("Joao"), ["remover", "Joao"], ["remover", "Joao"], insert("Joao"), ["listar"]],
    [...first20.map(insert), ["listar"], insert("Zeca"), insert("Ana"), ["remover", "Ana"], insert("Zeca"), ["listar"], ["buscar", "Zeca"]],
    [...shuffle(random, first20).map(insert), insert("Ze"), ["remover", "Tiago"], ["remover", "Tiago"], insert("Ze"), insert("Ze"), ["listar"]],
    [...shuffle(random, NAMES).map(insert), ["listar"], ...shuffle(random, NAMES).map((name): AgendaCommand => ["buscar", name])],
    [...first20.map(insert), ...first20.map((name): AgendaCommand => ["remover", name]), ["listar"], insert("bruno"), ["listar"]]
  ];
  while (hidden.length < 18) hidden.push([...randomCommands(randomInt(random, 20, 400), NAMES), ["listar"]]);
  return defineChallenge({
    slug: "agenda-estatica",
    title: "Agenda de contatos estática",
    difficulty: "hard",
    moduleId: moduleId("listas-estaticas"),
    position: 4,
    isBoss: true,
    description: `Implemente uma agenda de contatos como **lista estática heterogênea**: um vetor de \`struct\` com capacidade fixa **20**, em que cada contato tem \`nome\` e \`telefone\`. A agenda fica sempre **em ordem alfabética de nome**, na ordem de \`strcmp\` (maiúsculas antes de minúsculas; \`"ana"\` e \`"Ana"\` são nomes diferentes).

Comandos, um por linha, até \`fim\`:

- \`inserir NOME TELEFONE\`: se já existe um contato com esse nome, imprima \`JA CADASTRADO\`; senão, se a agenda tem 20 contatos, imprima \`LISTA CHEIA\`; senão, insira na posição certa (deslocando os seguintes) e imprima \`INSERIDO\`;
- \`remover NOME\`: remova o contato (deslocando os seguintes) e imprima \`REMOVIDO\`, ou \`NAO ENCONTRADO\`;
- \`buscar NOME\`: imprima \`NOME: TELEFONE\`, ou \`NAO ENCONTRADO\`;
- \`listar\`: imprima os contatos, um por linha, no formato \`i. NOME - TELEFONE\` com \`i\` começando em 1, ou \`AGENDA VAZIA\`.

Este desafio junta o módulo: vetor de structs, inserção ordenada com deslocamento, remoção com deslocamento e controle de capacidade.`,
    constraints: [
      "Entrada: até 500 comandos, terminados por \"fim\".",
      "NOME: uma palavra só de letras, com até 30 caracteres; TELEFONE: até 15 caracteres, sem espaços.",
      "Saída: uma linha por comando (várias no listar).",
      "Obrigatório: struct em vetor de tamanho fixo, sem malloc/calloc/realloc; qsort não é permitido."
    ],
    tags: ["Listas estáticas", "Struct", "Strings"],
    languages: cOnly(USES_STRUCT, STATIC_ONLY, NO_QSORT_ORDERED),
    publicCases: [
      render([
        insertFixed("Carla", "3333-0000"),
        insertFixed("Ana", "1111-2222"),
        insertFixed("Bruno", "2222-1111"),
        ["listar"],
        ["buscar", "Bruno"],
        ["remover", "Ana"],
        ["listar"]
      ]),
      render([["buscar", "Zeca"], ["remover", "Zeca"], ["listar"], insertFixed("Zeca", "9999-9999"), insertFixed("Zeca", "8888-8888"), ["listar"]])
    ],
    hiddenCases: hidden.map(render),
    hints: [
      "Defina typedef struct { char nome[31]; char telefone[16]; } Contato; e um vetor Contato agenda[20] com um contador.",
      "Inserção ordenada: a partir do fim, enquanto strcmp(agenda[i - 1].nome, nome) > 0, copie agenda[i - 1] para agenda[i]. Structs podem ser copiadas com =.",
      "Confira as condições na ordem do enunciado: nome repetido primeiro, lotação depois. E use strcmp, não strcasecmp: \"ana\" e \"Ana\" são contatos diferentes."
    ],
    editorial: `**Ideia.** Cada contato é um \`struct\`, e a agenda é um vetor desses structs mais um contador. Manter a ordem na inserção (em vez de ordenar a cada \`listar\`) deixa a listagem trivial e a busca pode até ser binária.

**Passo a passo.**

1. \`inserir\`: procure o nome; se existir, \`JA CADASTRADO\`. Se \`total == 20\`, \`LISTA CHEIA\`. Senão desloque para a direita os contatos com nome maior (\`strcmp > 0\`) e grave o novo.
2. \`remover\`: procure o índice e desloque os seguintes para a esquerda.
3. \`buscar\` e \`listar\` só leem o vetor.

${code("c", String.raw`
typedef struct {
    char nome[31];
    char telefone[16];
} Contato;

Contato agenda[20];
int total = 0;

int indice_de(const char *nome) {
    for (int i = 0; i < total; i++)
        if (strcmp(agenda[i].nome, nome) == 0) return i;
    return -1;
}

void inserir(const Contato *novo) {
    int i = total;
    while (i > 0 && strcmp(agenda[i - 1].nome, novo->nome) > 0) {
        agenda[i] = agenda[i - 1];
        i--;
    }
    agenda[i] = *novo;
    total++;
}
`)}

**Custo.** Cada comando percorre no máximo os 20 contatos: O(capacidade) por comando. Memória fixa: 20 structs.`,
    complexity: { time: "O(capacidade) por comando", space: "O(capacidade)" }
  });
}

function insertFixed(name: string, phone: string): AgendaCommand {
  return ["inserir", name, phone];
}

// ---------- Listas encadeadas (modo função) ----------
function removerValorDaLista(): Challenge {
  const random = createRandom(409000);
  const solve = (values: number[], x: number) => values.filter((value) => value !== x);
  const hidden: CaseDefinition[] = [
    call([[], 1], []),
    call([[5], 5], []),
    call([[5], 4], [5]),
    call([[3, 3, 3, 3], 3], []),
    call([[1, 2, 3], 9], [1, 2, 3]),
    // Ocorrências seguidas no meio e no fim: avançar o ponteiro depois de
    // remover pula a segunda.
    call([[1, 4, 4, 2, 4, 4], 4], [1, 2]),
    call([[4, 4, 1, 4, 4, 4, 2, 4], 4], [1, 2]),
    call([[-1, 0, -1, 0], -1], [0, 0]),
    call([[0, 0, 1, 0], 0], [1]),
    call([[2147483647, -2147483648, 2147483647], 2147483647], [-2147483648])
  ];
  const repeated = gen({ $gen: "repeat", n: 100000, value: 7 });
  hidden.push(call([repeated.spec, 7], []));
  const mixed = gen({ $gen: "concat", parts: [{ $gen: "repeat", n: 50000, value: 2 }, { $gen: "ints", n: 10000, min: 0, max: 9, seed: 409001 }, { $gen: "repeat", n: 50000, value: 2 }] });
  hidden.push(call([mixed.spec, 2], solve(mixed.value, 2)));
  const small = gen({ $gen: "ints", n: 20000, min: 0, max: 3, seed: 409002 });
  hidden.push(call([small.spec, 1], solve(small.value, 1)));
  while (hidden.length < 18) {
    const values = randomArray(random, randomInt(random, 1, 300), -3, 3);
    const x = randomInt(random, -3, 3);
    hidden.push(call([values, x], solve(values, x)));
  }
  return defineChallenge({
    slug: "remover-valor-da-lista",
    title: "Remover valor da lista encadeada",
    difficulty: "easy",
    moduleId: moduleId("listas-encadeadas"),
    position: 4,
    description: `Implemente \`removerValor(head, x)\`, que recebe o primeiro nó (\`head\`) de uma lista simplesmente encadeada de inteiros e um inteiro \`x\`, remove **todos** os nós cujo valor é \`x\` e retorna o novo primeiro nó (ou \`null\`/\`None\`/\`NULL\` se a lista ficar vazia).

Cada nó tem os campos \`val\` e \`next\` (em C, \`struct ListNode\` com \`val\` e \`next\`, já definida pelo juiz). A ordem dos nós que ficam não muda.

Exemplo: \`1 → 6 → 2 → 6\` com \`x = 6\` vira \`1 → 2\`. Cuidado com os casos em que o próprio \`head\` precisa ser removido e com várias ocorrências **seguidas**.`,
    constraints: [
      "0 <= número de nós <= 110000.",
      "Os valores e x cabem em int.",
      "Retorne a lista; não crie uma lista nova com os valores copiados (reaproveite os nós)."
    ],
    tags: ["Listas encadeadas", "Ponteiros"],
    functionSpec: { name: "removerValor", params: [{ name: "head", type: "list" }, { name: "x", type: "int" }], returns: "list" },
    publicCases: [call([[1, 6, 2, 3, 6], 6], [1, 2, 3]), call([[7, 7, 1], 7], [1])],
    hiddenCases: hidden,
    hints: [
      "Remover um nó é fazer o anterior pular por cima dele: anterior.next = atual.next.",
      "O head não tem anterior. Um nó sentinela (um nó falso antes do head) faz o primeiro nó ser tratado como qualquer outro.",
      "Depois de remover, não avance o ponteiro anterior: o novo vizinho também pode ter valor x."
    ],
    editorial: `**Ideia.** Com um **nó sentinela** apontando para o \`head\`, todo nó real tem um anterior. Percorra com um ponteiro \`atual\` que olha para \`atual.next\`: se o próximo tem valor \`x\`, pule-o; senão, avance.

**Passo a passo.**

1. Crie \`sentinela\` com \`next = head\` e comece com \`atual = sentinela\`.
2. Enquanto \`atual.next\` existir: se \`atual.next.val === x\`, faça \`atual.next = atual.next.next\` (sem avançar); senão, \`atual = atual.next\`.
3. Retorne \`sentinela.next\`.

${code("js", String.raw`
function removerValor(head, x) {
  const sentinela = new ListNode(0, head);
  let atual = sentinela;
  while (atual.next) {
    if (atual.next.val === x) atual.next = atual.next.next;
    else atual = atual.next;
  }
  return sentinela.next;
}
`)}

Em C, o mesmo pode ser feito com um ponteiro para ponteiro (\`struct ListNode **p = &head\`), que dispensa o sentinela, e cada nó removido pode ser liberado com \`free\`.

**Custo.** Uma passada pela lista: O(n) de tempo e O(1) de memória extra.`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function noDoMeio(): Challenge {
  const random = createRandom(410000);
  const solve = (values: number[]) => values.slice(Math.floor(values.length / 2));
  const lists: number[][] = [
    [1],
    [1, 2],
    [1, 2, 3],
    [1, 2, 3, 4],
    [5, 5, 5, 5, 5, 5],
    [-3, -2, -1, 0, 1, 2, 3],
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  ];
  while (lists.length < 13) lists.push(randomArray(random, randomInt(random, 1, 500), -1000, 1000));
  const hidden = lists.map((values) => call([values], solve(values)));
  for (const [n, seed] of [[40000, 410001], [39999, 410002], [40001, 410003]] as const) {
    const big = gen({ $gen: "ints", n, min: 0, max: 9, seed });
    hidden.push(call([big.spec], solve(big.value)));
  }
  const range = gen({ $gen: "range", n: 9000, start: 1 });
  hidden.push(call([range.spec], solve(range.value)));
  return defineChallenge({
    slug: "no-do-meio",
    title: "Nó do meio",
    difficulty: "medium",
    moduleId: moduleId("listas-encadeadas"),
    position: 5,
    description: `Implemente \`noDoMeio(head)\`, que recebe o primeiro nó de uma lista simplesmente encadeada (com pelo menos um nó) e retorna o **nó do meio**. O juiz imprime a lista a partir do nó retornado.

- Com tamanho ímpar, há um só meio: em \`1 → 2 → 3 → 4 → 5\`, retorne o nó \`3\` (a saída é \`[3, 4, 5]\`).
- Com tamanho par, há dois meios e você deve retornar o **segundo**: em \`1 → 2 → 3 → 4\`, retorne o nó \`3\` (a saída é \`[3, 4]\`).

Dá para contar os nós e depois andar até a metade, mas tente o truque da **lebre e da tartaruga**: dois ponteiros que partem do \`head\`, a tartaruga anda um nó por vez e a lebre dois. Quando a lebre chega ao fim, a tartaruga está exatamente no meio, e tudo em uma única passada.`,
    constraints: ["1 <= número de nós <= 40001.", "Os valores cabem em int.", "Retorne um nó da própria lista; não crie nós novos."],
    tags: ["Listas encadeadas", "Dois ponteiros"],
    functionSpec: { name: "noDoMeio", params: [{ name: "head", type: "list" }], returns: "list" },
    publicCases: [call([[1, 2, 3, 4, 5]], [3, 4, 5]), call([[8, -1, 6]], [-1, 6])],
    hiddenCases: hidden,
    hints: [
      "Se a lista tem n nós, o nó pedido é o de índice ⌊n/2⌋ (começando em 0), tanto para n par quanto ímpar.",
      "Lebre e tartaruga: enquanto lebre e lebre.next existirem, tartaruga = tartaruga.next e lebre = lebre.next.next.",
      "Comece os dois ponteiros no head. Começar a lebre em head.next devolve o primeiro meio nas listas de tamanho par."
    ],
    editorial: `**Ideia.** A lebre anda o dobro da tartaruga. Depois de \`k\` passos, a tartaruga está no nó \`k\` e a lebre no nó \`2k\`. O laço para quando a lebre não consegue dar mais dois passos, isto é, quando \`2k\` chega a \`n - 1\` (ímpar) ou a \`n\` (par, a lebre sai da lista). Nos dois casos, \`k = ⌊n/2⌋\`.

**Passo a passo.**

1. \`tartaruga = lebre = head\`.
2. Enquanto \`lebre\` e \`lebre.next\` não forem nulos, avance a tartaruga uma vez e a lebre duas.
3. Retorne a tartaruga.

${code("python", String.raw`
def noDoMeio(head):
    tartaruga = lebre = head
    while lebre is not None and lebre.next is not None:
        tartaruga = tartaruga.next
        lebre = lebre.next.next
    return tartaruga
`)}

A mesma ideia detecta ciclos (se a lebre alcança a tartaruga, há um ciclo) e encontra o início da segunda metade para inverter ou comparar listas.

**Custo.** O(n) de tempo, em uma só passada, e O(1) de memória.`,
    complexity: { time: "O(n)", space: "O(1)" }
  });
}

function somarNumerosEmListas(): Challenge {
  const random = createRandom(411000);
  const add = (first: number[], second: number[]) => {
    const result: number[] = [];
    let carry = 0;
    for (let index = 0; index < Math.max(first.length, second.length) || carry; index += 1) {
      const total = (first[index] ?? 0) + (second[index] ?? 0) + carry;
      result.push(total % 10);
      carry = total >= 10 ? 1 : 0;
    }
    return result;
  };
  /** Número com `length` dígitos, em ordem inversa, sem zeros à esquerda. */
  const number = (length: number, digit = () => randomInt(random, 0, 9)) => {
    const digits = Array.from({ length }, digit);
    if (length > 1 || digits[0] !== 0) digits[length - 1] = randomInt(random, 1, 9);
    return digits;
  };
  const nines = (length: number) => Array(length).fill(9);
  const pairs: Array<[number[], number[]]> = [
    [[0], [0]],
    [[0], [7, 3]],
    [[5], [5]],
    [[9], [9, 9, 9]],
    [nines(1000), [1]],
    [nines(1000), nines(1000)],
    [[1, ...Array(998).fill(0), 1], [9, ...Array(998).fill(9), 8]],
    // 2^53 + 1: um número de ponto flutuante já não representa este valor.
    [[..."9007199254740993"].reverse().map(Number), [0, 1]],
    [[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1], [9, 8, 7, 6, 5, 4, 3, 2, 1]],
    [number(1000), number(999)],
    [number(1), number(1000)],
    [number(500, () => 9), number(500, () => 0)]
  ];
  while (pairs.length < 18) pairs.push([number(randomInt(random, 1, 1000)), number(randomInt(random, 1, 1000))]);
  return defineChallenge({
    slug: "somar-numeros-em-listas",
    title: "Somar números guardados em listas",
    difficulty: "hard",
    moduleId: moduleId("listas-encadeadas"),
    position: 6,
    isBoss: true,
    description: `Dois números inteiros não negativos estão guardados em listas encadeadas, **um dígito por nó**, em **ordem inversa**: o primeiro nó é o dígito das unidades. Por exemplo, \`5 → 1 → 3\` representa 315.

Implemente \`somarListas(l1, l2)\`, que retorna uma **nova lista**, no mesmo formato, com a soma dos dois números. Para \`5 → 1 → 3\` (315) e \`8 → 2\` (28), a resposta é \`3 → 4 → 3\` (343).

Os números podem ter **até 1000 dígitos**, bem além de qualquer tipo inteiro ou de ponto flutuante: converter para número e somar perde precisão. Some dígito a dígito, como na escola, carregando o "vai um". As listas podem ter tamanhos diferentes, e a soma pode ter um dígito a mais que a maior delas (\`9 → 9\` + \`3\` = \`2 → 0 → 1\`).

Nenhum número tem zeros à esquerda, exceto o próprio zero, representado por um único nó \`0\`.`,
    constraints: [
      "1 <= número de nós de cada lista <= 1000.",
      "Cada nó guarda um dígito de 0 a 9; o último nó só é 0 se a lista for exatamente [0].",
      "Em C, aloque os nós da resposta com malloc (struct ListNode já é definida pelo juiz)."
    ],
    tags: ["Listas encadeadas", "Aritmética"],
    functionSpec: {
      name: "somarListas",
      params: [{ name: "l1", type: "list" }, { name: "l2", type: "list" }],
      returns: "list"
    },
    publicCases: [call([[5, 1, 3], [8, 2]], [3, 4, 3]), call([[9, 9], [3]], [2, 0, 1])],
    hiddenCases: pairs.map(([first, second]) => call([first, second], add(first, second))),
    hints: [
      "Como a lista começa pelas unidades, a ordem de percurso é exatamente a ordem da soma com vai um.",
      "Continue o laço enquanto houver nó em l1, nó em l2 ou vai um pendente; trate a lista que acabou como dígito 0.",
      "Use um nó sentinela e um ponteiro para o fim da lista resposta: cada novo dígito entra em O(1) no fim."
    ],
    editorial: `**Ideia.** É a soma da escola: dígito a dígito, das unidades para as casas maiores, carregando o vai um. Como as listas já estão em ordem inversa, basta percorrê-las juntas e ir anexando os dígitos da resposta no fim de uma lista nova.

**Passo a passo.**

1. Crie um sentinela e um ponteiro \`fim\` para ele; \`vaiUm = 0\`.
2. Enquanto \`l1\`, \`l2\` ou \`vaiUm\` existirem: \`total = (l1?.val ?? 0) + (l2?.val ?? 0) + vaiUm\`; anexe o nó \`total % 10\`; \`vaiUm = total >= 10 ? 1 : 0\`; avance as listas que ainda têm nós.
3. Retorne \`sentinela.next\`.

${code("c", String.raw`
struct ListNode* somarListas(struct ListNode* l1, struct ListNode* l2) {
    struct ListNode sentinela = {0, NULL};
    struct ListNode *fim = &sentinela;
    int vaiUm = 0;
    while (l1 || l2 || vaiUm) {
        int total = vaiUm;
        if (l1) { total += l1->val; l1 = l1->next; }
        if (l2) { total += l2->val; l2 = l2->next; }
        fim->next = malloc(sizeof(struct ListNode));
        fim = fim->next;
        fim->val = total % 10;
        fim->next = NULL;
        vaiUm = total / 10;
    }
    return sentinela.next;
}
`)}

**Custo.** O(max(m, n)) de tempo e O(max(m, n)) de memória para a lista resposta.`,
    complexity: { time: "O(max(m, n))", space: "O(max(m, n))" }
  });
}

// ---------- Pilhas (modo função) ----------
function avaliarPosfixa(): Challenge {
  const random = createRandom(412000);
  const LIMIT = 10n ** 15n;
  const evaluate = (tokens: string[]): number => {
    const stack: bigint[] = [];
    for (const token of tokens) {
      if (token.length === 1 && "+-*/".includes(token)) {
        const b = stack.pop()!;
        const a = stack.pop()!;
        stack.push(token === "+" ? a + b : token === "-" ? a - b : token === "*" ? a * b : a / b);
      } else stack.push(BigInt(token));
    }
    return Number(stack[0]);
  };
  /** Expressão pós-fixa aleatória, com resultados intermediários limitados e sem divisão por zero. */
  const randomExpression = (operands: number, range: number): string[] => {
    const tokens: string[] = [];
    const stack: bigint[] = [];
    let pushed = 0;
    while (pushed < operands || stack.length > 1) {
      if (pushed < operands && (stack.length < 2 || random() < 0.5)) {
        const value = randomInt(random, -range, range);
        tokens.push(String(value));
        stack.push(BigInt(value));
        pushed += 1;
        continue;
      }
      const b = stack.pop()!;
      const a = stack.pop()!;
      const abs = (value: bigint) => (value < 0n ? -value : value);
      const options: Array<[string, bigint]> = [];
      if (abs(a + b) <= LIMIT) options.push(["+", a + b]);
      if (abs(a - b) <= LIMIT) options.push(["-", a - b]);
      if (abs(a * b) <= LIMIT) options.push(["*", a * b]);
      if (b !== 0n) options.push(["/", a / b]);
      const [operator, result] = pick(random, options);
      tokens.push(operator);
      stack.push(result);
    }
    return tokens;
  };
  const expressions: string[][] = [
    ["42"],
    ["-7"],
    ["0"],
    // Divisão truncada para zero: -7 / 2 = -3 (e não -4).
    ["-7", "2", "/"],
    ["7", "-2", "/"],
    ["-7", "-2", "/"],
    ["1", "3", "/"],
    ["-1", "3", "/"],
    ["5", "1", "2", "+", "4", "*", "+", "3", "-"],
    ["2", "3", "4", "5", "-", "-", "-"],
    ["1000000", "1000000", "*", "1000", "*"],
    ["-1000000", "1000000", "*", "1000", "*", "7", "/"],
    randomExpression(40, 9),
    randomExpression(200, 100),
    randomExpression(1000, 20)
  ];
  while (expressions.length < 17) expressions.push(randomExpression(randomInt(random, 2, 60), 50));
  expressions.push(randomExpression(8000, 100));
  return defineChallenge({
    slug: "avaliar-posfixa",
    title: "Avaliar expressão pós-fixa",
    difficulty: "medium",
    moduleId: moduleId("pilhas"),
    position: 2,
    description: `Na **notação pós-fixa** (ou polonesa reversa), o operador vem depois dos operandos: \`3 4 +\` significa \`3 + 4\`, e \`5 1 2 + *\` significa \`5 * (1 + 2)\`. Ela dispensa parênteses e é avaliada com uma pilha.

Implemente \`avaliarPosfixa(tokens)\`, que recebe a expressão já separada em tokens (um vetor de strings) e retorna o seu valor. Cada token é um inteiro (possivelmente negativo, como \`"-7"\`) ou um dos operadores \`"+"\`, \`"-"\`, \`"*"\` e \`"/"\`.

A divisão é **inteira e truncada em direção ao zero**: \`7 / 2 = 3\` e \`-7 / 2 = -3\`. Em JavaScript e Python, a divisão comum não faz isso sozinha (\`Math.floor\` e \`//\` arredondam para baixo).

A expressão é sempre válida, nunca divide por zero, e todos os resultados intermediários têm valor absoluto até 10^15.`,
    constraints: [
      "1 <= número de tokens <= 24000.",
      "Operandos entre -1000000 e 1000000; resultados intermediários com valor absoluto até 10^15.",
      "Retorne um inteiro de 64 bits (em C, long long)."
    ],
    tags: ["Pilhas", "Expressões"],
    functionSpec: { name: "avaliarPosfixa", params: [{ name: "tokens", type: "string[]" }], returns: "long" },
    publicCases: [
      call([["10", "2", "8", "*", "+", "3", "-"]], 23),
      call([["100", "7", "/", "5", "+"]], 19)
    ],
    hiddenCases: expressions.map((tokens) => call([tokens], evaluate(tokens))),
    hints: [
      "Percorra os tokens: número vai para a pilha; operador desempilha dois valores, calcula e empilha o resultado.",
      "A ordem importa: o primeiro valor desempilhado é o operando da direita (b) e o segundo é o da esquerda (a), então calcule a - b e a / b.",
      "\"-7\" é número, \"-\" é operador: um token é operador só se tiver um único caractere. Para truncar em JavaScript, use Math.trunc; em Python, int(a / b) perde precisão com números grandes, então calcule abs(a) // abs(b) e ajuste o sinal."
    ],
    editorial: `**Ideia.** A pilha guarda os valores já calculados que ainda esperam um operador. Cada operador consome os dois do topo e devolve um. Ao final, sobra exatamente um valor: a resposta.

**Passo a passo.**

1. Para cada token: se for operador, desempilhe \`b\` e depois \`a\`, calcule \`a op b\` e empilhe.
2. Senão, converta para inteiro e empilhe.
3. Retorne o único valor da pilha.

${code("python", String.raw`
def avaliarPosfixa(tokens):
    pilha = []
    for token in tokens:
        if token in ("+", "-", "*", "/"):
            b = pilha.pop()
            a = pilha.pop()
            if token == "+":
                pilha.append(a + b)
            elif token == "-":
                pilha.append(a - b)
            elif token == "*":
                pilha.append(a * b)
            else:
                q = abs(a) // abs(b)
                pilha.append(q if (a < 0) == (b < 0) else -q)
        else:
            pilha.append(int(token))
    return pilha[0]
`)}

Em C, a divisão de \`long long\` já trunca em direção ao zero. Em JavaScript, \`Math.trunc(a / b)\` basta para valores pequenos; com valores perto de 10^15 o quociente em ponto flutuante pode arredondar, e \`(a - a % b) / b\` é exato.

**Custo.** O(n) de tempo e O(n) de memória para a pilha.`,
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

function proximoMaiorElemento(): Challenge {
  const random = createRandom(413000);
  const solve = (values: number[]) => {
    // A soma dos próximos maiores, sem montar o vetor: quem sai da pilha soma o valor que o tirou.
    const stack = new Int32Array(values.length);
    let top = 0;
    let total = 0;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      while (top > 0 && values[stack[top - 1]] < value) {
        top -= 1;
        total += value;
      }
      stack[top++] = index;
    }
    return total - top;
  };
  const hidden: CaseDefinition[] = [
    [7],
    [1, 2],
    [2, 1],
    [3, 3, 3],
    [1, 3, 2, 4],
    [5, 4, 3, 2, 1, 6],
    [-5, -3, -10, -1],
    [2, 2, 1, 3],
    [1000000000, -1000000000, 999999999]
  ].map((values) => call([values], solve(values)));
  for (let index = 0; index < 3; index += 1) {
    const values = randomArray(random, randomInt(random, 10, 2000), -1000, 1000);
    hidden.push(call([values], solve(values)));
  }
  const big = [
    // Decrescente e constante: a busca ingênua varre o resto do vetor para cada posição.
    gen({ $gen: "range", n: 200000, start: 1000000000, step: -9999 }),
    gen({ $gen: "repeat", n: 200000, value: 5 }),
    gen({ $gen: "perm", n: 200000, seed: 413003 })
  ];
  for (const values of big) hidden.push(call([values.spec], solve(values.value)));
  return defineChallenge({
    slug: "proximo-maior-elemento",
    title: "Próximo maior elemento",
    difficulty: "medium",
    moduleId: moduleId("pilhas"),
    position: 3,
    description: `O **próximo maior elemento** da posição \`i\` de um vetor é o primeiro valor à direita de \`i\` que é **estritamente maior** que \`nums[i]\`. Se não existir, considere \`-1\`.

Em \`[4, 1, 3, 5, 2]\`, os próximos maiores são \`[5, 3, 5, -1, -1]\`: depois do \`4\` o primeiro maior é o \`5\`; depois do \`1\`, o \`3\`; e assim por diante.

Implemente \`somaProximosMaiores(nums)\`, que retorna a **soma** dos próximos maiores de todas as posições (contando \`-1\` para as posições sem próximo maior). No exemplo, \`5 + 3 + 5 - 1 - 1 = 11\`.

Os vetores chegam a 200000 elementos: comparar cada posição com todas as seguintes custa O(n²) e estoura o tempo. A solução esperada usa uma **pilha monotônica** e roda em O(n).`,
    constraints: [
      "1 <= n <= 200000.",
      "-10^9 <= nums[i] <= 10^9.",
      "A soma cabe em 64 bits (em C, retorne long long)."
    ],
    tags: ["Pilhas", "Pilha monotônica"],
    functionSpec: { name: "somaProximosMaiores", params: [{ name: "nums", type: "int[]" }], returns: "long" },
    publicCases: [call([[4, 1, 3, 5, 2]], solve([4, 1, 3, 5, 2])), call([[2, 7, 1, 8]], solve([2, 7, 1, 8]))],
    hiddenCases: hidden,
    hints: [
      "Um elemento só descobre seu próximo maior quando aparece alguém maior à direita. Guarde numa pilha os índices que ainda esperam resposta.",
      "Ao ler nums[i], desempilhe todos os índices cujo valor é menor que nums[i]: o próximo maior deles é nums[i]. Depois empilhe i.",
      "Os valores na pilha ficam sempre em ordem não crescente do fundo ao topo. Quem sobrar na pilha no fim tem próximo maior -1. Iguais não contam como maiores."
    ],
    editorial: `**Ideia.** Percorra da esquerda para a direita mantendo uma pilha com os índices que ainda não encontraram um maior. Como cada novo valor resolve de uma vez todos os menores no topo, a pilha fica em ordem não crescente (é uma **pilha monotônica**).

**Passo a passo.**

1. Comece com todas as respostas valendo \`-1\` e a pilha vazia.
2. Para cada \`i\`: enquanto o topo tiver valor menor que \`nums[i]\`, desempilhe-o e registre \`nums[i]\` como resposta dele. Empilhe \`i\`.
3. Some as respostas.

${code("js", String.raw`
function somaProximosMaiores(nums) {
  const resposta = new Array(nums.length).fill(-1);
  const pilha = [];
  for (let i = 0; i < nums.length; i++) {
    while (pilha.length && nums[pilha[pilha.length - 1]] < nums[i]) {
      resposta[pilha.pop()] = nums[i];
    }
    pilha.push(i);
  }
  return resposta.reduce((total, valor) => total + valor, 0);
}
`)}

**Custo.** Cada índice entra e sai da pilha no máximo uma vez: O(n) de tempo no total (apesar do \`while\` dentro do \`for\`) e O(n) de memória.

**Sobre o formato.** A resposta é a soma, e não o vetor de próximos maiores, para que o retorno de um vetor de 200000 posições caiba no limite de saída do juiz; os casos pequenos e os casos com muitos iguais conferem cada detalhe da definição.`,
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

type ExpressionTree = string | { operator: string; left: ExpressionTree; right: ExpressionTree };

function infixaParaPosfixa(): Challenge {
  const random = createRandom(414000);
  const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };
  const precedence = (tree: ExpressionTree) => (typeof tree === "string" ? 4 : PRECEDENCE[tree.operator]);
  const letter = () => String.fromCharCode(97 + randomInt(random, 0, 25));
  const build = (leaves: number, operators: string): ExpressionTree => {
    if (leaves === 1) return letter();
    const split = randomInt(random, 1, leaves - 1);
    return { operator: pick(random, [...operators]), left: build(split, operators), right: build(leaves - split, operators) };
  };
  const postfix = (tree: ExpressionTree): string =>
    typeof tree === "string" ? tree : postfix(tree.left) + postfix(tree.right) + tree.operator;
  /** Infixa com os parênteses necessários e, com probabilidade `extra`, parênteses redundantes. */
  const infix = (tree: ExpressionTree, extra: number): string => {
    const wrap = (text: string, needed: boolean) => (needed || random() < extra ? `(${text})` : text);
    if (typeof tree === "string") return wrap(tree, false);
    const own = PRECEDENCE[tree.operator];
    const rightAssociative = tree.operator === "^";
    const left = wrap(infix(tree.left, extra), precedence(tree.left) < own || (rightAssociative && precedence(tree.left) === own));
    const right = wrap(infix(tree.right, extra), precedence(tree.right) < own || (!rightAssociative && precedence(tree.right) === own));
    return `${left}${tree.operator}${right}`;
  };
  const fromTree = (tree: ExpressionTree, extra: number) => call([infix(tree, extra)], postfix(tree));
  const chain = (operator: string, count: number) => {
    const letters = Array.from({ length: count }, letter);
    return { expression: letters.join(operator), letters: letters.join("") };
  };
  const powers = chain("^", 5000);
  const minus = chain("-", 5000);
  const hidden: CaseDefinition[] = [
    call(["a"], "a"),
    call(["(a)"], "a"),
    call(["a-b-c"], "ab-c-"),
    call(["a-(b-c)"], "abc--"),
    call(["a/b*c"], "ab/c*"),
    call(["a^b^c"], "abc^^"),
    call(["(a^b)^c"], "ab^c^"),
    call(["a+b*c^d^e/f-g"], "abcde^^*f/+g-"),
    call(["((((((x+y))))))*z"], "xy+z*"),
    call([`${"(".repeat(3000)}q${")".repeat(3000)}`], "q"),
    call([powers.expression], powers.letters + "^".repeat(4999)),
    call([minus.expression], minus.letters.slice(0, 2) + "-" + [...minus.letters.slice(2)].map((item) => `${item}-`).join("")),
    fromTree(build(20, "^"), 0),
    fromTree(build(30, "+-*/^"), 0.2),
    fromTree(build(200, "+-*/^"), 0),
    fromTree(build(200, "*/^"), 0.1),
    fromTree(build(10000, "+-*/^"), 0.05)
  ];
  while (hidden.length < 19) hidden.push(fromTree(build(randomInt(random, 2, 60), "+-*/^"), 0.15));
  return defineChallenge({
    slug: "infixa-para-posfixa",
    title: "Converter infixa para pós-fixa",
    difficulty: "hard",
    moduleId: moduleId("pilhas"),
    position: 4,
    isBoss: true,
    description: `Implemente \`infixaParaPosfixa(expr)\`, que converte uma expressão na notação **infixa** (a usual, com o operador entre os operandos) para a notação **pós-fixa** (operador depois dos operandos).

A expressão tem operandos de **uma letra minúscula**, os operadores \`+ - * / ^\` e parênteses, sem espaços. As regras são as da matemática:

- \`^\` (potência) tem a maior precedência, depois \`*\` e \`/\`, e por último \`+\` e \`-\`;
- \`+ - * /\` são associativos **à esquerda**: \`a-b-c\` é \`(a-b)-c\`, que vira \`ab-c-\`;
- \`^\` é associativo **à direita**: \`a^b^c\` é \`a^(b^c)\`, que vira \`abc^^\`;
- parênteses mudam a ordem: \`(a+b)*c\` vira \`ab+c*\`, enquanto \`a+b*c\` vira \`abc*+\`.

Retorne a string pós-fixa sem espaços. A expressão é sempre válida e pode ter até 60000 caracteres, com parênteses aninhados em muitos níveis. Este desafio junta o módulo: é o algoritmo *shunting-yard* de Dijkstra, com uma pilha de operadores.`,
    constraints: [
      "1 <= |expr| <= 60000.",
      "Operandos: letras de a a z; operadores: + - * / ^; parênteses sempre balanceados.",
      "Retorne só letras e operadores, sem espaços nem parênteses."
    ],
    tags: ["Pilhas", "Expressões", "Shunting-yard"],
    functionSpec: { name: "infixaParaPosfixa", params: [{ name: "expr", type: "string" }], returns: "string" },
    publicCases: [call(["a+b*c"], "abc*+"), call(["(a+b)*(c-d)/e"], "ab+cd-*e/")],
    hiddenCases: hidden,
    hints: [
      "Letras vão direto para a saída. Operadores esperam numa pilha até que se saiba que nenhum operador mais forte vem depois deles.",
      "Ao ler um operador, desempilhe para a saída os operadores do topo que devem ser aplicados antes dele: os de precedência maior e, se o novo for associativo à esquerda, também os de precedência igual. '(' vai para a pilha e ')' desempilha até a '(' correspondente.",
      "A diferença do ^ está no empate: com o novo operador ^ e um ^ no topo, não desempilhe. No fim, esvazie a pilha na saída."
    ],
    editorial: `**Ideia.** No *shunting-yard*, a pilha guarda operadores ainda não emitidos, em ordem de precedência crescente do fundo ao topo (entre parênteses). Um operador só é emitido quando aparece algo que obriga a aplicá-lo, como um operador mais fraco, um \`)\` ou o fim da expressão.

**Passo a passo.**

1. Letra: vai para a saída.
2. \`(\`: empilhe.
3. \`)\`: desempilhe para a saída até encontrar a \`(\`, que é descartada.
4. Operador \`o\`: enquanto o topo for um operador \`t\` com \`prec(t) > prec(o)\`, ou \`prec(t) == prec(o)\` e \`o\` associativo à esquerda, emita \`t\`. Depois empilhe \`o\`.
5. No fim, emita tudo o que sobrou na pilha.

${code("js", String.raw`
function infixaParaPosfixa(expr) {
  const prec = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };
  const saida = [];
  const pilha = [];
  for (const c of expr) {
    if (c === "(") pilha.push(c);
    else if (c === ")") {
      while (pilha[pilha.length - 1] !== "(") saida.push(pilha.pop());
      pilha.pop();
    } else if (c in prec) {
      while (pilha.length) {
        const topo = pilha[pilha.length - 1];
        if (topo === "(") break;
        if (prec[topo] > prec[c] || (prec[topo] === prec[c] && c !== "^")) saida.push(pilha.pop());
        else break;
      }
      pilha.push(c);
    } else saida.push(c);
  }
  while (pilha.length) saida.push(pilha.pop());
  return saida.join("");
}
`)}

**Custo.** Cada caractere entra e sai da pilha no máximo uma vez: O(n) de tempo e O(n) de memória. Sem recursão, os 3000 níveis de parênteses não são problema.`,
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

// ---------- Filas ----------
const QUEUE_NAMES = [
  "Ana", "Bruno", "Carla", "Daniel", "Eduarda", "Fabio", "Gabriela", "Heitor", "Iris", "Joao", "Karina", "Lucas",
  "Ana Paula", "Maria Clara", "Joao Pedro", "Luiz Carlos", "Vitoria", "Zeca", "Otavio", "Pietra"
];

function filaDeAtendimento(): Challenge {
  const random = createRandom(415000);
  const solve = (ops: string[]) => {
    const queue: string[] = [];
    let head = 0;
    const served: string[] = [];
    for (const op of ops) {
      if (op === "atende") served.push(head < queue.length ? queue[head++] : "FILA VAZIA");
      else queue.push(op.slice("chega ".length));
    }
    return served;
  };
  const randomOps = (count: number, arrival: number, pool: string[]) =>
    Array.from({ length: count }, () => (random() < arrival ? `chega ${pick(random, pool)}` : "atende"));
  const opsList: string[][] = [
    ["atende"],
    ["chega Ana", "atende", "atende"],
    ["chega Ana Paula", "chega Joao Pedro", "atende", "atende"],
    ["chega Zeca", "chega Zeca", "atende", "chega Iris", "atende", "atende", "atende"],
    ["atende", "atende", "chega Lucas", "atende"],
    ["chega Maria Clara de Souza Lima", "atende"],
    [...Array.from({ length: 1000 }, (_, index) => `chega Pessoa ${index + 1}`), ...Array(1001).fill("atende")],
    randomOps(8000, 0.7, QUEUE_NAMES)
  ];
  while (opsList.length < 18) {
    const pool = opsList.length % 2 ? QUEUE_NAMES.slice(0, 12) : QUEUE_NAMES;
    opsList.push(randomOps(randomInt(random, 5, 400), 0.4 + random() * 0.3, pool));
  }
  return defineChallenge({
    slug: "fila-de-atendimento",
    title: "Fila de atendimento",
    difficulty: "easy",
    moduleId: moduleId("filas"),
    position: 0,
    description: `Uma agência atende as pessoas **por ordem de chegada**: quem chega primeiro é atendido primeiro (FIFO, *first in, first out*). Implemente \`atenderFila(ops)\`, que recebe a sequência de eventos do dia e retorna, em ordem, o resultado de cada atendimento.

Cada evento é uma string:

- \`"chega NOME"\`: a pessoa \`NOME\` entra no fim da fila. O nome é **tudo** o que vem depois de \`"chega "\` e pode ter espaços, como \`"chega Ana Paula"\`;
- \`"atende"\`: a pessoa da frente sai da fila e seu nome entra na resposta. Se a fila estiver vazia, a resposta recebe \`"FILA VAZIA"\`.

A resposta tem exatamente um item por \`"atende"\`. Nomes podem se repetir: são pessoas diferentes com o mesmo nome.`,
    constraints: [
      "1 <= número de eventos <= 8000.",
      "Nomes com 1 a 40 caracteres (letras, dígitos e espaços).",
      "Retorne um vetor de strings."
    ],
    tags: ["Filas", "Strings"],
    functionSpec: { name: "atenderFila", params: [{ name: "ops", type: "string[]" }], returns: "string[]" },
    publicCases: [
      call([["chega Ana", "chega Bruno", "atende", "chega Carla", "atende", "atende", "atende"]], ["Ana", "Bruno", "Carla", "FILA VAZIA"]),
      call([["chega Joao", "atende", "chega Iris", "chega Zeca", "atende"]], ["Joao", "Iris"])
    ],
    hiddenCases: opsList.map((ops) => call([ops], solve(ops))),
    hints: [
      "Uma fila precisa de duas pontas: entra pelo fim e sai pela frente.",
      "Em vez de remover do começo de um vetor (o que desloca todos os outros), guarde um índice da frente que só avança.",
      "Para pegar o nome, corte o prefixo \"chega \" (6 caracteres): dividir por espaço perde os sobrenomes."
    ],
    editorial: `**Ideia.** Um vetor com um índice \`frente\` já é uma fila: \`push\` coloca no fim e atender é ler \`fila[frente]\` e avançar \`frente\`. Nada precisa ser deslocado.

**Passo a passo.**

1. Para \`"chega NOME"\`, guarde \`op.slice(6)\` no fim do vetor.
2. Para \`"atende"\`, se \`frente < fila.length\`, registre \`fila[frente]\` e avance; senão, registre \`"FILA VAZIA"\`.

${code("js", String.raw`
function atenderFila(ops) {
  const fila = [];
  let frente = 0;
  const atendidos = [];
  for (const op of ops) {
    if (op === "atende") atendidos.push(frente < fila.length ? fila[frente++] : "FILA VAZIA");
    else fila.push(op.slice("chega ".length));
  }
  return atendidos;
}
`)}

Em Python, \`collections.deque\` com \`append\` e \`popleft\` faz o mesmo em O(1); \`list.pop(0)\` funciona, mas desloca a lista inteira a cada atendimento.

**Custo.** O(1) por evento, O(n) no total; memória O(n).`,
    complexity: { time: "O(n)", space: "O(n)" }
  });
}

type CircularCommand = ["enfileirar", number] | ["desenfileirar"] | ["frente"] | ["imprimir"];

function filaCircularEmVetor(): Challenge {
  const random = createRandom(416000);
  const render = ([capacity, commands]: [number, CircularCommand[]]): CaseDefinition => {
    const queue: number[] = [];
    const output: string[] = [];
    for (const command of commands) {
      if (command[0] === "enfileirar") {
        if (queue.length === capacity) output.push("FILA CHEIA");
        else queue.push(command[1]);
      } else if (command[0] === "desenfileirar") output.push(queue.length ? String(queue.shift()) : "FILA VAZIA");
      else if (command[0] === "frente") output.push(queue.length ? String(queue[0]) : "FILA VAZIA");
      else output.push(queue.length ? queue.join(" ") : "FILA VAZIA");
    }
    return {
      input: [String(capacity), ...commands.map((command) => command.join(" ")), "fim"].join("\n"),
      output: output.join("\n")
    };
  };
  const value = () => randomInt(random, -100000, 100000);
  const enqueue = (count: number): CircularCommand[] => Array.from({ length: count }, (): CircularCommand => ["enfileirar", value()]);
  const dequeue = (count: number): CircularCommand[] => Array.from({ length: count }, (): CircularCommand => ["desenfileirar"]);
  const randomCommands = (count: number, printRate: number): CircularCommand[] =>
    Array.from({ length: count }, (): CircularCommand => {
      const roll = random();
      if (roll < 0.5) return ["enfileirar", value()];
      if (roll < 0.85) return ["desenfileirar"];
      if (roll < 1 - printRate) return ["frente"];
      return ["imprimir"];
    });
  const hidden: Array<[number, CircularCommand[]]> = [
    [1, [["frente"], ["desenfileirar"], ["imprimir"], ["enfileirar", 5], ["enfileirar", 6], ["imprimir"], ["desenfileirar"], ["enfileirar", 7], ["imprimir"]]],
    // Várias voltas no vetor: o início e o fim passam do último índice.
    [3, [...enqueue(3), ["enfileirar", 99], ...dequeue(2), ...enqueue(2), ["imprimir"], ...dequeue(1), ...enqueue(1), ["imprimir"], ["frente"]]],
    [4, [...enqueue(4), ...dequeue(4), ["imprimir"], ...enqueue(4), ["imprimir"], ["enfileirar", 1], ...dequeue(5)]],
    [2, Array.from({ length: 300 }, (_, index): CircularCommand[] => [["enfileirar", index], ["enfileirar", -index], ["frente"], ["desenfileirar"], ["imprimir"], ["desenfileirar"]]).flat()],
    [1000, [...enqueue(1000), ["enfileirar", 1], ["imprimir"], ...dequeue(999), ["imprimir"], ...enqueue(999), ["imprimir"], ["enfileirar", 2]]],
    [1000, [...enqueue(700), ...dequeue(600), ...enqueue(800), ["imprimir"], ["frente"]]]
  ];
  while (hidden.length < 18) {
    const capacity = hidden.length % 3 === 0 ? randomInt(random, 1, 5) : randomInt(random, 1, 60);
    hidden.push([capacity, [...randomCommands(randomInt(random, 10, hidden.length > 14 ? 9000 : 300), hidden.length > 14 ? 0.002 : 0.05), ["imprimir"]]]);
  }
  return defineChallenge({
    slug: "fila-circular-em-vetor",
    title: "Fila circular em vetor",
    difficulty: "medium",
    moduleId: moduleId("filas"),
    position: 1,
    description: `Implemente uma **fila circular** de inteiros num vetor de tamanho fixo. A fila guarda o índice do **início** (o elemento da frente), o índice do **fim** (onde entra o próximo) e a quantidade de elementos. Quando um índice passa da última posição, ele **volta para 0**: \`fim = (fim + 1) % k\`. Assim, as posições liberadas na frente são reaproveitadas sem deslocar nada.

A primeira linha da entrada traz a capacidade \`k\`. Depois vêm comandos, um por linha, até \`fim\`:

- \`enfileirar x\`: coloca \`x\` no fim da fila; se ela já tem \`k\` elementos, imprime \`FILA CHEIA\` (e \`x\` é descartado). Não imprime nada quando dá certo;
- \`desenfileirar\`: remove e imprime o elemento da frente, ou \`FILA VAZIA\`;
- \`frente\`: imprime o elemento da frente sem removê-lo, ou \`FILA VAZIA\`;
- \`imprimir\`: imprime os elementos da frente para o fim, separados por espaço, ou \`FILA VAZIA\`.

Use o operador \`%\` para dar a volta no vetor. Alocação dinâmica não é permitida: declare o vetor com a capacidade máxima (1000).`,
    constraints: [
      "Entrada: k (1 <= k <= 1000) e depois até 10000 comandos, terminados por \"fim\".",
      "Valores entre -100000 e 100000.",
      "Obrigatório: vetor de tamanho fixo, sem malloc/calloc/realloc, e índices circulares com %."
    ],
    tags: ["Filas", "Fila circular", "Vetores"],
    languages: cOnly(STATIC_ONLY, USES_MODULO),
    publicCases: [
      render([3, [["enfileirar", 10], ["enfileirar", 20], ["enfileirar", 30], ["enfileirar", 40], ["desenfileirar"], ["enfileirar", 50], ["imprimir"], ["frente"]]]),
      render([2, [["desenfileirar"], ["enfileirar", 7], ["imprimir"], ["desenfileirar"], ["frente"]]])
    ],
    hiddenCases: hidden.map(render),
    hints: [
      "Guarde inicio, fim e quantidade. A fila está cheia quando quantidade == k e vazia quando quantidade == 0; só inicio == fim não distingue os dois casos.",
      "Enfileirar: v[fim] = x; fim = (fim + 1) % k. Desenfileirar: x = v[inicio]; inicio = (inicio + 1) % k.",
      "Para imprimir, visite quantidade elementos a partir do início: o i-ésimo está em v[(inicio + i) % k]."
    ],
    editorial: `**Ideia.** Numa fila em vetor comum, o início anda para a direita e as posições da frente ficam perdidas. Na fila circular, os índices dão a volta com \`% k\`, e as \`k\` posições são reaproveitadas para sempre. O contador \`quantidade\` resolve a ambiguidade entre fila cheia e vazia.

**Passo a passo.**

1. \`enfileirar\`: se \`quantidade == k\`, \`FILA CHEIA\`; senão grave em \`v[fim]\`, avance \`fim\` com \`%\` e incremente a quantidade.
2. \`desenfileirar\`: se vazia, \`FILA VAZIA\`; senão imprima \`v[inicio]\`, avance \`inicio\` e decremente.
3. \`imprimir\`: percorra \`v[(inicio + i) % k]\` para \`i\` de 0 a \`quantidade - 1\`.

${code("c", String.raw`
#define MAX 1000
int v[MAX], k, inicio = 0, fim = 0, quantidade = 0;

int enfileirar(int x) {
    if (quantidade == k) return 0;
    v[fim] = x;
    fim = (fim + 1) % k;
    quantidade++;
    return 1;
}

int desenfileirar(int *x) {
    if (quantidade == 0) return 0;
    *x = v[inicio];
    inicio = (inicio + 1) % k;
    quantidade--;
    return 1;
}
`)}

**Custo.** O(1) por enfileirar, desenfileirar e frente; O(k) por impressão. Memória fixa de \`MAX\` posições.`,
    complexity: { time: "O(1) por operação (O(k) para imprimir)", space: "O(k)" }
  });
}

function problemaDeJosephus(): Challenge {
  const random = createRandom(417000);
  const solve = (n: number, k: number) => {
    const people = Array.from({ length: n }, (_, index) => index + 1);
    const order: number[] = [];
    let index = 0;
    while (people.length) {
      index = (index + k - 1) % people.length;
      order.push(people.splice(index, 1)[0]);
    }
    return order;
  };
  const pairs: Array<[number, number]> = [
    [1, 1],
    [1, 1000000000],
    [2, 1],
    [2, 2],
    [5, 1],
    [5, 5],
    [6, 3],
    [7, 100],
    [10, 11],
    [5000, 2],
    [5000, 4999],
    // k enorme: girar a fila k - 1 vezes, sem usar o resto, estoura o tempo.
    [5000, 1000000000],
    [4096, 1000000007 % 1000000000]
  ];
  while (pairs.length < 18) pairs.push([randomInt(random, 1, 3000), randomInt(random, 1, pairs.length % 2 ? 50 : 1000000000)]);
  return defineChallenge({
    slug: "problema-de-josephus",
    title: "Problema de Josephus",
    difficulty: "medium",
    moduleId: moduleId("filas"),
    position: 2,
    description: `\`n\` pessoas, numeradas de 1 a \`n\`, estão em roda. A contagem começa na pessoa 1: conta-se \`k\` pessoas seguindo a roda, e a \`k\`-ésima é eliminada. A contagem recomeça em 1 a partir da pessoa seguinte à eliminada, e assim por diante até não sobrar ninguém.

Implemente \`ordemDeEliminacao(n, k)\`, que retorna o vetor com os números das pessoas **na ordem em que são eliminadas** (a última do vetor é a sobrevivente).

Exemplo: com \`n = 5\` e \`k = 2\`, saem 2, 4, 1, 5 e, por fim, 3.

Uma fila modela a roda: tirar da frente e recolocar no fim equivale a passar a vez. Mas \`k\` pode chegar a 10^9: girar a fila \`k - 1\` vezes a cada eliminação é lento demais. Com \`m\` pessoas na roda, girar \`k - 1\` vezes dá no mesmo que girar \`(k - 1) % m\` vezes.`,
    constraints: ["1 <= n <= 5000.", "1 <= k <= 10^9.", "Retorne um vetor com n inteiros."],
    tags: ["Filas", "Simulação"],
    functionSpec: { name: "ordemDeEliminacao", params: [{ name: "n", type: "int" }, { name: "k", type: "int" }], returns: "int[]" },
    publicCases: [call([5, 2], [2, 4, 1, 5, 3]), call([4, 3], [3, 2, 4, 1])],
    hiddenCases: pairs.map(([n, k]) => call([n, k], solve(n, k))),
    hints: [
      "Com uma fila: passe k - 1 pessoas da frente para o fim e elimine a que ficou na frente.",
      "As voltas completas não mudam nada: com m pessoas, basta passar (k - 1) % m pessoas.",
      "Sem fila, em um vetor: se a última eliminada estava no índice i, a próxima está em (i + k - 1) % m, contando já com a remoção."
    ],
    editorial: `**Ideia.** Simule a roda, mas sem dar voltas inúteis. Num vetor com as pessoas restantes, se a contagem começa no índice \`i\`, a eliminada está em \`(i + k - 1) % m\`. Ao removê-la, a pessoa seguinte passa a ocupar esse mesmo índice, que é onde a próxima contagem começa.

**Passo a passo.**

1. \`pessoas = [1, 2, ..., n]\`, \`i = 0\`.
2. Enquanto houver pessoas: \`i = (i + k - 1) % m\`; remova \`pessoas[i]\` e anexe à resposta.

${code("python", String.raw`
from collections import deque

def ordemDeEliminacao(n, k):
    roda = deque(range(1, n + 1))
    ordem = []
    while roda:
        roda.rotate(-((k - 1) % len(roda)))  # passa (k - 1) % m pessoas para o fim
        ordem.append(roda.popleft())
    return ordem
`)}

**Custo.** Cada eliminação move no máximo \`m\` elementos: O(n²) no total, cerca de 12 milhões de movimentos para \`n = 5000\`, independentemente de \`k\`. Sem o resto, o custo seria O(n · k). Memória O(n).`,
    complexity: { time: "O(n²)", space: "O(n)" }
  });
}

function maximoEmJanela(): Challenge {
  const random = createRandom(418000);
  const solve = (values: number[], k: number) => {
    const deque = new Int32Array(values.length);
    let head = 0;
    let tail = 0;
    let total = 0;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      while (tail > head && values[deque[tail - 1]] <= value) tail -= 1;
      deque[tail++] = index;
      if (deque[head] <= index - k) head += 1;
      if (index >= k - 1) total += values[deque[head]];
    }
    return total;
  };
  const small: Array<[number[], number]> = [
    [[5], 1],
    [[1, 2, 3], 1],
    [[1, 2, 3], 3],
    [[3, 2, 1], 2],
    [[1, 2, 3, 4, 5], 2],
    [[4, 4, 4, 4], 2],
    [[-5, -1, -3, -7], 2],
    [[2, 9, 1, 1, 1, 8, 3], 3],
    [[1000000000, 1000000000, -1000000000], 2]
  ];
  while (small.length < 13) {
    const values = randomArray(random, randomInt(random, 1, 2000), -1000, 1000);
    small.push([values, randomInt(random, 1, values.length)]);
  }
  const hidden = small.map(([values, k]) => call([values, k], solve(values, k)));
  const big: Array<[ReturnType<typeof gen>, number]> = [
    // Janela grande: recalcular o máximo de cada janela custa n · k.
    [gen({ $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 418001 }), 100000],
    [gen({ $gen: "range", n: 200000, start: 999999999, step: -10000 }), 150000],
    [gen({ $gen: "ints", n: 200000, min: 0, max: 3, seed: 418003 }), 2]
  ];
  for (const [values, k] of big) hidden.push(call([values.spec, k], solve(values.value, k)));
  return defineChallenge({
    slug: "maximo-em-janela",
    title: "Máximo em janela deslizante",
    difficulty: "hard",
    moduleId: moduleId("filas"),
    position: 3,
    description: `Uma **janela** de tamanho \`k\` desliza sobre o vetor \`nums\`, da esquerda para a direita, uma posição por vez: primeiro cobre \`nums[0..k-1]\`, depois \`nums[1..k]\`, até \`nums[n-k..n-1]\`. São \`n - k + 1\` janelas.

Implemente \`somaMaximosJanela(nums, k)\`, que retorna a **soma dos máximos** de todas as janelas.

Exemplo: em \`[2, 9, 1, 1, 1, 8, 3]\` com \`k = 3\`, os máximos das janelas são \`9, 9, 1, 8, 8\`, e a soma é 35.

Com \`n\` até 200000 e \`k\` até \`n\`, recalcular o máximo de cada janela custa O(n · k) e estoura o tempo. A solução esperada usa uma **deque monotônica** (fila com duas pontas) e roda em O(n).`,
    constraints: ["1 <= k <= n <= 200000.", "-10^9 <= nums[i] <= 10^9.", "A soma cabe em 64 bits (em C, retorne long long)."],
    tags: ["Filas", "Deque", "Janela deslizante"],
    functionSpec: {
      name: "somaMaximosJanela",
      params: [{ name: "nums", type: "int[]" }, { name: "k", type: "int" }],
      returns: "long"
    },
    publicCases: [call([[2, 9, 1, 1, 1, 8, 3], 3], 35), call([[4, -2, 5], 2], 9)],
    hiddenCases: hidden,
    hints: [
      "Se um elemento é menor que outro que chegou depois dele, ele nunca mais será o máximo de nenhuma janela: pode ser descartado.",
      "Guarde numa deque os índices dos candidatos, com valores decrescentes da frente para o fundo. Ao chegar nums[i], retire do fundo os de valor menor ou igual.",
      "A frente da deque é sempre o máximo da janela; retire-a pela frente quando o índice dela sair da janela (índice <= i - k)."
    ],
    editorial: `**Ideia.** A deque guarda só os índices que ainda podem ser máximos: da frente para o fundo, os valores são decrescentes. Um novo elemento expulsa pelo fundo os menores ou iguais (eles saem da janela antes dele e nunca vencerão), e a frente sai quando fica velha demais.

**Passo a passo.**

1. Para cada \`i\`: enquanto o fundo tiver valor \`<= nums[i]\`, retire-o; coloque \`i\` no fundo.
2. Se a frente for \`<= i - k\`, retire-a pela frente.
3. A partir de \`i = k - 1\`, some \`nums[frente]\`.

${code("python", String.raw`
from collections import deque

def somaMaximosJanela(nums, k):
    candidatos = deque()
    total = 0
    for i, valor in enumerate(nums):
        while candidatos and nums[candidatos[-1]] <= valor:
            candidatos.pop()
        candidatos.append(i)
        if candidatos[0] <= i - k:
            candidatos.popleft()
        if i >= k - 1:
            total += nums[candidatos[0]]
    return total
`)}

**Custo.** Cada índice entra e sai da deque no máximo uma vez: O(n) de tempo e O(k) de memória.`,
    complexity: { time: "O(n)", space: "O(k)" }
  });
}

function dequeDeComandos(): Challenge {
  const random = createRandom(419000);
  const solve = (ops: string[]) => {
    const items: number[] = [];
    const output: string[] = [];
    for (const op of ops) {
      const [name, argument] = op.split(" ");
      if (name === "push_front") items.unshift(Number(argument));
      else if (name === "push_back") items.push(Number(argument));
      else if (!items.length) output.push("VAZIO");
      else if (name === "pop_front") output.push(String(items.shift()));
      else if (name === "pop_back") output.push(String(items.pop()));
      else if (name === "front") output.push(String(items[0]));
      else output.push(String(items[items.length - 1]));
    }
    return output;
  };
  const value = () => randomInt(random, -1000000, 1000000);
  const randomOps = (count: number, pushRate: number) =>
    Array.from({ length: count }, () => {
      if (random() < pushRate) return `${random() < 0.5 ? "push_front" : "push_back"} ${value()}`;
      return pick(random, ["pop_front", "pop_back", "front", "back"]);
    });
  const opsList: string[][] = [
    ["front", "back", "pop_front", "pop_back"],
    ["push_front 1", "push_front 2", "push_front 3", "pop_back", "pop_back", "pop_back", "pop_back"],
    ["push_back 1", "push_back 2", "push_back 3", "pop_front", "pop_front", "pop_front", "pop_front"],
    ["push_front 5", "front", "back", "pop_back", "front", "push_back 6", "front", "back"],
    ["push_back 0", "push_front -1", "push_back 1", "front", "back", "pop_front", "front", "pop_back", "back"],
    // Mais de 1024 elementos ao mesmo tempo: um vetor circular de tamanho fixo não basta.
    [...Array.from({ length: 1500 }, (_, index) => `push_front ${index}`), ...Array.from({ length: 1500 }, (_, index) => `push_back ${-index}`), "front", "back", ...Array(400).fill("pop_back"), ...Array(400).fill("pop_front"), "front", "back"],
    [...Array.from({ length: 3000 }, (_, index) => (index % 2 ? `push_front ${index}` : `push_back ${index}`)), ...Array(1500).fill("pop_front"), "front", "back"],
    randomOps(8000, 0.7)
  ];
  while (opsList.length < 18) opsList.push(randomOps(randomInt(random, 5, 500), 0.4 + random() * 0.3));
  return defineChallenge({
    slug: "deque-de-comandos",
    title: "Deque de comandos",
    difficulty: "hard",
    moduleId: moduleId("filas"),
    position: 4,
    isBoss: true,
    description: `Uma **deque** (*double-ended queue*) é uma fila com duas pontas: dá para inserir e remover tanto na frente quanto no fundo, sempre em O(1). Ela generaliza a pilha e a fila, e é a base da janela deslizante do desafio anterior.

Implemente \`processarDeque(ops)\`, que executa os comandos sobre uma deque de inteiros inicialmente vazia e retorna as respostas, em ordem:

- \`"push_front x"\` e \`"push_back x"\`: inserem \`x\` na frente ou no fundo (não geram resposta);
- \`"pop_front"\` e \`"pop_back"\`: removem da frente ou do fundo e respondem com o valor removido;
- \`"front"\` e \`"back"\`: respondem com o valor da frente ou do fundo, sem remover.

Quando a deque está vazia, os quatro últimos comandos respondem \`"VAZIO"\`. As respostas são strings (\`"5"\`, \`"-3"\`, \`"VAZIO"\`).

Implemente a estrutura você mesmo: um **vetor circular** que cresce quando lota (em C, com \`realloc\`) ou uma **lista duplamente encadeada**. Em JavaScript, \`shift\`/\`unshift\` estão proibidos; em Python, \`collections.deque\`, \`insert(0, ...)\` e \`pop(0)\` também. Este desafio fecha o módulo: juntam-se a fila circular, o vetor que cresce e as duas pontas.`,
    constraints: [
      "1 <= número de comandos <= 8000.",
      "Valores entre -1000000 e 1000000.",
      "A deque pode chegar a milhares de elementos ao mesmo tempo."
    ],
    tags: ["Deque", "Filas", "Fila circular"],
    functionSpec: { name: "processarDeque", params: [{ name: "ops", type: "string[]" }], returns: "string[]" },
    languages: [
      language("javascript", [
        {
          kind: "forbid",
          pattern: "\\.(shift|unshift)\\s*\\(",
          message: "Implemente a deque você mesmo (vetor circular ou lista duplamente encadeada): shift e unshift não são permitidos."
        }
      ]),
      language("python", [
        {
          kind: "forbid",
          pattern: "\\bdeque\\b|\\.insert\\s*\\(\\s*0\\s*,|\\.pop\\s*\\(\\s*0\\s*\\)",
          message: "Implemente a deque você mesmo (vetor circular ou lista duplamente encadeada): collections.deque, insert(0, ...) e pop(0) não são permitidos."
        }
      ]),
      language("c")
    ],
    publicCases: [
      call([["push_back 1", "push_front 2", "push_back 3", "front", "back", "pop_front", "pop_back", "front"]], ["2", "3", "2", "3", "1"]),
      call([["pop_back", "push_front 7", "back", "pop_front", "front"]], ["VAZIO", "7", "7", "VAZIO"])
    ],
    hiddenCases: opsList.map((ops) => call([ops], solve(ops))),
    hints: [
      "Num vetor circular de capacidade cap, guarde o índice da frente e o tamanho; o fundo está em (frente + tamanho - 1) % cap.",
      "push_front recua a frente: frente = (frente - 1 + cap) % cap. Somar cap antes do resto evita índice negativo (em C e em JavaScript, -1 % cap é -1).",
      "Quando lotar, crie um vetor com o dobro da capacidade e copie os elementos na ordem, da frente ao fundo, a partir da posição 0."
    ],
    editorial: `**Ideia.** A fila circular da posição 1 já tira da frente e põe no fundo em O(1). Para a deque, basta permitir também recuar a frente e remover do fundo, e crescer (dobrando, como o vetor dinâmico do módulo de ponteiros) quando lotar.

**Passo a passo.**

1. Estado: \`dados\` (capacidade \`cap\`), \`frente\` e \`tamanho\`.
2. \`push_back\`: grave em \`(frente + tamanho) % cap\`. \`push_front\`: recue \`frente\` com \`(frente - 1 + cap) % cap\` e grave ali. Antes dos dois, dobre a capacidade se \`tamanho == cap\`.
3. \`pop_front\`: leia \`dados[frente]\` e avance \`frente\`. \`pop_back\`: leia a posição do fundo e só decremente \`tamanho\`.

${code("js", String.raw`
function processarDeque(ops) {
  let cap = 8, frente = 0, tamanho = 0;
  let dados = new Array(cap);
  const crescer = () => {
    const novo = new Array(cap * 2);
    for (let i = 0; i < tamanho; i++) novo[i] = dados[(frente + i) % cap];
    dados = novo; cap *= 2; frente = 0;
  };
  const respostas = [];
  for (const op of ops) {
    const [nome, arg] = op.split(" ");
    if (nome === "push_front" || nome === "push_back") {
      if (tamanho === cap) crescer();
      if (nome === "push_front") frente = (frente - 1 + cap) % cap;
      dados[nome === "push_front" ? frente : (frente + tamanho) % cap] = Number(arg);
      tamanho++;
    } else if (tamanho === 0) respostas.push("VAZIO");
    else {
      const fundo = (frente + tamanho - 1) % cap;
      respostas.push(String(nome === "pop_front" || nome === "front" ? dados[frente] : dados[fundo]));
      if (nome === "pop_front") { frente = (frente + 1) % cap; tamanho--; }
      if (nome === "pop_back") tamanho--;
    }
  }
  return respostas;
}
`)}

**Custo.** O(1) amortizado por comando (a cópia ao crescer se paga como no vetor dinâmico): O(q) no total, com memória O(q).`,
    complexity: { time: "O(1) amortizado por comando", space: "O(n)" }
  });
}

export function buildEdLinearesChallenges(): Challenge[] {
  return [
    somaComPonteiros(),
    trocaPorReferencia(),
    concatenarComMalloc(),
    matrizDinamica(),
    vetorDinamico(),
    insercaoOrdenadaEstatica(),
    remocaoEmListaEstatica(),
    agendaEstatica(),
    removerValorDaLista(),
    noDoMeio(),
    somarNumerosEmListas(),
    avaliarPosfixa(),
    proximoMaiorElemento(),
    infixaParaPosfixa(),
    filaDeAtendimento(),
    filaCircularEmVetor(),
    problemaDeJosephus(),
    maximoEmJanela(),
    dequeDeComandos()
  ];
}
