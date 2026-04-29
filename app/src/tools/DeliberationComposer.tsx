import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useWorkspaceStore, draftsByKind } from "../workspace/store";
import { mintDraftId } from "../workspace/ids";
import type { Draft } from "../workspace/types";
import { ImportButton } from "../components/ImportButton";
import { PublishedActions } from "../components/PublishedActions";
import { ExportButton } from "../components/ExportButton";
import { GuidancePane } from "../components/GuidancePane";
import { deliberationFixtures } from "../fixtures/deliberation";
import { useAtUriPlaceholder } from "../sessions/placeholders";
import { AtUriAutocomplete } from "../components/AtUriAutocomplete";
import { Tooltip } from "../components/Tooltip";
import { DatetimeInput } from "../components/DatetimeInput";

// Open-enum slug sets straight from the lexicon's knownValues.
// Authors pick a canonical default from the dropdown or type their
// own slug into the input next to it. Setting a custom slug records
// it via the open-enum `Other(String)` variant on the wire form;
// the corresponding `*Vocab` field tells consumers which vocabulary
// to resolve the slug against.
const CLASSIFICATION_KNOWN = [
  "question",
  "proposal",
  "grievance",
  "retrospective",
] as const;

const STATUS_KNOWN = [
  "open",
  "closed",
  "tabled",
  "adopted",
  "rejected",
] as const;

