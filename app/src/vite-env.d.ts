/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_PERMISSION_SETS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// `@panproto-glue` is a Vite resolve.alias for
// `@panproto/core/dist/panproto_wasm.js`. The package's `exports`
// field doesn't expose the subpath, so we declare the alias as an
// opaque module here; `init.ts` widens the namespace to
// `WasmGlueModule` at the boundary. The actual ESM shape (default
// = init fn, plus one named export per Rust fn) matches
// `WasmGlueModule` field for field at runtime.
declare module "@panproto-glue";
