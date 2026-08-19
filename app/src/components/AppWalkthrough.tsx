// Global walkthrough.
//
// One modal mounted at App root. On first visit it pops a hub that
// describes each workshop and lets the user pick one to walk
// through (or skip). Each flow is a list of steps; steps with a
// `target` selector trigger a spotlight overlay that dims the rest
// of the page, frames the target element, and pins a tooltip card
// next to it. Steps without a target render as a centered text card
// (intro / outro of each flow).
//
// The "?" buttons next to each tool's heading dispatch through the
// shared `walkthroughStore` to open this same modal at the
// matching flow, so users can revisit a tour any time.

import { useEffect, useLayoutEffect, useState } from "react";
import { useWorkspaceStore } from "../workspace/store";
import type { ToolKey } from "../workspace/store";
import type { Draft, DraftKind } from "../workspace/types";
import { mintDraftId } from "../workspace/ids";
import { findFixture } from "../fixtures";
import { useWalkthroughStore } from "./walkthroughStore";

interface Step {
  title: string;
  body: string;
  /** CSS selector for the element to highlight. */
  target?: string;
  /** Switch to this tool before measuring the target. */
  tool?: ToolKey;
}

interface Flow {
  key: string;
  headline: string;
  blurb: string;
  tool?: ToolKey;
  /**
   * Fixture name (`<kind>/<id>`) the walkthrough should clone at
   * the start of the flow so steps have a real draft to highlight.
   * The clone is removed when the flow ends so the user's
   * workspace doesn't accumulate scratch drafts.
   */
  template?: { kind: DraftKind; name: string };
  steps: Step[];
}

