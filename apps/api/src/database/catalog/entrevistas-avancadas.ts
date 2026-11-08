import type { Challenge } from "../../domain/types.js";
import { call, createRandom, defineChallenge, gen, pick, randomInt, shuffle } from "./helpers.js";
import { moduleId } from "./tracks.js";

/**
 * Trilha "Preparação para Entrevistas", parte avançada: árvores, grafos,
 * programação dinâmica e design de estruturas. Modo função, aceito em
 * JavaScript, Python e C. Sementes na faixa 900000–999999.
 */

// ---------- Árvores (no mesmo formato do juiz: ordem de níveis com null) ----------
interface No {
  val: number;
  left: No | null;
  right: No | null;
}

const novoNo = (val: number): No => ({ val, left: null, right: null });

/** Serializa em ordem de níveis, com `null` nos filhos ausentes e sem nulls no fim. */
function emNiveis(raiz: No | null): Array<number | null> {
  const valores: Array<number | null> = [];
  const fila: Array<No | null> = [raiz];
  for (let index = 0; index < fila.length; index += 1) {
    const no = fila[index];
    if (!no) {
      valores.push(null);
      continue;
    }
    valores.push(no.val);
    fila.push(no.left, no.right);
  }
  while (valores.length && valores[valores.length - 1] === null) valores.pop();
  return valores;
}

/** Monta a árvore a partir da ordem de níveis (mesma regra do harness). */
function deNiveis(valores: Array<number | null>): No | null {
  if (!valores.length || valores[0] === null) return null;
  const raiz = novoNo(valores[0]);
  const fila = [raiz];
  let index = 1;
  for (let head = 0; head < fila.length && index < valores.length; head += 1) {
    const no = fila[head];
    const esquerda = valores[index++];
    if (esquerda !== null && esquerda !== undefined) fila.push((no.left = novoNo(esquerda)));
    const direita = index < valores.length ? valores[index++] : null;
    if (direita !== null && direita !== undefined) fila.push((no.right = novoNo(direita)));
  }
  return raiz;
}

/** BST por inserção, na ordem dada (valores distintos). */
function bstDe(valores: number[]): No | null {
  let raiz: No | null = null;
  for (const valor of valores) {
    const no = novoNo(valor);
    if (!raiz) {
      raiz = no;
      continue;
    }
    let atual = raiz;
    for (;;) {
      if (valor < atual.val) {
        if (!atual.left) {
          atual.left = no;
          break;
        }
        atual = atual.left;
      } else {
        if (!atual.right) {
          atual.right = no;
          break;
        }
        atual = atual.right;
      }
    }
  }
  return raiz;
}

function distintos(random: () => number, n: number, min: number, max: number): number[] {
  const vistos = new Set<number>();
  const valores: number[] = [];
  while (valores.length < n) {
    const valor = randomInt(random, min, max);
    if (!vistos.has(valor)) {
      vistos.add(valor);
      valores.push(valor);
    }
  }
  return valores;
}

/** Caminho degenerado: cada nó só tem filho à direita (crescente) ou à esquerda (decrescente). */
function corrente(valores: number[], lado: "left" | "right"): No | null {
  if (!valores.length) return null;
  const raiz = novoNo(valores[0]);
  let atual = raiz;
  for (const valor of valores.slice(1)) {
    atual[lado] = novoNo(valor);
    atual = atual[lado]!;
  }
  return raiz;
}

/** BST em zigue-zague: inserindo 1, n, 2, n - 1, ... cada nível tem um nó só. */
function zigueZague(n: number, passo = 1): No | null {
  const ordem: number[] = [];
  for (let baixo = 1, alto = n; baixo <= alto; baixo += 1, alto -= 1) {
    ordem.push(baixo * passo);
    if (alto !== baixo) ordem.push(alto * passo);
  }
  // Inserção direta ao longo do caminho (O(n)), sem descer da raiz a cada valor.
  const raiz = novoNo(ordem[0]);
  let atual = raiz;
  for (const valor of ordem.slice(1)) {
    const no = novoNo(valor);
    if (valor < atual.val) atual.left = no;
    else atual.right = no;
    atual = no;
  }
  return raiz;
}

/** Árvore binária qualquer: cada novo nó ocupa uma vaga de filho sorteada. */
function arvoreAleatoria(random: () => number, n: number, min: number, max: number): No | null {
  if (!n) return null;
  const raiz = novoNo(randomInt(random, min, max));
  const vagas: Array<[No, "left" | "right"]> = [
    [raiz, "left"],
    [raiz, "right"]
  ];
  for (let index = 1; index < n; index += 1) {
    const sorteada = randomInt(random, 0, vagas.length - 1);
    const [pai, lado] = vagas[sorteada];
    vagas[sorteada] = vagas[vagas.length - 1];
    vagas.pop();
    const no = novoNo(randomInt(random, min, max));
    pai[lado] = no;
    vagas.push([no, "left"], [no, "right"]);
  }
  return raiz;
}

function ehBst(raiz: No | null): boolean {
  const pilha: No[] = [];
  let atual = raiz;
  let anterior = -Infinity;
  while (atual || pilha.length) {
    while (atual) {
      pilha.push(atual);
      atual = atual.left;
    }
    atual = pilha.pop()!;
    if (atual.val <= anterior) return false;
    anterior = atual.val;
    atual = atual.right;
  }
  return true;
}

/** O que a burla verifica: só cada nó contra os filhos diretos. */
function soFilhosDiretos(raiz: No | null): boolean {
  const pilha = raiz ? [raiz] : [];
  while (pilha.length) {
    const no = pilha.pop()!;
    if (no.left && no.left.val >= no.val) return false;
    if (no.right && no.right.val <= no.val) return false;
    if (no.left) pilha.push(no.left);
    if (no.right) pilha.push(no.right);
  }
  return true;
}

/**
 * Estraga uma BST sem que nenhum pai perceba: uma folha recebe o valor de um
 * ancestral distante (ou passa dele), mas continua certa em relação ao pai.
 */
function quebrarLonge(random: () => number, raiz: No, maisFundo = false): void {
  const candidatos: Array<{ no: No; valor: number; profundidade: number }> = [];
  const pilha: Array<{ no: No; lo: number; hi: number; esquerda: boolean | null; profundidade: number }> = [
    { no: raiz, lo: -Infinity, hi: Infinity, esquerda: null, profundidade: 0 }
  ];
  while (pilha.length) {
    const { no, lo, hi, esquerda, profundidade } = pilha.pop()!;
    if (!no.left && !no.right && esquerda !== null) {
      const folga = randomInt(random, 0, 2);
      if (esquerda && lo !== -Infinity) candidatos.push({ no, valor: lo - folga, profundidade });
      if (!esquerda && hi !== Infinity) candidatos.push({ no, valor: hi + folga, profundidade });
    }
    if (no.left) pilha.push({ no: no.left, lo, hi: no.val, esquerda: true, profundidade: profundidade + 1 });
    if (no.right) pilha.push({ no: no.right, lo: no.val, hi, esquerda: false, profundidade: profundidade + 1 });
  }
  if (!candidatos.length) throw new Error("quebrarLonge: nenhuma folha candidata");
  const escolhido = maisFundo
    ? candidatos.reduce((melhor, item) => (item.profundidade > melhor.profundidade ? item : melhor))
    : pick(random, candidatos);
  escolhido.no.val = escolhido.valor;
}

