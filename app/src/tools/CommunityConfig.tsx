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
import { communityFixtures } from "../fixtures/community";
import { useActiveDid } from "../sessions/placeholders";
import { HandleSearch } from "../components/HandleSearch";
import { useActorProfile } from "../sessions/actorProfile";
import { DatetimeInput } from "../components/DatetimeInput";
import { AtUriAutocomplete } from "../components/AtUriAutocomplete";
import { useAtUriPlaceholder } from "../sessions/placeholders";
import { Tooltip } from "../components/Tooltip";

export function CommunityConfig() {
  const drafts = useWorkspaceStore(useShallow((s) => draftsByKind(s, "community")));
  const activeId = useWorkspaceStore((s) => s.active.community);
  const upsertDraft = useWorkspaceStore((s) => s.upsertDraft);
  const setActive = useWorkspaceStore((s) => s.setActive);

  const active = useMemo(
    () => drafts.find((d) => d.body.id === activeId) ?? null,
    [drafts, activeId],
  );

  function newDraft() {
    const id = mintDraftId("community");
    const draft: Draft = {
      kind: "community",
      body: {
        id,
        label: "untitled",
        body: {
          name: "untitled",
          description: "",
          createdAt: new Date().toISOString(),
        },
      },
    };
    upsertDraft(draft);
    setActive("community", id);
  }

  return (
    <div className="flex flex-col md:flex-row md:h-full min-h-0">
      <div className="flex-1 p-3 sm:p-6 overflow-auto min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Community Config</h2><WalkthroughTrigger flow="community" /></div>
            <p className="text-sm text-stone-600 max-w-prose">
              A community is the federated unit that issues
              recommendations and owns dialects. Members gate
              eligibility predicates; conventions document the rules
              the community has agreed to.
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
            <ImportButton kind="community" fixtures={communityFixtures} />
            <ExportButton draft={active} />
          </div>
        </div>

        {active && <PublishedActions draft={active} />}
        {active ? (
          <CommunityForm draft={active} onChange={upsertDraft} />
        ) : (
          <p className="text-stone-500 text-sm">
            No community selected. Click <em>New</em> or <em>Import</em>.
          </p>
        )}
      </div>
      <GuidancePane draft={active} />
    </div>
  );
}

