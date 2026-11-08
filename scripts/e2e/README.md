# Teste de ponta a ponta

Percorre o produto no Firefox (headless): cadastro, verificação de e-mail, busca rápida, envio em Python, comparação de submissões, discussão com spoiler, editor, tema escuro, perfil, ranking, turma do professor, estatísticas, rascunho, recuperação de senha, páginas legais e layout mobile. Salva screenshots em `scripts/e2e/shots/`.

```bash
# 1. Servidor isolado (store em memória, não toca no banco)
LOG_REQUESTS=0 npx tsx scripts/e2e/servidor.mts &

# 2. Dependência só para o teste (não entra no package.json)
npm install --no-save puppeteer-core@23

# 3. Rodar
node scripts/e2e/e2e.mjs
```

Variáveis: `E2E_URL` (padrão `http://localhost:3401`), `FIREFOX_PATH` (padrão `/usr/bin/firefox`) e `E2E_SHOTS` (pasta das screenshots). O teste cria contas novas a cada execução. Os limites de pedidos por e-mail (5 a cada 15 minutos) valem por processo: para rodar várias vezes seguidas, reinicie o servidor.
