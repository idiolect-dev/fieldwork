// Condition-tree editor.
//
// `dev.idiolect.recommendation` carries `conditions` and
// `preconditions` as a flat postfix array of nodes; each node is
// either an atomic predicate (sourceIs / targetIs /
// actionSubsumedBy / purposeSubsumedBy / dataHas) or a combinator
// (and / or / not). Subscribers evaluate left-to-right, pushing
// atomic results onto a stack and letting combinators pop and
// combine.
//
// This editor renders the array as a stack, lets the user add /
// remove nodes inline, and shows a tiny preview of the resulting
// tree so RPN doesn't feel hostile. We don't try to enforce
// stack-balance at edit time; the panproto-side validator catches
// imbalance at publish.

import type { ChangeEvent } from "react";
import { AtUriAutocomplete } from "../components/AtUriAutocomplete";

type NodeType =
  | "sourceIs"
  | "targetIs"
  | "actionSubsumedBy"
  | "purposeSubsumedBy"
  | "dataHas"
  | "and"
  | "or"
  | "not";

interface Node {
  $type?: string;
  schema?: { uri?: string; cid?: string };
  action?: string;
  actionVocabulary?: { uri?: string; cid?: string };
  purpose?: string;
  purposeVocabulary?: { uri?: string; cid?: string };
  property?: string;
}

const NSID = "dev.idiolect.recommendation";

function nodeType(n: Node): NodeType {
  const t = (n.$type ?? "").replace(`${NSID}#condition`, "");
  switch (t) {
    case "SourceIs":
      return "sourceIs";
    case "TargetIs":
      return "targetIs";
    case "ActionSubsumedBy":
      return "actionSubsumedBy";
    case "PurposeSubsumedBy":
      return "purposeSubsumedBy";
    case "DataHas":
      return "dataHas";
    case "And":
      return "and";
    case "Or":
      return "or";
    case "Not":
      return "not";
    default:
      // First-time read of a node imported without `$type`: fall
      // back to introspecting which fields are populated.
      if (n.schema) return "sourceIs";
      if (n.action !== undefined) return "actionSubsumedBy";
      if (n.purpose !== undefined) return "purposeSubsumedBy";
      if (n.property !== undefined) return "dataHas";
      return "and";
  }
}

