#!/usr/bin/env node
// Túnel de contingência para o PostgreSQL de desenvolvimento.
//
// Uso: node scripts/db-tunnel.mjs [container] [porta-local]
//      (padrão: codelab-juiz-dev 55432)
//
// Quando o host deixa de alcançar a rede do Docker (regras de firewall do
// Docker perdidas; a correção definitiva é `sudo systemctl restart docker`),
// cada conexão local é repassada ao banco por `docker exec ... nc`, que usa o
// namespace de rede do próprio container. Depois aponte DATABASE_URL para
// postgresql://codelab:codelab@127.0.0.1:<porta-local>/codelab.
import { spawn } from "node:child_process";
import net from "node:net";

const container = process.argv[2] ?? "codelab-juiz-dev";
const port = Number(process.argv[3] ?? 55432);

const server = net.createServer((socket) => {
  const bridge = spawn("docker", ["exec", "-i", container, "nc", "127.0.0.1", "5432"], { stdio: ["pipe", "pipe", "ignore"] });
  socket.pipe(bridge.stdin);
  bridge.stdout.pipe(socket);
  const close = () => {
    socket.destroy();
    bridge.kill();
  };
  socket.on("error", close);
  socket.on("close", close);
  bridge.on("exit", close);
  bridge.stdin.on("error", () => undefined);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Tunel ${container}:5432 -> 127.0.0.1:${port}`);
});