function CommunityForm({
  draft,
  onChange,
}: {
  draft: Draft & { kind: "community" };
  onChange: (d: Draft) => void;
}) {
  const body = draft.body.body;
  const memberPlaceholder = useActiveDid() ?? "did:plc:...";

  function patch(field: string, value: unknown) {
    const nextBody = {
      ...body,
      [field]: value,
    };
    onChange({ ...draft, body: { ...draft.body, body: nextBody } });
  }
  function patchLabel(label: string) {
    onChange({
      ...draft,
      body: {
        ...draft.body,
        label,
        body: { ...body, name: label },
      },
    });
  }

  const members = (body.members as string[]) ?? [];

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
      <Field label="Description">
        <textarea
          value={(body.description as string) ?? ""}
          onChange={(e) => patch("description", e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 border border-stone-300 rounded"
        />
      </Field>
      <Field label="Members">
        <div data-walk="community-members">
          <MemberList members={members} onChange={(next) => patch("members", next)} placeholder={memberPlaceholder} />
        </div>
      </Field>
      <Field label="Membership roll at-uri (optional)">
        <div data-walk="community-roll">
          <AtUriAutocomplete
            value={(body.membershipRoll as string) ?? ""}
            onChange={(v) => patch("membershipRoll", v || undefined)}
            placeholder={useAtUriPlaceholder("at://did:plc:.../<membership-roll>")}
          />
        </div>
      </Field>
      <div data-walk="community-role-assignments">
      <Field
        label={
          <>
            Role assignments (optional){" "}
            <Tooltip text="Sparse [{did, role}] list for members whose role differs from the implicit default. The role slug resolves through `memberRoleVocab` (canonical idiolect community-roles when omitted: member / moderator / delegate / author).">
              <span className="text-stone-400 font-normal cursor-help">?</span>
            </Tooltip>
          </>
        }
      >
        <RoleAssignmentList
          assignments={
            Array.isArray(body.roleAssignments)
              ? (body.roleAssignments as RoleAssignment[])
              : []
          }
          memberDids={members}
          onChange={(next) =>
            patch("roleAssignments", next.length === 0 ? undefined : next)
          }
        />
      </Field>
      <Field label="Member role vocabulary at-uri (optional)">
        <AtUriAutocomplete
          value={
            ((body.memberRoleVocab as { uri?: string } | undefined)?.uri) ?? ""
          }
          onChange={(v) =>
            patch("memberRoleVocab", v.trim() ? { uri: v } : undefined)
          }
          expectedCollection="dev.idiolect.vocab"
          placeholder="at://...idiolect/dev.idiolect.vocab/community-roles-v1"
        />
      </Field>
      </div>
      <div data-walk="community-record-hosting">
      <Field
        label={
          <>
            Record hosting{" "}
            <Tooltip text="Where this community's records live. `member-hosted` (default ATProto): records on individual member PDSes. `community-hosted` (Acorn-style): records on a community AppView. `hybrid`: both.">
              <span className="text-stone-400 font-normal cursor-help">?</span>
            </Tooltip>
          </>
        }
      >
        <select
          value={(body.recordHosting as string | undefined) ?? ""}
          onChange={(e) =>
            patch("recordHosting", e.target.value || undefined)
          }
          className="px-2 py-1.5 border border-stone-300 rounded w-fit"
        >
          <option value="">(unset; defaults to member-hosted)</option>
          <option value="member-hosted">member-hosted</option>
          <option value="community-hosted">community-hosted</option>
          <option value="hybrid">hybrid</option>
        </select>
      </Field>
      <Field label="AppView endpoint URL (optional)">
        <input
          type="url"
          value={(body.appviewEndpoint as string | undefined) ?? ""}
          onChange={(e) =>
            patch("appviewEndpoint", e.target.value || undefined)
          }
          placeholder="https://example.community"
          className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-sm"
        />
      </Field>
      </div>
      <Field label="Core schemas">
        <div data-walk="community-core-schemas">
          <RefList
            items={Array.isArray(body.coreSchemas) ? (body.coreSchemas as Ref[]) : []}
            onChange={(next) => patch("coreSchemas", next.length === 0 ? undefined : next)}
            kind="schema"
          />
        </div>
      </Field>
      <Field label="Core lenses">
        <div data-walk="community-core-lenses">
          <RefList
            items={Array.isArray(body.coreLenses) ? (body.coreLenses as Ref[]) : []}
            onChange={(next) => patch("coreLenses", next.length === 0 ? undefined : next)}
            kind="lens"
          />
        </div>
      </Field>
      <Field label="Endorsed communities">
        <div data-walk="community-endorsed">
          <AtUriList
            items={
              Array.isArray(body.endorsedCommunities)
                ? (body.endorsedCommunities as string[])
                : []
            }
            onChange={(next) =>
              patch("endorsedCommunities", next.length === 0 ? undefined : next)
            }
            expectedCollection="dev.idiolect.community"
            placeholderHint="at://did:plc:.../dev.idiolect.community/main"
          />
        </div>
      </Field>
      <div data-walk="community-conventions" className="grid grid-cols-1 gap-4">
      <Field label="Conventions">
        <ConventionsList
          items={Array.isArray(body.conventions) ? (body.conventions as Convention[]) : []}
          onChange={(next) =>
            patch("conventions", next.length === 0 ? undefined : next)
          }
        />
      </Field>
      <Field label="Conventions text (optional)">
        <div data-walk="community-conventions-text">
          <textarea
            value={(body.conventionsText as string) ?? ""}
            onChange={(e) =>
              patch("conventionsText", e.target.value || undefined)
            }
            rows={4}
            className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
          />
        </div>
      </Field>
      </div>
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

// `dev.idiolect.defs#schemaRef` and `lensRef` share the same shape:
// `{ uri?: string, cid?: string, ... }`. The form edits `uri`
// (autocompleted as an at-uri) and preserves any cid set via
// import roundtrip.
interface Ref {
  uri?: string;
  cid?: string;
}

function RefList({
  items,
  onChange,
  kind,
}: {
  items: Ref[];
  onChange: (next: Ref[]) => void;
  kind: "schema" | "lens";
}) {
  const expectedCollection =
    kind === "lens" ? "dev.panproto.schema.lens" : undefined;
  const placeholder = useAtUriPlaceholder(
    kind === "lens"
      ? "at://did:plc:.../dev.panproto.schema.lens/<rkey>"
      : "at://did:plc:.../<schema-rkey>",
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
              expectedCollection={expectedCollection}
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
        + {kind}
      </button>
    </div>
  );
}

function AtUriList({
  items,
  onChange,
  expectedCollection,
  placeholderHint,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  expectedCollection?: string;
  placeholderHint: string;
}) {
  const placeholder = useAtUriPlaceholder(placeholderHint);
  function setAt(i: number, v: string) {
    const next = items.map((u, j) => (j === i ? v : u));
    onChange(next.filter((u) => u.length > 0));
  }
  function add() {
    onChange([...items, ""]);
  }
  function remove(i: number) {
    onChange(items.filter((_, j) => j !== i));
  }
  const rows = items.length === 0 ? [""] : items;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((u, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <AtUriAutocomplete
              value={u}
              onChange={(v) => setAt(i, v)}
              expectedCollection={expectedCollection}
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
        + at-uri
      </button>
    </div>
  );
}

function MemberList({
  members,
  onChange,
  placeholder,
}: {
  members: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [adding, setAdding] = useState(false);

  function commit(did: string) {
    if (!did || did.trim().length === 0) {
      setAdding(false);
      return;
    }
    if (members.includes(did)) {
      setAdding(false);
      return;
    }
    onChange([...members, did]);
    setAdding(false);
  }
  function remove(did: string) {
    onChange(members.filter((m) => m !== did));
  }

  return (
    <div className="flex flex-col gap-2">
      {members.map((did) => (
        <MemberCard key={did} did={did} onRemove={() => remove(did)} />
      ))}
      {adding ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <HandleSearch
              value=""
              onChange={commit}
              placeholder={placeholder}
            />
          </div>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-stone-500 text-xs px-1"
            title="Cancel"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start text-xs text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50"
        >
          + member
        </button>
      )}
    </div>
  );
}

// `community.roleAssignments` is `array<#roleAssignment>`. Each
// item carries a member did plus a role slug resolved through
// `memberRoleVocab` (canonical idiolect community-roles when unset).
interface RoleAssignment {
  did: string;
  role: string;
}

const KNOWN_ROLES = ["member", "moderator", "delegate", "author"] as const;

function RoleAssignmentList({
  assignments,
  memberDids,
  onChange,
}: {
  assignments: RoleAssignment[];
  memberDids: string[];
  onChange: (next: RoleAssignment[]) => void;
}) {
  function patchAt(i: number, partial: Partial<RoleAssignment>) {
    onChange(
      assignments.map((a, j) => (j === i ? { ...a, ...partial } : a)),
    );
  }
  function removeAt(i: number) {
    onChange(assignments.filter((_, j) => j !== i));
  }
  function add() {
    onChange([
      ...assignments,
      { did: memberDids[0] ?? "", role: "moderator" },
    ]);
  }

  return (
    <div className="flex flex-col gap-1">
      {assignments.length === 0 ? (
        <p className="text-xs text-stone-500">
          No role assignments. The default role from the role
          vocabulary's top node applies to every member with no entry.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {assignments.map((a, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center gap-2 border border-stone-200 rounded px-2 py-1 bg-white"
            >
              <div className="flex-1 min-w-[12rem]">
                <HandleSearch
                  value={a.did}
                  onChange={(did) => patchAt(i, { did })}
                  placeholder="handle or did:plc:..."
                  className="w-full px-2 py-1 border border-stone-200 rounded font-mono text-xs"
                />
              </div>
              <RoleSlugSelect
                value={a.role}
                onChange={(v) => patchAt(i, { role: v })}
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-stone-500 hover:text-red-700 px-1 text-xs"
                title="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={add}
        className="self-start text-xs text-stone-700 underline"
      >
        + role assignment
      </button>
    </div>
  );
}

function RoleSlugSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inKnown = (KNOWN_ROLES as readonly string[]).includes(value);
  const [customMode, setCustomMode] = useState(value !== "" && !inKnown);
  const isCustom = customMode || (value !== "" && !inKnown);
  return (
    <div className="flex items-center gap-1">
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
        className="px-2 py-1 border border-stone-200 rounded text-xs"
      >
        {KNOWN_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
        <option value="__custom__">custom…</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="community-extended-role"
          className="px-2 py-1 border border-stone-200 rounded font-mono text-xs"
          autoFocus
        />
      )}
    </div>
  );
}

// `community.conventions` is `array<union<#conventionReviewCadence,
// #conventionVerificationReq, #conventionDeprecationPolicy>>`. Each
// item carries a `$type` discriminator atproto unions use.
type ConventionType =
  | "dev.idiolect.community#conventionReviewCadence"
  | "dev.idiolect.community#conventionVerificationReq"
  | "dev.idiolect.community#conventionDeprecationPolicy";

const VERIFICATION_KINDS = [
  "roundtrip-test",
  "property-test",
  "formal-proof",
  "conformance-test",
  "static-check",
  "convergence-preserving",
] as const;

type Convention =
  | {
      $type: "dev.idiolect.community#conventionReviewCadence";
      maxDays: number;
      scope?: string;
    }
  | {
      $type: "dev.idiolect.community#conventionVerificationReq";
      kind: (typeof VERIFICATION_KINDS)[number];
      property?: Record<string, unknown>;
    }
  | {
      $type: "dev.idiolect.community#conventionDeprecationPolicy";
      noticePeriodDays: number;
      replacementRequired?: boolean;
    };

const CONVENTION_LABEL: Record<ConventionType, string> = {
  "dev.idiolect.community#conventionReviewCadence": "Review cadence",
  "dev.idiolect.community#conventionVerificationReq": "Verification requirement",
  "dev.idiolect.community#conventionDeprecationPolicy": "Deprecation policy",
};

function blankConvention($type: ConventionType): Convention {
  switch ($type) {
    case "dev.idiolect.community#conventionReviewCadence":
      return { $type, maxDays: 7 };
    case "dev.idiolect.community#conventionVerificationReq":
      return { $type, kind: "roundtrip-test" };
    case "dev.idiolect.community#conventionDeprecationPolicy":
      return { $type, noticePeriodDays: 30 };
  }
}

function ConventionsList({
  items,
  onChange,
}: {
  items: Convention[];
  onChange: (next: Convention[]) => void;
}) {
  const [adding, setAdding] = useState(false);

  function update(idx: number, patch: Partial<Convention>) {
    const next = items.slice();
    next[idx] = { ...next[idx], ...patch } as Convention;
    onChange(next);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }
  function move(idx: number, delta: number) {
    const target = idx + delta;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }
  function add($type: ConventionType) {
    onChange([...items, blankConvention($type)]);
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <p className="text-xs text-stone-500">
          No conventions yet. Communities use these as the structured,
          decidable subset of their rules (review cadence, required
          verifications, deprecation policy). Free-form norms go in
          conventions text below.
        </p>
      )}
      {items.map((item, idx) => (
        <ConventionCard
          key={idx}
          item={item}
          onChange={(patch) => update(idx, patch)}
          onRemove={() => remove(idx)}
          onMoveUp={idx > 0 ? () => move(idx, -1) : undefined}
          onMoveDown={
            idx < items.length - 1 ? () => move(idx, 1) : undefined
          }
        />
      ))}
      {adding ? (
        <div className="flex flex-wrap gap-2 items-center">
          {(Object.keys(CONVENTION_LABEL) as ConventionType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => add(t)}
              className="px-2 py-1 text-xs rounded border border-stone-300 bg-white hover:bg-stone-50"
            >
              {CONVENTION_LABEL[t]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-stone-500 text-xs px-1"
            title="Cancel"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="self-start text-xs text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50"
        >
          + convention
        </button>
      )}
    </div>
  );
}

function ConventionCard({
  item,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: Convention;
  onChange: (patch: Partial<Convention>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  return (
    <div className="border border-stone-200 rounded bg-white">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-stone-100 bg-stone-50">
        <span className="text-xs font-semibold text-stone-700">
          {CONVENTION_LABEL[item.$type]}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            disabled={!onMoveUp}
            onClick={onMoveUp}
            className="text-stone-400 hover:text-stone-700 disabled:opacity-30 text-xs px-1"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={!onMoveDown}
            onClick={onMoveDown}
            className="text-stone-400 hover:text-stone-700 disabled:opacity-30 text-xs px-1"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-stone-500 hover:text-red-700 text-sm px-1"
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>
      <div className="px-3 py-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {item.$type === "dev.idiolect.community#conventionReviewCadence" && (
          <>
            <SmallField label="Max business-days">
              <input
                type="number"
                min={0}
                value={item.maxDays}
                onChange={(e) =>
                  onChange({ maxDays: parseIntOrZero(e.target.value) })
                }
                className="w-full px-2 py-1 border border-stone-300 rounded text-sm"
              />
            </SmallField>
            <SmallField label="Scope (optional)">
              <input
                type="text"
                value={item.scope ?? ""}
                onChange={(e) =>
                  onChange({ scope: e.target.value || undefined })
                }
                placeholder="lens-review / verification-review / all"
                className="w-full px-2 py-1 border border-stone-300 rounded text-sm"
              />
            </SmallField>
          </>
        )}
        {item.$type === "dev.idiolect.community#conventionVerificationReq" && (
          <SmallField label="Verification kind">
            <select
              value={item.kind}
              onChange={(e) =>
                onChange({
                  kind: e.target.value as (typeof VERIFICATION_KINDS)[number],
                })
              }
              className="w-full px-2 py-1 border border-stone-300 rounded text-sm bg-white"
            >
              {VERIFICATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </SmallField>
        )}
        {item.$type === "dev.idiolect.community#conventionDeprecationPolicy" && (
          <>
            <SmallField label="Notice period (days)">
              <input
                type="number"
                min={0}
                value={item.noticePeriodDays}
                onChange={(e) =>
                  onChange({
                    noticePeriodDays: parseIntOrZero(e.target.value),
                  })
                }
                className="w-full px-2 py-1 border border-stone-300 rounded text-sm"
              />
            </SmallField>
            <SmallField label="Replacement required?">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={!!item.replacementRequired}
                  onChange={(e) =>
                    onChange({
                      replacementRequired: e.target.checked || undefined,
                    })
                  }
                />
                <span>
                  Yes, deprecations must point at a replacement lens
                </span>
              </label>
            </SmallField>
          </>
        )}
      </div>
    </div>
  );
}

function SmallField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-stone-600">
      <span>{label}</span>
      {children}
    </label>
  );
}

function parseIntOrZero(v: string): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function MemberCard({
  did,
  onRemove,
}: {
  did: string;
  onRemove: () => void;
}) {
  const profile = useActorProfile(did);
  const handle = profile?.handle;
  const display = profile?.displayName;
  const avatar = profile?.avatar;
  const initials = (handle ?? did).slice(handle ? 0 : 8, handle ? 2 : 10).toUpperCase();

  return (
    <div className="flex items-center gap-3 px-3 py-2 border border-stone-200 rounded bg-white">
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <span className="w-9 h-9 rounded-full bg-stone-200 flex-shrink-0 flex items-center justify-center text-[11px] font-mono text-stone-600">
          {initials}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">
          {handle ? `@${handle}` : did}
          {display && (
            <span className="ml-2 text-stone-500 font-normal">
              {display}
            </span>
          )}
        </div>
        <div className="font-mono text-[11px] text-stone-500 truncate">
          {did}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-stone-500 hover:text-red-700 text-sm px-1"
        title="Remove member"
      >
        ×
      </button>
    </div>
  );
}
