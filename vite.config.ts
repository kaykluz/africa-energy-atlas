import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// `0.0.0.0:8080` is the local dev contract — don't change host/port without
// also updating the origins Better Auth trusts (src/lib/auth/server.ts).
export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            // Cloudflare Workers. The preset externalises `cloudflare:workers`
            // (how `src/lib/env.server.ts` reaches bindings), turns on
            // `nodejs_compat`, and merges the root `wrangler.jsonc` — where the
            // D1 binding is declared — into the generated deploy config.
            preset: "cloudflare-module",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
