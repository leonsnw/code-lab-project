import { createApp } from "./server.js";

const port = Number(process.env.PORT ?? 3334);
createApp().listen(port, () => {
  console.log(`CodeLab API em http://localhost:${port}`);
});
