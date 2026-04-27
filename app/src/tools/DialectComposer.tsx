import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore, draftsByKind } from "../workspace/store";
import { mintDraftId } from "../workspace/ids";
import type { Draft } from "../workspace/types";
import { WalkthroughTrigger } from "../components/WalkthroughTrigger";
import { ImportButton } from "../components/ImportButton";
import { PublishedActions } from "../components/PublishedActions";
import { ExportButton } from "../components/ExportButton";
import { GuidancePane } from "../components/GuidancePane";
import { DiffPane } from "../components/DiffPane";
import { dialectFixtures } from "../fixtures/dialect";
import { useAtUriPlaceholder } from "../sessions/placeholders";
import { AtUriAutocomplete } from "../components/AtUriAutocomplete";
import { Tooltip } from "../components/Tooltip";
import { DatetimeInput } from "../components/DatetimeInput";

export function DialectComposer() {
  const drafts = useWorkspaceStore(useShallow((s) => draftsByKind(s, "dialect")));
  const activeId = useWorkspaceStore((s) => s.active.dialect);
  const upsertDraft = useWorkspaceStore((s) => s.upsertDraft);
  const setActive = useWorkspaceStore((s) => s.setActive);

  const active = useMemo(
    () => drafts.find((d) => d.body.id === activeId) ?? null,
    [drafts, activeId],
  );

  function newDraft() {
    const id = mintDraftId("dialect");
    const draft: Draft = {
      kind: "dialect",
      body: {
        id,
        label: "untitled",
        body: {
          name: "untitled",
          owningCommunity: "",
          createdAt: new Date().toISOString(),
        },
      },
    };
    upsertDraft(draft);
    setActive("dialect", id);
  }

  return (
    <div className="flex flex-col md:flex-row md:h-full min-h-0">
      <div className="flex-1 p-3 sm:p-6 overflow-auto min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Dialect Composer</h2><WalkthroughTrigger flow="dialect" /></div>
            <p className="text-sm text-stone-600 max-w-prose">
              A dialect bundles your community's preferred lenses,
              deprecations, and idiolects under a single at-uri so
              subscribers know which lens versions to invoke.
            </p>
          </div>
          <div data-walk="editor-toolbar" className="flex gap-2">
            <button
              type="button"
              onClick={newDraft}
              className="px-3 py-1.5 text-sm rounded border border-stone-300 bg-white"
            >
              New
            </button>
            <ImportButton kind="dialect" fixtures={dialectFixtures} />
            <ExportButton draft={active} />
          </div>
        </div>

        {active && <PublishedActions draft={active} />}
        {active ? (
          <DialectForm draft={active} onChange={upsertDraft} />
        ) : (
          <EmptyState />
        )}
      </div>
      <GuidancePane draft={active} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border border-dashed border-stone-300 rounded p-8 text-center text-stone-600">
      <p className="font-medium">No dialect selected.</p>
      <p className="text-sm mt-2">
        Click <em>New</em> to start from scratch, <em>Import</em> to
        load an existing record, or pick from the sidebar once you
        have drafts.
      </p>
    </div>
  );
}

