import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// `@panproto/core`'s `Panproto.init()` accepts a pre-imported
// wasm-bindgen glue module for bundler environments (see the
// `WasmGlueModule` overload). That is the supported Vite path. The
// package's `exports` field does not expose the `dist/panproto_wasm.js`
// subpath, so we alias a stable virtual id at our boundary; Vite +
// vite-plugin-wasm then bundle the glue and its `_bg.wasm` sibling
// with proper fingerprinting.
const PANPROTO_GLUE_ALIAS = "@panproto-glue";
const panprotoGluePath = resolve(
  here,
  "node_modules/@panproto/core/dist/panproto_wasm.js",
);

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
  resolve: {
    alias: {
      [PANPROTO_GLUE_ALIAS]: panprotoGluePath,
    },
  },
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
  // The dep optimizer would pre-bundle `@panproto/core` and rewrite
  // its `import.meta.url` glue resolver to a path that doesn't
  // exist. We bypass that resolver entirely by passing a
  // pre-imported glue (see src/panproto/init.ts), so excluding the
  // package keeps dev consistent with prod.
  optimizeDeps: {
    exclude: ["@panproto/core"],
  },
}));
