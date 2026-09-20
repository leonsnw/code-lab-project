# CodeLab - Plataforma de Desafios de Programacao

Implementacao do CodeLab alinhada ao RFC e ao plano SDD. O nucleo atual cobre autenticacao, catalogo de desafios, avaliacao por casos de teste, pontuacao, historico, ranking, progresso, comentarios, avaliacoes, administracao de desafios e estatisticas de desempenho. A interface permanece propositalmente simples para facilitar testes manuais enquanto o backend e consolidado.

## Estrutura

```txt
code-lab-project/
  apps/
    api/              # API TypeScript/Express e modulos de dominio
    web/public/       # Interface HTML/CSS/JS de verificacao
    worker/           # Worker isolado previsto como evolucao arquitetural
  docs/               # TDD, seguranca e rastreabilidade do RFC
  infra/              # Infraestrutura local
  packages/           # Espaco para contratos e fixtures compartilhados
  compose.yaml        # PostgreSQL local
```

## Funcionalidades consolidadas

- cadastro de estudantes com validacao e normalizacao;
- senha armazenada com bcrypt e custo 10;
- login por JWT em cookie `HttpOnly`, `SameSite=Strict` e com expiracao;
- limite de tentativas nas rotas de autenticacao;
- autenticacao e autorizacao por papel `student` e `admin`;
- CORS limitado a origens configuradas;
- catalogo e filtro de desafios por dificuldade;
- detalhe com enunciado, restricoes, exemplos e casos publicos;
- submissao persistida inicialmente como `pending`;
- avaliacao JavaScript contra casos publicos e privados;
- status `accepted`, `wrong_answer`, `runtime_error` e `timeout`;
- pontuacao transacional, idempotente e protegida contra concorrencia;
- historico sem revelar entradas, saidas ou identificadores privados;
- ranking por pontuacao;
- perfil com resolvidos, pendentes e progresso por dificuldade;
- comentarios autenticados, ordenados do mais recente para o mais antigo;
- avaliacao inteira de 1 a 5 por usuario e desafio;
- atualizacao do voto anterior e calculo de media e total de avaliacoes;
- cadastro e edicao administrativa de desafios, tags e casos de teste;
- remocao logica de desafios, preservando submissoes e pontuacoes;
- bloqueio das rotas administrativas por autenticacao e papel `admin`;
- painel administrativo com usuarios, desafios e engajamento geral;
- estatisticas por desafio, dificuldade e usuario;
- destaques de desafio mais resolvido e maior taxa de erro;
- migrations Prisma e seed idempotente;
- testes unitarios, HTTP, seguranca, desempenho e PostgreSQL real.

## Execucao local

Instale as dependencias e suba o PostgreSQL:

Pre-requisitos: Linux com `unshare`, Node.js 22 ou superior e Docker com Compose.

```bash
npm install
docker compose up -d postgres
```

Aplique as migrations e garanta os dados de demonstracao:

```bash
npm run db:migrate:deploy
npm run db:seed
```

O seed pode ser executado mais de uma vez. Ele atualiza as contas e desafios de demonstracao sem apagar usuarios cadastrados, pontuacoes ou submissoes existentes.

### Linhagem de migrations

A consolidacao RF02-RF09 substituiu a migration `20260805150000_authentication`, que cobria apenas autenticacao, pela migration unica `20260804200000_initial`, que cria todo o esquema do dominio. Bancos criados a partir da branch `teste` possuem uma linhagem incompativel com a atual.

Se `npm run db:migrate:status` acusar divergencia, recrie o banco local antes de aplicar as migrations:

```bash
npm run db:migrate:deploy   # banco vazio: aplica a migration unica
# ou, em banco ja migrado pela linhagem antiga:
npx prisma migrate reset --schema apps/api/prisma/schema.prisma
```

O reset apaga os dados locais. Como o banco de desenvolvimento e recriado pelo seed, isso afeta apenas ambientes locais.

Inicie o servidor:

```bash
npm run dev
```

A interface fica disponivel em:

```txt
http://localhost:3333
```

## Contas de demonstracao

| Papel | E-mail | Senha |
|---|---|---|
| Estudante | `marina@codelab.local` | `123456` |
| Administrador | `admin@codelab.local` | `admin123` |

Novos cadastros recebem sempre o papel `student`. O cliente nao pode escolher ou alterar seu proprio papel.

## Variaveis de ambiente

```env
DATABASE_URL="postgresql://codelab:codelab@localhost:5432/codelab?schema=public"
PORT=3333
JWT_SECRET="uma-chave-com-pelo-menos-32-caracteres"
NODE_ENV="development"
WEB_ORIGIN="http://localhost:3333"
```

Em `production`, a API nao inicia sem `JWT_SECRET`. O segredo local embutido so e aceito em desenvolvimento e testes.

## Banco de dados

O PostgreSQL persiste usuarios, desafios, tags, casos de teste, submissoes, resultados, pontuacoes, comentarios e avaliacoes.

Arquivos principais:

```txt
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/
apps/api/prisma/seed.ts
```

Comandos:

