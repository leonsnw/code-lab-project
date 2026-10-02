import type { Challenge, Difficulty, SourceRule } from "../../domain/types.js";
import {
  byteOrder,
  createRandom,
  defineChallenge,
  formatCents,
  language,
  pick,
  randomInt,
  rules,
  shuffle,
  type CaseDefinition
} from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Desafios em C do repositório "Exercicios-Estrutura-de-Dados"
 * (github.com/leonsnw/Exercicios-Estrutura-de-Dados). Cada enunciado traz o
 * texto original do comentário e o formato exato de entrada e saída que o juiz
 * exige. Os casos são gerados por implementações de referência; as soluções e
 * as burlas ficam em desafios/<slug>/ e são verificadas pelos testes.
 */

export const DATA_STRUCTURES_TOPIC = "Estrutura de Dados";

// ---------- Regras de código-fonte ----------
const NO_LOOPS = rules.noLoops;
const NO_QSORT = rules.noQsort;
const USES_STRUCT = rules.usesStruct;
const STATIC_ONLY = rules.staticOnly;
const USES_MALLOC = rules.usesMalloc;
const SELF_REFERENCING_NODE = rules.selfReferencingNode;
const DOUBLY_LINKED_NODE = rules.doublyLinkedNode;
const NO_ARRAYS = rules.noArrays;
const LINKED_LIST_RULES = [USES_MALLOC, SELF_REFERENCING_NODE];

/** Recursão verificada também em tempo de execução: profundidade mínima de chamadas. */
const recursionDepth = (minDepth: number): SourceRule => rules.recursion(minDepth);

// ---------- Definição ----------
interface ChallengeDefinition {
  slug: string;
  title: string;
  difficulty: Difficulty;
  points: number;
  subtopic: string;
  tags: string[];
  source: string;
  original: string;
  statement: string;
  constraints: string[];
  rules: SourceRule[];
  publicCases: CaseDefinition[];
  hiddenCases: CaseDefinition[];
}

const SUBTOPIC_MODULES: Record<string, string> = {
  Recursividade: "recursividade",
  "Ordenação": "ordenacao",
  "Listas Estáticas": "listas-estaticas",
  Pilhas: "pilhas",
  "Listas Encadeadas": "listas-encadeadas"
};
const positions = new Map<string, number>();

// ---------- Dicas e soluções comentadas ----------
interface Help {
  hints: string[];
  editorial: string;
  complexity: { time: string; space: string };
}

