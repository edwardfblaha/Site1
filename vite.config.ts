import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this project under /<repo>/. Repo is "site1".
// Override with VITE_BASE if deploying elsewhere (custom domain → "/").
export default defineConfig({
  base: process.env.VITE_BASE ?? "/Site1/",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: true },
});
