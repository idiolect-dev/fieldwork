// Lazy-loads the wasm-pack output. The pkg/ directory is .gitignored
// and built by `scripts/build-wasm.sh`; if it's missing, `initWasm`
// throws a clear error so the App can render an actionable message.

type WasmModule = typeof import("./pkg/fieldwork_wasm");

let _module: WasmModule | null = null;
let _initPromise: Promise<WasmModule> | null = null;

export async function initWasm(): Promise<WasmModule> {
  if (_module) return _module;
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    let mod: WasmModule;
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — generated module is .gitignored; tsc will pick
      // it up after `scripts/build-wasm.sh` runs.
      mod = (await import("./pkg/fieldwork_wasm")) as WasmModule;
    } catch (e) {
      throw new Error(
        "Could not import fieldwork_wasm. Did you run scripts/build-wasm.sh? " +
          `Underlying error: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    // wasm-pack target=web emits a default export that initialises
    // the module. Calling it without args uses the default URL
    // resolution, which Vite hooks into via vite-plugin-wasm.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const init = (mod as any).default as
      | ((url?: string | URL) => Promise<unknown>)
      | undefined;
    if (typeof init === "function") {
      await init();
    }
    _module = mod;
    return mod;
  })();
  return _initPromise;
}

export function wasm(): WasmModule {
  if (!_module) {
    throw new Error("WASM module not initialised. Call initWasm() first.");
  }
  return _module;
}
