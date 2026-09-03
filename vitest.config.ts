import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/helpers-testing/setup-env.ts"],
    globalSetup: ["./test/helpers-testing/global-setup.ts"],
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    fileParallelism: false,
    clearMocks: true,
  },
});
