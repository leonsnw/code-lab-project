import type { LessonDefinition } from "./index.js";

/** Markdown com crases: escreva "§" no lugar de "`" (evita escapar em template literals). */
const md = (strings: TemplateStringsArray, ...values: unknown[]) => String.raw(strings, ...values).replace(/§/g, "`").trim();

const VETORES_HASH: LessonDefinition = {
  slug: "licao-entrevista-vetores-hash",
  title: "Vetores e hash: trocar laços aninhados por uma passada",
  summary: "Como reconhecer problemas de vetor que viram uma passada com mapa, conjunto ou acumuladores de prefixo e sufixo.",
  estimatedMinutes: 12,
  content: md`
# Vetores e hash: trocar laços aninhados por uma passada

Boa parte das perguntas de vetor em entrevistas tem a mesma forma: a solução óbvia usa **dois laços aninhados**, O(n²), e a solução esperada faz **uma passada** guardando alguma informação sobre o que já foi visto. Essa informação quase sempre cabe num **mapa** (valor -> índice ou contagem), num **conjunto** ou em **acumuladores** de prefixo e sufixo.

## O padrão

Pergunte-se: "para decidir algo sobre o elemento atual, o que eu precisaria saber sobre os anteriores?".

- **Complemento:** para fechar uma soma com §nums[j]§, preciso saber se §alvo - nums[j]§ já apareceu. Um mapa responde em O(1).
- **Frequência:** para ranquear valores, preciso de quantas vezes cada um aparece. Um mapa de contagem resolve numa passada.
- **Pertinência:** para saber se §x + 1§ existe, um conjunto responde em O(1), sem ordenar.
- **Prefixo e sufixo:** quando a resposta de §i§ depende de "tudo menos §i§", ela é a combinação do que está à esquerda com o que está à direita.

## Exemplo comentado: complemento com hash

§§§js
function doisNumerosAlvo(nums, alvo) {
  const posicao = new Map();          // valor -> índice em que apareceu
  for (let j = 0; j < nums.length; j++) {
    const falta = alvo - nums[j];     // o único parceiro possível de nums[j]
    if (posicao.has(falta)) return [posicao.get(falta), j];
    posicao.set(nums[j], j);          // só depois de consultar
  }
  return [];
}
§§§

Consultar **antes** de inserir é o detalhe que impede um elemento de formar par consigo mesmo, e ainda trata valores repetidos (§[3, 3]§ com alvo 6) sem código extra.

## Como explicar o raciocínio em voz alta

Entrevistadores avaliam o caminho, não só o código final. Uma narração que funciona:

1. **Repita o problema com suas palavras** e confirme as bordas: "pode ter repetidos? pode ser vazio? a resposta é única?".
2. **Diga a solução ingênua e o custo:** "testar todos os pares é O(n²); com 200 000 elementos são 2·10^10 operações, não serve".
3. **Aponte o trabalho repetido:** "para cada j eu procuro um valor específico entre os anteriores; essa busca é que custa O(n)".
4. **Troque a busca por uma estrutura:** "se eu guardar os anteriores num mapa, cada busca vira O(1) em média".
5. **Teste à mão** com um exemplo pequeno, incluindo uma borda, antes de dizer que terminou.
6. **Feche com a complexidade** de tempo e de memória, e mencione a troca: ganhamos tempo gastando O(n) de memória.

## Erros que reprovam

- **Pular a solução ingênua** e ir direto para o código ótimo sem explicar por quê: parece decoreba.
- **Inserir antes de consultar** no complemento, usando o mesmo índice duas vezes.
- **Desempate implícito:** em "os k mais frequentes", ordenar só pela frequência e confiar na ordem que a biblioteca devolve. Se o enunciado define um desempate, ele precisa estar no comparador.
- **Usar divisão quando ela é proibida** (ou quando há zeros): no produto exceto a posição, a divisão quebra com um zero e com vários.
- **Esquecer a verificação de início** na maior sequência consecutiva: com um conjunto, mas medindo a partir de todo elemento, o algoritmo volta a ser O(n²).
- **Iterar sobre o vetor em vez do conjunto** quando há repetidos: o mesmo trabalho é refeito para cada cópia.
- **Não citar o custo de memória.** O(n) extra é aceitável, mas precisa ser dito.

## Complexidade

| Técnica | Tempo | Memória |
| --- | --- | --- |
| Pares com dois laços | O(n²) | O(1) |
| Mapa de complemento | O(n) | O(n) |
| Mapa de frequência + ordenação dos distintos | O(n log n) | O(n) |
| Conjunto + inícios de sequência | O(n) | O(n) |
| Prefixo × sufixo | O(n) | O(1) além da saída |

Operações de mapa e conjunto são O(1) **em média**; vale mencionar que o pior caso depende da função de hash.

## Pratique

- **Dois números que somam o alvo:** o complemento com hash na forma mais pura.
- **Produto exceto a própria posição:** prefixo e sufixo, sem divisão.
- **Os k valores mais frequentes:** contagem com mapa e um critério de ordenação explícito.
- **Maior sequência de consecutivos (chefe):** conjunto e a ideia de só começar pelos inícios.
`
};

