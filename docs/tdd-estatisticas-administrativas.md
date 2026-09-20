# TDD das Estatisticas Administrativas

## Objetivo

Implementar o RF07 com indicadores reproduziveis e acesso exclusivo de administradores. O painel apresenta um retrato atual da plataforma, sem expor codigo submetido ou detalhes dos casos de teste.

## Definicao das metricas

- taxa de aceite: submissoes aceitas divididas pelo total de submissoes;
- taxa de erro: submissoes nao aceitas divididas pelo total de submissoes;
- participante: usuario distinto que submeteu ao menos uma vez;
- solucionador: usuario distinto com ao menos uma submissao aceita;
- media de avaliacao: soma das notas dividida pela quantidade de avaliacoes;
- percentuais e medias: arredondados para uma casa decimal;
- desafios inativos: permanecem nas estatisticas para preservar a leitura historica.

## Red

Os testes foram escritos antes da funcao de dominio e do endpoint. A primeira execucao falhou com modulo ausente e respostas 404.

Os cenarios especificados foram:

- calcular totais de usuarios por papel e desafios por estado;
- distribuir submissoes por todos os status;
- evitar divisao por zero;
- contar participantes e solucionadores sem duplicidade;
- agregar por desafio, dificuldade e usuario;
- destacar o desafio mais resolvido e a maior taxa de erro;
- responder 401 sem sessao e 403 para estudantes;
- nao expor codigo-fonte, identificadores de casos ou entradas privadas;
- reproduzir os calculos com dados reais do PostgreSQL;
- responder dentro do limite academico de dois segundos.

## Green

`buildAdminStatistics` concentra as formulas. `InMemoryStore` e `PrismaStore` fornecem somente os campos necessarios: usuario, papel, pontuacao, relacionamentos, status e notas. `AdminStatisticsService` gera o retrato e adiciona o horario da consulta.

Endpoint:

```txt
GET /api/admin/statistics
```

## Refactor

A coleta do Prisma usa consultas paralelas e selecoes restritas. Nao sao carregados `sourceCode`, resultados de teste, entradas, saidas esperadas ou erros de execucao. A mesma funcao de dominio calcula dados da memoria e do PostgreSQL, reduzindo divergencias.

## Evidencias

```bash
npm test
npm run test:integration
npm run test:coverage
npm run build
```

Os testes centrais sao `admin-statistics.test.ts`, `server.statistics.test.ts`, `server.performance.test.ts` e `prisma.integration.test.ts`.
