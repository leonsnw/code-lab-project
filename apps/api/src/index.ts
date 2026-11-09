import { PrismaStore } from "./database/prisma-store.js";
import { startStaleSubmissionSweeper } from "./modules/submissions/stale-submissions.js";
import { checkSandboxAvailability } from "./modules/submissions/submission-evaluation.service.js";
import { createApp } from "./server.js";

const port = Number(process.env.PORT ?? 3333);
const store = new PrismaStore();
const app = createApp(store);

const server = app.listen(port, () => {
  console.log(`CodeLab API em http://localhost:${port}`);
});

// Submissões que ficaram em "pending" porque a API caiu ou reiniciou no meio da avaliação.
const stopSweeper = startStaleSubmissionSweeper(store);
server.on("close", stopSweeper);

checkSandboxAvailability().then(({ available, reason }) => {
  if (!available) {
    console.warn(
      [
        "AVISO: o sandbox de avaliação não pode ser criado neste ambiente.",
        `Motivo: ${reason}`,
        "As submissões serão registradas como internal_error. Rode a API em Linux com `unshare` (user namespaces habilitados) ou em container."
      ].join("\n")
    );
  }
});
