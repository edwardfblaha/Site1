import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node", // engine is DOM-free; tests run headless
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
