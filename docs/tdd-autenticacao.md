# TDD da autenticacao

## Objetivo

Esta fatia entrega o RF01 do CodeLab: cadastro e autenticacao de usuarios. O
desenvolvimento foi guiado por testes e inclui a persistencia real em PostgreSQL,
sem introduzir antecipadamente os demais modulos do RFC.

## Ciclo Red, Green e Refactor

### Red

Os testes foram escritos antes das implementacoes. A primeira execucao falhou
porque os modulos de autenticacao, token e middleware ainda nao existiam. Os
cenarios iniciais especificaram:

- cadastro de estudante com senha transformada em hash;
- rejeicao de e-mail duplicado e entrada invalida;
- login com e-mail normalizado;
- rejeicao de senha incorreta;
- emissao e verificacao do JWT;
- protecao de rotas sem uma sessao valida;
- ausencia do hash e do token no corpo das respostas.

### Green

Foi implementado o minimo necessario para satisfazer os cenarios:

- `AuthService` concentra cadastro e login;
- `BcryptPasswordHasher` isola o hash e a comparacao de senhas;
- `JwtTokenService` emite tokens com emissor, audiencia e expiracao definidos;
- middleware recupera a sessao pelo cookie ou cabecalho Bearer;
- stores em memoria e Prisma compartilham o mesmo contrato;
- rotas HTTP definem o cookie e retornam apenas dados publicos do usuario;
- migration cria somente a tabela `users` e o enum de papeis.

### Refactor

Depois dos cenarios principais ficarem verdes, foram consolidadas as protecoes:

- cookie `HttpOnly`, `SameSite=Strict` e `Secure` em producao;
- limite de 20 tentativas por 15 minutos nas rotas de autenticacao;
- mensagem generica de login invalido para nao revelar contas existentes;
- comparacao contra hash ficticio quando o e-mail nao existe;
- limite de 64 KiB para corpos JSON;
- lista explicita de origens CORS;
- `JWT_SECRET` obrigatorio no ambiente de producao;
- restricao de senha a 72 caracteres nesta etapa.

## Piramide de testes

| Nivel | Arquivos | Responsabilidade |
| --- | --- | --- |
| Unidade | `auth.service.test.ts` | Regras de cadastro e login |
| Unidade | `jwt-token.service.test.ts` | Emissao, expiracao e verificacao do token |
| Unidade | `auth.middleware.test.ts` | Autenticacao e autorizacao por papel |
| HTTP | `server.auth.test.ts` | Contrato das rotas, cookie e logout |
| HTTP | `server.security.test.ts` | CORS, limite de requisicao e configuracao segura |
| Integracao | `prisma.integration.test.ts` | bcrypt, unicidade e sessao usando PostgreSQL real |

## Banco de dados

O Prisma gerencia a tabela `users`, que possui identificador, nome, e-mail
unico, hash da senha, papel e datas de criacao/atualizacao. Senhas em texto puro
nao sao armazenadas.

A migration versionada pode ser aplicada com:

```bash
npm run db:migrate:deploy
```

O seed cria uma conta de estudante e uma conta administrativa para demonstracao:

```bash
npm run db:seed
```

## Criterios de aceite cobertos

1. Um visitante consegue criar uma conta valida e passa a ter uma sessao.
2. Um e-mail ja cadastrado nao pode ser cadastrado novamente.
3. Um usuario consegue entrar com e-mail e senha corretos.
4. Credenciais invalidas retornam `401` sem informar qual campo falhou.
5. Uma rota protegida rejeita requisicoes sem sessao valida.
6. O usuario autenticado consegue consultar seus dados publicos.
7. O logout invalida o cookie no navegador.
8. O hash da senha nao aparece nas respostas da API.
9. Os dados continuam disponiveis depois de reiniciar a API.
10. O fluxo completo funciona contra uma instancia PostgreSQL real.
