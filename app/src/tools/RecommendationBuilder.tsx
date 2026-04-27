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
import { ConditionTreeEditor } from "./ConditionTreeEditor";
import { recommendationFixtures } from "../fixtures/recommendation";
import { useAtUriPlaceholder } from "../sessions/placeholders";
import { AtUriAutocomplete } from "../components/AtUriAutocomplete";
import { DatetimeInput } from "../components/DatetimeInput";

export function RecommendationBuilder() {
  const drafts = useWorkspaceStore(
    useShallow((s) => draftsByKind(s, "recommendation")),
  );
  const activeId = useWorkspaceStore((s) => s.active.recommendation);
  const upsertDraft = useWorkspaceStore((s) => s.upsertDraft);
  const setActive = useWorkspaceStore((s) => s.setActive);

  const active = useMemo(
    () => drafts.find((d) => d.body.id === activeId) ?? null,
    [drafts, activeId],
  );

  function newDraft() {
    const id = mintDraftId("recommendation");
    const draft: Draft = {
      kind: "recommendation",
      body: {
        id,
        label: "untitled recommendation",
        body: {
          issuingCommunity: "",
          lensPath: [],
          conditions: [],
          occurredAt: new Date().toISOString(),
        },
      },
    };
    upsertDraft(draft);
    setActive("recommendation", id);
  }

  return (
    <div className="flex flex-col md:flex-row md:h-full min-h-0">
      <div className="flex-1 p-3 sm:p-6 overflow-auto min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Recommendation Builder</h2><WalkthroughTrigger flow="recommendation" /></div>
            <p className="text-sm text-stone-600 max-w-prose">
              A recommendation tells subscribers which lens path to
              invoke for a given source / target schema pair, with
              optional eligibility and verification gates.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={newDraft}
              className="px-3 py-1.5 text-sm rounded border border-stone-300 bg-white"
            >
              New
            </button>
            <ImportButton
              kind="recommendation"
              fixtures={recommendationFixtures}
            />
            <ExportButton draft={active} />
          </div>
        </div>

        {active && <PublishedActions draft={active} />}
        {active ? (
          <RecommendationForm draft={active} onChange={upsertDraft} />
        ) : (
          <p className="text-stone-500 text-sm">
            No recommendation selected. Click <em>New</em> or <em>Import</em>.
          </p>
        )}
      </div>
      <GuidancePane draft={active} />
    </div>
  );
}

