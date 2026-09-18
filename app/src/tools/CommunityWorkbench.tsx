import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { analyzeProposal, proposalReadiness } from "../infrastructure/analysis";
import { buildPortableBundle, downloadJson, proposalRecord } from "../infrastructure/export";
import { useInfrastructureStore } from "../infrastructure/store";
import type {
  ChangeProposal,
  CommunityRelease,
  FederationLink,
  InfrastructureSection,
  MigrationRun,
  ReleaseSignature,
  Review,
} from "../infrastructure/types";

const SECTIONS: Array<{
  key: InfrastructureSection;
  label: string;
  short: string;
}> = [
  { key: "overview", label: "Start here", short: "01" },
  { key: "workspace", label: "Community rules", short: "02" },
  { key: "changes", label: "Change packets", short: "03" },
  { key: "decisions", label: "Review & decide", short: "04" },
  { key: "releases", label: "Signed releases", short: "05" },
  { key: "operations", label: "Migration runs", short: "06" },
  { key: "federation", label: "Federation", short: "07" },
  { key: "exit", label: "Exit & export", short: "08" },
];

const SOURCE_EXAMPLE = JSON.stringify(
  {
    lexicon: 1,
    id: "org.example.communityProfile",
    defs: {
      main: {
        type: "record",
        key: "tid",
        record: {
          type: "object",
          required: ["displayName"],
          properties: { displayName: { type: "string", maxLength: 120 } },
        },
      },
    },
  },
  null,
  2,
);

