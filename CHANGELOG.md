# Changelog

All notable changes to fieldwork are recorded in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
fieldwork is pre-1.0: the `0.x` series may include arbitrary breaking
changes between minor releases — record-draft shape, in-memory
workspace API, and the import / export contract are all in scope.

## [Unreleased]

### Added

- Initial scaffold: Cargo workspace with `fieldwork-core` and
  `fieldwork-wasm`, Vite + React + TypeScript app, GitHub Pages
  deploy workflow, depend on `idiolect-records` v0.4.0.
- Five v1 tools: Dialect Composer, Vocabulary Editor, Lexicon
  Browser, Community Config, Recommendation Builder.
- Import sources: at-uri (resolved via configurable atproto AppView),
  JSON file drop, bundled fixtures.
- Three export shapes: download JSON record body, copy
  `idiolect-cli` publish command, **publish directly to PDS via
  atproto OAuth**.
- Per-draft guidance pane explaining downstream record references,
  with **cross-draft consistency checks** that flag when a draft
  references a workspace community vs. an external at-uri.
- **Diff pane** on every form: compares the current draft body
  against an "original" snapshot taken at import time (or the last
  user-promoted baseline). Per-leaf table of added / modified /
  removed fields.
- **Condition-tree editor** for `Recommendation.conditions` and
  `.preconditions`: structured RPN-stack editor with insert /
  reorder / remove, atom + combinator type picker, and live
  stack-balance check (warns when the postfix array doesn't reduce
  to a single result).
- **Multi-DID session switching**: sign in to multiple atproto
  identities at once and switch between them in the header
  Session menu. Each session uses atproto OAuth's granular scope
  spec — three intent tiers (`read-only`, `curator`, `full`)
  bundled either as `repo:dev.idiolect.*` scopes or as
  `include:dev.idiolect.auth.*` permission-set references when
  `VITE_USE_PERMISSION_SETS=true`.
- **Lexicon validation through panproto** (`@panproto/core`): every
  edit runs the body through panproto's atproto-lexicon parser
  and the resulting `Instance.validate()`. The Lexicon Browser
  validates imported lexicon documents the same way, surfacing
  schema-graph errors panproto cares about (vertices, edges,
  constraints, variants), not just JSON-shape mismatches.
- **URL-param-driven workspace prefill** for community-branded
  fieldwork instances. `?community=at://...&appview=https://...&did=did:plc:...&tool=dialect`
  loads on first paint then strips the params. Communities can
  fork the repo, redirect a custom domain, and ship a
  preconfigured workshop with no code change.
- Static `oauth/client-metadata.json` + `oauth/callback/index.html`
  shipped under `app/public/oauth/` so atproto auth servers can
  resolve fieldwork as a registered OAuth client.

### Stability

- Pre-1.0. The 0.x series tracks `idiolect`'s lexicon evolution;
  major-record-shape changes upstream will produce a matching
  fieldwork release.
- atproto OAuth permission sets are gated behind a build-time flag
  (`VITE_USE_PERMISSION_SETS`) until the
  `dev.idiolect.auth.{curatorAccess,fullAccess}` lexicons are
  published and resolvable. Until then we use individual `repo:`
  scopes per `dev.idiolect.*` collection — same access shape, just
  not the more-readable `include:` syntax.
- `@idiolect-dev/schema@^0.4.1` integration: typed
  `Dialect` / `Vocab` / `Community` / `Recommendation` flow
  through the workspace store and form types. The form helpers
  retain a `Record<string, unknown>` shim where they patch fields
  generically; readers (export render, publish, validation) use
  the typed shapes directly.
- Lexicon Browser now ships every `dev.idiolect.*` and vendored
  `dev.panproto.*` lexicon (~55 docs total) as eager JSON imports
  via `import.meta.glob`, replacing the four hand-written stubs.
