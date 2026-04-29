// Record validation via panproto.
//
// The chain is: lexicon JSON → `panproto.parseLexicon` → BuiltSchema
// (cached per-NSID) → `panproto.parseJson(schema, body)` → Instance
// → `instance.validate()` → typed error list.
//
// We prefer panproto over `@atproto/lexicon` because panproto is the
// schema theory the rest of idiolect is built on; its validator
// understands the lexicon's *graph* shape (vertices, edges,
// constraints, variants), not just the lexicon document's surface
// JSON. Errors surface with structural location into the schema.

import type { BuiltSchema } from "@panproto/core";
import { panproto } from "./init";
import { bundledLexicons } from "../lexicons/bundle";

/** Cache of `dev.idiolect.<kind>` BuiltSchemas, lazily populated. */
const schemaCache = new Map<string, BuiltSchema>();

function nsidForKind(kind: string): string {
  // Kebab-case draft kinds map to camelCase lexicon nsid stems.
  switch (kind) {
    case "deliberation-statement":
      return "dev.idiolect.deliberationStatement";
    case "deliberation-outcome":
      return "dev.idiolect.deliberationOutcome";
    default:
      return `dev.idiolect.${kind}`;
  }
}

function schemaForKind(kind: string): BuiltSchema {
  const nsid = nsidForKind(kind);
  const hit = schemaCache.get(nsid);
  if (hit) return hit;
  const lex = bundledLexicons.find((l) => l.nsid === nsid);
  if (!lex) {
    throw new Error(`no bundled lexicon for ${nsid}`);
  }
  const built = panproto().parseLexicon(lex.body as object);
  schemaCache.set(nsid, built);
  return built;
}

export interface ValidationResult {
  ok: boolean;
  /** Human-readable error string; empty when `ok`. */
  error: string;
  /**
   * Structured issues from `instance.validate()`. Empty when the
   * parse step itself failed (no instance to validate against).
   */
  issues: Array<{ message: string; path?: string }>;
}

/**
 * Validate a record body against `dev.idiolect.<kind>` via panproto.
 *
 * Two failure modes:
 * - **Parse failure**; the JSON didn't decode into an Instance
 *   (wrong shape against the schema graph). `error` carries the
 *   message; `issues` is empty.
 * - **Validation failure**; the Instance decoded but
 *   `instance.validate()` reported issues (constraint violations).
 *   `error` is a one-line summary; `issues` carries the detail.
 */
export function validateRecord(
  kind:
    | "dialect"
    | "vocab"
    | "community"
    | "recommendation"
    | "deliberation"
    | "deliberation-statement"
    | "deliberation-outcome",
  body: unknown,
): ValidationResult {
  let schema: BuiltSchema;
  try {
    schema = schemaForKind(kind);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      issues: [],
    };
  }
  const json = JSON.stringify(body);
  let instance;
  try {
    instance = panproto().parseJson(schema, json);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      issues: [],
    };
  }
  const result = instance.validate();
  if (result.isValid) {
    return { ok: true, error: "", issues: [] };
  }
  const issues = result.errors.map((message: string) => ({ message }));
  return {
    ok: false,
    error: issues.map((i) => i.message).join("\n"),
    issues,
  };
}

/**
 * Validate an arbitrary lexicon JSON document by trying to lift it
 * into a panproto schema. Used by the Lexicon Browser when the
 * user imports a non-bundled lexicon; a cleanly-parsing schema is
 * the strongest "this lexicon is well-formed" signal we can give.
 */
export function validateLexiconDocument(doc: unknown): ValidationResult {
  try {
    const schema = panproto().parseLexicon(doc as object);
    // Probe the resulting schema's metadata so a partial parse
    // surfaces as an issue rather than a silent pass.
    const _ = schema.data;
    void _;
    return { ok: true, error: "", issues: [] };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      issues: [],
    };
  }
}
