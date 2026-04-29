# Changelog

All notable changes to fieldwork are recorded in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
fieldwork is pre-1.0: the `0.x` series may include arbitrary breaking
changes between minor releases — record-draft shape, in-memory
workspace API, and the import / export contract are all in scope.

## [Unreleased]

## [0.2.0] - 2026-04-29

### Added

- Deliberation Composer, a new top-level tool for `dev.idiolect.deliberation`, `deliberationStatement`, and `deliberationOutcome` records. Authors a community-scoped question or proposal with topic, description, classification (open enum: question, proposal, grievance, retrospective, with custom-slug fallback), status (open, closed, tabled, adopted, rejected, with custom-slug fallback), classification and status vocab pointers, auth-required toggle, optional closed-at, and outcome at-uri. Statement and outcome kinds are wired through the workspace store, sidebar, fixtures, import and export, guidance, and OAuth scope tier. Deliberation votes are intentionally out of scope for fieldwork (real-time action on a member's PDS, not authored governance) but the scope is reserved at the FULL tier.
- VocabularyEditor rewritten around idiolect v0.7's typed multi-relation knowledge graph (`nodes` plus `edges`). Per-node fields cover kind, label, alternateLabels, hiddenLabels, scopeNote, example, historyNote, editorialNote, changeNote, notation, definition, status, externalIds (system enum plus match type), and SKOS Collection member_of. Per-edge fields cover relation slug, source, target, weight, confidence, valid-from, valid-to, source attestation, and full OWL Lite property characteristics (symmetric, asymmetric, transitive, reflexive, irreflexive, functional, inverseFunctional, inverseOf) plus per-relation world override. Five vocab fixtures cover single-relation subsumption, multi-relation, OWL Lite, SKOS Core, and the deliberation vote-stances vocab.
- CommunityConfig gains the three new idiolect v0.7 community fields. `roleAssignments` (sparse `[{did, role}]` list using a typed role select with custom-slug fallback over member, moderator, delegate, author, and a `memberRoleVocab` at-uri pointer), `recordHosting` (member-hosted, community-hosted, hybrid), and `appviewEndpoint` for community-hosted record stores.
- ConditionTreeEditor at-uri inputs (sourceIs and targetIs schema, action and purpose vocabularies) now use `AtUriAutocomplete` with the correct `expectedCollection` so handles work as shorthand for at-uris in recommendation conditions.

### Changed

- Bumped `@idiolect-dev/schema` to `^0.7.0` and the `idiolect` workspace tag to `v0.7.0`. Refreshed all bundled lexicon JSONs to the idiolect v0.7 shapes (vocab knowledge graph, open-enum convention across `adapter`, `community`, `recommendation`, `belief`, `observation`, `correction`, `encounter`, `bounty`, `retrospection`, `verification`).
- OAuth client metadata declares the four new `dev.idiolect.deliberation*` repo scopes. The scopes test enforces parity.
- Autocomplete coverage. Role-assignment DIDs in Community Config use `HandleSearch` (handle to DID resolution plus active-session suggestions, replacing the bare datalist of member DIDs). `inverseOf` on relation-kind vocab nodes uses the local-node datalist filtered to relation-kind ids so authors pick from declared relations rather than free-typing slugs.
- Walkthroughs cover every new feature. A full Deliberation Composer flow (eight steps), vocab flow rewritten around the knowledge-graph shape (Nodes step, Edges and OWL Lite step, Templates step), community flow gains Role assignments and Record hosting steps, recommendation flow's Conditions step mentions at-uri autocomplete, intro tool-nav copy lists all seven tools. The Lexicon Browser walkthrough auto-selects `dev.idiolect.recommendation` (the most feature-rich bundled lexicon) so each tab tour lands on real content rather than the empty-state placeholder.

### Removed

- Legacy tree-shape vocab editor and fixtures (`actions`, `top`, `parents`, `class`, action-three-tier / action-broad-tree / action-hierarchy-closed / purpose-open / purpose-with-classes templates). idiolect v0.7's typed knowledge graph subsumes the tree-shape form, no `dev.idiolect.vocab` records exist on atproto, and there's no migration burden.

## [0.1.17] - 2026-04-28

### Fixed

- WASM-unsupported browsers got a misleading "Run ./scripts/build-wasm.sh from the project root" hint, which is dev-only guidance no end user can act on. The boot path now pre-flights `typeof WebAssembly === "object"` and shows a dedicated "your browser doesn't support WebAssembly" message instead of letting the WASM load throw a generic "WebAssembly is not defined". The bundle-load-failed branch keeps the dev hint only when the page is served from `localhost` / `127.0.0.1`; on production deploys it suggests a reload instead.
- The walkthrough hub and confirm-modal host previously mounted regardless of WASM state, so a no-WASM browser saw the tutorial dialogs over an unusable app. Both now mount only after the WASM bundle is up, so the error is the first thing the user sees on a browser that can't run the app.

## [0.1.16] - 2026-04-27

### Changed

- Mobile sidebar collapses to a single-row header bar by default and expands inline up to 60vh when tapped. Previously sat above the editor with a fixed 64-row crop, eating most of the viewport for a list whose first few entries were the only ones visible. Same pattern for the Guidance pane and the Lexicon Browser's lexicon list. On md+ everything renders as before.
- Walkthrough spotlight card pins to the bottom of the viewport as a sheet on phones (< 640px) instead of trying to float a 380px-wide card next to the target. Clicking a record in the lexicon browser sidebar auto-collapses the list on mobile so the user lands on the doc viewer. Walkthrough footer wraps when the buttons + checkbox can't fit on one line.

## [0.1.15] - 2026-04-27

### Changed

- Walkthroughs now cover every functionally-distinct section in each workshop. The intro flow gains steps for the Guidance pane and the per-tool "?" trigger button. Vocab adds Top action id and Supersedes steps. Community splits the previous catch-all "Core sets and endorsements" step into individually-targeted Membership roll, Core schemas, Core lenses, and Endorsed communities steps, plus a Conventions text step. Recommendation gains Issuing community, Caveats, and a separate Preconditions step (previously folded into Conditions). Lexicon Browser gets one step per tab (JSON, Definitions, Fields, Refs, Diff, Try). Lens Manager adds a Sign-in-first step. New `data-walk` markers thread the spotlight onto each section that needed one.

## [0.1.14] - 2026-04-27

### Added

- Dialect Composer now edits the three remaining lexicon fields the form previously couldn't reach: `idiolects` (the schemas this dialect bundles, edited as a list of at-uris with autocomplete), `deprecations` (full structured editor over `{ref, replacement?, deprecatedAt, reason}` items, every at-uri autocompleted, datetime via the same Now-stamping picker the rest of the form uses), and `previousVersion` (single at-uri that points back at a prior dialect, autocomplete scoped to `dev.idiolect.dialect`). New `dialect/with-idiolects` fixture exercises the idiolects field. Dialect walkthrough gains three steps so first-run users see all three new sections.

## [0.1.13] - 2026-04-27

### Added

- Community Config now edits the four fields the lexicon defined but the form previously couldn't reach: `coreSchemas` and `coreLenses` (lists of refs the community pins as canonical), `endorsedCommunities` (peer communities recognised as legitimate interlocutors), and `membershipRoll` (at-uri to an externally-maintained membership record for larger communities). Every field is autocompleted via `AtUriAutocomplete` with the right `expectedCollection`, so handles work as shorthand for at-uris everywhere. The bundled `community/with-roll-and-endorsements` and `community/with-core-sets` fixtures are now fully editable instead of just imported. Walkthrough gains a "Core sets and endorsements" step.

## [0.1.12] - 2026-04-27

### Added

- Recommendation lens-path rows now expose the optional `cid` and `direction` fields on `dev.idiolect.defs#lensRef` via a per-row "…" expander. Direction is a typed select (unidirectional / bidirectional). Empty values stay absent from the serialised body so unset rows look the same as before. Recommendation walkthrough updated to mention the new fields.

## [0.1.11] - 2026-04-27

### Fixed

- `publishDraft` now runs the body through panproto's atproto-lexicon parser before posting and refuses on validation failure. Previously a recommendation draft with an empty `lensPath` (which the lexicon defines as `minLength: 1`) would be rejected by the PDS with an opaque `createRecord failed` error. Now publish surfaces the panproto error directly so the user knows what to fix. Recommendation walkthrough updated to call out the at-least-one-lens requirement.

## [0.1.10] - 2026-04-27

### Fixed

- Community Config previously rendered `community.conventions` as a single text input labelled "Conventions URI" with a placeholder URL. The lexicon defines that field as `array<union<#conventionReviewCadence, #conventionVerificationReq, #conventionDeprecationPolicy>>`, so anything typed into the URI box was invalid against the schema. Replace with a structured editor that adds, reorders, and removes typed entries. Each entry exposes the variant's required fields (review cadence's `maxDays` and optional scope, verification requirement's `kind` enum, deprecation policy's `noticePeriodDays` and `replacementRequired` toggle). Existing drafts imported under the old shape fall back to an empty list rather than crashing.

