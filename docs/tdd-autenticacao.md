# TDD da autenticacao do CodeLab

## Objetivo

Implementar o RF01 (cadastro e autenticacao), o RNF02 (controle de acesso) e o RNF06 (senha com hash), seguindo o ciclo Red, Green e Refactor usado como referencia no FitTrack.

## Red: testes antes da implementacao

Os testes foram criados antes dos servicos e endpoints. Na primeira execucao, a suite registrou as falhas esperadas:

- `AuthService` e `JwtTokenService` ainda nao existiam;
- `POST /api/auth/register` e `POST /api/auth/login` retornavam 404;
- `GET /api/me` ainda aceitava acesso sem login;
- a submissao ainda permitia que o cliente informasse outro `userId`.

Esse resultado confirmou que os cenarios realmente testavam comportamento novo.

## Green: comportamento implementado

Foram implementados:

- cadastro com nome e e-mail normalizados;
- validacao de entrada com Zod;
- bloqueio de e-mail duplicado;
- hash da senha com bcrypt e custo 10;
- login com mensagem generica para e-mail ou senha incorretos;
- token JWT com expiracao de 8 horas em cookie HttpOnly e SameSite Strict;
- middleware por cookie e Bearer para rotas autenticadas;
- middleware de papel para rotas administrativas;
- identidade da submissao obtida apenas do token;
- respostas publicas sem `passwordHash`;
- tela minima para cadastro, login e logout.
- JWT_SECRET obrigatorio em producao;
- CORS por origem permitida e limite de tentativas de autenticacao.

## Refactor: separacao de responsabilidades

| Arquivo | Responsabilidade |
|---|---|
| `src/modules/auth/auth.service.ts` | Regras de cadastro e login |
| `src/modules/auth/bcrypt-password-hasher.ts` | Hash e comparacao de senha |
| `src/modules/auth/jwt-token.service.ts` | Emissao e validacao de JWT |
| `src/modules/auth/auth.middleware.ts` | Autenticacao e autorizacao HTTP |
| `src/database/codelab-store.ts` | Contrato de persistencia |
| `src/database/in-memory-store.ts` | Repositorio rapido para testes |
| `src/database/prisma-store.ts` | Persistencia real em PostgreSQL |

## Cenarios automatizados

Os testes cobrem:

- cadastro valido;
- normalizacao de nome e e-mail;
- campos invalidos e senha curta;
- e-mail duplicado;
- chamada do bcrypt e ausencia do hash na resposta;
- login valido;
- e-mail inexistente e senha incorreta;
- token valido e token adulterado;
- rota sem token;
- estudante bloqueado em rota administrativa;
- administrador permitido em rota administrativa;
- cadastro, login, perfil e logout pela API;
- perfil, historico e submissao protegidos;
- tentativa de enviar submissao em nome de outro usuario.

## Execucao e evidencia

```bash
npm test
npm run test:coverage
```

O resultado atualizado deve ser consultado no relatorio produzido por `npm run test:coverage`. A suite principal tambem cobre catalogo, submissao, pontuacao, progresso, seguranca e desempenho, enquanto `npm run test:integration` valida bcrypt, persistencia e concorrencia no PostgreSQL real.
