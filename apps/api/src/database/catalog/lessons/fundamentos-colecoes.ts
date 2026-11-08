import type { LessonDefinition } from "./index.js";

/**
 * Lições dos módulos vetores, matrizes e strings da trilha
 * "Fundamentos de Programação".
 */

const VETORES = `
# Vetores

Até aqui, cada variável guardava um valor só. Mas muitos problemas falam de **coleções**: as notas de uma turma, as temperaturas da semana, os preços de um carrinho. Um **vetor** (também chamado de *array* ou lista) guarda vários valores em sequência, sob um único nome.

## Índices

Cada posição do vetor tem um número, o **índice**. Nas três linguagens do CodeLab, o primeiro índice é **0** e o último é **n - 1**, em que n é o tamanho do vetor.

| Índice | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Valor | 7 | 3 | 9 | 1 |

Acessar \`v[4]\` nesse vetor é um erro: a posição não existe. Em JavaScript você recebe \`undefined\`, em Python um \`IndexError\` e, em C, lixo de memória ou um travamento. Em C o vetor também não "sabe" o próprio tamanho: por isso as funções recebem, junto com \`nums\`, o parâmetro \`numsSize\`.

## Percorrer: o laço que você vai escrever mil vezes

Quase todo problema de vetor começa com um laço que visita cada posição:

\`\`\`c
long long soma = 0;              // acumulador
int maior = nums[0];             // candidato inicial
for (int i = 0; i < numsSize; i++) {
    soma += nums[i];             // acumula
    if (nums[i] > maior) {       // compara e atualiza
        maior = nums[i];
    }
}
\`\`\`

Esse trecho junta os três padrões mais comuns do módulo:

- **Acumulador**: uma variável que começa neutra (0 para soma, 1 para produto) e recebe cada elemento.
- **Contador**: uma variável que começa em 0 e ganha 1 sempre que uma condição é verdadeira.
- **Candidato**: o "melhor até agora" (maior, menor, primeiro que satisfaz algo), atualizado a cada comparação.

Em JavaScript e Python você também pode percorrer os valores direto, sem índice:

\`\`\`js
let pares = 0;
for (const valor of nums) {
  if (valor % 2 === 0) pares++;
}
\`\`\`

Use o índice quando precisar saber **onde** o valor está, ou quando for comparar posições diferentes, como \`nums[i]\` com \`nums[i - 1]\`.

## Dois índices

Alguns problemas ficam simples com **dois índices** andando ao mesmo tempo. Para inverter um vetor, \`i\` começa no início e \`j\` no fim; você troca \`nums[i]\` com \`nums[j]\` e aproxima os dois até se cruzarem. Para remover repetidos de um vetor ordenado, um índice **lê** e o outro marca onde **escrever** o próximo valor novo.

## O resto da divisão como "volta"

Quando um índice passa do fim e precisa recomeçar do início, o operador \`%\` resolve: \`(i + k) % n\` sempre fica entre 0 e n - 1. É a ideia por trás de rotacionar um vetor.

## Armadilhas comuns

- **Erro de limite (off-by-one)**: \`i <= n\` acessa uma posição que não existe; \`i < n - 1\` esquece a última. Teste sempre com um vetor de um elemento.
- **Valor inicial errado**: começar o maior com 0 falha quando todos os números são negativos. Comece com o primeiro elemento.
- **Vetor vazio**: se o enunciado permite, pense no que a função deve devolver quando o laço não roda nenhuma vez.
- **Estouro**: em C, somar muitos \`int\` grandes estoura o limite de cerca de 2,1 bilhões. Use \`long long\` no acumulador.
- **Repetidos**: "segundo maior" quer um valor **distinto**; ordenar e pegar o penúltimo falha quando o maior aparece duas vezes.

## Complexidade

Percorrer o vetor uma vez custa **O(n)**: o tempo cresce na mesma proporção do tamanho. Dois laços aninhados sobre o mesmo vetor custam **O(n²)**, o que já é lento demais com 100 mil elementos. Sempre que possível, resolva numa única passada.

## Pratique

1. **Soma do vetor**: o acumulador, com cuidado para o tipo.
2. **Maior e menor do vetor**: candidatos com o valor inicial certo.
3. **Inverter vetor**: dois índices, sem atalhos prontos.
4. **Contar ocorrências**: o contador e os limites do laço.
5. **Remover duplicados de um vetor ordenado**: índice de leitura e de escrita.
6. **Segundo maior valor**: dois candidatos numa passada.
7. **Rotacionar vetor** (desafio do módulo): o resto da divisão para lidar com um k gigante.
`;

