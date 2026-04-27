// Multi-mode renderer for an atproto lexicon document.
//
// Tabs:
// - JSON: regex-tokenized syntax highlighting on the raw doc.
// - Definitions: table of `defs` entries with type and description.
// - Properties: flat field table per object-shaped def.
// - Inline: Properties expanded recursively through local refs.
// - Refs: a small SVG diagram of the def-to-def reference graph.
// - Diff: pin a baseline and surface added/removed/changed fields.
// - Try: a curl-able request stub or a minimal example record body.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSessionsStore } from "../sessions/store";
import type { Session } from "../sessions/types";

interface Props {
  json: string;
  body: unknown;
  /**
   * Optional jump-to-lexicon callback. When the user clicks an
   * external NSID in the Refs / Fields views, the viewer asks the
   * host (LexiconBrowser) to switch to that lexicon if it's loaded.
   * Returns true if navigation succeeded, false to surface a hint.
   */
  onNavigateLexicon?: (nsid: string) => boolean;
}

// Active-session view used for placeholder substitution. When the
// user is signed in we use their DID, handle, and PDS URL inline so
// the Try-tab stub is copy-pasteable without further editing.
interface ActiveContext {
  did: string;
  handle?: string;
  pdsUrl?: string;
}

function useActiveContext(): ActiveContext | null {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeDid = useSessionsStore((s) => s.activeDid);
  if (!activeDid) return null;
  const s: Session | undefined = sessions[activeDid];
  if (!s) return null;
  return {
    did: s.did,
    handle: s.handle,
    pdsUrl: s.pdsUrl || undefined,
  };
}

type Mode = "json" | "defs" | "fields" | "refs" | "diff" | "try";

const MODE_LABEL: Record<Mode, string> = {
  json: "JSON",
  defs: "Definitions",
  fields: "Fields",
  refs: "Refs",
  diff: "Diff",
  try: "Try",
};

export function LexiconViewer({ json, body, onNavigateLexicon }: Props) {
  const [mode, setMode] = useState<Mode>("json");
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);

  function navInternal(defName: string) {
    setMode("fields");
    setScrollTarget(defName);
  }
  function navExternal(nsid: string) {
    if (onNavigateLexicon?.(nsid)) return;
    // Fallback: copy to clipboard so the user can paste into the
    // Lexicon Browser's import box.
    void navigator.clipboard?.writeText(nsid);
  }

  return (
    <div className="border border-stone-200 rounded overflow-hidden">
      <nav className="flex bg-stone-100 border-b border-stone-200 text-xs flex-wrap">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 border-r border-stone-200 ${
              mode === m
                ? "bg-white text-stone-900"
                : "text-stone-600 hover:bg-stone-200"
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </nav>
      <div className="bg-white">
        {mode === "json" && <JsonView json={json} />}
        {mode === "defs" && <DefsView body={body} />}
        {mode === "fields" && (
          <FieldsView
            body={body}
            scrollTarget={scrollTarget}
            onScrolled={() => setScrollTarget(null)}
            onNavInternal={navInternal}
            onNavExternal={navExternal}
          />
        )}
        {mode === "refs" && (
          <RefsView
            body={body}
            onNavInternal={navInternal}
            onNavExternal={navExternal}
          />
        )}
        {mode === "diff" && <DiffView body={body} />}
        {mode === "try" && <TryView body={body} />}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// JSON syntax highlighting
// -----------------------------------------------------------------

const TOKEN_RE =
  /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)|([{}[\],])/g;

function highlightJson(src: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  src.replace(
    TOKEN_RE,
    (match, str, colon, kw, num, brace, offset: number) => {
      if (offset > last) out.push(src.slice(last, offset));
      if (str !== undefined) {
        if (colon) {
          out.push(
            <span key={key++} className="text-sky-700">
              {str}
            </span>,
          );
          out.push(colon);
        } else {
          out.push(
            <span key={key++} className="text-emerald-700">
              {str}
            </span>,
          );
        }
      } else if (kw !== undefined) {
        out.push(
          <span key={key++} className="text-purple-700">
            {kw}
          </span>,
        );
      } else if (num !== undefined) {
        out.push(
          <span key={key++} className="text-amber-700">
            {num}
          </span>,
        );
      } else if (brace !== undefined) {
        out.push(
          <span key={key++} className="text-stone-500">
            {brace}
          </span>,
        );
      }
      last = offset + match.length;
      return match;
    },
  );
  if (last < src.length) out.push(src.slice(last));
  return out;
}

function JsonView({ json }: { json: string }) {
  const tokens = useMemo(() => highlightJson(json), [json]);
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap p-3 leading-relaxed overflow-auto max-h-[70vh]">
      {tokens}
    </pre>
  );
}