const TARGET_EXAMPLE = JSON.stringify(
  {
    lexicon: 1,
    id: "org.example.communityProfile",
    defs: {
      main: {
        type: "record",
        key: "tid",
        record: {
          type: "object",
          required: ["displayName"],
          properties: {
            displayName: { type: "string", maxLength: 120 },
            pronouns: { type: "string", maxLength: 80 },
          },
        },
      },
    },
  },
  null,
  2,
);

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function CommunityWorkbench() {
  const { section, workspace, selectedProposalId } = useInfrastructureStore(
    useShallow((state) => ({
      section: state.section,
      workspace: state.workspace,
      selectedProposalId: state.selectedProposalId,
    })),
  );
  const setSection = useInfrastructureStore((state) => state.setSection);
  const selected =
    workspace.proposals.find((proposal) => proposal.id === selectedProposalId) ??
    workspace.proposals.at(-1) ??
    null;

  return (
    <div className="cw-shell">
      <aside className="cw-thread" aria-label="Community release lifecycle">
        <div className="cw-thread-title">
          <span className="cw-mark" aria-hidden="true">i</span>
          <div>
            <strong>{workspace.identity.name || "Your community"}</strong>
            <span>release thread</span>
          </div>
        </div>
        <nav>
          {SECTIONS.map((item) => (
            <button
              type="button"
              key={item.key}
              aria-current={section === item.key ? "step" : undefined}
              className={section === item.key ? "is-current" : ""}
              onClick={() => setSection(item.key)}
            >
              <span>{item.short}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="cw-thread-foot">
          <span>{workspace.proposals.length} changes</span>
          <span>{workspace.releases.length} releases</span>
          <span>{workspace.migrations.filter((run) => run.status === "running").length} running</span>
        </div>
      </aside>

      <main className="cw-document">
        {section === "overview" && <Overview />}
        {section === "workspace" && <WorkspaceRules />}
        {section === "changes" && <Changes selected={selected} />}
        {section === "decisions" && <Decisions selected={selected} />}
        {section === "releases" && <Releases />}
        {section === "operations" && <Operations />}
        {section === "federation" && <Federation />}
        {section === "exit" && <ExitAndExport />}
      </main>

      <EvidenceLedger selected={selected} />
    </div>
  );
}

function Overview() {
  const workspace = useInfrastructureStore((state) => state.workspace);
  const setSection = useInfrastructureStore((state) => state.setSection);
  const checks = [
    { done: Boolean(workspace.identity.name && workspace.identity.did), label: "Name the community and its accountable DID" },
    { done: workspace.proposals.length > 0, label: "Describe and analyze the first change" },
    { done: workspace.proposals.some((proposal) => proposal.reviews.length > 0), label: "Record a review under the shared rules" },
    { done: workspace.releases.length > 0, label: "Prepare a release that others can verify" },
  ];
  return (
    <Document title="A shared worktable for changing community definitions" eyebrow="Community infrastructure">
      <p className="cw-lede">
        Idiolect lets a community define how its records mean things, change those definitions in public, and leave with a complete copy. Fieldwork turns that process into one thread you can inspect from proposal to migration.
      </p>
      <div className="cw-newcomer">
        <div>
          <span className="cw-kicker">New here?</span>
          <h3>Four ideas are enough to begin</h3>
        </div>
        <dl>
          <div><dt>Community</dt><dd>The people and rules responsible for a set of shared definitions.</dd></div>
          <div><dt>Change packet</dt><dd>A proposal plus its compatibility effects, reviews, verification, and rollback plan.</dd></div>
          <div><dt>Lens</dt><dd>A checked translation between old and new shapes of the same community data.</dd></div>
          <div><dt>Release</dt><dd>An immutable index of approved changes and artifacts, signed by accountable people.</dd></div>
        </dl>
        <p className="cw-depth-note">
          Fieldwork starts with the decision you are making. Rows marked <strong>Inspect</strong> reveal evidence and operational detail; rows marked <strong>Interoperate</strong> reveal protocol JSON, digests, and signatures.
        </p>
      </div>
      <section className="cw-checklist" aria-labelledby="first-release-heading">
        <div className="cw-section-heading">
          <div><span className="cw-kicker">Your first release</span><h3 id="first-release-heading">Follow the thread</h3></div>
          <span>{checks.filter((item) => item.done).length} / {checks.length} complete</span>
        </div>
        <ol>
          {checks.map((item, index) => (
            <li key={item.label} className={item.done ? "is-done" : ""}>
              <span>{item.done ? "✓" : index + 1}</span>{item.label}
            </li>
          ))}
        </ol>
        <button type="button" className="cw-primary" onClick={() => setSection("workspace")}>
          Set up the shared rules →
        </button>
      </section>
      <section className="cw-principles">
        <h3>What the workbench promises</h3>
        <p><strong>Consequences before consent.</strong> A proposal translates Panproto’s structural diff into participant-facing effects.</p>
        <p><strong>Incomplete stays incomplete.</strong> Missing verification is visible and cannot silently become approval.</p>
        <p><strong>Plural rules, portable records.</strong> Communities can govern differently while publishing interoperable evidence.</p>
        <p><strong>Exit is ordinary.</strong> Export is part of the lifecycle, not an emergency feature.</p>
      </section>
    </Document>
  );
}

function WorkspaceRules() {
  const workspace = useInfrastructureStore((state) => state.workspace);
  const patchIdentity = useInfrastructureStore((state) => state.patchIdentity);
  const patchGovernance = useInfrastructureStore((state) => state.patchGovernance);
  const patchResources = useInfrastructureStore((state) => state.patchResources);
  return (
    <Document title="Write down who decides, before a decision is urgent" eyebrow="Community rules">
      <p className="cw-lede">These settings travel with the workspace. They make authority, thresholds, and safety limits inspectable instead of burying them in application code.</p>
      <FormSection title="Identity" note="The DID identifies the person or service accountable for publishing community records.">
        <Field label="Community name"><input value={workspace.identity.name} onChange={(event) => patchIdentity({ name: event.target.value })} placeholder="Neighborhood archive" /></Field>
        <Field label="Accountable DID"><input value={workspace.identity.did} onChange={(event) => patchIdentity({ did: event.target.value })} placeholder="did:plc:…" className="cw-mono" /></Field>
        <Field label="Published community at-uri"><input value={workspace.identity.communityUri} onChange={(event) => patchIdentity({ communityUri: event.target.value })} placeholder="at://did:plc:…/dev.idiolect.community/…" className="cw-mono" /></Field>
        <Field label="Shared purpose"><textarea rows={3} value={workspace.identity.purpose} onChange={(event) => patchIdentity({ purpose: event.target.value })} placeholder="What does this community maintain together?" /></Field>
      </FormSection>
      <FormSection title="Decision policy" note="Idiolect records the rule; it does not impose one universal model.">
        <Field label="Governance model"><select value={workspace.governance.model} onChange={(event) => patchGovernance({ model: event.target.value as typeof workspace.governance.model })}><option value="consent">Consent</option><option value="vote">Vote</option><option value="maintainer">Maintainer</option><option value="steward">Steward</option><option value="hybrid">Hybrid</option></select></Field>
        <Field label="Non-abstaining reviews required"><input type="number" min={1} value={workspace.governance.quorum} onChange={(event) => patchGovernance({ quorum: Number(event.target.value) })} /></Field>
        <Field label="Approval threshold"><input type="number" min={0.5} max={1} step={0.01} value={workspace.governance.approvalThreshold} onChange={(event) => patchGovernance({ approvalThreshold: Number(event.target.value) })} /><small>0.67 means 67% of non-abstaining reviews.</small></Field>
        <Field label="Release signatures required"><input type="number" min={1} value={workspace.governance.minSignatures} onChange={(event) => patchGovernance({ minSignatures: Number(event.target.value) })} /></Field>
        <Field label="Review period (days)"><input type="number" min={0} value={workspace.governance.reviewPeriodDays} onChange={(event) => patchGovernance({ reviewPeriodDays: Number(event.target.value) })} /></Field>
      </FormSection>
      <Disclosure level="Inspect" summary="Safety limits" hint="Bound inputs and retained failure detail">
        <FormSection title="Resource boundaries" note="Bounded inputs keep public and federated tooling predictable under hostile or accidental load.">
          <Field label="Maximum schema bytes"><input type="number" min={1024} value={workspace.resources.maxSchemaBytes} onChange={(event) => patchResources({ maxSchemaBytes: Number(event.target.value) })} /></Field>
          <Field label="Maximum consequence items"><input type="number" min={1} value={workspace.resources.maxConsequences} onChange={(event) => patchResources({ maxConsequences: Number(event.target.value) })} /></Field>
          <Field label="Failure samples retained"><input type="number" min={1} value={workspace.resources.maxFailureSamples} onChange={(event) => patchResources({ maxFailureSamples: Number(event.target.value) })} /></Field>
        </FormSection>
      </Disclosure>
    </Document>
  );
}

function Changes({ selected }: { selected: ChangeProposal | null }) {
  const workspace = useInfrastructureStore((state) => state.workspace);
  const upsert = useInfrastructureStore((state) => state.upsertProposal);
  const select = useInfrastructureStore((state) => state.selectProposal);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  function createProposal() {
    const now = new Date().toISOString();
    const proposal: ChangeProposal = {
      id: id("change"), title: "Add a short title", summary: "Explain what should change and why it helps participants.", author: workspace.identity.did,
      protocol: "atproto", sourceLocation: "lexicons/community-profile-v1.json", targetLocation: "lexicons/community-profile-v2.json",
      sourceSchema: SOURCE_EXAMPLE, targetSchema: TARGET_EXAMPLE, sourceDigest: "pending", targetDigest: "pending", compatibility: "not-analyzed",
      consequences: [], affected: [], rollback: "Publish the prior definition as a new release and stop the migration run.", status: "draft", verificationStatus: "not-run", reviews: [], createdAt: now, updatedAt: now,
    };
    upsert(proposal);
  }

  async function analyze() {
    if (!selected) return;
    setAnalyzing(true); setAnalysisError(null);
    try {
      const result = analyzeProposal(selected, workspace.resources);
      const [sourceDigest, targetDigest] = await Promise.all([sha256(selected.sourceSchema), sha256(selected.targetSchema)]);
      upsert({ ...selected, ...result, sourceDigest, targetDigest, status: "review", verificationStatus: "incomplete", updatedAt: new Date().toISOString() });
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : String(error));
    } finally { setAnalyzing(false); }
  }

  return (
    <Document title="Package intent, effects, and evidence together" eyebrow="Change packets" actions={<button type="button" className="cw-primary" onClick={createProposal}>New change</button>}>
      <div className="cw-selector" aria-label="Change packets">
        {workspace.proposals.length === 0 ? <p>No changes yet. Start with the sample definition and replace it with yours.</p> : workspace.proposals.map((proposal) => <button type="button" key={proposal.id} className={selected?.id === proposal.id ? "is-current" : ""} onClick={() => select(proposal.id)}><strong>{proposal.title}</strong><span>{proposal.status} · {proposal.compatibility}</span></button>)}
      </div>
      {selected ? (
        <>
          <FormSection title="Plain-language proposal" note="A participant should understand this section without knowing Panproto or ATProto.">
            <Field label="Title"><input value={selected.title} onChange={(event) => upsert({ ...selected, title: event.target.value, updatedAt: new Date().toISOString() })} /></Field>
            <Field label="What changes, and why?"><textarea rows={5} value={selected.summary} onChange={(event) => upsert({ ...selected, summary: event.target.value, updatedAt: new Date().toISOString() })} /></Field>
            <Field label="Proposer DID"><input className="cw-mono" value={selected.author} onChange={(event) => upsert({ ...selected, author: event.target.value, updatedAt: new Date().toISOString() })} /></Field>
            <Field label="Who or what is affected?"><input value={selected.affected.join(", ")} onChange={(event) => upsert({ ...selected, affected: event.target.value.split(",").map((value) => value.trim()).filter(Boolean), updatedAt: new Date().toISOString() })} placeholder="mobile app, archive team, profile collection" /></Field>
            <Field label="Rollback plan"><textarea rows={3} value={selected.rollback} onChange={(event) => upsert({ ...selected, rollback: event.target.value, updatedAt: new Date().toISOString() })} /></Field>
          </FormSection>
          <FormSection title="Definitions to compare" note="Panproto parses both documents under the selected protocol, classifies compatibility, and attempts to derive a migration optic.">
            <Field label="Current definition location"><input className="cw-mono" value={selected.sourceLocation} onChange={(event) => upsert({ ...selected, sourceLocation: event.target.value, updatedAt: new Date().toISOString() })} /></Field>
            <Field label="Proposed definition location"><input className="cw-mono" value={selected.targetLocation} onChange={(event) => upsert({ ...selected, targetLocation: event.target.value, updatedAt: new Date().toISOString() })} /></Field>
            <Disclosure level="Interoperate" summary="Edit the schema documents" hint="Protocol selection and raw JSON">
              <Field label="Protocol"><input value={selected.protocol} onChange={(event) => upsert({ ...selected, protocol: event.target.value, updatedAt: new Date().toISOString() })} /></Field>
              <div className="cw-schema-pair"><Field label="Current JSON"><textarea className="cw-code" rows={18} value={selected.sourceSchema} onChange={(event) => upsert({ ...selected, sourceSchema: event.target.value, compatibility: "not-analyzed", consequences: [], updatedAt: new Date().toISOString() })} /></Field><Field label="Proposed JSON"><textarea className="cw-code" rows={18} value={selected.targetSchema} onChange={(event) => upsert({ ...selected, targetSchema: event.target.value, compatibility: "not-analyzed", consequences: [], updatedAt: new Date().toISOString() })} /></Field></div>
            </Disclosure>
            <button type="button" className="cw-primary" onClick={() => void analyze()} disabled={analyzing}>{analyzing ? "Analyzing…" : "Analyze consequences"}</button>
            {analysisError && <p className="cw-error" role="alert">{analysisError}</p>}
          </FormSection>
          <ConsequenceList proposal={selected} />
        </>
      ) : <Empty title="No change selected" body="Create a change packet to compare definitions and explain their effects." />}
    </Document>
  );
}

function ConsequenceList({ proposal }: { proposal: ChangeProposal }) {
  if (proposal.compatibility === "not-analyzed") return null;
  return <section className="cw-consequences"><div className="cw-section-heading"><div><span className="cw-kicker">Panproto report</span><h3>{proposal.compatibility}</h3></div>{proposal.opticKind && <span>migration optic: {proposal.opticKind}</span>}</div><div>{proposal.consequences.map((item) => <article key={item.code} data-severity={item.severity}><span>{item.severity}</span><h4>{item.headline}</h4><p>{item.detail}</p></article>)}</div><Disclosure level="Interoperate" summary="Technical fingerprints" hint="Content digests for exact source and target bytes"><p className="cw-mono">source {proposal.sourceDigest}</p><p className="cw-mono">target {proposal.targetDigest}</p></Disclosure></section>;
}

function Decisions({ selected }: { selected: ChangeProposal | null }) {
  const workspace = useInfrastructureStore((state) => state.workspace);
  const addReview = useInfrastructureStore((state) => state.addReview);
  const upsert = useInfrastructureStore((state) => state.upsertProposal);
  const [reviewer, setReviewer] = useState(workspace.identity.did);
  const [role, setRole] = useState("member");
  const [stance, setStance] = useState<Review["stance"]>("approve");
  const [comment, setComment] = useState("");
  if (!selected) return <Document title="Turn review into attributable evidence" eyebrow="Review & decide"><Empty title="No change to review" body="Create a change packet first, then return here." /></Document>;
  const proposal = selected;
  const readiness = proposalReadiness(proposal, workspace);
  function submit() {
    addReview(proposal.id, { id: id("review"), reviewer, role, stance, comment, reviewedAt: new Date().toISOString() });
    setComment("");
  }
  return <Document title="Turn review into attributable evidence" eyebrow="Review & decide">
    <div className="cw-decision-head"><div><span>Reviewing</span><h3>{selected.title}</h3></div><label>Verification status<select value={selected.verificationStatus} onChange={(event) => upsert({ ...selected, verificationStatus: event.target.value as ChangeProposal["verificationStatus"], updatedAt: new Date().toISOString() })}><option value="not-run">Not run</option><option value="incomplete">Incomplete</option><option value="verified">Verified</option><option value="refuted">Refuted</option></select></label></div>
    <FormSection title="Record a review" note="Reviews stay attributable. Abstentions count as participation but not toward the decision denominator.">
      <Field label="Reviewer DID"><input className="cw-mono" value={reviewer} onChange={(event) => setReviewer(event.target.value)} /></Field>
      <Field label="Community role"><input value={role} onChange={(event) => setRole(event.target.value)} /></Field>
      <Field label="Stance"><select value={stance} onChange={(event) => setStance(event.target.value as Review["stance"])}><option value="approve">Approve</option><option value="reject">Reject</option><option value="abstain">Abstain</option></select></Field>
      <Field label="Reason"><textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} /></Field>
      <button type="button" className="cw-primary" onClick={submit} disabled={!reviewer}>Add review</button>
    </FormSection>
    <section className="cw-review-log"><h3>Review log</h3>{selected.reviews.length === 0 ? <p>No reviews recorded.</p> : selected.reviews.map((review) => <article key={review.id}><span data-stance={review.stance}>{review.stance}</span><div><strong>{review.reviewer}</strong><small>{review.role} · {new Date(review.reviewedAt).toLocaleString()}</small><p>{review.comment || "No comment."}</p></div></article>)}</section>
    <section className={readiness.ready ? "cw-gate is-ready" : "cw-gate"}><div><span>{readiness.ready ? "Gate open" : "Gate closed"}</span><h3>{readiness.ready ? "This change meets the recorded policy" : "This change is not ready for approval"}</h3></div>{readiness.reasons.length > 0 && <ul>{readiness.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}<button type="button" className="cw-primary" disabled={!readiness.ready} onClick={() => upsert({ ...selected, status: "approved", updatedAt: new Date().toISOString() })}>Approve change</button></section>
  </Document>;
}

function Releases() {
  const workspace = useInfrastructureStore((state) => state.workspace);
  const addRelease = useInfrastructureStore((state) => state.addRelease);
  const updateRelease = useInfrastructureStore((state) => state.updateRelease);
  const [version, setVersion] = useState("0.1.0");
  const approved = workspace.proposals.filter((proposal) => proposal.status === "approved");
  function create() {
    const release: CommunityRelease = { id: id("release"), version, changeIds: approved.map((proposal) => proposal.id), artifactLocations: approved.flatMap((proposal) => [proposal.targetLocation]), signatures: [], createdAt: new Date().toISOString() };
    addRelease(release);
  }
  return <Document title="Make approved meaning immutable and verifiable" eyebrow="Signed releases">
    <p className="cw-lede">A release is an index, not a mutable folder. It names exact approved changes and artifacts; signatures are added over the canonical bundle by the Idiolect CLI or another ES256 signer.</p>
    <div className="cw-release-create"><Field label="Next community version"><input value={version} onChange={(event) => setVersion(event.target.value)} /></Field><div><span>{approved.length} approved change{approved.length === 1 ? "" : "s"}</span><button type="button" className="cw-primary" disabled={approved.length === 0 || !version} onClick={create}>Prepare release</button></div></div>
    <div className="cw-release-ledger">{workspace.releases.length === 0 ? <Empty title="No releases prepared" body="Approve a verified change, then assemble it here." /> : workspace.releases.map((release) => <ReleaseRow key={release.id} release={release} minimum={workspace.governance.minSignatures} update={updateRelease} />)}</div>
  </Document>;
}

function ReleaseRow({ release, minimum, update }: { release: CommunityRelease; minimum: number; update: (release: CommunityRelease) => void }) {
  const [open, setOpen] = useState(false);
  const enough = release.signatures.length >= minimum;
  function addSignature() {
    const signature: ReleaseSignature = { signer: "", algorithm: "ES256", publicKey: "", signature: "", signedAt: new Date().toISOString() };
    update({ ...release, signatures: [...release.signatures, signature] });
  }
  return <article><button type="button" className="cw-release-summary" onClick={() => setOpen(!open)} aria-expanded={open}><span>v{release.version}</span><strong>{release.changeIds.length} change{release.changeIds.length === 1 ? "" : "s"}</strong><em className={enough ? "is-ready" : ""}>{release.signatures.length}/{minimum} signatures</em></button>{open && <div className="cw-release-body"><p>Prepared {new Date(release.createdAt).toLocaleString()}</p><p className="cw-mono">{release.id}</p><Disclosure level="Interoperate" summary="Detached signatures" hint="Paste output from the Idiolect CLI or another ES256 signer"><button type="button" className="cw-secondary" onClick={addSignature}>Add signature slot</button>{release.signatures.map((signature, index) => <div className="cw-signature" key={`${release.id}-${index}`}><Field label="Signer DID"><input className="cw-mono" value={signature.signer} onChange={(event) => update({ ...release, signatures: release.signatures.map((item, itemIndex) => itemIndex === index ? { ...item, signer: event.target.value } : item) })} /></Field><Field label="Public key"><input className="cw-mono" value={signature.publicKey} onChange={(event) => update({ ...release, signatures: release.signatures.map((item, itemIndex) => itemIndex === index ? { ...item, publicKey: event.target.value } : item) })} /></Field><Field label="Signature"><textarea className="cw-code" rows={2} value={signature.signature} onChange={(event) => update({ ...release, signatures: release.signatures.map((item, itemIndex) => itemIndex === index ? { ...item, signature: event.target.value } : item) })} /></Field></div>)}</Disclosure></div>}</article>;
}

function Operations() {
  const workspace = useInfrastructureStore((state) => state.workspace);
  const upsert = useInfrastructureStore((state) => state.upsertMigration);
  const [changeId, setChangeId] = useState(workspace.proposals.find((proposal) => proposal.status === "approved" || proposal.status === "released")?.id ?? "");
  function create() {
    const now = new Date().toISOString();
    upsert({ id: id("migration"), changeId, lensUri: "", status: "planned", processed: 0, failed: 0, cursor: "", failures: [], createdAt: now, updatedAt: now });
  }
  return <Document title="Treat migration as an operation, not a command" eyebrow="Migration runs">
    <p className="cw-lede">A run carries checkpoints, bounded failure samples, and explicit terminal states. Pausing or resuming never erases what happened.</p>
    <div className="cw-run-create"><Field label="Governed change"><select value={changeId} onChange={(event) => setChangeId(event.target.value)}><option value="">Select a change</option>{workspace.proposals.map((proposal) => <option value={proposal.id} key={proposal.id}>{proposal.title}</option>)}</select></Field><button type="button" className="cw-primary" disabled={!changeId} onClick={create}>Plan migration</button></div>
    <div className="cw-runs">{workspace.migrations.length === 0 ? <Empty title="No migration runs" body="Plan one after a change has a migration lens or manual procedure." /> : workspace.migrations.map((run) => <MigrationRow key={run.id} run={run} update={upsert} maximumFailures={workspace.resources.maxFailureSamples} />)}</div>
  </Document>;
}

function MigrationRow({ run, update, maximumFailures }: { run: MigrationRun; update: (run: MigrationRun) => void; maximumFailures: number }) {
  const progress = run.total && run.total > 0 ? Math.min(100, Math.round((run.processed / run.total) * 100)) : 0;
  const patch = (partial: Partial<MigrationRun>) => update({ ...run, ...partial, updatedAt: new Date().toISOString(), failures: (partial.failures ?? run.failures).slice(0, maximumFailures) });
  return <article><header><div><strong>{run.id}</strong><span>{run.status}</span></div><select aria-label="Migration status" value={run.status} onChange={(event) => patch({ status: event.target.value as MigrationRun["status"] })}><option value="planned">Planned</option><option value="running">Running</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="rolled-back">Rolled back</option></select></header><div className="cw-progress"><span style={{ width: `${progress}%` }} /><em>{run.processed}{run.total ? ` / ${run.total}` : " processed"} · {run.failed} failed</em></div><Disclosure level="Inspect" summary="Checkpoint and counters" hint="Resume safely or diagnose a partial run"><div className="cw-run-fields"><Field label="Total records"><input type="number" value={run.total ?? ""} onChange={(event) => patch({ total: event.target.value ? Number(event.target.value) : undefined })} /></Field><Field label="Processed"><input type="number" min={0} value={run.processed} onChange={(event) => patch({ processed: Number(event.target.value) })} /></Field><Field label="Failed"><input type="number" min={0} value={run.failed} onChange={(event) => patch({ failed: Number(event.target.value) })} /></Field><Field label="Checkpoint cursor"><input className="cw-mono" value={run.cursor} onChange={(event) => patch({ cursor: event.target.value })} /></Field><Field label="Migration lens at-uri"><input className="cw-mono" value={run.lensUri} onChange={(event) => patch({ lensUri: event.target.value })} /></Field></div></Disclosure></article>;
}

function Federation() {
  const workspace = useInfrastructureStore((state) => state.workspace);
  const add = useInfrastructureStore((state) => state.addFederation);
  const [peer, setPeer] = useState("");
  const [relation, setRelation] = useState<FederationLink["relation"]>("bridges");
  const [policy, setPolicy] = useState<FederationLink["updatePolicy"]>("review");
  const [release, setRelease] = useState("");
  const [mappings, setMappings] = useState("");
  function submit() { add({ id: id("federation"), peer, relation, release, updatePolicy: policy, mappings: mappings.split("\n").map((value) => value.trim()).filter(Boolean), notes: "", createdAt: new Date().toISOString() }); setPeer(""); setMappings(""); }
  return <Document title="Relate communities without pretending they are identical" eyebrow="Federation">
    <p className="cw-lede">A federation declaration separates social recognition from semantic equivalence. The relationship says how communities coordinate; mappings say which meanings can actually travel.</p>
    <FormSection title="Declare a peer relationship" note="Follow-compatible accepts only compatible peer releases. Review always asks your community. Pinned never advances automatically.">
      <Field label="Peer community at-uri"><input className="cw-mono" value={peer} onChange={(event) => setPeer(event.target.value)} /></Field>
      <Field label="Relationship"><select value={relation} onChange={(event) => setRelation(event.target.value as FederationLink["relation"])}><option value="follows">Follows</option><option value="extends">Extends</option><option value="bridges">Bridges</option><option value="forked-from">Forked from</option></select></Field>
      <Field label="Update policy"><select value={policy} onChange={(event) => setPolicy(event.target.value as FederationLink["updatePolicy"])}><option value="review">Review every update</option><option value="follow-compatible">Follow compatible updates</option><option value="pinned">Pinned</option></select></Field>
      <Field label="Selected peer release"><input value={release} onChange={(event) => setRelease(event.target.value)} placeholder="1.4.0 or sha256:…" /></Field>
      <Disclosure level="Inspect" summary="Semantic mappings" hint="Optional lenses that make interoperability concrete"><Field label="Mapping at-uris, one per line"><textarea rows={4} className="cw-code" value={mappings} onChange={(event) => setMappings(event.target.value)} /></Field></Disclosure>
      <button type="button" className="cw-primary" disabled={!peer} onClick={submit}>Add relationship</button>
    </FormSection>
    <div className="cw-federation-list">{workspace.federation.map((link) => <article key={link.id}><span>{link.relation}</span><h3>{link.peer}</h3><p>{link.updatePolicy}{link.release ? ` · ${link.release}` : ""}</p><small>{link.mappings.length === 0 ? "No semantic mappings claimed" : `${link.mappings.length} mapping${link.mappings.length === 1 ? "" : "s"}`}</small></article>)}</div>
  </Document>;
}

function ExitAndExport() {
  const workspace = useInfrastructureStore((state) => state.workspace);
  const replace = useInfrastructureStore((state) => state.replaceWorkspace);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  function importBundle(file: File) { file.text().then((text) => { const value = JSON.parse(text) as { workspace?: typeof workspace } | typeof workspace; const next = "workspace" in value && value.workspace ? value.workspace : value as typeof workspace; if (next.formatVersion !== 1) throw new Error("Unsupported workspace format version."); replace(next); setError(null); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason))); }
  return <Document title="A community must be able to leave with its history" eyebrow="Exit & export">
    <p className="cw-lede">The portable bundle contains the workspace manifest, change history, review evidence, migration checkpoints, releases, federation declarations, and a human-readable inventory. It has no dependency on Fieldwork’s local storage.</p>
    <section className="cw-exit"><div><span className="cw-kicker">Portable by default</span><h3>{workspace.identity.name || "This workspace"}</h3><dl><div><dt>Change packets</dt><dd>{workspace.proposals.length}</dd></div><div><dt>Releases</dt><dd>{workspace.releases.length}</dd></div><div><dt>Migration runs</dt><dd>{workspace.migrations.length}</dd></div><div><dt>Federation links</dt><dd>{workspace.federation.length}</dd></div></dl></div><div className="cw-exit-actions"><button type="button" className="cw-primary" onClick={() => downloadJson(`${workspace.identity.name || "community"}-idiolect-workspace.json`, buildPortableBundle(workspace))}>Download complete bundle</button><button type="button" className="cw-secondary" onClick={() => input.current?.click()}>Import a bundle</button><input ref={input} hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) importBundle(file); }} />{error && <p className="cw-error" role="alert">{error}</p>}</div></section>
    <section className="cw-export-records"><h3>Publishable records</h3><p>Download individual protocol records when you want to publish with the Idiolect CLI or another ATProto client.</p>{workspace.proposals.map((proposal) => <button type="button" key={proposal.id} onClick={() => downloadJson(`${proposal.id}.json`, proposalRecord(proposal, workspace))}><span>change proposal</span><strong>{proposal.title}</strong><em>download JSON</em></button>)}</section>
  </Document>;
}