const MATRIZES = `
# Matrizes

Uma **matriz** é uma tabela de valores organizada em **linhas** e **colunas**: um tabuleiro, uma planilha, os pixels de uma imagem. Na programação, ela é um **vetor de vetores**: cada elemento do vetor externo é uma linha, e cada linha é um vetor com os valores das colunas.

\`\`\`js
const m = [
  [1, 2, 3],   // linha 0
  [4, 5, 6],   // linha 1
];
// m[1][2] é a linha 1, coluna 2: vale 6
\`\`\`

O primeiro índice é sempre a **linha** e o segundo, a **coluna**. Uma matriz com m linhas e n colunas é chamada de matriz **m x n**; a do exemplo é 2 x 3. Quando m = n, ela é **quadrada**.

## Percorrer: laços aninhados

Para visitar todos os elementos, usamos um laço para as linhas e, dentro dele, outro para as colunas:

\`\`\`c
int soma = 0;
for (int i = 0; i < linhas; i++) {
    for (int j = 0; j < colunas; j++) {
        soma += matriz[i][j];
    }
}
\`\`\`

No CodeLab, em C, a matriz chega no estilo do LeetCode: \`int** matriz\`, com \`matrizSize\` linhas e \`matrizColSize[i]\` colunas na linha i. Para **devolver** uma matriz em C, você aloca com \`malloc\` o vetor de linhas, cada linha e o vetor \`*returnColumnSizes\`, e informa o número de linhas em \`*returnSize\`.

## Padrões de índices

Muitos problemas de matriz são, na verdade, problemas de **índices**. Vale decorar alguns:

| O que | Índices |
| --- | --- |
| Diagonal principal | \`[i][i]\` |
| Diagonal secundária (n x n) | \`[i][n - 1 - i]\` |
| Transposta | \`resultado[j][i] = matriz[i][j]\` |
| Linha i inteira | \`[i][0]\` até \`[i][n - 1]\` |
| Coluna j inteira | \`[0][j]\` até \`[m - 1][j]\` |

Repare que uma diagonal não precisa de dois laços: um só, de 0 a n - 1, basta.

## Multiplicação de matrizes

O produto de uma matriz m x n por uma n x p é uma matriz m x p, em que cada elemento combina **uma linha da primeira** com **uma coluna da segunda**: \`c[i][j] = soma de a[i][k] * b[k][j]\` para k de 0 a n - 1. São três laços aninhados, e a multiplicação só existe quando as colunas de \`a\` são tantas quanto as linhas de \`b\`.

## Simulação com limites

Em percursos mais elaborados, como a **espiral**, em vez de pensar em fórmulas guardamos **limites**: topo, baixo, esquerda e direita. Cada lado percorrido "encolhe" um deles. É o mesmo raciocínio dos dois índices do módulo de vetores, agora em duas dimensões.

## Armadilhas comuns

- **Confundir linha e coluna**: \`m[j][i]\` no lugar de \`m[i][j]\` só dá certo por acaso em matrizes quadradas e simétricas.
- **Supor matriz quadrada**: usar o número de linhas para as duas dimensões quebra com matrizes retangulares. Guarde m e n separados.
- **Contar duas vezes**: numa matriz de tamanho ímpar, as duas diagonais se cruzam no centro.
- **Esquecer casos degenerados**: matrizes 1 x n e n x 1 costumam revelar laços que repetem elementos.
- **Esquecer uma das direções**: no jogo da velha, há 3 linhas, 3 colunas **e 2 diagonais**.

## Complexidade

Percorrer uma matriz m x n custa **O(m · n)**, o número de elementos. A multiplicação de uma m x n por uma n x p custa **O(m · n · p)**; para duas matrizes quadradas n x n, O(n³).

## Pratique

1. **Soma das diagonais**: índices de diagonal e o elemento central.
2. **Matriz transposta**: linhas viram colunas, inclusive nas retangulares.
3. **Multiplicação de matrizes**: três laços e a validação das dimensões.
4. **Percurso em espiral**: simulação com quatro limites.
5. **Vencedor do jogo da velha** (desafio do módulo): todas as linhas, colunas e diagonais de um tabuleiro.
`;

