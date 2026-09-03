import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    globalSetup: ["./test/globalSetup.ts"],
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    // Business-rule tests share one test database — run files one at a time.
    fileParallelism: false,
    clearMocks: true,
  },
});