function RecommendationForm({
  draft,
  onChange,
}: {
  draft: Draft & { kind: "recommendation" };
  onChange: (d: Draft) => void;
}) {
  const body = draft.body.body;
  function patch(field: string, value: unknown) {
    const nextBody = {
      ...body,
      [field]: value,
    };
    onChange({ ...draft, body: { ...draft.body, body: nextBody } });
  }
  const lensPath = (body.lensPath as LensRef[] | undefined) ?? [];

  return (
    <form className="grid grid-cols-1 gap-4 max-w-2xl">
      <Field label="Label (workspace-only)">
        <input
          type="text"
          value={draft.body.label}
          onChange={(e) =>
            onChange({
              ...draft,
              body: { ...draft.body, label: e.target.value },
            })
          }
          className="w-full px-2 py-1.5 border border-stone-300 rounded"
        />
      </Field>
      <Field label="Issuing community at-uri">
        <div data-walk="recommendation-issuing">
          <AtUriAutocomplete
            value={(body.issuingCommunity as string) ?? ""}
            onChange={(v) => patch("issuingCommunity", v)}
            expectedCollection="dev.idiolect.community"
            placeholder={useAtUriPlaceholder(
              "at://did:plc:.../dev.idiolect.community/main",
            )}
          />
        </div>
      </Field>
      <Field label="Lens path (in invocation order)">
        <div data-walk="recommendation-lenspath">
          <LensPathList
            lensPath={lensPath}
            onChange={(next) => patch("lensPath", next)}
          />
        </div>
      </Field>
      <Field label="Caveats text (optional)">
        <div data-walk="recommendation-caveats">
          <textarea
            value={(body.caveatsText as string) ?? ""}
            onChange={(e) =>
              patch("caveatsText", e.target.value || undefined)
            }
            rows={3}
            className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
          />
        </div>
      </Field>
      <Field label="Created at (RFC 3339)">
        <DatetimeInput
          value={(body.occurredAt as string) ?? ""}
          onChange={(v) => patch("occurredAt", v)}
        />
      </Field>
      <div data-walk="recommendation-conditions">
        <ConditionTreeEditor
          label="Conditions (postfix)"
          nodes={(body.conditions as ReadonlyArray<unknown> | undefined)?.map(
            (n) => n as Record<string, unknown>,
          ) ?? []}
          onChange={(next) => patch("conditions", next)}
        />
      </div>
      <div data-walk="recommendation-preconditions">
        <ConditionTreeEditor
          label="Preconditions (postfix, optional)"
          nodes={
            (body.preconditions as ReadonlyArray<unknown> | undefined)?.map(
              (n) => n as Record<string, unknown>,
            ) ?? []
          }
          onChange={(next) =>
            patch(
              "preconditions",
              next.length === 0 ? undefined : next,
            )
          }
        />
      </div>
      <DiffPane draft={draft} />
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-stone-700">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

// `dev.idiolect.defs#lensRef` — `uri` is the at-uri, `cid` an
// optional content-address pin, `direction` an optional invertibility
// hint. All three are optional in the lexicon (lensRef.required is
// empty), but in practice a lens path entry without a `uri` is
// unidentifiable, so the form treats `uri` as the gating field for
// list membership.
type LensDirection = "unidirectional" | "bidirectional";
interface LensRef {
  uri?: string;
  cid?: string;
  direction?: LensDirection;
}

function normaliseLensRef(l: LensRef): LensRef {
  const out: LensRef = {};
  if (l.uri) out.uri = l.uri;
  if (l.cid) out.cid = l.cid;
  if (l.direction) out.direction = l.direction;
  return out;
}

function LensPathList({
  lensPath,
  onChange,
}: {
  lensPath: LensRef[];
  onChange: (next: LensRef[]) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  function commit(next: LensRef[]) {
    onChange(next.map(normaliseLensRef).filter((l) => l.uri && l.uri.length > 0));
  }
  function setField(i: number, patch: Partial<LensRef>) {
    const next = lensPath.map((l, j) => (i === j ? { ...l, ...patch } : l));
    // For non-uri patches we don't want to drop empty-uri rows mid-edit.
    if ("uri" in patch) {
      commit(next);
    } else {
      onChange(next.map(normaliseLensRef));
    }
  }
  function add() {
    onChange([...lensPath.map(normaliseLensRef), { uri: "" }]);
  }
  function remove(i: number) {
    onChange(lensPath.filter((_, j) => j !== i).map(normaliseLensRef));
    if (expanded === i) setExpanded(null);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= lensPath.length) return;
    const next = lensPath.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map(normaliseLensRef));
  }

  const rows = lensPath.length === 0 ? [{ uri: "" } as LensRef] : lensPath;
  const lensPlaceholder = useAtUriPlaceholder(
    "at://did:plc:.../dev.panproto.schema.lens/<rkey>",
  );

  return (
    <div className="flex flex-col gap-2">
      {rows.map((l, i) => {
        const isExpanded = expanded === i;
        const hasMeta = !!(l.cid || l.direction);
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-stone-400 font-mono w-6 text-right">
                {i + 1}.
              </span>
              <div className="flex-1">
                <AtUriAutocomplete
                  value={l.uri ?? ""}
                  onChange={(v) => setField(i, { uri: v })}
                  expectedCollection="dev.panproto.schema.lens"
                  placeholder={lensPlaceholder}
                />
              </div>
              <button
                type="button"
                onClick={() => setExpanded(isExpanded ? null : i)}
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  hasMeta
                    ? "border-stone-400 text-stone-700"
                    : "border-stone-200 text-stone-500"
                } hover:bg-stone-50`}
                title="cid + direction (optional)"
              >
                {isExpanded ? "−" : "…"}
              </button>
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
            {isExpanded && (
              <div className="ml-6 pl-3 border-l border-stone-200 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <label className="flex flex-col gap-0.5 text-xs text-stone-600">
                  <span>cid (optional)</span>
                  <input
                    type="text"
                    value={l.cid ?? ""}
                    onChange={(e) =>
                      setField(i, { cid: e.target.value || undefined })
                    }
                    placeholder="bafy..."
                    className="px-2 py-1 border border-stone-300 rounded font-mono text-xs"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-xs text-stone-600">
                  <span>direction (optional)</span>
                  <select
                    value={l.direction ?? ""}
                    onChange={(e) =>
                      setField(i, {
                        direction:
                          (e.target.value as LensDirection | "") || undefined,
                      })
                    }
                    className="px-2 py-1 border border-stone-300 rounded text-xs bg-white"
                  >
                    <option value="">—</option>
                    <option value="unidirectional">unidirectional</option>
                    <option value="bidirectional">bidirectional</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        );
      })}
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
