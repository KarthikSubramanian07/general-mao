import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    target: "es2022",
    sourcemap: true,
    // Fonts ship as files, never data: URLs: the CSP allows `font-src 'self'` only,
    // and a few tiny @fontsource subsets fall under the default inline limit.
    assetsInlineLimit: (filePath) => (/\.(woff2?|ttf|otf)$/.test(filePath) ? false : undefined),
  },
});
