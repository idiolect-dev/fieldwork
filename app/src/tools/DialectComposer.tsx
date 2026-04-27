import { useMemo, useState } from "react";
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

      <Field label="Idiolects (the schemas this dialect bundles)">
        <div data-walk="dialect-idiolects">
          <SchemaRefList
            items={
              Array.isArray(body.idiolects)
                ? (body.idiolects as Array<{ uri?: string; cid?: string }>)
                : []
            }
            onChange={(next) =>
              patch("idiolects", next.length === 0 ? undefined : next)
            }
          />
        </div>
      </Field>

      <Field label="Deprecations (optional)">
        <div data-walk="dialect-deprecations">
          <DeprecationList
            items={
              Array.isArray(body.deprecations)
                ? (body.deprecations as Deprecation[])
                : []
            }
            onChange={(next) =>
              patch("deprecations", next.length === 0 ? undefined : next)
            }
          />
        </div>
      </Field>

      <Field label="Previous version at-uri (optional)">
        <div data-walk="dialect-previous">
          <AtUriAutocomplete
            value={(body.previousVersion as string) ?? ""}
            onChange={(v) => patch("previousVersion", v || undefined)}
            expectedCollection="dev.idiolect.dialect"
            placeholder={useAtUriPlaceholder(
              "at://did:plc:.../dev.idiolect.dialect/<rkey>",
            )}
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

// `dialect.idiolects` items are `dev.idiolect.defs#schemaRef`.
// Editing focuses on the at-uri; cid roundtrips through the form
// untouched on import.
function SchemaRefList({
  items,
  onChange,
}: {
  items: Array<{ uri?: string; cid?: string }>;
  onChange: (next: Array<{ uri?: string; cid?: string }>) => void;
}) {
  const placeholder = useAtUriPlaceholder(
    "at://did:plc:.../<schema-rkey>",
  );
  function setUri(i: number, uri: string) {
    const next = items.map((r, j) => (j === i ? { ...r, uri } : r));
    onChange(next.filter((r) => r.uri && r.uri.length > 0));
  }
  function add() {
    onChange([...items, { uri: "" }]);
  }
  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }
  const rows = items.length === 0 ? [{ uri: "" }] : items;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <AtUriAutocomplete
              value={r.uri ?? ""}
              onChange={(v) => setUri(i, v)}
              placeholder={placeholder}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-stone-500 text-xs px-1"
            title="Remove"
            disabled={items.length === 0}
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
        + idiolect
      </button>
    </div>
  );
}

// `dialect.deprecations` items: { ref (at-uri, required),
// replacement? (at-uri), deprecatedAt (datetime, required),
// reason (string, required, ≤1000 graphemes) }.
interface Deprecation {
  ref: string;
  replacement?: string;
  deprecatedAt: string;
  reason: string;
}

function DeprecationList({
  items,
  onChange,
}: {
  items: Deprecation[];
  onChange: (next: Deprecation[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  function update(i: number, patch: Partial<Deprecation>) {
    const next = items.map((d, j) => (j === i ? { ...d, ...patch } : d));
    onChange(next);
  }
  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }
  function add() {
    onChange([
      ...items,
      {
        ref: "",
        deprecatedAt: new Date().toISOString(),
        reason: "",
      },
    ]);
    setAdding(false);
  }
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && !adding && (
        <p className="text-xs text-stone-500">
          No deprecations. Use this to record idiolects or lenses
          that were once part of this dialect and are now retired.
        </p>
      )}
      {items.map((d, i) => (
        <DeprecationCard
          key={i}
          item={d}
          onChange={(p) => update(i, p)}
          onRemove={() => remove(i)}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start text-xs text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50"
      >
        + deprecation
      </button>
    </div>
  );
}

function DeprecationCard({
  item,
  onChange,
  onRemove,
}: {
  item: Deprecation;
  onChange: (patch: Partial<Deprecation>) => void;
  onRemove: () => void;
}) {
  const refPlaceholder = useAtUriPlaceholder(
    "at://did:plc:.../<deprecated-record>",
  );
  const replacementPlaceholder = useAtUriPlaceholder(
    "at://did:plc:.../<successor>",
  );
  return (
    <div className="border border-stone-200 rounded bg-white">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-stone-100 bg-stone-50">
        <span className="text-xs font-semibold text-stone-700">
          Deprecation
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-stone-500 hover:text-red-700 text-sm px-1"
          title="Remove"
        >
          ×
        </button>
      </div>
      <div className="px-3 py-2 grid grid-cols-1 gap-3">
        <label className="flex flex-col gap-0.5 text-xs text-stone-600">
          <span>Deprecated ref (at-uri)</span>
          <AtUriAutocomplete
            value={item.ref}
            onChange={(v) => onChange({ ref: v })}
            placeholder={refPlaceholder}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-stone-600">
          <span>Replacement at-uri (optional)</span>
          <AtUriAutocomplete
            value={item.replacement ?? ""}
            onChange={(v) => onChange({ replacement: v || undefined })}
            placeholder={replacementPlaceholder}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-stone-600">
          <span>Deprecated at (RFC 3339)</span>
          <DatetimeInput
            value={item.deprecatedAt}
            onChange={(v) => onChange({ deprecatedAt: v })}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-stone-600">
          <span>Reason</span>
          <textarea
            value={item.reason}
            onChange={(e) => onChange({ reason: e.target.value })}
            rows={2}
            className="px-2 py-1 border border-stone-300 rounded text-sm"
          />
        </label>
      </div>
    </div>
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
