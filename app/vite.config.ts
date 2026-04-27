import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// fieldwork is deployed at https://idiolect.dev/fieldwork via GitHub
// Pages (repo: idiolect-dev/fieldwork). Production asset URLs must
// be prefixed with `/fieldwork/`. Local dev (`npm run dev`) keeps
// the empty base so the Vite dev server serves at root.
//
// The Lexicon Browser autocompletes against lexicon.garden's
// `/api/autocomplete-nsid` endpoint, which does NOT set CORS
// headers (only the `/xrpc/` endpoints do). We proxy through the
// dev server so development works without tripping CORS. For
// production (idiolect.dev/fieldwork/), a separate proxy — a
// Cloudflare Worker, function, or lexicon.garden adding CORS — is
// required; the widget falls back to no-autocomplete if the proxy
// is unreachable. The `/xrpc/com.atproto.lexicon.resolveLexicon`
// endpoint that does the actual resolution has open CORS and works
// directly without a proxy.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/fieldwork/" : "/",
  plugins: [react(), wasm(), topLevelAwait()],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: {
      "/lexicon-garden": {
        target: "https://lexicon.garden",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/lexicon-garden/, ""),
      },
    },
  },
  build: {
    target: "esnext",
    sourcemap: true,
  },
  // @panproto/core ships a wasm-bindgen glue + sibling .wasm and
  // resolves them via a dynamic import relative to the package's
  // own dist/. Letting Vite's dep optimizer pre-bundle the package
  // rewrites that path to /node_modules/.vite/deps/panproto_wasm.js
  // which doesn't exist; excluding it from optimization keeps the
  // package's own resolver in charge of finding its siblings.
  optimizeDeps: {
    exclude: ["@panproto/core"],
  },
}));
