# TDD de Comentarios e Avaliacoes

## Objetivo

Implementar o RF05 sem colocar regras de negocio no navegador. Comentarios e avaliacoes pertencem ao usuario autenticado, sao persistidos no PostgreSQL e podem ser consultados no contexto de um desafio.

## Red

Os testes foram criados antes dos modulos. A primeira execucao falhou porque `CommentService`, `RatingService` e as quatro rotas do RF05 ainda nao existiam.

Os cenarios especificados foram:

- normalizar o texto e obter a autoria exclusivamente da sessao;
- rejeitar comentario vazio ou acima de 1.000 caracteres;
- devolver erro 404 para desafio inexistente;
- listar comentarios do mais recente para o mais antigo;
- aceitar somente notas inteiras entre 1 e 5;
- substituir o voto anterior do mesmo usuario;
- calcular media, total e voto do usuario atual;
- exigir autenticacao para leitura e escrita;
- comprovar persistencia e unicidade no PostgreSQL real.

## Green

Foram adicionados os modulos `comments` e `ratings`, contratos no `CodeLabStore` e implementacoes equivalentes em `InMemoryStore` e `PrismaStore`. A restricao composta `userId + challengeId` do Prisma sustenta a unicidade da avaliacao.

Endpoints implementados:

```txt
GET  /api/challenges/:slug/comments
POST /api/challenges/:slug/comments
GET  /api/challenges/:slug/rating
PUT  /api/challenges/:slug/rating
```

## Refactor

As rotas ficaram responsaveis por HTTP e validacao estrutural com Zod. Os servicos concentram as regras do RF05, enquanto os stores cuidam da persistencia. O frontend apenas coleta dados, chama a API e escapa o conteudo antes de renderiza-lo.

## Evidencias

```bash
npm test
npm run test:integration
npm run build
```

Os arquivos principais de teste sao `comment.service.test.ts`, `rating.service.test.ts`, `server.community.test.ts` e `prisma.integration.test.ts`.