// -----------------------------------------------------------------
// Schema introspection helpers
// -----------------------------------------------------------------

type Def = Record<string, unknown>;

function getDefs(body: unknown): Record<string, Def> {
  if (!body || typeof body !== "object") return {};
  const defs = (body as Record<string, unknown>).defs;
  return defs && typeof defs === "object"
    ? (defs as Record<string, Def>)
    : {};
}

function lexiconId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const id = (body as Record<string, unknown>).id;
  return typeof id === "string" ? id : null;
}

// Some def kinds carry their object schema indirectly. Records keep
// it under `record`; queries put inputs under `parameters` and
// outputs under `output.schema`; procedures use `input.schema`.
function objectSchemaFor(def: Def): Def | null {
  if (typeof def.type !== "string") return null;
  switch (def.type) {
    case "object":
    case "params":
      return def;
    case "record":
      return (def.record as Def) ?? null;
    case "query":
      return (def.parameters as Def) ?? null;
    case "procedure":
      return (def.input as Def | undefined)?.schema as Def | null;
    case "subscription":
      return (def.parameters as Def) ?? null;
    default:
      return null;
  }
}

// -----------------------------------------------------------------
// Definitions table
// -----------------------------------------------------------------

interface DefRow {
  name: string;
  type: string;
  description?: string;
  isMain: boolean;
}

function readDefs(body: unknown): DefRow[] {
  return Object.entries(getDefs(body)).map(([name, d]) => ({
    name,
    type: typeof d.type === "string" ? d.type : "?",
    description: typeof d.description === "string" ? d.description : undefined,
    isMain: name === "main",
  }));
}