const STRINGS = `
# Strings

Uma **string** é um texto: uma sequência de caracteres. Por dentro, ela se parece muito com um vetor. Cada caractere tem um índice, a partir de 0, e dá para percorrê-la com um laço. Tudo o que você aprendeu em vetores (acumulador, contador, dois índices) vale aqui.

## Caracteres são números

Cada caractere é guardado como um número, o seu código na tabela **ASCII**. Alguns valores úteis:

| Caracteres | Códigos |
| --- | --- |
| \`'0'\` a \`'9'\` | 48 a 57 |
| \`'A'\` a \`'Z'\` | 65 a 90 |
| \`'a'\` a \`'z'\` | 97 a 122 |

Como as letras e os dígitos são consecutivos, fazer contas com eles funciona:

- \`c - '0'\` transforma o caractere \`'7'\` no número 7;
- \`c - 'a'\` dá a posição da letra no alfabeto (\`'a'\` → 0, \`'z'\` → 25), ótima como índice de um vetor de 26 contadores.

Em C isso é direto, porque \`char\` já é um número. Em JavaScript use \`texto.charCodeAt(i)\` e, em Python, \`ord(c)\`.

## Strings em cada linguagem

- **C**: a string é um vetor de \`char\` terminado pelo caractere \`'\\0'\`. O tamanho é descoberto com \`strlen\`. Para devolver uma string nova, aloque com \`malloc\` (lembrando do byte extra para o \`'\\0'\`).
- **JavaScript e Python**: strings são **imutáveis**, ou seja, você não altera um caractere no lugar. Monte o resultado em partes (um vetor de pedaços) e junte no fim com \`join\`, o que é mais eficiente do que concatenar dentro de um laço longo.

## Exemplo: contar letras e dígitos

\`\`\`c
#include <ctype.h>

int contarAlfanumericos(char* texto) {
    int contador = 0;
    for (int i = 0; texto[i] != '\\0'; i++) {
        if (isalnum((unsigned char) texto[i])) {
            contador++;
        }
    }
    return contador;
}
\`\`\`

A biblioteca \`<ctype.h>\` traz funções como \`isalpha\`, \`isdigit\`, \`isalnum\`, \`isspace\`, \`tolower\` e \`toupper\`. Em JavaScript e Python, \`toLowerCase()\` e \`lower()\` fazem a conversão de caixa.

## Padrões do módulo

- **Normalizar antes de comparar**: converter tudo para minúsculo e descartar o que não interessa (espaços, pontuação).
- **Dois índices**: um em cada ponta, para verificar palíndromos sem criar outra string.
- **Tabela de frequência**: um vetor de 26 posições para contar quantas vezes cada letra aparece. Duas palavras são anagramas se as tabelas forem iguais.
- **Blocos consecutivos**: avançar um segundo índice enquanto o caractere se repete, como na compressão RLE.
- **Dígitos com pesos**: converter cada caractere em número e acumular uma soma ponderada, como nos dígitos verificadores do CPF.

## Armadilhas comuns

- **Maiúsculas e minúsculas**: \`'A'\` e \`'a'\` são caracteres diferentes. Se o enunciado diz "ignore a caixa", converta antes de comparar.
- **Espaços repetidos**: dividir \`"a  b"\` por um único espaço gera um pedaço vazio no meio.
- **Números com mais de um dígito**: \`'0' + 12\` não é \`"12"\`. Em C, use \`sprintf\` para escrever números numa string.
- **Esquecer o \`'\\0'\`** em C: sem ele, quem ler a string continua lendo a memória depois do fim.
- **Somar códigos para comparar textos**: \`"ad"\` e \`"bc"\` têm a mesma soma. Compare contagens, não somas.

## Complexidade

Percorrer uma string de tamanho n custa **O(n)**. Cuidado com operações escondidas dentro de laços: chamar \`strlen\` na condição de um \`for\` em C, ou procurar um caractere com \`indexOf\` a cada passo, transforma um algoritmo O(n) em O(n²).

## Pratique

1. **Contar vogais**: percorrer caractere a caractere, nas duas caixas.
2. **Inverter a ordem das palavras**: separar palavras ignorando espaços extras.
3. **Palíndromo de frase**: normalizar e comparar com dois índices.
4. **Anagramas**: tabela de frequência com 26 contadores.
5. **Compressão RLE**: blocos consecutivos e números com vários dígitos.
6. **Validar CPF** (desafio do módulo): filtrar caracteres, converter dígitos e somar com pesos.
`;

export const FUNDAMENTOS_COLECOES_LESSONS: Record<string, LessonDefinition[]> = {
  vetores: [
    {
      slug: "licao-vetores",
      title: "Vetores: índices, percursos e acumuladores",
      summary: "Como guardar vários valores em sequência e percorrê-los com acumuladores, contadores e dois índices.",
      estimatedMinutes: 12,
      content: VETORES
    }
  ],
  matrizes: [
    {
      slug: "licao-matrizes",
      title: "Matrizes: linhas, colunas e diagonais",
      summary: "Como representar tabelas como vetores de vetores e percorrê-las com laços aninhados e padrões de índices.",
      estimatedMinutes: 12,
      content: MATRIZES
    }
  ],
  strings: [
    {
      slug: "licao-strings",
      title: "Strings: caracteres, códigos e contagens",
      summary: "Como percorrer textos caractere a caractere, usar os códigos ASCII e contar letras com uma tabela de frequência.",
      estimatedMinutes: 12,
      content: STRINGS
    }
  ]
};
