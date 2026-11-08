import type { LearningModule, Lesson, Track } from "../../domain/types.js";
import { LESSONS } from "./lessons/index.js";

interface ModuleDefinition {
  slug: string;
  title: string;
  objective: string;
  concept: string;
  estimatedMinutes: number;
  prerequisites?: string[];
}

interface TrackDefinition {
  slug: string;
  title: string;
  description: string;
  modules: ModuleDefinition[];
}

export const moduleId = (slug: string) => `mod-${slug}`;

const TRACKS: TrackDefinition[] = [
  {
    slug: "fundamentos",
    title: "Fundamentos de Programação",
    description:
      "Do primeiro programa às strings: entrada e saída, decisões, repetições, funções, vetores e matrizes. Cada módulo tem uma lição curta e desafios em JavaScript, Python e C.",
    modules: [
      {
        slug: "entrada-saida",
        title: "Entrada, saída e operadores",
        objective: "Ler valores, calcular com operadores aritméticos e devolver o resultado certo.",
        concept: "Tipos numéricos, divisão inteira, resto e precedência de operadores.",
        estimatedMinutes: 40
      },
      {
        slug: "condicionais",
        title: "Condicionais",
        objective: "Tomar decisões com if/else e combinar condições.",
        concept: "Operadores relacionais e lógicos, casos de borda e ordem das comparações.",
        estimatedMinutes: 45,
        prerequisites: ["entrada-saida"]
      },
      {
        slug: "lacos",
        title: "Laços",
        objective: "Repetir cálculos com for e while até uma condição de parada.",
        concept: "Acumuladores, contadores, condição de parada e laços aninhados.",
        estimatedMinutes: 60,
        prerequisites: ["condicionais"]
      },
      {
        slug: "funcoes",
        title: "Funções",
        objective: "Quebrar um problema em funções pequenas, com parâmetros e retorno.",
        concept: "Parâmetros, retorno, escopo e funções auxiliares.",
        estimatedMinutes: 45,
        prerequisites: ["lacos"]
      },
      {
        slug: "vetores",
        title: "Vetores",
        objective: "Guardar e percorrer coleções de valores.",
        concept: "Índices, percurso, busca do maior/menor, contagem e inversão.",
        estimatedMinutes: 60,
        prerequisites: ["lacos"]
      },
      {
        slug: "matrizes",
        title: "Matrizes",
        objective: "Trabalhar com tabelas de valores em duas dimensões.",
        concept: "Linhas e colunas, diagonais, transposição e percursos em grade.",
        estimatedMinutes: 60,
        prerequisites: ["vetores"]
      },
      {
        slug: "strings",
        title: "Strings",
        objective: "Manipular textos caractere a caractere.",
        concept: "Percurso de caracteres, códigos ASCII, contagem de letras e palíndromos.",
        estimatedMinutes: 60,
        prerequisites: ["vetores"]
      }
    ]
  },
  {
    slug: "estrutura-de-dados",
    title: "Estrutura de Dados",
    description:
      "As estruturas clássicas implementadas em C, como na disciplina: recursão, complexidade, busca, ordenação, ponteiros, listas, pilhas, filas, hash, árvores, heaps e grafos.",
    modules: [
      {
        slug: "recursividade",
        title: "Recursividade",
        objective: "Resolver problemas definindo a resposta em termos de versões menores do mesmo problema.",
        concept: "Caso base, chamada recursiva, pilha de chamadas e custo da recursão.",
        estimatedMinutes: 60,
        prerequisites: ["funcoes"]
      },
      {
        slug: "complexidade",
        title: "Complexidade de algoritmos",
        objective: "Estimar o custo de um algoritmo e escolher uma solução que caiba no tempo limite.",
        concept: "Notação O, O(n²) contra O(n log n) contra O(n) e o tamanho da entrada.",
        estimatedMinutes: 50,
        prerequisites: ["recursividade"]
      },
      {
        slug: "busca",
        title: "Busca",
        objective: "Encontrar valores em vetores com busca sequencial e binária.",
        concept: "Busca binária, invariantes do intervalo e variações (primeira ocorrência, limite inferior).",
        estimatedMinutes: 60,
        prerequisites: ["complexidade"]
      },
      {
        slug: "ordenacao",
        title: "Ordenação",
        objective: "Implementar os métodos de ordenação clássicos e entender quando usar cada um.",
        concept: "Bubble, Insertion, Selection, Merge, Quick e Counting Sort; estabilidade e custo.",
        estimatedMinutes: 90,
        prerequisites: ["complexidade"]
      },
      {
        slug: "ponteiros",
        title: "Ponteiros e memória",
        objective: "Usar ponteiros e alocação dinâmica em C com segurança.",
        concept: "Endereços, aritmética de ponteiros, malloc/free e passagem por referência.",
        estimatedMinutes: 60,
        prerequisites: ["recursividade"]
      },
      {
        slug: "listas-estaticas",
        title: "Listas estáticas",
        objective: "Representar listas em vetores de tamanho fixo, homogêneas e heterogêneas.",
        concept: "Vetores de structs, inserção e remoção com deslocamento.",
        estimatedMinutes: 45,
        prerequisites: ["ponteiros"]
      },
      {
        slug: "listas-encadeadas",
        title: "Listas encadeadas",
        objective: "Construir listas simples, duplas e circulares com nós alocados dinamicamente.",
        concept: "Nó com ponteiro para o próximo (e para o anterior), inserção, remoção e percurso.",
        estimatedMinutes: 90,
        prerequisites: ["listas-estaticas"]
      },
      {
        slug: "pilhas",
        title: "Pilhas",
        objective: "Usar a pilha (LIFO) para inverter, validar e avaliar expressões.",
        concept: "Empilhar, desempilhar, topo; parênteses balanceados e notação pós-fixa.",
        estimatedMinutes: 60,
        prerequisites: ["listas-encadeadas"]
      },
      {
        slug: "filas",
        title: "Filas e deque",
        objective: "Modelar atendimento em ordem (FIFO) e filas circulares.",
        concept: "Enfileirar, desenfileirar, fila circular em vetor e deque.",
        estimatedMinutes: 60,
        prerequisites: ["pilhas"]
      },
      {
        slug: "hash",
        title: "Tabelas hash",
        objective: "Consultar e contar em tempo constante médio.",
        concept: "Função de hash, colisões por encadeamento e tabela de frequência.",
        estimatedMinutes: 60,
        prerequisites: ["listas-encadeadas"]
      },
      {
        slug: "arvores",
        title: "Árvores",
        objective: "Construir e percorrer árvores binárias e árvores binárias de busca.",
        concept: "Nós com filhos, percursos (pré, em e pós-ordem, por níveis), altura e BST.",
        estimatedMinutes: 90,
        prerequisites: ["recursividade", "filas"]
      },
      {
        slug: "heaps",
        title: "Heaps e fila de prioridade",
        objective: "Sempre obter o menor (ou maior) elemento de forma eficiente.",
        concept: "Heap binário em vetor, subir e descer, heapsort e os K maiores.",
        estimatedMinutes: 60,
        prerequisites: ["arvores"]
      },
      {
        slug: "grafos",
        title: "Grafos",
        objective: "Representar conexões e percorrer grafos para responder perguntas de caminho.",
        concept: "Lista de adjacência, BFS, DFS, componentes conexos e Dijkstra.",
        estimatedMinutes: 120,
        prerequisites: ["filas", "heaps"]
      }
    ]
  },
  {
    slug: "algoritmos",
    title: "Algoritmos e Padrões",
    description:
      "Os padrões que resolvem a maioria dos problemas: dois ponteiros, janela deslizante, prefixo acumulado, guloso, backtracking, programação dinâmica e bits.",
    modules: [
      {
        slug: "dois-ponteiros",
        title: "Dois ponteiros",
        objective: "Percorrer um vetor com dois índices para evitar laços aninhados.",
        concept: "Ponteiros nas pontas, leitura e escrita no mesmo vetor, vetores ordenados.",
        estimatedMinutes: 45,
        prerequisites: ["vetores"]
      },
      {
        slug: "janela-deslizante",
        title: "Janela deslizante",
        objective: "Analisar subvetores contíguos sem recalcular tudo a cada passo.",
        concept: "Janela de tamanho fixo e variável, soma móvel e contagem dentro da janela.",
        estimatedMinutes: 50,
        prerequisites: ["dois-ponteiros"]
      },
      {
        slug: "prefixo",
        title: "Prefixo acumulado",
        objective: "Responder somas de intervalos em tempo constante.",
        concept: "Vetor de prefixos, soma de intervalo e prefixo com hash.",
        estimatedMinutes: 45,
        prerequisites: ["vetores"]
      },
      {
        slug: "guloso",
        title: "Algoritmos gulosos",
        objective: "Construir a resposta com a melhor escolha local, quando ela leva ao ótimo.",
        concept: "Critério de escolha, ordenação prévia e contraexemplos.",
        estimatedMinutes: 50,
        prerequisites: ["ordenacao"]
      },
      {
        slug: "backtracking",
        title: "Backtracking",
        objective: "Explorar todas as possibilidades descartando caminhos inválidos cedo.",
        concept: "Escolher, explorar e desfazer; subconjuntos, permutações e poda.",
        estimatedMinutes: 60,
        prerequisites: ["recursividade"]
      },
      {
        slug: "programacao-dinamica",
        title: "Programação dinâmica",
        objective: "Evitar recalcular subproblemas guardando resultados.",
        concept: "Estado, transição, memoização e tabela (1D, 2D e mochila).",
        estimatedMinutes: 120,
        prerequisites: ["recursividade"]
      },
      {
        slug: "bits",
        title: "Manipulação de bits",
        objective: "Resolver problemas com operações bit a bit.",
        concept: "AND, OR, XOR, deslocamentos, máscaras e contagem de bits.",
        estimatedMinutes: 40,
        prerequisites: ["entrada-saida"]
      }
    ]
  },
  {
    slug: "entrevistas",
    title: "Preparação para Entrevistas",
    description:
      "Problemas clássicos de entrevistas técnicas, com enunciados originais, dicas progressivas, complexidade esperada e solução comentada liberada depois da resolução.",
    modules: [
      {
        slug: "entrevista-vetores-hash",
        title: "Vetores e hash",
        objective: "Os problemas de vetor mais cobrados, quase sempre resolvidos com uma passada e um mapa.",
        concept: "Complemento com hash, contagem de frequência e produto de prefixo e sufixo.",
        estimatedMinutes: 60,
        prerequisites: ["hash"]
      },
      {
        slug: "entrevista-strings-janelas",
        title: "Strings e janelas",
        objective: "Substrings e subvetores sob restrição, com dois ponteiros e janela deslizante.",
        concept: "Janela variável com mapa de últimas posições e soma máxima de subvetor.",
        estimatedMinutes: 60,
        prerequisites: ["janela-deslizante"]
      },
      {
        slug: "entrevista-pilhas-intervalos",
        title: "Pilhas, busca binária e intervalos",
        objective: "Validação com pilha, busca binária em vetor rotacionado e fusão de intervalos.",
        concept: "Invariantes de pilha, metade ordenada e ordenação por início.",
        estimatedMinutes: 60,
        prerequisites: ["pilhas", "busca"]
      },
      {
        slug: "entrevista-listas",
        title: "Listas encadeadas",
        objective: "Inverter, detectar ciclos e mesclar listas com ponteiros.",
        concept: "Três ponteiros, lebre e tartaruga (Floyd) e nó sentinela.",
        estimatedMinutes: 60,
        prerequisites: ["listas-encadeadas"]
      },
      {
        slug: "entrevista-arvores",
        title: "Árvores",
        objective: "Validar BST, percorrer por níveis e encontrar o menor ancestral comum.",
        concept: "Limites herdados, fila por níveis e descida guiada pela ordenação.",
        estimatedMinutes: 60,
        prerequisites: ["arvores"]
      },
      {
        slug: "entrevista-grafos",
        title: "Grafos",
        objective: "Ilhas em grade e ordem de tarefas com dependências.",
        concept: "Flood fill com DFS/BFS e ordenação topológica (Kahn).",
        estimatedMinutes: 60,
        prerequisites: ["grafos"]
      },
      {
        slug: "entrevista-dp-design",
        title: "Programação dinâmica e design",
        objective: "Escadas, troco, subsequência crescente, cache LRU e mediana em fluxo.",
        concept: "Recorrências clássicas, mapa + lista dupla e dois heaps.",
        estimatedMinutes: 90,
        prerequisites: ["programacao-dinamica", "heaps"]
      }
    ]
  }
];