const HELP: Record<string, Help> = {
  "serie-de-pitagoras": {
    hints: [
      "Qual é o menor termo que você já sabe sem calcular nada? Esse é o caso base.",
      "O termo n é o termo n - 1 mais o próprio n: pit(n) = n + pit(n - 1).",
      "Com n até 10000, o resultado passa de 50 milhões: ainda cabe em int, mas use long long por segurança."
    ],
    editorial: `A recursão espelha a definição: o caso base é \`pit(1) = 1\` e cada chamada soma n ao termo anterior.

\`\`\`c
#include <stdio.h>

long long pit(int n) {
    if (n == 1) return 1;          /* caso base */
    return n + pit(n - 1);         /* passo recursivo */
}

int main(void) {
    int n;
    scanf("%d", &n);
    printf("%lld\\n", pit(n));
    return 0;
}
\`\`\`

São n chamadas empilhadas: tempo O(n) e memória O(n) na pilha. A fórmula fechada n(n + 1)/2 daria O(1), mas o exercício cobra a recursão.`,
    complexity: { time: "O(n)", space: "O(n) de pilha" }
  },
  "fatorial-recursivo": {
    hints: [
      "0! e 1! valem 1: esse é o caso base.",
      "n! = n × (n - 1)!, então a função chama a si mesma com n - 1.",
      "20! tem 19 dígitos: use long long e imprima com %lld."
    ],
    editorial: `\`\`\`c
#include <stdio.h>

long long fatorial(int n) {
    if (n <= 1) return 1;
    return n * fatorial(n - 1);
}

int main(void) {
    int n;
    scanf("%d", &n);
    printf("%lld\\n", fatorial(n));
    return 0;
}
\`\`\`

O erro mais comum é usar \`int\`: a partir de 13! o valor transborda e o resultado sai negativo ou errado. Tempo e pilha O(n).`,
    complexity: { time: "O(n)", space: "O(n) de pilha" }
  },
  "torre-de-hanoi": {
    hints: [
      "Para mover n discos de A para C, primeiro tire os n - 1 de cima do caminho, levando-os para B.",
      "A função recebe o número de discos e as três hastes (origem, auxiliar, destino) e troca os papéis nas chamadas.",
      "O total de movimentos é 2^n - 1; conte com uma variável global ou pelo retorno da função."
    ],
    editorial: `A solução clássica tem três passos: mover n - 1 discos da origem para a auxiliar, mover o disco n para o destino e mover os n - 1 discos da auxiliar para o destino.

\`\`\`c
#include <stdio.h>

int movimentos = 0;

void hanoi(int n, char origem, char auxiliar, char destino) {
    if (n == 0) return;
    hanoi(n - 1, origem, destino, auxiliar);
    printf("Disco %d de %c para %c\\n", n, origem, destino);
    movimentos++;
    hanoi(n - 1, auxiliar, origem, destino);
}

int main(void) {
    int n;
    scanf("%d", &n);
    hanoi(n, 'A', 'B', 'C');
    printf("Total de movimentos: %d\\n", movimentos);
    return 0;
}
\`\`\`

São 2^n - 1 movimentos, então o tempo é O(2^n); a pilha tem no máximo n chamadas.`,
    complexity: { time: "O(2^n)", space: "O(n) de pilha" }
  },
  "funcionarios-bubble-sort": {
    hints: [
      "Guarde nome e salário juntos num struct, e ordene o vetor de structs (trocando o struct inteiro).",
      "Bubble Sort compara vizinhos e troca quando estão fora de ordem; troque só quando for estritamente maior (ou menor) para manter a ordem de cadastro nos empates.",
      "Ordene uma cópia do vetor original para cada listagem: a ordem decrescente não é o inverso da crescente quando há empates."
    ],
    editorial: `O Bubble Sort é estável se a troca acontece só com a comparação estrita: elementos iguais nunca passam um pelo outro.

\`\`\`c
typedef struct { char nome[50]; float salario; } Funcionario;

void bubble(Funcionario v[], int n, int (*antes)(Funcionario *, Funcionario *)) {
    for (int i = 0; i < n - 1; i++)
        for (int j = 0; j < n - 1 - i; j++)
            if (antes(&v[j + 1], &v[j])) {       /* só troca se estiver fora de ordem */
                Funcionario t = v[j]; v[j] = v[j + 1]; v[j + 1] = t;
            }
}

int menorSalario(Funcionario *a, Funcionario *b) { return a->salario < b->salario; }
int maiorSalario(Funcionario *a, Funcionario *b) { return a->salario > b->salario; }
int alfabetica(Funcionario *a, Funcionario *b) { return strcmp(a->nome, b->nome) < 0; }
\`\`\`

Para cada listagem, copie o vetor lido (\`memcpy\`) e ordene a cópia. Tempo O(n²) por listagem, memória O(n).`,
    complexity: { time: "O(n²)", space: "O(n)" }
  },
  "insertion-sort-menor": {
    hints: [
      "Insertion Sort: para cada posição i, guarde v[i] e desloque para a direita os anteriores maiores que ele.",
      "Evite v[j + 1] = v[j--]: a ordem de avaliação dessa expressão não é definida em C. Separe em duas instruções.",
      "Depois de ordenar, o menor está em v[0]; conte as repetições com um laço que para no fim do vetor (i < n) antes de comparar."
    ],
    editorial: `\`\`\`c
void insertion(int v[], int n) {
    for (int i = 1; i < n; i++) {
        int atual = v[i], j = i - 1;
        while (j >= 0 && v[j] > atual) {
            v[j + 1] = v[j];   /* desloca uma posição */
            j--;
        }
        v[j + 1] = atual;
    }
}
\`\`\`

Com o vetor ordenado, \`menor = v[0]\` e as ocorrências são contadas com \`while (k < n && v[k] == v[0]) k++;\`. A condição \`k < n\` vem primeiro, para nunca ler fora do vetor quando todos os valores são iguais. Tempo O(n²) no pior caso e O(n) se o vetor já está ordenado.`,
    complexity: { time: "O(n²)", space: "O(1) extra" }
  },
  "selection-sort-maior": {
    hints: [
      "Selection Sort: em cada passo i, encontre o menor elemento de i até o fim e troque-o com v[i].",
      "O laço externo vai até n - 1 (inclusive a penúltima posição); parar antes deixa as duas últimas posições fora de ordem.",
      "Depois de ordenar, o maior está em v[n - 1]; compare números reais lidos com duas casas sem medo, pois vieram da mesma leitura."
    ],
    editorial: `\`\`\`c
void selection(float v[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int menor = i;
        for (int j = i + 1; j < n; j++)
            if (v[j] < v[menor]) menor = j;
        float t = v[i]; v[i] = v[menor]; v[menor] = t;
    }
}
\`\`\`

O maior valor é \`v[n - 1]\` e as ocorrências são contadas do fim para o começo. Selection Sort faz sempre cerca de n²/2 comparações, mesmo com o vetor já ordenado: tempo O(n²).`,
    complexity: { time: "O(n²)", space: "O(1) extra" }
  },
  "merge-sort-vogais": {
    hints: [
      "Merge Sort divide o vetor ao meio, ordena cada metade recursivamente e intercala as duas metades ordenadas.",
      "Para intercalar strings, compare com strcmp e copie para um vetor auxiliar; depois copie de volta.",
      "Para testar a vogal, use tolower(palavra[0]) e strchr(\"aeiou\", ...)."
    ],
    editorial: `\`\`\`c
char aux[500][30];

void merge(char v[][30], int ini, int meio, int fim) {
    int i = ini, j = meio + 1, k = ini;
    while (i <= meio && j <= fim)
        strcpy(aux[k++], strcmp(v[i], v[j]) <= 0 ? v[i++] : v[j++]);
    while (i <= meio) strcpy(aux[k++], v[i++]);
    while (j <= fim) strcpy(aux[k++], v[j++]);
    for (k = ini; k <= fim; k++) strcpy(v[k], aux[k]);
}

void mergeSort(char v[][30], int ini, int fim) {
    if (ini >= fim) return;
    int meio = (ini + fim) / 2;
    mergeSort(v, ini, meio);
    mergeSort(v, meio + 1, fim);
    merge(v, ini, meio, fim);
}
\`\`\`

O \`<=\` na intercalação mantém a ordem original de palavras iguais (estabilidade). Tempo O(n log n) comparações e memória O(n) no vetor auxiliar.`,
    complexity: { time: "O(n log n)", space: "O(n)" }
  },
  "quick-sort-numeros": {
    hints: [
      "Quick Sort escolhe um pivô, particiona o vetor (menores à esquerda, maiores à direita) e ordena cada parte recursivamente.",
      "Com o primeiro elemento como pivô, um vetor já ordenado vira o pior caso O(n²): prefira o elemento do meio.",
      "Com muitos valores repetidos, a partição de Hoare (dois índices que se aproximam) se comporta melhor que a de Lomuto."
    ],
    editorial: `\`\`\`c
void quick(int v[], int esq, int dir) {
    int i = esq, j = dir, pivo = v[(esq + dir) / 2];
    while (i <= j) {
        while (v[i] < pivo) i++;
        while (v[j] > pivo) j--;
        if (i <= j) {
            int t = v[i]; v[i] = v[j]; v[j] = t;
            i++; j--;
        }
    }
    if (esq < j) quick(v, esq, j);
    if (i < dir) quick(v, i, dir);
}
\`\`\`

Com o pivô no meio, vetores ordenados e invertidos ficam no caso médio O(n log n). O pior caso continua O(n²), mas exige uma entrada construída contra essa escolha de pivô.`,
    complexity: { time: "O(n log n) em média", space: "O(log n) de pilha" }
  },
  "quick-sort-letras": {
    hints: [
      "É o mesmo Quick Sort, mas cada elemento é uma string de 3 bytes (duas letras e o \\0).",
      "Compare com strcmp(a, b) < 0 no lugar de a < b, e troque as strings com um char temporário[3] e strcpy.",
      "Leia cada combinação com scanf(\"%2s\", v[i])."
    ],
    editorial: `\`\`\`c
void quick(char v[][3], int esq, int dir) {
    int i = esq, j = dir;
    char pivo[3], t[3];
    strcpy(pivo, v[(esq + dir) / 2]);
    while (i <= j) {
        while (strcmp(v[i], pivo) < 0) i++;
        while (strcmp(v[j], pivo) > 0) j--;
        if (i <= j) {
            strcpy(t, v[i]); strcpy(v[i], v[j]); strcpy(v[j], t);
            i++; j--;
        }
    }
    if (esq < j) quick(v, esq, j);
    if (i < dir) quick(v, i, dir);
}
\`\`\`

Copie o pivô para uma variável própria: se ele for só um ponteiro para \`v[meio]\`, as trocas mudam o pivô no meio da partição. Tempo médio O(n log n).`,
    complexity: { time: "O(n log n) em média", space: "O(log n) de pilha" }
  },
  "lista-estatica-media": {
    hints: [
      "Declare float v[6] e leia os seis valores num laço.",
      "Some os elementos percorrendo o vetor e divida por 6.",
      "Imprima com printf(\"Media: %.2f\\n\", media)."
    ],
    editorial: `\`\`\`c
#include <stdio.h>

int main(void) {
    float v[6], soma = 0;
    for (int i = 0; i < 6; i++) {
        scanf("%f", &v[i]);
        soma += v[i];
    }
    printf("Media: %.2f\\n", soma / 6);
    return 0;
}
\`\`\`

Uma lista estática é um vetor de tamanho fixo definido na compilação, sem malloc. Tempo O(n) com n = 6.`,
    complexity: { time: "O(n)", space: "O(n)" }
  },
  "lista-estatica-softwares": {
    hints: [
      "Defina um struct com os quatro campos (char nome[50], fabricante[50], licenca[50], versao[50]) e um vetor de 50 desses structs.",
      "Cada campo ocupa uma linha inteira: leia com scanf(\" %49[^\\n]\", campo); o espaço no início descarta a quebra de linha anterior.",
      "Imprima com o índice começando em 1: printf(\"%d. %s | %s | %s | %s\\n\", i + 1, ...)."
    ],
    editorial: `Lista heterogênea: cada posição do vetor guarda um registro com campos de tipos (ou significados) diferentes.

\`\`\`c
typedef struct {
    char nome[50], fabricante[50], licenca[50], versao[50];
} Software;

Software lista[50];

int main(void) {
    int n;
    scanf("%d", &n);
    for (int i = 0; i < n; i++)
        scanf(" %49[^\\n] %49[^\\n] %49[^\\n] %49[^\\n]",
              lista[i].nome, lista[i].fabricante, lista[i].licenca, lista[i].versao);
    for (int i = 0; i < n; i++)
        printf("%d. %s | %s | %s | %s\\n", i + 1,
               lista[i].nome, lista[i].fabricante, lista[i].licenca, lista[i].versao);
    printf("Total de softwares: %d\\n", n);
    return 0;
}
\`\`\``,
    complexity: { time: "O(n)", space: "O(n)" }
  },
  "pilha-de-numeros": {
    hints: [
      "Defina o nó: typedef struct no { int valor; struct no *prox; } No; e um ponteiro topo começando em NULL.",
      "Empilhar: aloque um nó, faça novo->prox = topo e depois topo = novo.",
      "Para imprimir, percorra de topo seguindo prox até NULL; se topo for NULL, imprima \"Lista vazia\"."
    ],
    editorial: `Inserir sempre no início de uma lista encadeada é exatamente uma pilha: o último que entra é o primeiro que sai.

\`\`\`c
typedef struct no { int valor; struct no *prox; } No;

No *empilhar(No *topo, int valor) {
    No *novo = malloc(sizeof(No));
    novo->valor = valor;
    novo->prox = topo;
    return novo;              /* o novo nó passa a ser o topo */
}

void imprimir(No *topo) {
    if (!topo) { printf("Lista vazia\\n"); return; }
    for (No *p = topo; p; p = p->prox)
        printf(p == topo ? "%d" : " %d", p->valor);
    printf("\\n");
}
\`\`\`

Cada inserção é O(1); a impressão é O(n). No fim, libere os nós com \`free\`.`,
    complexity: { time: "O(1) por inserção, O(n) para imprimir", space: "O(n)" }
  },
  "pilha-de-disciplinas": {
    hints: [
      "O nó guarda os quatro campos da disciplina e o ponteiro para o próximo nó.",
      "Leia cada campo com scanf(\" %40[^\\n]\", ...) (ajuste o tamanho de cada um) e insira no topo.",
      "Percorrer do topo já dá a ordem pedida: da última cadastrada para a primeira."
    ],
    editorial: `\`\`\`c
typedef struct disciplina {
    char sala[6], dia[16], nome[41], semestre[11];
    struct disciplina *prox;
} Disciplina;

Disciplina *topo = NULL;

void cadastrar(void) {
    Disciplina *d = malloc(sizeof(Disciplina));
    scanf(" %5[^\\n] %15[^\\n] %40[^\\n] %10[^\\n]", d->sala, d->dia, d->nome, d->semestre);
    d->prox = topo;
    topo = d;
}
\`\`\`

Depois do cabeçalho, imprima cada nó com \`printf("%s | %s | %s | %s\\n", ...)\` seguindo \`prox\`. Inserção O(1), listagem O(n).`,
    complexity: { time: "O(n)", space: "O(n)" }
  },
  "lista-encadeada-ordenada": {
    hints: [
      "Insira no fim mantendo um ponteiro para o último nó: assim cada inserção é O(1).",
      "Percorra a lista comparando cada nó com o próximo e registre se viu algum par crescente e algum decrescente.",
      "Se viu os dois tipos de par, a lista não está ordenada; listas com 0 ou 1 elemento são casos especiais."
    ],
    editorial: `\`\`\`c
int crescente = 1, decrescente = 1;
for (No *p = inicio; p && p->prox; p = p->prox) {
    if (p->valor > p->prox->valor) crescente = 0;
    if (p->valor < p->prox->valor) decrescente = 0;
}
if (!inicio) printf("Lista vazia\\n");
else if (crescente || decrescente) printf("A lista esta ordenada\\n");
else printf("A lista nao esta ordenada\\n");
\`\`\`

A inserção no fim usa um ponteiro \`fim\`: \`fim->prox = novo; fim = novo;\`. Uma única passada decide a resposta: tempo O(n).`,
    complexity: { time: "O(n)", space: "O(n)" }
  },
  "listas-nomes-em-comum": {
    hints: [
      "Monte L1 e L2 como listas encadeadas inserindo no fim, para preservar a ordem de leitura.",
      "Para cada nome de L1, procure-o em L2 (strcmp == 0) e, se achar, confira se ele já está em L3 antes de inserir.",
      "Leia com scanf(\" %29[^\\n]\", nome) e pare quando strcmp(nome, \"fim\") == 0."
    ],
    editorial: `\`\`\`c
int contem(No *lista, const char *nome) {
    for (No *p = lista; p; p = p->prox)
        if (strcmp(p->nome, nome) == 0) return 1;
    return 0;
}

for (No *p = l1; p; p = p->prox)
    if (contem(l2, p->nome) && !contem(l3, p->nome))
        inserirNoFim(&l3, p->nome);
\`\`\`

Com listas encadeadas, cada busca é O(n), então a interseção custa O(n·m). Com uma tabela hash (módulo de hash) ela cairia para O(n + m).`,
    complexity: { time: "O(n·m)", space: "O(n + m)" }
  },
  "lista-duplamente-encadeada": {
    hints: [
      "Cada nó tem prox e ant; mantenha dois ponteiros globais, inicio e fim.",
      "Inserir no início: novo->prox = inicio; se inicio existe, inicio->ant = novo; senão fim = novo. O fim é simétrico.",
      "O comando 4 começa em fim e segue ant até NULL."
    ],
    editorial: `\`\`\`c
typedef struct no { int valor; struct no *prox, *ant; } No;
No *inicio = NULL, *fim = NULL;

void inserirInicio(int x) {
    No *novo = malloc(sizeof(No));
    novo->valor = x; novo->ant = NULL; novo->prox = inicio;
    if (inicio) inicio->ant = novo; else fim = novo;
    inicio = novo;
}

void inserirFim(int x) {
    No *novo = malloc(sizeof(No));
    novo->valor = x; novo->prox = NULL; novo->ant = fim;
    if (fim) fim->prox = novo; else inicio = novo;
    fim = novo;
}
\`\`\`

Os dois ponteiros deixam as inserções nas pontas em O(1) e permitem percorrer nos dois sentidos. O erro clássico é esquecer de atualizar \`fim\` quando a lista estava vazia.`,
    complexity: { time: "O(1) por inserção, O(n) por impressão", space: "O(n)" }
  },
  "lista-circular": {
    hints: [
      "Numa lista circular, o último nó aponta para o primeiro; guarde um ponteiro para o último, assim você alcança o primeiro em O(1).",
      "Inserir no início: o novo nó aponta para o antigo primeiro e o último passa a apontar para o novo.",
      "Para imprimir uma volta, pare quando voltar ao nó inicial (use do-while); para k nós, conte k passos."
    ],
    editorial: `\`\`\`c
typedef struct no { int valor; struct no *prox; } No;
No *ultimo = NULL;   /* ultimo->prox é o primeiro */

void inserirInicio(int x) {
    No *novo = malloc(sizeof(No));
    novo->valor = x;
    if (!ultimo) { novo->prox = novo; ultimo = novo; }
    else { novo->prox = ultimo->prox; ultimo->prox = novo; }
}

void imprimirVolta(void) {
    if (!ultimo) { printf("Lista vazia\\n"); return; }
    No *p = ultimo->prox;
    do { printf(p == ultimo->prox ? "%d" : " %d", p->valor); p = p->prox; } while (p != ultimo->prox);
    printf("\\n");
}
\`\`\`

Percorrer k nós é só seguir \`prox\` k vezes a partir de \`ultimo->prox\`: as voltas acontecem naturalmente. Uma lista circular não tem \`NULL\` no fim, então um laço \`while (p)\` nunca termina.`,
    complexity: { time: "O(1) por inserção, O(k) por percurso", space: "O(n)" }
  }
};


