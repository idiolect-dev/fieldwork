import { describe, expect, it } from "vitest";
import { explainDiff, proposalReadiness } from "./analysis";
import { defaultCommunityWorkspace } from "./store";
import type { ChangeProposal } from "./types";

function proposal(): ChangeProposal {
  return {
    id: "change-1",
    title: "Add pronouns",
    summary: "Optional profile field",
    author: "did:plc:author",
    protocol: "atproto",
    sourceLocation: "old.json",
    targetLocation: "new.json",
    sourceSchema: "{}",
    targetSchema: "{}",
    sourceDigest: "sha256:old",
    targetDigest: "sha256:new",
    compatibility: "backward-compatible",
    consequences: [],
    affected: [],
    rollback: "Republish the old definition.",
    status: "review",
    verificationStatus: "verified",
    reviews: [],
    createdAt: "2026-09-18T00:00:00Z",
    updatedAt: "2026-09-18T00:00:00Z",
  };
}

describe("plain-language consequences", () => {
  it("makes removed structure blocking and optional additions informational", () => {
    const consequences = explainDiff(
      {
        added_vertices: ["pronouns"],
        removed_vertices: ["legacyName"],
        added_edges: [],
        removed_edges: [],
        added_required: {},
        removed_required: {},
        kind_changes: [],
      },
      "breaking",
    );
    expect(consequences.map((item) => item.severity)).toContain("blocking");
    expect(consequences.map((item) => item.severity)).toContain("information");
  });
});

describe("governance gate", () => {
  it("never treats incomplete verification as approval", () => {
    const workspace = {
      ...defaultCommunityWorkspace,
      governance: { ...defaultCommunityWorkspace.governance, quorum: 1 },
    };
    const change = proposal();
    change.verificationStatus = "incomplete";
    change.reviews.push({
      id: "review-1",
      reviewer: "did:plc:reviewer",
      role: "member",
      stance: "approve",
      comment: "yes",
      reviewedAt: "2026-09-18T01:00:00Z",
    });
    const result = proposalReadiness(change, workspace);
    expect(result.ready).toBe(false);
    expect(result.reasons.join(" ")).toContain("incomplete");
  });

  it("opens when verified reviews satisfy policy", () => {
    const workspace = {
      ...defaultCommunityWorkspace,
      governance: { ...defaultCommunityWorkspace.governance, quorum: 1 },
    };
    const change = proposal();
    change.reviews.push({
      id: "review-1",
      reviewer: "did:plc:reviewer",
      role: "member",
      stance: "approve",
      comment: "yes",
      reviewedAt: "2026-09-18T01:00:00Z",
    });
    expect(proposalReadiness(change, workspace).ready).toBe(true);
  });
});
