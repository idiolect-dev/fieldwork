import { useEffect, useMemo, useState } from "react";
import { bundledLexicons } from "../lexicons/bundle";
import { GardenSearch } from "../lexicons/GardenSearch";
import { LexiconViewer } from "../lexicons/LexiconViewer";
import { WalkthroughTrigger } from "../components/WalkthroughTrigger";
import { validateLexiconDocument } from "../panproto/validate";
import type { ValidationResult } from "../panproto/validate";

interface LexiconEntry {
  nsid: string;
  json: string;
  body: unknown;
  source: "bundled" | "user" | "garden";
}

export function LexiconBrowser() {
  const [entries, setEntries] = useState<LexiconEntry[]>([]);
  const [activeNsid, setActiveNsid] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setEntries(
      bundledLexicons.map((l) => ({
        nsid: l.nsid,
        json: JSON.stringify(l.body, null, 2),
        body: l.body,
        source: "bundled" as const,
      })),
    );
  }, []);

  function importLexiconFile(file: File) {
    file
      .text()
      .then((text) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          alert(`File is not valid JSON: ${e instanceof Error ? e.message : e}`);
          return;
        }
        const nsid =
          (parsed as { id?: unknown }).id &&
          typeof (parsed as { id: unknown }).id === "string"
            ? ((parsed as { id: string }).id as string)
            : file.name.replace(/\.json$/i, "");
        setEntries((prev) => [
          ...prev.filter((e) => e.nsid !== nsid),
          {
            nsid,
            json: JSON.stringify(parsed, null, 2),
            body: parsed,
            source: "user",
          },
        ]);
        setActiveNsid(nsid);
      })
      .catch((e: unknown) => {
        alert(`Could not read file: ${e instanceof Error ? e.message : e}`);
      });
  }

  function ingestFromGarden(nsid: string, body: unknown) {
    setEntries((prev) => [
      ...prev.filter((e) => e.nsid !== nsid),
      {
        nsid,
        json: JSON.stringify(body, null, 2),
        body,
        source: "garden",
      },
    ]);
    setActiveNsid(nsid);
  }

  const visible = filter
    ? entries.filter((e) =>
        e.nsid.toLowerCase().includes(filter.toLowerCase()),
      )
    : entries;
  const active = activeNsid
    ? entries.find((e) => e.nsid === activeNsid) ?? null
    : null;
  const validation: ValidationResult | null = useMemo(
    () => (active ? validateLexiconDocument(active.body) : null),
    [active],
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row md:h-full min-h-0">
      <aside
        data-walk="lexicon-list"
        className="md:w-72 md:border-r md:border-stone-200 bg-stone-50 md:p-3 md:overflow-auto border-b md:border-b-0 border-stone-200 md:shrink-0"
      >
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="md:hidden w-full flex items-center justify-between px-3 py-2 text-stone-700 font-medium text-sm"
          aria-expanded={sidebarOpen}
        >
          <span>
            Lexicons{active ? `: ${active.nsid}` : ""}
          </span>
          <span className="text-stone-400 text-xs">
            {sidebarOpen ? "▴" : "▾"}
          </span>
        </button>
        <div
          className={`${
            sidebarOpen ? "block" : "hidden"
          } md:block px-3 pb-3 md:px-0 md:pb-0 max-h-[60vh] md:max-h-none overflow-auto`}
        >
          <div className="hidden md:flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold">Lexicon Browser</h2>
            <WalkthroughTrigger flow="lexicon" />
          </div>
          <input
            type="text"
            placeholder="filter loaded lexicons…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-2 py-1 border border-stone-300 rounded text-sm mb-3"
          />
          <div className="mb-3">
            <GardenSearch onResolve={ingestFromGarden} />
          </div>
          <label className="block text-sm mb-3">
            <span className="text-stone-700 font-medium">Import lexicon JSON:</span>
            <input
              type="file"
              accept="application/json,.json"
              className="block mt-1 text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importLexiconFile(f);
              }}
            />
          </label>
          <ul className="text-sm">
            {visible.map((e) => (
              <li
                key={e.nsid}
                onClick={() => {
                  setActiveNsid(e.nsid);
                  setSidebarOpen(false);
                }}
                title={e.nsid}
                className={`px-2 py-1 rounded cursor-pointer truncate ${
                  activeNsid === e.nsid
                    ? "bg-stone-900 text-white"
                    : "hover:bg-stone-200 text-stone-700"
                }`}
              >
                <span className="font-mono text-xs">{e.nsid}</span>
                {e.source !== "bundled" && (
                  <span className="ml-1 text-stone-400 text-[10px]">
                    ({e.source})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <section className="flex-1 p-4 overflow-auto">
        {active ? (
          <>
            <header className="mb-3">
              <h2 className="font-mono text-sm">{active.nsid}</h2>
              <p className="text-xs text-stone-500">
                {active.source === "bundled"
                  ? "bundled with fieldwork (read-only)"
                  : active.source === "garden"
                    ? "resolved from lexicon.garden (read-only in this view). The auth-server's copy is the source of truth."
                    : "imported by you (read-only in this view). Export from the source repo to keep an authoritative copy."}
              </p>
            </header>
            {validation && (
              <div
                className={`mb-3 px-3 py-2 rounded border text-xs ${
                  validation.ok
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-red-400 bg-red-50 text-red-900"
                }`}
              >
                <div className="font-semibold mb-0.5">
                  {validation.ok
                    ? "Parses cleanly as a panproto schema"
                    : "panproto rejected this lexicon"}
                </div>
                {!validation.ok && (
                  <pre className="whitespace-pre-wrap font-mono text-[11px] mt-1">
                    {validation.error}
                  </pre>
                )}
              </div>
            )}
            <LexiconViewer
              json={active.json}
              body={active.body}
              onNavigateLexicon={(nsid) => {
                const target = nsid.split("#")[0];
                if (entries.some((e) => e.nsid === target)) {
                  setActiveNsid(target);
                  return true;
                }
                return false;
              }}
            />
          </>
        ) : (
          <p className="text-stone-500 text-sm">
            Select a lexicon from the list to inspect its JSON.
          </p>
        )}
      </section>
    </div>
  );
}