function build(definition: ChallengeDefinition): Challenge {
  const module = SUBTOPIC_MODULES[definition.subtopic];
  if (!module) throw new Error(`Subtema sem modulo: ${definition.subtopic}`);
  const position = positions.get(module) ?? 0;
  positions.set(module, position + 1);
  return defineChallenge({
    slug: `ed-${definition.slug}`,
    title: definition.title,
    difficulty: definition.difficulty,
    points: definition.points,
    moduleId: moduleId(module),
    position,
    description: [
      definition.statement.replace(/^Adaptação para a correção automática: (.)/, (_, first: string) => first.toUpperCase()),
      "",
      `> Adaptado do exercício \`${definition.source}\` da disciplina de Estrutura de Dados para a correção automática. Enunciado original: “${definition.original}”`
    ].join("\n"),
    constraints: definition.constraints,
    tags: definition.tags,
    languages: [language("c", definition.rules)],
    hints: HELP[definition.slug]?.hints,
    editorial: HELP[definition.slug]?.editorial,
    complexity: HELP[definition.slug]?.complexity,
    publicCases: definition.publicCases,
    hiddenCases: definition.hiddenCases
  });
}

const PERSON_NAMES = [
  "Ana", "Ana Paula", "Anabela", "Beatriz Lima", "Bruno", "Carla", "Carlos", "Carlos Eduardo",
  "Daniel", "Eduardo", "Fabio", "Fernanda", "Gabriel", "Helena", "Igor", "Joana", "Joao",
  "Julia", "Laura", "Lucas", "Marcos", "Mariana", "Otavio", "Paula", "Pedro", "Rafael",
  "Sergio", "Silvia", "Tiago", "Ursula", "Vitor", "Wagner", "Yara", "Zeca"
];

function randomWord(random: () => number): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const length = randomInt(random, 2, 12);
  let word = "";
  for (let index = 0; index < length; index += 1) word += letters[randomInt(random, 0, 25)];
  return random() < 0.4 ? word[0].toUpperCase() + word.slice(1) : word;
}

// ---------- Recursividade ----------
function pitagoras(): Challenge {
  const random = createRandom(101);
  const term = (n: number) => (n * (n + 1)) / 2;
  const values = [2, 3, 4, 6, 7, 10, 25, 100, 1000, 9999, 10000];
  while (values.length < 22) values.push(randomInt(random, 1, 10000));
  return build({
    slug: "serie-de-pitagoras",
    title: "Série de Pitágoras recursiva",
    difficulty: "easy",
    points: 80,
    subtopic: "Recursividade",
    tags: ["Recursão"],
    source: "Recursividade/Pitagoras.cpp",
    original:
      "Construa um algoritmo que use recursividade para resolver o problema matemático da série de Pitágoras, sabendo que a série é 1, 3, 6, 10, 15, 21, ...",
    statement:
      "Leia um inteiro n e imprima o n-ésimo termo da série. O termo é a soma dos inteiros de 1 até n: pit(1) = 1 e pit(n) = n + pit(n - 1). A solução precisa ser recursiva e não pode usar laços.",
    constraints: [
      "Entrada: um inteiro n, com 1 <= n <= 10000.",
      "Saída: apenas o valor do n-ésimo termo.",
      "Obrigatório: função recursiva, sem for/while."
    ],
    rules: [recursionDepth(50), NO_LOOPS],
    publicCases: [
      { input: "1", output: "1" },
      { input: "5", output: "15" }
    ],
    hiddenCases: values.map((n) => ({ input: String(n), output: String(term(n)) }))
  });
}