const FLOWS: Flow[] = [
  {
    key: "intro",
    headline: "Start here",
    blurb: "How fieldwork is laid out and where everything lives.",
    steps: [
      {
        title: "Welcome",
        body: "fieldwork is a curator's workshop for atproto. You compose dev.idiolect.* records here, then publish them to your PDS. Each tool in the top nav builds one record kind.",
      },
      {
        title: "Tool nav",
        body: "Switch workshops from this row. Seven tools: Dialect Composer, Vocabulary Editor, Community Config, Recommendation Builder, Deliberation Composer (new in idiolect v0.7), Lens Manager (uploads panproto lenses), and Lexicon Browser (read-only).",
        target: "[data-walk='nav']",
      },
      {
        title: "Records",
        body: "The sidebar's top section is a unified Records list. A grey dot means the row is a local-only draft. Emerald means it matches the version on your PDS. Amber means you've edited it since publishing. Click any row to load it into the editor.",
        target: "[data-walk='sidebar']",
      },
      {
        title: "Importing what's already published",
        body: "If you're signed in, records you've published before show up in the same list with the emerald dot, even ones you didn't draft locally. Clicking imports a fresh draft pre-linked to the PDS version so further edits flip the dot to amber.",
        target: "[data-walk='sidebar']",
      },
      {
        title: "Templates",
        body: "Below Records, the Templates section bundles working examples of each record shape. Click to clone a fresh draft.",
        target: "[data-walk='sidebar']",
      },
      {
        title: "Sessions",
        body: "Sign in with one or more atproto handles via OAuth. Granular scopes let you publish only the record kinds you've authorised.",
        target: "[data-walk='session-menu']",
      },
      {
        title: "Guidance pane",
        body: "Every editor pairs with a Guidance pane that runs panproto over your draft on each keystroke. Validation results, cross-draft references, and downstream-impact hints land here without you having to leave the form.",
        tool: "dialect",
        target: "[data-walk='guidance']",
      },
      {
        title: "Re-open any walkthrough",
        body: "The ? next to each tool's heading opens its tour any time. The hub button inside a tour returns to this welcome list so you can pick another workshop.",
        tool: "dialect",
        target: "[data-walk='walkthrough-trigger']",
      },
    ],
  },
  {
    key: "dialect",
    headline: "Dialect Composer",
    blurb: "Bundle your community's preferred lenses into a dialect record.",
    tool: "dialect",
    template: { kind: "dialect", name: "dialect/multi-lens-pipeline" },
    steps: [
      {
        title: "What you're building",
        body: "A dev.idiolect.dialect record. Bundles preferred lenses, deprecations, and an optional supersedes-chain so subscribers know which lens versions to invoke for your community. We've cloned a multi-lens pipeline example for the tour. It'll be removed when you finish.",
      },
      {
        title: "Owning community",
        body: "Pin the community whose curation policy this dialect implements. Type a handle and we autocomplete from your sessions, atproto typeahead, and any community records under that DID.",
        tool: "dialect",
        target: "[data-walk='dialect-owning']",
      },
      {
        title: "Preferred lenses",
        body: "Add lenses one per row. Reorder with the arrows. Lenses you've published yourself appear at the top of the autocomplete. Upload protolab-authored bodies via the Lens Manager.",
        tool: "dialect",
        target: "[data-walk='dialect-lenses']",
      },
      {
        title: "Idiolects",
        body: "The schemas this dialect bundles. Subscribers walk these to know what records the dialect speaks. At-uris autocomplete as usual.",
        tool: "dialect",
        target: "[data-walk='dialect-idiolects']",
      },
      {
        title: "Deprecations",
        body: "Record idiolects or lenses that were once part of the dialect. Each entry takes a deprecated ref, an optional replacement, the deprecation timestamp, and a reason. Subscribers use this to plan migrations.",
        tool: "dialect",
        target: "[data-walk='dialect-deprecations']",
      },
      {
        title: "Previous version",
        body: "Optional at-uri pointer back to the dialect this one supersedes. Forms a version chain subscribers can walk.",
        tool: "dialect",
        target: "[data-walk='dialect-previous']",
      },
      {
        title: "Ship it",
        body: "Export downloads JSON, copies a CLI command, or publishes straight to your PDS via OAuth. After a publish the sidebar dot turns emerald.",
        tool: "dialect",
        target: "[data-walk='editor-toolbar']",
      },
      {
        title: "Update or roll back",
        body: "Edit a published record and the toolbar gains a Revert button (discards local edits, restores the PDS body) and a Delete from PDS button (drops the remote and demotes the local copy back to a draft). Re-publishing replaces the PDS version with the current edits.",
        tool: "dialect",
        target: "[data-walk='editor-toolbar']",
      },
    ],
  },
  {
    key: "vocab",
    headline: "Vocabulary Editor",
    blurb: "Author a typed multi-relation knowledge graph of actions, purposes, and other concepts.",
    tool: "vocab",
    template: { kind: "vocab", name: "vocab/graph-multi-relation" },
    steps: [
      {
        title: "What you're building",
        body: "A dev.idiolect.vocab record. A typed multi-relation knowledge graph: typed nodes (concept, action, purpose, relation, collection, ...) plus typed edges carrying a relationSlug (subsumed_by, broader_than, equivalent_to, narrower_than, polar_opposite_of, ...). Encounters cite a vocab to ground their action and purpose strings. We've cloned a multi-relation purposes example for the tour. It'll be removed when you finish.",
      },
      {
        title: "World",
        body: "Closure semantics for subsumption. open (undeclared ids are incomparable), hierarchy-closed (only declared edges hold), or closed-with-default (a designated top node rolls up everything undeclared). Per-relation overrides live on each relation-kind node.",
        tool: "vocab",
        target: "[data-walk='vocab-world']",
      },
      {
        title: "Supersedes",
        body: "Optional at-uri pointing back at a prior vocabulary record. Forms a version chain so subscribers can walk the lineage. Autocomplete is scoped to dev.idiolect.vocab.",
        tool: "vocab",
        target: "[data-walk='vocab-supersedes']",
      },
      {
        title: "Nodes",
        body: "Each node is a concept, action, purpose, relation kind, or any custom kind. Per-node fields cover SKOS Core annotations (label, alternateLabels, hiddenLabels, scopeNote, example, historyNote, editorialNote, changeNote, notation), externalIds against systems like Wikidata or ROR, status, deprecatedBy, and Collection grouping via member_of.",
        tool: "vocab",
        target: "[data-walk='vocab-graph']",
      },
      {
        title: "Edges and OWL Lite",
        body: "Edges carry source, target, relationSlug, plus optional weight, confidence, temporal validity, and source attestation. Relation-kind nodes (kind=relation) carry OWL Lite property characteristics (symmetric, asymmetric, transitive, reflexive, irreflexive, functional, inverseFunctional, inverseOf) so reasoners can close the relation algebraically.",
        tool: "vocab",
        target: "[data-walk='vocab-graph']",
      },
      {
        title: "Templates",
        body: "The Templates list in the sidebar carries five examples. Single-relation subsumption, multi-relation (subsumed_by, broader_than, equivalent_to), OWL Lite (transitive, inverseOf), SKOS Core annotations, and the deliberation vote-stances vocab (symmetric polar_opposite_of). Clone any of them to see a fully-expressive vocab without writing JSON.",
        tool: "vocab",
        target: "[data-walk='sidebar']",
      },
      {
        title: "Publish + lifecycle",
        body: "When the vocab is ready, hit Export → Publish to push it to your PDS. Edit afterwards and the toolbar gains Revert (discard local edits) and Delete from PDS (drop the remote) so you can manage the published version inline.",
        tool: "vocab",
        target: "[data-walk='editor-toolbar']",
      },
    ],
  },
  {
    key: "community",
    headline: "Community Config",
    blurb: "Define the federated unit + its members + its conventions.",
    tool: "community",
    template: { kind: "community", name: "community/structured-conventions" },
    steps: [
      {
        title: "What you're building",
        body: "A dev.idiolect.community record. Members gate eligibility predicates. Conventions document the rules the community agrees to. We've cloned an example with structured conventions for the tour. It'll be removed when you finish.",
      },
      {
        title: "Members",
        body: "Add by handle or DID. Storage is canonical (DID). Cards always re-resolve to the human-readable handle and avatar.",
        tool: "community",
        target: "[data-walk='community-members']",
      },
      {
        title: "Membership roll",
        body: "For larger communities (above ~200 members), keep the roster as a separate atproto record and reference its at-uri here instead of inlining DIDs above.",
        tool: "community",
        target: "[data-walk='community-roll']",
      },
      {
        title: "Core schemas",
        body: "Pin the schemas the community treats as canonical for its purposes. Each row autocompletes any at-uri.",
        tool: "community",
        target: "[data-walk='community-core-schemas']",
      },
      {
        title: "Core lenses",
        body: "Pin the lenses the community treats as canonical. Autocomplete is scoped to your published lenses (dev.panproto.schema.lens).",
        tool: "community",
        target: "[data-walk='community-core-lenses']",
      },
      {
        title: "Endorsed communities",
        body: "Other communities this community recognises as legitimate interlocutors. Endorsement is not transitive. Autocomplete is scoped to dev.idiolect.community.",
        tool: "community",
        target: "[data-walk='community-endorsed']",
      },
      {
        title: "Role assignments (new in idiolect v0.7)",
        body: "Sparse [{did, role}] list. Only members whose role differs from the implicit default need an entry. Roles are open-enum slugs (member, moderator, delegate, author by default, or any community-extended slug). The slug resolves through the optional `memberRoleVocab` at-uri so different communities can pin different role taxonomies.",
        tool: "community",
        target: "[data-walk='community-role-assignments']",
      },
      {
        title: "Record hosting (new in idiolect v0.7)",
        body: "Documents where this community's records live. `member-hosted` is the ATProto default (records on individual member PDSes). `community-hosted` mirrors Acorn-style AppView communities where records live on a shared service. `hybrid` is both. Pair with the AppView endpoint URL when records are community-hosted so subscribers know where to fetch.",
        tool: "community",
        target: "[data-walk='community-record-hosting']",
      },
      {
        title: "Conventions (structured)",
        body: "The decidable subset: review cadence, verification requirements, deprecation policy. Each entry is a typed predicate the community has agreed to. Subscribers can check candidate lenses against these mechanically.",
        tool: "community",
        target: "[data-walk='community-conventions']",
      },
      {
        title: "Conventions text",
        body: "Free-prose conventions: style guides, tone, anything that doesn't reduce to a structured predicate. Lives alongside the structured list above.",
        tool: "community",
        target: "[data-walk='community-conventions-text']",
      },
      {
        title: "Publish + lifecycle",
        body: "Export → Publish pushes the community to your PDS. The sidebar's dot turns emerald. Edits flip it to amber and unlock Revert + Delete from PDS in the editor toolbar.",
        tool: "community",
        target: "[data-walk='editor-toolbar']",
      },
    ],
  },
  {
    key: "recommendation",
    headline: "Recommendation Builder",
    blurb: "Endorse a lens path with applicability conditions.",
    tool: "recommendation",
    template: { kind: "recommendation", name: "recommendation/source-and-target" },
    steps: [
      {
        title: "What you're building",
        body: "A dev.idiolect.recommendation record. An opinionated lens path, gated by structured conditions, optionally requiring specific verifications. We've cloned a source-and-target conditional example for the tour. It'll be removed when you finish.",
      },
      {
        title: "Issuing community",
        body: "The community whose stance this recommendation expresses. Autocomplete is scoped to dev.idiolect.community. Subscribers walk this back to the community's conventions to weight the recommendation.",
        tool: "recommendation",
        target: "[data-walk='recommendation-issuing']",
      },
      {
        title: "Lens path",
        body: "Order matters. Subscribers invoke lenses left-to-right. Each row autocompletes against your published lenses, and the … button reveals optional cid (content-address pin) and direction (unidirectional or bidirectional) fields. At least one lens is required (the lexicon enforces it on publish).",
        tool: "recommendation",
        target: "[data-walk='recommendation-lenspath']",
      },
      {
        title: "Conditions",
        body: "When this recommendation applies. Postfix combinator tree over typed atomic predicates (sourceIs, targetIs, actionSubsumedBy, ...). The tree editor builds them without typing JSON. Every at-uri input (schema refs in sourceIs and targetIs, action and purpose vocabularies) autocompletes against the right collection so handles work as shorthand. Subscribers evaluate this against their record before invoking the lens path.",
        tool: "recommendation",
        target: "[data-walk='recommendation-conditions']",
      },
      {
        title: "Preconditions",
        body: "Optional gates that must hold before conditions are even evaluated. Use these for invariants the community insists on (signature checks, data-quality gates) so the recommendation cleanly silos applicability from preflight.",
        tool: "recommendation",
        target: "[data-walk='recommendation-preconditions']",
      },
      {
        title: "Caveats",
        body: "Free-prose limitations the recommendation should carry alongside its structured conditions. Things you can't reduce to a predicate but want subscribers to read.",
        tool: "recommendation",
        target: "[data-walk='recommendation-caveats']",
      },
      {
        title: "Publish + lifecycle",
        body: "Export → Publish ships the recommendation to your PDS. After that, edit and the toolbar gains Revert + Delete from PDS so you can roll back to the PDS version or drop it entirely.",
        tool: "recommendation",
        target: "[data-walk='editor-toolbar']",
      },
    ],
  },
  {
    key: "deliberation",
    headline: "Deliberation Composer",
    blurb: "Author community-scoped questions, proposals, and observer-published outcomes (new in idiolect v0.7).",
    tool: "deliberation",
    steps: [
      {
        title: "What you're building",
        body: "A dev.idiolect.deliberation record (and optionally its statement and outcome siblings). Deliberations are first-class in idiolect v0.7. A community-scoped question or proposal under collective consideration. Statements attach to it via strong-ref. Votes attach to statements (real-time action, not authored here). An observer-published outcome record summarises the tally once it closes. Maps cleanly to Acorn-style assembly conversations on the bridge.",
      },
      {
        title: "Owning community",
        body: "Pin the community whose membership is deliberating. Resolves member permissions and dialect preferences for clients reading the deliberation. Autocomplete is scoped to dev.idiolect.community.",
        tool: "deliberation",
        target: "[data-walk='deliberation-owning-community']",
      },
      {
        title: "Topic + description",
        body: "The question or proposal under consideration. Topic is short (<=1000 graphemes) and mirrors the draft's user-visible label. Description carries long-form motivation, constraints, and prior history.",
        tool: "deliberation",
        target: "[data-walk='deliberation-topic']",
      },
      {
        title: "Classification + status (open enums)",
        body: "Classification names the deliberation's argumentative shape (question, proposal, grievance, retrospective by default, or any community-extended slug). Status is the lifecycle marker (open, closed, tabled, adopted, rejected). Both are open enums. Pick a canonical default from the dropdown or `custom slug…` to type a community-extended one. The vocabularies in the next step resolve unfamiliar slugs.",
        tool: "deliberation",
        target: "[data-walk='deliberation-classification-status']",
      },
      {
        title: "Vocabularies (open-enum extensions)",
        body: "Optional at-uris pointing at vocab records that constitute the open extension for classification and status. Subscribers resolve unfamiliar slugs against these. Defaults to the canonical idiolect-published vocabs when omitted.",
        tool: "deliberation",
        target: "[data-walk='deliberation-vocabs']",
      },
      {
        title: "Lifecycle (auth + closed-at)",
        body: "Auth-required toggles whether members must be authenticated to participate (default: true). Closed-at marks the cutoff after which votes and statements no longer count toward the tally. Observers fold votes into the outcome record once closed.",
        tool: "deliberation",
        target: "[data-walk='deliberation-lifecycle']",
      },
      {
        title: "Outcome link (set on close)",
        body: "Once the deliberation closes and an observer publishes the tally, set this to point at the published dev.idiolect.deliberationOutcome record. Lets clients fetch the resolution without re-folding every vote. Autocomplete is scoped to dev.idiolect.deliberationOutcome.",
        tool: "deliberation",
        target: "[data-walk='deliberation-outcome-link']",
      },
      {
        title: "Statements + outcomes",
        body: "Sibling tools live alongside this one for `dev.idiolect.deliberationStatement` (member-authored claim, proposal, dissent, or clarification, attaching by strong-ref) and `dev.idiolect.deliberationOutcome` (observer-published tally with per-stance counts and optional adopted-statements list). Vote records (`deliberationVote`) are reserved at the FULL OAuth scope tier. They're real-time action, not authored governance, so they don't have a fieldwork composer.",
        tool: "deliberation",
        target: "[data-walk='sidebar']",
      },
      {
        title: "Publish + lifecycle",
        body: "Export → Publish ships the deliberation to your PDS. Edits flip the sidebar dot to amber and unlock Revert + Delete from PDS in the editor toolbar.",
        tool: "deliberation",
        target: "[data-walk='editor-toolbar']",
      },
    ],
  },
  {
    key: "lexicon",
    headline: "Lexicon Browser",
    blurb: "Read-only inspector for every dev.idiolect.* lexicon (plus your imports).",
    tool: "lexicon",
    steps: [
      {
        title: "What this is",
        body: "A read-only browser over every bundled dev.idiolect.* and dev.panproto.* lexicon, plus anything you import. Each document gets validated through panproto on selection so you see immediately whether it parses as a panproto schema. The walkthrough opens dev.idiolect.recommendation as a demo: it exercises the broadest slice of lexicon features (a record main, a tagged union over eight object variants for the condition tree, refs, arrays of refs, knownValues open enums, datetime and at-uri formats, length-constrained strings, optional and required fields), so each tab tour below lands on real content.",
      },
      {
        title: "Lexicon list",
        body: "Filter the loaded set, paste an NSID into the lexicon.garden search to resolve a remote one, or drop a JSON file from your filesystem. The list is open on dev.idiolect.recommendation. Click any other entry to jump.",
        tool: "lexicon",
        target: "[data-walk='lexicon-list']",
      },
      {
        title: "Six tabs",
        body: "Each lexicon gets six views over the same document. The next steps walk through each one against the recommendation lexicon.",
        tool: "lexicon",
        target: "[data-walk='lexicon-tabs']",
      },
      {
        title: "JSON",
        body: "Syntax-highlighted source of the lexicon document. The tokeniser matches keys, type names, refs, and primitive values so the structure stays scannable.",
        tool: "lexicon",
        target: "[data-walk='lexicon-tab-json']",
      },
      {
        title: "Definitions",
        body: "Table of every `defs` entry with its type and description. Quick orientation for how big the lexicon is and what shapes it exposes.",
        tool: "lexicon",
        target: "[data-walk='lexicon-tab-defs']",
      },
      {
        title: "Fields",
        body: "Per-def field tables with refs, array<ref>, and unions recursively expanded as indented child rows. Cycle-safe. Click any #defName to jump within the doc, or an external NSID to switch lexicons.",
        tool: "lexicon",
        target: "[data-walk='lexicon-tab-fields']",
      },
      {
        title: "Refs",
        body: "Per-def 'uses' / 'used by' table. Useful for tracing what a change to a shared def will ripple into.",
        tool: "lexicon",
        target: "[data-walk='lexicon-tab-refs']",
      },
      {
        title: "Diff",
        body: "Pin a baseline version of the document and surface added, removed, and changed fields against it. Comes in handy when reviewing a lexicon revision before publishing.",
        tool: "lexicon",
        target: "[data-walk='lexicon-tab-diff']",
      },
      {
        title: "Try",
        body: "A copy-pasteable record body or curl-able request stub for the lexicon's `main` def, with placeholder values that auto-fill the active session's DID and PDS when you're signed in.",
        tool: "lexicon",
        target: "[data-walk='lexicon-tab-try']",
      },
    ],
  },
  {
    key: "lens",
    headline: "Lenses",
    blurb: "Browse panproto lenses so drafts can reference them by at-uri.",
    tool: "lens",
    steps: [
      {
        title: "What this is for",
        body: "Lenses are authored and published in protolab, which writes them straight to your PDS. This page is the read side: it lists what a repo has published so you can reference a lens from a dialect or recommendation.",
      },
      {
        title: "Author a lens",
        body: "protolab draws lens migrations as patch circuits and publishes each one as a dev.panproto.schema.lens record, alongside a dev.panproto.schema.schema record for each endpoint. Nothing needs to come back here afterwards — the lens appears in the list below.",
        tool: "lens",
        target: "[data-walk='lens-author']",
      },
      {
        title: "The library",
        body: "Lists a repo's lens records, newest first, labelled by the protocols at each end (atproto → openapi) and by round-trip class. Copy an at-uri to paste into a dialect's preferred lenses or a recommendation's lens path — the same at-uris those editors autocomplete against.",
        tool: "lens",
        target: "[data-walk='lens-library']",
      },
      {
        title: "No sign-in required",
        body: "Listing records is a public, unauthenticated read, so the library works signed out and for any DID — paste someone else's to see what they publish. fieldwork no longer requests a lens write scope at all, because it no longer writes lenses.",
        tool: "lens",
        target: "[data-walk='lens-library']",
      },
    ],
  },
];

