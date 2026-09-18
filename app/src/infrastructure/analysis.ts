import { MigrationAnalysis } from "@panproto/core";
import { panproto } from "../panproto/init";
import type {
  ChangeProposal,
  CommunityWorkspace,
  Consequence,
} from "./types";

export interface SchemaAnalysis {
  compatibility: ChangeProposal["compatibility"];
  opticKind?: ChangeProposal["opticKind"];
  consequences: Consequence[];
}

export function explainDiff(
  data: {
    added_vertices: readonly string[];
    removed_vertices: readonly string[];
    added_edges: readonly unknown[];
    removed_edges: readonly unknown[];
    added_required: Readonly<Record<string, readonly unknown[]>>;
    removed_required: Readonly<Record<string, readonly unknown[]>>;
    kind_changes: readonly unknown[];
  },
  compatibility: SchemaAnalysis["compatibility"],
): Consequence[] {
  const consequences: Consequence[] = [];
  const add = (item: Consequence) => consequences.push(item);

  if (data.removed_vertices.length > 0) {
    add({
      code: "removed-structure",
      severity: "blocking",
      headline: `${data.removed_vertices.length} existing structure${data.removed_vertices.length === 1 ? " is" : "s are"} removed`,
      detail: "Some existing records may contain information the new definition no longer accepts. Plan a migration or preserve that information through a lens.",
    });
  }
  if (data.removed_edges.length > 0) {
    add({
      code: "removed-field",
      severity: "blocking",
      headline: `${data.removed_edges.length} field relationship${data.removed_edges.length === 1 ? " is" : "s are"} removed`,
      detail: "Readers using the new definition may no longer see these fields. Check who relies on them before approval.",
    });
  }
  const requiredCount = Object.values(data.added_required).reduce(
    (sum, entries) => sum + entries.length,
    0,
  );
  if (requiredCount > 0) {
    add({
      code: "new-required-data",
      severity: "blocking",
      headline: `${requiredCount} new required field${requiredCount === 1 ? "" : "s"}`,
      detail: "Older records will not contain this information. Decide on a default, request participant input, or document which records cannot migrate automatically.",
    });
  }
  if (data.kind_changes.length > 0) {
    add({
      code: "changed-meaning",
      severity: "review",
      headline: `${data.kind_changes.length} value kind${data.kind_changes.length === 1 ? " changes" : "s change"}`,
      detail: "The shape or interpretation of stored values changes. Review representative records before release.",
    });
  }
  const addedCount = data.added_vertices.length + data.added_edges.length;
  if (addedCount > 0) {
    add({
      code: "new-capability",
      severity: "information",
      headline: `${addedCount} optional structure${addedCount === 1 ? " is" : "s are"} added`,
      detail: "Existing records can remain unchanged unless the community separately makes the new information mandatory.",
    });
  }
  if (consequences.length === 0) {
    add({
      code: "no-structural-change",
      severity: "information",
      headline: "No structural difference detected",
      detail: "The two definitions have the same Panproto structure. Review descriptions and governance metadata separately.",
    });
  }
  if (compatibility === "breaking" && !consequences.some((item) => item.severity === "blocking")) {
    add({
      code: "protocol-breaking",
      severity: "blocking",
      headline: "The protocol classifies this change as breaking",
      detail: "Inspect the technical diff before approval; the protocol found a compatibility obligation not captured by the short summary above.",
    });
  }
  return consequences;
}

export function analyzeProposal(
  proposal: ChangeProposal,
  resources: CommunityWorkspace["resources"],
): SchemaAnalysis {
  const sourceBytes = new TextEncoder().encode(proposal.sourceSchema).byteLength;
  const targetBytes = new TextEncoder().encode(proposal.targetSchema).byteLength;
  if (sourceBytes > resources.maxSchemaBytes || targetBytes > resources.maxSchemaBytes) {
    throw new Error(
      `Schema exceeds this workspace's ${resources.maxSchemaBytes.toLocaleString()}-byte limit.`,
    );
  }

  const api = panproto();
  const oldDocument = JSON.parse(proposal.sourceSchema) as object;
  const newDocument = JSON.parse(proposal.targetSchema) as object;
  const oldSchema = api.parseSchemaDocument(proposal.protocol, oldDocument);
  const newSchema = api.parseSchemaDocument(proposal.protocol, newDocument);
  const diff = api.diffFull(oldSchema, newSchema);
  const report = diff.classify(api.protocol(proposal.protocol));
  const compatibility: SchemaAnalysis["compatibility"] = report.isBreaking
    ? "breaking"
    : report.isBackwardCompatible
      ? "backward-compatible"
      : "fully-compatible";

  let opticKind: SchemaAnalysis["opticKind"];
  try {
    const chain = api.protolensChain(oldSchema, newSchema);
    opticKind = new MigrationAnalysis(api).opticKind(chain, oldSchema);
  } catch {
    opticKind = undefined;
  }

  return {
    compatibility,
    opticKind,
    consequences: explainDiff(diff.data, compatibility).slice(
      0,
      resources.maxConsequences,
    ),
  };
}

export function proposalReadiness(
  proposal: ChangeProposal,
  workspace: CommunityWorkspace,
): { ready: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const decisions = proposal.reviews.filter((review) => review.stance !== "abstain");
  const approvals = decisions.filter((review) => review.stance === "approve").length;
  const rejections = decisions.filter((review) => review.stance === "reject").length;
  if (proposal.compatibility === "not-analyzed") reasons.push("Run the consequence analysis.");
  if (proposal.verificationStatus !== "verified") {
    reasons.push("Verification must be verified; incomplete never passes the gate.");
  }
  if (decisions.length < workspace.governance.quorum) {
    reasons.push(`Collect ${workspace.governance.quorum - decisions.length} more non-abstaining review(s).`);
  }
  const ratio = decisions.length === 0 ? 0 : approvals / decisions.length;
  if (ratio < workspace.governance.approvalThreshold) {
    reasons.push(`Approval is ${Math.round(ratio * 100)}%; policy requires ${Math.round(workspace.governance.approvalThreshold * 100)}%.`);
  }
  if (workspace.governance.model === "consent" && rejections > 0) {
    reasons.push("Consent policy requires resolving every rejection.");
  }
  return { ready: reasons.length === 0, reasons };
}