function fatorial(): Challenge {
  const factorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * factorial(n - 1));
  const values = [1, 2, 3, 4, 6, 7, 10, 12, 13, 14, 15, 17, 18, 19, 20, 20, 11, 9, 8, 16];
  return build({
    slug: "fatorial-recursivo",
    title: "Fatorial recursivo",
    difficulty: "easy",
    points: 80,
    subtopic: "Recursividade",
    tags: ["Recursão"],
    source: "Recursividade/CalcularFatorial.cpp",
    original:
      "O arquivo não traz enunciado; ele calcula o fatorial de um número lido do teclado usando um laço for.",
    statement:
      "Leia um inteiro n e imprima n! (0! = 1). Resolva com uma função recursiva, sem laços. Atenção: 13! já não cabe em int; use long long (printf com %lld).",
    constraints: [
      "Entrada: um inteiro n, com 0 <= n <= 20.",
      "Saída: apenas o valor de n!.",
      "Obrigatório: função recursiva, sem for/while."
    ],
    rules: [recursionDepth(10), NO_LOOPS],
    publicCases: [
      { input: "5", output: "120" },
      { input: "0", output: "1" }
    ],
    hiddenCases: values.map((n) => ({ input: String(n), output: factorial(n).toString() }))
  });
}

function torreDeHanoi(): Challenge {
  const solve = (n: number): string => {
    const moves: string[] = [];
    const move = (disk: number, from: string, via: string, to: string) => {
      if (disk === 1) {
        moves.push(`Disco 1 de ${from} para ${to}`);
        return;
      }
      move(disk - 1, from, to, via);
      moves.push(`Disco ${disk} de ${from} para ${to}`);
      move(disk - 1, via, from, to);
    };
    move(n, "A", "B", "C");
    moves.push(`Total de movimentos: ${moves.length}`);
    return moves.join("\n");
  };
  return build({
    slug: "torre-de-hanoi",
    title: "Torre de Hanói",
    difficulty: "medium",
    points: 150,
    subtopic: "Recursividade",
    tags: ["Recursão"],
    source: "Recursividade/TorreHanoi.cpp",
    original:
      "O arquivo não traz enunciado; ele resolve a Torre de Hanói com 20 discos, imprimindo cada movimento com a função recursiva torrehanoi(ndisco, haste1, haste2, haste3).",
    statement:
      "Leia a quantidade de discos n. Todos começam na haste A e devem terminar na haste C, usando B como auxiliar. Imprima cada movimento no formato \"Disco k de X para Y\", na ordem da solução recursiva clássica (mover n-1 discos de A para B, mover o disco n de A para C, mover n-1 discos de B para C). Na última linha, imprima \"Total de movimentos: M\".",
    constraints: [
      "Entrada: um inteiro n, com 1 <= n <= 10.",
      "Saída: um movimento por linha e, por fim, o total de movimentos.",
      "Obrigatório: função recursiva, sem for/while."
    ],
    rules: [recursionDepth(6), NO_LOOPS],
    publicCases: [
      { input: "1", output: solve(1) },
      { input: "2", output: solve(2) }
    ],
    hiddenCases: [3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ input: String(n), output: solve(n) }))
  });
}

// ---------- Métodos de ordenação ----------
function funcionariosBubbleSort(): Challenge {
  const random = createRandom(202);
  type Employee = { name: string; cents: number };
  const render = (employees: Employee[]): CaseDefinition => {
    const byIndex = employees.map((employee, index) => ({ ...employee, index }));
    const line = (employee: Employee) => `${employee.name} - ${formatCents(employee.cents)}`;
    const ascending = [...byIndex].sort((a, b) => a.cents - b.cents || a.index - b.index);
    const descending = [...byIndex].sort((a, b) => b.cents - a.cents || a.index - b.index);
    const alphabetical = [...byIndex].sort((a, b) => byteOrder(a.name, b.name) || a.index - b.index);
    return {
      input: [String(employees.length), ...employees.map((employee) => `${formatCents(employee.cents)} ${employee.name}`)].join("\n"),
      output: [
        "Crescente por salario:",
        ...ascending.map(line),
        "Decrescente por salario:",
        ...descending.map(line),
        "Ordem alfabetica:",
        ...alphabetical.map(line)
      ].join("\n")
    };
  };
  const randomEmployees = (count: number, salaryPool?: number[]) =>
    Array.from({ length: count }, () => ({
      name: pick(random, PERSON_NAMES),
      cents: salaryPool ? pick(random, salaryPool) : randomInt(random, 100000, 2000000)
    }));

  const hidden: Employee[][] = [
    [{ name: "Pedro", cents: 350000 }],
    [
      { name: "Carla", cents: 250000 },
      { name: "Bruno", cents: 250000 },
      { name: "Ana", cents: 250000 }
    ],
    [
      { name: "Ana", cents: 100000 },
      { name: "Bruno", cents: 200000 },
      { name: "Carla", cents: 300000 },
      { name: "Daniel", cents: 400000 }
    ],
    [
      { name: "Daniel", cents: 400000 },
      { name: "Carla", cents: 300000 },
      { name: "Bruno", cents: 200000 },
      { name: "Ana", cents: 100000 }
    ],
    [
      { name: "Ana Paula", cents: 512345 },
      { name: "Ana", cents: 512345 },
      { name: "Anabela", cents: 199999 },
      { name: "Ana Paula", cents: 1999999 }
    ],
    [
      { name: "Zeca", cents: 100001 },
      { name: "Yara", cents: 100000 },
      { name: "Carlos Eduardo", cents: 2000000 },
      { name: "Carlos", cents: 150050 },
      { name: "Beatriz Lima", cents: 150050 }
    ]
  ];
  while (hidden.length < 20) {
    const count = randomInt(random, 5, 100);
    hidden.push(random() < 0.4 ? randomEmployees(count, [180000, 250000, 250050, 420000]) : randomEmployees(count));
  }

  return build({
    slug: "funcionarios-bubble-sort",
    title: "Funcionários com Bubble Sort",
    difficulty: "medium",
    points: 150,
    subtopic: "Ordenação",
    tags: ["Bubble Sort", "Struct"],
    source: "Metodos de Ordenação/Exercicio 1.cpp",
    original:
      "Faça um programa que cadastre o nome e o salário de 10 funcionário, liste todos os dados dos funcionários das seguintes formas: (use o Bubble sort) a) em ordem crescente de salário; b) em ordem decrescente de salário; c) em ordem alfabética;",
    statement:
      "Leia n funcionários e imprima as três listagens usando Bubble Sort. Cada funcionário aparece como \"nome - salario\" com duas casas decimais. Em empates (mesmo salário, ou mesmo nome na ordem alfabética), mantenha a ordem de cadastro: o Bubble Sort que só troca vizinhos fora de ordem já garante isso. A ordem alfabética é a da função strcmp.",
    constraints: [
      "Entrada: n (1 <= n <= 100) e depois n linhas no formato \"salario nome\"; o nome pode ter espaços e até 49 caracteres.",
      "Dica de leitura: scanf(\" %f %49[^\\n]\", &salario, nome).",
      "Saída: os títulos \"Crescente por salario:\", \"Decrescente por salario:\" e \"Ordem alfabetica:\", cada um seguido de n linhas.",
      "Salários entre 1000.00 e 20000.00. Não é permitido usar qsort."
    ],
    rules: [NO_QSORT, USES_STRUCT],
    publicCases: [
      render([
        { name: "Joana", cents: 350000 },
        { name: "Bruno", cents: 280050 },
        { name: "Carla Souza", cents: 510000 }
      ]),
      render([
        { name: "Marcos", cents: 200000 },
        { name: "Ana", cents: 200000 },
        { name: "Lucas", cents: 150000 }
      ])
    ],
    hiddenCases: hidden.map(render)
  });
}

