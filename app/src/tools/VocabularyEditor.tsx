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
import { vocabFixtures } from "../fixtures/vocab";
import { useAtUriPlaceholder } from "../sessions/placeholders";
import { AtUriAutocomplete } from "../components/AtUriAutocomplete";
import { Tooltip } from "../components/Tooltip";
import { DatetimeInput } from "../components/DatetimeInput";

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
          nodes: [],
          edges: [],
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
              A typed multi-relation knowledge graph. Encounters cite
              the at-uri to ground their action and purpose strings.
              Observations roll up encounter counts under each ancestor
              node along the vocab's default relation.
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
            World{" "}
            <Tooltip text="Closure semantics for the vocab. open: undeclared ids are incomparable. hierarchy-closed: only declared edges hold. closed-with-default: a designated top node rolls up everything undeclared. Per-relation overrides live on each relation-kind node.">
              <span className="text-stone-400 font-normal cursor-help">?</span>
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
              hierarchy-closed (declared edges only)
            </option>
            <option value="closed-with-default">
              closed-with-default (top rolls up everything)
            </option>
          </select>
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

      <div data-walk="vocab-graph">
        <GraphSection
          nodes={(body.nodes as VocabNode[] | undefined) ?? []}
          edges={(body.edges as VocabEdge[] | undefined) ?? []}
          defaultRelation={(body.defaultRelation as string | undefined) ?? ""}
          onNodes={(next) => patch("nodes", next.length ? next : undefined)}
          onEdges={(next) => patch("edges", next.length ? next : undefined)}
          onDefaultRelation={(v) =>
            patch("defaultRelation", v.trim() || undefined)
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

// ----------------------------------------------------------------------
// Graph-shape editor (knowledge graph: nodes + typed edges).
//
// Mirrors the v0.7.0 dev.idiolect.vocab `nodes` + `edges` arrays and
// surfaces every field the lexicon declares: SKOS-aligned annotations
// (label / alternateLabels / hiddenLabels / scopeNote / example /
// historyNote / editorialNote / changeNote / notation), external-id
// mappings into Wikidata / ROR / ORCID / SKOS / etc, status +
// deprecatedBy, subkindUri, plus the full OWL Lite property
// characteristic set on relation-kind nodes (symmetric / asymmetric /
// transitive / reflexive / irreflexive / functional /
// inverseFunctional / inverseOf), and edge metadata (weight,
// confidence, temporal validity, source attestation).
// ----------------------------------------------------------------------

interface VocabNode {
  id: string;
  kind?: string;
  kindVocab?: { uri?: string };
  subkindUri?: string;
  label?: string;
  alternateLabels?: string[];
  hiddenLabels?: string[];
  description?: string;
  scopeNote?: string;
  example?: string;
  historyNote?: string;
  editorialNote?: string;
  changeNote?: string;
  notation?: string;
  externalIds?: ExternalId[];
  status?: string;
  statusVocab?: { uri?: string };
  deprecatedBy?: string;
  relationMetadata?: RelationMetadata;
}

interface ExternalId {
  system: string;
  systemVocab?: { uri?: string };
  identifier: string;
  uri?: string;
  matchType?: string;
  matchTypeVocab?: { uri?: string };
}

interface RelationMetadata {
  symmetric?: boolean;
  asymmetric?: boolean;
  transitive?: boolean;
  reflexive?: boolean;
  irreflexive?: boolean;
  functional?: boolean;
  inverseFunctional?: boolean;
  inverseOf?: string;
  world?: string;
}

interface VocabEdge {
  source: string;
  target: string;
  relationSlug: string;
  relationVocab?: { uri?: string };
  relationUri?: string;
  weight?: number;
  metadata?: EdgeMetadata;
}

interface EdgeMetadata {
  confidence?: number;
  startDate?: string;
  endDate?: string;
  source?: string;
}

const NODE_KIND_KNOWN = ["concept", "relation", "instance", "type", "collection"] as const;
const RELATION_SLUG_KNOWN = [
  "subsumed_by",
  "broader_than",
  "narrower_than",
  "equivalent_to",
  "polar_opposite_of",
  "related_to",
  "instance_of",
  "part_of",
  "member_of",
] as const;
const NODE_STATUS_KNOWN = ["proposed", "provisional", "established", "deprecated"] as const;
const EXTERNAL_ID_SYSTEM_KNOWN = [
  "wikidata",
  "ror",
  "orcid",
  "isni",
  "viaf",
  "lcsh",
  "fast",
  "skos",
  "dublin-core",
  "schema-org",
  "mesh",
  "aat",
] as const;
const MATCH_TYPE_KNOWN = ["exact", "close", "broader", "narrower", "related"] as const;
const RELATION_WORLD_KNOWN = ["closed-with-default", "open", "hierarchy-closed"] as const;

function GraphSection({
  nodes,
  edges,
  defaultRelation,
  onNodes,
  onEdges,
  onDefaultRelation,
}: {
  nodes: VocabNode[];
  edges: VocabEdge[];
  defaultRelation: string;
  onNodes: (next: VocabNode[]) => void;
  onEdges: (next: VocabEdge[]) => void;
  onDefaultRelation: (v: string) => void;
}) {
  const nodeIds = nodes.map((n) => n.id).filter(Boolean);

  function patchNode(i: number, partial: Partial<VocabNode>) {
    onNodes(nodes.map((n, j) => (i === j ? { ...n, ...partial } : n)));
  }
  function addNode() {
    onNodes([...nodes, { id: "", kind: "concept" }]);
  }
  function removeNode(i: number) {
    onNodes(nodes.filter((_, j) => j !== i));
  }
  function moveNode(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= nodes.length) return;
    const next = nodes.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onNodes(next);
  }

  function patchEdge(i: number, partial: Partial<VocabEdge>) {
    onEdges(edges.map((e, j) => (i === j ? { ...e, ...partial } : e)));
  }
  function addEdge() {
    onEdges([...edges, { source: "", target: "", relationSlug: "subsumed_by" }]);
  }
  function removeEdge(i: number) {
    onEdges(edges.filter((_, j) => j !== i));
  }

  return (
    <details open className="border border-stone-200 rounded">
      <summary className="bg-stone-100 text-stone-700 text-sm font-semibold px-3 py-2 cursor-pointer">
        Graph shape: nodes + edges{" "}
        <span className="text-xs text-stone-500 font-normal ml-2">
          {nodes.length} node{nodes.length === 1 ? "" : "s"},{" "}
          {edges.length} edge{edges.length === 1 ? "" : "s"}
        </span>
      </summary>
      <div className="p-3 space-y-4">
        <p className="text-xs text-stone-600 max-w-prose">
          The graph shape lets you author vocabularies as typed
          nodes + typed edges, modeled on{" "}
          <code>pub.chive.graph.{`{node,edge}`}</code>. Nodes carry
          SKOS Core annotations and OWL Lite property characteristics;
          edges carry typed relations beyond the legacy{" "}
          <code>subsumed_by</code> tree. Authors fill what they need;
          everything is optional except <code>id</code>.
        </p>

        <Field label="Default relation at-uri (optional)">
          <AtUriAutocomplete
            value={defaultRelation}
            onChange={onDefaultRelation}
            expectedCollection="dev.idiolect.vocab"
            placeholder="at://...idiolect/dev.idiolect.vocab/relation-types"
          />
        </Field>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <h4 className="font-semibold text-sm">Nodes</h4>
            <button
              type="button"
              onClick={addNode}
              className="text-xs text-stone-700 underline"
            >
              + node
            </button>
          </div>
          {nodes.length === 0 ? (
            <p className="text-xs text-stone-500">
              No nodes declared. Click <em>+ node</em> to start.
            </p>
          ) : (
            <ul className="space-y-2">
              {nodes.map((n, i) => (
                <li
                  key={i}
                  className="border border-stone-200 rounded p-2 bg-white"
                >
                  <NodeEditor
                    node={n}
                    onChange={(p) => patchNode(i, p)}
                    onMoveUp={() => moveNode(i, -1)}
                    onMoveDown={() => moveNode(i, 1)}
                    onRemove={() => removeNode(i)}
                    canMoveUp={i > 0}
                    canMoveDown={i < nodes.length - 1}
                    relationNodeIds={nodes
                      .filter((m) => m.kind === "relation" && m.id !== n.id)
                      .map((m) => m.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <h4 className="font-semibold text-sm">Edges</h4>
            <button
              type="button"
              onClick={addEdge}
              className="text-xs text-stone-700 underline"
            >
              + edge
            </button>
          </div>
          {edges.length === 0 ? (
            <p className="text-xs text-stone-500">
              No edges declared. Click <em>+ edge</em> to add a typed
              edge between two nodes.
            </p>
          ) : (
            <ul className="space-y-2">
              {edges.map((e, i) => (
                <li
                  key={i}
                  className="border border-stone-200 rounded p-2 bg-white"
                >
                  <EdgeEditor
                    edge={e}
                    nodeIds={nodeIds}
                    onChange={(p) => patchEdge(i, p)}
                    onRemove={() => removeEdge(i)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}

function NodeEditor({
  node,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
  relationNodeIds,
}: {
  node: VocabNode;
  onChange: (p: Partial<VocabNode>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  relationNodeIds: string[];
}) {
  const isRelation = node.kind === "relation";
  const meta = node.relationMetadata ?? {};
  const externalIds = node.externalIds ?? [];
  const altLabels = node.alternateLabels ?? [];
  const hiddenLabels = node.hiddenLabels ?? [];

  function patchMeta(p: Partial<RelationMetadata>) {
    onChange({ relationMetadata: { ...meta, ...p } });
  }

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={node.id}
          onChange={(e) => onChange({ id: e.target.value })}
          placeholder="node id (slug)"
          className="flex-1 min-w-[10rem] px-2 py-1 border border-stone-200 rounded font-mono"
        />
        <OpenEnumSelect
          value={node.kind ?? ""}
          knownValues={NODE_KIND_KNOWN}
          onChange={(v) => onChange({ kind: v || undefined })}
          width="narrow"
          ariaLabel="kind"
        />
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="text-stone-500 disabled:text-stone-300 px-1"
          title="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="text-stone-500 disabled:text-stone-300 px-1"
          title="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-stone-500 hover:text-red-700 px-1"
          title="Remove"
        >
          ×
        </button>
      </div>

      <details className="ml-2">
        <summary className="text-stone-600 cursor-pointer">
          SKOS labels &amp; annotations
        </summary>
        <div className="mt-1 grid grid-cols-1 gap-1 ml-3">
          <input
            type="text"
            value={node.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value || undefined })}
            placeholder="label (skos:prefLabel)"
            className="w-full px-2 py-1 border border-stone-200 rounded"
          />
          <StringArrayEditor
            values={altLabels}
            onChange={(v) =>
              onChange({ alternateLabels: v.length ? v : undefined })
            }
            placeholder="alternate label"
            label="alternateLabels (skos:altLabel)"
          />
          <StringArrayEditor
            values={hiddenLabels}
            onChange={(v) =>
              onChange({ hiddenLabels: v.length ? v : undefined })
            }
            placeholder="hidden label"
            label="hiddenLabels (skos:hiddenLabel)"
          />
          <textarea
            value={node.description ?? ""}
            onChange={(e) =>
              onChange({ description: e.target.value || undefined })
            }
            rows={2}
            placeholder="description (skos:definition)"
            className="w-full px-2 py-1 border border-stone-200 rounded"
          />
          <textarea
            value={node.scopeNote ?? ""}
            onChange={(e) =>
              onChange({ scopeNote: e.target.value || undefined })
            }
            rows={2}
            placeholder="scopeNote (skos:scopeNote, application guidance)"
            className="w-full px-2 py-1 border border-stone-200 rounded"
          />
          <input
            type="text"
            value={node.example ?? ""}
            onChange={(e) =>
              onChange({ example: e.target.value || undefined })
            }
            placeholder="example (skos:example)"
            className="w-full px-2 py-1 border border-stone-200 rounded"
          />
          <input
            type="text"
            value={node.historyNote ?? ""}
            onChange={(e) =>
              onChange({ historyNote: e.target.value || undefined })
            }
            placeholder="historyNote (skos:historyNote)"
            className="w-full px-2 py-1 border border-stone-200 rounded"
          />
          <input
            type="text"
            value={node.editorialNote ?? ""}
            onChange={(e) =>
              onChange({ editorialNote: e.target.value || undefined })
            }
            placeholder="editorialNote (skos:editorialNote)"
            className="w-full px-2 py-1 border border-stone-200 rounded"
          />
          <input
            type="text"
            value={node.changeNote ?? ""}
            onChange={(e) =>
              onChange({ changeNote: e.target.value || undefined })
            }
            placeholder="changeNote (skos:changeNote)"
            className="w-full px-2 py-1 border border-stone-200 rounded"
          />
          <input
            type="text"
            value={node.notation ?? ""}
            onChange={(e) =>
              onChange({ notation: e.target.value || undefined })
            }
            placeholder="notation (skos:notation, e.g. Dewey 004)"
            className="w-full px-2 py-1 border border-stone-200 rounded font-mono"
          />
        </div>
      </details>

      <details className="ml-2">
        <summary className="text-stone-600 cursor-pointer">
          External ids ({externalIds.length})
        </summary>
        <ExternalIdsEditor
          values={externalIds}
          onChange={(v) =>
            onChange({ externalIds: v.length ? v : undefined })
          }
        />
      </details>

      <details className="ml-2">
        <summary className="text-stone-600 cursor-pointer">
          Status &amp; lifecycle
        </summary>
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1 ml-3">
          <OpenEnumSelect
            value={node.status ?? ""}
            knownValues={NODE_STATUS_KNOWN}
            onChange={(v) => onChange({ status: v || undefined })}
            ariaLabel="status"
          />
          <AtUriAutocomplete
            value={node.deprecatedBy ?? ""}
            onChange={(v) =>
              onChange({ deprecatedBy: v.trim() || undefined })
            }
            placeholder="deprecatedBy at-uri (optional successor)"
            className="w-full px-2 py-1 border border-stone-200 rounded font-mono"
          />
          <AtUriAutocomplete
            value={node.subkindUri ?? ""}
            onChange={(v) =>
              onChange({ subkindUri: v.trim() || undefined })
            }
            placeholder="subkindUri at-uri (typed metaclass)"
            className="w-full px-2 py-1 border border-stone-200 rounded font-mono"
          />
        </div>
      </details>

      {isRelation && (
        <details className="ml-2" open>
          <summary className="text-stone-600 cursor-pointer font-medium">
            OWL Lite relation metadata
          </summary>
          <div className="mt-1 ml-3 space-y-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              <BoolField
                value={meta.symmetric}
                onChange={(v) => patchMeta({ symmetric: v })}
                label="symmetric"
                tooltip="A R B implies B R A"
              />
              <BoolField
                value={meta.asymmetric}
                onChange={(v) => patchMeta({ asymmetric: v })}
                label="asymmetric"
                tooltip="A R B implies NOT (B R A); mutually exclusive with symmetric"
              />
              <BoolField
                value={meta.transitive}
                onChange={(v) => patchMeta({ transitive: v })}
                label="transitive"
                tooltip="A R B and B R C imply A R C. Walks compute the closure"
              />
              <BoolField
                value={meta.reflexive}
                onChange={(v) => patchMeta({ reflexive: v })}
                label="reflexive"
                tooltip="A R A holds for every A"
              />
              <BoolField
                value={meta.irreflexive}
                onChange={(v) => patchMeta({ irreflexive: v })}
                label="irreflexive"
                tooltip="No A R A. Mutually exclusive with reflexive"
              />
              <BoolField
                value={meta.functional}
                onChange={(v) => patchMeta({ functional: v })}
                label="functional"
                tooltip="At most one target per source"
              />
              <BoolField
                value={meta.inverseFunctional}
                onChange={(v) => patchMeta({ inverseFunctional: v })}
                label="inverseFunctional"
                tooltip="At most one source per target. Useful for identifier-like relations"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              <div className="min-w-0">
                <NodeIdInput
                  value={meta.inverseOf ?? ""}
                  onChange={(v) =>
                    patchMeta({ inverseOf: v.trim() || undefined })
                  }
                  nodeIds={relationNodeIds}
                  placeholder="inverseOf (pick a relation node)"
                />
              </div>
              <select
                value={meta.world ?? ""}
                onChange={(e) =>
                  patchMeta({ world: e.target.value || undefined })
                }
                className="w-full px-2 py-1 border border-stone-200 rounded"
                aria-label="per-relation world override"
              >
                <option value="">(inherit vocab world)</option>
                {RELATION_WORLD_KNOWN.map((w) => (
                  <option key={w} value={w}>
                    world: {w}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function EdgeEditor({
  edge,
  nodeIds,
  onChange,
  onRemove,
}: {
  edge: VocabEdge;
  nodeIds: string[];
  onChange: (p: Partial<VocabEdge>) => void;
  onRemove: () => void;
}) {
  const meta = edge.metadata ?? {};
  function patchMeta(p: Partial<EdgeMetadata>) {
    onChange({
      metadata: trimMetadata({ ...meta, ...p }),
    });
  }

  return (
    <div className="space-y-1 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <NodeIdInput
          value={edge.source}
          onChange={(v) => onChange({ source: v })}
          nodeIds={nodeIds}
          placeholder="source"
        />
        <OpenEnumSelect
          value={edge.relationSlug}
          knownValues={RELATION_SLUG_KNOWN}
          onChange={(v) => onChange({ relationSlug: v })}
          ariaLabel="relation"
        />
        <NodeIdInput
          value={edge.target}
          onChange={(v) => onChange({ target: v })}
          nodeIds={nodeIds}
          placeholder="target"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-stone-500 hover:text-red-700 px-1"
          title="Remove"
        >
          ×
        </button>
      </div>
      <details className="ml-2">
        <summary className="text-stone-600 cursor-pointer">
          Edge metadata
        </summary>
        <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1 ml-3">
          <AtUriAutocomplete
            value={edge.relationVocab?.uri ?? ""}
            onChange={(v) =>
              onChange({
                relationVocab: v.trim() ? { uri: v } : undefined,
              })
            }
            expectedCollection="dev.idiolect.vocab"
            placeholder="relationVocab at-uri"
            className="w-full px-2 py-1 border border-stone-200 rounded font-mono"
          />
          <AtUriAutocomplete
            value={edge.relationUri ?? ""}
            onChange={(v) =>
              onChange({ relationUri: v.trim() || undefined })
            }
            placeholder="relationUri at-uri (relation-kind node)"
            className="w-full px-2 py-1 border border-stone-200 rounded font-mono"
          />
          <input
            type="number"
            min={0}
            max={1000}
            value={edge.weight ?? ""}
            onChange={(e) =>
              onChange({
                weight:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            placeholder="weight (0-1000, scaled)"
            className="w-full px-2 py-1 border border-stone-200 rounded"
          />
          <input
            type="number"
            min={0}
            max={1000}
            value={meta.confidence ?? ""}
            onChange={(e) =>
              patchMeta({
                confidence:
                  e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            placeholder="confidence (0-1000, scaled)"
            className="w-full px-2 py-1 border border-stone-200 rounded"
          />
          <input
            type="text"
            value={meta.startDate ?? ""}
            onChange={(e) =>
              patchMeta({ startDate: e.target.value || undefined })
            }
            placeholder="startDate (RFC 3339)"
            className="w-full px-2 py-1 border border-stone-200 rounded font-mono"
          />
          <input
            type="text"
            value={meta.endDate ?? ""}
            onChange={(e) =>
              patchMeta({ endDate: e.target.value || undefined })
            }
            placeholder="endDate (RFC 3339)"
            className="w-full px-2 py-1 border border-stone-200 rounded font-mono"
          />
          <input
            type="text"
            value={meta.source ?? ""}
            onChange={(e) =>
              patchMeta({ source: e.target.value || undefined })
            }
            placeholder="source (free-form attestation)"
            className="w-full sm:col-span-2 px-2 py-1 border border-stone-200 rounded"
          />
        </div>
      </details>
    </div>
  );
}

function NodeIdInput({
  value,
  onChange,
  nodeIds,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  nodeIds: string[];
  placeholder: string;
}) {
  const listId = `node-ids-${nodeIds.length}`;
  return (
    <>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder={placeholder}
        className="flex-1 w-full min-w-0 px-2 py-1 border border-stone-200 rounded font-mono"
      />
      <datalist id={listId}>
        {nodeIds.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
    </>
  );
}

function StringArrayEditor({
  values,
  onChange,
  placeholder,
  label,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  label: string;
}) {
  function patchAt(i: number, v: string) {
    onChange(values.map((x, j) => (i === j ? v : x)));
  }
  function removeAt(i: number) {
    onChange(values.filter((_, j) => j !== i));
  }
  function add() {
    onChange([...values, ""]);
  }
  return (
    <div>
      <span className="text-[10px] text-stone-500">{label}</span>
      {values.map((v, i) => (
        <div key={i} className="flex gap-1 mt-0.5">
          <input
            type="text"
            value={v}
            onChange={(e) => patchAt(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-2 py-1 border border-stone-200 rounded"
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="text-stone-500 hover:text-red-700 px-1"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="mt-0.5 text-[11px] text-stone-700 underline"
      >
        + add
      </button>
    </div>
  );
}

function ExternalIdsEditor({
  values,
  onChange,
}: {
  values: ExternalId[];
  onChange: (next: ExternalId[]) => void;
}) {
  function patchAt(i: number, partial: Partial<ExternalId>) {
    onChange(values.map((v, j) => (i === j ? { ...v, ...partial } : v)));
  }
  function removeAt(i: number) {
    onChange(values.filter((_, j) => j !== i));
  }
  function add() {
    onChange([...values, { system: "wikidata", identifier: "" }]);
  }
  return (
    <div className="ml-3 mt-1 space-y-1">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-1 border border-stone-100 rounded p-1"
        >
          <OpenEnumSelect
            value={v.system}
            knownValues={EXTERNAL_ID_SYSTEM_KNOWN}
            onChange={(next) => patchAt(i, { system: next })}
            ariaLabel="system"
            width="narrow"
          />
          <input
            type="text"
            value={v.identifier}
            onChange={(e) => patchAt(i, { identifier: e.target.value })}
            placeholder="identifier (e.g. Q42)"
            className="flex-1 min-w-[6rem] px-2 py-1 border border-stone-200 rounded font-mono"
          />
          <input
            type="text"
            value={v.uri ?? ""}
            onChange={(e) => patchAt(i, { uri: e.target.value || undefined })}
            placeholder="uri (full)"
            className="flex-1 min-w-[8rem] px-2 py-1 border border-stone-200 rounded font-mono"
          />
          <OpenEnumSelect
            value={v.matchType ?? ""}
            knownValues={MATCH_TYPE_KNOWN}
            onChange={(next) =>
              patchAt(i, { matchType: next || undefined })
            }
            ariaLabel="matchType"
            width="narrow"
          />
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="text-stone-500 hover:text-red-700 px-1"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-[11px] text-stone-700 underline"
      >
        + external id
      </button>
    </div>
  );
}

function BoolField({
  value,
  onChange,
  label,
  tooltip,
}: {
  value: boolean | undefined;
  onChange: (v: boolean | undefined) => void;
  label: string;
  tooltip: string;
}) {
  // Tri-state: undefined / true / false rendered as a tristate
  // checkbox approximation. Click cycles undefined → true → false →
  // undefined; the underlying record never carries `false`
  // explicitly because the lexicon defaults absent flags to false.
  const cycled =
    value === undefined ? true : value === true ? false : undefined;
  return (
    <label className="flex items-center gap-1 text-[11px] cursor-pointer" title={tooltip}>
      <button
        type="button"
        onClick={() => onChange(cycled)}
        className={`w-4 h-4 border rounded text-center text-[10px] leading-4 ${
          value === true
            ? "bg-emerald-100 border-emerald-400 text-emerald-900"
            : value === false
              ? "bg-stone-100 border-stone-400 text-stone-700"
              : "bg-white border-stone-300 text-stone-300"
        }`}
        aria-label={`${label} (currently ${value === undefined ? "unset" : String(value)})`}
      >
        {value === true ? "✓" : value === false ? "−" : "·"}
      </button>
      <span className="text-stone-700">{label}</span>
    </label>
  );
}

function OpenEnumSelect({
  value,
  knownValues,
  onChange,
  ariaLabel,
  width,
}: {
  value: string;
  knownValues: readonly string[];
  onChange: (v: string) => void;
  ariaLabel?: string;
  width?: "narrow";
}) {
  const inKnown = knownValues.includes(value);
  const [customMode, setCustomMode] = useState(value !== "" && !inKnown);
  const isCustom = customMode || (value !== "" && !inKnown);
  // The "narrow" width hint applies only to the dropdown so the
  // node-row's id input can dominate the row's flex-1 share. The
  // custom-mode text input is allowed to grow freely (the parent
  // row uses flex-wrap, so it line-breaks rather than overhanging).
  const selectWidth = width === "narrow" ? "max-w-[8rem]" : "";
  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0">
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
        className={`px-2 py-1 border border-stone-300 rounded ${selectWidth}`}
        aria-label={ariaLabel}
      >
        <option value="">(unset)</option>
        {knownValues.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
        <option value="__custom__">custom…</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 w-24 px-2 py-1 border border-stone-300 rounded font-mono"
          placeholder="community-extended"
          autoFocus
        />
      )}
    </div>
  );
}

function trimMetadata(m: EdgeMetadata): EdgeMetadata | undefined {
  const trimmed: EdgeMetadata = {};
  if (m.confidence !== undefined) trimmed.confidence = m.confidence;
  if (m.startDate) trimmed.startDate = m.startDate;
  if (m.endDate) trimmed.endDate = m.endDate;
  if (m.source) trimmed.source = m.source;
  return Object.keys(trimmed).length === 0 ? undefined : trimmed;
}
