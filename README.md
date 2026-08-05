# CodeLab

Repositorio oficial do CodeLab, uma plataforma academica de desafios de
programacao. A primeira entrega implementa somente a autenticacao completa,
com testes automatizados e persistencia em PostgreSQL.

O frontend desta etapa e intencionalmente simples. Ele existe para permitir a
validacao humana do cadastro, login, recuperacao da sessao e logout sem antecipar
o design definitivo da aplicacao.

## Escopo implementado

- cadastro de estudante com nome, e-mail e senha;
- validacao e normalizacao das entradas;
- hash de senha com bcrypt e fator de custo 10;
- login com mensagem generica para credenciais invalidas;
- sessao JWT de oito horas armazenada em cookie `HttpOnly`;
- cookie `SameSite=Strict` e `Secure` em producao;
- consulta do usuario autenticado em `GET /api/me`;
- logout com remocao do cookie;
- limite de tentativas nas rotas de autenticacao;
- persistencia de usuarios em PostgreSQL por Prisma;
- migration e seed reproduziveis;
- testes unitarios, HTTP, seguranca e integracao com banco real.

Desafios, submissoes, pontuacao e recursos administrativos ainda nao fazem
parte desta entrega. Essa separacao permite que cada requisito seja incluido em
commits pequenos e verificaveis.

## Estrutura

```text
apps/
  api/
    prisma/             Schema, migration e seed
    src/
      common/           Erros e tratamento HTTP
      database/         Contratos e stores Prisma/memoria
      domain/           Tipos do dominio
      modules/auth/     Regras, JWT, bcrypt, middleware e rotas
      modules/users/    Consulta do usuario autenticado
      tests/            Integracao com PostgreSQL
  web/public/           Interface estatica para testar a autenticacao
docs/
  tdd-autenticacao.md   Evidencias e estrategia de testes
```

## Requisitos locais

- Node.js 22 ou superior;
- npm;
- Docker com Docker Compose.

## Como executar

Na raiz deste repositorio:

```bash
npm install
docker compose up -d postgres
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

A aplicacao fica disponivel em <http://localhost:3334>. A API e os arquivos
estaticos usam a mesma origem, portanto o navegador pode trabalhar diretamente
com o cookie de sessao.

O PostgreSQL local e publicado na porta `5433`, evitando conflito com outra
instancia que esteja usando a porta padrao `5432`.

## Contas de demonstracao

| Papel | E-mail | Senha |
| --- | --- | --- |
| Estudante | `marina@codelab.local` | `123456` |
| Administrador | `admin@codelab.local` | `admin123` |

As credenciais sao exclusivamente locais e criadas por `npm run db:seed`.

## Endpoints

| Metodo | Endpoint | Autenticacao | Finalidade |
| --- | --- | --- | --- |
| `GET` | `/health` | Nao | Verificar a disponibilidade da API |
| `POST` | `/api/auth/register` | Nao | Criar uma conta de estudante e iniciar sessao |
| `POST` | `/api/auth/login` | Nao | Autenticar e iniciar sessao |
| `POST` | `/api/auth/logout` | Sim | Encerrar a sessao atual |
| `GET` | `/api/me` | Sim | Obter os dados publicos do usuario da sessao |

Exemplo de teste mantendo o cookie em um arquivo temporario:

```bash
curl -i -c /tmp/codelab-cookie.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"marina@codelab.local","password":"123456"}' \
  http://localhost:3334/api/auth/login

curl -i -b /tmp/codelab-cookie.txt http://localhost:3334/api/me

curl -i -b /tmp/codelab-cookie.txt -X POST \
  http://localhost:3334/api/auth/logout
```

## Testes e qualidade

```bash
npm test                  # testes rapidos com store em memoria
npm run test:integration  # testes contra o PostgreSQL local
npm run test:coverage     # relatorio de cobertura
npm run build             # verificacao e compilacao TypeScript
```

Os testes de integracao usam a mesma `DATABASE_URL` local do Compose e limpam
somente os usuarios criados por eles. O processo TDD desta entrega esta descrito
em [docs/tdd-autenticacao.md](docs/tdd-autenticacao.md).

## Variaveis de ambiente

Copie os valores necessarios de `.env.example` para o ambiente de execucao. Em
producao, `JWT_SECRET` e obrigatorio e deve ter no minimo 32 caracteres. O
segredo de desenvolvimento presente no codigo nao e aceito em producao.