function insertionSortMenor(): Challenge {
  const random = createRandom(303);
  const render = (values: number[]): CaseDefinition => {
    const sorted = [...values].sort((a, b) => a - b);
    const smallest = sorted[0];
    return {
      input: `${values.length}\n${values.join(" ")}`,
      output: [sorted.join(" "), `Menor: ${smallest}`, `Ocorrencias: ${sorted.filter((value) => value === smallest).length}`].join("\n")
    };
  };
  const hidden: number[][] = [
    [42],
    [7, 7, 7, 7, 7],
    [5, 4, 3, 2, 1],
    [1, 2, 3, 4, 5],
    [3, -1, 2, -1, 0, -1],
    [-1000000, 1000000, -1000000, 0],
    [9, 1, 8, 1, 7, 1, 6, 1, 5, 1, 4, 3, 2, 1, 1],
    [0, 0, -0, 0],
    // n máximo com todos iguais: contar repetições sem checar o limite
    // lê v[1000], fora do vetor, e o UBSan acusa.
    Array(1000).fill(-5)
  ];
  while (hidden.length < 20) {
    const count = randomInt(random, 2, 1000);
    const range = random() < 0.5 ? 10 : 1000000;
    hidden.push(Array.from({ length: count }, () => randomInt(random, -range, range)));
  }
  return build({
    slug: "insertion-sort-menor",
    title: "Insertion Sort: menor valor",
    difficulty: "easy",
    points: 100,
    subtopic: "Ordenação",
    tags: ["Insertion Sort", "Vetores"],
    source: "Metodos de Ordenação/Exercicio 2.cpp",
    original:
      "Faça um programa que cadastre 15 números inteiros, ordene-os usando o método insertion sort e em seguida encontre o menor número e quantas vezes ele apareceu no vetor.",
    statement:
      "Leia n inteiros, ordene-os com Insertion Sort e imprima: na primeira linha o vetor ordenado (valores separados por um espaço), depois \"Menor: X\" e \"Ocorrencias: K\". Cuidado ao contar repetições: o laço não pode passar do fim do vetor quando todos os valores são iguais.",
    constraints: [
      "Entrada: n (1 <= n <= 1000) e depois n inteiros entre -1000000 e 1000000.",
      "Saída: três linhas, como no exemplo.",
      "Não é permitido usar qsort."
    ],
    rules: [NO_QSORT],
    publicCases: [render([4, 2, 9, 2, 7]), render([10, -3, 5, -3, -3, 8])],
    hiddenCases: hidden.map(render)
  });
}

function selectionSortMaior(): Challenge {
  const random = createRandom(404);
  const render = (cents: number[]): CaseDefinition => {
    const sorted = [...cents].sort((a, b) => a - b);
    const largest = sorted[sorted.length - 1];
    return {
      input: `${cents.length}\n${cents.map(formatCents).join(" ")}`,
      output: [
        sorted.map(formatCents).join(" "),
        `Maior: ${formatCents(largest)}`,
        `Ocorrencias: ${sorted.filter((value) => value === largest).length}`
      ].join("\n")
    };
  };
  const hidden: number[][] = [
    [1234],
    [550, 550, 550],
    [100, 200, 300, 400, 500],
    [500, 400, 300, 200, 100],
    [1, 2, 3, 4, 6, 5],
    [99999, -99999, 99999, 12, 99999],
    [-150, -250, -50, -50],
    [300, 100, 200, 300, 50, 300, 10, 20, 30, 300]
  ];
  while (hidden.length < 20) {
    const count = randomInt(random, 2, 1000);
    const pool = Array.from({ length: randomInt(random, 3, 40) }, () => randomInt(random, -100000, 100000));
    hidden.push(Array.from({ length: count }, () => (random() < 0.5 ? pick(random, pool) : randomInt(random, -100000, 100000))));
  }
  return build({
    slug: "selection-sort-maior",
    title: "Selection Sort: maior valor",
    difficulty: "easy",
    points: 100,
    subtopic: "Ordenação",
    tags: ["Selection Sort", "Vetores"],
    source: "Metodos de Ordenação/Exercicio 3.cpp",
    original:
      "Faça um programa que cadastre 10 números reais, ordene-os usando o método selection sort e em seguida encontre o maior número e quantas vezes ele apareceu no vetor.",
    statement:
      "Leia n números reais, ordene-os com Selection Sort e imprima: o vetor ordenado com duas casas decimais (separado por espaços), \"Maior: X\" e \"Ocorrencias: K\". Garanta que a ordenação percorre o vetor inteiro, inclusive as duas últimas posições.",
    constraints: [
      "Entrada: n (1 <= n <= 1000) e depois n números com duas casas decimais, entre -1000.00 e 1000.00.",
      "Saída: três linhas; use printf(\"%.2f\").",
      "Não é permitido usar qsort."
    ],
    rules: [NO_QSORT],
    publicCases: [render([350, 120, 990, 990, 45]), render([-1050, 20025, -300, 20025, 20025, 0])],
    hiddenCases: hidden.map(render)
  });
}

function mergeSortVogais(): Challenge {
  const random = createRandom(505);
  const render = (words: string[]): CaseDefinition => {
    const sorted = [...words].sort(byteOrder);
    const vowels = sorted.filter((word) => /^[aeiouAEIOU]/.test(word));
    return {
      input: [String(words.length), ...words].join("\n"),
      output: ["Palavras ordenadas:", ...sorted, "Comecam com vogal:", ...(vowels.length ? vowels : ["Nenhuma"])].join("\n")
    };
  };
  const hidden: string[][] = [
    ["arvore"],
    ["casa", "bola", "dado"],
    ["Uva", "uva", "Ovo", "ovo", "Ema", "ema"],
    ["zebra", "Zebra", "amora", "Amora", "banana"],
    ["ab", "a", "abc", "b", "aa"],
    ["iglu", "iglu", "iglu"],
    ["Elefante", "gato", "Abacaxi", "urso", "Onca", "tatu", "Ilha"]
  ];
  while (hidden.length < 20) {
    hidden.push(Array.from({ length: randomInt(random, 2, 500) }, () => randomWord(random)));
  }
  return build({
    slug: "merge-sort-vogais",
    title: "Merge Sort: palavras que começam com vogal",
    difficulty: "medium",
    points: 150,
    subtopic: "Ordenação",
    tags: ["Merge Sort", "Strings", "Recursão"],
    source: "Metodos de Ordenação/Exercicio 4.cpp",
    original:
      "Faça um programa que cadastre 20 palavras em um vetor, ordene-os usando o método merge sort, em seguida encontre as palavras que começam vogais e mostre quais são elas.",
    statement:
      "Leia n palavras, ordene-as com Merge Sort (recursivo) pela ordem de strcmp, em que maiúsculas vêm antes das minúsculas, e imprima \"Palavras ordenadas:\" seguido de uma palavra por linha. Depois imprima \"Comecam com vogal:\" e as palavras ordenadas que começam com a, e, i, o ou u (maiúsculas ou minúsculas), ou \"Nenhuma\".",
    constraints: [
      "Entrada: n (1 <= n <= 500) e depois n palavras, uma por linha, só com letras e até 29 caracteres.",
      "Saída: as duas listagens, uma palavra por linha.",
      "Obrigatório: Merge Sort recursivo; não é permitido usar qsort."
    ],
    rules: [NO_QSORT, recursionDepth(5)],
    publicCases: [
      render(["laranja", "abacate", "Uva", "manga", "ervilha"]),
      render(["sol", "lua", "mar"])
    ],
    hiddenCases: hidden.map(render)
  });
}

function quickSortNumeros(): Challenge {
  const random = createRandom(606);
  const render = (values: number[]): CaseDefinition => ({
    input: `${values.length}\n${values.join(" ")}`,
    output: [...values].sort((a, b) => a - b).join(" ")
  });
  const ascending = Array.from({ length: 3000 }, (_, index) => index * 7 - 10000);
  const hidden: number[][] = [
    [5],
    [2, 1],
    [1, 2],
    Array(50).fill(3),
    ascending,
    [...ascending].reverse(),
    [1000000000, -1000000000, 0, 1000000000, -1000000000],
    Array.from({ length: 3000 }, () => randomInt(random, 0, 3))
  ];
  while (hidden.length < 20) {
    hidden.push(Array.from({ length: randomInt(random, 2, 3000) }, () => randomInt(random, -1000000000, 1000000000)));
  }
  return build({
    slug: "quick-sort-numeros",
    title: "Quick Sort de números",
    difficulty: "medium",
    points: 150,
    subtopic: "Ordenação",
    tags: ["Quick Sort", "Recursão"],
    source: "Metodos de Ordenação/Exercicio 5.cpp",
    original:
      "Construa um programa que gere um vetor 1000 números aleatórios mostre os números em tela e depois usando o método de ordenação quick sort ordene este vetor.",
    statement:
      "Adaptação para a correção automática: em vez de gerar números aleatórios com rand(), o programa lê o vetor da entrada. Ordene-o com Quick Sort (recursivo) e imprima os valores em ordem crescente, em uma única linha separada por espaços. Os testes incluem vetores já ordenados, invertidos e com muitos valores repetidos.",
    constraints: [
      "Entrada: n (1 <= n <= 3000) e depois n inteiros entre -1000000000 e 1000000000.",
      "Saída: uma linha com o vetor ordenado.",
      "Obrigatório: Quick Sort recursivo; não é permitido usar qsort."
    ],
    rules: [NO_QSORT, recursionDepth(5)],
    publicCases: [render([5, 3, 9, 1, 7, 3]), render([10, -2, 33, 0, -2, 8, 1])],
    hiddenCases: hidden.map(render)
  });
}