const STRINGS_JANELAS: LessonDefinition = {
  slug: "licao-entrevista-strings-janelas",
  title: "Strings e janelas: o melhor trecho contíguo",
  summary: "Janela deslizante, Kadane e expansão pelo centro para perguntas sobre o melhor trecho contíguo de uma string ou vetor.",
  estimatedMinutes: 13,
  content: md`
# Strings e janelas: o melhor trecho contíguo

Quando a pergunta fala em **substring** ou **subvetor** (trecho contíguo) e pede o maior, o menor ou o melhor, a solução ingênua testa todos os pares de início e fim: O(n²) trechos, cada um verificado em até O(n). Três ideias derrubam esse custo:

- **Janela deslizante:** dois índices, §inicio§ e §fim§, que só andam para a frente. A janela cresce pela direita e encolhe pela esquerda para continuar válida.
- **Melhor trecho que termina aqui (Kadane):** em vez de olhar todos os trechos, olhe o melhor que termina em cada posição e derive o próximo a partir dele.
- **Expansão pelo centro:** para palíndromos, escolha o centro e cresça para os dois lados, em vez de escolher início e fim.

## Exemplo comentado: janela com última posição

Maior trecho sem caracteres repetidos:

§§§js
function maiorSubstringSemRepeticao(s) {
  const ultima = new Map();   // caractere -> última posição vista
  let inicio = 0, melhor = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    // só importa se a repetição estiver DENTRO da janela atual
    if (ultima.has(c) && ultima.get(c) >= inicio) inicio = ultima.get(c) + 1;
    ultima.set(c, i);
    melhor = Math.max(melhor, i - inicio + 1);
  }
  return melhor;
}
§§§

A invariante é: **a janela §[inicio, i]§ nunca tem repetição**. Cada índice entra uma vez e o início só avança, então o total é O(n).

## Kadane em uma frase

"O melhor subvetor que termina em §i§ ou estende o melhor que terminava em §i - 1§, ou começa do zero em §i§":

§§§c
long long atual = nums[0], melhor = nums[0];
for (int i = 1; i < n; i++) {
    atual = atual < 0 ? nums[i] : atual + nums[i]; /* prefixo negativo só atrapalha */
    if (atual > melhor) melhor = atual;
}
§§§

## Como explicar o raciocínio em voz alta

1. **Classifique o problema:** "é um trecho contíguo e quero o melhor; isso sugere janela ou uma recorrência sobre o trecho que termina em i".
2. **Declare a invariante** antes de escrever código: "a janela nunca tem repetição" ou "atual é a melhor soma terminando em i". Quem declara a invariante raramente erra os índices.
3. **Diga o que faz a janela crescer e o que a faz encolher.** Em entrevistas, quase todo bug de janela está no encolhimento.
4. **Justifique o O(n):** "cada índice entra e sai da janela no máximo uma vez".
5. **Rode à mão uma borda traiçoeira:** §"abba"§ para a janela, um vetor todo negativo para Kadane, §"ab"§ para o desempate do palíndromo.

## Erros que reprovam

- **Deixar o início voltar para trás.** Na janela sem repetição, a última posição de um caractere pode estar fora da janela; sem o teste §ultima[c] >= inicio§ (ou um §max§), a resposta sai grande demais.
- **Iniciar Kadane com 0.** O subvetor precisa ter ao menos um elemento: com todos negativos, a resposta é o maior deles, não 0.
- **Estourar o inteiro.** Somas de 200 000 valores de até 10^9 passam de 2^31; em C use §long long§.
- **Esquecer os palíndromos pares.** São 2n - 1 centros: cada caractere e cada espaço entre dois vizinhos.
- **Ignorar o desempate pedido.** "O mais à esquerda" é garantido percorrendo os centros da esquerda para a direita e trocando a resposta só com tamanho estritamente maior.
- **Verificar cada trecho do zero** (O(n³)) sem perceber que o trecho seguinte reaproveita quase todo o anterior.

## Complexidade

| Problema | Ingênuo | Esperado | Memória |
| --- | --- | --- | --- |
| Maior trecho sem repetição | O(n²) ou pior | O(n) | O(tamanho do alfabeto) |
| Maior soma de subvetor | O(n²) | O(n) | O(1) |
| Maior palíndromo | O(n³) | O(n²) | O(1) |

Para o palíndromo existe ainda o algoritmo de Manacher, O(n), mas numa entrevista a expansão pelo centro bem explicada costuma ser suficiente; citar que existe algo melhor mostra repertório.

## Pratique

- **Maior substring sem repetição:** janela variável com mapa de últimas posições.
- **Maior soma de subvetor:** Kadane, incluindo o caso todo negativo.
- **Maior substring palíndroma (chefe):** expansão pelo centro com desempate pela esquerda.
`
};

