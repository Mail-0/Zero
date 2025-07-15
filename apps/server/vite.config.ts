import { defineConfig } from "vite";

export default defineConfig({
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 120000,
  },
}); 