function validarBst(): Challenge {
  const random = createRandom(900101);
  const caso = (niveis: Array<number | null>) => call([niveis], ehBst(deNiveis(niveis)));
  const casoArvore = (raiz: No | null, esperado: boolean) => {
    if (ehBst(raiz) !== esperado) throw new Error("validar-bst: gabarito inconsistente");
    if (!esperado && !soFilhosDiretos(raiz)) throw new Error("validar-bst: caso quebrado não engana a burla");
    return call([emNiveis(raiz)], esperado);
  };
  const quebrada = (n: number, min: number, max: number, maisFundo: boolean) => {
    const raiz = bstDe(distintos(random, n, min, max))!;
    quebrarLonge(random, raiz, maisFundo);
    return casoArvore(raiz, false);
  };
  const crescente4000 = Array.from({ length: 4000 }, (_, index) => index * 3 - 6000);

  return defineChallenge({
    slug: "validar-bst",
    title: "Validar árvore binária de busca",
    difficulty: "medium",
    moduleId: moduleId("entrevista-arvores"),
    position: 0,
    description: `Implemente \`validarBst(raiz)\`, que recebe a raiz de uma árvore binária e retorna \`true\` se ela for uma **árvore binária de busca (BST) estrita** e \`false\` caso contrário.

Uma árvore é BST estrita quando, para **todo** nó:

- todos os valores da subárvore esquerda são **menores** que o valor do nó;
- todos os valores da subárvore direita são **maiores** que o valor do nó;
- as duas subárvores também são BSTs estritas.

Valores repetidos não são permitidos: se dois nós têm o mesmo valor, a resposta é \`false\`. A árvore vazia (\`raiz\` nula) é uma BST válida.

A árvore chega pronta, como objetos \`TreeNode\` com \`val\`, \`left\` e \`right\` (em C, \`struct TreeNode\`). Nos exemplos, ela aparece em **ordem de níveis**, com \`null\` para filhos ausentes: \`[5,1,4,null,null,3,6]\` é a raiz 5 com filhos 1 e 4, e o nó 4 com filhos 3 e 6. Essa árvore **não** é BST: 4 está à direita de 5, mas é menor que ele.

Atenção: comparar cada nó apenas com os filhos diretos não basta. Em \`[10,5,15,null,null,6,20]\`, o 6 é menor que o pai 15, mas está na subárvore direita de 10.`,
    constraints: [
      "0 <= número de nós <= 12000",
      "-2^31 <= val <= 2^31 - 1 (os extremos aparecem nos testes)",
      "A altura pode chegar a 4000 níveis.",
      "Retorne um booleano; não imprima nada."
    ],
    tags: ["Árvores", "BST", "DFS"],
    functionSpec: { name: "validarBst", params: [{ name: "raiz", type: "tree" }], returns: "bool" },
    publicCases: [caso([2, 1, 3]), caso([5, 1, 4, null, null, 3, 6]), caso([8, 8])],
    hiddenCases: [
      caso([]),
      caso([7]),
      caso([-2147483648]),
      caso([2147483647]),
      caso([10, 5, 15, null, null, 6, 20]),
      caso([-2147483648, null, 2147483647]),
      caso([2147483647, 2147483647]),
      caso([5, 4, 6, null, null, 3, 7]),
      caso([3, 1, 5, 0, 2, 4, 6]),
      caso([3, 1, 5, 0, 4, 2, 6]),
      caso([1, null, 1]),
      caso([0, -2147483648, 2147483647, null, -1, 1]),
      casoArvore(bstDe(distintos(random, 300, -1000000000, 1000000000)), true),
      quebrada(40, -100, 100, false),
      quebrada(2000, 0, 99999, false),
      casoArvore(bstDe(distintos(random, 12000, 0, 99999)), true),
      quebrada(12000, 0, 99999, true),
      quebrada(12000, 0, 99999, false),
      casoArvore(corrente(crescente4000, "right"), true),
      casoArvore(corrente([...crescente4000].reverse(), "left"), true),
      casoArvore(zigueZague(3000, 2), true),
      (() => {
        const raiz = zigueZague(3000, 2)!;
        quebrarLonge(random, raiz, true);
        return casoArvore(raiz, false);
      })()
    ],
    hints: [
      "Um nó não precisa ser comparado só com o pai: pense no intervalo de valores que ele pode ter, herdado de todos os ancestrais.",
      "Desça passando limites (mínimo, máximo): ao ir para a esquerda o máximo vira o valor do nó; ao ir para a direita, o mínimo vira o valor do nó.",
      "Outra saída: o percurso em ordem (esquerda, nó, direita) de uma BST estrita é estritamente crescente. Compare cada valor com o anterior, usando uma pilha para não depender da recursão."
    ],
    editorial: `**Ingênua.** Para cada nó, percorrer a subárvore esquerda inteira procurando o máximo e a direita procurando o mínimo: O(n²) no pior caso (árvore degenerada). Pior ainda é a versão que só olha os filhos diretos: é rápida, mas **errada** — em \`[5,4,6,null,null,3,7]\` o 3 está abaixo do 6 (certo), porém na subárvore direita do 5 (errado).

**Ótima.** Cada nó tem um intervalo aberto permitido \`(lo, hi)\`, herdado dos ancestrais. A raiz começa com \`(-∞, +∞)\`; o filho esquerdo herda \`(lo, val)\` e o direito \`(val, hi)\`. Se algum valor sair do intervalo, a árvore não é BST. Equivalente e sem limites: o percurso **em ordem** precisa ser estritamente crescente.

Cuidado com sentinelas: usar \`INT_MIN\`/\`INT_MAX\` como limites quebra quando a árvore contém exatamente esses valores. Use \`long long\`, \`-Infinity\` ou "sem limite" explícito (ponteiro nulo).

\`\`\`js
function validarBst(raiz) {
  const pilha = [];
  let atual = raiz;
  let anterior = -Infinity;
  while (atual || pilha.length) {
    while (atual) {            // desce tudo à esquerda
      pilha.push(atual);
      atual = atual.left;
    }
    atual = pilha.pop();       // próximo na ordem crescente
    if (atual.val <= anterior) return false;
    anterior = atual.val;
    atual = atual.right;
  }
  return true;
}
\`\`\`

**Custo.** Cada nó entra e sai da pilha uma vez: tempo O(n) e espaço O(h), onde h é a altura. A versão recursiva com limites tem o mesmo custo; a iterativa só evita depender do tamanho da pilha de chamadas em árvores muito altas.`,
    complexity: { time: "O(n)", space: "O(h)" },
    followUps: [
      "E se valores repetidos fossem permitidos, sempre à esquerda? O que muda nas comparações?",
      "Como encontrar e corrigir os dois nós que foram trocados de lugar numa BST, sem reconstruí-la?",
      "Consegue fazer o percurso em ordem com espaço O(1) (percurso de Morris)?"
    ]
  });
}

function percursoPorNiveis(): Challenge {
  const random = createRandom(900201);
  const niveisDe = (raiz: No | null): number[][] => {
    const resultado: number[][] = [];
    let atual = raiz ? [raiz] : [];
    while (atual.length) {
      resultado.push(atual.map((no) => no.val));
      atual = atual.flatMap((no) => [no.left, no.right].filter((filho): filho is No => filho !== null));
    }
    return resultado;
  };
  const caso = (raiz: No | null) => call([emNiveis(raiz)], niveisDe(raiz));
  const literal = (niveis: Array<number | null>) => caso(deNiveis(niveis));
  const perfeita = (altura: number) => {
    const valores = Array.from({ length: 2 ** altura - 1 }, () => randomInt(random, -1000, 1000));
    return deNiveis(valores);
  };
  const lagarta = (comprimento: number) => {
    // Espinha à direita com uma folha pendurada à esquerda de cada nó.
    const raiz = novoNo(randomInt(random, -1000, 1000));
    let atual = raiz;
    for (let index = 1; index < comprimento; index += 1) {
      atual.left = novoNo(randomInt(random, -1000, 1000));
      atual.right = novoNo(randomInt(random, -1000, 1000));
      atual = atual.right;
    }
    return raiz;
  };

  return defineChallenge({
    slug: "percurso-por-niveis",
    title: "Percurso por níveis",
    difficulty: "medium",
    moduleId: moduleId("entrevista-arvores"),
    position: 1,
    description: `Implemente \`percursoPorNiveis(raiz)\`, que recebe a raiz de uma árvore binária e retorna os valores **nível por nível**: um vetor para cada nível, de cima para baixo, e dentro de cada nível os valores da esquerda para a direita.

Por exemplo, a árvore \`[3,9,20,null,null,15,7]\` (raiz 3, filhos 9 e 20; o 20 tem filhos 15 e 7) tem três níveis e a resposta é \`[[3],[9,20],[15,7]]\`.

Se a árvore for vazia, retorne um vetor vazio \`[]\` (e não \`[[]]\`).

Em C, a assinatura segue a convenção das matrizes: retorne um \`int**\` com um vetor por nível, escreva em \`*returnSize\` o número de níveis e aloque em \`*returnColumnSizes\` um vetor com o tamanho de cada nível.`,
    constraints: [
      "0 <= número de nós <= 8000",
      "-1000 <= val <= 1000 (valores podem se repetir)",
      "A altura pode chegar a 3000 níveis.",
      "Retorne a lista de níveis; não imprima nada."
    ],
    tags: ["Árvores", "BFS"],
    functionSpec: { name: "percursoPorNiveis", params: [{ name: "raiz", type: "tree" }], returns: "int[][]" },
    publicCases: [literal([3, 9, 20, null, null, 15, 7]), literal([1, 2, 3, 4, null, null, 5])],
    hiddenCases: [
      literal([]),
      literal([1]),
      literal([1, 2]),
      literal([1, null, 2, null, 3]),
      literal([0, -1, 1, -2, null, null, 2, -3]),
      literal([5, 4, 8, 11, null, 13, 4, 7, 2, null, null, 5, 1]),
      caso(perfeita(4)),
      caso(arvoreAleatoria(random, 50, -1000, 1000)),
      caso(arvoreAleatoria(random, 500, -1000, 1000)),
      caso(arvoreAleatoria(random, 5000, -1000, 1000)),
      caso(arvoreAleatoria(random, 8000, 0, 9)),
      caso(arvoreAleatoria(random, 300, 7, 7)),
      caso(perfeita(12)),
      caso(zigueZague(3000)),
      caso(corrente(Array.from({ length: 2000 }, () => randomInt(random, -1000, 1000)), "left")),
      caso(lagarta(1500))
    ],
    hints: [
      "Uma fila visita os nós exatamente na ordem pedida: primeiro todos de um nível, depois todos do seguinte.",
      "O difícil é saber onde um nível termina. Antes de processar um nível, guarde quantos nós estão na fila naquele momento.",
      "Retire exatamente esse número de nós, anotando os valores num vetor novo e enfileirando os filhos não nulos; esse vetor é um nível completo."
    ],
    editorial: `**Ingênua.** Calcular a altura h e, para cada profundidade d, descer da raiz recolhendo os nós dessa profundidade: O(n·h), que vira O(n²) numa árvore degenerada.

**Ótima.** Busca em largura (BFS) com uma fila, processando um nível por vez. No início de cada rodada, a fila contém exatamente os nós de um nível; o tamanho dela nesse instante diz quantos nós retirar. Ao retirar, anote o valor e enfileire os filhos, que formam o próximo nível.

\`\`\`python
def percursoPorNiveis(raiz):
    if raiz is None:
        return []
    niveis, atual = [], [raiz]
    while atual:
        niveis.append([no.val for no in atual])
        proximo = []
        for no in atual:
            if no.left:
                proximo.append(no.left)
            if no.right:
                proximo.append(no.right)
        atual = proximo
    return niveis
\`\`\`

Usar duas listas (nível atual e próximo) é o mesmo que a fila com contagem. Em JavaScript, evite \`shift()\` em filas enormes: ele pode custar O(n) por chamada; use um índice de leitura.

**Custo.** Cada nó é visitado uma vez: tempo O(n). O espaço extra é O(w), a largura máxima de um nível (até n/2 numa árvore completa), além da própria resposta.`,
    complexity: { time: "O(n)", space: "O(n)" },
    followUps: [
      "Como devolver os níveis em zigue-zague (um da esquerda para a direita, o seguinte ao contrário)?",
      "Como obter a \"vista da direita\" da árvore, isto é, o último nó de cada nível?",
      "Dá para resolver com DFS em vez de BFS? Como a DFS saberia em que nível colocar cada valor?"
    ]
  });
}

