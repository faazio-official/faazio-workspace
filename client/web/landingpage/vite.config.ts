import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    // `server.entry` routes TanStack Start's SSR entry through src/server.ts
    // (the error-wrapping handler) instead of the bundled default.
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    // Nitro produces the deployment bundle. Vercel sets VERCEL=1, which selects
    // the `vercel` preset (Build Output API → .vercel/output); other hosts stay
    // on Nitro's generic Node target.
    nitro(process.env["VERCEL"] ? { preset: "vercel" } : {}),
  ],
});