function DefsView({ body }: { body: unknown }) {
  const rows = useMemo(() => readDefs(body), [body]);
  if (rows.length === 0) {
    return (
      <p className="p-3 text-xs text-stone-500">
        Lexicon has no `defs` block.
      </p>
    );
  }
  return (
    <table className="w-full text-xs">
      <thead className="bg-stone-50 text-left text-stone-600">
        <tr>
          <th className="px-3 py-1.5 font-medium">name</th>
          <th className="px-3 py-1.5 font-medium">type</th>
          <th className="px-3 py-1.5 font-medium">description</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name} className="border-t border-stone-100 align-top">
            <td className="px-3 py-1.5 font-mono">
              {r.isMain ? <strong>{r.name}</strong> : r.name}
            </td>
            <td className="px-3 py-1.5 font-mono text-stone-700">{r.type}</td>
            <td className="px-3 py-1.5 text-stone-700">
              {r.description ?? <span className="text-stone-400">none</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// -----------------------------------------------------------------
// Fields view: per-def field tables, with refs / array<ref> / union
// expanded inline as indented child rows. Replaces the previous
// "Properties" (flat) + "Inline" (only direct ref) split, which were
// indistinguishable on lexicons whose only refs were inside arrays.
// -----------------------------------------------------------------

interface FieldRow {
  name: string;
  required: boolean;
  /** Pretty type token, e.g. `string`, `array<ref(#x)>`, `union(#a, #b)`. */
  type: string;
  format?: string;
  description?: string;
  /** Local ref names this field expands into (`#defName` -> `defName`). */
  expands: string[];
  /** External (cross-lexicon) refs we can't expand here. */
  externalRefs: string[];
}

function localRefName(ref: string): string | null {
  if (ref.startsWith("#")) return ref.slice(1);
  return null;
}

function summariseField(raw: unknown): {
  type: string;
  format?: string;
  description?: string;
  expands: string[];
  externalRefs: string[];
} {
  const p = (raw as Record<string, unknown>) ?? {};
  const description =
    typeof p.description === "string" ? p.description : undefined;
  const format = typeof p.format === "string" ? p.format : undefined;
  const expands: string[] = [];
  const externalRefs: string[] = [];

  function pushRef(target: string) {
    const local = localRefName(target);
    if (local) expands.push(local);
    else externalRefs.push(target);
  }

  const t = typeof p.type === "string" ? p.type : "?";
  let typeText = t;

  if (t === "ref" && typeof p.ref === "string") {
    pushRef(p.ref);
    typeText = `ref(${p.ref})`;
  } else if (t === "union" && Array.isArray(p.refs)) {
    const refs = p.refs.filter((x): x is string => typeof x === "string");
    refs.forEach(pushRef);
    typeText = `union(${refs.join(", ")})`;
  } else if (t === "array") {
    const items = (p.items as Record<string, unknown> | undefined) ?? {};
    const inner = summariseField(items);
    expands.push(...inner.expands);
    externalRefs.push(...inner.externalRefs);
    typeText = `array<${inner.type}>`;
  }

  return { type: typeText, format, description, expands, externalRefs };
}

function readFieldsForDef(def: Def): FieldRow[] | null {
  const target = objectSchemaFor(def);
  const props = target?.properties as Record<string, unknown> | undefined;
  if (!props) return null;
  const required = new Set(
    Array.isArray(target?.required) ? (target!.required as string[]) : [],
  );
  return Object.entries(props).map(([name, raw]) => {
    const s = summariseField(raw);
    return {
      name,
      required: required.has(name),
      type: s.type,
      format: s.format,
      description: s.description,
      expands: s.expands,
      externalRefs: s.externalRefs,
    };
  });
}

interface FieldGroup {
  defName: string;
  defType: string;
  rows: FieldRow[];
}

function readFieldGroups(body: unknown): FieldGroup[] {
  const groups: FieldGroup[] = [];
  for (const [name, def] of Object.entries(getDefs(body))) {
    const rows = readFieldsForDef(def);
    if (rows && rows.length > 0) {
      groups.push({
        defName: name,
        defType: typeof def.type === "string" ? def.type : "?",
        rows,
      });
    }
  }
  return groups;
}

function FieldsView({
  body,
  scrollTarget,
  onScrolled,
  onNavInternal,
  onNavExternal,
}: {
  body: unknown;
  scrollTarget: string | null;
  onScrolled: () => void;
  onNavInternal: (defName: string) => void;
  onNavExternal: (nsid: string) => void;
}) {
  const defs = useMemo(() => getDefs(body), [body]);
  const groups = useMemo(() => readFieldGroups(body), [body]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollTarget || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(
      `[data-def="${CSS.escape(scrollTarget)}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-amber-300");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-amber-300");
      }, 1200);
    }
    onScrolled();
  }, [scrollTarget, onScrolled]);

  if (groups.length === 0) {
    return (
      <p className="p-3 text-xs text-stone-500">
        No object-shaped defs to surface fields for.
      </p>
    );
  }
  return (
    <div ref={containerRef} className="divide-y divide-stone-200">
      {groups.map((g) => (
        <div
          key={g.defName}
          data-def={g.defName}
          className="py-3 px-3 transition rounded"
        >
          <h4 className="text-xs font-semibold text-stone-700 mb-2">
            <span className="font-mono">{g.defName}</span>
            <span className="ml-2 text-stone-400 text-[10px] uppercase">
              {g.defType}
            </span>
          </h4>
          <FieldsTable
            rows={g.rows}
            defs={defs}
            visited={new Set([g.defName])}
            onNavInternal={onNavInternal}
            onNavExternal={onNavExternal}
          />
        </div>
      ))}
    </div>
  );
}

// Inlined refs render as siblings in the same table so the type /
// format / description columns line up at every depth. The visual
// hierarchy comes from `pl` on the name cell, scaled by `depth`.
const INDENT_PX = 14;

function FieldsTable({
  rows,
  defs,
  visited,
  onNavInternal,
  onNavExternal,
}: {
  rows: FieldRow[];
  defs: Record<string, Def>;
  visited: Set<string>;
  onNavInternal: (defName: string) => void;
  onNavExternal: (nsid: string) => void;
}) {
  return (
    <table className="w-full text-xs table-fixed">
      <colgroup>
        <col className="w-6" />
        <col className="w-1/4" />
        <col className="w-1/4" />
        <col className="w-20" />
        <col />
      </colgroup>
      <tbody>
        {rows.map((r) => (
          <FieldRowView
            key={r.name}
            row={r}
            depth={0}
            defs={defs}
            visited={visited}
            onNavInternal={onNavInternal}
            onNavExternal={onNavExternal}
          />
        ))}
      </tbody>
    </table>
  );
}

function FieldRowView({
  row,
  depth,
  defs,
  visited,
  onNavInternal,
  onNavExternal,
}: {
  row: FieldRow;
  depth: number;
  defs: Record<string, Def>;
  visited: Set<string>;
  onNavInternal: (defName: string) => void;
  onNavExternal: (nsid: string) => void;
}) {
  const inlineable: string[] = row.expands.filter(
    (n) => !visited.has(n) && defs[n] && objectSchemaFor(defs[n]),
  );
  const cycles: string[] = row.expands.filter((n) => visited.has(n));
  const externals = row.externalRefs;
  const namePad = { paddingLeft: depth * INDENT_PX };

  return (
    <>
      <tr className="border-t border-stone-100 align-top">
        <td className="py-1 pr-2">
          {row.required ? (
            <span className="text-red-700 font-bold" title="required">
              *
            </span>
          ) : (
            <span className="text-stone-300">·</span>
          )}
        </td>
        <td className="py-1 pr-2 font-mono" style={namePad}>
          {row.name}
        </td>
        <td className="py-1 pr-2 font-mono text-stone-700 truncate">
          <LinkifiedType
            text={row.type}
            onNavInternal={onNavInternal}
            onNavExternal={onNavExternal}
          />
        </td>
        <td className="py-1 pr-2 font-mono text-stone-500 truncate">
          {row.format ?? ""}
        </td>
        <td className="py-1 text-stone-700">
          {row.description ?? <span className="text-stone-400">none</span>}
        </td>
      </tr>
      {inlineable.map((refName) => {
        const childRows = readFieldsForDef(defs[refName]) ?? [];
        const childVisited = new Set([...visited, refName]);
        const childPad = { paddingLeft: (depth + 1) * INDENT_PX };
        return (
          <Fragment key={`expand-${refName}`}>
            <tr className="border-t border-stone-100">
              <td />
              <td
                colSpan={4}
                className="py-1 text-[10px] uppercase text-sky-700"
                style={childPad}
              >
                #{refName} inlined
              </td>
            </tr>
            {childRows.map((child) => (
              <FieldRowView
                key={`${refName}/${child.name}`}
                row={child}
                depth={depth + 1}
                defs={defs}
                visited={childVisited}
                onNavInternal={onNavInternal}
                onNavExternal={onNavExternal}
              />
            ))}
          </Fragment>
        );
      })}
      {cycles.map((refName) => (
        <tr key={`cycle-${refName}`}>
          <td />
          <td
            colSpan={4}
            className="py-1 text-[10px] text-amber-700"
            style={{ paddingLeft: (depth + 1) * INDENT_PX }}
          >
            cycle:{" "}
            <RefLink
              defName={refName}
              onNavInternal={onNavInternal}
              className="text-amber-800 underline"
            />{" "}
            already inlined above
          </td>
        </tr>
      ))}
      {externals.length > 0 && (
        <tr>
          <td />
          <td
            colSpan={4}
            className="py-1 text-[10px] text-stone-500"
            style={{ paddingLeft: (depth + 1) * INDENT_PX }}
          >
            external refs (not inlined):{" "}
            {externals.map((e, i) => (
              <span key={e}>
                {i > 0 && ", "}
                <ExternalLink nsid={e} onNavExternal={onNavExternal} />
              </span>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}

// -----------------------------------------------------------------
// Click targets shared by Fields + Refs views.
// -----------------------------------------------------------------

function RefLink({
  defName,
  onNavInternal,
  className,
}: {
  defName: string;
  onNavInternal: (defName: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavInternal(defName)}
      className={
        className ?? "text-sky-700 hover:text-sky-900 hover:underline"
      }
      title={`Jump to #${defName}`}
    >
      #{defName}
    </button>
  );
}

function ExternalLink({
  nsid,
  onNavExternal,
  className,
}: {
  nsid: string;
  onNavExternal: (nsid: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavExternal(nsid)}
      className={
        className ?? "text-stone-700 hover:text-stone-900 hover:underline"
      }
      title={`Open ${nsid} (or copy to clipboard if not loaded)`}
    >
      {nsid}
    </button>
  );
}

// Walk a type token like `array<ref(#foo)>` or `union(#a, #b, com.x.y)`
// and replace every `#name` / `<authority>.<...>.<name>` ref with a
// clickable button.
function LinkifiedType({
  text,
  onNavInternal,
  onNavExternal,
}: {
  text: string;
  onNavInternal: (defName: string) => void;
  onNavExternal: (nsid: string) => void;
}) {
  const tokens = useMemo(() => tokenizeType(text), [text]);
  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.kind === "internal") {
          return (
            <RefLink
              key={i}
              defName={tok.value}
              onNavInternal={onNavInternal}
            />
          );
        }
        if (tok.kind === "external") {
          return (
            <ExternalLink
              key={i}
              nsid={tok.value}
              onNavExternal={onNavExternal}
            />
          );
        }
        return <span key={i}>{tok.value}</span>;
      })}
    </>
  );
}