function menorAncestralComum(): Challenge {
  const random = createRandom(900301);
  const lca = (raiz: No, p: number, q: number) => {
    let atual: No | null = raiz;
    while (atual) {
      if (p < atual.val && q < atual.val) atual = atual.left;
      else if (p > atual.val && q > atual.val) atual = atual.right;
      else return atual.val;
    }
    throw new Error("menor-ancestral-comum: p ou q ausente");
  };
  const valoresDe = (raiz: No): number[] => {
    const valores: number[] = [];
    const pilha = [raiz];
    while (pilha.length) {
      const no = pilha.pop()!;
      valores.push(no.val);
      if (no.left) pilha.push(no.left);
      if (no.right) pilha.push(no.right);
    }
    return valores;
  };
  const caso = (raiz: No, p: number, q: number) => {
    const valores = new Set(valoresDe(raiz));
    if (!valores.has(p) || !valores.has(q) || !ehBst(raiz)) throw new Error("menor-ancestral-comum: caso inválido");
    return call([emNiveis(raiz), p, q], lca(raiz, p, q));
  };
  const literal = (niveis: Array<number | null>, p: number, q: number) => caso(deNiveis(niveis)!, p, q);
  const folhas = (raiz: No): number[] => {
    const resultado: number[] = [];
    const pilha = [raiz];
    while (pilha.length) {
      const no = pilha.pop()!;
      if (!no.left && !no.right) resultado.push(no.val);
      if (no.left) pilha.push(no.left);
      if (no.right) pilha.push(no.right);
    }
    return resultado;
  };
  const exemplo: Array<number | null> = [6, 2, 8, 0, 4, 7, 9, null, null, 3, 5];
  const grande = bstDe(distintos(random, 12000, -1000000, 1000000))!;
  const grandeValores = valoresDe(grande);
  const grandeFolhas = folhas(grande);
  const media = bstDe(distintos(random, 3000, -2147483648, 2147483647))!;
  const mediaValores = valoresDe(media);
  const crescente = Array.from({ length: 4500 }, (_, index) => index * 7 + 11);
  const direita = corrente(crescente, "right")!;
  const esquerda = corrente([...crescente].reverse(), "left")!;
  const zigue = zigueZague(4000, 3)!;

  return defineChallenge({
    slug: "menor-ancestral-comum",
    title: "Menor ancestral comum em BST",
    difficulty: "medium",
    moduleId: moduleId("entrevista-arvores"),
    position: 2,
    isBoss: true,
    description: `Implemente \`menorAncestralComum(raiz, p, q)\`. A função recebe a raiz de uma **árvore binária de busca** com valores distintos e dois valores \`p\` e \`q\` que **estão presentes** na árvore, e retorna o **valor** do menor ancestral comum dos dois nós.

O menor ancestral comum é o nó mais profundo que tem os dois como descendentes. Um nó conta como descendente de si mesmo: se \`p\` é ancestral de \`q\`, a resposta é \`p\`. Se \`p\` e \`q\` forem iguais, a resposta é esse próprio valor.

Exemplo: na árvore \`[6,2,8,0,4,7,9,null,null,3,5]\`, o menor ancestral comum de 3 e 5 é 4; o de 2 e 8 é 6; o de 2 e 4 é 2.

Não há garantia de ordem entre os argumentos: \`p\` pode ser maior que \`q\`. A árvore pode ser **degenerada** (um caminho de milhares de níveis), então prefira uma descida iterativa em vez de percorrer a árvore inteira.`,
    constraints: [
      "1 <= número de nós <= 12000",
      "-2^31 <= val <= 2^31 - 1, valores distintos",
      "p e q existem na árvore (podem ser iguais; p pode ser maior que q).",
      "A altura pode chegar a 4500 níveis."
    ],
    tags: ["Árvores", "BST"],
    functionSpec: {
      name: "menorAncestralComum",
      params: [
        { name: "raiz", type: "tree" },
        { name: "p", type: "int" },
        { name: "q", type: "int" }
      ],
      returns: "int"
    },
    publicCases: [literal(exemplo, 2, 8), literal(exemplo, 2, 4), literal(exemplo, 3, 5)],
    hiddenCases: [
      literal([5], 5, 5),
      literal(exemplo, 8, 2),
      literal(exemplo, 5, 3),
      literal(exemplo, 9, 7),
      literal(exemplo, 5, 0),
      literal(exemplo, 7, 7),
      literal([2, 1], 2, 1),
      literal([0, -2147483648, 2147483647], 2147483647, -2147483648),
      caso(media, mediaValores[5], mediaValores[2000]),
      caso(grande, grandeFolhas[10], grandeFolhas[grandeFolhas.length - 10]),
      caso(grande, grandeValores[9000], grandeValores[4000]),
      caso(grande, grandeFolhas[500], grandeFolhas[501]),
      caso(grande, grandeValores[7777], grandeValores[7777]),
      caso(direita, crescente[4499], crescente[4498]),
      caso(direita, crescente[4497], crescente[4499]),
      caso(esquerda, crescente[0], crescente[1]),
      caso(esquerda, crescente[2], crescente[4499]),
      caso(zigue, 3 * 2000, 3 * 2001),
      caso(zigue, 3 * 2001, 3 * 1990),
      (() => {
        const valores = shuffle(random, distintos(random, 6000, 0, 999999));
        const raiz = bstDe(valores)!;
        const lista = folhas(raiz);
        return caso(raiz, lista[lista.length - 1], lista[0]);
      })()
    ],
    hints: [
      "Numa BST, comparar p e q com o valor de um nó já diz em que lado cada um está, sem visitar mais nada.",
      "Se p e q são ambos menores que o nó, o ancestral está à esquerda; se ambos são maiores, está à direita.",
      "Quando eles se separam (um de cada lado) ou um deles é o próprio nó, você encontrou a resposta. Faça isso num laço, descendo a partir da raiz."
    ],
    editorial: `**Ingênua.** Ignorar a ordenação e resolver como numa árvore qualquer: buscar os caminhos da raiz até p e até q (ou uma DFS que devolve o nó quando encontra p ou q) e pegar o último nó em comum. Funciona, mas visita a árvore inteira: O(n).

**Ótima.** A BST diz o caminho. Parta da raiz: se p e q forem menores que o nó atual, os dois estão na subárvore esquerda e o ancestral também; se forem maiores, vá para a direita. No primeiro nó em que isso deixa de valer, os dois se separam (ou um deles é o próprio nó): ele é o menor ancestral comum. Escreva as comparações de forma simétrica; supor \`p < q\` é um erro comum.

\`\`\`c
int menorAncestralComum(struct TreeNode* raiz, int p, int q) {
    struct TreeNode* atual = raiz;
    while (atual) {
        if (p < atual->val && q < atual->val) atual = atual->left;
        else if (p > atual->val && q > atual->val) atual = atual->right;
        else return atual->val;   /* p e q se separam aqui */
    }
    return -1;                    /* não acontece: p e q existem */
}
\`\`\`

A mesma ideia escrita com recursão também é O(h), mas gasta um quadro de pilha por nível. Em JavaScript, a pilha padrão comporta alguns milhares de chamadas; numa árvore degenerada mais alta, a versão recursiva estouraria. O laço não tem esse limite.

**Custo.** Tempo O(h), onde h é a altura (O(log n) numa árvore balanceada, O(n) numa degenerada). Espaço O(1) na versão iterativa.`,
    complexity: { time: "O(h)", space: "O(1)" },
    followUps: [
      "E se a árvore fosse binária comum, sem a propriedade de busca? Como ficaria a solução e seu custo?",
      "E se p ou q pudessem não existir na árvore? Como detectar isso sem piorar a complexidade?",
      "Se houvesse muitas consultas de ancestral comum na mesma árvore, que pré-processamento você faria?"
    ]
  });
}

// ---------- Grafos ----------
function contarIlhas(grade: string[]): number {
  const linhas = grade.length;
  const colunas = linhas ? grade[0].length : 0;
  const terra = new Uint8Array(linhas * colunas);
  grade.forEach((linha, r) => {
    for (let c = 0; c < colunas; c += 1) if (linha.charCodeAt(c) === 49) terra[r * colunas + c] = 1;
  });
  const pilha = new Int32Array(linhas * colunas);
  let ilhas = 0;
  for (let inicio = 0; inicio < terra.length; inicio += 1) {
    if (!terra[inicio]) continue;
    ilhas += 1;
    terra[inicio] = 0;
    let topo = 0;
    pilha[topo++] = inicio;
    while (topo) {
      const celula = pilha[--topo];
      const c = celula % colunas;
      if (celula >= colunas && terra[celula - colunas]) (terra[celula - colunas] = 0), (pilha[topo++] = celula - colunas);
      if (celula + colunas < terra.length && terra[celula + colunas]) (terra[celula + colunas] = 0), (pilha[topo++] = celula + colunas);
      if (c > 0 && terra[celula - 1]) (terra[celula - 1] = 0), (pilha[topo++] = celula - 1);
      if (c + 1 < colunas && terra[celula + 1]) (terra[celula + 1] = 0), (pilha[topo++] = celula + 1);
    }
  }
  return ilhas;
}

