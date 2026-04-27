import { useRef, useState } from "react";
import { useWorkspaceStore } from "../workspace/store";
import { mintDraftId } from "../workspace/ids";
import { wasm } from "../wasm/loader";
import type { Draft, DraftKind } from "../workspace/types";
import { resolveAtUri } from "../import/atUri";
import { useAtUriPlaceholder } from "../sessions/placeholders";
import { AtUriAutocomplete } from "./AtUriAutocomplete";

interface Fixture {
  name: string;
  body: unknown;
  label: string;
}

interface Props {
  kind: DraftKind;
  fixtures: Fixture[];
}

/**
 * Three-source import: at-uri, file drop, or fixture pick. Decoupled
 * from individual tools so every tool gets the same import surface.
 */
export function ImportButton({ kind, fixtures }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uri, setUri] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const importDraft = useWorkspaceStore((s) => s.importDraft);
  const appView = useWorkspaceStore((s) => s.appView);
  // Hook calls must be at fixed positions; the popover's
  // `placeholder={useAtUriPlaceholder(...)}` was inside a conditional
  // `{open && ...}` block, so the hook count changed when the
  // popover toggled. Resolve once at the top of the component.
  const importPlaceholder = useAtUriPlaceholder(
    `at://did:plc:.../dev.idiolect.${kind}/<rkey>`,
  );

  function consumeBody(body: unknown, label: string) {
    const id = mintDraftId(kind);
    try {
      const draft = wasm().importRecord(kind, body, id, label) as Draft;
      importDraft(draft);
      setOpen(false);
      setUri("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function importFromAtUri() {
    setBusy(true);
    setError(null);
    try {
      const body = await resolveAtUri(uri.trim(), appView.baseUrl);
      const label = pickLabel(body) ?? uri.trim();
      consumeBody(body, label);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function importFromFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const body = JSON.parse(text);
      const label = pickLabel(body) ?? file.name.replace(/\.json$/i, "");
      consumeBody(body, label);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function importFromFixture(fixture: Fixture) {
    consumeBody(fixture.body, fixture.label);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="px-3 py-1 text-sm rounded border border-stone-300 bg-white hover:bg-stone-50"
        onClick={() => setOpen((v) => !v)}
      >
        Import
      </button>
      {open && (
        <div className="absolute z-10 right-0 mt-2 w-96 bg-white border border-stone-200 rounded shadow-lg p-4 text-sm">
          <h4 className="font-semibold mb-2">From at-uri</h4>
          <div className="flex gap-2 mb-3 items-start">
            <div className="flex-1">
              <AtUriAutocomplete
                value={uri}
                onChange={setUri}
                expectedCollection={`dev.idiolect.${kind}`}
                placeholder={importPlaceholder}
                className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-xs"
              />
            </div>
            <button
              type="button"
              disabled={busy || !uri.trim()}
              onClick={importFromAtUri}
              className="px-3 py-1 rounded bg-stone-900 text-white disabled:bg-stone-400"
            >
              Fetch
            </button>
          </div>

          <h4 className="font-semibold mb-2 mt-3">From file</h4>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="text-xs"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFromFile(f);
            }}
          />

          {fixtures.length > 0 && (
            <>
              <h4 className="font-semibold mb-2 mt-3">From fixture</h4>
              <ul className="flex flex-col gap-1">
                {fixtures.map((f) => (
                  <li key={f.name}>
                    <button
                      type="button"
                      onClick={() => importFromFixture(f)}
                      className="text-left text-stone-700 hover:underline text-xs"
                    >
                      {f.name}; <em>{f.label}</em>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {error && (
            <p className="mt-3 text-red-700 text-xs whitespace-pre-wrap">
              {error}
            </p>
          )}

          <div className="flex justify-end mt-3">
            <button
              type="button"
              className="text-stone-500 text-xs"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Best-effort: pull a sensible label out of the imported body.
function pickLabel(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  for (const key of ["name", "label", "title"]) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}