interface TypeToken {
  kind: "literal" | "internal" | "external";
  value: string;
}

function tokenizeType(text: string): TypeToken[] {
  const out: TypeToken[] = [];
  // Match #defName or any.dotted.nsid that contains at least one dot.
  // The dot-detector intentionally requires a TLD-style cluster so we
  // don't pick up fragments like "ref(" or "<>" punctuation.
  const re = /(#[A-Za-z_][\w]*)|([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*){2,}(?:#[A-Za-z_][\w]*)?)/g;
  let last = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m.index > last) {
      out.push({ kind: "literal", value: text.slice(last, m.index) });
    }
    if (m[1]) {
      out.push({ kind: "internal", value: m[1].slice(1) });
    } else if (m[2]) {
      out.push({ kind: "external", value: m[2] });
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    out.push({ kind: "literal", value: text.slice(last) });
  }
  return out;
}

// -----------------------------------------------------------------
// Refs view: per-def "uses" / "used by" listing.
// -----------------------------------------------------------------

interface RefEdge {
  from: string;
  to: string;
  external: boolean;
}

function collectRefs(defs: Record<string, Def>): RefEdge[] {
  const edges: RefEdge[] = [];
  function walk(from: string, node: unknown): void {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((n) => walk(from, n));
      return;
    }
    const obj = node as Record<string, unknown>;
    if (
      obj.type === "ref" &&
      typeof obj.ref === "string"
    ) {
      const local = localRefName(obj.ref);
      edges.push({
        from,
        to: local ?? obj.ref,
        external: !local,
      });
    }
    if (obj.type === "union" && Array.isArray(obj.refs)) {
      for (const r of obj.refs as unknown[]) {
        if (typeof r === "string") {
          const local = localRefName(r);
          edges.push({ from, to: local ?? r, external: !local });
        }
      }
    }
    for (const v of Object.values(obj)) walk(from, v);
  }
  for (const [name, def] of Object.entries(defs)) walk(name, def);
  return edges;
}

