// Singleton panproto initialiser. `Panproto.init()` resolves its
// own wasm-bindgen glue and binary through the package; the
// `vite-plugin-wasm` plugin handles the `.wasm` instantiation.

import { Panproto } from "@panproto/core";

let _panproto: Panproto | null = null;
let _initPromise: Promise<Panproto> | null = null;

export async function initPanproto(): Promise<Panproto> {
  if (_panproto) return _panproto;
  if (_initPromise) return _initPromise;
  _initPromise = Panproto.init().then((p) => {
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