function EvidenceLedger({ selected }: { selected: ChangeProposal | null }) {
  const workspace = useInfrastructureStore((state) => state.workspace);
  const readiness = selected ? proposalReadiness(selected, workspace) : null;
  const activeMigrations = workspace.migrations.filter((run) => ["planned", "running", "paused"].includes(run.status));
  return <aside className="cw-ledger" aria-label="Evidence ledger"><header><span>Evidence ledger</span><strong>{selected?.title ?? "Workspace"}</strong></header>{selected ? <><LedgerLine label="Compatibility" value={selected.compatibility} tone={selected.compatibility === "breaking" ? "danger" : ""} /><LedgerLine label="Verification" value={selected.verificationStatus} tone={selected.verificationStatus === "verified" ? "good" : "warn"} /><LedgerLine label="Reviews" value={`${selected.reviews.length} recorded`} /><LedgerLine label="Decision gate" value={readiness?.ready ? "ready" : "blocked"} tone={readiness?.ready ? "good" : "warn"} /><LedgerLine label="Rollback" value={selected.rollback ? "documented" : "missing"} tone={selected.rollback ? "good" : "warn"} /></> : <p>Select or create a change packet to see its evidence at a glance.</p>}<section><span>Community policy</span><p>{workspace.governance.model} · quorum {workspace.governance.quorum}</p><p>{Math.round(workspace.governance.approvalThreshold * 100)}% approval · {workspace.governance.minSignatures} signature minimum</p></section><section><span>Operations</span><p>{activeMigrations.length} active migration{activeMigrations.length === 1 ? "" : "s"}</p><p>{workspace.federation.length} federation relationship{workspace.federation.length === 1 ? "" : "s"}</p></section></aside>;
}

function LedgerLine({ label, value, tone = "" }: { label: string; value: string; tone?: string }) { return <div className={`cw-ledger-line ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
function Document({ title, eyebrow, actions, children }: { title: string; eyebrow: string; actions?: React.ReactNode; children: React.ReactNode }) { return <div className="cw-page"><header className="cw-page-head"><div><span className="cw-kicker">{eyebrow}</span><h2>{title}</h2></div>{actions}</header>{children}</div>; }
function FormSection({ title, note, children }: { title: string; note: string; children: React.ReactNode }) { return <section className="cw-form-section"><header><h3>{title}</h3><p>{note}</p></header><div>{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="cw-field"><span>{label}</span>{children}</label>; }
function Empty({ title, body }: { title: string; body: string }) { return <div className="cw-empty"><span aria-hidden="true">○</span><strong>{title}</strong><p>{body}</p></div>; }
function Disclosure({ level, summary, hint, children }: { level: "Inspect" | "Interoperate"; summary: string; hint: string; children: React.ReactNode }) { return <details className="cw-disclosure"><summary><span><em>{level}</em><strong>{summary}</strong><small>{hint}</small></span><i aria-hidden="true">+</i></summary><div className="cw-disclosure-body">{children}</div></details>; }