function numeroDeIlhas(): Challenge {
  const random = createRandom(900401);
  const caso = (grade: string[]) => call([grade], contarIlhas(grade));
  const gerada = (rows: number, cols: number, seed: number, weights?: number[], alphabet = "01") => {
    const grade = gen({ $gen: "grid", rows, cols, seed, alphabet, ...(weights ? { weights } : {}) });
    return call([grade.spec], contarIlhas(grade.value));
  };
  const aleatoria = (rows: number, cols: number, chanceTerra: number) =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => (random() < chanceTerra ? "1" : "0")).join(""));
  const xadrez = (lado: number) =>
    Array.from({ length: lado }, (_, r) => Array.from({ length: lado }, (_, c) => ((r + c) % 2 === 0 ? "1" : "0")).join(""));
  // Serpentina: uma única ilha em forma de caminho, com dezenas de milhares de células em sequência.
  const serpentina = (lado: number) =>
    Array.from({ length: lado }, (_, r) => {
      if (r % 2 === 0) return "1".repeat(lado);
      return Math.floor(r / 2) % 2 === 0 ? "0".repeat(lado - 1) + "1" : "1" + "0".repeat(lado - 1);
    });

  return defineChallenge({
    slug: "numero-de-ilhas",
    title: "Número de ilhas",
    difficulty: "medium",
    moduleId: moduleId("entrevista-grafos"),
    position: 0,
    description: `Um mapa é dado como um vetor de strings \`grade\`, todas com o mesmo comprimento. Cada caractere é \`"1"\` (terra) ou \`"0"\` (água). Implemente \`numeroDeIlhas(grade)\`, que retorna quantas **ilhas** existem no mapa.

Uma ilha é um grupo máximo de células de terra ligadas **horizontal ou verticalmente** (quatro vizinhos: cima, baixo, esquerda e direita). Células que só se tocam na diagonal **não** estão ligadas. Tudo o que está fora do mapa é água.

Exemplo: o mapa abaixo tem 3 ilhas (o bloco 2×2 no canto, a dupla vertical à direita e a célula isolada embaixo).

\`\`\`
11000
11010
00010
10000
\`\`\`

Já \`["101","010","101"]\` tem 5 ilhas: nenhuma célula de terra encosta em outra pelos lados.

Os mapas chegam a 700×700 células e podem ser inteiramente de terra, então uma DFS recursiva pode estourar a pilha de chamadas; use uma pilha explícita ou uma fila (BFS).`,
    constraints: [
      "1 <= número de linhas, número de colunas <= 700",
      "Cada caractere de grade[i] é '1' ou '0'.",
      "Uma ilha pode ter todas as 490000 células do mapa.",
      "Retorne um inteiro; não imprima nada."
    ],
    tags: ["Grafos", "BFS", "DFS"],
    functionSpec: { name: "numeroDeIlhas", params: [{ name: "grade", type: "string[]" }], returns: "int" },
    publicCases: [caso(["11000", "11010", "00010", "10000"]), caso(["111", "010", "111"])],
    hiddenCases: [
      caso(["0"]),
      caso(["1"]),
      caso(["101", "010", "101"]),
      caso(["10101"]),
      caso(["1", "0", "1", "1"]),
      caso(["111", "101", "111"]),
      caso(["1101", "0011", "1000", "0110"]),
      caso(aleatoria(30, 40, 0.45)),
      caso(xadrez(60)),
      caso(serpentina(400)),
      gerada(200, 200, 900411, undefined, "0"),
      gerada(700, 700, 900412, undefined, "1"),
      gerada(250, 250, 900413, [7, 3]),
      gerada(700, 700, 900414, [41, 59]),
      gerada(300, 300, 900415, [1, 9]),
      gerada(250, 300, 900416),
      gerada(1, 700, 900417, [2, 3]),
      gerada(700, 1, 900418, [2, 3]),
      gerada(200, 200, 900419, [55, 45])
    ],
    hints: [
      "Pense no mapa como um grafo: cada célula de terra é um vértice, ligado às células de terra vizinhas pelos lados.",
      "Percorra a grade; ao achar terra ainda não visitada, some 1 e \"afunde\" a ilha inteira a partir dali, marcando todas as células alcançáveis.",
      "Para afundar sem estourar a pilha num mapa todo de terra, use uma pilha explícita (ou uma fila) de posições em vez de recursão, e marque a célula como visitada ao empilhá-la."
    ],
    editorial: `**Ingênua.** Para cada célula de terra, descobrir se ela é a "primeira" da sua ilha refazendo uma busca a partir dela. Cada busca custa até o tamanho da ilha, e o total chega a O((m·n)²).

**Ótima.** Varra a grade uma vez. Cada terra não visitada inicia uma ilha nova: some 1 e faça uma busca (DFS ou BFS) que marca como visitadas todas as células de terra alcançáveis pelos quatro lados. Cada célula é marcada uma única vez.

A DFS recursiva é a forma mais curta de escrever, mas num mapa 700×700 todo de terra (ou numa ilha em serpentina) ela empilha centenas de milhares de chamadas: estoura a pilha em JavaScript e passa do limite de recursão em Python. Com uma pilha explícita, o algoritmo é o mesmo e a memória fica sob seu controle.

\`\`\`js
function numeroDeIlhas(grade) {
  const m = grade.length, n = grade[0].length;
  const visto = new Uint8Array(m * n);
  const pilha = new Int32Array(m * n);
  let ilhas = 0;
  for (let inicio = 0; inicio < m * n; inicio++) {
    const r0 = (inicio / n) | 0, c0 = inicio % n;
    if (visto[inicio] || grade[r0][c0] !== "1") continue;
    ilhas++;
    visto[inicio] = 1;
    let topo = 0;
    pilha[topo++] = inicio;
    while (topo > 0) {
      const cel = pilha[--topo];
      const r = (cel / n) | 0, c = cel % n;
      const vizinhos = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [nr, nc] of vizinhos) {
        if (nr < 0 || nc < 0 || nr >= m || nc >= n) continue;
        const k = nr * n + nc;
        if (!visto[k] && grade[nr][nc] === "1") {
          visto[k] = 1;          // marca ao empilhar: nunca entra duas vezes
          pilha[topo++] = k;
        }
      }
    }
  }
  return ilhas;
}
\`\`\`

**Custo.** Cada célula é visitada e empilhada no máximo uma vez: tempo O(m·n) e espaço O(m·n) para as marcas e a pilha. Outra saída com o mesmo custo é a união e busca (union-find), unindo cada terra à vizinha de cima e à da esquerda.`,
    complexity: { time: "O(m·n)", space: "O(m·n)" },
    followUps: [
      "E se as células diagonais também contassem como ligadas? O que muda no código?",
      "Se o mapa começasse todo de água e as terras fossem surgindo uma a uma, como informar o número de ilhas depois de cada adição sem refazer a busca?",
      "Como devolver também a área da maior ilha, ou o número de ilhas com formatos distintos?"
    ]
  });
}

/** Kahn com fila de prioridade: ordem topológica lexicograficamente menor, ou [] se houver ciclo. */
function ordemTopologicaMenor(n: number, dependencias: number[][]): number[] {
  // Listas de dependentes em formato compacto (CSR): inicio[a]..inicio[a + 1].
  const grau = new Int32Array(n);
  const inicio = new Int32Array(n + 1);
  for (const [a, b] of dependencias) {
    inicio[a + 1] += 1;
    grau[b] += 1;
  }
  for (let tarefa = 0; tarefa < n; tarefa += 1) inicio[tarefa + 1] += inicio[tarefa];
  const destino = new Int32Array(dependencias.length);
  const cursor = inicio.slice(0, n);
  for (const [a, b] of dependencias) destino[cursor[a]++] = b;
  const heap: number[] = [];
  const subir = (valor: number) => {
    let index = heap.push(valor) - 1;
    while (index > 0) {
      const pai = (index - 1) >> 1;
      if (heap[pai] <= heap[index]) break;
      const troca = heap[pai];
      heap[pai] = heap[index];
      heap[index] = troca;
      index = pai;
    }
  };
  const retirar = () => {
    const topo = heap[0];
    const ultimo = heap.pop()!;
    if (heap.length) {
      heap[0] = ultimo;
      let index = 0;
      for (;;) {
        const esquerda = 2 * index + 1;
        const direita = esquerda + 1;
        let menor = index;
        if (esquerda < heap.length && heap[esquerda] < heap[menor]) menor = esquerda;
        if (direita < heap.length && heap[direita] < heap[menor]) menor = direita;
        if (menor === index) break;
        const troca = heap[menor];
      heap[menor] = heap[index];
      heap[index] = troca;
        index = menor;
      }
    }
    return topo;
  };
  for (let tarefa = 0; tarefa < n; tarefa += 1) if (grau[tarefa] === 0) subir(tarefa);
  const ordem: number[] = [];
  while (heap.length) {
    const tarefa = retirar();
    ordem.push(tarefa);
    for (let k = inicio[tarefa]; k < inicio[tarefa + 1]; k += 1) {
      const seguinte = destino[k];
      grau[seguinte] -= 1;
      if (grau[seguinte] === 0) subir(seguinte);
    }
  }
  return ordem.length === n ? ordem : [];
}

