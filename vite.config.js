import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/main.js",
      name: "WebflowScripts",
      formats: ["iife"],
      fileName: () => "index.js",
    },
  },
});
