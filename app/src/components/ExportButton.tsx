import { useState } from "react";
import type { Draft, ExportEnvelope } from "../workspace/types";
import { useWorkspaceStore } from "../workspace/store";
import { useSessionsStore } from "../sessions/store";
import { publishDraft } from "../sessions/publish";
import { deleteRecord } from "../sessions/deleteRecord";
import { usePdsRefresh } from "../sessions/pdsRefresh";
import { confirmAction } from "./ConfirmModal";
import { wasm } from "../wasm/loader";
import { normalizeBodyAtUris } from "../sessions/atUriNormalize";

interface Props {
  draft: Draft | null;
}

/**
 * Two-shape export: download record JSON, or copy the cli command.
 * Both render off the same `ExportEnvelope` so the user can switch
 * shapes without re-running the export.
 */
export function ExportButton({ draft }: Props) {
  const [open, setOpen] = useState(false);
  const [envelope, setEnvelope] = useState<ExportEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedUri, setPublishedUri] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const bumpPds = usePdsRefresh((s) => s.bump);
  const setPublishedRef = useWorkspaceStore((s) => s.setPublishedRef);
  const did = useWorkspaceStore((s) => s.publishingDid);
  const setDid = useWorkspaceStore((s) => s.setPublishingDid);
  const activeSessionDid = useSessionsStore((s) => s.activeDid);
  const sessions = useSessionsStore((s) => s.sessions);
  const activeSession = activeSessionDid
    ? sessions[activeSessionDid]
    : null;

  async function rebuild() {
    if (!draft) return;
    try {
      // Prefer the signed-in DID if no manual override is set; the
      // CLI command pre-fills with whatever the user is most likely
      // to publish under.
      const exportDid = did || activeSessionDid || "";
      // Normalize any handle-bearing at-uris in the body to DIDs so
      // the exported JSON / CLI command carries canonical references.
      // The cast keeps the kind-narrowed body shape; normalize only
      // ever rewrites string contents, not the schema.
      const normalizedRecord = (await normalizeBodyAtUris(
        draft.body.body,
      )) as typeof draft.body.body;
      const draftForExport = {
        ...draft,
        body: { ...draft.body, body: normalizedRecord },
      } as Draft;
      const env = wasm().exportDraft(draftForExport, exportDid) as ExportEnvelope;
      setEnvelope(env);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function doDelete(uri: string) {
    const choice = await confirmAction({
      title: "Delete from PDS?",
      body: (
        <p>
          Delete the published record at{" "}
          <code className="font-mono text-[12px] break-all">{uri}</code>{" "}
          from your PDS. This cannot be undone from inside fieldwork.
        </p>
      ),
      actions: [
        { key: "delete", label: "Delete from PDS", destructive: true },
      ],
    });
    if (choice !== "delete") return;
    setDeleting(true);
    setError(null);
    try {
      await deleteRecord(uri);
      // Clear the published-uri readout if we just deleted the same
      // record. Also clear the publishedRef from any local draft
      // whose link has just been broken so the badge flips back to
      // "draft".
      if (publishedUri === uri) setPublishedUri(null);
      if (draft && draft.body.publishedRef?.uri === uri) {
        setPublishedRef(draft.body.id, null);
      }
      bumpPds();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function publish() {
    if (!draft) return;
    setPublishing(true);
    setError(null);
    setPublishedUri(null);
    try {
      const result = await publishDraft(draft);
      setPublishedUri(result.uri);
      setPublishedRef(draft.body.id, {
        uri: result.uri,
        cid: result.cid,
      });
      bumpPds();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(false);
    }
  }

  function downloadRecord(env: ExportEnvelope) {
    const blob = new Blob([env.recordJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = env.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyCli(env: ExportEnvelope) {
    void navigator.clipboard.writeText(env.cliCommand);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={!draft}
        onClick={() => {
          setOpen((v) => !v);
          void rebuild();
        }}
        className="px-3 py-1.5 text-sm rounded bg-stone-900 text-white disabled:bg-stone-400"
      >
        Export
      </button>
      {open && draft && (
        <div className="absolute z-10 right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-[28rem] bg-white border border-stone-200 rounded shadow-lg p-4 text-sm">
          <h4 className="font-semibold mb-2">Publishing DID</h4>
          <input
            type="text"
            value={did}
            placeholder={activeSessionDid ?? "did:plc:…"}
            onChange={(e) => {
              setDid(e.target.value);
            }}
            onBlur={() => void rebuild()}
            className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-xs mb-3"
          />

          {envelope && (
            <>
              <h4 className="font-semibold mb-2">Publish to PDS</h4>
              {activeSession ? (
                <>
                  <p className="text-xs text-stone-600 mb-2">
                    Will publish under{" "}
                    <code className="font-mono">
                      {activeSession.handle ?? activeSession.did}
                    </code>
                    {activeSession.pdsUrl && (
                      <>
                        {" "}
                        on{" "}
                        <code className="font-mono">
                          {activeSession.pdsUrl}
                        </code>
                      </>
                    )}
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => void publish()}
                    disabled={publishing}
                    className="px-3 py-1 rounded bg-emerald-700 text-white text-xs disabled:bg-stone-400"
                  >
                    {publishing ? "Publishing…" : "Publish"}
                  </button>
                  {publishedUri && (
                    <div className="mt-2 text-xs text-emerald-800 flex items-start justify-between gap-2">
                      <div className="break-all">
                        Published →{" "}
                        <code className="font-mono">{publishedUri}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => void doDelete(publishedUri)}
                        disabled={deleting}
                        className="text-red-700 hover:text-red-900 disabled:text-stone-400 shrink-0"
                        title="Delete this record from your PDS"
                      >
                        {deleting ? "deleting…" : "delete"}
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-stone-500">
                    Browse and delete other records you've published from
                    the sidebar's "Published to PDS" section.
                  </p>
                </>
              ) : (
                <p className="text-xs text-stone-600 mb-2">
                  Sign in (top-right) to publish directly. Until then,
                  download the JSON below and run the CLI command.
                </p>
              )}

              <h4 className="font-semibold mb-2 mt-4">Download record JSON</h4>
              <p className="text-xs text-stone-600 mb-2">
                Saves <code className="font-mono">{envelope.filename}</code>{" "}
               ; the body a PDS expects under{" "}
                <code className="font-mono">com.atproto.repo.createRecord</code>.
              </p>
              <button
                type="button"
                onClick={() => downloadRecord(envelope)}
                className="px-3 py-1 rounded bg-stone-900 text-white text-xs"
              >
                Download
              </button>

              <h4 className="font-semibold mb-2 mt-4">CLI publish command</h4>
              <p className="text-xs text-stone-600 mb-2">
                Run this from the directory you saved the JSON to.
              </p>
              <pre className="bg-stone-100 px-2 py-1 rounded text-xs font-mono whitespace-pre-wrap break-all">
                {envelope.cliCommand}
              </pre>
              <button
                type="button"
                onClick={() => copyCli(envelope)}
                className="mt-2 px-3 py-1 rounded border border-stone-300 text-xs"
              >
                Copy command
              </button>
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