function ordemDasTarefas(): Challenge {
  const random = createRandom(900501);
  const caso = (n: number, dependencias: number[][]) => call([n, dependencias], ordemTopologicaMenor(n, dependencias));
  /** DAG com rótulos embaralhados: as arestas seguem uma ordem escondida. */
  const dag = (n: number, m: number) => {
    const rotulo = shuffle(
      random,
      Array.from({ length: n }, (_, index) => index)
    );
    const arestas: number[][] = [];
    for (let index = 0; index < m; index += 1) {
      const i = randomInt(random, 0, n - 2);
      const j = randomInt(random, i + 1, Math.min(n - 1, i + 1 + randomInt(random, 0, 60)));
      arestas.push([rotulo[i], rotulo[j]]);
    }
    return arestas;
  };
  const comCiclo = (n: number, m: number) => {
    const arestas = dag(n, m);
    const [a, b] = pick(random, arestas);
    arestas.splice(randomInt(random, 0, arestas.length), 0, [b, a]);
    return arestas;
  };
  /**
   * Casos enormes: duas árvores geradas (arestas sempre de um índice menor
   * para um maior, logo sem ciclo) mais um ciclo curto entre as últimas
   * tarefas. Quase todas as tarefas são liberadas antes de o ciclo travar a
   * ordem, então a solução ingênua O(n²) estoura o tempo; a resposta é [].
   */
  const enorme = (n: number, seedA: number, seedB: number, ciclo: number[][]) => {
    const arestas = gen({
      $gen: "concat",
      parts: [{ $gen: "edges", n, seed: seedA, tree: true }, { $gen: "edges", n, seed: seedB, tree: true }, ciclo]
    });
    const esperado = ordemTopologicaMenor(n, arestas.value);
    if (esperado.length) throw new Error("ordem-das-tarefas: caso enorme deveria ter ciclo");
    return call([n, arestas.spec], esperado);
  };
  const aleatorioEnorme = (n: number, m: number, seed: number) => {
    const arestas = gen({ $gen: "edges", n, m, seed });
    const esperado = ordemTopologicaMenor(n, arestas.value);
    if (esperado.length) throw new Error("ordem-das-tarefas: grafo aleatório deveria ter ciclo");
    return call([n, arestas.spec], esperado);
  };

  return defineChallenge({
    slug: "ordem-das-tarefas",
    title: "Ordem das tarefas",
    difficulty: "hard",
    moduleId: moduleId("entrevista-grafos"),
    position: 1,
    isBoss: true,
    description: `Um projeto tem \`n\` tarefas, numeradas de \`0\` a \`n - 1\`, e uma lista de \`dependencias\`. Cada par \`[a, b]\` significa que **a tarefa b depende de a**: \`a\` precisa ser feita antes de \`b\`.

Implemente \`ordemDasTarefas(n, dependencias)\`, que retorna uma ordem para executar **todas** as tarefas respeitando as dependências. Como costuma haver várias ordens válidas, retorne a **lexicograficamente menor**: entre as ordens válidas, a que tem o menor número na primeira posição; havendo empate, o menor na segunda; e assim por diante. Na prática, sempre que várias tarefas estiverem liberadas, faça primeiro a de menor número.

Se as dependências formarem um ciclo (por exemplo, 0 depende de 1 e 1 depende de 0), é impossível concluir o projeto: retorne um vetor vazio \`[]\`.

Exemplo: com \`n = 4\` e \`dependencias = [[0,3],[2,1]]\`, as tarefas 0 e 2 começam liberadas. Faz-se a 0 (libera a 3), depois a 2 (libera a 1), depois a 1 e por fim a 3: a resposta é \`[0,2,1,3]\`. A ordem \`[0,2,3,1]\` também é válida, mas é maior.

Uma mesma dependência pode aparecer repetida, e tarefas sem dependências podem ser feitas a qualquer momento.`,
    constraints: [
      "1 <= n <= 10^5",
      "0 <= número de dependências <= 2·10^5",
      "0 <= a, b < n e a != b",
      "Quando existe uma ordem válida nos testes, n <= 2000 (a resposta é impressa inteira). Os casos com n grande têm ciclo e testam só o tempo."
    ],
    tags: ["Grafos", "Ordenação topológica", "Heap"],
    functionSpec: {
      name: "ordemDasTarefas",
      params: [
        { name: "n", type: "int" },
        { name: "dependencias", type: "int[][]" }
      ],
      returns: "int[]"
    },
    publicCases: [
      caso(4, [
        [0, 1],
        [0, 2],
        [1, 3],
        [2, 3]
      ]),
      caso(3, [
        [0, 1],
        [1, 2],
        [2, 0]
      ])
    ],
    hiddenCases: [
      caso(1, []),
      caso(4, [
        [0, 3],
        [2, 1]
      ]),
      caso(5, []),
      caso(3, [
        [2, 1],
        [1, 0]
      ]),
      caso(2, [
        [0, 1],
        [1, 0]
      ]),
      caso(6, [
        [5, 0],
        [5, 0],
        [4, 0],
        [3, 1],
        [4, 2]
      ]),
      caso(6, [
        [0, 1],
        [1, 2],
        [3, 4],
        [4, 5],
        [5, 3]
      ]),
      caso(7, [
        [6, 0],
        [5, 1],
        [4, 2],
        [3, 0],
        [1, 3]
      ]),
      caso(50, dag(50, 80)),
      caso(500, dag(500, 1500)),
      caso(2000, dag(2000, 6000)),
      caso(2000, dag(2000, 400)),
      caso(
        2000,
        Array.from({ length: 1999 }, (_, index) => [1999 - index, 1998 - index])
      ),
      caso(2000, comCiclo(2000, 5000)),
      enorme(100000, 900511, 900512, [
        [99998, 99999],
        [99999, 99998]
      ]),
      enorme(30000, 900513, 900514, [
        [29997, 29998],
        [29998, 29999],
        [29999, 29997]
      ]),
      aleatorioEnorme(30000, 60000, 900515),
    ],
    hints: [
      "Uma tarefa pode ser feita quando todas as tarefas de que ela depende já foram feitas. Conte, para cada tarefa, quantas dependências ainda faltam (o grau de entrada).",
      "Esse é o algoritmo de Kahn: comece pelas tarefas com grau zero; ao fazer uma, diminua o grau das que dependem dela e libere as que chegarem a zero. Se sobrar tarefa sem ser feita, há ciclo.",
      "Para a ordem lexicograficamente menor, guarde as tarefas liberadas numa fila de prioridade (heap mínimo) e sempre retire a de menor número. Em JavaScript e C, implemente o heap; em Python, use heapq."
    ],
    editorial: `**Ingênua.** Repetir n vezes: varrer todas as tarefas, achar a de menor número que ainda não foi feita e está liberada, e fazê-la. Cada rodada custa O(n), o total é O(n² + m): com n = 10^5 são 10^10 passos. Outra ingênua é o Kahn com fila comum (FIFO): rápido, mas gera uma ordem válida que nem sempre é a menor.

**Ótima.** Kahn com heap mínimo:

1. Monte a lista de quem depende de cada tarefa e conte o grau de entrada de cada uma.
2. Coloque no heap todas as tarefas com grau zero.
3. Enquanto o heap não estiver vazio, retire a menor, anote-a e decremente o grau de cada dependente; quem chegar a zero entra no heap.
4. Se a ordem tiver menos de n tarefas, sobrou um ciclo: retorne \`[]\`.

A escolha gulosa é correta: uma tarefa liberada nunca deixa de estar liberada, então adiá-la em favor de uma maior só pioraria a comparação lexicográfica.

\`\`\`python
import heapq

def ordemDasTarefas(n, dependencias):
    dependentes = [[] for _ in range(n)]
    grau = [0] * n
    for a, b in dependencias:
        dependentes[a].append(b)
        grau[b] += 1
    livres = [t for t in range(n) if grau[t] == 0]
    heapq.heapify(livres)
    ordem = []
    while livres:
        t = heapq.heappop(livres)
        ordem.append(t)
        for d in dependentes[t]:
            grau[d] -= 1
            if grau[d] == 0:
                heapq.heappush(livres, d)
    return ordem if len(ordem) == n else []
\`\`\`

**Custo.** Cada tarefa entra e sai do heap uma vez (O(log n) cada) e cada dependência é examinada uma vez: tempo O((n + m) log n), espaço O(n + m).

**Sobre os testes.** Uma ordem com 10^5 tarefas não cabe na saída do juiz; por isso os casos com ordem válida têm n até 2000 e os casos enormes (n = 10^5, m ≈ 2·10^5) têm um ciclo pequeno entre as últimas tarefas. Neles quase todas as tarefas são liberadas antes do bloqueio, e a solução O(n²) estoura o tempo mesmo com a resposta \`[]\`.`,
    complexity: { time: "O((n + m) log n)", space: "O(n + m)" },
    followUps: [
      "Se só fosse preciso dizer se existe alguma ordem (sem ser a menor), qual seria o custo? Como detectar o ciclo com DFS e três cores?",
      "Como devolver as tarefas de um ciclo, para mostrar ao usuário o que precisa ser corrigido?",
      "Se cada tarefa tivesse uma duração e várias pudessem rodar em paralelo, como calcular o tempo mínimo para concluir o projeto?"
    ]
  });
}

// ---------- Programação dinâmica e design ----------
const MOD = 1000000007;

function maneirasDeSubir(n: number): number {
  let anterior = 1; // maneiras de chegar ao degrau 0
  let atual = 1; // maneiras de chegar ao degrau 1
  for (let degrau = 2; degrau <= n; degrau += 1) {
    const proximo = (anterior + atual) % MOD;
    anterior = atual;
    atual = proximo;
  }
  return atual;
}

function subirEscada(): Challenge {
  const caso = (n: number) => call([n], maneirasDeSubir(n));
  return defineChallenge({
    slug: "subir-escada",
    title: "Subir a escada",
    difficulty: "easy",
    moduleId: moduleId("entrevista-dp-design"),
    position: 0,
    description: `Uma escada tem \`n\` degraus. A cada passo você sobe **1 ou 2** degraus. Implemente \`subirEscada(n)\`, que retorna de quantas maneiras diferentes é possível chegar exatamente ao topo, partindo do chão.

Duas maneiras são diferentes quando a sequência de passos é diferente: para \`n = 3\` há 3 maneiras (1+1+1, 1+2 e 2+1).

Como o número cresce muito rápido, retorne o resultado **módulo 1000000007** (o resto da divisão por 10^9 + 7).`,
    constraints: ["1 <= n <= 10^6", "Retorne um inteiro entre 0 e 1000000006."],
    tags: ["Programação dinâmica"],
    functionSpec: { name: "subirEscada", params: [{ name: "n", type: "int" }], returns: "int" },
    publicCases: [caso(3), caso(5)],
    hiddenCases: [1, 2, 4, 10, 30, 44, 45, 50, 90, 100, 1000, 12345, 99999, 500000, 999999, 1000000].map(caso),
    hints: [
      "Pense no último passo: para chegar ao degrau n, você veio do degrau n - 1 (passo de 1) ou do degrau n - 2 (passo de 2).",
      "Então maneiras(n) = maneiras(n - 1) + maneiras(n - 2), com maneiras(0) = maneiras(1) = 1. A recursão direta recalcula os mesmos valores um número exponencial de vezes.",
      "Calcule de baixo para cima guardando só os dois últimos valores, e aplique o módulo a cada soma para os números não estourarem."
    ],
    editorial: `**Ingênua.** Traduzir a recorrência direto em recursão: \`f(n) = f(n - 1) + f(n - 2)\`. Cada chamada abre duas, e o total de chamadas cresce como a própria sequência de Fibonacci: para n = 45 já são bilhões. A recursão com memorização resolve o tempo, mas com n = 10^6 empilha um milhão de chamadas e estoura a pilha.

**Ótima.** Programação dinâmica de baixo para cima. \`f(0) = 1\` (ficar no chão é uma maneira) e \`f(1) = 1\`; para cada degrau, some os dois anteriores. Como cada valor só depende dos dois últimos, duas variáveis bastam.

\`\`\`c
int subirEscada(int n) {
    const long long MOD = 1000000007;
    long long anterior = 1, atual = 1;   /* f(0) e f(1) */
    for (int i = 2; i <= n; i++) {
        long long proximo = (anterior + atual) % MOD;
        anterior = atual;
        atual = proximo;
    }
    return (int)atual;
}
\`\`\`

O módulo precisa entrar **a cada soma**: f(44) já passa de 10^9 e, sem o módulo, os valores estourariam o \`int\` (e perderiam precisão em ponto flutuante).

**Custo.** Tempo O(n), espaço O(1).`,
    complexity: { time: "O(n)", space: "O(1)" },
    followUps: [
      "E se fosse possível subir 1, 2 ou 3 degraus por passo? E se os tamanhos de passo permitidos viessem num vetor?",
      "Como calcular a resposta para n = 10^18 em tempo O(log n)? (Dica: potência de matriz.)",
      "E se alguns degraus estivessem quebrados e não pudessem ser pisados?"
    ]
  });
}

function menorTroco(moedas: number[], valor: number): number {
  const infinito = valor + 1;
  const melhor = new Array<number>(valor + 1).fill(infinito);
  melhor[0] = 0;
  for (const moeda of moedas) {
    for (let v = moeda; v <= valor; v += 1) melhor[v] = Math.min(melhor[v], melhor[v - moeda] + 1);
  }
  return melhor[valor] === infinito ? -1 : melhor[valor];
}

function trocoGuloso(moedas: number[], valor: number): number {
  let resto = valor;
  let usadas = 0;
  for (const moeda of [...moedas].sort((a, b) => b - a)) {
    usadas += Math.floor(resto / moeda);
    resto %= moeda;
  }
  return resto === 0 ? usadas : -1;
}

