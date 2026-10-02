import type { LessonDefinition } from "./index.js";

const F = "```";

/** Lições dos módulos hash, árvores, heaps e grafos da trilha Estrutura de Dados. */
export const ED_HIERARQUICAS_LESSONS: Record<string, LessonDefinition[]> = {
  hash: [
    {
      slug: "licao-hash",
      title: "Tabelas hash: consultar em tempo constante",
      summary: "Como uma função de hash transforma uma chave em posição de vetor e como tratar colisões.",
      estimatedMinutes: 12,
      content: `
# Tabelas hash

Procurar um valor num vetor desordenado custa O(n): é preciso olhar posição por posição. Uma **tabela hash** evita essa busca calculando, a partir da própria chave, **em que posição** ela deve estar. Com uma boa função de hash, inserir, buscar e remover custam O(1) em média.

## A ideia

1. Reserve um vetor com M posições (os **baldes**).
2. Escolha uma **função de hash** \`h(chave)\` que devolva um número entre 0 e M − 1.
3. Guarde cada chave no balde \`h(chave)\`; para procurá-la, calcule \`h\` de novo e olhe só ali.

Para inteiros, \`h(x) = x mod M\` com M primo já espalha bem. Para textos, combine os caracteres, como no djb2: \`h = h * 33 + caractere\`.

## Colisões

Duas chaves diferentes podem cair no mesmo balde: é uma **colisão**, e ela sempre vai acontecer (há mais chaves possíveis do que baldes). As duas soluções clássicas:

| Técnica | Como funciona | Cuidado |
| --- | --- | --- |
| Encadeamento separado | cada balde é uma lista encadeada com as chaves que caíram nele | remover do meio da lista exige religar o nó anterior |
| Endereçamento aberto | se o balde está ocupado, tenta o seguinte (sondagem linear) | a tabela precisa de folga: mantenha pelo menos metade vazia |

Com N chaves e M baldes, cada lista tem em média N/M nós; mantendo M da ordem de N, as operações ficam O(1) em média.

## Exemplo comentado em C

${F}c
#define M 10007                       /* primo */
typedef struct no { int valor; struct no *prox; } No;
No *tabela[M];                        /* todos começam em NULL */

int balde(int x) {
    return ((x % M) + M) % M;         /* em C, -7 % 10 vale -7 */
}

int contem(int x) {
    for (No *p = tabela[balde(x)]; p; p = p->prox)
        if (p->valor == x) return 1;
    return 0;
}

void inserir(int x) {
    if (contem(x)) return;            /* conjunto: sem repetidos */
    No *novo = malloc(sizeof(No));
    novo->valor = x;
    novo->prox = tabela[balde(x)];    /* entra no início da lista */
    tabela[balde(x)] = novo;
}
${F}

## No dia a dia: Map, dict e Set

Nas linguagens de alto nível a tabela já vem pronta:

${F}js
const contagem = new Map();
for (const palavra of ["sol", "lua", "sol"]) {
  contagem.set(palavra, (contagem.get(palavra) ?? 0) + 1);
}
// Map { "sol" => 2, "lua" => 1 }, na ordem de inserção
${F}

Em Python, \`dict\` e \`set\` fazem o mesmo papel, e \`collections.Counter\` conta de uma vez.

## Padrões que aparecem sempre

- **Tabela de frequência:** conte quantas vezes cada item aparece (palavras, letras, números).
- **Último índice visto:** guarde onde cada valor apareceu pela última vez para responder perguntas sobre distância.
- **Chave canônica:** agrupe itens "equivalentes" calculando uma representação única para cada grupo (por exemplo, as letras ordenadas de uma palavra).

## Armadilhas comuns

- **Resto negativo em C:** \`x % M\` pode ser negativo; some M e tire o resto de novo.
- **Objeto literal como mapa em JavaScript:** \`{}\` herda chaves como \`constructor\` e reordena chaves numéricas. Prefira \`Map\`.
- **Chave que colide de propósito:** somar os códigos das letras não identifica um anagrama (\`"ad"\` e \`"bc"\` têm a mesma soma). A chave precisa ser igual **só** para itens equivalentes.
- **Tabela pequena demais:** com M fixo e N crescendo, as listas crescem e tudo volta a ser O(n).

## Complexidade

| Operação | Média | Pior caso (tudo colide) |
| --- | --- | --- |
| inserir | O(1) | O(n) |
| buscar | O(1) | O(n) |
| remover | O(1) | O(n) |

O pior caso quase nunca aparece com uma função de hash razoável e um tamanho de tabela proporcional ao número de chaves.

## Pratique

- **Frequência de palavras**: a tabela de frequência mais direta, na ordem de chegada.
- **Primeiro caractere único**: um vetor de 26 contadores como tabela hash.
- **Duplicado próximo**: tabela com o último índice de cada valor.
- **Tabela hash com encadeamento**: implemente a estrutura em C, com struct e malloc.
- **Agrupar anagramas** (chefe): escolha a chave canônica certa.
`
    }
  ],
  arvores: [
    {
      slug: "licao-arvores",
      title: "Árvores binárias e árvores de busca",
      summary: "Nós com dois filhos, percursos recursivos, altura e a propriedade que torna a BST rápida.",
      estimatedMinutes: 14,
      content: `
# Árvores binárias

Uma **árvore binária** é formada por nós; cada nó guarda um valor e aponta para até dois filhos, o **esquerdo** e o **direito**. O nó do topo é a **raiz**, e os nós sem filhos são as **folhas**.

${F}
          8            raiz
        /   \\
       3     10
      / \\      \\
     1   6      14     1, 6 e 14 são folhas
${F}

Nos desafios, a árvore acima aparece em **ordem de níveis**, com \`null\` nos filhos que faltam: \`[8, 3, 10, 1, 6, null, 14]\`. O juiz já entrega a raiz como um objeto \`TreeNode\` (\`val\`, \`left\`, \`right\`); em C, como \`struct TreeNode*\`.

## Recursão é a ferramenta natural

Cada filho de um nó é, ele mesmo, a raiz de uma árvore menor (uma **subárvore**). Por isso quase todo algoritmo de árvore tem a forma:

1. caso base: a árvore vazia (\`null\`);
2. resolva para a subárvore esquerda e para a direita;
3. combine as respostas no nó atual.

A **altura** (número de nós no caminho mais longo até uma folha) é o exemplo clássico:

${F}js
function altura(no) {
  if (!no) return 0;                          // árvore vazia
  return 1 + Math.max(altura(no.left), altura(no.right));
}
${F}

## Os três percursos em profundidade

Mudando só **quando** o valor do nó é anotado, obtemos três ordens diferentes:

| Percurso | Ordem | Na árvore acima |
| --- | --- | --- |
| pré-ordem | nó, esquerda, direita | 8 3 1 6 10 14 |
| em-ordem | esquerda, nó, direita | 1 3 6 8 10 14 |
| pós-ordem | esquerda, direita, nó | 1 6 3 14 10 8 |

A pós-ordem é a escolha quando o nó precisa da resposta dos filhos (altura, balanceamento). Já o percurso **por níveis** usa uma **fila**, não recursão: visita 8, depois 3 e 10, depois 1, 6 e 14.

## Árvore binária de busca (BST)

Numa **BST**, para todo nó, os valores da subárvore esquerda são menores e os da direita são maiores. A árvore do desenho é uma BST, e por isso sua em-ordem sai **ordenada**.

Para buscar ou inserir, basta descer comparando:

${F}c
struct TreeNode* inserir(struct TreeNode* raiz, int valor) {
    if (!raiz) {
        struct TreeNode* no = calloc(1, sizeof(struct TreeNode));
        no->val = valor;
        return no;
    }
    if (valor < raiz->val) raiz->left = inserir(raiz->left, valor);
    else if (valor > raiz->val) raiz->right = inserir(raiz->right, valor);
    return raiz;                              /* igual: não insere */
}
${F}

Cada comparação descarta uma subárvore inteira, então o custo é O(h), com h a altura. Numa árvore **equilibrada**, h ≈ log₂ n: com um milhão de nós, uns 20 passos.

## Árvores degeneradas e balanceamento

Inserir valores já ordenados numa BST produz uma "árvore" que é, na prática, uma lista:

${F}
  1
   \\
    2
     \\
      3
       \\
        4      altura 4 com 4 nós: busca O(n)
${F}

Árvores **AVL** evitam isso exigindo que, em **todo** nó, as alturas das duas subárvores difiram em no máximo 1, e se reorganizam (rotações) quando a regra quebra.

## Armadilhas comuns

- **Pilha de recursão:** numa árvore degenerada, a recursão desce n níveis. No juiz, JavaScript aguenta cerca de 7 mil chamadas simples, Python está com limite de 20000 e C tem 64 MB de pilha. Para mais que isso, use uma pilha ou fila explícita.
- **Folha não é "filho nulo":** um nó com só um filho não é folha. Teste \`!no.left && !no.right\`.
- **Olhar só a raiz:** propriedades como "balanceada" valem para todos os nós.
- **Repetidos na BST:** decida o que fazer com valores iguais (aqui, ignorar).

## Complexidade

| Operação | Árvore equilibrada | Árvore degenerada |
| --- | --- | --- |
| percurso completo | O(n) | O(n) |
| busca ou inserção na BST | O(log n) | O(n) |
| pilha de recursão | O(log n) | O(n) |

## Pratique

- **Percursos da árvore**: pré, em e pós-ordem numa única recursão.
- **Altura da árvore**: a recursão mais direta, incluindo árvores degeneradas.
- **Inserir na árvore de busca**: construa a BST inserindo em ordem.
- **Árvore balanceada**: pós-ordem que devolve altura ou falha.
- **Soma de caminho**: desça carregando o que falta para o alvo.
- **Reconstruir a árvore** (chefe): pré-ordem e em-ordem juntas determinam a árvore.
`
    }
  ],
  heaps: [
    {
      slug: "licao-heaps",
      title: "Heaps e filas de prioridade",
      summary: "Uma árvore completa guardada em vetor que entrega sempre o maior (ou o menor) em O(log n).",
      estimatedMinutes: 12,
      content: `
# Heaps e filas de prioridade

Uma **fila de prioridade** é uma coleção em que sempre sai primeiro o elemento de maior prioridade (o maior, ou o menor). Ela aparece em escalonadores de tarefas, em simulações e em algoritmos como Dijkstra. A implementação clássica é o **heap binário**.

## O heap binário

Um **heap máximo** é uma árvore binária **completa** (todos os níveis cheios, menos talvez o último, preenchido da esquerda para a direita) em que **cada pai é maior ou igual aos filhos**. O maior elemento está sempre na raiz.

Por ser completa, a árvore cabe num vetor sem ponteiros:

- os filhos da posição \`i\` estão em \`2i + 1\` e \`2i + 2\`;
- o pai da posição \`i\` está em \`(i − 1) / 2\` (divisão inteira).

Por exemplo, \`[9, 5, 8, 1, 3]\` é a árvore com 9 na raiz, filhos 5 e 8, e 1 e 3 como filhos de 5.

## As duas operações

**Subir (inserir):** coloque o novo elemento no fim do vetor e, enquanto ele for maior que o pai, troque os dois.

**Descer (remover o topo):** leve o último elemento para a raiz e, enquanto algum filho for maior que ele, troque-o com o **maior** filho.

As duas percorrem no máximo a altura da árvore, que é log₂ n.

${F}js
function descer(v, i, tamanho) {
  for (;;) {
    const esq = 2 * i + 1, dir = esq + 1;
    let maior = i;
    if (esq < tamanho && v[esq] > v[maior]) maior = esq;
    if (dir < tamanho && v[dir] > v[maior]) maior = dir;
    if (maior === i) return;             // já está no lugar
    [v[i], v[maior]] = [v[maior], v[i]];
    i = maior;
  }
}

function subir(v, i) {
  while (i > 0 && v[(i - 1) >> 1] < v[i]) {
    const pai = (i - 1) >> 1;
    [v[i], v[pai]] = [v[pai], v[i]];
    i = pai;
  }
}
${F}

## Montar um heap em O(n)

Para transformar um vetor qualquer em heap, chame \`descer\` para cada pai, de \`n/2 − 1\` até 0. Parece O(n log n), mas é O(n): a maioria dos nós está perto das folhas e desce pouco.

## Heapsort

Com o heap montado, troque a raiz (o maior) com o último elemento, diminua o tamanho em 1 e desça a nova raiz. Repetindo, o vetor fica em ordem crescente, sem memória extra: O(n log n) sempre.

## Heaps prontos

- **Python:** \`heapq\` é um heap **mínimo** sobre uma lista (\`heappush\`, \`heappop\`, \`heapify\`). Para um heap máximo, guarde os valores com o sinal trocado.
- **JavaScript** não tem heap na biblioteca padrão: implemente \`subir\` e \`descer\` como acima.
- **C:** também não; use um vetor e as mesmas funções.

## Padrões que usam heap

- **Os k maiores:** mantenha um heap **mínimo** com k elementos; o topo é o menor dos k maiores, e qualquer valor menor que ele é descartado. Custo O(n log k).
- **Simulação por prioridade:** retire os dois maiores, combine e devolva o resultado ao heap.
- **Intercalar k listas ordenadas:** guarde no heap o primeiro elemento ainda não usado de cada lista; o topo é o próximo da resposta.

## Armadilhas comuns

- **Esquecer um filho:** ao validar ou descer, confira \`2i + 1\` **e** \`2i + 2\`, sempre testando se o índice existe.
- **Trocar com o filho errado:** ao descer num heap máximo, troque com o **maior** dos filhos, senão a propriedade quebra.
- **Heap máximo em Python:** \`heapq\` é mínimo; esquecer de negar os valores inverte a lógica.
- **Ordenar a cada passo:** reordenar o vetor inteiro a cada inserção custa O(n log n) por operação, contra O(log n) do heap.

## Complexidade

| Operação | Custo |
| --- | --- |
| ver o topo | O(1) |
| inserir | O(log n) |
| remover o topo | O(log n) |
| montar a partir de um vetor | O(n) |
| heapsort | O(n log n) |

## Pratique

- **Validar heap máximo**: confira a propriedade olhando cada filho e seu pai.
- **Heapsort**: monte o heap e extraia, sem ordenação pronta.
- **Os k maiores**: heap mínimo de tamanho k.
- **A última pedra**: simulação com heap máximo.
- **Mesclar k vetores ordenados** (chefe): um candidato por vetor no heap.
`
    }
  ],
  grafos: [
    {
      slug: "licao-grafos",
      title: "Grafos: representação, BFS, DFS e Dijkstra",
      summary: "Vértices e arestas em lista de adjacência, buscas em largura e profundidade e menor caminho com pesos.",
      estimatedMinutes: 15,
      content: `
# Grafos

Um **grafo** é um conjunto de **vértices** ligados por **arestas**. Ele modela redes sociais, mapas de rotas, dependências entre tarefas e até labirintos. Nos desafios, os vértices são numerados de \`0\` a \`n − 1\` e as arestas chegam como pares \`[u, v]\` (ou \`[u, v, peso]\`).

${F}
    0 ----- 1
    |       |
    |       |        arestas: [0,1] [0,2] [1,3] [2,3] [3,4]
    2 ----- 3 ----- 4
${F}

- **Não dirigido:** a aresta \`[u, v]\` vale nos dois sentidos (amizade).
- **Dirigido:** \`[u, v]\` só permite ir de u para v (estrada de mão única).
- **Grau** de um vértice: quantas arestas tocam nele. No desenho, o vértice 3 tem grau 3.

## Lista de adjacência

A representação mais usada guarda, para cada vértice, a lista dos vizinhos. Ela ocupa O(n + m) de memória, com m arestas:

${F}js
const vizinhos = Array.from({ length: n }, () => []);
for (const [u, v] of arestas) {
  vizinhos[u].push(v);
  vizinhos[v].push(u);        // só no grafo não dirigido
}
${F}

A alternativa, uma matriz n × n, custa O(n²) de memória: inviável com 100 mil vértices.

## Busca em largura (BFS)

A BFS usa uma **fila** e visita os vértices em camadas: primeiro a origem, depois todos a 1 aresta, depois todos a 2 arestas... Por isso, ela dá a **menor distância em número de arestas**.

${F}js
const dist = new Array(n).fill(-1);
const fila = [origem];
dist[origem] = 0;
for (let i = 0; i < fila.length; i++) {       // índice em vez de shift()
  const u = fila[i];
  for (const v of vizinhos[u]) {
    if (dist[v] === -1) {                    // marque ao enfileirar
      dist[v] = dist[u] + 1;
      fila.push(v);
    }
  }
}
${F}

No grafo do desenho, a partir de 0: \`dist = [0, 1, 1, 2, 3]\`.

Uma **grade** (labirinto) também é um grafo: cada célula livre é um vértice ligado às vizinhas de cima, de baixo, da esquerda e da direita. A BFS a partir do início dá o menor número de passos.

## Busca em profundidade (DFS)

A DFS segue um caminho até não poder mais e então volta (com recursão ou com uma **pilha**). Ela serve para descobrir **o que é alcançável**: contar componentes conexos, detectar ciclos, ordenar dependências. Ela **não** dá a menor distância.

Em grafos grandes, prefira a DFS com pilha explícita: um componente com 100 mil vértices pode estourar a pilha de recursão.

## Union-find

Para perguntas de conectividade (quantos componentes? esta aresta fecha um ciclo?), o **union-find** é ainda mais simples: cada vértice aponta para um "pai", e cada componente é representado pela raiz. \`encontrar\` sobe até a raiz; \`unir\` pendura uma raiz na outra. Se as duas pontas de uma aresta já têm a mesma raiz, a aresta fecha um ciclo.

## Menor caminho com pesos: Dijkstra

Quando as arestas têm custos diferentes, contar arestas não basta. O algoritmo de **Dijkstra** (pesos não negativos) mantém a melhor distância conhecida de cada vértice e sempre **fecha o vértice aberto de menor distância**, usando um **heap mínimo**:

1. \`dist[origem] = 0\`; coloque \`(0, origem)\` no heap.
2. Retire o par \`(d, u)\` de menor d. Se \`d > dist[u]\`, é uma entrada velha: ignore.
3. Para cada aresta \`u → v\` de peso p, se \`d + p < dist[v]\`, atualize \`dist[v]\` e insira \`(dist[v], v)\`.

Procurar o menor vértice aberto percorrendo todos custa O(n²); com o heap, o total é O((n + m) log m).

## Armadilhas comuns

- **Esquecer o sentido:** em grafos não dirigidos, a aresta entra na lista das duas pontas; nos dirigidos, só na da origem.
- **Vértices isolados:** o tamanho dos vetores vem de n, não do maior índice que aparece nas arestas.
- **Marcar tarde demais:** na BFS, marque o vértice ao colocá-lo na fila, senão ele entra várias vezes.
- **Arestas repetidas:** podem existir; decida se contam (no grau e nos ciclos, contam).
- **Estouro em C:** somas de pesos grandes pedem \`long long\`.

## Complexidade

| Algoritmo | Tempo | Memória |
| --- | --- | --- |
| montar a lista de adjacência | O(n + m) | O(n + m) |
| BFS ou DFS | O(n + m) | O(n) |
| union-find (com compressão) | quase O(n + m) | O(n) |
| Dijkstra com heap | O((n + m) log m) | O(n + m) |

## Pratique

- **Grau dos vértices**: conte as pontas de cada aresta.
- **Distâncias com BFS**: a BFS clássica, com -1 para inalcançáveis.
- **Componentes conexos**: BFS a partir de cada não visitado, ou union-find.
- **O grafo tem ciclo?**: union-find, com laços e arestas repetidas.
- **Menor caminho na grade**: BFS em labirinto.
- **Menor custo com Dijkstra** (chefe): heap mínimo e distâncias de 64 bits.
`
    }
  ]
};
