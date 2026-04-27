// Toolbar pill for a draft that has a counterpart on the PDS.
// Shows the draft's status (published / edited), and offers
// "revert to PDS" + "delete from PDS" actions inline so the user
// doesn't have to dig into the Export popover.

import { useState } from "react";
import type { Draft } from "../workspace/types";
import { draftStatus } from "../workspace/types";
import { useWorkspaceStore } from "../workspace/store";
import { deleteRecord } from "../sessions/deleteRecord";
import { usePdsRefresh } from "../sessions/pdsRefresh";
import { confirmAction } from "./ConfirmModal";

interface Props {
  draft: Draft;
}

export function PublishedActions({ draft }: Props) {
  const ref = draft.body.publishedRef;
  const status = draftStatus(draft);
  const setPublishedRef = useWorkspaceStore((s) => s.setPublishedRef);
  const revertToPublished = useWorkspaceStore((s) => s.revertToPublished);
  const bumpPds = usePdsRefresh((s) => s.bump);
  const [busy, setBusy] = useState<"delete" | "revert" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!ref) return null;

  async function deleteFromPds() {
    const choice = await confirmAction({
      title: "Delete from PDS?",
      body: (
        <>
          <p className="mb-2">
            This will delete the published record at{" "}
            <code className="font-mono text-[12px] break-all">
              {ref!.uri}
            </code>{" "}
            from your PDS.
          </p>
          <p>
            The local draft is kept and unlinked; it'll show as a
            draft afterwards. Use the sidebar's × to also remove the
            local copy.
          </p>
        </>
      ),
      actions: [
        { key: "delete", label: "Delete from PDS", destructive: true },
      ],
    });
    if (choice !== "delete") return;
    setBusy("delete");
    setError(null);
    try {
      await deleteRecord(ref!.uri);
      setPublishedRef(draft.body.id, null);
      bumpPds();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function revert() {
    if (status !== "edited") return;
    const choice = await confirmAction({
      title: "Revert local edits?",
      body: "Restore this draft to the version on your PDS. Local edits will be discarded.",
      actions: [
        { key: "revert", label: "Revert", destructive: true },
      ],
    });
    if (choice !== "revert") return;
    revertToPublished(draft.body.id);
  }

  return (
    <div
      data-walk="published-actions"
      className="flex items-center gap-2 mb-3 text-xs"
    >
      <StatusBadge status={status} />
      <code
        className="font-mono text-[11px] text-stone-500 truncate min-w-0 flex-1"
        title={ref.uri}
      >
        {ref.uri.split("/").slice(-2).join("/")}
      </code>
      {status === "edited" && (
        <button
          type="button"
          onClick={() => void revert()}
          disabled={busy !== null}
          className="px-2 py-0.5 rounded border border-stone-300 hover:border-stone-400 text-stone-700 disabled:opacity-40"
          title="Discard local edits and load the PDS version"
        >
          Revert
        </button>
      )}
      <button
        type="button"
        onClick={() => void deleteFromPds()}
        disabled={busy !== null}
        className="px-2 py-0.5 rounded border border-red-300 text-red-700 hover:border-red-500 disabled:opacity-40"
        title="Delete the published record from your PDS"
      >
        {busy === "delete" ? "deleting…" : "Delete from PDS"}
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "published" | "edited" }) {
  const styles = {
    draft: "bg-stone-100 text-stone-700 border-stone-300",
    published: "bg-emerald-100 text-emerald-900 border-emerald-300",
    edited: "bg-amber-100 text-amber-900 border-amber-300",
  } as const;
  const label = {
    draft: "Draft",
    published: "Published",
    edited: "Edited",
  } as const;
  return (
    <span
      className={`inline-block text-[10px] uppercase font-semibold tracking-wide px-1.5 py-0.5 rounded border ${styles[status]}`}
    >
      {label[status]}
    </span>
  );
}
