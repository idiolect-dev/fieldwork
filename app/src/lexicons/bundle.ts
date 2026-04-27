// Bundled lexicon set.
//
// Fieldwork ships every `dev.idiolect.*` and vendored
// `dev.panproto.*` lexicon as a JSON import so the Lexicon Browser
// can show them read-only and the validator can build panproto
// schemas off any of them. Vite's `import.meta.glob` walks the
// `json/` subtree at build time and bakes the contents into the
// bundle as plain `.json` modules — no `fs` access at runtime, no
// network round-trip on first paint.
//
// Source of truth lives upstream in `idiolect-dev/idiolect`'s
// `lexicons/` tree. Copies in `json/` are vendored at the
// `@idiolect-dev/schema@0.4.x` cut and re-vendored alongside each
// release of fieldwork.

interface BundledLexicon {
  /** Canonical NSID of the lexicon (`id` field of the doc). */
  nsid: string;
  /** The lexicon document itself. */
  body: unknown;
}

// Eagerly import all vendored lexicon JSONs. Eager mode bundles
// them into the synchronous initial chunk, which is what we want —
// the Lexicon Browser opens with the full set already available.
const modules = import.meta.glob<{ default: { id?: string } }>(
  "./json/**/*.json",
  { eager: true },
);

export const bundledLexicons: BundledLexicon[] = Object.values(modules)
  .map((m) => m.default)
  .filter((doc): doc is { id: string } => typeof doc?.id === "string")
  .map((doc) => ({ nsid: doc.id, body: doc }))
  .sort((a, b) => a.nsid.localeCompare(b.nsid));
