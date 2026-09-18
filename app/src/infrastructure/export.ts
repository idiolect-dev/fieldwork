import type { ChangeProposal, CommunityWorkspace } from "./types";

export interface PortableCommunityBundle {
  format: "dev.idiolect.community-workspace";
  formatVersion: 1;
  exportedAt: string;
  workspace: CommunityWorkspace;
  inventory: Array<{ path: string; kind: string; id: string }>;
}

export function buildPortableBundle(
  workspace: CommunityWorkspace,
  now = new Date(),
): PortableCommunityBundle {
  return {
    format: "dev.idiolect.community-workspace",
    formatVersion: 1,
    exportedAt: now.toISOString(),
    workspace,
    inventory: [
      ...workspace.proposals.map((item) => ({ path: `changes/${item.id}.json`, kind: "changeProposal", id: item.id })),
      ...workspace.releases.map((item) => ({ path: `releases/${item.id}.json`, kind: "communityRelease", id: item.id })),
      ...workspace.migrations.map((item) => ({ path: `migrations/${item.id}.json`, kind: "migrationRun", id: item.id })),
      ...workspace.federation.map((item) => ({ path: `federation/${item.id}.json`, kind: "federation", id: item.id })),
    ],
  };
}

export function proposalRecord(
  proposal: ChangeProposal,
  workspace: CommunityWorkspace,
): Record<string, unknown> {
  return {
    community: workspace.identity.communityUri,
    title: proposal.title,
    summary: proposal.summary,
    author: proposal.author,
    status: proposal.status,
    source: {
      protocol: proposal.protocol,
      location: proposal.sourceLocation,
      digest: proposal.sourceDigest,
    },
    target: {
      protocol: proposal.protocol,
      location: proposal.targetLocation,
      digest: proposal.targetDigest,
    },
    compatibility: proposal.compatibility,
    ...(proposal.opticKind ? { opticKind: proposal.opticKind } : {}),
    consequences: proposal.consequences,
    affected: proposal.affected,
    rollback: proposal.rollback,
    reviews: proposal.reviews.map(({ id: _id, ...review }) => review),
    verificationStatus: proposal.verificationStatus,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  };
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
