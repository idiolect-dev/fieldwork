export type GovernanceModel =
  | "maintainer"
  | "consent"
  | "vote"
  | "steward"
  | "hybrid";

export type ProposalStatus =
  | "draft"
  | "review"
  | "approved"
  | "rejected"
  | "released"
  | "superseded";

export type VerificationStatus =
  | "verified"
  | "refuted"
  | "incomplete"
  | "not-run";

export interface CommunityIdentity {
  name: string;
  did: string;
  communityUri: string;
  purpose: string;
}

export interface GovernancePolicy {
  model: GovernanceModel;
  quorum: number;
  approvalThreshold: number;
  minSignatures: number;
  reviewPeriodDays: number;
}

export interface ResourcePolicy {
  maxSchemaBytes: number;
  maxConsequences: number;
  maxFailureSamples: number;
}

export interface Consequence {
  code: string;
  severity: "information" | "review" | "blocking";
  headline: string;
  detail: string;
}

export interface Review {
  id: string;
  reviewer: string;
  role: string;
  stance: "approve" | "reject" | "abstain";
  comment: string;
  reviewedAt: string;
}

export interface ChangeProposal {
  id: string;
  title: string;
  summary: string;
  author: string;
  protocol: string;
  sourceLocation: string;
  targetLocation: string;
  sourceSchema: string;
  targetSchema: string;
  sourceDigest: string;
  targetDigest: string;
  compatibility: "fully-compatible" | "backward-compatible" | "breaking" | "not-analyzed";
  opticKind?: "iso" | "lens" | "prism" | "affine" | "traversal";
  consequences: Consequence[];
  affected: string[];
  rollback: string;
  status: ProposalStatus;
  verificationStatus: VerificationStatus;
  reviews: Review[];
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseSignature {
  signer: string;
  algorithm: "ES256";
  publicKey: string;
  signature: string;
  signedAt: string;
}

export interface CommunityRelease {
  id: string;
  version: string;
  changeIds: string[];
  artifactLocations: string[];
  signatures: ReleaseSignature[];
  createdAt: string;
}

export type MigrationStatus =
  | "planned"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "rolled-back";

export interface MigrationFailure {
  record: string;
  reason: string;
}

export interface MigrationRun {
  id: string;
  changeId: string;
  lensUri: string;
  status: MigrationStatus;
  total?: number;
  processed: number;
  failed: number;
  cursor: string;
  failures: MigrationFailure[];
  createdAt: string;
  updatedAt: string;
}

export interface FederationLink {
  id: string;
  peer: string;
  relation: "follows" | "extends" | "bridges" | "forked-from";
  release: string;
  updatePolicy: "review" | "follow-compatible" | "pinned";
  mappings: string[];
  notes: string;
  createdAt: string;
}

export interface CommunityWorkspace {
  formatVersion: 1;
  identity: CommunityIdentity;
  governance: GovernancePolicy;
  resources: ResourcePolicy;
  proposals: ChangeProposal[];
  releases: CommunityRelease[];
  migrations: MigrationRun[];
  federation: FederationLink[];
  updatedAt: string;
}

export type InfrastructureSection =
  | "overview"
  | "workspace"
  | "changes"
  | "decisions"
  | "releases"
  | "operations"
  | "federation"
  | "exit";
