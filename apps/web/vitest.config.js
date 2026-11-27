import { defineConfig } from "vitest/config";

// Testes do frontend: o código roda no navegador, então usamos jsdom (um DOM simulado
// em Node). A cobertura mede todos os módulos de public/js, mesmo os que nenhum teste importa.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
    setupFiles: ["tests/setup.js"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["public/js/**/*.js"],
      reporter: ["text-summary", "text"],
      // Piso de cobertura: a CI falha se cair abaixo. Meta da disciplina: 25% no frontend.
      thresholds: { lines: 50, statements: 50 }
    }
  }
});
