# Code Lab

Plataforma de estudo de programação com correção automática no estilo LeetCode: trilhas com lições, desafios em JavaScript, Python e C, juiz isolado que mostra o primeiro caso que falhou, ranking, turmas para professores e ferramentas para criar desafios.

- **Conteúdo:** 4 trilhas, 34 módulos, 34 lições e 174 desafios (3.403 casos de teste). Cada desafio tem pelo menos 2 casos públicos e 12 ocultos; os que cobram complexidade usam entradas de até 200 mil elementos.
- **Linguagens:** C em todos os desafios; JavaScript e Python em 147. Dos 174, 146 são no modo função (o aluno implementa só a função, como no LeetCode) e 28 no modo entrada/saída (os exercícios de C da disciplina).
- **Stack:** Node.js 22+ (TypeScript 5, Express 5, Zod), PostgreSQL 16 com Prisma 6, frontend em HTML, CSS e módulos ES sem etapa de build, Vitest e Supertest. O juiz usa bubblewrap, unshare, prlimit, seccomp, gcc e python3.

## Sumário

- [Estrutura](#estrutura)
- [Como rodar](#como-rodar)
- [Trilhas e desafios](#trilhas-e-desafios)
- [Juiz](#juiz)
- [Funcionalidades](#funcionalidades)
- [API](#api)
- [Testes](#testes)
- [Produção](#produção)
- [Documentação](#documentação)

## Estrutura

```txt
code-lab-project/
  apps/
    api/
      prisma/                    # schema, migrations e seed
      src/
        database/catalog/        # trilhas, módulos, lições e desafios (gerados de forma determinística)
        modules/submissions/     # juiz: sandbox, harness do modo função, comparadores, regras de código
        modules/…                # auth, conta, turmas, estatísticas, admin, observabilidade
    web/public/                  # SPA (hash routing, sem build)
  desafios/<slug>/               # solução correta e tentativas de burla de cada desafio
  docs/                          # segurança, deploy, TDD e rastreabilidade do RFC
  compose.yaml                   # PostgreSQL local
  compose.prod.yaml, Dockerfile  # produção
  .github/workflows/ci.yml       # CI
```

## Como rodar

Pré-requisitos: Linux, Node.js 22 ou superior, Docker com Compose e, para o juiz, `bubblewrap`, `gcc`, `python3` e `util-linux` (`unshare`, `prlimit`).

```bash
npm install
docker compose up -d postgres
npm run db:migrate:deploy
npm run db:seed        # catálogo e contas de demonstração (pode rodar mais de uma vez)
npm run dev            # http://localhost:3333
```

O seed atualiza trilhas e desafios sem apagar usuários, submissões ou pontuações.

### Contas de demonstração

| Papel | E-mail | Senha |
|---|---|---|
| Estudante | `marina@codelab.local` | `123456` |
| Administrador (professor) | `admin@codelab.local` | `admin123` |

Novos cadastros são sempre estudantes.

### Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `PORT` | porta HTTP (padrão 3333) |
| `JWT_SECRET` | obrigatório em produção, com 32+ caracteres |
| `NODE_ENV` | `development`, `test` ou `production` |
| `WEB_ORIGIN` | origens aceitas pelo CORS |
| `APP_URL` | endereço público usado nos links dos e-mails |
| `MAIL_WEBHOOK_URL`, `MAIL_WEBHOOK_TOKEN` | entrega de e-mails (POST JSON `{to, subject, text}`); sem eles, os e-mails vão para o log |
| `METRICS_TOKEN` | protege `GET /metrics` (em produção, sem token a rota não existe) |
| `JUDGE_CONCURRENCY` | avaliações simultâneas (padrão: metade dos núcleos) |
| `LOG_REQUESTS=0` | desliga o log JSON por requisição |
| `CODELAB_CATALOG_CACHE=0` | desliga o cache em disco do catálogo |

## Trilhas e desafios

| Trilha | Módulos | Desafios |
|---|---|---|
| Fundamentos de Programação | entrada e saída, condicionais, laços, funções, vetores, matrizes, strings | 43 |
| Estrutura de Dados (em C) | recursividade, complexidade, busca, ordenação, ponteiros, listas estáticas e encadeadas, pilhas, filas, hash, árvores, heaps, grafos | 73 |
| Algoritmos e Padrões | dois ponteiros, janela deslizante, prefixo, guloso, backtracking, programação dinâmica, bits | 35 |
| Preparação para Entrevistas | vetores e hash, strings e janelas, pilhas e intervalos, listas, árvores, grafos, PD e design (LRU, mediana em fluxo) | 23 |

Cada módulo tem uma lição curta, desafios em dificuldade crescente e um desafio final ("chefe"). Os desafios de entrevista têm 3 dicas progressivas, complexidade esperada, solução comentada e perguntas de acompanhamento. Os 17 exercícios de C vieram do repositório da disciplina ([Exercicios-Estrutura-de-Dados](https://github.com/leonsnw/Exercicios-Estrutura-de-Dados)), adaptados para leitura da entrada padrão.

Os desafios são definidos em TypeScript (`apps/api/src/database/catalog/`), com casos gerados por PRNG determinístico. Casos enormes usam argumentos gerados (`{"$gen": "ints", "n": 200000, …}`): o caso guardado fica pequeno e o juiz expande a entrada na hora de executar. O catálogo montado fica em cache em `node_modules/.cache/codelab/`, com a chave tirada do conteúdo das fontes.

### Pasta `desafios/`

Cada desafio tem uma pasta com `solucao.js`, `solucao.py` e `solucao.c` (conforme as linguagens aceitas) e pelo menos uma `burla.*`: uma tentativa de enganar o juiz, como decorar os exemplos, usar um algoritmo ingênuo lento demais ou um atalho proibido. A primeira linha de cada arquivo anuncia o veredito esperado. `apps/api/src/desafios-exemplo.test.ts` roda os 684 arquivos pelo juiz. Ele confere que toda solução é aceita, que toda burla recebe o veredito anunciado e que as burlas de resposta errada passam nos exemplos públicos.

### Lint de conteúdo

`catalog-lint.test.ts` exige de todo desafio: enunciado, restrições, dicas, solução comentada, número mínimo de casos, saídas abaixo de 48 KB e português com acentos. Exige de todo módulo: lição, posições contínuas e um único chefe no fim.

## Juiz

- **Modos:**
  - **Entrada/saída:** o programa lê stdin e imprime.
  - **Função:** o harness chama a função do aluno com os argumentos do caso e compara o valor retornado.
- **Tipos no modo função:** `int`, `long`, `double`, `bool`, `string`, vetores, matriz, `ListNode` (lista, inclusive com ciclo) e `TreeNode` (árvore em ordem de níveis). Em C, a convenção é a do LeetCode (`int* nums, int numsSize, int* returnSize`).
- **Comparadores:** saída exata, tolerância numérica, linhas ou valores em qualquer ordem e verificador personalizado.
- **Veredito:**
  - Os exemplos rodam primeiro e a avaliação para no primeiro caso que falha.
  - A resposta mostra entrada, esperado e obtido desse caso, mesmo que seja oculto.
  - Os erros vêm traduzidos: linha do erro de compilação, UBSan, segfault e recursão sem caso base.
  - "Executar" roda só os exemplos e não conta tentativa.
- **Regras de código:** proibir ou exigir construções (sem ordenação pronta, `malloc` obrigatório, recursão). Comentários e textos entre aspas não contam. Em C, a profundidade real da recursão é medida durante a execução.
- **Isolamento:**
  - JavaScript roda com `unshare` e `node --permission`.
  - C e Python rodam em `bwrap` sem rede, com `/usr` só leitura, `/tmp` próprio e ambiente limpo, mais `prlimit` e um filtro seccomp.
  - Há limites de tempo, memória e saída, e uma fila global (`JUDGE_CONCURRENCY`).

Detalhes, ameaças e riscos residuais em [docs/seguranca-avaliacao.md](docs/seguranca-avaliacao.md).

## Funcionalidades

- **Estudante:**
  - trilhas com roteiro e próximo passo sugerido;
  - editor com realce, fechamento de parênteses, `Ctrl+/`, busca, painéis redimensionáveis e tela cheia;
  - dicas e solução comentada;
  - comparação entre duas submissões;
  - tempo comparado com as outras soluções aceitas;
  - discussão em Markdown com `||spoiler||`.
- **Engajamento:** sequência de dias, mapa de atividade, conquistas, ranking por período e por trilha, e perfil público (sem e-mail).
- **Conta:**
  - verificação de e-mail e recuperação de senha por link;
  - edição do nome e troca de senha, que encerra as outras sessões;
  - exportação dos dados e exclusão da conta (LGPD);
  - sessão renovada durante o uso.
- **Professor (admin):**
  - editor de desafios com rascunho e publicação;
  - pré-visualização como estudante;
  - validação de soluções de referência e burlas contra os casos;
  - gerador de casos que tira o gabarito da solução de referência;
  - estatísticas com o tipo de erro mais comum por desafio;
  - turmas com código de acesso, progresso por estudante e exportação CSV.
- **Interface:**
  - tema claro e escuro;
  - busca rápida (`Ctrl+K`) e atalhos (`?`);
  - esqueletos de carregamento, páginas de erro e onboarding;
  - termos de uso e política de privacidade.

## API

| Método e rota | Acesso | Descrição |
|---|---|---|
| `GET /health` (`?detalhes` inclui o juiz) | público | saúde |
| `GET /metrics` | token | métricas Prometheus |
| `POST /api/auth/register`, `/login`, `/logout` | público / sessão | autenticação por cookie HttpOnly |
| `POST /api/auth/forgot-password`, `/reset-password`, `/verify-email` | público | recuperação de senha e verificação |
| `GET /api/me`, `PATCH /api/me`, `DELETE /api/me` | sessão | perfil, edição, exclusão |
| `PUT /api/me/password`, `GET /api/me/export`, `GET /api/me/account`, `POST /api/me/verification` | sessão | senha, exportação LGPD, estado da conta |
| `GET /api/me/activity` | sessão | sequência, mapa de atividade e conquistas |
| `GET /api/users/:id/profile` | público | perfil público |
| `GET /api/tracks`, `/api/tracks/progress`, `/api/lessons/:slug`, `POST /api/lessons/:slug/complete` | público / sessão | trilhas e lições |
| `GET /api/challenges`, `/api/challenges/:slug` | público / sessão | catálogo e detalhe |
| `POST /api/challenges/:slug/run`, `/submissions` | sessão | executar e enviar |
| `POST /api/challenges/:slug/hints`, `/solution` | sessão | dicas e solução comentada |
| `GET /api/challenges/:slug/runtime` | sessão | distribuição de tempos das aceitas |
| `GET/POST /api/challenges/:slug/comments`, `GET/PUT …/rating` | sessão | discussão e avaliação |
| `GET /api/submissions` | sessão | histórico (`?status=`) |
| `GET /api/ranking?periodo=semana\|mes\|tudo&trilha=` | público | ranking |
| `POST /api/classes/join`, `GET /api/me/classes`, `DELETE /api/me/classes/:id` | sessão | turmas do estudante |
| `/api/admin/challenges` (CRUD), `POST …/validate`, `POST …/generate-cases` | admin | desafios e ferramentas |
| `/api/admin/classes` (CRUD), `GET …/:id/export.csv` | admin | turmas |
| `GET /api/admin/statistics` | admin | estatísticas |

## Testes

```bash
npm test                 # unidade, HTTP, juiz, catálogo e desafios/ (sem banco)
npm run test:integration # PostgreSQL real (use um banco descartável)
npm run test:coverage
```

Sem `bwrap`, `gcc` ou `python3`, os testes que dependem deles são pulados.

## Produção

`Dockerfile` e `compose.prod.yaml` sobem a API (com o juiz) e o PostgreSQL. O contêiner da API roda como usuário sem privilégios, sem capabilities e com sistema de arquivos só leitura. A CI (`.github/workflows/ci.yml`) roda build, testes, migrations do zero com verificação de drift, integração com PostgreSQL e o build da imagem. Passo a passo em [docs/deploy.md](docs/deploy.md).

## Documentação

- [docs/deploy.md](docs/deploy.md): implantação, e-mail, métricas e backup.
- [docs/seguranca-avaliacao.md](docs/seguranca-avaliacao.md): isolamento do juiz, ameaças e riscos residuais.
- [docs/rfc-matriz-rastreabilidade.md](docs/rfc-matriz-rastreabilidade.md): requisitos do RFC, implementação e testes.
- `docs/tdd-*.md`: ciclos de TDD de autenticação, comentários, administração e estatísticas.
