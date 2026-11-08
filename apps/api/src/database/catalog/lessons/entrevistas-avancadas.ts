import type { LessonDefinition } from "./index.js";

/** Lições da parte avançada da trilha de entrevistas (árvores, grafos, DP e design). */
export const ENTREVISTAS_AVANCADAS_LESSONS: Record<string, LessonDefinition[]> = {
  "entrevista-arvores": [
    {
      slug: "licao-entrevista-arvores",
      title: "Árvores em entrevistas: limites, níveis e descida guiada",
      summary: "Os três padrões de árvore que mais aparecem em entrevistas e como explicar cada um em voz alta.",
      estimatedMinutes: 12,
      content: `
# Árvores em entrevistas

Quase todo problema de árvore binária em entrevista cai em um de três padrões. Reconhecer o padrão cedo é metade da nota: o entrevistador quer ver que você sabe **qual informação precisa descer ou subir** pela árvore.

| Padrão | Pergunta que ele responde | Estrutura |
| --- | --- | --- |
| Limites herdados | "Este nó respeita tudo o que está acima dele?" | DFS levando (mínimo, máximo) |
| Fila por níveis | "O que existe em cada profundidade?" | BFS com contagem por nível |
| Descida guiada | "Onde, numa BST, está tal valor?" | Laço que escolhe esquerda ou direita |

## Padrão 1: limites herdados

Numa árvore binária de busca (BST), cada nó tem um **intervalo permitido** que vem de todos os ancestrais, não só do pai. A raiz aceita qualquer valor; ao descer para a esquerda, o máximo passa a ser o valor do nó; ao descer para a direita, o mínimo passa a ser o valor do nó.

\`\`\`js
function valida(no, lo = -Infinity, hi = Infinity) {
  if (!no) return true;
  if (no.val <= lo || no.val >= hi) return false;   // fora do intervalo herdado
  return valida(no.left, lo, no.val) && valida(no.right, no.val, hi);
}
\`\`\`

Uma alternativa equivalente: o percurso **em ordem** (esquerda, nó, direita) de uma BST estrita sai estritamente crescente.

## Padrão 2: fila por níveis

A busca em largura visita os nós na ordem em que estão nos níveis. O truque para separar os níveis é olhar o **tamanho da fila no início de cada rodada**: são exatamente os nós daquele nível.

\`\`\`js
let atual = raiz ? [raiz] : [];
while (atual.length) {
  const proximo = [];
  for (const no of atual) {
    if (no.left) proximo.push(no.left);
    if (no.right) proximo.push(no.right);
  }
  // "atual" é um nível completo aqui
  atual = proximo;
}
\`\`\`

## Padrão 3: descida guiada pela ordenação

Numa BST, uma comparação diz para que lado ir, sem olhar o resto da árvore. Buscar, inserir e achar o menor ancestral comum de dois valores são todos laços de O(h), onde h é a altura.

\`\`\`c
while (atual) {
    if (p < atual->val && q < atual->val) atual = atual->left;
    else if (p > atual->val && q > atual->val) atual = atual->right;
    else return atual->val;          /* p e q se separam aqui */
}
\`\`\`

## Como explicar o raciocínio em voz alta

1. **Repita o problema com um exemplo pequeno** desenhado: três ou quatro nós bastam. Diga o que conta como resposta nos casos de borda (árvore vazia, um nó só, p igual a q).
2. **Diga qual informação cada nó precisa**: "cada nó precisa saber o intervalo que os ancestrais permitem" ou "preciso saber onde termina cada nível".
3. **Proponha a ingênua e o custo dela** antes da ótima ("comparar cada nó com a subárvore inteira é O(n²)"). Isso mostra que você sabe por que a ótima é melhor.
4. **Anuncie a complexidade em termos de n e h**: O(n) de tempo e O(h) de pilha. Mencione que h pode ser n numa árvore degenerada.
5. **Teste em voz alta** com o contraexemplo clássico antes de dizer que terminou.

## Erros que reprovam

- **Comparar só com os filhos.** Em \`[10,5,15,null,null,6,20]\`, o 6 é menor que o pai 15, mas está à direita do 10. É o erro mais cobrado em validação de BST.
- **Sentinelas que colidem com os dados.** Usar \`INT_MIN\` e \`INT_MAX\` como limites falha quando a árvore contém exatamente esses valores. Use \`long long\`, \`-Infinity\` ou "sem limite" explícito.
- **Esquecer a árvore vazia.** O percurso por níveis de uma árvore vazia é \`[]\`, não \`[[]]\`.
- **Supor p menor que q.** Escreva as comparações de forma simétrica.
- **Recursão sem pensar na altura.** Numa árvore degenerada com dezenas de milhares de níveis, a pilha de chamadas estoura. Diga isso ao entrevistador e ofereça a versão iterativa.
- **Usar \`shift()\` numa fila grande em JavaScript**, que pode custar O(n) por chamada. Use um índice de leitura ou listas por nível.

## Complexidade

| Problema | Tempo | Espaço extra |
| --- | --- | --- |
| Validar BST | O(n) | O(h) |
| Percurso por níveis | O(n) | O(largura) |
| Menor ancestral comum em BST | O(h) | O(1) iterativo |

## Pratique

- **Validar árvore binária de busca**: limites herdados e o contraexemplo do neto.
- **Percurso por níveis**: fila com contagem por nível.
- **Menor ancestral comum em BST** (chefe): descida guiada, inclusive em árvores degeneradas de milhares de níveis.
`
    }
  ],
  "entrevista-grafos": [
    {
      slug: "licao-entrevista-grafos",
      title: "Grafos em entrevistas: flood fill e ordenação topológica",
      summary: "Como modelar grades e dependências como grafos e percorrê-los sem estourar a pilha.",
      estimatedMinutes: 13,
      content: `
# Grafos em entrevistas

Muitos problemas de entrevista são grafos disfarçados. Uma grade de caracteres é um grafo em que cada célula liga às vizinhas; uma lista de pré-requisitos é um grafo dirigido. O primeiro passo, sempre, é dizer em voz alta: **quem são os vértices e quem são as arestas?**

## Padrão 1: flood fill (componentes conexas)

Para contar regiões numa grade, varra todas as células. Ao encontrar uma célula de terra ainda não visitada, some 1 e "afunde" a região inteira com uma busca que marca tudo o que é alcançável. Cada célula é marcada uma vez, então o custo total é linear.

\`\`\`js
for (let inicio = 0; inicio < m * n; inicio++) {
  if (!terra[inicio]) continue;
  ilhas++;
  terra[inicio] = 0;
  const pilha = [inicio];
  while (pilha.length) {
    const cel = pilha.pop();
    for (const viz of vizinhos(cel)) {       // cima, baixo, esquerda, direita
      if (terra[viz]) { terra[viz] = 0; pilha.push(viz); }
    }
  }
}
\`\`\`

Dois detalhes separam uma resposta boa de uma mediana:

- **Marque ao empilhar**, não ao desempilhar. Senão a mesma célula entra várias vezes na pilha.
- **Prefira pilha explícita ou fila a recursão.** Um mapa 700×700 todo de terra teria uma DFS recursiva de 490 mil chamadas: estoura a pilha em JavaScript e o limite de recursão em Python.

## Padrão 2: ordenação topológica (Kahn)

Quando o problema fala em "b depende de a", pense em aresta a → b. Uma ordem que respeita todas as arestas existe se, e só se, o grafo não tem ciclo. O algoritmo de Kahn constrói essa ordem:

1. Conte o **grau de entrada** de cada vértice (quantas dependências faltam).
2. Coloque numa estrutura os vértices com grau zero.
3. Retire um, anote-o e decremente o grau de quem depende dele; quem chegar a zero entra na estrutura.
4. Se no fim a ordem tiver menos vértices do que o grafo, **há ciclo**.

A estrutura do passo 2 decide qual ordem sai. Com uma fila comum, sai uma ordem válida qualquer. Com um **heap mínimo**, sai a ordem lexicograficamente menor, porque a cada passo você executa a menor tarefa liberada.

\`\`\`c
while (tamanho > 0) {
    int t = retirarMenor(heap, &tamanho);
    ordem[feitas++] = t;
    for (int k = inicio[t]; k < inicio[t + 1]; k++)
        if (--grau[destino[k]] == 0) inserir(heap, &tamanho, destino[k]);
}
if (feitas < n) { /* ciclo: não há ordem possível */ }
\`\`\`

## Como explicar o raciocínio em voz alta

1. **Modele primeiro**: "cada célula de terra é um vértice; duas são vizinhas se dividem um lado" ou "cada dependência [a, b] é uma aresta de a para b".
2. **Escolha a busca e justifique**: DFS e BFS têm o mesmo custo aqui; diga que vai usar uma pilha explícita para não depender da pilha de chamadas.
3. **Nomeie o algoritmo** quando ele tiver nome (Kahn, union-find). Isso economiza explicação e mostra repertório.
4. **Diga como detecta o caso impossível** (o ciclo) antes que perguntem.
5. **Dê a complexidade em V e E**: O(V + E) para as buscas, O((V + E) log V) com heap.

## Erros que reprovam

- **Contar diagonais quando o enunciado fala em quatro vizinhos**, ou o contrário. Leia a definição de "ligado" em voz alta.
- **Sair dos limites da grade** ao olhar vizinhos. Cheque linha e coluna antes de acessar.
- **Esquecer de marcar como visitado**, gerando laço infinito ou contagem duplicada.
- **Fila comum quando se pede a menor ordem.** O Kahn com FIFO dá uma ordem válida, mas não a lexicograficamente menor.
- **Não detectar ciclo.** Retornar uma ordem parcial como se estivesse completa é resposta errada.
- **Solução O(V²)**: procurar a menor tarefa livre varrendo todas as tarefas a cada passo. Com 10^5 tarefas, não termina.

## Complexidade

| Problema | Tempo | Espaço |
| --- | --- | --- |
| Número de ilhas | O(m·n) | O(m·n) |
| Ordem topológica (qualquer) | O(V + E) | O(V + E) |
| Ordem topológica lexicograficamente menor | O((V + E) log V) | O(V + E) |

## Pratique

- **Número de ilhas**: flood fill iterativo em grades de até 700×700, inclusive mapas inteiros de terra.
- **Ordem das tarefas** (chefe): Kahn com heap mínimo e detecção de ciclo, com até 10^5 tarefas.
`
    }
  ],
  "entrevista-dp-design": [
    {
      slug: "licao-entrevista-dp-design",
      title: "Programação dinâmica e design de estruturas em entrevistas",
      summary: "Como sair da recursão ingênua para a DP e como combinar estruturas para ter O(1) ou O(log n) por operação.",
      estimatedMinutes: 15,
      content: `
# Programação dinâmica e design em entrevistas

Esta etapa junta dois tipos de pergunta que parecem diferentes, mas pedem a mesma habilidade: **guardar a informação certa** para não recalcular nada.

## Programação dinâmica em quatro passos

1. **Defina o estado em uma frase**: "\`melhor[v]\` é o menor número de moedas que somam v".
2. **Escreva a recorrência** olhando a última decisão: a última moeda usada, o último degrau pisado, o último elemento da subsequência.
3. **Fixe os casos base**: \`melhor[0] = 0\`, \`f(0) = f(1) = 1\`.
4. **Escolha a ordem de cálculo** de modo que cada estado dependa só de estados já calculados, e veja se dá para guardar só os últimos.

\`\`\`js
// troco mínimo: a última moeda usada foi c
const melhor = new Array(valor + 1).fill(Infinity);
melhor[0] = 0;
for (const c of moedas)
  for (let v = c; v <= valor; v++)
    melhor[v] = Math.min(melhor[v], melhor[v - c] + 1);
\`\`\`

O caminho que o entrevistador gosta de ver é: recursão direta (exponencial), depois memorização (polinomial, mas usa a pilha), depois tabela de baixo para cima (sem recursão), e por fim a economia de espaço.

### Quando a DP ainda é lenta

A DP clássica da maior subsequência crescente é O(n²). A versão O(n log n) muda o estado: em vez de "maior subsequência que termina em i", guarde \`caudas[k]\`, a **menor cauda** possível de uma subsequência de tamanho k + 1. Esse vetor é crescente, então cada número entra por busca binária.

## Design: combinar estruturas

Perguntas de design pedem operações rápidas que nenhuma estrutura sozinha oferece. A resposta quase sempre é **duas estruturas trabalhando juntas**:

| Problema | Estrutura A | Estrutura B | Custo |
| --- | --- | --- | --- |
| Cache LRU | Mapa chave → nó | Lista duplamente encadeada por uso | O(1) por operação |
| Mediana em fluxo | Heap de máximo (metade de baixo) | Heap de mínimo (metade de cima) | O(log n) por inserção |

No cache LRU, o mapa acha a chave e a lista dupla permite tirar um nó do meio e colocá-lo na frente mexendo só em ponteiros:

\`\`\`c
no->prev->next = no->next;          /* desliga */
no->next->prev = no->prev;
no->next = cabeca->next;            /* religa logo depois da cabeça */
no->prev = cabeca;
cabeca->next->prev = no;
cabeca->next = no;
\`\`\`

Na mediana, as invariantes são duas: todo valor de baixo é menor ou igual a todo valor de cima, e os tamanhos diferem no máximo em um. Os topos dos heaps são exatamente os candidatos à mediana.

## Como explicar o raciocínio em voz alta

1. **Comece pela força bruta e diga o custo** ("ordenar a cada consulta é O(n log n) por mediana").
2. **Diga qual operação é o gargalo** ("o difícil é achar em O(1) a chave usada há mais tempo").
3. **Enuncie o estado ou as invariantes antes do código.** Na DP, a frase do estado; no design, as regras que as estruturas mantêm.
4. **Percorra um exemplo pequeno à mão**: preencha a tabela para valor 6 com moedas [1, 3, 4], ou simule três operações do cache.
5. **Feche com a complexidade de tempo e de memória** e com um caso de borda.

## Erros que reprovam

- **Guloso onde precisa de DP.** Sempre pegar a maior moeda falha com [1, 3, 4] e valor 6.
- **Esquecer o módulo** quando o enunciado pede: o número de maneiras de subir 44 degraus já passa de 10^9.
- **Recursão memorizada com n = 10^6**: correta, mas estoura a pilha. Converta para laço.
- **Busca binária com a comparação errada**: \`>\` em vez de \`>=\` calcula a subsequência não decrescente.
- **Esquecer que atualizar uma chave do cache também é uso.**
- **Somar os dois valores do meio em \`int\`**: \`10^9 + 10^9\` estoura 32 bits.

## Complexidade

| Problema | Tempo | Espaço |
| --- | --- | --- |
| Subir a escada | O(n) | O(1) |
| Troco com menos moedas | O(k·V) | O(V) |
| Maior subsequência crescente | O(n log n) | O(n) |
| Cache LRU | O(1) por operação | O(capacidade) |
| Mediana em fluxo | O(log n) por inserção | O(n) |

## Pratique

- **Subir a escada**: da recursão exponencial ao laço com duas variáveis.
- **Troco com menos moedas**: DP sobre o valor, contra a armadilha gulosa.
- **Maior subsequência crescente**: caudas e busca binária.
- **Cache LRU**: mapa com lista dupla.
- **Mediana em fluxo** (chefe): dois heaps e as invariantes entre eles.
`
    }
  ]
};
