# Matriz de Rastreabilidade do RFC

## Escopo desta consolidacao

Esta matriz diferencia requisitos concluidos no backend, requisitos preparados e requisitos ainda nao iniciados. A interface visual permanece provisoria por decisao do projeto, sem transferir regras de negocio para o navegador.

## Requisitos funcionais

| Requisito | Estado | Implementacao | Evidencia |
|---|---|---|---|
| RF01 - Cadastro e autenticacao | Conforme no backend | AuthService, bcrypt, JWT em cookie HttpOnly, guards e PrismaStore | `auth.service.test.ts`, `jwt-token.service.test.ts`, `auth.middleware.test.ts`, `server.auth.test.ts` |
| RF02 - Desafios por dificuldade | Conforme no backend | ChallengeRouter e filtro tipado por `easy`, `medium` e `hard` | `server.challenge.test.ts` e seed com desafios easy/medium |
| RF03 - Submissao e resultado por testes | Conforme no backend | SubmissionService, estado pending, avaliador restrito e resultados publicos/privados | `submission.service.test.ts`, `submission-evaluation.service.test.ts`, `submission.presenter.test.ts` |
| RF04 - Calculo e exibicao de pontos | Conforme no backend | ScoreService e conclusao serializavel no PrismaStore | `score.service.test.ts`, teste concorrente unitario e `prisma.integration.test.ts` |
| RF05 - Comentarios e avaliacoes | Conforme | CommentService e RatingService, autoria pela sessao, voto unico atualizavel e media agregada | `comment.service.test.ts`, `rating.service.test.ts`, `server.community.test.ts` e `prisma.integration.test.ts` |
| RF06 - Administracao de desafios | Conforme | AdminChallengeService, rotas exclusivas de admin, edicao atomica de tags/casos e remocao logica | `admin-challenge.service.test.ts`, `server.admin.test.ts` e `prisma.integration.test.ts` |
| RF07 - Estatisticas administrativas | Conforme | AdminStatisticsService, formula de dominio e painel geral, por desafio, dificuldade e usuario | `admin-statistics.test.ts`, `server.statistics.test.ts`, `server.performance.test.ts` e `prisma.integration.test.ts` |
| RF08 - Historico de submissoes | Conforme no backend | Historico sempre filtrado pelo usuario autenticado e casos privados mascarados | `server.auth.test.ts`, `submission.presenter.test.ts` |
| RF09 - Perfil e progresso | Conforme no backend | `/api/me` retorna score, resolvidos, pendentes e progresso por dificuldade | `server.auth.test.ts` e `prisma.integration.test.ts` |

## Requisitos nao funcionais

| Requisito | Estado | Implementacao | Evidencia |
|---|---|---|---|
| RNF01 - TDD nas regras principais | Conforme | Testes escritos antes das implementacoes de autenticacao, sandbox, privacidade, concorrencia e RF05 | Suite Vitest e documentos de TDD |
| RNF02 - Proteger rotas administrativas | Conforme | Middleware exige autenticacao e papel admin em todo o router de gerenciamento e estatisticas | `auth.middleware.test.ts`, `server.admin.test.ts` e `server.statistics.test.ts` |
| RNF03 - Requisicoes comuns em ate 2 segundos | Conforme no ambiente controlado | Testes para health, catalogo, ranking, cadastro, perfil, comunidade, administracao e estatisticas | `server.performance.test.ts` e `prisma.integration.test.ts` |
| RNF04 - Arquitetura modular | Conforme no nucleo | Routers separados para Auth, User, Challenge, Submission, Ranking, Comment, Rating e Admin; dominio e stores independentes | Estrutura `src/modules` e `src/domain` |
| RNF05 - Validacao de entradas | Conforme no escopo atual | Zod em cadastro, login, filtros, submissao, comentarios, avaliacoes e administracao | Testes de service e HTTP |
| RNF06 - Hash seguro de senha | Conforme | bcrypt com custo 10 e coluna obrigatoria no PostgreSQL | Testes de AuthService e integracao Prisma |
| RNF07 - Data e hora das submissoes | Conforme | `submittedAt` obrigatorio e `evaluatedAt` preenchido na conclusao | Testes de SubmissionService e integracao Prisma |
| RNF08 - Interface responsiva | Provisoria | CSS possui adaptacao basica; refinamento visual foi explicitamente adiado | Validacao visual futura |
| RNF09 - Separacao interface/regras | Conforme | Navegador apenas chama API; avaliacao, score, progresso e autorizacao ficam no backend | Estrutura modular e testes HTTP |

## Garantias adicionais da consolidacao

- codigo submetido nao recebe segredos da API;
- filesystem e subprocessos ficam bloqueados pelo Node, enquanto a rede fica isolada por namespace Linux;
- memoria, saida e tempo possuem limites;
- casos privados nao sao serializados na resposta;
- pontuacao usa transacao serializavel e repeticao em conflito;
- migrations foram aplicadas e verificadas em banco vazio;
- seed pode rodar repetidamente sem apagar dados de usuarios;
- JWT_SECRET e obrigatorio em producao;
- sessao do navegador usa cookie HttpOnly;
- autenticacao possui rate limit e CORS configuravel.
- desafios removidos ficam inativos e preservam o historico relacionado;
- estudante nao recebe casos privados nem acessa operacoes administrativas.
- estatisticas nao carregam nem serializam codigo-fonte ou resultados privados;
- participantes e solucionadores sao contados de forma unica por desafio.

## Limitacoes conhecidas

- a linhagem de migrations foi consolidada: `20260805150000_authentication` foi substituida por `20260804200000_initial`, que cria todo o esquema. Bancos criados pela branch `teste` exigem recriacao ou `prisma migrate reset`;
- a avaliacao de codigo executa em processo restrito iniciado pelo host da API, e nao em container descartavel. O detalhamento e a evolucao prevista estao em `seguranca-avaliacao.md`;
- o avaliador depende de `unshare` do Linux. Sem esse binario a submissao falha como `runtime_error`, sem execucao sem isolamento;
- apenas JavaScript esta disponivel como linguagem de submissao;
- a avaliacao ocorre de forma sincrona no ciclo da requisicao, o que limita a concorrencia antes da adocao do worker;
- a interface web permanece provisoria e serve apenas a verificacao manual.

## Comandos de evidencia

```bash
npm test
npm run test:integration
npm run test:coverage
npm run build
npm run db:migrate:status
```

Um requisito so muda para `Conforme` quando possui implementacao, validacao, tratamento de erro e evidencia automatizada correspondente.
