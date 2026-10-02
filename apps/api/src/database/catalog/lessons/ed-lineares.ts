import type { LessonDefinition } from "./index.js";

/** Lições dos módulos de ponteiros, listas estáticas, listas encadeadas, pilhas e filas. */
export const ED_LINEARES_LESSONS: Record<string, LessonDefinition[]> = {
  ponteiros: [
    {
      slug: "licao-ponteiros",
      title: "Ponteiros e memória: endereços, malloc e free",
      summary: "Um ponteiro guarda o endereço de outro dado; com ele, uma função altera variáveis de quem chama e o programa pede memória do tamanho que precisar.",
      estimatedMinutes: 15,
      content: `
# Ponteiros e memória

Toda variável ocupa alguns bytes da memória, e cada byte tem um **endereço**. Um **ponteiro** é uma variável que guarda um endereço. Em C, \`&x\` é o endereço de \`x\`, e \`*p\` é o valor guardado no endereço que \`p\` contém (dizemos que \`*\` **desreferencia** o ponteiro).

## Um retrato da memória

\`\`\`
int x = 42;
int *p = &x;
int *v = malloc(3 * sizeof(int));   // v[0] = 7, v[1] = 8, v[2] = 9

 PILHA (variáveis locais)              HEAP (malloc)
 endereço   nome   conteúdo            endereço   conteúdo
 0x7ff0     x      42        <--+      0x5a10     7    <-- v, v + 0
 0x7ff8     p      0x7ff0  --+  |      0x5a14     8    <-- v + 1
 0x8000     v      0x5a10 ---|--|--->  0x5a18     9    <-- v + 2
                             +--+
\`\`\`

- \`p\` contém \`0x7ff0\`, o endereço de \`x\`; \`*p = 10\` muda \`x\` para 10.
- \`v\` aponta para um bloco no **heap**, a área onde vivem os dados pedidos com \`malloc\`. Eles continuam existindo até um \`free\`, mesmo depois que a função que os criou termina.
- **Aritmética de ponteiros**: \`v + 1\` não soma 1 byte, soma \`sizeof(int)\` bytes (de \`0x5a10\` para \`0x5a14\`). Por isso \`*(v + i)\` e \`v[i]\` são a mesma coisa.

## Passagem por referência

Em C, os argumentos são sempre cópias. Para uma função alterar variáveis de quem chama, ela recebe os endereços:

\`\`\`c
void trocar(int *a, int *b) {
    int aux = *a;   // valor no primeiro endereço
    *a = *b;
    *b = aux;
}

int x = 1, y = 2;
trocar(&x, &y);     // agora x = 2 e y = 1
\`\`\`

É o mesmo mecanismo do \`scanf("%d", &n)\`: o \`scanf\` precisa do endereço de \`n\` para escrever nele.

## Alocação dinâmica

Quando o tamanho só é conhecido em tempo de execução, peça memória ao sistema:

\`\`\`c
int n;
scanf("%d", &n);
int *v = malloc(n * sizeof(int));        // n inteiros
v = realloc(v, 2 * n * sizeof(int));     // o dobro (pode mudar de endereço!)
free(v);                                 // devolve o bloco
v = NULL;                                // evita usar o endereço antigo
\`\`\`

- \`malloc\` devolve um bloco **sem inicializar**; \`calloc\` devolve zerado.
- \`realloc\` pode copiar o bloco para outro lugar; use sempre o endereço que ele devolve.
- Uma matriz dinâmica é um \`int **\`: um vetor de ponteiros, cada um apontando para uma linha alocada separadamente.

## Armadilhas comuns

- **Ponteiro solto** (*dangling pointer*): usar um endereço depois do \`free\`, ou devolver o endereço de uma variável local, que deixa de existir quando a função retorna. O programa pode até funcionar por acaso e falhar mais tarde. Depois de \`free(p)\`, faça \`p = NULL\`.
- **\`free\` duplo**: liberar o mesmo bloco duas vezes corrompe o controle interno do \`malloc\`. Cada \`malloc\` pede exatamente um \`free\`.
- **Esquecer o \`'\\0'\`**: uma string de \`n\` letras ocupa \`n + 1\` bytes. \`malloc(strlen(s))\` deixa o terminador fora do bloco, e \`printf("%s")\` continua lendo memória alheia até achar um zero.
- **Vazamento de memória**: perder o último ponteiro para um bloco sem liberá-lo (por exemplo, \`free(m)\` antes de liberar as linhas de uma matriz).
- **Ponteiro não inicializado**: \`int *p; *p = 5;\` escreve num endereço aleatório.

## Complexidade

Acessar \`*(v + i)\` custa O(1), porque o endereço é calculado com uma conta. \`malloc\` e \`free\` são rápidos na prática; \`realloc\` pode copiar o bloco inteiro, O(n). Por isso o vetor dinâmico **dobra** a capacidade: as cópias somadas ficam proporcionais ao número de inserções, e cada inserção custa O(1) **amortizado**.

## Pratique

1. **Soma e média com ponteiros**: \`malloc\` e aritmética de ponteiros, sem colchetes.
2. **Troca por referência**: \`void trocar(int *a, int *b)\` chamada com \`&x\` e \`&y\`.
3. **Concatenar com malloc**: o tamanho exato, a cópia com ponteiros e o \`'\\0'\`.
4. **Matriz dinâmica transposta**: \`int **\`, uma alocação por linha e \`free\` na ordem certa.
5. **Vetor dinâmico com realloc** (chefe): capacidade que dobra e encolhe, custo amortizado.
`
    }
  ],
  "listas-estaticas": [
    {
      slug: "licao-listas-estaticas",
      title: "Listas estáticas: vetores de tamanho fixo com contador",
      summary: "Uma lista estática guarda os elementos no começo de um vetor de capacidade fixa e usa um contador para saber quantos estão em uso.",
      estimatedMinutes: 10,
      content: `
# Listas estáticas

Uma **lista estática** é um vetor de **capacidade fixa**, declarada em tempo de compilação, mais um **contador** com a quantidade de elementos em uso. Os elementos ocupam sempre as posições \`0\` a \`tamanho - 1\`, sem buracos. Ela é **homogênea** quando guarda um só tipo (\`int v[50]\`) e **heterogênea** quando cada posição é um \`struct\` com vários campos (nome, telefone...).

\`\`\`
capacidade = 8, tamanho = 5
índice:  0   1   2   3   4   5   6   7
valor:  [3] [7] [9] [12][20][ ? ][ ? ][ ? ]
                             ^ próxima posição livre = tamanho
\`\`\`

## Operações e deslocamentos

- **Inserir no fim**: \`v[tamanho++] = x\`, O(1), se ainda houver espaço.
- **Inserir no meio** (por exemplo, para manter a ordem): abra espaço deslocando para a **direita** os elementos a partir da posição, do último para o primeiro.
- **Remover do meio**: feche o buraco deslocando para a **esquerda** os elementos seguintes.
- **Buscar**: sequencial em O(n) ou, se a lista estiver ordenada, binária em O(log n).

\`\`\`c
#define CAPACIDADE 50
int v[CAPACIDADE], tamanho = 0;

/* Insere x mantendo a ordem crescente; devolve o índice ou -1 se cheia. */
int inserir_ordenado(int x) {
    if (tamanho == CAPACIDADE) return -1;
    int i = tamanho;
    while (i > 0 && v[i - 1] > x) {   /* desloca os maiores para a direita */
        v[i] = v[i - 1];
        i--;
    }
    v[i] = x;
    tamanho++;
    return i;
}

/* Remove a primeira ocorrência de x; devolve o índice ou -1. */
int remover(int x) {
    int i = 0;
    while (i < tamanho && v[i] != x) i++;
    if (i == tamanho) return -1;
    for (int j = i; j < tamanho - 1; j++) v[j] = v[j + 1];
    tamanho--;
    return i;
}
\`\`\`

Com \`struct\`, tudo funciona igual: a atribuição \`agenda[i] = agenda[i - 1]\` copia o registro inteiro, e a comparação de nomes usa \`strcmp\`.

## Armadilhas comuns

- **Esquecer de testar a lotação**: com \`tamanho == CAPACIDADE\`, escrever em \`v[tamanho]\` passa do fim do vetor e corrompe outras variáveis sem aviso.
- **Deslocar na direção errada**: para inserir, percorra da direita para a esquerda; para remover, da esquerda para a direita. No sentido oposto, um valor sobrescreve os seguintes antes de ser copiado.
- **Esquecer de atualizar o contador**: o vetor fica certo, mas a lista "não sabe" disso.
- **Empates**: \`>\` ou \`>=\` no deslocamento decide se um valor repetido entra antes ou depois dos iguais. Leia o enunciado.
- **\`strcasecmp\` no lugar de \`strcmp\`**: ignorar maiúsculas muda a ordem e junta nomes que deveriam ser diferentes.

## Complexidade

| Operação | Custo |
| --- | --- |
| acesso por índice | O(1) |
| inserir ou remover no fim | O(1) |
| inserir ou remover no meio | O(n) (deslocamento) |
| busca sequencial | O(n) |
| busca binária (lista ordenada) | O(log n) |

A vantagem é a simplicidade e o acesso direto; a limitação é a capacidade fixa e o custo de deslocar. As listas encadeadas, no próximo módulo, trocam esse deslocamento por ajustes de ponteiros.

## Pratique

1. **Lista estática: média de seis números**: o vetor fixo mais simples.
2. **Lista estática heterogênea: cadastro de softwares**: vetor de \`struct\`.
3. **Inserção ordenada em lista estática**: deslocamento para a direita e lotação.
4. **Remoção em lista estática**: deslocamento para a esquerda e "não encontrado".
5. **Agenda de contatos estática** (chefe): \`struct\`, ordem alfabética, inserção, remoção, busca e capacidade.
`
    }
  ],
  "listas-encadeadas": [
    {
      slug: "licao-listas-encadeadas",
      title: "Listas encadeadas: nós ligados por ponteiros",
      summary: "Cada nó guarda um valor e o endereço do próximo; inserir e remover viram ajustes de ponteiros, sem deslocar nada.",
      estimatedMinutes: 14,
      content: `
# Listas encadeadas

Numa **lista simplesmente encadeada**, cada elemento é um **nó** alocado separadamente, com um valor e um ponteiro para o próximo nó. A lista é representada pelo ponteiro para o primeiro nó, o \`head\`; o último nó aponta para \`NULL\`.

\`\`\`
head
 |
 v
[3 | *]--->[7 | *]--->[9 | *]---> NULL
\`\`\`

Variações:

- **Duplamente encadeada**: cada nó também aponta para o anterior, o que permite percorrer de trás para frente e remover um nó conhecendo só ele.
- **Circular**: o último nó aponta de volta para o primeiro.

## Percorrer, inserir e remover

\`\`\`c
struct ListNode {
    int val;
    struct ListNode *next;
};

/* Insere no início: O(1). */
struct ListNode *inserir_inicio(struct ListNode *head, int valor) {
    struct ListNode *novo = malloc(sizeof(struct ListNode));
    novo->val = valor;
    novo->next = head;
    return novo;              /* o novo nó é o novo head */
}

/* Percorre: O(n). */
for (struct ListNode *p = head; p != NULL; p = p->next) printf("%d ", p->val);
\`\`\`

Remover o nó seguinte a \`anterior\` é só fazer \`anterior->next = anterior->next->next\` (e liberar o nó removido). O problema é o \`head\`, que não tem anterior. Duas técnicas resolvem:

- **Nó sentinela**: um nó falso antes do \`head\`. Todo nó real passa a ter um anterior, e a resposta é \`sentinela.next\`.
- **Ponteiro para ponteiro** (em C): \`struct ListNode **p = &head\` aponta para "o campo que aponta para o nó atual", seja ele o \`head\` ou o \`next\` de alguém.

\`\`\`js
function removerValor(head, x) {
  const sentinela = new ListNode(0, head);
  let atual = sentinela;
  while (atual.next) {
    if (atual.next.val === x) atual.next = atual.next.next; // não avança
    else atual = atual.next;
  }
  return sentinela.next;
}
\`\`\`

## Dois ponteiros: lebre e tartaruga

Dois ponteiros partem do \`head\`: a tartaruga anda um nó por vez, a lebre dois. Quando a lebre chega ao fim, a tartaruga está no **meio**, em uma só passada. Se houver um ciclo, a lebre acaba alcançando a tartaruga: é o algoritmo de Floyd para detectar ciclos.

## Armadilhas comuns

- **Acessar \`p->next\` com \`p == NULL\`**: teste antes, como em \`while (lebre && lebre->next)\`.
- **Perder o resto da lista**: ao inserir no meio, ligue primeiro \`novo->next = atual->next\` e só depois \`atual->next = novo\`.
- **Avançar depois de remover**: o novo vizinho também pode precisar ser removido.
- **Esquecer de atualizar o \`head\`** quando o primeiro nó muda.
- **Usar um nó depois do \`free\`**: guarde \`p->next\` numa variável antes de liberar \`p\`.

## Complexidade

| Operação | Vetor | Lista encadeada |
| --- | --- | --- |
| acesso ao i-ésimo | O(1) | O(n) |
| inserir ou remover no início | O(n) | O(1) |
| inserir ou remover após um nó conhecido | O(n) | O(1) |
| busca | O(n) | O(n) |

A lista não precisa de capacidade prévia nem de deslocamentos, mas perde o acesso direto por índice e gasta um ponteiro extra por nó.

## Pratique

1. **Lista encadeada: está ordenada?**: percurso comparando vizinhos.
2. **Listas encadeadas: nomes em comum**: três listas e busca em cada uma.
3. **Lista duplamente encadeada**: ponteiros para o próximo e para o anterior.
4. **Lista simplesmente encadeada circular**: o último nó volta ao primeiro.
5. **Remover valor da lista encadeada**: nó sentinela ou ponteiro para ponteiro.
6. **Nó do meio**: lebre e tartaruga.
7. **Somar números guardados em listas** (chefe): percurso simultâneo, vai um e construção de uma lista nova.
`
    }
  ],
  pilhas: [
    {
      slug: "licao-pilhas",
      title: "Pilhas: o último a entrar é o primeiro a sair",
      summary: "A pilha só mexe no topo; isso basta para inverter sequências, avaliar expressões e achar o próximo maior em O(n).",
      estimatedMinutes: 13,
      content: `
# Pilhas

Uma **pilha** (*stack*) é uma coleção em que só o elemento do **topo** é acessível: o último a entrar é o primeiro a sair (**LIFO**, *last in, first out*), como uma pilha de pratos. As operações são:

- \`push(x)\`: empilha \`x\` no topo;
- \`pop()\`: remove e devolve o topo;
- \`top()\` (ou \`peek\`): consulta o topo sem remover;
- \`vazia()\`.

Todas custam O(1). A pilha pode ser um vetor com um índice de topo ou uma lista encadeada com inserção e remoção no início, como nos exercícios de lista dinâmica deste módulo.

\`\`\`c
int pilha[1000], topo = 0;
void empilhar(int x) { pilha[topo++] = x; }
int desempilhar(void) { return pilha[--topo]; }
\`\`\`

Em JavaScript e Python, um vetor comum já é uma pilha: \`push\`/\`pop\` e \`append\`/\`pop\` mexem no fim em O(1).

## Avaliar expressões pós-fixas

Na notação **pós-fixa**, o operador vem depois dos operandos: \`5 1 2 + *\` é \`5 * (1 + 2)\`. A avaliação é direta: número vai para a pilha; operador desempilha dois valores, calcula e empilha o resultado.

\`\`\`js
function avaliar(tokens) {
  const pilha = [];
  for (const t of tokens) {
    if (t.length === 1 && "+-*/".includes(t)) {
      const b = pilha.pop(), a = pilha.pop();   // b é o da direita!
      pilha.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : Math.trunc(a / b));
    } else pilha.push(Number(t));
  }
  return pilha[0];
}
\`\`\`

Para **converter** uma expressão infixa (\`a+b*c\`) em pós-fixa (\`abc*+\`), o algoritmo *shunting-yard* usa uma pilha de **operadores**: um operador espera na pilha até aparecer algo mais fraco, um \`)\` ou o fim. A associatividade decide os empates: \`a-b-c\` é \`(a-b)-c\`, mas \`a^b^c\` é \`a^(b^c)\`.

## Pilha monotônica

Um padrão poderoso: manter a pilha **ordenada** e desempilhar quem deixa de ser útil. Para achar o **próximo maior elemento** de cada posição, percorra o vetor guardando os índices que ainda esperam resposta; cada novo valor resolve todos os menores do topo.

\`\`\`
nums = [4, 1, 3, 5]
i=0  pilha [4]
i=1  pilha [4, 1]
i=2  3 > 1: próximo maior de 1 é 3    pilha [4, 3]
i=3  5 > 3 e 5 > 4: ambos recebem 5   pilha [5]
fim  5 fica sem próximo maior (-1)
\`\`\`

Parece O(n²) por causa do \`while\` dentro do \`for\`, mas cada índice entra e sai uma única vez: O(n) no total.

## Armadilhas comuns

- **\`pop\` em pilha vazia**: em C lê lixo ou uma posição inválida; em JS devolve \`undefined\`. Teste antes.
- **Ordem dos operandos**: o primeiro desempilhado é o operando da **direita**. \`a - b\` e \`a / b\` dependem disso.
- **Divisão truncada**: \`Math.floor(-7 / 2)\` é -4 e \`-7 // 2\` em Python também; truncar em direção ao zero dá -3.
- **Token "-7" contra operador "-"**: operador tem um só caractere.
- **Estrito ou não**: na pilha monotônica, \`<\` e \`<=\` mudam o tratamento dos valores iguais.

## Complexidade

\`push\`, \`pop\` e \`top\` são O(1). Avaliar ou converter uma expressão de n tokens custa O(n), assim como o próximo maior com pilha monotônica, contra O(n²) da busca ingênua.

## Pratique

1. **Lista dinâmica de números (pilha)**: inserir no topo e imprimir do topo para a base.
2. **Lista dinâmica heterogênea: disciplinas**: pilha de \`struct\`.
3. **Avaliar expressão pós-fixa**: pilha de valores e divisão truncada.
4. **Próximo maior elemento**: pilha monotônica em O(n).
5. **Converter infixa para pós-fixa** (chefe): shunting-yard com precedência e associatividade.
`
    }
  ],
  filas: [
    {
      slug: "licao-filas",
      title: "Filas, filas circulares e deque",
      summary: "A fila atende em ordem de chegada; em vetor, ela vira circular com o operador de resto, e a deque abre as duas pontas.",
      estimatedMinutes: 13,
      content: `
# Filas e deque

Uma **fila** (*queue*) atende em ordem de chegada: o primeiro a entrar é o primeiro a sair (**FIFO**, *first in, first out*). Os elementos entram pelo **fim** e saem pela **frente**:

- \`enfileirar(x)\`: coloca \`x\` no fim;
- \`desenfileirar()\`: remove e devolve o da frente;
- \`frente()\`: consulta sem remover.

A fila modela atendimento, impressão de documentos, busca em largura em grafos e qualquer processamento "na ordem em que chegou".

## Fila em vetor: o problema do começo

Remover do começo de um vetor desloca todos os outros (é o que \`shift()\` em JS e \`pop(0)\` em Python fazem): O(n) por operação. A saída é guardar um **índice da frente** que só avança. Mas então as posições do começo ficam perdidas. A **fila circular** resolve isso fazendo os índices darem a volta com o operador de resto:

\`\`\`
capacidade k = 5, 3 elementos, a fila "deu a volta"
índice:   0    1    2    3    4
valor:  [ 40][ 50][   ][   ][ 30]
               fim ^          ^ inicio
ordem da fila: 30, 40, 50
\`\`\`

\`\`\`c
#define MAX 1000
int v[MAX], k, inicio = 0, fim = 0, quantidade = 0;

int enfileirar(int x) {
    if (quantidade == k) return 0;        /* cheia */
    v[fim] = x;
    fim = (fim + 1) % k;                  /* dá a volta */
    quantidade++;
    return 1;
}

int desenfileirar(int *x) {
    if (quantidade == 0) return 0;        /* vazia */
    *x = v[inicio];
    inicio = (inicio + 1) % k;
    quantidade--;
    return 1;
}
\`\`\`

O i-ésimo elemento da fila está em \`v[(inicio + i) % k]\`. Em Python, \`collections.deque\` já oferece \`append\` e \`popleft\` em O(1).

## Deque: fila com duas pontas

A **deque** (*double-ended queue*) insere e remove nas duas pontas em O(1). Num vetor circular, inserir na frente é **recuar** o início: \`inicio = (inicio - 1 + k) % k\`. Para não ter capacidade fixa, dobre o vetor quando lotar, copiando os elementos em ordem, como no vetor dinâmico.

A deque é a estrutura da **janela deslizante**: para o máximo de cada janela, guarde índices com valores decrescentes; o novo elemento expulsa pelo fundo os menores, e a frente sai quando fica fora da janela. Cada índice entra e sai uma vez: O(n).

## Simulação em roda

No problema de Josephus, pessoas em roda são eliminadas de \`k\` em \`k\`. Uma fila simula a roda: tirar da frente e recolocar no fim é "passar a vez". Com \`m\` pessoas, girar \`k - 1\` vezes é o mesmo que girar \`(k - 1) % m\` vezes: o resto evita voltas inúteis quando \`k\` é enorme.

## Armadilhas comuns

- **Cheia ou vazia?** Na fila circular, \`inicio == fim\` acontece nos dois casos. Guarde a quantidade (ou deixe uma posição sempre livre).
- **Resto de número negativo**: em C e JavaScript, \`-1 % k\` é \`-1\`. Some \`k\` antes: \`(i - 1 + k) % k\`.
- **\`shift\` e \`pop(0)\` em laços grandes**: parecem O(1), mas custam O(n).
- **Capacidade fixa sem teste**: sobrescrever a frente quando a fila lota corrompe os dados em silêncio.

## Complexidade

| Estrutura | enfileirar | desenfileirar | frente |
| --- | --- | --- | --- |
| vetor com \`shift\` | O(1) | O(n) | O(1) |
| fila circular | O(1) | O(1) | O(1) |
| deque (vetor circular que cresce) | O(1) amortizado | O(1) | O(1) |

## Pratique

1. **Fila de atendimento**: ordem de chegada e fila vazia.
2. **Fila circular em vetor**: início, fim, quantidade e o operador \`%\`.
3. **Problema de Josephus**: a roda simulada e o resto para pular voltas.
4. **Máximo em janela deslizante**: deque monotônica em O(n).
5. **Deque de comandos** (chefe): vetor circular que cresce, com as duas pontas.
`
    }
  ]
};
