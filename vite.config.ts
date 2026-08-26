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
            // Cloudflare Pages by default. Both Cloudflare presets externalise
            // `cloudflare:workers` (how `src/lib/env.server.ts` reaches
            // bindings), turn on `nodejs_compat`, and merge the root
            // `wrangler.jsonc` — where the D1 binding is declared — into the
            // generated deploy config.
            //
            // Pages rather than Workers because a Pages custom domain on a
            // SUBDOMAIN does not require the domain to be a Cloudflare zone: it
            // is a CNAME to `<project>.pages.dev` from whatever DNS provider
            // already holds the zone. A Workers Custom Domain would require
            // moving the domain's nameservers to Cloudflare, which would drag
            // the apex, MX and SPF records along with it.
            //
            // Set NITRO_PRESET=cloudflare-module to build a Worker instead.
            preset: process.env.NITRO_PRESET ?? "cloudflare-pages",
          }),
        ]
      : []),
    viteReact(),
  ],
}));
