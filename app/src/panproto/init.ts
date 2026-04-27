// Singleton panproto initialiser.
//
// The package's default `Panproto.init()` resolves its glue + wasm
// via `import.meta.url`-relative dynamic imports, which the
// production Vite build does not emit as sibling assets (the
// `panproto_wasm.js` URL ends up 404ing under `/fieldwork/assets/`).
// Importing the glue module explicitly lets vite-plugin-wasm
// fingerprint both the glue and its `panproto_wasm_bg.wasm`
// sibling into the build, and we hand the pre-imported module to
// `Panproto.init()` so the package skips its own resolver.

// Singleton panproto initialiser.
//
// `Panproto.init()` has a documented bundler overload that accepts a
// pre-imported wasm-bindgen glue module. We use that path so Vite +
// vite-plugin-wasm own the glue + `_bg.wasm` bundling and the
// resulting assets get fingerprinted into `dist/assets/` like every
// other build artifact. The package's own runtime resolver (which
// hides its `import.meta.url` from Vite via string concat) is
// bypassed entirely.
//
// `@panproto-glue` is a Vite resolve.alias defined in
// `vite.config.ts` pointing at
// `node_modules/@panproto/core/dist/panproto_wasm.js`; the type
// shape is declared in `src/vite-env.d.ts`.

import { Panproto } from "@panproto/core";
import panprotoGlue from "@panproto-glue";

let _panproto: Panproto | null = null;
let _initPromise: Promise<Panproto> | null = null;

export async function initPanproto(): Promise<Panproto> {
  if (_panproto) return _panproto;
  if (_initPromise) return _initPromise;
  _initPromise = Panproto.init(panprotoGlue).then((p) => {
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