function freshNode(t: NodeType): Node {
  const $type = `${NSID}#condition${capitalise(t)}`;
  switch (t) {
    case "sourceIs":
    case "targetIs":
      return { $type, schema: { uri: "" } };
    case "actionSubsumedBy":
      return { $type, action: "", actionVocabulary: { uri: "" } };
    case "purposeSubsumedBy":
      return { $type, purpose: "", purposeVocabulary: { uri: "" } };
    case "dataHas":
      return { $type, property: "" };
    case "and":
    case "or":
    case "not":
      return { $type };
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  /** "conditions" or "preconditions". */
  label: string;
  nodes: Node[];
  onChange: (nodes: Node[]) => void;
}

export function ConditionTreeEditor({ label, nodes, onChange }: Props) {
  function patchAt(i: number, partial: Partial<Node>) {
    onChange(nodes.map((n, j) => (i === j ? { ...n, ...partial } : n)));
  }
  function setKindAt(i: number, t: NodeType) {
    const next = freshNode(t);
    onChange(nodes.map((n, j) => (i === j ? next : n)));
  }
  function removeAt(i: number) {
    onChange(nodes.filter((_, j) => j !== i));
  }
  function addAfter(i: number) {
    const next = [...nodes];
    next.splice(i + 1, 0, freshNode("sourceIs"));
    onChange(next);
  }
  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...nodes];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  }
  function moveDown(i: number) {
    if (i === nodes.length - 1) return;
    const next = [...nodes];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  }

  const balance = stackBalance(nodes);

  return (
    <fieldset className="border border-stone-200 rounded p-3">
      <legend className="text-xs font-semibold px-1">
        {label}{" "}
        <span
          className={`ml-2 font-mono ${
            balance.balanced
              ? "text-emerald-700"
              : "text-amber-700"
          }`}
        >
          (stack {balance.balanced ? "balanced" : `unbalanced: ${balance.detail}`})
        </span>
      </legend>
      {nodes.length === 0 ? (
        <p className="text-xs text-stone-500 mb-2">
          Empty; recommendation always applies. Add a node to start.
        </p>
      ) : (
        <ol className="flex flex-col gap-2 mb-2">
          {nodes.map((node, i) => (
            <li
              key={i}
              className="border border-stone-200 rounded px-2 py-1.5 bg-white"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-stone-500 w-8">
                  [{i}]
                </span>
                <select
                  value={nodeType(node)}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setKindAt(i, e.target.value as NodeType)
                  }
                  className="px-2 py-0.5 border border-stone-300 rounded text-xs"
                >
                  <option value="sourceIs">sourceIs (atom)</option>
                  <option value="targetIs">targetIs (atom)</option>
                  <option value="actionSubsumedBy">
                    actionSubsumedBy (atom)
                  </option>
                  <option value="purposeSubsumedBy">
                    purposeSubsumedBy (atom)
                  </option>
                  <option value="dataHas">dataHas (atom)</option>
                  <option value="and">and (combinator, pop 2)</option>
                  <option value="or">or (combinator, pop 2)</option>
                  <option value="not">not (combinator, pop 1)</option>
                </select>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="text-xs text-stone-500 disabled:text-stone-300 px-1"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === nodes.length - 1}
                  className="text-xs text-stone-500 disabled:text-stone-300 px-1"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => addAfter(i)}
                  className="text-xs text-stone-700 px-1"
                  title="Insert after"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="text-xs text-stone-500 px-1"
                  title="Remove"
                >
                  ×
                </button>
              </div>
              <NodeFields
                node={node}
                t={nodeType(node)}
                onPatch={(p) => patchAt(i, p)}
              />
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={() => onChange([...nodes, freshNode("sourceIs")])}
        className="text-xs text-stone-700 underline"
      >
        + add node
      </button>
    </fieldset>
  );
}

function NodeFields({
  node,
  t,
  onPatch,
}: {
  node: Node;
  t: NodeType;
  onPatch: (p: Partial<Node>) => void;
}) {
  switch (t) {
    case "sourceIs":
    case "targetIs":
      return (
        <AtUriAutocomplete
          value={node.schema?.uri ?? ""}
          onChange={(v) => onPatch({ schema: { uri: v } })}
          expectedCollection="dev.panproto.schema.schema"
          placeholder="schema at-uri"
          className="w-full px-2 py-0.5 border border-stone-200 rounded font-mono text-xs"
        />
      );
    case "actionSubsumedBy":
      return (
        <div className="flex gap-2">
          <input
            type="text"
            value={node.action ?? ""}
            onChange={(e) => onPatch({ action: e.target.value })}
            placeholder="action id (e.g. train_model)"
            className="flex-1 px-2 py-0.5 border border-stone-200 rounded font-mono text-xs"
          />
          <div className="flex-1">
            <AtUriAutocomplete
              value={node.actionVocabulary?.uri ?? ""}
              onChange={(v) =>
                onPatch({
                  actionVocabulary: { uri: v || undefined },
                })
              }
              expectedCollection="dev.idiolect.vocab"
              placeholder="vocab at-uri (optional)"
              className="w-full px-2 py-0.5 border border-stone-200 rounded font-mono text-xs"
            />
          </div>
        </div>
      );
    case "purposeSubsumedBy":
      return (
        <div className="flex gap-2">
          <input
            type="text"
            value={node.purpose ?? ""}
            onChange={(e) => onPatch({ purpose: e.target.value })}
            placeholder="purpose id"
            className="flex-1 px-2 py-0.5 border border-stone-200 rounded font-mono text-xs"
          />
          <div className="flex-1">
            <AtUriAutocomplete
              value={node.purposeVocabulary?.uri ?? ""}
              onChange={(v) =>
                onPatch({
                  purposeVocabulary: { uri: v || undefined },
                })
              }
              expectedCollection="dev.idiolect.vocab"
              placeholder="vocab at-uri (optional)"
              className="w-full px-2 py-0.5 border border-stone-200 rounded font-mono text-xs"
            />
          </div>
        </div>
      );
    case "dataHas":
      return (
        <input
          type="text"
          value={node.property ?? ""}
          onChange={(e) => onPatch({ property: e.target.value })}
          placeholder="property id (e.g. contains-pii)"
          className="w-full px-2 py-0.5 border border-stone-200 rounded font-mono text-xs"
        />
      );
    case "and":
      return (
        <p className="text-xs text-stone-500">
          Pops top 2 atoms from the stack and pushes their conjunction.
        </p>
      );
    case "or":
      return (
        <p className="text-xs text-stone-500">
          Pops top 2 atoms from the stack and pushes their disjunction.
        </p>
      );
    case "not":
      return (
        <p className="text-xs text-stone-500">
          Pops top atom from the stack and pushes its negation.
        </p>
      );
  }
}

/**
 * Walk the postfix array and check the evaluation stack ends at
 * size 1 (well-formed: a single combined predicate). The result
 * carries a one-line diagnostic for the unbalanced case.
 */
function stackBalance(nodes: Node[]): {
  balanced: boolean;
  detail: string;
} {
  let depth = 0;
  for (const node of nodes) {
    const t = nodeType(node);
    switch (t) {
      case "sourceIs":
      case "targetIs":
      case "actionSubsumedBy":
      case "purposeSubsumedBy":
      case "dataHas":
        depth += 1;
        break;
      case "and":
      case "or":
        if (depth < 2) {
          return { balanced: false, detail: `${t} needs 2 operands, found ${depth}` };
        }
        depth -= 1;
        break;
      case "not":
        if (depth < 1) {
          return { balanced: false, detail: "not needs 1 operand, found 0" };
        }
        break;
    }
  }
  if (nodes.length === 0) return { balanced: true, detail: "empty (always)" };
  if (depth === 1) return { balanced: true, detail: "" };
  return { balanced: false, detail: `final depth ${depth}, expected 1` };
}