const WELCOME_KEY = "fieldwork:welcome-dismissed";
const FLOW_DISMISSED_KEY = (flow: string) => `fieldwork:flow-dismissed:${flow}`;

function isWelcomeDismissed(): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

function setWelcomeDismissed(dismissed: boolean): void {
  try {
    if (dismissed) localStorage.setItem(WELCOME_KEY, "1");
    else localStorage.removeItem(WELCOME_KEY);
  } catch {
    /* quota / privacy mode */
  }
}

function isFlowDismissed(flow: string): boolean {
  try {
    return localStorage.getItem(FLOW_DISMISSED_KEY(flow)) === "1";
  } catch {
    return false;
  }
}

function setFlowDismissed(flow: string, dismissed: boolean): void {
  try {
    if (dismissed) localStorage.setItem(FLOW_DISMISSED_KEY(flow), "1");
    else localStorage.removeItem(FLOW_DISMISSED_KEY(flow));
  } catch {
    /* quota / privacy mode */
  }
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function AppWalkthrough() {
  const phase = useWalkthroughStore((s) => s.phase);
  const activeFlow = useWalkthroughStore((s) => s.activeFlow);
  const stepIdx = useWalkthroughStore((s) => s.stepIdx);
  const open = useWalkthroughStore((s) => s.open);
  const close = useWalkthroughStore((s) => s.close);
  const next = useWalkthroughStore((s) => s.next);
  const prev = useWalkthroughStore((s) => s.prev);
  const startFlow = useWalkthroughStore((s) => s.startFlow);
  const toHub = useWalkthroughStore((s) => s.toHub);

  const setTool = useWorkspaceStore((s) => s.setTool);
  const upsertDraft = useWorkspaceStore((s) => s.upsertDraft);
  const removeDraft = useWorkspaceStore((s) => s.removeDraft);
  const setActive = useWorkspaceStore((s) => s.setActive);
  const [dontShow, setDontShow] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  // The id of the draft we cloned for this flow, if any. Tracked so
  // we can remove it when the flow ends or the user bails.
  const [seededId, setSeededId] = useState<string | null>(null);

  const flow = activeFlow ? FLOWS.find((f) => f.key === activeFlow) : null;
  const step = flow ? flow.steps[stepIdx] : null;
  const isLastStep = flow ? stepIdx >= flow.steps.length - 1 : false;

  // Auto-open the hub on first ever visit.
  useEffect(() => {
    if (!isWelcomeDismissed()) open();
  }, [open]);

  // Switch tool when entering a step that targets a specific one.
  useEffect(() => {
    if (phase !== "running" || !step) return;
    const targetTool = step.tool ?? flow?.tool;
    if (targetTool) setTool(targetTool);
  }, [phase, step, flow, setTool]);

  // Seed an example draft when entering a flow that declares a
  // template, and remove it when leaving running mode (Done, Hub,
  // Close, Esc, click-outside; everything routes through phase
  // transitions). The draft is a normal workspace clone — same as
  // the user clicking the Templates row themselves — so during the
  // tour every step has a real, populated form to highlight.
  useEffect(() => {
    if (phase !== "running" || !flow) {
      // Leaving running: discard the seed if any.
      if (seededId) {
        removeDraft(seededId);
        setSeededId(null);
      }
      return;
    }
    // Entering running: only seed once per flow entry.
    if (seededId) return;
    if (!flow.template) return;
    const fixture = findFixture(flow.template.kind, flow.template.name);
    if (!fixture) return;
    const id = mintDraftId(flow.template.kind);
    const body = JSON.parse(JSON.stringify(fixture.body)) as Record<
      string,
      unknown
    >;
    const draft = {
      kind: flow.template.kind,
      body: {
        id,
        label: `${fixture.label} (walkthrough)`,
        body,
      },
    } as Draft;
    upsertDraft(draft);
    setActive(flow.template.kind, id);
    setSeededId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, flow]);

  // Measure the target element so the spotlight can highlight it;
  // re-measure on resize/scroll so the highlight tracks the layout.
  useLayoutEffect(() => {
    if (phase !== "running" || !step?.target) {
      setRect(null);
      return;
    }
    let raf = 0;
    function measure() {
      if (!step?.target) return;
      const el = document.querySelector(step.target);
      if (!el) {
        setRect(null);
        return;
      }
      // Scroll the element into view so the spotlight has somewhere
      // to land if it's currently below the fold.
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    }
    // The tool may have just changed; wait two frames so the new
    // editor's DOM is mounted before measuring.
    raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => measure()),
    );
    function onScroll() {
      measure();
    }
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [phase, step]);

  // ESC closes.
  useEffect(() => {
    if (phase === "closed") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") doClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, dontShow]);

  function doClose() {
    if (dontShow) {
      setWelcomeDismissed(true);
      if (flow) setFlowDismissed(flow.key, true);
    }
    setDontShow(false);
    close();
  }

  function handleNext() {
    if (!flow) return;
    if (isLastStep) {
      // Final step closes the walkthrough entirely (back to using
      // the app). Mark this flow as seen so it doesn't pop up
      // unsolicited from any "first time" hook in the future.
      setFlowDismissed(flow.key, true);
      doClose();
    } else {
      next();
    }
  }

  if (phase === "closed") return null;

  // Hub view.
  if (phase === "hub") {
    return (
      <Backdrop onClick={doClose}>
        <Card>
          <Header
            title="fieldwork walkthroughs"
            onClose={doClose}
            counter={null}
          />
          <div className="px-5 pb-3">
            <p className="text-sm text-stone-700 mb-3">
              Pick a workshop to tour. Each tour highlights the
              relevant pieces of the interface as it goes.
            </p>
            <ul className="flex flex-col gap-2">
              {FLOWS.map((f) => {
                const seen = isFlowDismissed(f.key);
                return (
                  <li key={f.key}>
                    <button
                      type="button"
                      onClick={() => startFlow(f.key)}
                      className="w-full text-left rounded border border-stone-200 px-3 py-2 hover:border-stone-400 hover:bg-stone-50 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-stone-900">
                          {f.headline}
                        </div>
                        <div className="text-xs text-stone-600">
                          {f.blurb}
                        </div>
                      </div>
                      <span className="text-[10px] text-stone-400 shrink-0">
                        {seen ? "seen" : "new"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <Footer
            onClose={doClose}
            dontShow={dontShow}
            setDontShow={setDontShow}
            primary={null}
            secondary={null}
          />
        </Card>
      </Backdrop>
    );
  }

  // Running view: spotlight overlay + tooltip card pinned to target.
  if (phase === "running" && flow && step) {
    return (
      <SpotlightOverlay rect={rect} onClick={doClose}>
        <SpotlightCard
          title={step.title}
          body={step.body}
          counter={`${stepIdx + 1} / ${flow.steps.length}`}
          headline={flow.headline}
          rect={rect}
          dontShow={dontShow}
          setDontShow={setDontShow}
          onPrev={stepIdx > 0 ? prev : null}
          onNext={handleNext}
          onClose={doClose}
          onBackToHub={toHub}
          isLastStep={isLastStep}
        />
      </SpotlightOverlay>
    );
  }

  return null;
}

// -----------------------------------------------------------------
// Pieces
// -----------------------------------------------------------------

function Backdrop({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClick}
      role="presentation"
    >
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-white border border-stone-200 rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-md flex flex-col"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}

function Header({
  title,
  counter,
  onClose,
}: {
  title: string;
  counter: string | null;
  onClose: () => void;
}) {
  return (
    <header className="flex items-baseline justify-between px-5 pt-5 pb-2 gap-3">
      <h3 className="font-semibold text-stone-900">{title}</h3>
      <div className="flex items-center gap-3">
        {counter && (
          <span className="text-xs text-stone-500">{counter}</span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-stone-500 hover:text-stone-900 text-lg leading-none px-1"
          aria-label="Close walkthrough"
          title="Close"
        >
          ×
        </button>
      </div>
    </header>
  );
}

function Footer({
  onClose,
  dontShow,
  setDontShow,
  primary,
  secondary,
}: {
  onClose: () => void;
  dontShow: boolean;
  setDontShow: (v: boolean) => void;
  primary: React.ReactNode;
  secondary: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between px-5 pb-5 pt-2 gap-x-3 gap-y-2 border-t border-stone-100">
      <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
        <input
          type="checkbox"
          checked={dontShow}
          onChange={(e) => setDontShow(e.target.checked)}
        />
        Don't show again
      </label>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {secondary}
        {primary ?? (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-sm rounded bg-stone-900 text-white"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Spotlight: dim everything except the target rect, render a
// floating card next to it.
// -----------------------------------------------------------------

function SpotlightOverlay({
  rect,
  onClick,
  children,
}: {
  rect: Rect | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // No target: render as a centered modal (intro / outro steps).
  if (!rect) {
    return <Backdrop onClick={onClick}>{children}</Backdrop>;
  }
  // Pad the cutout slightly so the highlight doesn't touch the
  // target's border.
  const pad = 8;
  const r = {
    top: rect.top - pad,
    left: rect.left - pad,
    right: rect.left + rect.width + pad,
    bottom: rect.top + rect.height + pad,
  };
  const dim = "bg-stone-900/55";
  return (
    <div
      className="fixed inset-0 z-40"
      onClick={onClick}
      role="presentation"
    >
      {/* four backdrop quadrants around the target */}
      <div
        className={`absolute left-0 right-0 top-0 ${dim}`}
        style={{ height: Math.max(0, r.top) }}
      />
      <div
        className={`absolute left-0 ${dim}`}
        style={{
          top: r.top,
          width: Math.max(0, r.left),
          height: Math.max(0, r.bottom - r.top),
        }}
      />
      <div
        className={`absolute right-0 ${dim}`}
        style={{
          top: r.top,
          left: r.right,
          height: Math.max(0, r.bottom - r.top),
        }}
      />
      <div
        className={`absolute left-0 right-0 bottom-0 ${dim}`}
        style={{
          top: r.bottom,
        }}
      />
      {/* highlight ring */}
      <div
        className="absolute pointer-events-none ring-2 ring-amber-300 rounded-md transition-all"
        style={{
          top: r.top,
          left: r.left,
          width: Math.max(0, r.right - r.left),
          height: Math.max(0, r.bottom - r.top),
          boxShadow: "0 0 0 9999px transparent",
        }}
      />
      {children}
    </div>
  );
}

function SpotlightCard({
  title,
  body,
  counter,
  headline,
  rect,
  dontShow,
  setDontShow,
  onPrev,
  onNext,
  onClose,
  onBackToHub,
  isLastStep,
}: {
  title: string;
  body: string;
  counter: string;
  headline: string;
  rect: Rect | null;
  dontShow: boolean;
  setDontShow: (v: boolean) => void;
  onPrev: (() => void) | null;
  onNext: () => void;
  onClose: () => void;
  onBackToHub: () => void;
  isLastStep: boolean;
}) {
  // Center the card when there's no target rect.
  if (!rect) {
    return (
      <div className="absolute inset-0 flex items-end sm:items-center justify-center p-4">
        <div
          className="relative bg-white border border-stone-200 rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-md flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <Header title={headline} counter={counter} onClose={onClose} />
          <div className="px-5 pb-3 min-h-[110px]">
            <h4 className="font-medium text-stone-800 mb-1">{title}</h4>
            <p className="text-sm text-stone-700 leading-relaxed">
              {body}
            </p>
          </div>
          <Footer
            onClose={onClose}
            dontShow={dontShow}
            setDontShow={setDontShow}
            primary={
              <button
                type="button"
                onClick={onNext}
                className="px-3 py-1 text-sm rounded bg-stone-900 text-white"
              >
                {isLastStep ? "Done" : "Next"}
              </button>
            }
            secondary={
              <>
                <button
                  type="button"
                  onClick={onBackToHub}
                  className="px-3 py-1 text-sm rounded text-stone-600"
                >
                  Hub
                </button>
                {onPrev && (
                  <button
                    type="button"
                    onClick={onPrev}
                    className="px-3 py-1 text-sm rounded border border-stone-300"
                  >
                    Back
                  </button>
                )}
              </>
            }
          />
        </div>
      </div>
    );
  }

  // On phone-class viewports the spotlight card can't reasonably
  // float next to the target — there isn't enough horizontal room
  // and a fixed `top` would frequently land under the on-screen
  // keyboard. Pin to the bottom of the viewport as a sheet, full
  // width minus a small margin, regardless of where the target is.
  // The spotlight ring still tracks the target above.
  const margin = 16;
  const viewportH =
    typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW =
    typeof window !== "undefined" ? window.innerWidth : 1200;
  const isPhone = viewportW < 640;

  if (isPhone) {
    return (
      <div
        className="absolute left-0 right-0 bottom-0 p-3 pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white border border-stone-200 rounded-xl shadow-2xl flex flex-col">
          <Header title={headline} counter={counter} onClose={onClose} />
          <div className="px-5 pb-3">
            <h4 className="font-medium text-stone-800 mb-1">{title}</h4>
            <p className="text-sm text-stone-700 leading-relaxed">{body}</p>
          </div>
          <Footer
            onClose={onClose}
            dontShow={dontShow}
            setDontShow={setDontShow}
            primary={
              <button
                type="button"
                onClick={onNext}
                className="px-3 py-1 text-sm rounded bg-stone-900 text-white whitespace-nowrap"
              >
                {isLastStep ? "Done" : "Next"}
              </button>
            }
            secondary={
              <>
                <button
                  type="button"
                  onClick={onBackToHub}
                  className="px-3 py-1 text-sm rounded text-stone-600 whitespace-nowrap"
                  title="Back to walkthrough hub"
                >
                  Hub
                </button>
                {onPrev && (
                  <button
                    type="button"
                    onClick={onPrev}
                    className="px-3 py-1 text-sm rounded border border-stone-300 whitespace-nowrap"
                  >
                    Back
                  </button>
                )}
              </>
            }
          />
        </div>
      </div>
    );
  }

  // Desktop: position the card next to the target, clamped to the
  // viewport.
  const cardWidth = 380;
  const cardEstHeight = 220;

  const below = rect.top + rect.height + margin;
  const fitsBelow = below + cardEstHeight < viewportH;
  const top = fitsBelow
    ? below
    : Math.max(margin, rect.top - cardEstHeight - margin);

  // Try to align horizontally with the target, but clamp to viewport.
  let left = rect.left;
  if (left + cardWidth > viewportW - margin)
    left = viewportW - cardWidth - margin;
  if (left < margin) left = margin;

  return (
    <div
      className="absolute bg-white border border-stone-200 rounded-xl shadow-2xl flex flex-col pointer-events-auto"
      style={{ top, left, width: cardWidth }}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <Header title={headline} counter={counter} onClose={onClose} />
      <div className="px-5 pb-3 min-h-[100px]">
        <h4 className="font-medium text-stone-800 mb-1">{title}</h4>
        <p className="text-sm text-stone-700 leading-relaxed">{body}</p>
      </div>
      <Footer
        onClose={onClose}
        dontShow={dontShow}
        setDontShow={setDontShow}
        primary={
          <button
            type="button"
            onClick={onNext}
            className="px-3 py-1 text-sm rounded bg-stone-900 text-white whitespace-nowrap"
          >
            {isLastStep ? "Done" : "Next"}
          </button>
        }
        secondary={
          <>
            <button
              type="button"
              onClick={onBackToHub}
              className="px-3 py-1 text-sm rounded text-stone-600 whitespace-nowrap"
              title="Back to walkthrough hub"
            >
              Hub
            </button>
            {onPrev && (
              <button
                type="button"
                onClick={onPrev}
                className="px-3 py-1 text-sm rounded border border-stone-300 whitespace-nowrap"
              >
                Back
              </button>
            )}
          </>
        }
      />
    </div>
  );
}