function RefsView({
  body,
  onNavInternal,
  onNavExternal,
}: {
  body: unknown;
  onNavInternal: (defName: string) => void;
  onNavExternal: (nsid: string) => void;
}) {
  const defs = useMemo(() => getDefs(body), [body]);
  const edges = useMemo(() => collectRefs(defs), [defs]);
  const defNames = Object.keys(defs);

  if (edges.length === 0) {
    return (
      <p className="p-3 text-xs text-stone-500">
        No internal or external refs detected in this lexicon.
      </p>
    );
  }

  const uses = new Map<string, Array<{ to: string; external: boolean }>>();
  const usedBy = new Map<string, string[]>();
  for (const e of edges) {
    const usesArr = uses.get(e.from) ?? [];
    if (!usesArr.some((u) => u.to === e.to)) {
      usesArr.push({ to: e.to, external: e.external });
    }
    uses.set(e.from, usesArr);

    const usedArr = usedBy.get(e.to) ?? [];
    if (!usedArr.includes(e.from)) usedArr.push(e.from);
    usedBy.set(e.to, usedArr);
  }

  const externalTargets = Array.from(
    new Set(edges.filter((e) => e.external).map((e) => e.to)),
  );

  return (
    <div className="p-3 text-xs">
      <table className="w-full">
        <thead className="text-left text-stone-500">
          <tr>
            <th className="py-1 font-medium">def</th>
            <th className="py-1 font-medium">uses</th>
            <th className="py-1 font-medium">used by</th>
          </tr>
        </thead>
        <tbody>
          {defNames.map((n) => {
            const u = uses.get(n) ?? [];
            const ub = usedBy.get(n) ?? [];
            if (u.length === 0 && ub.length === 0) return null;
            return (
              <tr key={n} className="border-t border-stone-100 align-top">
                <td className="py-1 pr-3 font-mono font-semibold">
                  <RefLink
                    defName={n}
                    onNavInternal={onNavInternal}
                    className="text-stone-900 hover:text-sky-700 hover:underline"
                  />
                </td>
                <td className="py-1 pr-3 font-mono">
                  {u.length === 0 ? (
                    <span className="text-stone-400">nothing</span>
                  ) : (
                    u.map((edge, i) => (
                      <span key={edge.to} className="inline-block mr-2">
                        {i > 0 && " "}
                        {edge.external ? (
                          <ExternalLink
                            nsid={edge.to}
                            onNavExternal={onNavExternal}
                          />
                        ) : (
                          <RefLink
                            defName={edge.to}
                            onNavInternal={onNavInternal}
                          />
                        )}
                      </span>
                    ))
                  )}
                </td>
                <td className="py-1 font-mono">
                  {ub.length === 0 ? (
                    <span className="text-stone-400">nothing in this doc</span>
                  ) : (
                    ub.map((from) => (
                      <span key={from} className="inline-block mr-2">
                        <RefLink
                          defName={from}
                          onNavInternal={onNavInternal}
                        />
                      </span>
                    ))
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {externalTargets.length > 0 && (
        <div className="mt-4 border-t border-stone-200 pt-3">
          <h4 className="text-stone-600 font-semibold mb-1">
            External lexicon refs
          </h4>
          <ul className="font-mono text-stone-700">
            {externalTargets.map((t) => (
              <li key={t} className="leading-snug">
                <ExternalLink nsid={t} onNavExternal={onNavExternal} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[10px] text-stone-500 mt-3">
        Internal `#defName` refs jump to the Fields tab and scroll;
        external NSIDs open in this browser if they're loaded, else
        copy to your clipboard.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------
// Diff against a pinned baseline
// -----------------------------------------------------------------

interface DiffEntry {
  kind: "added" | "removed" | "changed";
  path: string;
  before?: string;
  after?: string;
}

function flattenForDiff(body: unknown): Map<string, string> {
  const out = new Map<string, string>();
  const defs = getDefs(body);
  for (const [defName, def] of Object.entries(defs)) {
    out.set(`def:${defName}.type`, String(def.type ?? "?"));
    const target = objectSchemaFor(def);
    const props = (target?.properties as Record<string, unknown>) ?? {};
    const required = new Set(
      Array.isArray(target?.required) ? (target!.required as string[]) : [],
    );
    for (const [pname, raw] of Object.entries(props)) {
      const p = (raw as Record<string, unknown>) ?? {};
      out.set(
        `def:${defName}.props.${pname}`,
        JSON.stringify({
          type: p.type,
          format: p.format,
          ref: p.ref,
          required: required.has(pname),
        }),
      );
    }
  }
  return out;
}

function computeDiff(before: unknown, after: unknown): DiffEntry[] {
  const a = flattenForDiff(before);
  const b = flattenForDiff(after);
  const entries: DiffEntry[] = [];
  for (const [k, v] of b) {
    if (!a.has(k)) entries.push({ kind: "added", path: k, after: v });
    else if (a.get(k) !== v)
      entries.push({ kind: "changed", path: k, before: a.get(k), after: v });
  }
  for (const [k, v] of a) {
    if (!b.has(k)) entries.push({ kind: "removed", path: k, before: v });
  }
  return entries;
}

// localStorage-backed pinned baseline, keyed by lexicon id so each
// lexicon has its own.
function baselineKey(body: unknown): string | null {
  const id = lexiconId(body);
  return id ? `fieldwork:lexbaseline:${id}` : null;
}

function readBaseline(body: unknown): unknown | null {
  const key = baselineKey(body);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function DiffView({ body }: { body: unknown }) {
  const [tick, setTick] = useState(0);
  const baseline = useMemo(() => readBaseline(body), [body, tick]);
  const diff = useMemo(
    () => (baseline ? computeDiff(baseline, body) : []),
    [baseline, body],
  );

  function pin() {
    const key = baselineKey(body);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(body));
      setTick((t) => t + 1);
    } catch {
      /* quota / privacy mode */
    }
  }
  function clear() {
    const key = baselineKey(body);
    if (!key) return;
    localStorage.removeItem(key);
    setTick((t) => t + 1);
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3 text-xs">
        <button
          type="button"
          onClick={pin}
          className="px-2 py-1 rounded border border-stone-300 bg-white"
        >
          Pin current as baseline
        </button>
        {baseline !== null && baseline !== undefined && (
          <button
            type="button"
            onClick={clear}
            className="px-2 py-1 rounded border border-stone-300 bg-white text-stone-600"
          >
            Clear baseline
          </button>
        )}
        <span className="text-stone-500">
          {baseline
            ? "Diffing current view against the pinned baseline."
            : "No baseline pinned for this lexicon yet."}
        </span>
      </div>
      {!baseline ? (
        <p className="text-xs text-stone-500">
          Pin a baseline now, then come back after a lexicon edit (or
          re-resolve from lexicon.garden) to see what changed.
        </p>
      ) : diff.length === 0 ? (
        <p className="text-xs text-emerald-700">
          No changes since the pinned baseline.
        </p>
      ) : (
        <ul className="text-xs divide-y divide-stone-100 border border-stone-200 rounded">
          {diff.map((d, i) => (
            <li
              key={i}
              className={
                d.kind === "added"
                  ? "bg-emerald-50 text-emerald-900 px-3 py-1.5"
                  : d.kind === "removed"
                    ? "bg-red-50 text-red-900 px-3 py-1.5"
                    : "bg-amber-50 text-amber-900 px-3 py-1.5"
              }
            >
              <span className="font-mono uppercase mr-2">{d.kind}</span>
              <span className="font-mono">{d.path}</span>
              {d.before && (
                <div className="mt-0.5 text-[10px] font-mono text-stone-700">
                  before: {d.before}
                </div>
              )}
              {d.after && (
                <div className="mt-0.5 text-[10px] font-mono text-stone-700">
                  after: {d.after}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Try: minimal example body / curl-able request stub
// -----------------------------------------------------------------

function placeholderFor(
  p: Record<string, unknown>,
  ctx: ActiveContext | null,
): unknown {
  const type = p.type;
  const userDid = ctx?.did ?? "did:plc:0000000000000000000000000";
  switch (type) {
    case "string": {
      const fmt = typeof p.format === "string" ? p.format : "";
      switch (fmt) {
        case "datetime":
          return new Date().toISOString();
        case "did":
          return userDid;
        case "at-uri":
          return `at://${userDid}/<collection>/<rkey>`;
        case "nsid":
          return "com.example.foo";
        case "uri":
          return "https://example.com";
        case "cid":
          return "bafy0000000000000000000000000000";
        default: {
          if (Array.isArray(p.knownValues) && p.knownValues.length > 0) {
            return p.knownValues[0];
          }
          if (Array.isArray(p.enum) && p.enum.length > 0) {
            return p.enum[0];
          }
          return "<string>";
        }
      }
    }
    case "integer":
      return typeof p.minimum === "number" ? p.minimum : 0;
    case "boolean":
      return false;
    case "array":
      return [];
    case "blob":
      return { $type: "blob" };
    case "ref":
      return { $ref: p.ref ?? "" };
    case "union":
      return { $union: p.refs ?? [] };
    case "object":
      return generateExampleObject(p as Def, ctx);
    case "cid-link":
      return { $link: "bafy0000000000000000000000000000" };
    default:
      return null;
  }
}

function generateExampleObject(
  schema: Def,
  ctx: ActiveContext | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const required = new Set(
    Array.isArray(schema.required) ? (schema.required as string[]) : [],
  );
  const props = (schema.properties as Record<string, unknown>) ?? {};
  for (const [name, raw] of Object.entries(props)) {
    if (!required.has(name)) continue;
    out[name] = placeholderFor((raw as Record<string, unknown>) ?? {}, ctx);
  }
  return out;
}

function TryView({ body }: { body: unknown }) {
  const ctx = useActiveContext();
  const id = lexiconId(body) ?? "";
  const main = getDefs(body).main;
  if (!main) {
    return (
      <p className="p-3 text-xs text-stone-500">
        Lexicon has no `main` def to generate a stub for.
      </p>
    );
  }
  const type = String(main.type ?? "?");
  const pdsHost = ctx?.pdsUrl ?? "https://<your-pds>";
  const userBadge = ctx ? (
    <p className="text-[11px] text-emerald-700 mb-1">
      Filled in for @{ctx.handle ?? ctx.did} ({pdsHost}).
    </p>
  ) : (
    <p className="text-[11px] text-stone-500 mb-1">
      Sign in to substitute your DID and PDS into these stubs.
    </p>
  );

  if (type === "record") {
    const schema = (main.record as Def) ?? null;
    const example = schema ? generateExampleObject(schema, ctx) : {};
    const recordBody = { $type: id, ...example };
    const repoArg = ctx?.handle ?? ctx?.did ?? "<your-handle-or-did>";
    return (
      <div className="p-3 space-y-3 text-xs">
        <div>
          <h4 className="font-semibold text-stone-700 mb-1">
            Minimal record body
          </h4>
          {userBadge}
          <p className="text-stone-500">
            Required fields filled with placeholder values. Pipe this into
            `com.atproto.repo.createRecord` against your PDS.
          </p>
        </div>
        <pre className="bg-stone-50 border border-stone-200 rounded p-3 font-mono whitespace-pre-wrap">
          {JSON.stringify(recordBody, null, 2)}
        </pre>
        <pre className="bg-stone-50 border border-stone-200 rounded p-3 font-mono whitespace-pre-wrap">
          {`curl -s -X POST '${pdsHost}/xrpc/com.atproto.repo.createRecord' \\
  -H 'authorization: Bearer <ACCESS_TOKEN>' \\
  -H 'content-type: application/json' \\
  -d '${JSON.stringify({
    repo: repoArg,
    collection: id,
    record: recordBody,
  })}'`}
        </pre>
      </div>
    );
  }

  if (type === "query" || type === "subscription") {
    const params = (main.parameters as Def) ?? null;
    const query = params ? generateExampleObject(params, ctx) : {};
    const qs = Object.entries(query)
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join("&");
    const url = `${pdsHost}/xrpc/${id}${qs ? `?${qs}` : ""}`;
    return (
      <div className="p-3 space-y-3 text-xs">
        <div>
          <h4 className="font-semibold text-stone-700 mb-1">Request URL</h4>
          {userBadge}
          <p className="text-stone-500">
            Required parameters filled with placeholders.
          </p>
        </div>
        <pre className="bg-stone-50 border border-stone-200 rounded p-3 font-mono break-all whitespace-pre-wrap">
          {url}
        </pre>
        <pre className="bg-stone-50 border border-stone-200 rounded p-3 font-mono whitespace-pre-wrap">
          {`curl -s '${url}'`}
        </pre>
      </div>
    );
  }

  if (type === "procedure") {
    const inputSchema =
      ((main.input as Def | undefined)?.schema as Def | null) ?? null;
    const reqBody = inputSchema ? generateExampleObject(inputSchema, ctx) : {};
    const url = `${pdsHost}/xrpc/${id}`;
    return (
      <div className="p-3 space-y-3 text-xs">
        <div>
          <h4 className="font-semibold text-stone-700 mb-1">
            Procedure invocation
          </h4>
          {userBadge}
          <p className="text-stone-500">
            POST with the generated body; required fields filled with
            placeholders.
          </p>
        </div>
        <pre className="bg-stone-50 border border-stone-200 rounded p-3 font-mono whitespace-pre-wrap">
          {`curl -s -X POST '${url}' \\
  -H 'content-type: application/json' \\
  -d '${JSON.stringify(reqBody)}'`}
        </pre>
      </div>
    );
  }

  return (
    <p className="p-3 text-xs text-stone-500">
      No stub available for `main.type = ${type}`.
    </p>
  );
}
