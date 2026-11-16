// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  server: {
    host: true, // Exposes server to local network (e.g. 192.168.1.x)
  },
  integrations: [
    svelte(),
    tailwind({
      applyBaseStyles: false,
    }),
    sitemap({
      filter: (page) =>
        !page.includes("/admin") &&
        !page.includes("/cart") &&
        !page.includes("/404"),
    }),
  ],
  site: "https://onlysuperfoods.in",
  output: "static",
  trailingSlash: "never",
});