const PILHAS_INTERVALOS: LessonDefinition = {
  slug: "licao-entrevista-pilhas-intervalos",
  title: "Pilhas, busca binária e intervalos",
  summary: "Três invariantes clássicas de entrevista: a pilha guarda o que ainda está aberto, a busca binária mantém o alvo no intervalo e intervalos ordenados só se fundem com o último.",
  estimatedMinutes: 14,
  content: md`
# Pilhas, busca binária e intervalos

Os três problemas deste módulo parecem diferentes, mas pedem a mesma habilidade: **escolher uma invariante e mantê-la** a cada passo. É isso que o entrevistador quer ouvir.

## Pilha: o que ainda está pendente

A pilha aparece sempre que o elemento mais recente ainda não resolvido é o próximo a ser resolvido (LIFO). Em parênteses válidos, o símbolo que fecha precisa casar com a **última abertura pendente**:

§§§js
function parentesesValidos(s) {
  const par = { ")": "(", "]": "[", "}": "{" };
  const pilha = [];
  for (const c of s) {
    if (c === "(" || c === "[" || c === "{") pilha.push(c);
    else if (pilha.pop() !== par[c]) return false; // vazia ou tipo errado
  }
  return pilha.length === 0; // sobrou abertura? inválida
}
§§§

Invariante: **a pilha contém, em ordem, as aberturas ainda não fechadas**.

## Busca binária: o alvo, se existir, está em [inicio, fim]

Num vetor ordenado e rotacionado, cortar ao meio sempre deixa **pelo menos uma metade ordenada**. Compare §nums[inicio]§ com §nums[meio]§ para descobrir qual; numa metade ordenada, dá para testar em O(1) se o alvo está entre as pontas. Se estiver, fique nela; senão, vá para a outra. Cada passo descarta metade do intervalo: O(log n).

## Intervalos: ordenar primeiro

Depois de ordenar pelo início, um intervalo novo só pode se fundir com o **último** intervalo do resultado. Se não encosta nele, não encosta em nenhum anterior.

§§§c
/* depois de ordenar por início */
if (total > 0 && inicio <= resultado[total - 1][1]) {
    if (fim > resultado[total - 1][1]) resultado[total - 1][1] = fim; /* estende */
} else {
    /* começa um intervalo novo */
}
§§§

## Como explicar o raciocínio em voz alta

1. **Nomeie a estrutura pela necessidade:** "preciso do último aberto -> pilha", "preciso descartar metade a cada passo -> busca binária", "sobreposição só entre vizinhos depois de ordenar -> ordenar e varrer".
2. **Declare a invariante em uma frase** e volte a ela quando escrever cada §if§.
3. **Mostre por que a solução simples falha.** Contar aberturas e fechamentos não pega §"([)]"§; busca binária comum não funciona no vetor rotacionado; comparar todos os pares de intervalos é O(n²).
4. **Teste as fronteiras:** pilha vazia ao fechar, dois elementos na busca (§inicio == meio§), intervalos que apenas se tocam.
5. **Diga o custo dominante:** para intervalos, a ordenação O(n log n) domina a varredura O(n).

## Erros que reprovam

- **Desempilhar sem checar se a pilha está vazia** (em C, ler fora do vetor) ou **não conferir a pilha no fim**.
- **Usar < onde era <=** na busca rotacionada: com §inicio == meio§, a metade esquerda de um elemento é tratada como desordenada e o alvo é descartado.
- **Calcular o meio com §(inicio + fim) / 2§ sem pensar em estouro** em linguagens com inteiros fixos; §inicio + (fim - inicio) / 2§ é o hábito seguro.
- **Esquecer de ordenar os intervalos**, supondo que a entrada já vem ordenada.
- **Usar < em vez de <= na sobreposição**, deixando separados intervalos que só se tocam, como §[1, 3]§ e §[3, 5]§.
- **Encolher o fim ao fundir:** §[1, 10]§ seguido de §[2, 3]§ precisa continuar §[1, 10]§; use o máximo dos fins.
- **Responder a busca com um mapa valor -> índice** e parar por aí: é rápido, mas a pergunta é sobre busca binária, e o entrevistador vai perguntar pela memória extra.

## Complexidade

| Problema | Ingênuo | Esperado | Memória |
| --- | --- | --- | --- |
| Parênteses válidos | O(n²) (apagar pares repetidamente) | O(n) | O(n) |
| Busca em vetor rotacionado | O(n) por consulta | O(log n) por consulta | O(1) |
| Mesclar intervalos | O(n²) | O(n log n) | O(n) |

## Pratique

- **Parênteses válidos:** a pilha na forma mais direta.
- **Busca em vetor rotacionado:** busca binária guiada pela metade ordenada.
- **Mesclar intervalos (chefe):** ordenar pelo início e fundir com o último.
`
};

