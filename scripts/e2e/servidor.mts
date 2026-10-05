// Servidor para o E2E: API + frontend com store em memória (catálogo completo)
// e e-mails guardados em memória, expostos em GET /__outbox para o teste ler
// os links de verificação e de redefinição de senha. Só para testes locais.
import { InMemoryStore } from "../../apps/api/src/database/in-memory-store.js";
import { MemoryMailer } from "../../apps/api/src/modules/mail/mailer.js";
import { createApp } from "../../apps/api/src/server.js";

const port = Number(process.env.E2E_PORT ?? 3401);
const mailer = new MemoryMailer();
const app = createApp(new InMemoryStore(), {
  jwtSecret: "segredo-do-e2e-local-com-mais-de-32-caracteres",
  environment: "development",
  mailer,
  appUrl: `http://localhost:${port}`
});
app.get("/__outbox", (_request, response) => {
  response.json(mailer.outbox);
});
app.listen(port, () => console.log(`E2E em http://localhost:${port}`));