## [0.1.9] - 2026-04-27

### Fixed

- Import button used `py-1`, New and Export used `py-1.5`, leaving Import visibly shorter than its neighbours in every tool's toolbar. Bump Import to match.

## [0.1.8] - 2026-04-27

### Fixed

- Walkthrough's centered-modal final step labelled the primary button "Back to hub", but the action just closed the modal. Match the spotlight variant and label it "Done". The secondary "Hub" button still navigates back to the walkthrough hub.

## [0.1.7] - 2026-04-27

### Fixed

- Lens Manager's "protolab" link pointed at `https://protolab.dev`. The correct URL is `https://panproto.dev/protolab`.

## [0.1.6] - 2026-04-27

### Changed

- Lexicon Browser Fields view: inlined ref expansions now render as siblings in the parent table instead of nested inner tables, so the type, format, and description columns line up at every depth. Indentation is driven by per-row left padding on the name cell.

## [0.1.5] - 2026-04-27

### Fixed

- Sign-in still failed with "Invalid redirect_uri https://idiolect.dev/fieldwork/oauth/callback" for users whose browser or whose PDS auth server had a stale copy of the pre-0.1.4 client metadata (GitHub Pages serves `client-metadata.json` with `max-age=600`, and atproto auth servers cache metadata server-side too). Register both redirect URIs in the metadata so stale and fresh clients both validate. New flows pick the SPA root, the legacy callback URI stays valid as a fallback.

