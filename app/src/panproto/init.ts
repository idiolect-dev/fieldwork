// Singleton panproto initialiser.
//
// `Panproto.init()` has a documented bundler overload that accepts
// a pre-imported wasm-bindgen glue module. We use that path so Vite
// + vite-plugin-wasm own the glue + `_bg.wasm` bundling and the
// resulting assets get fingerprinted into `dist/assets/` like every
// other build artifact. The package's own runtime resolver (which
// hides `import.meta.url` from Vite via string concat) is bypassed.
//
// `@panproto-glue` is a Vite resolve.alias for
// `node_modules/@panproto/core/dist/panproto_wasm.js`; its ambient
// type lives in `src/vite-env.d.ts`. The wasm-bindgen JS file
// emits `export { __wbg_init as default, ...rust_fn_exports }`, so
// the ESM namespace shape matches `WasmGlueModule` field for field.

import { Panproto, type WasmGlueModule } from "@panproto/core";
import * as panprotoGlue from "@panproto-glue";

let _panproto: Panproto | null = null;
let _initPromise: Promise<Panproto> | null = null;

export async function initPanproto(): Promise<Panproto> {
  if (_panproto) return _panproto;
  if (_initPromise) return _initPromise;
  _initPromise = Panproto.init(panprotoGlue as WasmGlueModule).then((p) => {
    _panproto = p;
    return p;
  });
  return _initPromise;
}

/**
 * Return the panproto singleton; throws if `initPanproto()` hasn't
 * resolved yet. Callers in form-render hot paths assume the
 * singleton is ready (initPanproto runs on boot before the form
 * renders).
 */
export function panproto(): Panproto {
  if (!_panproto) {
    throw new Error("panproto not initialised. Call initPanproto() first.");
  }
  return _panproto;
}
