import type { LessonDefinition } from "./index.js";

/** Lições dos módulos de recursividade, complexidade, busca e ordenação (trilha Estrutura de Dados). */
export const ED_ALGORITMOS_LESSONS: Record<string, LessonDefinition[]> = {
  recursividade: [
    {
      slug: "licao-recursividade",
      title: "Recursividade: resolver o problema com versões menores dele mesmo",
      summary: "Uma função recursiva resolve um caso pequeno diretamente e reduz todos os outros a casos menores do mesmo problema.",
      estimatedMinutes: 12,
      content: `
# Recursividade

Uma função é **recursiva** quando chama a si mesma. A ideia não é mágica: você descreve a resposta de um problema grande em termos da resposta de um problema **menor do mesmo tipo**, e confia que a função sabe resolver esse menor.

Toda recursão bem escrita tem duas partes:

- **Caso base**: uma entrada tão pequena que a resposta sai direto, sem nova chamada (fatorial de 0 é 1; um texto vazio é palíndromo).
- **Passo recursivo**: a função reduz a entrada (n vira n − 1, o intervalo encolhe, o expoente cai pela metade) e combina o resultado da chamada menor.

Se o passo recursivo não aproxima a entrada do caso base, a função chama a si mesma para sempre, até estourar a pilha.

## A pilha de chamadas

Cada chamada ganha um **quadro** na pilha, com os próprios parâmetros e variáveis locais. Quando \`fat(4)\` chama \`fat(3)\`, o quadro de \`fat(4)\` fica esperando; só quando \`fat(0)\` responde os quadros vão sendo desempilhados, na ordem inversa.

| Chamada | Espera por | Devolve |
| --- | --- | --- |
| fat(3) | fat(2) | 3 · 2 = 6 |
| fat(2) | fat(1) | 2 · 1 = 2 |
| fat(1) | fat(0) | 1 · 1 = 1 |
| fat(0) | nada (caso base) | 1 |

A pilha tem tamanho limitado: alguns milhares de chamadas em JavaScript e Python, algumas centenas de milhares em C. Por isso a **profundidade** da recursão importa tanto quanto o número total de chamadas.

## Exemplo comentado: potência rápida

Calcular base^e multiplicando e vezes custa O(e) chamadas. Com a observação base^e = (base^(e/2))², o expoente cai pela metade a cada passo:

\`\`\`c
long long potencia(long long base, int e) {
    if (e == 0) return 1;                     // caso base
    long long metade = potencia(base, e / 2); // um único problema menor
    long long r = metade * metade;
    if (e % 2 == 1) r *= base;                // expoente ímpar: sobra uma base
    return r;
}
\`\`\`

Com e = 10^9, são cerca de 30 chamadas em vez de um bilhão. Repare que \`metade\` é calculada **uma vez** e guardada: escrever \`potencia(base, e / 2) * potencia(base, e / 2)\` faria duas chamadas por nível e o ganho sumiria.

## Memoização

Algumas recursões fazem **as mesmas perguntas várias vezes**. Em \`fib(n) = fib(n − 1) + fib(n − 2)\`, o valor fib(2) é recalculado milhões de vezes quando n passa de 30. O remédio é guardar cada resposta numa tabela na primeira vez em que ela é calculada e consultá-la nas próximas:

\`\`\`js
const memo = new Map();
function caminhos(i, j) {
  if (i < 0 || j < 0) return 0;
  if (i === 0 && j === 0) return 1;
  const chave = i * 1000 + j;
  if (!memo.has(chave)) memo.set(chave, caminhos(i - 1, j) + caminhos(i, j - 1));
  return memo.get(chave);
}
\`\`\`

Com memoização, o custo passa a ser (número de estados diferentes) × (trabalho por estado), em vez de exponencial.

## Armadilhas comuns

- **Esquecer o caso base**, ou escrever um que nunca é alcançado (por exemplo, testar \`n == 0\` quando n pode começar negativo).
- **Recortar a entrada a cada chamada**: criar substrings ou subvetores copia O(n) dados por chamada. Passe índices (\`inicio\`, \`fim\`) em vez disso.
- **Recursão profunda demais**: descer de 1 em 1 com n = 10^6 estoura a pilha. Prefira reduções que cortam a entrada pela metade, ou use laço quando o problema permitir.
- **Overflow**: fatoriais e potências crescem rápido. Use \`long long\` em C e tire o módulo a cada passo quando o enunciado pedir.
- **Recursão de fachada**: uma função que chama a si mesma só uma vez e resolve o resto com um laço não é uma solução recursiva.

## Complexidade

O custo de uma recursão é **número de chamadas × trabalho por chamada**. Descer de 1 em 1 dá O(n) chamadas; cortar pela metade dá O(log n); duas chamadas por nível sem memória dão O(2^n). O espaço extra é a profundidade máxima da pilha.

## Pratique

1. **Série de Pitágoras recursiva**: o caso base e o passo recursivo mais simples.
2. **Fatorial recursivo**: a mesma estrutura, agora com cuidado de overflow.
3. **Torre de Hanói**: duas chamadas por nível, 2^n − 1 movimentos.
4. **Potência recursiva rápida**: cortar o expoente pela metade.
5. **Palíndromo recursivo**: dois índices que se aproximam, sem laços.
6. **Caminhos na grade** (chefe): recursão com memoização numa tabela.
`
    }
  ],
  complexidade: [
    {
      slug: "licao-complexidade",
      title: "Complexidade: quanto custa o seu algoritmo",
      summary: "A notação O mede como o número de operações cresce com o tamanho da entrada e diz, antes de rodar, se a solução cabe no tempo limite.",
      estimatedMinutes: 12,
      content: `
# Complexidade de algoritmos

Dois programas corretos podem levar tempos muito diferentes. Um conta pares iguais em 0,01 s; o outro leva um minuto para a mesma entrada. A diferença não está na linguagem nem no computador: está em **quantas operações** cada um faz quando a entrada cresce.

A **notação O** descreve esse crescimento ignorando constantes. Dizer que um algoritmo é O(n²) significa que, dobrando n, o trabalho fica cerca de quatro vezes maior.

## A tabela que decide tudo

Um computador comum faz algo entre 10^8 e 10^9 operações simples por segundo (menos em Python). Veja quantas operações cada custo exige:

| n | O(n) | O(n log n) | O(n²) |
| --- | --- | --- | --- |
| 1 000 | 1 000 | 10 000 | 1 000 000 |
| 10 000 | 10 000 | 130 000 | 100 000 000 |
| 100 000 | 100 000 | 1 700 000 | 10 000 000 000 |
| 200 000 | 200 000 | 3 500 000 | 40 000 000 000 |
| 1 000 000 | 1 000 000 | 20 000 000 | 10^12 |

Com n = 200 000 e um limite de 1,5 s, O(n) e O(n log n) sobram; O(n²) precisaria de dezenas de segundos. Por isso, **olhe as restrições antes de programar**: elas contam qual complexidade o problema espera.

- n até uns 2 000: O(n²) costuma passar.
- n até 10^5 ou 10^6: procure O(n) ou O(n log n).
- n até 10^9 (um número, não um vetor): só O(log n) ou O(1).

## Como estimar o custo

- Um laço de 0 até n com trabalho constante: O(n).
- Dois laços aninhados sobre o vetor: O(n²).
- Um laço em que a variável dobra ou cai pela metade: O(log n).
- Ordenar com uma boa ordenação: O(n log n).
- Recursão: número de chamadas × trabalho por chamada.

## Exemplo comentado: maior lucro

Queremos o maior \`precos[j] − precos[i]\` com i < j. A força bruta testa todos os pares:

\`\`\`js
// O(n²): para n = 200 000, cerca de 2 · 10^10 subtrações
for (let i = 0; i < n; i++)
  for (let j = i + 1; j < n; j++)
    melhor = Math.max(melhor, precos[j] - precos[i]);
\`\`\`

Mas, fixado o dia de venda j, a melhor compra é sempre o **menor preço anterior**. Guardando esse mínimo, uma passada basta:

\`\`\`js
// O(n): 200 000 passos
let menor = precos[0], melhor = 0;
for (let j = 1; j < n; j++) {
  melhor = Math.max(melhor, precos[j] - menor);
  menor = Math.min(menor, precos[j]);
}
\`\`\`

A troca típica é essa: **guardar uma informação** (o mínimo, uma contagem, um vetor de marcas) para não recalcular.

## Truques que derrubam a complexidade

- **Contar em vez de comparar**: um valor que aparece k vezes forma k · (k − 1) / 2 pares, sem comparar par a par.
- **Tabela de marcas**: o Crivo de Eratóstenes risca múltiplos em vez de testar divisores.
- **Guardar os últimos resultados**: Fibonacci com duas variáveis é O(n), contra O(1,6^n) da recursão direta.
- **Dividir e conquistar**: o Merge Sort conta inversões em O(n log n) aproveitando as metades já ordenadas.

## Armadilhas comuns

- **Custos escondidos**: \`indexOf\`, \`includes\`, \`in\` numa lista, \`slice\` e concatenação de strings dentro de um laço são O(n) cada; o laço inteiro vira O(n²).
- **Overflow**: respostas de contagem passam de 2^31 facilmente. Use \`long long\` em C.
- **Confiar só nos exemplos**: eles são pequenos. Teste mentalmente o maior caso das restrições.

## Espaço

A mesma notação vale para memória. Um vetor de marcas de tamanho n é O(n); duas variáveis são O(1). Em geral, gastar O(n) de memória para ganhar tempo é uma boa troca.

## Pratique

1. **Fibonacci modular**: de exponencial para linear guardando dois termos.
2. **Contar pares iguais**: contar em vez de comparar.
3. **Crivo de Eratóstenes**: O(n log log n) contra divisão por tentativa.
4. **Maior lucro na bolsa**: uma passada guardando o mínimo.
5. **Contar inversões** (chefe): Merge Sort em O(n log n).
`
    }
  ],
  busca: [
    {
      slug: "licao-busca",
      title: "Busca sequencial e busca binária",
      summary: "Sem ordem, é preciso olhar cada posição; com o vetor ordenado, cada comparação descarta metade dos candidatos.",
      estimatedMinutes: 12,
      content: `
# Busca

Procurar um valor num vetor é uma das operações mais comuns em programação. A forma de procurar depende de uma pergunta: **o vetor está ordenado?**

## Busca sequencial

Se não há ordem nenhuma, qualquer posição pode conter o valor. Não resta alternativa a examinar uma por uma, do início ao fim:

\`\`\`c
int buscaSequencial(int *v, int n, int x) {
    for (int i = 0; i < n; i++)
        if (v[i] == x) return i;
    return -1; // não encontrado
}
\`\`\`

O custo é O(n). É simples e correta para qualquer vetor, e é a escolha certa quando a busca é feita poucas vezes.

## Busca binária

Num vetor **ordenado**, comparar o valor procurado com o elemento do meio já diz em qual metade ele pode estar. A outra metade é descartada inteira. Repetindo, o intervalo cai para metade, um quarto, um oitavo… até sobrar um elemento ou nenhum.

\`\`\`c
int buscaBinaria(int *v, int n, int x) {
    int ini = 0, fim = n - 1;          // x só pode estar em v[ini..fim]
    while (ini <= fim) {
        int meio = ini + (fim - ini) / 2;
        if (v[meio] == x) return meio;
        if (v[meio] < x) ini = meio + 1; // descarta a metade esquerda
        else fim = meio - 1;             // descarta a metade direita
    }
    return -1;
}
\`\`\`

Com 1 000 000 de elementos, a busca binária faz no máximo 20 comparações; a sequencial, até um milhão. Quando há muitas consultas, essa diferença decide se o programa passa no tempo limite.

## O invariante

O segredo para acertar a busca binária é manter uma frase sempre verdadeira, o **invariante**: "se x está no vetor, está em \`v[ini..fim]\`". Cada atualização (\`ini = meio + 1\` ou \`fim = meio - 1\`) precisa preservar essa frase, e o laço termina quando o intervalo fica vazio (\`ini > fim\`).

## Variações

- **Primeira ocorrência**: ao achar x, anote \`meio\` e continue procurando à esquerda (\`fim = meio - 1\`). Para a última, continue à direita.
- **Limite inferior**: a primeira posição com valor maior ou igual a x, útil para contar quantos elementos são menores que x.
- **Busca na resposta**: quando a pergunta é "qual o menor valor que funciona?" e, se um valor funciona, todos os maiores também funcionam, dá para fazer busca binária sobre os valores possíveis da resposta. Exemplos: a raiz quadrada inteira (o maior r com r · r ≤ x) e a menor capacidade de um caminhão.

| Situação | Técnica | Custo |
| --- | --- | --- |
| Vetor sem ordem, uma busca | Sequencial | O(n) |
| Vetor ordenado, muitas buscas | Binária | O(log n) cada |
| Resposta monotônica | Binária na resposta | O(log faixa × custo do teste) |

## Armadilhas comuns

- **Vetor não ordenado**: a busca binária simplesmente devolve respostas erradas. Confira a hipótese.
- **Laço infinito**: atualizar com \`ini = meio\` (sem o + 1) num intervalo fechado pode nunca sair do lugar.
- **Esquecer as pontas**: misturar intervalo fechado \`[ini, fim]\` com semiaberto \`[ini, fim)\` faz a busca pular a última posição.
- **Overflow no meio**: \`(ini + fim) / 2\` pode estourar com índices muito grandes; \`ini + (fim - ini) / 2\` não.
- **Overflow no teste**: em buscas na resposta, \`meio * meio\` com meio até 10^15 estoura; limite o intervalo ou use 64 bits.

## Complexidade

Busca sequencial: O(n) de tempo e O(1) de memória. Busca binária: O(log n) de tempo e O(1) de memória (na versão com laço). Ordenar uma vez em O(n log n) para depois fazer m buscas binárias compensa quando m é grande.

## Pratique

1. **Todas as posições**: busca sequencial examinando todas as posições.
2. **Busca binária em lote**: centenas de milhares de consultas em O(log n) cada.
3. **Primeira e última posição**: busca binária que não para no primeiro acerto.
4. **Raiz quadrada inteira**: busca binária na resposta, sem sqrt.
5. **Capacidade mínima do caminhão** (chefe): busca binária na resposta com uma simulação gulosa.
`
    }
  ],
  ordenacao: [
    {
      slug: "licao-ordenacao",
      title: "Ordenação: métodos clássicos, custo e estabilidade",
      summary: "Bubble, Insertion e Selection Sort custam O(n²); Merge e Quick Sort, O(n log n); o Counting Sort ordena sem comparar quando os valores são poucos.",
      estimatedMinutes: 15,
      content: `
# Ordenação

Ordenar é colocar os elementos de um vetor em sequência (crescente, decrescente, alfabética). Muitos algoritmos dependem disso: a busca binária só funciona num vetor ordenado, e encontrar repetidos fica trivial quando eles estão lado a lado.

## Os métodos O(n²)

- **Bubble Sort**: percorre o vetor trocando vizinhos fora de ordem; a cada passada, o maior restante "borbulha" para o fim.
- **Selection Sort**: encontra o menor (ou maior) elemento restante e o troca para a próxima posição.
- **Insertion Sort**: pega cada elemento e o insere na posição certa entre os anteriores, que já estão ordenados, deslocando os maiores uma casa.

São simples e bons para vetores pequenos. O Insertion Sort é muito rápido em vetores **quase ordenados**, porque quase não desloca nada.

## Os métodos O(n log n)

- **Merge Sort**: divide o vetor ao meio, ordena cada metade recursivamente e **intercala** as duas metades ordenadas numa passada. Sempre O(n log n), com O(n) de memória extra.
- **Quick Sort**: escolhe um **pivô**, separa os menores à esquerda e os maiores à direita e ordena cada lado recursivamente. É O(n log n) em média, mas cai para O(n²) quando o pivô é sempre ruim.

## Exemplo comentado: a intercalação do Merge Sort

\`\`\`c
// v[ini..meio-1] e v[meio..fim-1] já estão ordenados
int i = ini, j = meio, k = ini;
while (i < meio && j < fim) {
    if (v[i] <= v[j]) aux[k++] = v[i++]; // <= : no empate, a esquerda sai primeiro
    else aux[k++] = v[j++];
}
while (i < meio) aux[k++] = v[i++];     // sobras da esquerda
while (j < fim) aux[k++] = v[j++];      // sobras da direita
\`\`\`

Cada elemento é copiado uma vez por nível, e há log n níveis: daí o O(n log n).

## Counting Sort: ordenar sem comparar

Se os valores são inteiros num intervalo pequeno (notas de 0 a 100, idades, letras), dá para **contar** quantas vezes cada valor aparece e reescrever o vetor em ordem a partir das contagens. O custo é O(n + k), com k o tamanho do intervalo. Nenhuma ordenação por comparação consegue ser melhor que O(n log n), mas o Counting Sort não compara elementos: ele usa o próprio valor como índice.

## Estabilidade

Uma ordenação é **estável** quando elementos com a mesma chave continuam na ordem relativa em que estavam. Isso importa quando você ordena registros: ordenar alunos por nota de forma estável mantém, entre os empatados, a ordem de inscrição.

| Método | Custo | Memória extra | Estável? |
| --- | --- | --- | --- |
| Bubble Sort | O(n²) | O(1) | sim |
| Insertion Sort | O(n²) | O(1) | sim |
| Selection Sort | O(n²) | O(1) | não |
| Merge Sort | O(n log n) | O(n) | sim |
| Quick Sort | O(n log n) em média | O(log n) | não |
| Counting Sort | O(n + k) | O(k) | sim (na versão com prefixos) |

O Selection Sort não é estável porque a troca "de longe" pode passar um elemento por cima de outro igual. O Merge Sort é estável graças ao \`<=\` da intercalação: trocar por \`<\` quebra a estabilidade.

## Armadilhas comuns

- **Índices fora do vetor**: laços que vão até \`n\` em vez de \`n - 1\` ao comparar \`v[j]\` com \`v[j + 1]\`.
- **Parar cedo demais**: um Selection Sort que para duas posições antes do fim deixa o vetor quase ordenado, e o erro só aparece em alguns casos.
- **Ordenar só a chave**: ao ordenar registros (nome e nota), mova o registro inteiro, ou ordene os índices.
- **Pivô ruim no Quick Sort**: usar sempre o primeiro elemento degrada para O(n²) em vetores já ordenados. Prefira o elemento do meio.
- **Usar a ordenação pronta quando o exercício pede o método**: \`sort\`, \`sorted\` e \`qsort\` resolvem no dia a dia, mas aqui o objetivo é entender o algoritmo.

## Pratique

1. **Funcionários com Bubble Sort**: trocas de vizinhos em registros.
2. **Insertion Sort: menor valor**: inserir cada elemento entre os anteriores.
3. **Selection Sort: maior valor**: selecionar e trocar.
4. **Merge Sort: palavras que começam com vogal**: dividir, ordenar e intercalar strings.
5. **Quick Sort de números**: particionar em torno de um pivô.
6. **Quick Sort de combinações de letras**: o mesmo Quick Sort, comparando strings.
7. **Counting Sort de notas**: ordenar em O(n + k) sem comparar.
8. **Ordenação estável de alunos** (chefe): uma ordenação que preserva a ordem dos empates.
`
    }
  ]
};
