import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore, draftsByKind } from "../workspace/store";
import { draftId, draftLabel, draftStatus } from "../workspace/types";
import type { Draft, DraftKind, DraftStatus } from "../workspace/types";
import type { ToolKey } from "../workspace/store";
import { mintDraftId } from "../workspace/ids";
import { dialectFixtures } from "../fixtures/dialect";
import { vocabFixtures } from "../fixtures/vocab";
import { communityFixtures } from "../fixtures/community";
import { recommendationFixtures } from "../fixtures/recommendation";
import { useSessionsStore } from "../sessions/store";
import { usePdsRefresh } from "../sessions/pdsRefresh";
import { deleteRecord } from "../sessions/deleteRecord";
import { confirmAction } from "./ConfirmModal";
import { PublishedList } from "./PublishedList";

const TOOL_TO_KIND: Record<ToolKey, DraftKind | null> = {
  dialect: "dialect",
  vocab: "vocab",
  community: "community",
  recommendation: "recommendation",
  lexicon: null,
  lens: null,
};

const KIND_LABEL: Record<DraftKind, string> = {
  dialect: "Dialects",
  vocab: "Vocabularies",
  community: "Communities",
  recommendation: "Recommendations",
};

interface Fixture {
  name: string;
  label: string;
  body: unknown;
}

const TEMPLATES: Record<DraftKind, Fixture[]> = {
  dialect: dialectFixtures,
  vocab: vocabFixtures,
  community: communityFixtures,
  recommendation: recommendationFixtures,
};

interface RemoteRecord {
  uri: string;
  cid: string;
  body: unknown;
}

export function Sidebar() {
  const tool = useWorkspaceStore((s) => s.tool);
  const kind = TOOL_TO_KIND[tool];

  // Lens Manager has no local drafts but does have a useful per-PDS
  // listing — surface it in a tool-specific sidebar so the main
  // pane can focus on uploads.
  if (tool === "lens") return <LensSidebar />;

  // Other tools without local drafts (Lexicon Browser) own their
  // own panes; suppress the workspace sidebar entirely.
  if (kind === null) return null;

  return <KindSidebar kind={kind} />;
}

function LensSidebar() {
  return (
    <aside
      data-walk="sidebar"
      className="md:w-64 md:border-r md:border-stone-200 bg-stone-50 px-3 py-3 md:py-4 flex flex-col gap-4 text-sm border-b md:border-b-0 border-stone-200 md:max-h-none max-h-64 overflow-auto md:overflow-visible md:shrink-0"
    >
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold tracking-tight text-stone-700">
          Lenses in your PDS
        </h2>
        <PublishedList nsid="dev.panproto.schema.lens" />
      </section>
    </aside>
  );
}

