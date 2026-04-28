import { useEffect, useState } from "react";
import { useWorkspaceStore } from "./workspace/store";
import type { ToolKey } from "./workspace/store";
import { ingestUrlParams } from "./workspace/urlParams";
import { DialectComposer } from "./tools/DialectComposer";
import { VocabularyEditor } from "./tools/VocabularyEditor";
import { LexiconBrowser } from "./tools/LexiconBrowser";
import { CommunityConfig } from "./tools/CommunityConfig";
import { RecommendationBuilder } from "./tools/RecommendationBuilder";
import { LensManager } from "./tools/LensManager";
import { AppWalkthrough } from "./components/AppWalkthrough";
import { ConfirmHost } from "./components/ConfirmModal";
import { Sidebar } from "./components/Sidebar";
import { SessionMenu } from "./components/SessionMenu";
import { initWasm } from "./wasm/loader";
import { initPanproto } from "./panproto/init";

const TOOL_LABEL: Record<ToolKey, string> = {
  dialect: "Dialects",
  vocab: "Vocabularies",
  lexicon: "Lexicons",
  community: "Communities",
  recommendation: "Recommendations",
  lens: "Lenses",
};

/**
 * What blocked the WASM boot. `unsupported` is the case where the
 * browser itself has no WebAssembly runtime (or it's disabled);
 * `failed` is everything else (fetch error, instantiation crash, a
 * dev forgot to build the wasm bundle locally, etc.).
 */
type WasmFailure =
  | { kind: "unsupported" }
  | { kind: "failed"; message: string };

function browserSupportsWasm(): boolean {
  return (
    typeof WebAssembly === "object"
    && typeof WebAssembly.instantiate === "function"
  );
}

export function App() {
  const tool = useWorkspaceStore((s) => s.tool);
  const setTool = useWorkspaceStore((s) => s.setTool);
  const [wasmReady, setWasmReady] = useState(false);
  const [wasmError, setWasmError] = useState<WasmFailure | null>(null);

  useEffect(() => {
    // Pre-flight: if the runtime has no WebAssembly we cannot recover,
    // so surface the unsupported-browser variant before firing any
    // load. Loading would throw a generic "WebAssembly is not defined"
    // that masks the real cause.
    if (!browserSupportsWasm()) {
      setWasmError({ kind: "unsupported" });
      return;
    }
    // Boot order: fieldwork-wasm + panproto-wasm in parallel
    // (independent loads), then URL-param ingestion (needs the
    // fieldwork-wasm at-uri parser).
    Promise.all([initWasm(), initPanproto()])
      .then(async () => {
        await ingestUrlParams();
        setWasmReady(true);
      })
      .catch((e: unknown) =>
        setWasmError({
          kind: "failed",
          message: e instanceof Error ? e.message : String(e),
        }),
      );
  }, []);

  // While the WASM bundle hasn't loaded (or has failed), the
  // walkthrough and confirm-modal hosts can't do their jobs — every
  // step that touches the workspace, lexicon validator, or session
  // store needs the bundle present. Render them only once the app
  // is actually usable so a no-WASM browser sees the error directly.
  const interactive = wasmReady && wasmError === null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="border-b border-stone-200 bg-white px-3 sm:px-6 py-2 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center justify-between gap-3 sm:flex-shrink-0">
          <h1 className="text-lg font-semibold tracking-tight">
            fieldwork
          </h1>
          <div data-walk="session-menu" className="sm:hidden">
            <SessionMenu />
          </div>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <nav
            data-walk="nav"
            className="flex gap-1 text-sm overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 flex-nowrap whitespace-nowrap min-w-0"
            aria-label="Tools"
          >
            {(Object.keys(TOOL_LABEL) as ToolKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTool(k)}
                className={`px-3 py-1.5 rounded shrink-0 ${
                  k === tool
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {TOOL_LABEL[k]}
              </button>
            ))}
          </nav>
          <div className="hidden sm:block">
            <SessionMenu />
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col md:flex-row min-h-0">
        <Sidebar />
        <section className="flex-1 overflow-auto min-h-0">
          {wasmError ? (
            <WasmError failure={wasmError} />
          ) : !wasmReady ? (
            <WasmLoading />
          ) : (
            <ActiveTool tool={tool} />
          )}
        </section>
      </main>
      {interactive && (
        <>
          <AppWalkthrough />
          <ConfirmHost />
        </>
      )}
    </div>
  );
}

function ActiveTool({ tool }: { tool: ToolKey }) {
  switch (tool) {
    case "dialect":
      return <DialectComposer />;
    case "vocab":
      return <VocabularyEditor />;
    case "lexicon":
      return <LexiconBrowser />;
    case "community":
      return <CommunityConfig />;
    case "recommendation":
      return <RecommendationBuilder />;
    case "lens":
      return <LensManager />;
  }
}

function WasmLoading() {
  return (
    <div className="p-8 text-stone-500">Loading WASM bundle…</div>
  );
}

function WasmError({ failure }: { failure: WasmFailure }) {
  if (failure.kind === "unsupported") {
    return (
      <div className="p-8 max-w-prose">
        <p className="font-semibold text-stone-900 text-lg">
          Your browser doesn't support WebAssembly.
        </p>
        <p className="mt-3 text-sm text-stone-700">
          fieldwork runs entirely in the browser. The lexicon
          validator and the at-uri parser are compiled to
          WebAssembly, so without a WebAssembly runtime the app
          cannot start.
        </p>
        <p className="mt-3 text-sm text-stone-700">
          Most modern browsers (Chrome, Firefox, Safari, Edge,
          Brave) have supported WebAssembly since 2017. If you're
          on a recent browser, check that JavaScript is enabled
          and that no extension is blocking WebAssembly. On older
          builds, an update will pick it up.
        </p>
      </div>
    );
  }
  // The local-dev hint only makes sense when the page is being
  // served from a dev box. On production deployments the bundle
  // shipped fingerprinted; a load failure there is a fetch /
  // instantiation issue the user can usually retry past.
  const isLocalDev =
    typeof window !== "undefined"
    && (window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1");
  return (
    <div className="p-8 max-w-prose text-stone-800">
      <p className="font-semibold text-red-700">
        WASM bundle failed to load.
      </p>
      <pre className="mt-3 text-sm whitespace-pre-wrap font-mono text-red-700 bg-red-50 border border-red-200 rounded p-3">
        {failure.message}
      </pre>
      {isLocalDev ? (
        <p className="mt-4 text-sm text-stone-700">
          Run <code className="font-mono">./scripts/build-wasm.sh</code>{" "}
          from the project root and reload. Codegen output lives in
          <code className="font-mono"> app/wasm/</code>.
        </p>
      ) : (
        <p className="mt-4 text-sm text-stone-700">
          Try reloading the page. If the failure persists, the
          deployment may be mid-rollout — wait a minute and reload
          again.
        </p>
      )}
    </div>
  );
}