```bash
npm run db:migrate           # cria/aplica migrations durante desenvolvimento
npm run db:migrate:deploy    # aplica migrations versionadas
npm run db:migrate:status    # verifica o estado do banco
npm run db:seed              # garante dados de demonstracao
npm run db:studio            # abre o Prisma Studio
```

`db:push` permanece disponivel apenas como ferramenta auxiliar. O fluxo reproduzivel do projeto usa migrations.

## Avaliacao de codigo

Cada submissao e registrada antes da execucao. O avaliador executa cada caso em um processo Node separado com:

- sistema de permissoes do Node habilitado;
- namespace de usuario e rede isolado com `unshare`;
- ambiente sem `DATABASE_URL`, `JWT_SECRET` ou outras variaveis da API;
- leitura restrita ao arquivo temporario da propria submissao;
- criacao de processos e acesso de rede bloqueados;
- limite de 64 MB de memoria;
- limite de 64 KB para stdout e stderr;
- timeout de 1,5 segundo por caso;
- limpeza do diretorio temporario ao terminar.

Casos privados sao usados no calculo, mas nao sao retornados individualmente pela API. A resposta apresenta um feedback agregado informando se existem casos ocultos e se algum falhou. Entrada, saida esperada, saida recebida, erro e identificador privado nao saem da API. Casos publicos exibem detalhes suficientes para comparar a saida recebida com a esperada.

Cada usuario pode enviar no maximo 20 submissões a cada cinco minutos. O catalogo administrativo exige pelo menos um caso publico e um caso oculto por desafio, evitando que uma solucao baseada apenas no exemplo visivel seja aceita.

Um worker em container dedicado ainda e a evolucao recomendada antes de exposicao publica em escala. A implementacao atual atende ao ambiente academico controlado definido no RFC e reduz os principais riscos do processo local.

## Endpoints atuais

```txt
GET  /health
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout                    # autenticado
GET  /api/me                             # autenticado
GET  /api/challenges
GET  /api/challenges/:slug               # autenticado
POST /api/challenges/:slug/submissions   # autenticado
GET  /api/challenges/:slug/comments      # autenticado
POST /api/challenges/:slug/comments      # autenticado
GET  /api/challenges/:slug/rating        # autenticado
PUT  /api/challenges/:slug/rating        # autenticado
GET  /api/submissions                    # autenticado; aceita ?status=accepted|wrong_answer|runtime_error|timeout|pending
GET  /api/ranking
GET  /api/admin/challenges               # admin
GET  /api/admin/challenges/:id           # admin
POST /api/admin/challenges               # admin
PUT  /api/admin/challenges/:id           # admin
DELETE /api/admin/challenges/:id         # admin; remocao logica
GET  /api/admin/statistics               # admin
```

Login via cURL, mantendo o cookie de sessao:

```bash
curl -c /tmp/codelab-cookies.txt \
  -X POST http://localhost:3333/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"marina@codelab.local","password":"123456"}'
```

Consulta autenticada:

```bash
curl -b /tmp/codelab-cookies.txt http://localhost:3333/api/me
```

Submissao:

```bash
curl -b /tmp/codelab-cookies.txt \
  -X POST http://localhost:3333/api/challenges/soma-de-dois-numeros/submissions \
  -H 'Content-Type: application/json' \
  -d '{
    "language": "javascript",
    "sourceCode": "const fs = require(\"fs\");\nconst [a, b] = fs.readFileSync(0, \"utf8\").trim().split(/\\s+/).map(Number);\nconsole.log(a + b);"
  }'
```

A identidade da submissao vem exclusivamente da sessao autenticada. Um `userId` enviado pelo cliente e ignorado.

O historico pode ser filtrado por status. Sem o parametro `status`, todos os
registros do usuario autenticado sao retornados:

```bash
curl -b /tmp/codelab-cookies.txt \
  'http://localhost:3333/api/submissions?status=wrong_answer'
```

## Testes

Suite principal, sem dependencia de banco externo:

```bash
npm test
```

Integracao real com o PostgreSQL local:

```bash
npm run test:integration
```

Cobertura:

```bash
npm run test:coverage
```

Os testes incluem regras de pontuacao, concorrencia, estado `pending`, avaliacao de codigo, sandbox, privacidade dos casos, autenticacao, cookies, autorizacao, CORS, rate limit, filtro por dificuldade, progresso, comentarios, media de avaliacoes, CRUD administrativo, estatisticas e limite de dois segundos do RNF03.

## Documentacao de conformidade

- `docs/rfc-matriz-rastreabilidade.md`: requisito, implementacao e evidencia automatizada.
- `docs/seguranca-avaliacao.md`: controles e riscos residuais da execucao de codigo.
- `docs/tdd-autenticacao.md`: ciclo Red, Green e Refactor da autenticacao.
- `docs/tdd-comentarios-avaliacoes.md`: ciclo TDD e regras do RF05.
- `docs/tdd-administracao-desafios.md`: ciclo TDD, autorizacao e regras do RF06.
- `docs/tdd-estatisticas-administrativas.md`: metricas, privacidade e evidencias do RF07.

Os requisitos funcionais mapeados no RFC possuem implementacao no backend. A interface continua intencionalmente provisoria, e o nucleo deve permanecer verde durante o refinamento visual e arquitetural.