function trocoMinimo(): Challenge {
  const random = createRandom(900701);
  const caso = (moedas: number[], valor: number) => call([moedas, valor], menorTroco(moedas, valor));
  /** Sistema de moedas sorteado em que a escolha gulosa erra para este valor. */
  const naoCanonico = (quantidade: number, maximo: number, valor: number) => {
    for (;;) {
      const moedas = shuffle(random, [...new Set(Array.from({ length: quantidade }, () => randomInt(random, 2, maximo)))]);
      if (menorTroco(moedas, valor) !== trocoGuloso(moedas, valor)) return caso(moedas, valor);
    }
  };
  return defineChallenge({
    slug: "troco-minimo",
    title: "Troco com menos moedas",
    difficulty: "medium",
    moduleId: moduleId("entrevista-dp-design"),
    position: 1,
    description: `Você tem moedas de alguns valores, em quantidade ilimitada de cada um. Implemente \`trocoMinimo(moedas, valor)\`, que retorna o **menor número de moedas** cuja soma é exatamente \`valor\`. Se for impossível formar o valor, retorne \`-1\`.

Exemplos:

- \`moedas = [1, 2, 5]\`, \`valor = 11\`: a resposta é 3 (5 + 5 + 1).
- \`moedas = [2]\`, \`valor = 3\`: impossível, a resposta é -1.
- \`valor = 0\` sempre tem resposta 0 (nenhuma moeda).

Cuidado: pegar sempre a maior moeda possível (estratégia gulosa) funciona para o sistema de moedas do real, mas **não** para qualquer conjunto. Com \`moedas = [1, 3, 4]\` e \`valor = 6\`, a gulosa usa 4 + 1 + 1 (três moedas), enquanto 3 + 3 usa só duas.`,
    constraints: [
      "1 <= moedas.length <= 50",
      "1 <= moedas[i] <= 10^4, valores distintos",
      "0 <= valor <= 10^4"
    ],
    tags: ["Programação dinâmica"],
    functionSpec: {
      name: "trocoMinimo",
      params: [
        { name: "moedas", type: "int[]" },
        { name: "valor", type: "int" }
      ],
      returns: "int"
    },
    publicCases: [caso([1, 2, 5], 11), caso([2], 3), caso([25, 10, 5, 1], 63)],
    hiddenCases: [
      caso([1], 0),
      caso([1, 3, 4], 6),
      caso([2, 5], 6),
      caso([5, 10], 3),
      caso([1, 5, 6, 9], 11),
      caso([1], 10000),
      caso([10000], 10000),
      caso([9999, 10000], 10000),
      caso([7, 3], 10000),
      caso([2, 4, 6, 8], 9999),
      caso([500, 300, 170], 10000),
      caso([10000, 5000], 4999),
      naoCanonico(3, 50, 997),
      naoCanonico(8, 400, 9973),
      naoCanonico(20, 3000, 10000),
      naoCanonico(50, 10000, 10000),
      caso(Array.from({ length: 50 }, (_, index) => 9951 + index), 10000),
      caso([1, 2, 5, 10, 20, 50, 100, 200], 9999)
    ],
    hints: [
      "Se você soubesse o menor número de moedas para todos os valores menores que v, como calcularia o de v?",
      "Escolha a última moeda usada: melhor[v] = 1 + min(melhor[v - moeda]) entre as moedas que cabem em v. O caso base é melhor[0] = 0.",
      "Preencha um vetor de 0 até valor, marcando como \"infinito\" (por exemplo, valor + 1) o que não dá para formar; no fim, infinito vira -1."
    ],
    editorial: `**Ingênuas.** A gulosa (sempre a maior moeda que cabe) é rápida, mas só acerta em sistemas "canônicos" como o do real; com \`[1, 3, 4]\` e valor 6 ela devolve 3 em vez de 2, e com \`[2, 5]\` e valor 6 ela nem encontra resposta. A recursão que testa todas as moedas em cada passo acerta, mas explora um número exponencial de combinações.

**Ótima.** Programação dinâmica sobre o valor. \`melhor[v]\` é o menor número de moedas que somam v. Para cada v, a última moeda escolhida foi alguma \`c <= v\`, e o resto \`v - c\` também precisa ser formado da melhor forma: \`melhor[v] = 1 + min(melhor[v - c])\`. Iterar moeda por moeda (laço externo) e valor por valor (laço interno) dá o mesmo resultado, porque cada moeda pode ser reutilizada.

\`\`\`js
function trocoMinimo(moedas, valor) {
  const INF = valor + 1;                 // mais moedas do que qualquer resposta
  const melhor = new Array(valor + 1).fill(INF);
  melhor[0] = 0;
  for (const c of moedas) {
    for (let v = c; v <= valor; v++) {
      if (melhor[v - c] + 1 < melhor[v]) melhor[v] = melhor[v - c] + 1;
    }
  }
  return melhor[valor] === INF ? -1 : melhor[valor];
}
\`\`\`

**Custo.** Tempo O(k·V), onde k é o número de moedas e V o valor (no máximo 50 · 10^4 = 5·10^5 passos). Espaço O(V).`,
    complexity: { time: "O(k·V)", space: "O(V)" },
    followUps: [
      "Como contar de quantas maneiras diferentes (sem importar a ordem) é possível formar o valor?",
      "Além do número mínimo, como devolver quais moedas foram usadas?",
      "E se cada moeda só pudesse ser usada uma vez? O que muda na ordem dos laços?"
    ]
  });
}

function tamanhoLis(nums: number[]): number {
  const caudas: number[] = [];
  for (const valor of nums) {
    let baixo = 0;
    let alto = caudas.length;
    while (baixo < alto) {
      const meio = (baixo + alto) >> 1;
      if (caudas[meio] < valor) baixo = meio + 1;
      else alto = meio;
    }
    caudas[baixo] = valor;
  }
  return caudas.length;
}

function maiorSubsequenciaCrescente(): Challenge {
  const random = createRandom(900801);
  const caso = (nums: number[]) => call([nums], tamanhoLis(nums));
  const gerado = (spec: Parameters<typeof gen>[0]) => {
    const nums = gen(spec);
    return call([nums.spec], tamanhoLis(nums.value));
  };
  return defineChallenge({
    slug: "maior-subsequencia-crescente",
    title: "Maior subsequência crescente",
    difficulty: "hard",
    moduleId: moduleId("entrevista-dp-design"),
    position: 2,
    description: `Implemente \`maiorSubsequenciaCrescente(nums)\`, que retorna o **tamanho** da maior subsequência **estritamente crescente** do vetor \`nums\`.

Uma subsequência é obtida apagando zero ou mais elementos sem mudar a ordem dos que sobram (eles não precisam ser vizinhos). Estritamente crescente quer dizer que cada elemento é **maior** que o anterior: valores iguais não contam.

Exemplos:

- \`[3, 1, 4, 1, 5, 9, 2, 6]\`: a resposta é 4 (por exemplo, 3, 4, 5, 9 ou 1, 4, 5, 6).
- \`[2, 2, 2]\`: a resposta é 1.
- \`[]\`: a resposta é 0.

Os vetores chegam a 2·10^5 elementos: uma solução O(n²) não termina a tempo. Mire em O(n log n).`,
    constraints: ["0 <= nums.length <= 2·10^5", "-10^9 <= nums[i] <= 10^9"],
    tags: ["Programação dinâmica", "Busca binária"],
    functionSpec: { name: "maiorSubsequenciaCrescente", params: [{ name: "nums", type: "int[]" }], returns: "int" },
    publicCases: [caso([3, 1, 4, 1, 5, 9, 2, 6]), caso([9, 1, 3, 7, 5, 6, 20])],
    hiddenCases: [
      caso([]),
      caso([42]),
      caso([1, 2, 2, 3]),
      caso([7, 6, 5, 4]),
      caso([5, 5, 5, 5, 5]),
      caso([-1000000000, 1000000000]),
      caso([4, 10, 4, 3, 8, 9]),
      caso(Array.from({ length: 60 }, () => randomInt(random, -50, 50))),
      caso(Array.from({ length: 3000 }, () => randomInt(random, -1000000000, 1000000000))),
      gerado({ $gen: "ints", n: 200000, min: -1000000000, max: 1000000000, seed: 900811 }),
      gerado({ $gen: "range", n: 20000, start: -100000 }),
      gerado({ $gen: "range", n: 20000, start: 20000, step: -1 }),
      gerado({ $gen: "ints", n: 20000, min: 0, max: 100, seed: 900812 }),
      gerado({ $gen: "ints", n: 20000, min: 0, max: 1000, seed: 900813, sorted: "asc" }),
      gerado({ $gen: "perm", n: 200000, seed: 900814 }),
      gerado({ $gen: "ints", n: 20000, min: -1000000000, max: 1000000000, seed: 900815, sorted: "desc" }),
      gerado({
        $gen: "concat",
        parts: [
          { $gen: "range", n: 10000, start: 0, step: 2 },
          { $gen: "ints", n: 10000, min: 0, max: 40000, seed: 900816 }
        ]
      }),
      gerado({ $gen: "ints", n: 20000, min: -1000000000, max: 1000000000, seed: 900817, sorted: "asc", set: { "0": 1000000000 } })
    ],
    hints: [
      "A DP clássica guarda, para cada posição i, o tamanho da maior subsequência que termina em nums[i]. Isso custa O(n²): precisa de algo melhor.",
      "Mantenha um vetor caudas em que caudas[k] é o menor valor possível para o último elemento de uma subsequência crescente de tamanho k + 1. Esse vetor é sempre crescente.",
      "Para cada número, ache por busca binária a primeira cauda maior ou igual a ele e substitua-a (ou acrescente no fim se não houver). Para ser estritamente crescente, use \"maior ou igual\" (lower bound), não \"maior\". O tamanho final de caudas é a resposta."
    ],
    editorial: `**Ingênua.** \`dp[i]\` = tamanho da maior subsequência crescente que termina em \`nums[i]\` = 1 + max(\`dp[j]\`) para \`j < i\` com \`nums[j] < nums[i]\`. Correta, mas O(n²): com n = 2·10^5 são 2·10^10 comparações.

**Ótima (paciência).** Guarde \`caudas\`, em que \`caudas[k]\` é o **menor** último elemento de todas as subsequências crescentes de tamanho k + 1 vistas até agora. Terminar com um valor menor só pode ajudar no futuro, e \`caudas\` é sempre estritamente crescente, então dá para usar busca binária. Para cada \`x\`:

1. ache a primeira posição com \`caudas[k] >= x\`;
2. se não houver, \`x\` estende a maior subsequência: acrescente no fim;
3. senão, substitua \`caudas[k]\` por \`x\`.

Usar \`>=\` na busca (lower bound) garante que valores iguais não se encadeiam. Com \`>\` (upper bound) você calcularia a maior subsequência **não decrescente**. Note que \`caudas\` não é, em geral, uma subsequência de verdade; só o tamanho dele importa.

\`\`\`python
from bisect import bisect_left

def maiorSubsequenciaCrescente(nums):
    caudas = []
    for x in nums:
        k = bisect_left(caudas, x)   # primeira cauda >= x
        if k == len(caudas):
            caudas.append(x)
        else:
            caudas[k] = x
    return len(caudas)
\`\`\`

**Custo.** Uma busca binária por elemento: tempo O(n log n), espaço O(n).`,
    complexity: { time: "O(n log n)", space: "O(n)" },
    followUps: [
      "Como reconstruir uma subsequência crescente de tamanho máximo, e não só o tamanho?",
      "E se a pergunta fosse o número de subsequências crescentes de tamanho máximo?",
      "Como adaptar a ideia para encaixar envelopes (largura e altura) uns dentro dos outros?"
    ]
  });
}

/**
 * Simulação de referência do cache LRU: mapa chave → posição e lista dupla
 * em vetores (0 é a sentinela; next[0] é a mais recente, prev[0] a mais antiga).
 */
