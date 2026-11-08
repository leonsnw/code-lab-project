import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Testes HTTP que submetem código passam pelo juiz real (sandbox, gcc,
    // python); com a suíte inteira em paralelo, 5 s é pouco.
    testTimeout: 30000
  }
});