export function buildTracks(): Track[] {
  const slugToId = new Map<string, string>();
  TRACKS.forEach((track) => track.modules.forEach((module) => slugToId.set(module.slug, moduleId(module.slug))));

  return TRACKS.map((track, trackIndex) => ({
    id: `track-${track.slug}`,
    slug: track.slug,
    title: track.title,
    description: track.description,
    position: trackIndex,
    modules: track.modules.map((module, moduleIndex): LearningModule => {
      const id = moduleId(module.slug);
      const lessons: Lesson[] = (LESSONS[module.slug] ?? []).map((lesson, lessonIndex) => ({
        id: `lesson-${lesson.slug}`,
        moduleId: id,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        content: lesson.content.trim(),
        estimatedMinutes: lesson.estimatedMinutes ?? 10,
        position: lessonIndex
      }));
      return {
        id,
        trackId: `track-${track.slug}`,
        slug: module.slug,
        title: module.title,
        objective: module.objective,
        concept: module.concept,
        estimatedMinutes: module.estimatedMinutes,
        position: moduleIndex,
        prerequisiteIds: (module.prerequisites ?? []).map((slug) => {
          const prerequisite = slugToId.get(slug);
          if (!prerequisite) throw new Error(`Pre-requisito desconhecido: ${slug}`);
          return prerequisite;
        }),
        lessons
      };
    })
  }));
}