function quickSortLetras(): Challenge {
  const random = createRandom(707);
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const pair = () => letters[randomInt(random, 0, 25)] + letters[randomInt(random, 0, 25)];
  const render = (values: string[]): CaseDefinition => ({
    input: [String(values.length), ...values].join("\n"),
    output: [...values].sort(byteOrder).join("\n")
  });
  const hidden: string[][] = [
    ["ZZ"],
    ["AA", "AA", "AA"],
    ["AB", "BA", "AA", "BB"],
    ["ZY", "ZX", "YZ", "AZ", "ZA"],
    Array.from({ length: 26 }, (_, index) => letters[25 - index] + "A"),
    Array.from({ length: 26 * 4 }, (_, index) => letters[index % 26] + letters[Math.floor(index / 26)])
  ];
  while (hidden.length < 20) {
    hidden.push(Array.from({ length: randomInt(random, 2, 1000) }, pair));
  }
  return build({
    slug: "quick-sort-letras",
    title: "Quick Sort de combinações de letras",
    difficulty: "medium",
    points: 150,
    subtopic: "Ordenação",
    tags: ["Quick Sort", "Strings", "Recursão"],
    source: "Metodos de Ordenação/Exercicio 6.cpp",
    original:
      "Elabore um programa que gere uma combinação de duas letras em um vetor de 100 posições, usando o método de ordenação quick sort ordene este vetor de letras e mostre na tela.",
    statement:
      "Adaptação para a correção automática: as combinações são lidas da entrada em vez de geradas com rand(). Cada combinação tem duas letras maiúsculas. Ordene o vetor com Quick Sort (recursivo), comparando com strcmp, e imprima uma combinação por linha.",
    constraints: [
      "Entrada: n (1 <= n <= 1000) e depois n combinações de duas letras maiúsculas, uma por linha.",
      "Saída: as combinações em ordem crescente, uma por linha.",
      "Obrigatório: Quick Sort recursivo; não é permitido usar qsort."
    ],
    rules: [NO_QSORT, recursionDepth(5)],
    publicCases: [render(["QK", "AB", "ZZ", "AA", "MN"]), render(["BA", "AB", "BA"])],
    hiddenCases: hidden.map(render)
  });
}

// ---------- Listas estáticas ----------
function listaEstaticaMedia(): Challenge {
  const random = createRandom(808);
  const render = (cents: number[]): CaseDefinition => ({
    input: cents.map(formatCents).join(" "),
    output: `Media: ${formatCents(cents.reduce((total, value) => total + value, 0) / 6)}`
  });
  // A soma é sempre múltipla de 6 centavos: a média é exata com duas casas,
  // longe de qualquer empate de arredondamento entre float e double.
  const exactMean = (): number[] => {
    for (;;) {
      const values = Array.from({ length: 5 }, () => randomInt(random, -100000, 100000));
      const rest = values.reduce((total, value) => total + value, 0);
      let last = randomInt(random, -100000, 100000);
      last -= ((rest + last) % 6 + 6) % 6;
      const total = rest + last;
      if (last >= -100000 && total !== 0) return [...values, last];
    }
  };
  const hidden: number[][] = [
    [0, 0, 0, 0, 0, 0],
    [100, 100, 100, 100, 100, 100],
    [-600, -600, -600, -600, -600, -600],
    [100000, 100000, 100000, 100000, 100000, 100000],
    [150, 250, 350, 450, 550, 650],
    [-100000, 100000, -100000, 100000, -100000, 100006]
  ];
  while (hidden.length < 20) hidden.push(exactMean());
  return build({
    slug: "lista-estatica-media",
    title: "Lista estática: média de seis números",
    difficulty: "easy",
    points: 80,
    subtopic: "Listas Estáticas",
    tags: ["Vetores"],
    source: "Listas Estaticas e Dinamicas/Exercicio 1.cpp",
    original:
      "Construa um algoritmo que contenha uma lista estática homogênea para guardar seis números reais, solicite ao usuário os números e apresente para ele a média dos números.",
    statement:
      "Leia seis números reais, guarde-os em uma lista estática (vetor de tamanho fixo) e imprima \"Media: X\" com duas casas decimais.",
    constraints: [
      "Entrada: seis números entre -1000.00 e 1000.00, separados por espaço.",
      "Saída: \"Media: X\" com printf(\"%.2f\").",
      "Obrigatório: vetor estático, sem malloc/calloc/realloc."
    ],
    rules: [STATIC_ONLY],
    publicCases: [render([100, 200, 300, 400, 500, 600]), render([1050, -250, 330, 1270, 0, 6])],
    hiddenCases: hidden.map(render)
  });
}

function listaEstaticaSoftwares(): Challenge {
  const random = createRandom(909);
  type Software = [string, string, string, string];
  const names = ["Visual Studio Code", "LibreOffice", "GIMP", "Blender", "Photoshop", "IntelliJ IDEA", "Firefox", "PostgreSQL", "Docker Desktop", "Slack", "Figma", "Excel"];
  const vendors = ["Microsoft", "The Document Foundation", "GNOME", "Blender Foundation", "Adobe", "JetBrains", "Mozilla", "PostgreSQL Global Development Group", "Docker Inc", "Salesforce"];
  const licenses = ["MIT", "GPL v3", "MPL 2.0", "Proprietaria", "Apache 2.0", "Freeware", "LGPL"];
  const versions = ["1.0", "2.3.1", "24.04", "7", "2026.1", "10.2 beta", "3.14.159"];
  const randomSoftware = (): Software => [pick(random, names), pick(random, vendors), pick(random, licenses), pick(random, versions)];
  const render = (softwares: Software[]): CaseDefinition => ({
    input: [String(softwares.length), ...softwares.flat()].join("\n"),
    output: [
      ...softwares.map((software, index) => `${index + 1}. ${software.join(" | ")}`),
      `Total de softwares: ${softwares.length}`
    ].join("\n")
  });
  const hidden: Software[][] = [
    [["Nano", "GNU", "GPL v3", "8.0"]],
    [["A", "B", "C", "D"], ["E", "F", "G", "H"]],
    [["Nome Com Varias Palavras E Bem Comprido Ate 49 Ch", "Fabricante Com Espacos", "Licenca Livre", "Versao 1.2.3 LTS"]]
  ];
  while (hidden.length < 18) hidden.push(Array.from({ length: randomInt(random, 1, 50) }, randomSoftware));
  return build({
    slug: "lista-estatica-softwares",
    title: "Lista estática heterogênea: cadastro de softwares",
    difficulty: "easy",
    points: 100,
    subtopic: "Listas Estáticas",
    tags: ["Struct", "Strings"],
    source: "Listas Estaticas e Dinamicas/Exercicio 2.cpp",
    original:
      "Construa um algoritmo que contenha uma lista estática heterogênea para guardar dados cadastrais de dez softwares, solicite ao usuário digitar, nome, fabricante, tipo de licença e versão.",
    statement:
      "Leia n softwares em um vetor de structs (nome, fabricante, licença e versão) e imprima o cadastro, um software por linha, no formato \"i. nome | fabricante | licenca | versao\", numerando a partir de 1. Na última linha, imprima \"Total de softwares: n\".",
    constraints: [
      "Entrada: n (1 <= n <= 50) e, para cada software, quatro linhas: nome, fabricante, licença e versão (cada uma com até 49 caracteres, podendo conter espaços).",
      "Dica de leitura: scanf(\" %49[^\\n]\", campo) lê a linha inteira.",
      "Obrigatório: struct em vetor estático, sem malloc."
    ],
    rules: [USES_STRUCT, STATIC_ONLY],
    publicCases: [
      render([
        ["Visual Studio Code", "Microsoft", "MIT", "1.93"],
        ["GIMP", "GNOME", "GPL v3", "2.10"]
      ]),
      render([["Blender", "Blender Foundation", "GPL v2", "4.2 LTS"]])
    ],
    hiddenCases: hidden.map(render)
  });
}

