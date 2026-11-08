import type { LessonDefinition } from "./index.js";

/** Lições dos módulos de backtracking, programação dinâmica e bits (trilha Algoritmos e Padrões). */
export const ALGORITMOS_AVANCADOS_LESSONS: Record<string, LessonDefinition[]> = {
  backtracking: [
    {
      slug: "licao-backtracking",
      title: "Backtracking: escolher, explorar e desfazer",
      summary: "Como gerar todas as possibilidades com recursão e cortar cedo os caminhos que não levam a lugar nenhum.",
      estimatedMinutes: 12,
      content: `
# Backtracking: escolher, explorar e desfazer

Alguns problemas pedem **todas** as respostas possíveis (todos os subconjuntos, todas as ordens) ou exigem procurar uma configuração válida num espaço enorme (um sudoku, rainhas num tabuleiro). O **backtracking** é a técnica de montar a resposta **uma decisão por vez** e, sempre que uma decisão leva a um beco sem saída, **voltar** e tentar a próxima opção.

Pense num labirinto: em cada bifurcação você escolhe um corredor. Se ele termina numa parede, você volta até a última bifurcação e tenta outro. Você nunca anda às cegas por todos os caminhos ao mesmo tempo; só mantém o caminho atual.

## O esqueleto

Quase todo backtracking tem a mesma forma:

1. **Caso base:** se a solução parcial está completa, registre-a (uma **cópia**!) e volte.
2. **Para cada opção** possível no passo atual:
   - se ela é inválida, pule (isso é a **poda**);
   - **escolha**: aplique a opção na solução parcial;
   - **explore**: chame a recursão para o próximo passo;
   - **desfaça**: retire a opção, deixando tudo como estava.

O "desfazer" é o que dá nome à técnica. Como a mesma estrutura (o caminho atual) é reaproveitada por todos os ramos, cada ramo precisa devolvê-la intacta para o próximo.

## Exemplo comentado: subconjuntos

Para cada elemento há duas decisões: ele entra ou não entra.

\`\`\`js
function subconjuntos(nums) {
  const resposta = [];
  const caminho = [];
  function explorar(i) {
    if (i === nums.length) {        // caso base: decidimos todos
      resposta.push([...caminho]);  // cópia, não a referência
      return;
    }
    caminho.push(nums[i]);          // escolhe: nums[i] entra
    explorar(i + 1);                // explora
    caminho.pop();                  // desfaz
    explorar(i + 1);                // explora a outra opção: não entra
  }
  explorar(0);
  return resposta;
}
\`\`\`

A árvore de decisões tem \`n\` níveis e \`2^n\` folhas. Permutações seguem o mesmo molde, mas cada nível escolhe **qual** número ainda livre vai na posição atual (um vetor \`usado\` marca os que já estão no caminho).

## Poda: a diferença entre segundos e horas

Gerar tudo e filtrar depois é caro. A poda descarta um ramo **assim que** ele se mostra inválido. No problema das n rainhas, por exemplo, colocamos uma rainha por linha e só descemos para a linha seguinte se a casa não está atacada. Para saber isso em \`O(1)\`, guardamos três marcações:

- colunas ocupadas;
- diagonais "descendo para a direita", identificadas por \`linha - coluna\`;
- diagonais "descendo para a esquerda", identificadas por \`linha + coluna\`.

\`\`\`c
static void colocar(int r) {
    if (r == n) { total++; return; }
    for (int c = 0; c < n; c++) {
        if (col[c] || diag[r - c + n - 1] || anti[r + c]) continue; // poda
        col[c] = diag[r - c + n - 1] = anti[r + c] = true;          // escolhe
        colocar(r + 1);                                             // explora
        col[c] = diag[r - c + n - 1] = anti[r + c] = false;         // desfaz
    }
}
\`\`\`

Com \`n = 12\`, testar todas as \`12!\` (479 milhões) permutações não termina a tempo; com a poda, a busca visita algumas centenas de milhares de nós.

Outra poda poderosa é **escolher primeiro a decisão mais restrita**. No sudoku, preencher a casa vazia com **menos** candidatos faz muitas casas saírem sem chute nenhum e revela contradições cedo.

## Armadilhas comuns

- **Guardar a referência em vez de uma cópia.** \`resposta.push(caminho)\` guarda o mesmo vetor várias vezes; no fim, todos aparecem vazios.
- **Esquecer de desfazer.** Se você marca \`usado[i] = true\` e não desmarca, os ramos seguintes ficam sem opções.
- **Gerar duplicatas.** Em combinações, \`[2, 3]\` e \`[3, 2]\` são a mesma coisa: só permita escolher índices a partir do último escolhido.
- **Ordem da saída.** Se o enunciado exige cada resposta em ordem crescente, ordene a entrada antes. Em JavaScript, \`sort()\` sem comparador ordena como texto (\`10\` vem antes de \`2\`): use \`sort((a, b) => a - b)\`.

## Complexidade

O custo de um backtracking é o número de nós da árvore de busca vezes o trabalho em cada nó. Sem poda, ele é exponencial: \`O(2^n)\` para subconjuntos, \`O(n!)\` para permutações. Isso é inevitável quando a própria resposta tem esse tamanho. Quando só queremos uma solução (ou uma contagem), a poda reduz drasticamente os nós visitados, mesmo que o pior caso teórico continue exponencial. O espaço extra costuma ser só a profundidade da recursão, \`O(n)\`.

## Pratique

- **Todos os subconjuntos**: a decisão "entra ou não entra".
- **Permutações**: escolher entre os que ainda não foram usados.
- **Combinações com soma alvo**: repetição permitida e poda quando passa do alvo.
- **N rainhas**: poda com colunas e diagonais.
- **Resolver sudoku** (chefe): máscaras, poda e a casa com menos candidatos.
`
    }
  ],
  "programacao-dinamica": [
    {
      slug: "licao-programacao-dinamica",
      title: "Programação dinâmica: estado, transição e caso base",
      summary: "Como transformar uma recursão exponencial numa tabela preenchida em tempo polinomial.",
      estimatedMinutes: 15,
      content: `
# Programação dinâmica: estado, transição e caso base

Muitas recursões resolvem o mesmo subproblema várias vezes. A de Fibonacci é o exemplo clássico: \`fib(5)\` chama \`fib(4)\` e \`fib(3)\`, e \`fib(4)\` chama \`fib(3)\` de novo. O número de chamadas cresce exponencialmente, embora existam só \`n\` subproblemas diferentes.

A **programação dinâmica** (PD) resolve cada subproblema **uma vez** e guarda o resultado. Há duas formas de fazer isso:

- **Memoização (de cima para baixo):** a recursão continua igual, mas antes de calcular consulta um cache.
- **Tabela (de baixo para cima):** preenchemos um vetor ou matriz na ordem certa, dos subproblemas menores para os maiores, sem recursão.

## As três perguntas

Toda solução de PD começa respondendo três perguntas:

1. **Estado:** o que um subproblema representa? Ex.: \`melhor[i]\` = maior total usando só as casas \`0..i\`.
2. **Transição:** como o estado se calcula a partir de estados menores? Ex.: \`melhor[i] = max(melhor[i - 1], melhor[i - 2] + valores[i])\`.
3. **Caso base:** quais estados se resolvem sem transição? Ex.: antes da primeira casa, o total é 0.

Se você consegue escrever essas três frases, o código é quase uma tradução direta.

## Exemplo comentado: assalto às casas

Um ladrão não pode visitar duas casas vizinhas. Para a casa \`i\`, há duas opções: pular (fica o melhor até \`i - 1\`) ou pegar (soma \`valores[i]\` ao melhor até \`i - 2\`).

\`\`\`js
function assaltoAsCasas(valores) {
  let anterior = 0; // melhor[i - 2]
  let atual = 0;    // melhor[i - 1]
  for (const v of valores) {
    const novo = Math.max(atual, anterior + v); // transição
    anterior = atual;
    atual = novo;
  }
  return atual;
}
\`\`\`

A transição só olha dois estados para trás, então duas variáveis substituem o vetor inteiro: tempo \`O(n)\`, espaço \`O(1)\`. A recursão ingênua, sem guardar nada, custaria \`O(1,6^n)\`.

## PD em duas dimensões: a tabela de preenchimento

Quando o problema envolve **dois** índices (duas strings, itens e capacidade, linha e coluna), o estado vira uma matriz. Na **maior subsequência comum**, \`t[i][j]\` é a resposta para os \`i\` primeiros caracteres de \`a\` e os \`j\` primeiros de \`b\`:

- se \`a[i - 1] == b[j - 1]\`: \`t[i][j] = t[i - 1][j - 1] + 1\`;
- senão: \`t[i][j] = max(t[i - 1][j], t[i][j - 1])\`;
- caso base: linha e coluna do prefixo vazio valem 0.

Preenchendo para \`a = "casa"\` e \`b = "cama"\`:

| | ∅ | c | a | m | a |
| --- | --- | --- | --- | --- | --- |
| ∅ | 0 | 0 | 0 | 0 | 0 |
| c | 0 | 1 | 1 | 1 | 1 |
| a | 0 | 1 | 2 | 2 | 2 |
| s | 0 | 1 | 2 | 2 | 2 |
| a | 0 | 1 | 2 | 2 | 3 |

A resposta está no canto inferior direito: 3 (\`"caa"\`). Repare na **ordem de preenchimento**: linha por linha, da esquerda para a direita, cada célula depende só da de cima, da da esquerda e da diagonal, que já estão prontas.

Como cada linha só usa a anterior, duas linhas bastam. Isso importa: uma matriz de 2500 × 2500 inteiros ocupa dezenas de megabytes, enquanto duas linhas ocupam alguns kilobytes.

\`\`\`c
for (int i = 1; i <= n; i++) {
    for (int j = 1; j <= m; j++) {
        if (a[i - 1] == b[j - 1]) cur[j] = ant[j - 1] + 1;
        else cur[j] = ant[j] > cur[j - 1] ? ant[j] : cur[j - 1];
    }
    int *troca = ant; ant = cur; cur = troca; // a linha nova vira a anterior
}
\`\`\`

## A mochila 0/1

Na mochila, o estado é \`melhor[c]\` = maior valor com capacidade \`c\` usando os itens vistos até agora. Para cada item, ou ele fica de fora, ou entra: \`melhor[c] = max(melhor[c], melhor[c - peso] + valor)\`. O detalhe decisivo é percorrer \`c\` **de trás para a frente**: assim \`melhor[c - peso]\` ainda é o valor sem o item atual, e cada item é usado no máximo uma vez. Percorrendo para a frente, o mesmo item seria somado várias vezes.

## Armadilhas comuns

- **Estado mal definido.** Se \`melhor[i]\` não diz exatamente o que representa, a transição fica confusa. Escreva a definição em português antes de codificar.
- **Esquecer o caso base** ou iniciá-lo errado (na distância de edição, \`d[i][0] = i\`, não 0).
- **Ordem de preenchimento errada**: ler uma célula que ainda não foi calculada.
- **Guloso no lugar de PD.** "Pegar o item de melhor valor por quilo" parece razoável, mas falha na mochila 0/1.
- **Esquecer o módulo.** Contagens crescem muito rápido; aplique \`% 1000000007\` a cada soma.

## Complexidade

O custo típico é **número de estados × custo da transição**. Assalto às casas: \`n\` estados, transição \`O(1)\`, total \`O(n)\`. Subsequência comum e distância de edição: \`n · m\` estados, \`O(n · m)\`. Mochila: \`n · capacidade\`. O espaço é o número de estados guardados, muitas vezes reduzido a uma ou duas linhas.

## Pratique

- **Assalto às casas**: PD em uma dimensão com duas variáveis.
- **Caminhos com obstáculos**: grade, soma de cima e da esquerda, módulo.
- **Maior subsequência comum**: a tabela de duas strings.
- **Mochila 0/1**: a capacidade de trás para a frente.
- **Distância de edição** (chefe): três operações numa tabela 2D.
`
    }
  ],
  bits: [
    {
      slug: "licao-bits",
      title: "Manipulação de bits: AND, OR, XOR e máscaras",
      summary: "Como os operadores bit a bit resolvem contagens e buscas em O(1) de memória.",
      estimatedMinutes: 10,
      content: `
# Manipulação de bits: AND, OR, XOR e máscaras

Todo inteiro é guardado em binário. O número 13, por exemplo, é \`1101\`: \`8 + 4 + 1\`. Os **operadores bit a bit** trabalham diretamente sobre esses bits, posição por posição, e são extremamente rápidos.

## Os operadores

| Operador | Nome | Resultado em cada bit | Exemplo (\`12 = 1100\`, \`10 = 1010\`) |
| --- | --- | --- | --- |
| \`&\` | AND | 1 se os dois forem 1 | \`1100 & 1010 = 1000\` (8) |
| barra vertical | OR | 1 se algum for 1 | \`1100 OR 1010 = 1110\` (14) |
| \`^\` | XOR | 1 se forem diferentes | \`1100 ^ 1010 = 0110\` (6) |
| \`~\` | NOT | inverte cada bit | \`~0 = -1\` |
| \`<<\` | deslocamento à esquerda | multiplica por 2 a cada casa | \`3 << 2 = 12\` |
| \`>>\` | deslocamento à direita | divide por 2 a cada casa | \`12 >> 2 = 3\` |

O OR é escrito com uma barra vertical: \`12 | 10\` vale 14.

## Truques que aparecem o tempo todo

- **Testar o bit k:** \`(n >> k) & 1\`, ou \`n & (1 << k)\` diferente de 0.
- **Ligar o bit k:** \`n | (1 << k)\`. **Desligar:** \`n & ~(1 << k)\`.
- **Apagar o bit 1 mais baixo:** \`n & (n - 1)\`. Subtrair 1 transforma o último 1 em 0 e os zeros à direita dele em 1.
- **Isolar o bit 1 mais baixo:** \`n & -n\`. Em complemento de dois, \`-n\` é \`~n + 1\`.
- **Potência de dois:** \`n > 0 && (n & (n - 1)) == 0\`, porque uma potência de dois tem um único bit ligado.

## Exemplo comentado: contar bits ligados

\`\`\`c
int contarBitsLigados(int n) {
    int total = 0;
    while (n != 0) {
        n &= n - 1; // apaga o bit 1 mais baixo
        total++;
    }
    return total;
}
\`\`\`

Com \`n = 12\` (\`1100\`): \`12 & 11 = 1000\`, depois \`8 & 7 = 0\`. Duas voltas, dois bits ligados. O laço roda uma vez por bit ligado.

## O poder do XOR

O XOR tem propriedades que parecem mágica:

- \`x ^ x = 0\` (um número "cancela" a si mesmo);
- \`x ^ 0 = x\`;
- é **comutativo** e **associativo**: a ordem não importa.

Por isso, se todos os números de um vetor aparecem duas vezes menos um, o XOR de tudo é exatamente o solitário: os pares se anulam, não importa onde estejam.

\`\`\`js
function numeroSolitario(nums) {
  let resultado = 0;
  for (const x of nums) resultado ^= x; // pares viram 0
  return resultado;
}
\`\`\`

Uma passada e uma variável: \`O(n)\` de tempo e \`O(1)\` de memória, contra \`O(n)\` de memória de um mapa de contagem.

O XOR também mede diferença: \`x ^ y\` tem 1 exatamente onde \`x\` e \`y\` diferem. Contar esses bits dá a **distância de Hamming**. E quando **dois** números são solitários, o XOR de tudo dá \`a ^ b\`; qualquer bit ligado nele separa \`a\` de \`b\`, e dividir o vetor por esse bit resolve o problema.

## Máscaras como conjuntos

Um inteiro de 32 bits pode representar um **conjunto** de até 32 elementos: o bit \`k\` ligado significa "o elemento \`k\` está no conjunto". União é \`|\`, interseção é \`&\`, e testar pertinência é \`&\` com \`1 << k\`. No sudoku, uma máscara por linha diz quais dígitos já foram usados; no problema das n rainhas, máscaras marcam colunas e diagonais ocupadas.

## Armadilhas comuns

- **JavaScript usa 32 bits nos operadores.** \`&\`, \`|\`, \`^\`, \`<<\` e \`>>\` convertem o número para inteiro de 32 bits **com sinal**. Valores acima de \`2^31 - 1\` ficam negativos, e acima de \`2^32\` perdem os bits altos. Use \`>>> 0\` para ler o resultado como sem sinal e \`BigInt\` para números maiores.
- **Precedência.** Em C e JavaScript, \`n & 1 == 0\` significa \`n & (1 == 0)\`. Use parênteses: \`(n & 1) == 0\`.
- **Deslocar negativos.** \`>>\` em um negativo mantém o sinal; um laço \`while (n != 0) n >>= 1\` nunca termina. Use \`>>>\` em JavaScript ou \`unsigned\` em C.
- **Transbordamento em C.** \`-n\` com \`n = INT_MIN\` é comportamento indefinido; faça essas contas em \`unsigned\`.

## Complexidade

As operações bit a bit custam \`O(1)\`. Percorrer os bits de um inteiro de \`w\` bits custa \`O(w)\`, e o truque \`n & (n - 1)\` reduz isso ao número de bits ligados. O grande ganho costuma ser de **memória**: o XOR substitui mapas e conjuntos inteiros por uma variável.

## Pratique

- **Contar bits ligados**: \`n & 1\`, deslocamento e \`n & (n - 1)\`.
- **Número solitário**: pares que se anulam no XOR.
- **Potência de dois**: um único bit ligado (cuidado com os 32 bits do JavaScript).
- **Distância de Hamming**: XOR e contagem de bits.
- **Dois solitários** (chefe): XOR, bit mais baixo e divisão em grupos.
`
    }
  ]
};
