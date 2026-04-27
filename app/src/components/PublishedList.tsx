// Live list of records the active session has published under one
// collection. Mirrors what the LensManager does for
// dev.panproto.schema.lens, generalised so any sidebar can drop in
// a per-kind list with per-row delete.

import { useEffect, useState } from "react";
import { useSessionsStore } from "../sessions/store";
import { deleteRecord } from "../sessions/deleteRecord";
import { usePdsRefresh } from "../sessions/pdsRefresh";
import { confirmAction } from "./ConfirmModal";

interface Row {
  uri: string;
  cid: string;
  preview?: string;
}

interface Props {
  /** Collection NSID to list (e.g. dev.idiolect.dialect). */
  nsid: string;
}

function previewBody(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const v = value as Record<string, unknown>;
  const name = typeof v.name === "string" ? v.name : "";
  const desc = typeof v.description === "string" ? v.description : "";
  return [name, desc].filter(Boolean).join(" · ");
}

export function PublishedList({ nsid }: Props) {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeDid = useSessionsStore((s) => s.activeDid);
  const session = activeDid ? sessions[activeDid] : null;
  const repoId = session?.handle ?? session?.did;

  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingUri, setDeletingUri] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  // Shared tick across the app: any publish / delete from anywhere
  // (ExportButton, LensManager) bumps this so we re-fetch.
  const pdsTick = usePdsRefresh((s) => s.tick);
  const bumpPds = usePdsRefresh((s) => s.bump);

  useEffect(() => {
    if (!session?.pdsUrl || !repoId) {
      setRows([]);
      return;
    }
    const ctrl = new AbortController();
    const url = `${session.pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(
      repoId,
    )}&collection=${encodeURIComponent(nsid)}&limit=100`;
    setLoading(true);
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(
        (data: {
          records?: Array<{ uri: string; cid: string; value: unknown }>;
        }) => {
          const next: Row[] = (data.records ?? []).map((rec) => ({
            uri: rec.uri,
            cid: rec.cid,
            preview: previewBody(rec.value),
          }));
          setRows(next);
          setLoadError(null);
        },
      )
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setLoadError(
          e instanceof Error ? e.message : `listRecords failed (${String(e)})`,
        );
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [session?.pdsUrl, repoId, nsid, refreshTick, pdsTick]);

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
    setDeletingUri(uri);
    setDeleteError(null);
    try {
      await deleteRecord(uri);
      setRefreshTick((t) => t + 1);
      bumpPds();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingUri(null);
    }
  }

  if (!session) {
    return (
      <p className="text-stone-500 text-xs">
        Sign in to see records you've published under {nsid}.
      </p>
    );
  }
  if (loading && rows.length === 0) {
    return <p className="text-stone-500 text-xs">Loading…</p>;
  }
  if (loadError) {
    return (
      <p className="text-red-700 text-xs">Could not load: {loadError}</p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-stone-500 text-xs">
        No <code className="font-mono">{nsid}</code> records in your repo
        yet. Publish one to see it here.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-0.5 text-xs">
        {rows.map((r) => {
          const rkey = r.uri.split("/").pop() ?? r.uri;
          return (
            <li
              key={r.uri}
              className="group rounded border border-stone-200 bg-white px-2 py-1 hover:border-stone-300"
            >
              <div className="flex items-center justify-between gap-1">
                <code
                  className="font-mono text-[11px] truncate"
                  title={r.uri}
                >
                  {rkey}
                </code>
                <div className="flex items-center gap-2 shrink-0 opacity-60 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(r.uri)}
                    className="text-stone-500 hover:text-stone-800 text-[10px]"
                    title="Copy at-uri"
                  >
                    copy
                  </button>
                  <button
                    type="button"
                    onClick={() => void doDelete(r.uri)}
                    disabled={deletingUri === r.uri}
                    className="text-red-700 hover:text-red-900 disabled:text-stone-400 text-[10px]"
                    title="Delete from PDS"
                  >
                    {deletingUri === r.uri ? "…" : "delete"}
                  </button>
                </div>
              </div>
              {r.preview && (
                <div className="text-[10px] text-stone-500 truncate">
                  {r.preview}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {deleteError && (
        <p className="text-[10px] text-red-700 mt-1">{deleteError}</p>
      )}
    </div>
  );
}