// ---------- Pilhas (lista dinâmica com inserção no topo) ----------
function pilhaNumeros(): Challenge {
  const random = createRandom(1001);
  const render = (values: number[]): CaseDefinition => ({
    input: `${values.length}\n${values.join(" ")}`.trim(),
    output: values.length ? [...values].reverse().join(" ") : "Lista vazia"
  });
  const hidden: number[][] = [[], [7], [1, 2], [5, 5, 5], [-3, 0, 3], [2147483647, -2147483648]];
  while (hidden.length < 20) {
    hidden.push(Array.from({ length: randomInt(random, 2, 1000) }, () => randomInt(random, -1000000, 1000000)));
  }
  return build({
    slug: "pilha-de-numeros",
    title: "Lista dinâmica de números (pilha)",
    difficulty: "easy",
    points: 100,
    subtopic: "Pilhas",
    tags: ["Lista Dinâmica", "Ponteiros"],
    source: "Pilhas/Exercicio01.cpp",
    original:
      "Construa um algoritmo que contenha uma lista dinâmica homogênea para guardar números digitados pelo usuário, solicite ao usuário a quantidade de número e os números e depois os imprima em tela.",
    statement:
      "Leia a quantidade n e os n números, inserindo cada um no topo de uma lista dinâmica (pilha). Depois percorra a lista a partir do topo e imprima os números em uma única linha, separados por espaço, portanto do último lido para o primeiro. Se n for 0, imprima \"Lista vazia\".",
    constraints: [
      "Entrada: n (0 <= n <= 1000) e depois n inteiros do tipo int.",
      "Saída: os números do topo para a base, ou \"Lista vazia\".",
      "Obrigatório: nós alocados com malloc; não use vetores."
    ],
    rules: [...LINKED_LIST_RULES, NO_ARRAYS],
    publicCases: [render([10, 20, 30]), render([])],
    hiddenCases: hidden.map(render)
  });
}

function pilhaDisciplinas(): Challenge {
  const random = createRandom(1102);
  type Course = [string, string, string, string];
  const rooms = ["A12", "B03", "C101", "LAB2", "D7", "E204"];
  const days = ["Segunda-feira", "Terca-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sabado"];
  const subjects = ["Estrutura de Dados", "Calculo I", "Banco de Dados", "Redes de Computadores", "Engenharia de Software", "Algoritmos", "Sistemas Operacionais", "Compiladores", "Inteligencia Artificial", "Etica"];
  const terms = ["1", "2", "3", "2026.1", "2026.2", "10"];
  const randomCourse = (): Course => [pick(random, rooms), pick(random, days), pick(random, subjects), pick(random, terms)];
  const render = (courses: Course[]): CaseDefinition => ({
    input: [String(courses.length), ...courses.flat()].join("\n"),
    output: courses.length
      ? ["SALA | DIA | NOME | SEMESTRE", ...[...courses].reverse().map((course) => course.join(" | "))].join("\n")
      : "Nenhuma disciplina cadastrada"
  });
  const hidden: Course[][] = [[], [["X1", "Sabado", "Etica", "1"]]];
  while (hidden.length < 18) hidden.push(Array.from({ length: randomInt(random, 1, 200) }, randomCourse));
  return build({
    slug: "pilha-de-disciplinas",
    title: "Lista dinâmica heterogênea: disciplinas",
    difficulty: "medium",
    points: 150,
    subtopic: "Pilhas",
    tags: ["Lista Dinâmica", "Struct", "Ponteiros"],
    source: "Pilhas/Exercicio02.cpp",
    original:
      "Construa um algoritmo que contenha uma lista dinâmica heterogênea onde o usuário deverá informar quantidade de disciplinas que ele tem e os dados de cada disciplina como: sala, dia da semana, nome disciplina e semestre e depois o algoritmo deve imprimir estes dados em tela.",
    statement:
      "Adaptação para a correção automática: no lugar do menu interativo (system(\"cls\") e getch() não existem aqui), o programa lê n disciplinas e as insere no topo de uma lista dinâmica. Depois imprima o cabeçalho \"SALA | DIA | NOME | SEMESTRE\" e uma linha por disciplina, percorrendo do topo (última cadastrada) para a base. Se n for 0, imprima \"Nenhuma disciplina cadastrada\".",
    constraints: [
      "Entrada: n (0 <= n <= 200) e, para cada disciplina, quatro linhas: sala (até 5 caracteres), dia da semana (até 15), nome (até 40) e semestre (até 10).",
      "Saída: cabeçalho e disciplinas no formato \"sala | dia | nome | semestre\".",
      "Obrigatório: nós alocados com malloc, com ponteiro para o próximo nó."
    ],
    rules: [...LINKED_LIST_RULES, USES_STRUCT],
    publicCases: [
      render([
        ["B03", "Segunda-feira", "Estrutura de Dados", "3"],
        ["LAB2", "Quarta-feira", "Banco de Dados", "4"]
      ]),
      render([])
    ],
    hiddenCases: hidden.map(render)
  });
}

// ---------- Listas encadeadas ----------
function listaEncadeadaOrdenada(): Challenge {
  const random = createRandom(1203);
  const verdict = (values: number[]) => {
    if (values.length === 0) return "Lista vazia";
    const ascending = values.every((value, index) => index === 0 || values[index - 1] < value);
    const descending = values.every((value, index) => index === 0 || values[index - 1] > value);
    return ascending || descending ? "A lista esta ordenada" : "A lista nao esta ordenada";
  };
  const render = (values: number[]): CaseDefinition => ({
    input: [...values, -1].join(" "),
    output: verdict(values)
  });
  const distinct = (count: number) => shuffle(random, Array.from({ length: count * 3 }, (_, index) => index)).slice(0, count);
  const bigAscending = Array.from({ length: 2000 }, (_, index) => index * 2);
  const almost = [...bigAscending];
  [almost[1998], almost[1999]] = [almost[1999], almost[1998]];
  const hidden: number[][] = [
    [],
    [42],
    [1, 2],
    [2, 1],
    [5, 4, 3, 2, 1],
    [2, 1, 3, 4, 5],
    [1, 3, 2],
    [1, 5, 2, 6, 3],
    bigAscending,
    [...bigAscending].reverse(),
    almost,
    [0, 1000000]
  ];
  while (hidden.length < 20) {
    const values = distinct(randomInt(random, 3, 500));
    const mode = random();
    hidden.push(mode < 0.3 ? values.sort((a, b) => a - b) : mode < 0.6 ? values.sort((a, b) => b - a) : values);
  }
  return build({
    slug: "lista-encadeada-ordenada",
    title: "Lista encadeada: está ordenada?",
    difficulty: "easy",
    points: 100,
    subtopic: "Listas Encadeadas",
    tags: ["Lista Simplesmente Encadeada", "Ponteiros"],
    source: "Arvores/Exercicio1.c",
    original:
      "Elabore um algoritmo que leia uma sequência de números, armazenando-os numa lista simplesmente encadeada e que, em seguida, verifique se a lista linear encadeada está ordenada. Suponha que a lista não contenha números repetidos.",
    statement:
      "Leia números inteiros não negativos até encontrar -1 (que não entra na lista), inserindo cada um no fim de uma lista simplesmente encadeada. Considere a lista ordenada se estiver em ordem crescente ou decrescente; uma lista com um único elemento está ordenada. Imprima \"A lista esta ordenada\", \"A lista nao esta ordenada\" ou, se nenhum número for lido, \"Lista vazia\".",
    constraints: [
      "Entrada: até 2000 inteiros distintos entre 0 e 1000000, terminados por -1.",
      "Saída: uma das três mensagens, sem acentos.",
      "Obrigatório: nós alocados com malloc; não use vetores."
    ],
    rules: [...LINKED_LIST_RULES, NO_ARRAYS],
    publicCases: [render([1, 4, 9, 12]), render([8, 3, 5])],
    hiddenCases: hidden.map(render)
  });
}