## [0.1.4] - 2026-04-27

### Fixed

- Sign-in completed at the user's PDS but never produced a signed-in session in fieldwork. The `BrowserOAuthClient` library's `findRedirectUrl()` matches the current `location.pathname` against the registered `redirect_uri`. Our static callback page redirected the browser from `/fieldwork/oauth/callback` to `/fieldwork/`, so the path no longer matched the registered URI and the callback exchange was skipped silently. Register the SPA root (`https://idiolect.dev/fieldwork/`) as `redirect_uri` directly so the auth server lands the browser on the matching path. The dev-only loopback `client_id` synthesises the same shape.

## [0.1.3] - 2026-04-27

### Fixed

- OAuth `invalid_scope` for `repo:dev.panproto.schema.lens` on the deployed site. The Lens Manager added the scope to `REPO_SCOPES`, which the dev-only loopback `client_id` synthesises automatically, but production reads the static `app/public/oauth/client-metadata.json` whose `scope` string was hand-rolled and drifted. Added the missing scope and a vitest parity test asserting the static metadata declares every `REPO_SCOPES` entry. CI now runs the test on every push.

### Changed

- README: drop the broken `CONTRIBUTING.md` link, replace remaining em dashes and semicolons with periods, parentheses, and commas to match the in-app punctuation pass.

## [0.1.2] - 2026-04-27

### Fixed

- Live deploy still failed after 0.1.1: passing `import panprotoGlue from "@panproto-glue"` to `Panproto.init()` handed in the *default export* (the wasm-bindgen init function) instead of the namespace object. The package's `loadWasm` saw an input that wasn't a glue module, fell into its URL-import branch, and threw "Failed to construct 'URL': Invalid URL" because `String(initFn)` is not a URL. Switch to `import * as panprotoGlue` so the namespace (with `default` = init fn plus the named Rust-fn exports) reaches `Panproto.init()` and matches `WasmGlueModule` at runtime.
- Re-render `og.png` so the "a workshop for community schema curation" tagline is visible. Headless Chrome's `--window-size=1200,630` was clipping the bottom ~70px below the wordmark; render at 1200x720 and crop to 1200x630 from the top with imagemagick.

## [0.1.1] - 2026-04-27

### Fixed

- Production build now bundles the `@panproto/core` wasm-bindgen glue and `_bg.wasm` into `dist/assets/` with proper fingerprinting. Previously the deployed site at `idiolect.dev/fieldwork/` 404'd on `panproto_wasm.js` because the package's runtime resolver hides its `import.meta.url` from Vite via string concatenation. We now use the package's documented `Panproto.init(glueModule)` bundler overload, reaching the glue through a project-local Vite `resolve.alias` (the package's `exports` field doesn't expose the subpath). Filed upstream as panproto/panproto#57.

### Added

- Open Graph image (`public/og.png`) and meta tags so links to `idiolect.dev/fieldwork/` render with a card.

## [0.1.0] - 2026-04-27

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
