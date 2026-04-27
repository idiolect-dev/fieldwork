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

export function App() {
  const tool = useWorkspaceStore((s) => s.tool);
  const setTool = useWorkspaceStore((s) => s.setTool);
  const [wasmReady, setWasmReady] = useState(false);
  const [wasmError, setWasmError] = useState<string | null>(null);

  useEffect(() => {
    // Boot order: fieldwork-wasm + panproto-wasm in parallel
    // (independent loads), then URL-param ingestion (needs the
    // fieldwork-wasm at-uri parser).
    Promise.all([initWasm(), initPanproto()])
      .then(async () => {
        await ingestUrlParams();
        setWasmReady(true);
      })
      .catch((e: unknown) =>
        setWasmError(e instanceof Error ? e.message : String(e)),
      );
  }, []);

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
            <WasmError message={wasmError} />
          ) : !wasmReady ? (
            <WasmLoading />
          ) : (
            <ActiveTool tool={tool} />
          )}
        </section>
      </main>
      <AppWalkthrough />
      <ConfirmHost />
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

function WasmError({ message }: { message: string }) {
  return (
    <div className="p-8 text-red-700">
      <p className="font-semibold">WASM bundle failed to load.</p>
      <pre className="mt-2 text-sm whitespace-pre-wrap font-mono">
        {message}
      </pre>
      <p className="mt-4 text-sm text-stone-700">
        Run <code className="font-mono">./scripts/build-wasm.sh</code>{" "}
        from the project root and reload.
      </p>
    </div>
  );
}
