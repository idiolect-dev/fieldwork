/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_PERMISSION_SETS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// `@panproto-glue` is a Vite resolve.alias for
// `@panproto/core/dist/panproto_wasm.js`, the wasm-bindgen glue
// module. The package's `exports` field doesn't expose it as a
// subpath, so we alias to a virtual id and feed the namespace
// import to `Panproto.init()` (which has a documented bundler
// overload accepting a pre-imported glue module).
declare module "@panproto-glue" {
  import type { WasmGlueModule } from "@panproto/core";
  const glue: WasmGlueModule;
  export default glue;
  export = glue;
}