function nomesEmComum(): Challenge {
  const random = createRandom(1304);
  const render = (first: string[], second: string[]): CaseDefinition => {
    const inSecond = new Set(second);
    const common = [...new Set(first.filter((name) => inSecond.has(name)))];
    return {
      input: [...first, "fim", ...second, "fim"].join("\n"),
      output: common.length
        ? ["Nomes presentes em ambas as listas:", ...common].join("\n")
        : "As listas nao possuem nomes em comum."
    };
  };
  const hidden: Array<[string[], string[]]> = [
    [[], ["Ana"]],
    [["Ana"], []],
    [[], []],
    [["Ana", "Bruno"], ["Carla", "Daniel"]],
    [["Ana", "Bruno"], ["Bruno", "Ana"]],
    [["Joana", "Joana", "Pedro"], ["Joana"]],
    [["joana", "Pedro"], ["Joana", "pedro"]],
    [["Ana Paula", "Ana"], ["Ana", "Paula"]],
    [["Carlos Eduardo"], ["Carlos", "Eduardo", "Carlos Eduardo"]]
  ];
  while (hidden.length < 20) {
    const pool = shuffle(random, PERSON_NAMES).slice(0, randomInt(random, 4, PERSON_NAMES.length));
    const list = () => Array.from({ length: randomInt(random, 1, 300) }, () => pick(random, pool));
    hidden.push([list(), list()]);
  }
  return build({
    slug: "listas-nomes-em-comum",
    title: "Listas encadeadas: nomes em comum",
    difficulty: "medium",
    points: 150,
    subtopic: "Listas Encadeadas",
    tags: ["Lista Simplesmente Encadeada", "Strings", "Ponteiros"],
    source: "Arvores/Exercicio2.c",
    original:
      "Faça um algoritmo que leia duas sequências de nomes de pessoas e armazene-os em duas listas simplesmente encadeadas L1 e L2, respectivamente. Em seguida, o programa deve criar uma terceira lista encadeada, contendo os nomes comuns às duas listas e mostrar a lista resultante. Exemplo: L1 = Joana, Laura, Sérgio, Fábio. L2 = Anita, Joaquim, Fábio, Joana, Pedro, Sílvia. L3 = Joana, Fábio.",
    statement:
      "Leia os nomes da primeira lista, um por linha, até a linha \"fim\"; depois os da segunda, também até \"fim\". Monte L3 com os nomes que aparecem nas duas listas, na ordem em que aparecem em L1 e sem repetir nomes. Imprima \"Nomes presentes em ambas as listas:\" e um nome por linha ou, se não houver nenhum, \"As listas nao possuem nomes em comum.\". A comparação diferencia maiúsculas de minúsculas.",
    constraints: [
      "Entrada: até 300 nomes por lista, com até 29 caracteres (podem ter espaços), cada lista terminada pela linha \"fim\".",
      "Saída: o título seguido dos nomes de L3, ou a mensagem de listas sem nomes em comum.",
      "Obrigatório: as três listas devem ser encadeadas, com nós alocados com malloc."
    ],
    rules: [...LINKED_LIST_RULES],
    publicCases: [
      render(["Joana", "Laura", "Sergio", "Fabio"], ["Anita", "Joaquim", "Fabio", "Joana", "Pedro", "Silvia"]),
      render(["Ana", "Bruno"], ["Carla"])
    ],
    hiddenCases: hidden.map(([first, second]) => render(first, second))
  });
}

type ListOperation = [number] | [number, number];

function listaDuplamenteEncadeada(): Challenge {
  const random = createRandom(1405);
  const render = (operations: ListOperation[]): CaseDefinition => {
    const values: number[] = [];
    const output: string[] = [];
    for (const [code, value] of operations) {
      if (code === 1) values.unshift(value!);
      else if (code === 2) values.push(value!);
      else if (code === 3) output.push(values.length ? values.join(" ") : "Lista vazia");
      else if (code === 4) output.push(values.length ? [...values].reverse().join(" ") : "Lista vazia");
    }
    return {
      input: [...operations.map((operation) => operation.join(" ")), "0"].join("\n"),
      output: output.join("\n")
    };
  };
  const randomOperations = (count: number): ListOperation[] =>
    Array.from({ length: count }, (): ListOperation => {
      const roll = random();
      if (roll < 0.45) return [1, randomInt(random, -1000, 1000)];
      if (roll < 0.9) return [2, randomInt(random, -1000, 1000)];
      return [roll < 0.95 ? 3 : 4];
    });
  const hidden: ListOperation[][] = [
    [[3], [4]],
    [[1, 5], [3], [4]],
    [[2, 5], [3], [4]],
    [[1, 1], [1, 2], [1, 3], [3], [4]],
    [[2, 1], [2, 2], [2, 3], [3], [4]],
    [[3], [2, 9], [4], [1, 8], [3], [4], [2, 7], [3], [4]]
  ];
  while (hidden.length < 20) hidden.push([...randomOperations(randomInt(random, 5, 400)), [3], [4]]);
  return build({
    slug: "lista-duplamente-encadeada",
    title: "Lista duplamente encadeada",
    difficulty: "hard",
    points: 200,
    subtopic: "Listas Encadeadas",
    tags: ["Lista Duplamente Encadeada", "Ponteiros"],
    source: "Arvores/Exercicio3.c",
    original:
      "Faça um algoritmo que aplique o conceito de uma lista duplamente encadeada na inserção e impressão de dados na lista.",
    statement:
      "Adaptação para a correção automática: o menu vira uma sequência de comandos, um por linha. \"1 x\" insere x no início; \"2 x\" insere x no fim; \"3\" imprime a lista do início ao fim; \"4\" imprime do fim ao início; \"0\" encerra. Cada impressão ocupa uma linha, com os valores separados por espaço, ou \"Lista vazia\". Mantenha os ponteiros de início e de fim e os links prox e ant de cada nó: o comando 4 deve percorrer a lista pelos ponteiros ant.",
    constraints: [
      "Entrada: até 500 comandos, terminados por \"0\"; valores inteiros entre -1000 e 1000.",
      "Saída: uma linha por comando de impressão.",
      "Obrigatório: nó com ponteiros para o próximo e para o anterior, alocado com malloc; não use vetores."
    ],
    rules: [USES_MALLOC, DOUBLY_LINKED_NODE, NO_ARRAYS],
    publicCases: [
      render([[1, 10], [1, 20], [2, 5], [3], [4]]),
      render([[3], [2, 1], [4]])
    ],
    hiddenCases: hidden.map(render)
  });
}

function listaCircular(): Challenge {
  const random = createRandom(1506);
  const render = (operations: ListOperation[]): CaseDefinition => {
    const values: number[] = [];
    const output: string[] = [];
    for (const [code, value] of operations) {
      if (code === 1) values.unshift(value!);
      else if (code === 2) output.push(values.length ? values.join(" ") : "Lista vazia");
      else if (code === 3) {
        output.push(
          values.length
            ? Array.from({ length: value! }, (_, index) => values[index % values.length]).join(" ")
            : "Lista vazia"
        );
      }
    }
    return {
      input: [...operations.map((operation) => operation.join(" ")), "0"].join("\n"),
      output: output.join("\n")
    };
  };
  const hidden: ListOperation[][] = [
    [[2], [3, 4]],
    [[1, 7], [2], [3, 1], [3, 5]],
    [[1, 1], [1, 2], [1, 3], [2], [3, 7]],
    [[1, 4], [3, 1000]],
    [[1, 1], [1, 2], [3, 2], [1, 3], [3, 4], [2]]
  ];
  while (hidden.length < 20) {
    const operations: ListOperation[] = Array.from({ length: randomInt(random, 5, 400) }, (): ListOperation => {
      const roll = random();
      if (roll < 0.85) return [1, randomInt(random, -1000, 1000)];
      if (roll < 0.92) return [2];
      return [3, randomInt(random, 1, 50)];
    });
    hidden.push([...operations, [2], [3, randomInt(random, 1, 1000)]]);
  }
  return build({
    slug: "lista-circular",
    title: "Lista simplesmente encadeada circular",
    difficulty: "medium",
    points: 150,
    subtopic: "Listas Encadeadas",
    tags: ["Lista Circular", "Ponteiros"],
    source: "Arvores/Exercicio4.c",
    original:
      "Faça um algoritmo que aplique o conceito de uma lista simplesmente encadeada circular na inserção e impressão de dados na lista.",
    statement:
      "Adaptação para a correção automática: o menu vira uma sequência de comandos, um por linha. \"1 x\" insere x no início da lista circular (o último nó continua apontando para o primeiro); \"2\" imprime a lista inteira uma vez, a partir do início; \"3 k\" percorre k nós seguindo os ponteiros a partir do início, dando voltas se k passar do tamanho, e imprime os k valores; \"0\" encerra. Cada impressão ocupa uma linha, com os valores separados por espaço, ou \"Lista vazia\".",
    constraints: [
      "Entrada: até 500 comandos, terminados por \"0\"; valores entre -1000 e 1000; 1 <= k <= 1000.",
      "Saída: uma linha por comando 2 ou 3.",
      "Obrigatório: nós alocados com malloc, formando uma lista circular; não use vetores."
    ],
    rules: [...LINKED_LIST_RULES, NO_ARRAYS],
    publicCases: [
      render([[1, 3], [1, 2], [1, 1], [2], [3, 7]]),
      render([[2], [1, 9], [3, 3]])
    ],
    hiddenCases: hidden.map(render)
  });
}

export function buildDataStructureChallenges(): Challenge[] {
  positions.clear();
  return [
    pitagoras(),
    fatorial(),
    torreDeHanoi(),
    funcionariosBubbleSort(),
    insertionSortMenor(),
    selectionSortMaior(),
    mergeSortVogais(),
    quickSortNumeros(),
    quickSortLetras(),
    listaEstaticaMedia(),
    listaEstaticaSoftwares(),
    pilhaNumeros(),
    pilhaDisciplinas(),
    listaEncadeadaOrdenada(),
    nomesEmComum(),
    listaDuplamenteEncadeada(),
    listaCircular()
  ];
}