const LISTAS: LessonDefinition = {
  slug: "licao-entrevista-listas",
  title: "Listas encadeadas: ponteiros sem se perder",
  summary: "Inverter, detectar ciclos e mesclar listas manipulando só os ponteiros next, com três ponteiros, lebre e tartaruga e nó sentinela.",
  estimatedMinutes: 12,
  content: md`
# Listas encadeadas: ponteiros sem se perder

Perguntas de lista encadeada testam uma coisa: se você consegue **religar ponteiros sem perder o resto da lista**. Não há truque de estrutura de dados; há três técnicas que resolvem quase tudo.

- **Três ponteiros** (§anterior§, §atual§, §proximo§): para mudar um §next§ sem perder quem vinha depois, guarde-o antes.
- **Lebre e tartaruga** (Floyd): dois ponteiros com velocidades diferentes detectam ciclos e acham o meio da lista com O(1) de memória.
- **Nó sentinela:** um nó falso antes da cabeça elimina o caso especial "a lista resultante ainda está vazia".

## Exemplo comentado: inverter com três ponteiros

§§§c
struct ListNode* inverterLista(struct ListNode* head) {
    struct ListNode *anterior = NULL, *atual = head;
    while (atual) {
        struct ListNode *proximo = atual->next; /* 1. guarda o resto   */
        atual->next = anterior;                  /* 2. vira a seta      */
        anterior = atual;                        /* 3. avança os dois   */
        atual = proximo;
    }
    return anterior; /* o antigo último nó é a nova cabeça */
}
§§§

A ordem das linhas é tudo: se você fizer §atual->next = anterior§ antes de guardar §proximo§, o resto da lista some.

## Lebre e tartaruga

§§§js
function temCiclo(head) {
  let lento = head, rapido = head;
  while (rapido && rapido.next) {
    lento = lento.next;          // um passo
    rapido = rapido.next.next;   // dois passos
    if (lento === rapido) return true;
  }
  return false; // a lebre achou o fim
}
§§§

Se há ciclo, as duas entram nele e, a cada rodada, a lebre ganha um nó de vantagem; ela não tem como "pular" a tartaruga, então as duas se encontram.

## Como explicar o raciocínio em voz alta

1. **Desenhe.** Três ou quatro caixas com setas no quadro valem mais que qualquer explicação. Mostre o estado antes e depois de uma iteração.
2. **Nomeie os ponteiros pelo papel**, não por letras: §anterior§, §atual§, §cauda§, §lento§, §rapido§.
3. **Declare o que cada ponteiro significa** ao fim de cada iteração: "§anterior§ é a cabeça da parte já invertida".
4. **Teste lista vazia, lista de um nó e lista de dois nós** em voz alta. São exatamente os casos em que o entrevistador vai insistir.
5. **Fale da memória:** a solução com conjunto de visitados é O(n) de memória; Floyd é O(1). A versão recursiva de inverter ou mesclar usa O(n) de pilha de chamadas.

## Erros que reprovam

- **Perder o resto da lista** por mudar §next§ antes de guardá-lo.
- **Acessar §rapido.next.next§ sem checar §rapido.next§**: erro de ponteiro nulo em listas de tamanho par.
- **Comparar valores em vez de nós.** Dois nós com o mesmo §val§ são nós diferentes; em Python use §is§, em C compare os ponteiros.
- **Esquecer o resto de uma das listas** ao mesclar: quando o laço termina, uma das duas ainda pode ter nós.
- **Criar nós novos** quando a pergunta pede para reaproveitar os existentes (e, em C, alocar sem liberar).
- **Tratar a cabeça como caso especial** com vários §if§, quando um sentinela resolveria.
- **Heurísticas de passos** ("se andou mais de 10 000 nós, deve ter ciclo"): erram em listas longas.

## Complexidade

| Problema | Tempo | Memória |
| --- | --- | --- |
| Inverter (iterativo) | O(n) | O(1) |
| Inverter (recursivo) | O(n) | O(n) de pilha |
| Detectar ciclo com conjunto | O(n) | O(n) |
| Detectar ciclo com Floyd | O(n) | O(1) |
| Mesclar duas listas ordenadas | O(n + m) | O(1) |

## Pratique

- **Inverter lista encadeada:** três ponteiros, sem criar nós.
- **Detectar ciclo em lista encadeada:** lebre e tartaruga.
- **Mesclar duas listas ordenadas (chefe):** nó sentinela e ponteiro de cauda.
`
};

export const ENTREVISTAS_LINEARES_LESSONS: Record<string, LessonDefinition[]> = {
  "entrevista-vetores-hash": [VETORES_HASH],
  "entrevista-strings-janelas": [STRINGS_JANELAS],
  "entrevista-pilhas-intervalos": [PILHAS_INTERVALOS],
  "entrevista-listas": [LISTAS]
};
