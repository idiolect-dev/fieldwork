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
import { communityFixtures } from "../fixtures/community";
import { useState } from "react";
import { useActiveDid } from "../sessions/placeholders";
import { HandleSearch } from "../components/HandleSearch";
import { useActorProfile } from "../sessions/actorProfile";
import { DatetimeInput } from "../components/DatetimeInput";

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
      <div data-walk="community-conventions" className="grid grid-cols-1 gap-4">
      <Field label="Conventions URI (optional)">
        <input
          type="text"
          value={
            typeof body.conventions === "string" ? body.conventions : ""
          }
          onChange={(e) => patch("conventions", e.target.value || undefined)}
          placeholder="https://example.com/conventions"
          className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-sm"
        />
      </Field>
      <Field label="Conventions text (optional)">
        <textarea
          value={(body.conventionsText as string) ?? ""}
          onChange={(e) =>
            patch("conventionsText", e.target.value || undefined)
          }
          rows={4}
          className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
        />
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
