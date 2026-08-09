import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/research/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
