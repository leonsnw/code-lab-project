# Implantação do Code Lab

Este guia sobe o Code Lab em um servidor Linux com Docker: API, frontend, juiz e PostgreSQL.

## Requisitos do host

- **Sistema:** Linux x86-64 com Docker 24+ e Compose v2.
- **User namespaces sem privilégio habilitados:** o juiz usa `bwrap`/`unshare`.
  - Em Ubuntu 24.04: `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`. Para persistir, grave a linha em `/etc/sysctl.d/99-codelab.conf`.
  - Em Debian: `kernel.unprivileged_userns_clone=1`.
- **Máquina:** 2 vCPUs e 2 GB de RAM atendem uma turma. Cada avaliação simultânea usa até 256 MB; ajuste `JUDGE_CONCURRENCY`.

## Primeira instalação

1. Crie `.env.production` na raiz (não versione este arquivo):

   ```env
   POSTGRES_PASSWORD=troque-por-uma-senha-longa
   JWT_SECRET=troque-por-64-caracteres-aleatorios
   WEB_ORIGIN=https://codelab.suainstituicao.edu.br
   APP_URL=https://codelab.suainstituicao.edu.br
   MAIL_WEBHOOK_URL=https://seu-relay-de-email/enviar
   MAIL_WEBHOOK_TOKEN=token-do-relay
   METRICS_TOKEN=token-para-o-prometheus
   JUDGE_CONCURRENCY=2
   ```

   Para gerar segredos: `openssl rand -base64 48`.

2. Suba os serviços. As migrations são aplicadas automaticamente quando a API inicia:

   ```bash
   docker compose -f compose.prod.yaml --env-file .env.production up -d --build
   ```

3. Carregue o catálogo (trilhas, lições e desafios) e as contas de demonstração:

   ```bash
   docker compose -f compose.prod.yaml --env-file .env.production run --rm api npm run db:seed
   ```

   Depois, **troque a senha do administrador de demonstração** (`admin@codelab.local`) em Perfil › Conta, ou crie outro administrador e remova esse.

4. Coloque um proxy reverso com HTTPS na frente da porta `127.0.0.1:3333` (Caddy, nginx, Traefik). Com Caddy, por exemplo:

   ```txt
   codelab.suainstituicao.edu.br {
     reverse_proxy 127.0.0.1:3333
   }
   ```

   O cookie de sessão usa `Secure` em produção: sem HTTPS, o login não se mantém.

## Atualização

```bash
git pull
docker compose -f compose.prod.yaml --env-file .env.production up -d --build
docker compose -f compose.prod.yaml --env-file .env.production run --rm api npm run db:seed   # se o catálogo mudou
```

O seed atualiza desafios e trilhas sem apagar usuários, submissões ou pontos.

## E-mail

Recuperação de senha e verificação de e-mail enviam um `POST` JSON para `MAIL_WEBHOOK_URL`:

```json
{ "to": "estudante@exemplo.com", "subject": "Redefinir sua senha do CodeLab", "text": "…" }
```

O header `Authorization: Bearer $MAIL_WEBHOOK_TOKEN` vai junto quando definido. Qualquer serviço que aceite esse formato funciona: um worker próprio, uma função serverless ou um relay para SMTP, Resend ou Postmark. Sem `MAIL_WEBHOOK_URL`, os e-mails aparecem no log da API, o que serve para testes locais.

## Observabilidade

- **Logs:** uma linha JSON por requisição em stdout, com `requestId` (também no header `X-Request-Id`), rota, status, duração e usuário. Para ver: `docker compose -f compose.prod.yaml logs -f api`.
- **Saúde:** `GET /health` para o balanceador. `GET /health?detalhes` informa também as linguagens disponíveis no juiz (`degraded` quando falta alguma).
- **Métricas:** `GET /metrics`, no formato Prometheus, com `Authorization: Bearer $METRICS_TOKEN`:
  - requisições e latência por rota;
  - submissões por linguagem e veredito;
  - tempo de avaliação;
  - fila do juiz (`codelab_judge_running`, `codelab_judge_waiting`).

  Exemplo de alerta: `codelab_judge_waiting > 10` por 5 minutos indica que é hora de aumentar `JUDGE_CONCURRENCY` ou a máquina.

## Backup

```bash
# backup diário
docker compose -f compose.prod.yaml exec -T postgres pg_dump -U codelab -Fc codelab > backup-$(date +%F).dump
# restauração
docker compose -f compose.prod.yaml exec -T postgres pg_restore -U codelab -d codelab --clean < backup-AAAA-MM-DD.dump
```

Guarde os backups fora do servidor. Eles contêm dados pessoais (nome, e-mail, código enviado): trate-os conforme a política de privacidade.

## Segurança do contêiner

O contêiner da API roda:

- como usuário `node`, sem capabilities (`cap_drop: ALL`) e com `no-new-privileges`;
- com sistema de arquivos só leitura, `/tmp` em memória, `pids_limit` e limite de memória.

Três ajustes são necessários para o juiz funcionar dentro do contêiner, e o `compose.prod.yaml` já traz todos:

- `seccomp=unconfined`: o perfil padrão do Docker bloqueia a criação de user namespaces. O código dos estudantes continua sob o filtro seccomp do próprio juiz.
- `systempaths=unconfined`: o bwrap monta um `/proc` novo para cada sandbox, e o Docker mascara `/proc` por padrão (erro "Can't mount proc on /newroot/proc").
- `/tmp` com `exec`: o binário compilado das soluções em C roda a partir de lá.

Detalhes e riscos residuais em [seguranca-avaliacao.md](seguranca-avaliacao.md).
