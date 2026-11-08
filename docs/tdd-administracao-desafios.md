# TDD da Administracao de Desafios

## Objetivo

Implementar o RF06 com autorizacao por papel e persistencia consistente. Administradores podem cadastrar, consultar, editar, desativar e reativar desafios, incluindo tags, exemplos, restricoes e casos de teste publicos ou privados.

## Red

Os testes foram escritos antes do modulo administrativo e falharam inicialmente com modulos ausentes e respostas HTTP 404.

Os cenarios definidos foram:

- responder 401 sem autenticacao e 403 para estudantes;
- atribuir `createdBy` a partir da sessao do administrador;
- exigir dados validos e ao menos um caso de teste;
- impedir slugs duplicados;
- criar desafio com tags e casos publicos e privados;
- substituir os relacionamentos durante a edicao;
- preservar id e criador na edicao;
- remover por desativacao, preservando dados relacionados;
- impedir acesso, comentario, avaliacao e submissao em desafio inativo;
- manter desafios inativos visiveis na listagem administrativa;
- respeitar o limite de desempenho do RNF03.

## Green

Foram implementados `AdminChallengeService`, `AdminRouter` e novos contratos no `CodeLabStore`. `InMemoryStore` e `PrismaStore` oferecem o mesmo comportamento. No PostgreSQL, desafio, tags e casos de teste sao escritos por uma unica operacao aninhada do Prisma.

Endpoints:

```txt
GET    /api/admin/challenges
GET    /api/admin/challenges/:challengeId
POST   /api/admin/challenges
PUT    /api/admin/challenges/:challengeId
DELETE /api/admin/challenges/:challengeId
```

## Refactor

A exclusao foi modelada como `isActive = false`. Isso evita apagar submissoes, resultados, comentarios, avaliacoes e pontuacoes. O mesmo desafio pode ser reativado pela edicao administrativa.

A interface HTML exibe o gerenciamento somente quando `/api/me` informa papel `admin`. Essa ocultacao e apenas ergonomica: a seguranca efetiva permanece no middleware do backend.

## Evidencias

```bash
npm test
npm run test:integration
npm run build
```

Os arquivos centrais de evidencia sao `admin-challenge.service.test.ts`, `server.admin.test.ts`, `server.performance.test.ts` e `prisma.integration.test.ts`.
