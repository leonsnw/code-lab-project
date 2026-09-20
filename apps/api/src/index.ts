import { createApp } from "./server.js";

const port = Number(process.env.PORT ?? 3333);
const app = createApp();

app.listen(port, () => {
  console.log(`CodeLab API em http://localhost:${port}`);
});