function KindSidebar({ kind }: { kind: DraftKind }) {
  const drafts = useWorkspaceStore(useShallow((s) => draftsByKind(s, kind)));
  const active = useWorkspaceStore((s) => s.active[kind]);
  const setActive = useWorkspaceStore((s) => s.setActive);
  const removeDraft = useWorkspaceStore((s) => s.removeDraft);
  const upsertDraft = useWorkspaceStore((s) => s.upsertDraft);
  const setPublishedRef = useWorkspaceStore((s) => s.setPublishedRef);
  const bumpPds = usePdsRefresh((s) => s.bump);


  const sessions = useSessionsStore((s) => s.sessions);
  const activeDid = useSessionsStore((s) => s.activeDid);
  const session = activeDid ? sessions[activeDid] : null;
  const repoId = session?.handle ?? session?.did;

  const pdsTick = usePdsRefresh((s) => s.tick);

  const templates = TEMPLATES[kind] ?? [];
  const nsid = `dev.idiolect.${kind}`;

  // Remote records the active session has published under this kind.
  // Pulled live so the sidebar reflects publish / delete in real time.
  const [remote, setRemote] = useState<RemoteRecord[]>([]);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.pdsUrl || !repoId) {
      setRemote([]);
      return;
    }
    const ctrl = new AbortController();
    const url = `${session.pdsUrl}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(
      repoId,
    )}&collection=${encodeURIComponent(nsid)}&limit=100`;
    fetch(url, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(
        (data: {
          records?: Array<{ uri: string; cid: string; value: unknown }>;
        }) => {
          setRemote(
            (data.records ?? []).map((rec) => ({
              uri: rec.uri,
              cid: rec.cid,
              body: rec.value,
            })),
          );
          setRemoteError(null);
        },
      )
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setRemoteError(
          e instanceof Error ? e.message : `listRecords failed (${String(e)})`,
        );
      });
    return () => ctrl.abort();
  }, [session?.pdsUrl, repoId, nsid, pdsTick]);

  // Drafts already linked to a remote record (by publishedRef.uri),
  // for filtering remote-only out of the list.
  const linkedUris = useMemo(() => {
    const set = new Set<string>();
    for (const d of drafts) {
      const u = d.body.publishedRef?.uri;
      if (u) set.add(u);
    }
    return set;
  }, [drafts]);

  const remoteOnly = useMemo(
    () => remote.filter((r) => !linkedUris.has(r.uri)),
    [remote, linkedUris],
  );

  // Sidebar `×` flow.
  //
  // - Local-only draft: simple Cancel / Remove.
  // - Published draft: PDS deletion is the primary action (deleting
  //   only locally would orphan the published record). Two flavours:
  //   "PDS only" keeps the local draft (it demotes to a regular
  //   draft so the user can keep editing); "PDS + local" wipes both.
  async function removeDraftRow(d: Draft) {
    const id = draftId(d);
    const label = draftLabel(d) || id;
    const ref = d.body.publishedRef;
    if (!ref) {
      const choice = await confirmAction({
        title: `Remove "${label}"?`,
        body: "This only deletes it from your local workspace.",
        actions: [
          { key: "remove", label: "Remove", destructive: true },
        ],
      });
      if (choice === "remove") removeDraft(id);
      return;
    }
    const choice = await confirmAction({
      title: `Delete "${label}"?`,
      body: (
        <>
          <p className="mb-2">
            Published at{" "}
            <code className="font-mono text-[12px] break-all">
              {ref.uri}
            </code>
            .
          </p>
          <p>
            Both options delete the PDS record.{" "}
            <strong>PDS only</strong> keeps the local draft for
            further editing; <strong>PDS + local</strong> wipes
            both.
          </p>
        </>
      ),
      actions: [
        { key: "pds-only", label: "PDS only", destructive: true },
        { key: "both", label: "PDS + local", destructive: true },
      ],
    });
    if (choice === null) return;
    try {
      await deleteRecord(ref.uri);
      bumpPds();
    } catch (e) {
      await confirmAction({
        title: "PDS delete failed",
        body: e instanceof Error ? e.message : String(e),
        actions: [],
        cancelLabel: "Dismiss",
      });
      return;
    }
    if (choice === "both") {
      removeDraft(id);
    } else {
      // Keep the local draft but clear its publishedRef so the
      // status badge demotes to "draft".
      setPublishedRef(id, null);
    }
  }

  function importRemote(rec: RemoteRecord) {
    if (!rec.body || typeof rec.body !== "object") return;
    const id = mintDraftId(kind);
    // Strip $type from the body before storing as a draft (the
    // editor reads bare fields; $type is re-stamped at publish).
    const raw = rec.body as Record<string, unknown>;
    const { $type: _drop, ...rest } = raw;
    const body = JSON.parse(JSON.stringify(rest)) as Record<string, unknown>;
    const draft = {
      kind,
      body: {
        id,
        label: pickLabel(body) ?? rec.uri.split("/").pop() ?? id,
        body,
        publishedRef: {
          uri: rec.uri,
          cid: rec.cid,
          snapshot: JSON.stringify(body),
        },
      },
    } as Draft;
    upsertDraft(draft);
    setActive(kind, id);
  }

  function cloneTemplate(t: Fixture) {
    const id = mintDraftId(kind);
    const body = JSON.parse(JSON.stringify(t.body)) as Record<string, unknown>;
    const draft = {
      kind,
      body: {
        id,
        label: `${t.label} (clone)`,
        body,
      },
    } as Draft;
    upsertDraft(draft);
    setActive(kind, id);
  }

  return (
    <aside
      data-walk="sidebar"
      className="md:w-64 md:border-r md:border-stone-200 bg-stone-50 px-3 py-3 md:py-4 flex flex-col gap-4 text-sm border-b md:border-b-0 border-stone-200 md:max-h-none max-h-64 overflow-auto md:overflow-visible md:shrink-0"
    >
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold tracking-tight text-stone-700">
          {KIND_LABEL[kind]}
        </h2>
        {drafts.length === 0 && remoteOnly.length === 0 ? (
          <p className="text-stone-500 text-xs">
            Nothing here yet. Click <em>New</em>, clone a template
            below, or sign in to load records you've published before.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {drafts.map((d) => (
              <DraftRow
                key={draftId(d)}
                draft={d}
                isActive={active === draftId(d)}
                onClick={() => setActive(kind, draftId(d))}
                onRemove={() => void removeDraftRow(d)}
              />
            ))}
            {remoteOnly.map((r) => (
              <RemoteRow
                key={r.uri}
                rec={r}
                onClick={() => importRemote(r)}
              />
            ))}
          </ul>
        )}
        {remoteError && (
          <p className="text-[10px] text-red-700">
            Could not list PDS records: {remoteError}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-stone-200 pt-3">
        <h2 className="font-semibold tracking-tight text-stone-700 flex items-baseline justify-between gap-2">
          <span>Templates</span>
          <span className="text-[10px] text-stone-400 font-normal">
            click to clone
          </span>
        </h2>
        {templates.length === 0 ? (
          <p className="text-stone-500 text-xs">
            No templates bundled for this kind yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {templates.map((t) => (
              <li key={t.name} className="group">
                <button
                  type="button"
                  onClick={() => cloneTemplate(t)}
                  className="w-full text-left rounded px-2 py-1 hover:bg-stone-200 text-stone-700 flex flex-col"
                  title={`Clone "${t.label}" as a new draft`}
                >
                  <span className="text-xs truncate">{t.label}</span>
                  <span className="font-mono text-[10px] text-stone-500 truncate">
                    {t.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function DraftRow({
  draft,
  isActive,
  onClick,
  onRemove,
}: {
  draft: Draft;
  isActive: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const status = draftStatus(draft);
  const label = draftLabel(draft) || draftId(draft);
  return (
    <li
      onClick={onClick}
      className={`group flex items-center justify-between rounded px-2 py-1 cursor-pointer ${
        isActive
          ? "bg-stone-900 text-white"
          : "hover:bg-stone-200 text-stone-700"
      }`}
    >
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <StatusDot status={status} active={isActive} />
        <span className="truncate">{label}</span>
      </div>
      <button
        type="button"
        className={`ml-2 text-xs opacity-60 group-hover:opacity-100 ${
          isActive ? "text-stone-200" : "text-stone-500"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove from workspace"
      >
        ×
      </button>
    </li>
  );
}

function RemoteRow({
  rec,
  onClick,
}: {
  rec: RemoteRecord;
  onClick: () => void;
}) {
  const label = pickLabel(rec.body) ?? rec.uri.split("/").pop() ?? rec.uri;
  return (
    <li
      onClick={onClick}
      className="group flex items-center justify-between rounded px-2 py-1 cursor-pointer hover:bg-stone-200 text-stone-700"
      title={`Import ${rec.uri} as a draft`}
    >
      <div className="min-w-0 flex-1 flex items-center gap-2">
        <StatusDot status="published" active={false} />
        <span className="truncate">{label}</span>
      </div>
      <span className="ml-2 text-[10px] text-stone-400 group-hover:text-stone-600 shrink-0">
        import
      </span>
    </li>
  );
}

function StatusDot({
  status,
  active,
}: {
  status: DraftStatus;
  active: boolean;
}) {
  const tone =
    status === "published"
      ? active
        ? "bg-emerald-300"
        : "bg-emerald-500"
      : status === "edited"
        ? active
          ? "bg-amber-300"
          : "bg-amber-500"
        : active
          ? "bg-stone-300"
          : "bg-stone-400";
  const title =
    status === "published"
      ? "Matches the version on your PDS"
      : status === "edited"
        ? "Edited since last publish"
        : "Local draft only";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${tone}`}
      title={title}
      aria-label={title}
    />
  );
}

function pickLabel(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = body as Record<string, unknown>;
  if (typeof v.name === "string" && v.name.length > 0) return v.name;
  if (typeof v.label === "string" && v.label.length > 0) return v.label;
  return undefined;
}
