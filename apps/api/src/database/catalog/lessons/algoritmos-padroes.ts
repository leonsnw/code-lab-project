import type { LessonDefinition } from "./index.js";

/** Lições dos módulos de dois ponteiros, janela deslizante, prefixo acumulado e guloso. */
export const ALGORITMOS_PADROES_LESSONS: Record<string, LessonDefinition[]> = {
  "dois-ponteiros": [
    {
      slug: "licao-dois-ponteiros",
      title: "Dois ponteiros: trocando laços aninhados por uma passada",
      summary: "Dois índices que andam pelo vetor e descartam, a cada passo, candidatos que nunca poderiam ser a resposta.",
      estimatedMinutes: 12,
      content: `
# Dois ponteiros

Muitos problemas de vetor parecem pedir **todos os pares**: "existe um par com soma X?", "qual par de paredes guarda mais água?". A força bruta testa os n·(n-1)/2 pares com dois laços aninhados, o que custa O(n²). Com 2·10^5 elementos isso passa de 10^10 operações: nenhum juiz espera tanto.

A técnica de **dois ponteiros** usa dois índices que só andam em uma direção. A cada passo, um argumento simples garante que um dos elementos apontados **não pode fazer parte da resposta**, e ele é descartado. Como cada passo descarta alguém, o total de passos é no máximo n.

## Como reconhecer o padrão

- O vetor está **ordenado** (ou pode ser ordenado sem perder a resposta) e a pergunta envolve pares ou trios.
- A resposta depende das **pontas** de um intervalo: largura × altura, soma do menor com o maior.
- O problema pede para **reorganizar no lugar**: um ponteiro lê e outro escreve (mover zeros, remover duplicados).
- A frase "sem usar memória extra" ou "em O(n)" aparece junto de um vetor ordenado.

Existem duas formas comuns:

| Forma | Ponteiros | Exemplo |
| --- | --- | --- |
| Pontas que se aproximam | \`i = 0\`, \`j = n - 1\`, andam até se cruzar | par com soma, reservatório, quadrados |
| Leitura e escrita | os dois começam em 0; a escrita nunca passa da leitura | mover zeros, compactar vetor |

## Exemplo comentado: par com soma em vetor ordenado

\`\`\`js
function parComSoma(nums, alvo) {
  let i = 0, j = nums.length - 1;
  while (i < j) {
    const soma = nums[i] + nums[j];
    if (soma === alvo) return [i, j];
    // Soma pequena: nums[i] não fecha par nem com o maior restante.
    if (soma < alvo) i++;
    // Soma grande: nums[j] passa do alvo até com o menor restante.
    else j--;
  }
  return [];
}
\`\`\`

O comentário é a prova: se \`nums[i] + nums[j] < alvo\`, então \`nums[i]\` somado a qualquer elemento entre \`i\` e \`j\` também fica abaixo, porque esses elementos são menores ou iguais a \`nums[j]\`. Descartar \`nums[i]\` é seguro.

A forma de leitura e escrita, em C:

\`\`\`c
int escrita = 0;
for (int leitura = 0; leitura < n; leitura++)
    if (v[leitura] != 0) v[escrita++] = v[leitura];
while (escrita < n) v[escrita++] = 0;
\`\`\`

## Trios: um laço fora, dois ponteiros dentro

Para trios com soma zero, ordene o vetor, fixe o primeiro elemento com um laço e rode dois ponteiros no trecho à direita. O custo cai de O(n³) para O(n²). Para não repetir trios, pule valores iguais ao anterior tanto no laço externo quanto depois de achar um trio.

## Armadilhas comuns

- **Esquecer que o vetor precisa estar ordenado.** Sem ordem, o argumento de descarte não vale.
- **Mover o ponteiro errado.** No reservatório, mover a parede mais alta nunca melhora a área; descarte sempre a mais baixa.
- **Laço com \`i <= j\`** quando o par exige posições diferentes: use \`i < j\`.
- **Duplicados.** Em trios e pares distintos, pule valores repetidos senão a resposta aparece duas vezes.
- **Estouro.** Em C, \`(j - i) * altura\` pode passar de 2^31: faça a conta em \`long long\`.

## Complexidade

| Abordagem | Tempo | Memória |
| --- | --- | --- |
| Força bruta com pares | O(n²) | O(1) |
| Dois ponteiros em vetor ordenado | O(n) | O(1) |
| Ordenar + dois ponteiros | O(n log n) | O(1) a O(n) |
| Trios (laço + dois ponteiros) | O(n²) | O(1) |

## Pratique

1. **Par com soma no vetor ordenado**: a forma clássica, com as pontas se aproximando.
2. **Mover zeros para o fim**: leitura e escrita no mesmo vetor.
3. **Quadrados em ordem**: os maiores quadrados estão nas pontas; preencha de trás para frente, sem ordenar.
4. **Maior reservatório**: o argumento de descarte da parede mais baixa.
5. **Trios com soma zero** (chefe): ordenação, laço externo e dois ponteiros, sem repetir trios.
`
    }
  ],
  "janela-deslizante": [
    {
      slug: "licao-janela-deslizante",
      title: "Janela deslizante: subvetores contíguos sem recalcular",
      summary: "Uma janela que entra por um lado e sai pelo outro mantém soma ou contagem atualizada em O(1) por passo.",
      estimatedMinutes: 13,
      content: `
# Janela deslizante

Quando a pergunta é sobre **trechos contíguos** (subvetores ou substrings), a força bruta enumera todos os pares início e fim, mais o custo de analisar cada trecho: O(n²) ou pior. A janela deslizante aproveita que dois trechos vizinhos são quase iguais. Ao deslizar a janela, **um elemento entra e um sai**, e a informação da janela (soma, contagem de letras, número de zeros) é atualizada em O(1).

## Como reconhecer o padrão

- O enunciado fala em **contíguo**, **seguidos**, **substring**, **trecho** ou **subvetor**.
- Há um **tamanho fixo** (k elementos seguidos, anagramas de um padrão) ou uma **condição monotônica**: se um trecho satisfaz, os trechos maiores que o contêm também satisfazem (ou o contrário).
- Pedem o **maior** ou o **menor** trecho que obedece a uma regra.

Se a condição **não** é monotônica (por exemplo, soma exata com valores negativos), a janela não funciona: use prefixo acumulado com hash, assunto do próximo módulo.

## Janela de tamanho fixo

\`\`\`js
function maiorSomaDeK(nums, k) {
  let janela = 0;
  for (let i = 0; i < k; i++) janela += nums[i];
  let melhor = janela;               // não comece com 0: tudo pode ser negativo
  for (let i = k; i < nums.length; i++) {
    janela += nums[i] - nums[i - k]; // entra nums[i], sai nums[i - k]
    melhor = Math.max(melhor, janela);
  }
  return melhor;
}
\`\`\`

## Janela de tamanho variável

O esqueleto é sempre o mesmo: o fim avança um passo por iteração e o início avança **enquanto** for preciso (ou possível) encolher.

\`\`\`c
int inicio = 0, melhor = 0, zeros = 0;
for (int fim = 0; fim < n; fim++) {
    if (bits[fim] == 0) zeros++;          // entra bits[fim]
    while (zeros > k) {                   // janela inválida: encolha
        if (bits[inicio] == 0) zeros--;
        inicio++;
    }
    if (fim - inicio + 1 > melhor) melhor = fim - inicio + 1;
}
\`\`\`

Mesmo com um \`while\` dentro do \`for\`, o custo é O(n): \`inicio\` só anda para a frente e nunca passa de n. Some quantas vezes cada ponteiro anda, não multiplique os laços.

Existem duas variações:

- **Maior janela válida**: encolha só quando a janela ficar inválida e registre depois de encolher (maior sequência de uns com k trocas).
- **Menor janela válida**: enquanto a janela for válida, registre e encolha (menor subvetor com soma mínima, menor janela que contém).

## Contagens dentro da janela

Para letras, guarde um vetor de 26 (ou 128) contadores. Para comparar a janela com um padrão em O(1), mantenha também **quantas letras já batem**, ou quantas ainda faltam, e atualize esse número só quando a letra que entra ou sai muda de estado.

## Armadilhas comuns

- **Iniciar o máximo com 0** quando os valores podem ser negativos.
- **Trocar \`>=\` por \`>\`** na condição de parada: leia com atenção se a igualdade conta.
- **Ignorar a multiplicidade.** Usar um conjunto de letras em vez de contagens erra quando o alvo tem letras repetidas.
- **Usar janela com valores negativos** em somas: aumentar a janela pode diminuir a soma, e o argumento cai.
- **Esquecer o caso sem resposta** (retornar 0, -1 ou string vazia, conforme o enunciado).

## Complexidade

| Problema | Força bruta | Janela |
| --- | --- | --- |
| Maior soma de k seguidos | O(n·k) | O(n) |
| Menor trecho com soma ≥ alvo | O(n²) | O(n) |
| Anagramas do padrão no texto | O(n·m log m) | O(n + m) |
| Menor janela que contém o alvo | O(n²) | O(n + m) |

## Pratique

1. **Maior soma de k seguidos**: a janela fixa mais simples.
2. **Menor subvetor com soma mínima**: janela variável que encolhe enquanto é válida.
3. **Contar anagramas na janela**: janela fixa com 26 contadores.
4. **Maior sequência de uns com k trocas**: janela variável que encolhe quando fica inválida.
5. **Menor janela que contém** (chefe): contadores, multiplicidade e empate pela esquerda.
`
    }
  ],
  prefixo: [
    {
      slug: "licao-prefixo",
      title: "Prefixo acumulado: somas de intervalos em O(1)",
      summary: "Guardar as somas dos prefixos transforma a soma de qualquer intervalo em uma subtração, e somas exatas em consultas a um mapa.",
      estimatedMinutes: 12,
      content: `
# Prefixo acumulado

Defina \`P[0] = 0\` e \`P[i + 1] = P[i] + nums[i]\`. Então \`P[i]\` é a soma dos \`i\` primeiros elementos, e a soma do trecho de \`l\` até \`r\` (inclusive) é:

\`\`\`
soma(l, r) = P[r + 1] - P[l]
\`\`\`

Montar \`P\` custa O(n); depois disso, **qualquer** soma de intervalo sai em O(1). Com q consultas, o custo cai de O(n·q) para O(n + q).

## Como reconhecer o padrão

- Muitas **consultas de soma** sobre intervalos de um vetor que não muda.
- O enunciado compara **o que está à esquerda com o que está à direita** (índice de equilíbrio).
- Pedem para **contar subvetores** cuja soma é exatamente k, ou divisível por k, e os valores podem ser **negativos** (a janela deslizante não serve).
- Aparece uma matriz com consultas de **retângulos**: prefixo em duas dimensões.

## Exemplo comentado: contar trechos com soma k

Um trecho que termina em \`j\` e começa depois de \`i\` tem soma \`P[j] - P[i]\`. Ele vale \`k\` exatamente quando \`P[i] = P[j] - k\`. Então, ao percorrer o vetor, basta saber **quantos prefixos anteriores** valem \`P[j] - k\`:

\`\`\`js
function contarSubvetores(nums, k) {
  const vistos = new Map([[0, 1]]); // o prefixo vazio já "apareceu" uma vez
  let prefixo = 0, total = 0;
  for (const x of nums) {
    prefixo += x;
    total += vistos.get(prefixo - k) ?? 0;
    vistos.set(prefixo, (vistos.get(prefixo) ?? 0) + 1);
  }
  return total;
}
\`\`\`

A ordem importa: consulte o mapa **antes** de registrar o prefixo atual, para não contar o trecho vazio.

## Divisibilidade: agrupe por resto

Um trecho tem soma divisível por k quando os dois prefixos das pontas deixam o **mesmo resto**. Conte quantos prefixos caíram em cada resto (um vetor de tamanho k basta). O detalhe: em C e em JavaScript, \`-7 % 3\` vale \`-1\`. Normalize:

\`\`\`c
resto = ((resto + nums[i]) % k + k) % k;
total += contagem[resto]++;
\`\`\`

## Prefixo em duas dimensões

\`P[r][c]\` guarda a soma do retângulo de \`(0, 0)\` a \`(r - 1, c - 1)\`. Por inclusão e exclusão:

\`\`\`
P[r+1][c+1] = m[r][c] + P[r][c+1] + P[r+1][c] - P[r][c]
soma(r1, c1, r2, c2) = P[r2+1][c2+1] - P[r1][c2+1] - P[r2+1][c1] + P[r1][c1]
\`\`\`

O último termo soma de volta o canto que foi subtraído duas vezes.

## Armadilhas comuns

- **Índices deslocados.** Com \`P\` de tamanho n + 1, a soma de \`l..r\` usa \`P[r + 1]\`, não \`P[r]\`.
- **Estouro.** Somas de muitos valores grandes passam de 2^31: use \`long long\` em C.
- **Extremos fora de ordem.** Se o enunciado permite \`[4, 1]\`, troque antes de usar a fórmula.
- **Resto negativo.** Normalize com \`((r % k) + k) % k\` em C e JavaScript (em Python, \`%\` já é não negativo).
- **Esquecer o prefixo 0** no mapa: os trechos que começam na posição 0 somem da contagem.

## Complexidade

| Problema | Força bruta | Com prefixo |
| --- | --- | --- |
| q somas de intervalo | O(n·q) | O(n + q) |
| Índice de equilíbrio | O(n²) | O(n) |
| Contar trechos com soma k | O(n²) | O(n) com hash |
| Contar trechos divisíveis por k | O(n²) | O(n + k) |
| q somas de retângulo em L × C | O(L·C·q) | O(L·C + q) |

## Pratique

1. **Soma de intervalos**: o vetor de prefixos e a fórmula da subtração.
2. **Índice de equilíbrio**: prefixo sem vetor, com a soma total.
3. **Subvetores com soma k**: prefixo com mapa de frequências.
4. **Soma em retângulos**: prefixo em duas dimensões.
5. **Subvetores divisíveis por k** (chefe): prefixo agrupado por resto, com negativos.
`
    }
  ],
  guloso: [
    {
      slug: "licao-guloso",
      title: "Algoritmos gulosos: a melhor escolha local, com prova",
      summary: "Escolher sempre o que parece melhor agora funciona quando uma troca mostra que a escolha nunca atrapalha o ótimo.",
      estimatedMinutes: 14,
      content: `
# Algoritmos gulosos

Um algoritmo **guloso** constrói a resposta passo a passo e, em cada passo, faz a escolha que parece melhor **naquele momento**, sem voltar atrás. Quando funciona, é simples e rápido, quase sempre O(n log n) por causa de uma ordenação inicial. O perigo é que muitos critérios "óbvios" estão errados. Um bom guloso vem acompanhado de um **argumento de troca**: se existe uma solução ótima que não faz a nossa escolha, dá para trocar uma peça dela pela nossa sem piorar.

## Como reconhecer o padrão

- O problema pede o **máximo** ou o **mínimo** de algo (atividades, salas, crianças satisfeitas) e as peças podem ser **ordenadas** por um critério natural (fim, tamanho, início).
- Uma escolha feita agora **não restringe** mais do que o necessário as escolhas seguintes.
- Existe uma quantidade que só cresce ou só diminui ao percorrer a entrada (alcance máximo, tanque de combustível).
- Se você acha um contraexemplo pequeno para o critério, provavelmente o problema pede programação dinâmica.

## Exemplo comentado: máximo de atividades

Escolha sempre a atividade que **termina primeiro** entre as compatíveis.

\`\`\`js
function maximoDeAtividades(intervalos) {
  const ordenados = [...intervalos].sort((a, b) => a[1] - b[1]);
  let livreEm = -Infinity, total = 0;
  for (const [inicio, fim] of ordenados) {
    if (inicio >= livreEm) { // intervalo [inicio, fim): encostar não é conflito
      total++;
      livreEm = fim;
    }
  }
  return total;
}
\`\`\`

**Por que funciona:** seja A a atividade que termina primeiro. Em qualquer solução ótima, a primeira atividade termina em um instante maior ou igual ao fim de A; trocá-la por A não cria conflito e mantém a contagem. Repita o argumento para o resto.

**Contraexemplo do critério errado:** ordenar por início escolhe \`[0, 10)\` em \`[[0, 10], [1, 2], [3, 4]]\` e perde as duas curtas.

## Guloso com uma quantidade que se propaga

Nem todo guloso ordena. Em "pode chegar ao fim?", basta manter o **alcance máximo**:

\`\`\`c
int alcance = 0;
for (int i = 0; i < n; i++) {
    if (i > alcance) return false;          // posição inalcançável
    if (i + saltos[i] > alcance) alcance = i + saltos[i];
}
return true;
\`\`\`

No posto de partida, o argumento é parecido: se o tanque fica negativo saindo do posto \`i\`, nenhum posto entre o início atual e \`i\` serve, e dá para recomeçar em \`i + 1\`.

## Varredura de eventos

Para o mínimo de salas, transforme cada reunião em dois eventos (início e fim), ordene e percorra contando quantas estão abertas. O pico é a resposta. Em empate de horário, processe o **fim antes do início** quando os intervalos são semiabertos. Outra forma é ordenar por início e manter um heap com os horários de término.

## Armadilhas comuns

- **Critério errado.** Teste o critério em exemplos pequenos feitos para quebrá-lo antes de programar.
- **Empates.** Decida se \`fim == inicio\` é conflito e trate isso na ordenação ou na comparação.
- **Ordenar na ordem errada**, ou ordenar só uma das listas (biscoitos e crianças precisam das duas ordenadas).
- **Pular a prova.** Sem argumento de troca, um guloso que passa nos exemplos pode falhar nos casos ocultos.
- **Custo escondido.** Uma simulação ingênua a partir de cada ponto (salto, posto) volta a ser O(n²).

## Complexidade

| Problema | Ideia | Tempo |
| --- | --- | --- |
| Máximo de atividades | ordenar por fim | O(n log n) |
| Distribuir biscoitos | ordenar os dois e usar dois ponteiros | O(n log n + m log m) |
| Pode chegar ao fim | alcance máximo | O(n) |
| Posto de partida | recomeçar quando o tanque fica negativo | O(n) |
| Mínimo de salas | varredura de eventos ou heap | O(n log n) |

## Pratique

1. **Máximo de atividades**: o critério do menor fim e o contraexemplo do início.
2. **Distribuir biscoitos**: o menor biscoito que serve para a criança menos faminta.
3. **Pode chegar ao fim?**: guloso sem ordenação, com alcance máximo.
4. **Posto de partida**: o argumento do recomeço.
5. **Mínimo de salas** (chefe): varredura de eventos com intervalos semiabertos.
`
    }
  ]
};