function simularLru(capacidade: number, operacoes: string[], argumentos: number[][]): number[] {
  const posicao = new Map<number, number>();
  const chaves = new Int32Array(capacidade + 1);
  const valores = new Int32Array(capacidade + 1);
  const prev = new Int32Array(capacidade + 1);
  const next = new Int32Array(capacidade + 1);
  const desligar = (no: number) => {
    next[prev[no]] = next[no];
    prev[next[no]] = prev[no];
  };
  const naFrente = (no: number) => {
    prev[no] = 0;
    next[no] = next[0];
    prev[next[0]] = no;
    next[0] = no;
  };
  let usados = 0;
  const resultados: number[] = [];
  for (let index = 0; index < operacoes.length; index += 1) {
    const [chave, valor] = argumentos[index];
    const no = posicao.get(chave);
    if (operacoes[index] === "get") {
      if (no === undefined) {
        resultados.push(-1);
        continue;
      }
      desligar(no);
      naFrente(no);
      resultados.push(valores[no]);
      continue;
    }
    if (no !== undefined) {
      valores[no] = valor;
      desligar(no);
      naFrente(no);
      continue;
    }
    let livre: number;
    if (usados < capacidade) livre = ++usados;
    else {
      livre = prev[0];
      desligar(livre);
      posicao.delete(chaves[livre]);
    }
    chaves[livre] = chave;
    valores[livre] = valor;
    naFrente(livre);
    posicao.set(chave, livre);
  }
  return resultados;
}

function cacheLru(): Challenge {
  const random = createRandom(900901);
  const caso = (capacidade: number, operacoes: string[], argumentos: number[][]) =>
    call([capacidade, operacoes, argumentos], simularLru(capacidade, operacoes, argumentos));
  const aleatorio = (capacidade: number, total: number, maiorChave: number, chanceGet: number) => {
    const operacoes: string[] = [];
    const argumentos: number[][] = [];
    for (let index = 0; index < total; index += 1) {
      const chave = randomInt(random, 0, maiorChave);
      if (random() < chanceGet) {
        operacoes.push("get");
        argumentos.push([chave]);
      } else {
        operacoes.push("put");
        argumentos.push([chave, randomInt(random, 0, 999)]);
      }
    }
    return caso(capacidade, operacoes, argumentos);
  };
  /**
   * Casos enormes em fases (blocos de puts e de gets), gerados pelo juiz:
   * 10^5 operações, poucas consultas para a saída caber no limite.
   */
  let semente = 900911;
  const enorme = (capacidade: number, fases: Array<["put" | "get", number]>, maiorChave: number) => {
    const operacoes = gen({ $gen: "concat", parts: fases.map(([operacao, n]) => ({ $gen: "repeat", n, value: operacao })) });
    const argumentos = gen({
      $gen: "concat",
      parts: fases.map(([operacao, n]) => ({ $gen: "matrix", rows: n, cols: operacao === "put" ? 2 : 1, min: 0, max: maiorChave, seed: semente++ }))
    });
    return call([capacidade, operacoes.spec, argumentos.spec], simularLru(capacidade, operacoes.value, argumentos.value));
  };

  return defineChallenge({
    slug: "cache-lru",
    title: "Cache LRU",
    difficulty: "hard",
    moduleId: moduleId("entrevista-dp-design"),
    position: 3,
    description: `Um cache LRU (*least recently used*) guarda no máximo \`capacidade\` pares chave → valor. Quando está cheio e precisa guardar uma chave nova, ele descarta a chave **usada há mais tempo**.

Implemente \`cacheLru(capacidade, operacoes, argumentos)\`, que simula o cache sobre uma sequência de operações. \`operacoes[i]\` é \`"put"\` ou \`"get"\`, e \`argumentos[i]\` traz os argumentos dela:

- \`"put"\` com \`[chave, valor]\`: guarda o valor na chave. Se a chave já existe, só atualiza o valor. Se é nova e o cache está cheio, antes remove a chave usada há mais tempo.
- \`"get"\` com \`[chave]\`: consulta a chave; o resultado é o valor guardado, ou \`-1\` se ela não estiver no cache.

Tanto \`put\` quanto \`get\` (bem-sucedido) contam como **uso** da chave, tornando-a a mais recente. Retorne um vetor com os resultados de todos os \`get\`, na ordem em que aconteceram.

Exemplo com capacidade 2: \`put(1,10)\`, \`put(2,20)\`, \`get(1)\` → 10, \`put(3,30)\` remove a chave 2 (a 1 foi usada depois dela), \`get(2)\` → -1, \`get(3)\` → 30, \`put(4,40)\` remove a 1, \`get(1)\` → -1, \`get(3)\` → 30, \`get(4)\` → 40. Resultado: \`[10,-1,30,-1,30,40]\`.

São até 10^5 operações com capacidade de até 10^5: cada operação precisa custar O(1).`,
    constraints: [
      "1 <= capacidade <= 10^5",
      "1 <= `operacoes.length` <= 10^5 (`argumentos` tem o mesmo tamanho)",
      "0 <= chave, valor <= 10^6",
      "`operacoes[i]` é \"put\" (`argumentos[i] = [chave, valor]`) ou \"get\" (`argumentos[i] = [chave]`)."
    ],
    tags: ["Design", "Hash", "Lista duplamente encadeada"],
    functionSpec: {
      name: "cacheLru",
      params: [
        { name: "capacidade", type: "int" },
        { name: "operacoes", type: "string[]" },
        { name: "argumentos", type: "int[][]" }
      ],
      returns: "int[]"
    },
    publicCases: [
      caso(
        2,
        ["put", "put", "get", "put", "get", "get", "put", "get", "get", "get"],
        [[1, 10], [2, 20], [1], [3, 30], [2], [3], [4, 40], [1], [3], [4]]
      ),
      caso(1, ["put", "put", "get", "put", "get", "get"], [[5, 1], [5, 2], [5], [6, 3], [5], [6]])
    ],
    hiddenCases: [
      caso(1, ["get"], [[1]]),
      caso(2, ["put", "put", "put", "put", "get", "get", "get"], [[1, 1], [2, 2], [1, 10], [3, 3], [1], [2], [3]]),
      caso(3, ["put", "put", "put"], [[1, 0], [2, 0], [3, 0]]),
      caso(2, ["get", "put", "get", "get"], [[7], [7, 0], [7], [8]]),
      caso(3, ["put", "put", "put", "get", "put", "get", "get", "get", "get"], [[1, 1], [2, 2], [3, 3], [1], [4, 4], [1], [2], [3], [4]]),
      caso(2, ["put", "put", "put", "get", "get", "put", "get", "get"], [[0, 5], [1, 6], [0, 7], [0], [1], [2, 8], [1], [0]]),
      aleatorio(5, 2000, 20, 0.5),
      aleatorio(1, 3000, 3, 0.5),
      aleatorio(50, 3000, 100, 0.4),
      aleatorio(200, 3000, 150, 0.5),
      aleatorio(64, 5000, 1000, 0.3),
      enorme(30000, [["put", 60000], ["get", 2500], ["put", 35000], ["get", 2500]], 200000),
      enorme(20000, [["put", 15000], ["get", 1000], ["put", 12000], ["get", 2000]], 1000000),
      enorme(3, [["put", 8000], ["get", 2000], ["put", 8000], ["get", 2000]], 5),
      enorme(5000, [["put", 15000], ["get", 2000]], 8000)
    ],
    hints: [
      "Um mapa (hash) responde \"a chave está no cache?\" em O(1). O difícil é saber, também em O(1), qual chave foi usada há mais tempo e mover uma chave para \"mais recente\".",
      "Guarde as chaves numa lista duplamente encadeada em ordem de uso: a mais recente numa ponta, a mais antiga na outra. Com os ponteiros anterior e próximo, dá para tirar um nó do meio em O(1).",
      "O mapa guarda chave → nó da lista. Em cada uso, desligue o nó e religue-o na frente; para remover, pegue o nó do fim e apague a chave dele do mapa. Nós sentinela (cabeça e cauda falsas) eliminam os casos especiais."
    ],
    editorial: `**Ingênua.** Guardar os pares num vetor com a "hora" do último uso. Procurar uma chave e achar a menos usada exigem varrer o vetor inteiro: O(capacidade) por operação, até 10^10 passos no total.

**Ótima.** Combinar duas estruturas:

- um **mapa** de chave para nó, para achar qualquer chave em O(1);
- uma **lista duplamente encadeada** em ordem de uso, com a chave mais recente logo depois da cabeça e a mais antiga logo antes da cauda.

\`get\`: se a chave está no mapa, mova o nó para a frente e devolva o valor. \`put\`: se a chave existe, atualize o valor e mova para a frente; senão, se o cache está cheio, remova o nó antes da cauda (e a chave dele do mapa), depois crie o nó novo na frente. Cada passo mexe só em alguns ponteiros.

\`\`\`js
function cacheLru(capacidade, operacoes, argumentos) {
  const cabeca = { prev: null, next: null };
  const cauda = { prev: cabeca, next: null };
  cabeca.next = cauda;
  const mapa = new Map();
  const desligar = (no) => { no.prev.next = no.next; no.next.prev = no.prev; };
  const naFrente = (no) => {
    no.next = cabeca.next; no.prev = cabeca;
    cabeca.next.prev = no; cabeca.next = no;
  };
  const resultados = [];
  for (let i = 0; i < operacoes.length; i++) {
    const [chave, valor] = argumentos[i];
    const no = mapa.get(chave);
    if (operacoes[i] === "get") {
      if (!no) { resultados.push(-1); continue; }
      desligar(no); naFrente(no);
      resultados.push(no.valor);
    } else if (no) {
      no.valor = valor;
      desligar(no); naFrente(no);
    } else {
      if (mapa.size === capacidade) {
        const velho = cauda.prev;             // usado há mais tempo
        desligar(velho);
        mapa.delete(velho.chave);
      }
      const novo = { chave, valor, prev: null, next: null };
      naFrente(novo);
      mapa.set(chave, novo);
    }
  }
  return resultados;
}
\`\`\`

Em Python, \`collections.OrderedDict\` já é um mapa com lista dupla por dentro (\`move_to_end\` e \`popitem(last=False)\`); numa entrevista, porém, espera-se que você saiba montar a estrutura. Um erro clássico é esquecer que atualizar uma chave existente também conta como uso.

**Custo.** O(1) por operação (O(q) no total, com q operações) e O(capacidade) de memória.`,
    complexity: { time: "O(1) por operação", space: "O(capacidade)" },
    followUps: [
      "Como implementar um cache LFU, que descarta a chave usada menos vezes (e, no empate, a usada há mais tempo), também em O(1)?",
      "E se cada chave tivesse um prazo de validade (TTL)? Como remover as expiradas sem varrer tudo?",
      "Como tornar o cache seguro para várias threads acessarem ao mesmo tempo, sem um único cadeado virar gargalo?"
    ]
  });
}