function DialectForm({
  draft,
  onChange,
}: {
  draft: Draft & { kind: "dialect" };
  onChange: (d: Draft) => void;
}) {
  // Type-narrow: the body envelope's body is the Dialect record itself.
  // Cast to `Record<string, unknown>` for editing; we don't bind the
  // full generated TS types here because Vocab/Recommendation reuse
  // the same form pattern and a unified `unknown` keeps the helpers
  // shared. The export path serde-validates against the lexicon
  // before the user can publish.
  const body = draft.body.body;

  function patch(field: string, value: unknown) {
    const nextBody = { ...body, [field]: value };
    const next: Draft = {
      ...draft,
      body: { ...draft.body, body: nextBody },
    };
    onChange(next);
  }

  function patchLabel(label: string) {
    const next: Draft = {
      ...draft,
      body: {
        ...draft.body,
        label,
        body: { ...body, name: label },
      },
    };
    onChange(next);
  }

  const lenses = (body.preferredLenses as Array<{ uri?: string }>) ?? [];

  return (
    <form className="grid grid-cols-1 gap-4 max-w-2xl">
      <Field label="Name">
        <input
          type="text"
          value={(body.name as string) ?? ""}
          onChange={(e) => patchLabel(e.target.value)}
          className="w-full px-2 py-1.5 border border-stone-300 rounded"
        />
      </Field>
      <Field label="Description (optional)">
        <textarea
          value={(body.description as string) ?? ""}
          onChange={(e) => patch("description", e.target.value || undefined)}
          rows={3}
          className="w-full px-2 py-1.5 border border-stone-300 rounded"
        />
      </Field>
      <Field
        label={
          <>
            Owning community at-uri{" "}
            <Tooltip text="The community whose curation policy this dialect implements. Subscribers walk this back to the community's recommendations and conventions.">
              <span className="text-stone-400 font-normal cursor-help">
                ?
              </span>
            </Tooltip>
          </>
        }
      >
        <div data-walk="dialect-owning">
          <AtUriAutocomplete
            value={(body.owningCommunity as string) ?? ""}
            onChange={(v) => patch("owningCommunity", v)}
            expectedCollection="dev.idiolect.community"
            placeholder={useAtUriPlaceholder(
              "at://did:plc:.../dev.idiolect.community/main",
            )}
          />
        </div>
      </Field>

      <Field label="Preferred lenses">
        <div data-walk="dialect-lenses">
          <LensList
            lenses={lenses}
            onChange={(next) =>
              patch("preferredLenses", next.length === 0 ? undefined : next)
            }
          />
        </div>
      </Field>

      <Field label="Version (optional)">
        <input
          type="text"
          value={(body.version as string) ?? ""}
          onChange={(e) => patch("version", e.target.value || undefined)}
          placeholder="2026.04 / 1.2.0 / etc."
          className="w-full px-2 py-1.5 border border-stone-300 rounded"
        />
      </Field>

      <Field label="Created at (RFC 3339)">
        <DatetimeInput
          value={(body.createdAt as string) ?? ""}
          onChange={(v) => patch("createdAt", v)}
        />
      </Field>
      <DiffPane draft={draft} />
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-stone-700">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function LensList({
  lenses,
  onChange,
}: {
  lenses: Array<{ uri?: string }>;
  onChange: (next: Array<{ uri: string }>) => void;
}) {
  function setAt(i: number, uri: string) {
    const next = lenses.map((l, j) => (i === j ? { uri } : { uri: l.uri ?? "" }));
    onChange(next.filter((l) => l.uri.length > 0) as Array<{ uri: string }>);
  }
  function add() {
    onChange([
      ...lenses.map((l) => ({ uri: l.uri ?? "" })),
      { uri: "" },
    ] as Array<{ uri: string }>);
  }
  function remove(i: number) {
    onChange(
      lenses
        .filter((_, j) => j !== i)
        .map((l) => ({ uri: l.uri ?? "" })) as Array<{ uri: string }>,
    );
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= lenses.length) return;
    const next = lenses.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map((l) => ({ uri: l.uri ?? "" })) as Array<{ uri: string }>);
  }

  // Render at least one row so the user always has somewhere to type.
  const rows = lenses.length === 0 ? [{ uri: "" }] : lenses;
  // Hook calls must be at fixed positions; resolve the placeholder
  // template once, outside the .map() body, then reuse per row.
  const lensPlaceholder = useAtUriPlaceholder(
    "at://did:plc:.../dev.panproto.schema.lens/<rkey>",
  );

  return (
    <div className="flex flex-col gap-2">
      {rows.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <AtUriAutocomplete
              value={l.uri ?? ""}
              onChange={(v) => setAt(i, v)}
              expectedCollection="dev.panproto.schema.lens"
              placeholder={lensPlaceholder}
            />
          </div>
          <div className="flex flex-col text-stone-400 text-[10px] leading-tight">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="hover:text-stone-700 disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === rows.length - 1}
              className="hover:text-stone-700 disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-stone-500 text-xs px-1"
            title="Remove lens"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start text-xs text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50"
      >
        + lens
      </button>
    </div>
  );
}
