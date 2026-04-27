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
import { vocabFixtures } from "../fixtures/vocab";
import { useAtUriPlaceholder } from "../sessions/placeholders";
import { AtUriAutocomplete } from "../components/AtUriAutocomplete";
import { Tooltip } from "../components/Tooltip";
import { DatetimeInput } from "../components/DatetimeInput";

interface ActionEntry {
  id: string;
  parents: string[];
  description?: string;
  class?: string;
}

export function VocabularyEditor() {
  const drafts = useWorkspaceStore(useShallow((s) => draftsByKind(s, "vocab")));
  const activeId = useWorkspaceStore((s) => s.active.vocab);
  const upsertDraft = useWorkspaceStore((s) => s.upsertDraft);
  const setActive = useWorkspaceStore((s) => s.setActive);

  const active = useMemo(
    () => drafts.find((d) => d.body.id === activeId) ?? null,
    [drafts, activeId],
  );

  function newDraft() {
    const id = mintDraftId("vocab");
    const draft: Draft = {
      kind: "vocab",
      body: {
        id,
        label: "untitled",
        body: {
          name: "untitled",
          world: "open",
          top: "any_action",
          actions: [{ id: "any_action", parents: [] }],
          occurredAt: new Date().toISOString(),
        },
      },
    };
    upsertDraft(draft);
    setActive("vocab", id);
  }

  return (
    <div className="flex flex-col md:flex-row md:h-full min-h-0">
      <div className="flex-1 p-3 sm:p-6 overflow-auto min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Vocabulary Editor</h2><WalkthroughTrigger flow="vocab" /></div>
            <p className="text-sm text-stone-600 max-w-prose">
              An action / purpose hierarchy with a world discipline.
              Encounters cite the at-uri to ground their action and
              purpose strings; observations roll up encounter counts
              under each ancestor entry.
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
            <ImportButton kind="vocab" fixtures={vocabFixtures} />
            <ExportButton draft={active} />
          </div>
        </div>

        {active && <PublishedActions draft={active} />}
        {active ? (
          <VocabForm draft={active} onChange={upsertDraft} />
        ) : (
          <p className="text-stone-500 text-sm">
            No vocabulary selected. Click <em>New</em> or <em>Import</em>.
          </p>
        )}
      </div>
      <GuidancePane draft={active} />
    </div>
  );
}