/** Heap de mínimo de números (o de máximo guarda os valores negados). */
class HeapMinimo {
  private readonly itens: number[] = [];
  get tamanho() {
    return this.itens.length;
  }
  topo() {
    return this.itens[0];
  }
  inserir(valor: number) {
    const itens = this.itens;
    let index = itens.push(valor) - 1;
    while (index > 0) {
      const pai = (index - 1) >> 1;
      if (itens[pai] <= valor) break;
      itens[index] = itens[pai];
      index = pai;
    }
    itens[index] = valor;
  }
  retirar() {
    const itens = this.itens;
    const topo = itens[0];
    const ultimo = itens.pop()!;
    const tamanho = itens.length;
    if (tamanho) {
      let index = 0;
      for (;;) {
        let filho = 2 * index + 1;
        if (filho >= tamanho) break;
        if (filho + 1 < tamanho && itens[filho + 1] < itens[filho]) filho += 1;
        if (itens[filho] >= ultimo) break;
        itens[index] = itens[filho];
        index = filho;
      }
      itens[index] = ultimo;
    }
    return topo;
  }
}

function simularMedianas(operacoes: string[], valores: number[]): number[] {
  const menores = new HeapMinimo(); // metade de baixo, negada: -topo é o máximo
  const maiores = new HeapMinimo(); // metade de cima
  const medianas: number[] = [];
  for (let index = 0; index < operacoes.length; index += 1) {
    if (operacoes[index] === "add") {
      const valor = valores[index];
      if (!menores.tamanho || valor <= -menores.topo()) menores.inserir(-valor);
      else maiores.inserir(valor);
      if (menores.tamanho > maiores.tamanho + 1) maiores.inserir(-menores.retirar());
      else if (maiores.tamanho > menores.tamanho) menores.inserir(-maiores.retirar());
      continue;
    }
    if (!menores.tamanho) throw new Error("mediana-em-fluxo: mediana pedida sem valores");
    medianas.push(menores.tamanho > maiores.tamanho ? -menores.topo() : (-menores.topo() + maiores.topo()) / 2);
  }
  return medianas;
}

function medianaEmFluxo(): Challenge {
  const random = createRandom(901001);
  const caso = (operacoes: string[], valores: number[]) => call([operacoes, valores], simularMedianas(operacoes, valores));
  const aleatorio = (total: number, min: number, max: number, chanceMediana: number) => {
    const operacoes: string[] = ["add"];
    while (operacoes.length < total) operacoes.push(random() < chanceMediana ? "median" : "add");
    const valores = operacoes.map((operacao) => (operacao === "add" ? randomInt(random, min, max) : 0));
    return caso(operacoes, valores);
  };
  /** Casos enormes em blocos: `blocos` vezes [adds, medianas], gerados pelo juiz. */
  let semente = 901011;
  const enorme = (blocos: number, adds: number, medianas: number, valoresSpec: (n: number) => Parameters<typeof gen>[0]) => {
    const parts: unknown[] = [];
    for (let index = 0; index < blocos; index += 1) {
      parts.push({ $gen: "repeat", n: adds, value: "add" }, { $gen: "repeat", n: medianas, value: "median" });
    }
    const operacoes = gen({ $gen: "concat", parts });
    const valores = gen(valoresSpec(blocos * (adds + medianas)));
    return call([operacoes.spec, valores.spec], simularMedianas(operacoes.value, valores.value));
  };

  return defineChallenge({
    slug: "mediana-em-fluxo",
    title: "Mediana em fluxo",
    difficulty: "hard",
    moduleId: moduleId("entrevista-dp-design"),
    position: 4,
    isBoss: true,
    checker: { kind: "tolerance", epsilon: 1e-6 },
    description: `Números chegam um de cada vez e, a qualquer momento, alguém pode perguntar a **mediana** de tudo o que chegou até ali. Implemente \`medianaEmFluxo(operacoes, valores)\`, que simula esse fluxo.

Os dois vetores têm o mesmo tamanho e andam juntos: \`operacoes[i]\` é \`"add"\` ou \`"median"\`.

- \`"add"\`: acrescenta \`valores[i]\` ao conjunto.
- \`"median"\`: pede a mediana do conjunto atual; \`valores[i]\` é ignorado nessa posição.

A mediana de uma quantidade ímpar de números é o do meio, depois de ordenados. Com uma quantidade par, é a **média dos dois do meio** (pode ter parte fracionária, como 2.5). Retorne um vetor com as medianas pedidas, na ordem. Toda consulta \`"median"\` acontece depois de pelo menos um \`"add"\`.

Exemplo: \`operacoes = ["add","add","median","add","median"]\` e \`valores = [4,1,0,9,0]\`. Depois de 4 e 1, a mediana é (1 + 4) / 2 = 2.5; depois de 9, os números são 1, 4, 9 e a mediana é 4. Resposta: \`[2.5, 4]\`.

As respostas são comparadas com tolerância de 10^-6. São até 2·10^5 inserções intercaladas com milhares de consultas: ordenar tudo a cada consulta é lento demais.`,
    constraints: [
      "1 <= `operacoes.length` <= 2,1·10^5",
      "-10^9 <= `valores[i]` <= 10^9",
      "A primeira operação é sempre \"add\".",
      "Cuidado: a soma dos dois valores do meio pode passar do limite de um int de 32 bits."
    ],
    tags: ["Heap", "Design"],
    functionSpec: {
      name: "medianaEmFluxo",
      params: [
        { name: "operacoes", type: "string[]" },
        { name: "valores", type: "int[]" }
      ],
      returns: "double[]"
    },
    publicCases: [
      caso(["add", "add", "median", "add", "median"], [4, 1, 0, 9, 0]),
      caso(["add", "median", "add", "add", "median"], [-5, 0, 10, -5, 0])
    ],
    hiddenCases: [
      caso(["add", "median"], [7, 0]),
      caso(["add", "add", "median"], [1000000000, 1000000000, 0]),
      caso(["add", "add", "median"], [-1000000000, -999999999, 0]),
      caso(["add", "add", "median", "add", "add", "median"], [-1000000000, 1000000000, 0, 3, 3, 0]),
      caso(["add", "add", "add", "add", "median", "median"], [2, 2, 2, 2, 0, 0]),
      caso(["add", "median", "add", "median", "add", "median", "add", "median"], [5, 0, 4, 0, 3, 0, 2, 0]),
      caso(["add", "add", "add", "add", "add", "median"], [1, 2, 3, 4, 5, 0]),
      aleatorio(30, -10, 10, 0.4),
      aleatorio(2000, -1000000000, 1000000000, 0.3),
      aleatorio(3000, 0, 5, 0.5),
      enorme(100, 2000, 30, (n) => ({ $gen: "ints", n, min: -1000000000, max: 1000000000, seed: semente++ })),
      enorme(50, 1000, 40, (n) => ({ $gen: "range", n, start: -100000 })),
      enorme(1, 20000, 5, (n) => ({ $gen: "ints", n, min: -1000000000, max: 1000000000, seed: semente++ })),
      enorme(40, 500, 10, (n) => ({ $gen: "ints", n, min: 0, max: 10, seed: semente++ })),
      enorme(20, 1000, 20, (n) => ({ $gen: "range", n, start: 5000000, step: -3 }))
    ],
    hints: [
      "A mediana só depende dos elementos do meio. Você não precisa da ordem completa: basta separar a metade de baixo da metade de cima.",
      "Guarde a metade de baixo num heap de máximo e a de cima num heap de mínimo. Os topos dos dois são exatamente os candidatos a mediana.",
      "A cada inserção, mantenha as duas regras: todo elemento de baixo é <= todo elemento de cima, e os tamanhos diferem no máximo em 1 (a metade de baixo pode ter um a mais). Inserir num heap e passar o topo para o outro resolve as duas."
    ],
    editorial: `**Ingênuas.** Guardar tudo num vetor e ordenar a cada consulta custa O(n log n) por mediana; com milhares de consultas sobre 2·10^5 números, são bilhões de operações. Manter o vetor sempre ordenado (inserção no lugar certo) deixa a consulta O(1), mas cada inserção desloca até n elementos: O(n²) no total.

**Ótima: dois heaps.** \`baixo\` é um heap de **máximo** com a metade menor; \`alto\` é um heap de **mínimo** com a metade maior. Invariantes: \`max(baixo) <= min(alto)\` e \`|baixo| = |alto|\` ou \`|alto| + 1\`.

Para inserir x: coloque em \`baixo\`, mova o topo de \`baixo\` para \`alto\` (isso garante a ordem entre as metades) e, se \`alto\` ficou maior, devolva o topo dele para \`baixo\`. A mediana é o topo de \`baixo\` (quantidade ímpar) ou a média dos dois topos (par).

\`\`\`python
import heapq

def medianaEmFluxo(operacoes, valores):
    baixo, alto = [], []   # baixo guarda valores negados (heap de máximo)
    medianas = []
    for op, x in zip(operacoes, valores):
        if op == "add":
            heapq.heappush(baixo, -x)
            heapq.heappush(alto, -heapq.heappop(baixo))
            if len(alto) > len(baixo):
                heapq.heappush(baixo, -heapq.heappop(alto))
        elif len(baixo) > len(alto):
            medianas.append(float(-baixo[0]))
        else:
            medianas.append((-baixo[0] + alto[0]) / 2)
    return medianas
\`\`\`

Em C, some os dois do meio como \`long long\` ou \`double\` antes de dividir: \`10^9 + 10^9\` estoura um \`int\`.

**Custo.** O(log n) por inserção, O(1) por consulta: O(n log n) no total, com O(n) de memória.`,
    complexity: { time: "O(log n) por inserção, O(1) por mediana", space: "O(n)" },
    followUps: [
      "Se todos os valores estivessem entre 0 e 100, como responder em O(1) por operação?",
      "E se, além de inserir, fosse preciso remover valores (mediana de uma janela deslizante)?",
      "Como generalizar para o percentil 90 em vez da mediana?"
    ]
  });
}

export function buildEntrevistasAvancadasChallenges(): Challenge[] {
  return [
    validarBst(),
    percursoPorNiveis(),
    menorAncestralComum(),
    numeroDeIlhas(),
    ordemDasTarefas(),
    subirEscada(),
    trocoMinimo(),
    maiorSubsequenciaCrescente(),
    cacheLru(),
    medianaEmFluxo()
  ];
}