export function DeliberationComposer() {
  const drafts = useWorkspaceStore(
    useShallow((s) => draftsByKind(s, "deliberation")),
  );
  const activeId = useWorkspaceStore((s) => s.active.deliberation);
  const upsertDraft = useWorkspaceStore((s) => s.upsertDraft);
  const setActive = useWorkspaceStore((s) => s.setActive);

  const active = useMemo(
    () => drafts.find((d) => d.body.id === activeId) ?? null,
    [drafts, activeId],
  );

  function newDraft() {
    const id = mintDraftId("deliberation");
    const draft: Draft = {
      kind: "deliberation",
      body: {
        id,
        label: "untitled",
        body: {
          owningCommunity: "",
          topic: "untitled",
          createdAt: new Date().toISOString(),
        },
      },
    };
    upsertDraft(draft);
    setActive("deliberation", id);
  }

  return (
    <div className="flex flex-col md:flex-row md:h-full min-h-0">
      <div className="flex-1 p-3 sm:p-6 overflow-auto min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Deliberation Composer</h2>
            <p className="text-sm text-stone-600 max-w-prose">
              A deliberation is a community-scoped question or
              proposal under collective consideration. Statements
              attach to it via strong-ref. Votes attach to statements.
              An observer-published outcome record summarises the
              tally once it closes.
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
            <ImportButton kind="deliberation" fixtures={deliberationFixtures} />
            <ExportButton draft={active} />
          </div>
        </div>

        {active && <PublishedActions draft={active} />}
        {active ? (
          <DeliberationForm draft={active} onChange={upsertDraft} />
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
      <p className="font-medium">No deliberation selected.</p>
      <p className="text-sm mt-2">
        Click <em>New</em> to start from scratch, <em>Import</em> to
        load an existing record, or pick from the sidebar once you
        have drafts.
      </p>
    </div>
  );
}

function DeliberationForm({
  draft,
  onChange,
}: {
  draft: Draft & { kind: "deliberation" };
  onChange: (d: Draft) => void;
}) {
  const body = draft.body.body;

  function patch(field: string, value: unknown) {
    const nextBody = { ...body, [field]: value };
    const next: Draft = {
      ...draft,
      body: { ...draft.body, body: nextBody },
    };
    onChange(next);
  }

  function patchTopic(topic: string) {
    const next: Draft = {
      ...draft,
      body: {
        ...draft.body,
        // The label mirrors `topic`. Deliberations have no `name`
        // field, so the user-visible label tracks the question.
        label: topic,
        body: { ...body, topic },
      },
    };
    onChange(next);
  }

  return (
    <form className="grid grid-cols-1 gap-4 max-w-2xl">
      <div data-walk="deliberation-owning-community">
      <Field
        label={
          <>
            Owning community at-uri{" "}
            <Tooltip text="The community whose membership is deliberating. Resolves member permissions and dialect preferences for clients reading the deliberation.">
              <span className="text-stone-400 font-normal cursor-help">
                ?
              </span>
            </Tooltip>
          </>
        }
      >
        <AtUriAutocomplete
          value={(body.owningCommunity as string) ?? ""}
          onChange={(v) => patch("owningCommunity", v)}
          expectedCollection="dev.idiolect.community"
          placeholder={useAtUriPlaceholder(
            "at://did:plc:.../dev.idiolect.community/main",
          )}
        />
      </Field>
      </div>

      <div data-walk="deliberation-topic">
      <Field label="Topic">
        <input
          type="text"
          value={(body.topic as string) ?? ""}
          onChange={(e) => patchTopic(e.target.value)}
          maxLength={1000}
          className="w-full px-2 py-1.5 border border-stone-300 rounded"
          placeholder="The question or proposal under consideration"
        />
      </Field>

      <Field label="Description (optional)">
        <textarea
          value={(body.description as string) ?? ""}
          onChange={(e) => patch("description", e.target.value || undefined)}
          rows={4}
          maxLength={5000}
          className="w-full px-2 py-1.5 border border-stone-300 rounded"
          placeholder="Long-form context. Motivation, constraints, prior history."
        />
      </Field>
      </div>

      <div data-walk="deliberation-classification-status" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label={
            <>
              Classification{" "}
              <Tooltip text="Open-enum slug naming the deliberation's argumentative shape. Pick a canonical default or type a community-extended slug. Resolved through `classificationVocab`.">
                <span className="text-stone-400 font-normal cursor-help">
                  ?
                </span>
              </Tooltip>
            </>
          }
        >
          <OpenEnumSelect
            value={(body.classification as string | undefined) ?? ""}
            knownValues={CLASSIFICATION_KNOWN}
            onChange={(v) => patch("classification", v || undefined)}
          />
        </Field>

        <Field
          label={
            <>
              Status{" "}
              <Tooltip text="Open-enum lifecycle marker. `closed` subsumes the terminal forms. Observer tallies key off this for outcome publication.">
                <span className="text-stone-400 font-normal cursor-help">
                  ?
                </span>
              </Tooltip>
            </>
          }
        >
          <OpenEnumSelect
            value={(body.status as string | undefined) ?? ""}
            knownValues={STATUS_KNOWN}
            onChange={(v) => patch("status", v || undefined)}
          />
        </Field>
      </div>

      <div data-walk="deliberation-vocabs">
      <Field label="Classification vocabulary at-uri (optional)">
        <AtUriAutocomplete
          value={
            ((body.classificationVocab as { uri?: string } | undefined)?.uri) ??
            ""
          }
          onChange={(v) =>
            patch(
              "classificationVocab",
              v ? { uri: v } : undefined,
            )
          }
          expectedCollection="dev.idiolect.vocab"
          placeholder="at://...idiolect/dev.idiolect.vocab/deliberation-classifications-v1"
        />
      </Field>

      <Field label="Status vocabulary at-uri (optional)">
        <AtUriAutocomplete
          value={
            ((body.statusVocab as { uri?: string } | undefined)?.uri) ?? ""
          }
          onChange={(v) =>
            patch("statusVocab", v ? { uri: v } : undefined)
          }
          expectedCollection="dev.idiolect.vocab"
          placeholder="at://...idiolect/dev.idiolect.vocab/deliberation-statuses-v1"
        />
      </Field>
      </div>

      <div data-walk="deliberation-lifecycle" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Auth required">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={(body.authRequired as boolean | undefined) ?? true}
              onChange={(e) => patch("authRequired", e.target.checked)}
            />
            <span className="text-sm text-stone-700">
              Require members to be authenticated
            </span>
          </label>
        </Field>

        <Field label="Closed at (optional)">
          <DatetimeInput
            value={(body.closedAt as string | undefined) ?? ""}
            onChange={(v) => patch("closedAt", v || undefined)}
            placeholder="2026-05-15T00:00:00.000Z"
          />
        </Field>
      </div>

      <div data-walk="deliberation-outcome-link">
      <Field
        label={
          <>
            Outcome at-uri (optional){" "}
            <Tooltip text="Set after closure to point at a published `dev.idiolect.deliberationOutcome` record. Lets clients fetch the resolution without re-folding every vote.">
              <span className="text-stone-400 font-normal cursor-help">
                ?
              </span>
            </Tooltip>
          </>
        }
      >
        <AtUriAutocomplete
          value={(body.outcome as string | undefined) ?? ""}
          onChange={(v) => patch("outcome", v || undefined)}
          expectedCollection="dev.idiolect.deliberationOutcome"
          placeholder="at://.../dev.idiolect.deliberationOutcome/..."
        />
      </Field>
      </div>

      <Field label="Created at">
        <DatetimeInput
          value={(body.createdAt as string) ?? ""}
          onChange={(v) => patch("createdAt", v)}
        />
      </Field>
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
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

function OpenEnumSelect({
  value,
  knownValues,
  onChange,
}: {
  value: string;
  knownValues: readonly string[];
  onChange: (v: string) => void;
}) {
  // Custom mode persists locally so the text input stays mounted
  // while the user types — the slug starts blank when custom is
  // first picked, and `""` would otherwise classify as known and
  // hide the input. A non-empty value that's not in knownValues
  // implicitly enters custom mode.
  const [customMode, setCustomMode] = useState(
    value !== "" && !knownValues.includes(value),
  );
  const isCustom = customMode || (value !== "" && !knownValues.includes(value));
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <select
        value={isCustom ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setCustomMode(true);
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
        className="px-2 py-1.5 border border-stone-300 rounded sm:max-w-[12rem]"
      >
        <option value="">(unset)</option>
        {knownValues.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
        <option value="__custom__">custom slug…</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1.5 border border-stone-300 rounded"
          placeholder="community-extended-slug"
          autoFocus
        />
      )}
    </div>
  );
}