function VocabForm({
  draft,
  onChange,
}: {
  draft: Draft & { kind: "vocab" };
  onChange: (d: Draft) => void;
}) {
  const body = draft.body.body;
  const actions = (body.actions as ActionEntry[]) ?? [];
  const top = (body.top as string) ?? "";
  const issues = useMemo(() => validate(actions, top), [actions, top]);

  function patch(field: string, value: unknown) {
    const nextBody = { ...body, [field]: value };
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

  function setActions(next: ActionEntry[]) {
    patch("actions", next);
  }

  return (
    <form className="grid grid-cols-1 gap-4 max-w-3xl">
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
            World discipline{" "}
            <Tooltip text="Picks the closure semantics for the lattice. open: undeclared ids are incomparable. hierarchy-closed: only declared edges hold. closed-with-default: the top entry rolls up everything undeclared.">
              <span className="text-stone-400 font-normal cursor-help">
                ?
              </span>
            </Tooltip>
          </>
        }
      >
        <div data-walk="vocab-world">
          <select
          value={(body.world as string) ?? "open"}
          onChange={(e) => patch("world", e.target.value)}
          className="px-2 py-1 border border-stone-300 rounded w-fit"
        >
          <option value="open">open (anyone can extend)</option>
          <option value="hierarchy-closed">
            hierarchy-closed (declared subsumers only)
          </option>
          <option value="closed-with-default">
            closed-with-default (top rolls up everything)
          </option>
        </select>
        </div>
      </Field>
      <Field label="Top action id">
        <div data-walk="vocab-top">
          <input
            type="text"
            value={top}
            onChange={(e) => patch("top", e.target.value)}
            placeholder="any_action"
            list={`vocab-entries-${draft.body.id}`}
            className="w-full px-2 py-1.5 border border-stone-300 rounded font-mono text-sm"
          />
          <datalist id={`vocab-entries-${draft.body.id}`}>
            {actions.map((a) => (
              <option key={a.id} value={a.id} />
            ))}
          </datalist>
        </div>
      </Field>
      <Field label="Supersedes (optional at-uri to a prior vocabulary)">
        <div data-walk="vocab-supersedes">
          <AtUriAutocomplete
            value={(body.supersedes as string) ?? ""}
            onChange={(v) =>
              patch("supersedes", v.trim() || undefined)
            }
            expectedCollection="dev.idiolect.vocab"
            placeholder={useAtUriPlaceholder(
              "at://did:plc:.../dev.idiolect.vocab/<rkey>",
            )}
          />
        </div>
      </Field>
      <Field label="Created at (RFC 3339)">
        <DatetimeInput
          value={(body.occurredAt as string) ?? ""}
          onChange={(v) => patch("occurredAt", v)}
        />
      </Field>

      <div className="flex items-baseline justify-between mt-4">
        <h3 className="font-semibold">Entries</h3>
        <span className="text-xs text-stone-500">
          {actions.length} {actions.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div data-walk="vocab-entries">
        <ActionTable actions={actions} onChange={setActions} />
      </div>

      <ValidationPanel issues={issues} />
      <div data-walk="vocab-preview">
        <HierarchyPreview actions={actions} top={top} />
      </div>

      <DiffPane draft={draft} />
    </form>
  );
}

function ActionTable({
  actions,
  onChange,
}: {
  actions: ActionEntry[];
  onChange: (a: ActionEntry[]) => void;
}) {
  function patchEntry(i: number, partial: Partial<ActionEntry>) {
    const next = actions.map((a, j) => (i === j ? { ...a, ...partial } : a));
    onChange(next);
  }
  function addEntry() {
    onChange([...actions, { id: "", parents: [] }]);
  }
  function removeEntry(i: number) {
    onChange(actions.filter((_, j) => j !== i));
  }
  function moveEntry(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= actions.length) return;
    const next = actions.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="border border-stone-200 rounded overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-stone-100 text-left">
          <tr>
            <th className="px-2 py-1 w-8" />
            <th className="px-2 py-1">id</th>
            <th className="px-2 py-1">parents</th>
            <th className="px-2 py-1">class (optional)</th>
            <th className="px-2 py-1">description</th>
            <th className="px-2 py-1 w-8" />
          </tr>
        </thead>
        <tbody>
          {actions.map((a, i) => (
            <tr key={i} className="border-t border-stone-100 align-top">
              <td className="p-1 text-stone-400 text-[10px] font-mono leading-tight">
                <button
                  type="button"
                  onClick={() => moveEntry(i, -1)}
                  className="block w-full hover:text-stone-700"
                  title="Move up"
                  disabled={i === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveEntry(i, 1)}
                  className="block w-full hover:text-stone-700"
                  title="Move down"
                  disabled={i === actions.length - 1}
                >
                  ↓
                </button>
              </td>
              <td className="p-1">
                <input
                  type="text"
                  value={a.id}
                  onChange={(e) => patchEntry(i, { id: e.target.value })}
                  className="w-full px-2 py-1 border border-stone-200 rounded font-mono text-xs"
                />
              </td>
              <td className="p-1">
                <ParentsPicker
                  parents={a.parents}
                  selfId={a.id}
                  available={actions.map((x) => x.id).filter(Boolean)}
                  onChange={(next) => patchEntry(i, { parents: next })}
                />
              </td>
              <td className="p-1">
                <input
                  type="text"
                  value={a.class ?? ""}
                  onChange={(e) =>
                    patchEntry(i, { class: e.target.value || undefined })
                  }
                  placeholder="asserted_use"
                  list="vocab-class-options"
                  className="w-full px-2 py-1 border border-stone-200 rounded font-mono text-xs"
                />
                <datalist id="vocab-class-options">
                  <option value="dev.idiolect.asserted_use" />
                  <option value="dev.idiolect.intended_use" />
                  <option value="dev.idiolect.permitted_use" />
                </datalist>
              </td>
              <td className="p-1">
                <input
                  type="text"
                  value={a.description ?? ""}
                  onChange={(e) =>
                    patchEntry(i, {
                      description: e.target.value || undefined,
                    })
                  }
                  className="w-full px-2 py-1 border border-stone-200 rounded text-xs"
                />
              </td>
              <td className="p-1 text-right">
                <button
                  type="button"
                  onClick={() => removeEntry(i)}
                  className="text-stone-500 text-xs"
                  title="Delete row"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 border-t border-stone-100 bg-stone-50">
        <button
          type="button"
          onClick={addEntry}
          className="text-sm text-stone-700"
        >
          + entry
        </button>
      </div>
    </div>
  );
}

interface Issue {
  level: "error" | "warning";
  message: string;
}

// Lint pass over the vocabulary structure. Surfaces issues that the
// PDS schema validator wouldn't catch on its own (cycles, undeclared
// parents, duplicate ids, missing top, wrong root parents).
function validate(actions: ActionEntry[], top: string): Issue[] {
  const issues: Issue[] = [];
  const ids = new Set<string>();
  const dupes = new Set<string>();
  for (const a of actions) {
    if (!a.id) continue;
    if (ids.has(a.id)) dupes.add(a.id);
    ids.add(a.id);
  }
  for (const id of dupes) {
    issues.push({ level: "error", message: `Duplicate id: ${id}` });
  }

  if (top && !ids.has(top)) {
    issues.push({
      level: "error",
      message: `Top "${top}" is not declared as an entry`,
    });
  }

  for (const a of actions) {
    if (!a.id) {
      issues.push({ level: "error", message: "Entry has empty id" });
      continue;
    }
    for (const p of a.parents) {
      if (!ids.has(p)) {
        issues.push({
          level: "error",
          message: `Entry "${a.id}" references undeclared parent "${p}"`,
        });
      }
      if (p === a.id) {
        issues.push({
          level: "error",
          message: `Entry "${a.id}" lists itself as a parent`,
        });
      }
    }
    if (a.id === top && a.parents.length > 0) {
      issues.push({
        level: "warning",
        message: `Top "${a.id}" should have no parents`,
      });
    }
    if (a.id !== top && a.parents.length === 0) {
      issues.push({
        level: "warning",
        message: `Entry "${a.id}" is orphan (no parents and not the top)`,
      });
    }
  }

  // Cycle detection via iterative DFS.
  const parents = new Map<string, string[]>();
  for (const a of actions) parents.set(a.id, a.parents);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function dfs(id: string, path: string[]): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      const cycle = [...path.slice(path.indexOf(id)), id].join(" → ");
      issues.push({ level: "error", message: `Cycle detected: ${cycle}` });
      return;
    }
    visiting.add(id);
    for (const p of parents.get(id) ?? []) {
      if (parents.has(p)) dfs(p, [...path, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) dfs(id, []);

  return issues;
}

function ValidationPanel({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs px-3 py-2 rounded">
        No structural issues found.
      </div>
    );
  }
  return (
    <div className="border border-stone-200 rounded">
      <div className="bg-stone-100 text-stone-700 text-xs font-medium px-3 py-1">
        Structural issues ({issues.length})
      </div>
      <ul className="divide-y divide-stone-100">
        {issues.map((iss, i) => (
          <li
            key={i}
            className={`px-3 py-2 text-xs ${
              iss.level === "error"
                ? "bg-red-50 text-red-900"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            <span className="font-mono uppercase mr-2">{iss.level}</span>
            {iss.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface TreeNode {
  id: string;
  children: TreeNode[];
}

// Build a parents-first tree rooted at `top`. Multi-parent entries
// only appear under their first parent in the displayed tree;
// remaining-parent edges are summarised in a footer beneath each
// entry's row.
function buildTree(actions: ActionEntry[], top: string): TreeNode | null {
  if (!top) return null;
  const byId = new Map<string, ActionEntry>();
  for (const a of actions) byId.set(a.id, a);
  if (!byId.has(top)) return null;

  // children[parent] = ids of entries that list parent first.
  const children = new Map<string, string[]>();
  for (const a of actions) {
    if (a.id === top) continue;
    const head = a.parents[0];
    if (!head || !byId.has(head)) continue;
    const arr = children.get(head) ?? [];
    arr.push(a.id);
    children.set(head, arr);
  }

  const seen = new Set<string>();
  function build(id: string): TreeNode {
    seen.add(id);
    const kids = (children.get(id) ?? [])
      .filter((c) => !seen.has(c))
      .map((c) => build(c));
    return { id, children: kids };
  }
  return build(top);
}

function HierarchyPreview({
  actions,
  top,
}: {
  actions: ActionEntry[];
  top: string;
}) {
  const tree = useMemo(() => buildTree(actions, top), [actions, top]);
  const byId = useMemo(() => {
    const m = new Map<string, ActionEntry>();
    for (const a of actions) m.set(a.id, a);
    return m;
  }, [actions]);

  if (!tree) {
    return (
      <div className="border border-stone-200 rounded p-3 text-xs text-stone-500">
        Hierarchy preview unavailable; declare a top entry first.
      </div>
    );
  }

  return (
    <div className="border border-stone-200 rounded">
      <div className="bg-stone-100 text-stone-700 text-xs font-medium px-3 py-1">
        Hierarchy preview
      </div>
      <div className="p-3 text-xs font-mono">
        <Branch node={tree} byId={byId} depth={0} />
      </div>
    </div>
  );
}

function Branch({
  node,
  byId,
  depth,
}: {
  node: TreeNode;
  byId: Map<string, ActionEntry>;
  depth: number;
}) {
  const entry = byId.get(node.id);
  const extraParents = entry ? entry.parents.slice(1) : [];
  return (
    <div style={{ paddingLeft: depth * 14 }}>
      <div className="flex items-baseline gap-2">
        <span className="text-stone-800">{node.id}</span>
        {entry?.class && (
          <span className="text-[10px] text-stone-500">[{entry.class}]</span>
        )}
        {extraParents.length > 0 && (
          <span className="text-[10px] text-amber-700">
            also under: {extraParents.join(", ")}
          </span>
        )}
      </div>
      {node.children.map((c) => (
        <Branch key={c.id} node={c} byId={byId} depth={depth + 1} />
      ))}
    </div>
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

function ParentsPicker({
  parents,
  selfId,
  available,
  onChange,
}: {
  parents: string[];
  selfId: string;
  available: string[];
  onChange: (next: string[]) => void;
}) {
  const candidates = available.filter(
    (id) => id !== selfId && !parents.includes(id),
  );

  function add(id: string) {
    if (!id) return;
    onChange([...parents, id]);
  }
  function remove(id: string) {
    onChange(parents.filter((p) => p !== id));
  }

  return (
    <div className="flex flex-col gap-1">
      {parents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {parents.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 font-mono text-[11px]"
            >
              {p}
              <button
                type="button"
                onClick={() => remove(p)}
                className="text-sky-700 hover:text-sky-900"
                title={`Remove ${p}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {candidates.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            add(e.target.value);
          }}
          className="self-start px-1 py-0.5 border border-stone-200 rounded font-mono text-[11px] text-stone-600 bg-white"
        >
          <option value="" disabled>
            + parent
          </option>
          {candidates.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
