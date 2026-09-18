import { create } from "zustand";
import type {
  ChangeProposal,
  CommunityRelease,
  CommunityWorkspace,
  FederationLink,
  InfrastructureSection,
  MigrationRun,
  Review,
} from "./types";

const STORAGE_KEY = "fieldwork.community-workspace.v1";

export const defaultCommunityWorkspace: CommunityWorkspace = {
  formatVersion: 1,
  identity: {
    name: "",
    did: "",
    communityUri: "",
    purpose: "",
  },
  governance: {
    model: "consent",
    quorum: 2,
    approvalThreshold: 0.67,
    minSignatures: 1,
    reviewPeriodDays: 3,
  },
  resources: {
    maxSchemaBytes: 1_048_576,
    maxConsequences: 256,
    maxFailureSamples: 100,
  },
  proposals: [],
  releases: [],
  migrations: [],
  federation: [],
  updatedAt: new Date(0).toISOString(),
};

function load(): CommunityWorkspace {
  if (typeof localStorage === "undefined") return defaultCommunityWorkspace;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultCommunityWorkspace;
  try {
    return {
      ...defaultCommunityWorkspace,
      ...(JSON.parse(raw) as Partial<CommunityWorkspace>),
    };
  } catch {
    return defaultCommunityWorkspace;
  }
}

function save(workspace: CommunityWorkspace): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Privacy mode and storage quotas must not make the workbench unusable.
  }
}

function fresh(workspace: CommunityWorkspace): CommunityWorkspace {
  const next = { ...workspace, updatedAt: new Date().toISOString() };
  save(next);
  return next;
}

interface InfrastructureState {
  section: InfrastructureSection;
  workspace: CommunityWorkspace;
  selectedProposalId: string | null;
  setSection: (section: InfrastructureSection) => void;
  replaceWorkspace: (workspace: CommunityWorkspace) => void;
  patchIdentity: (patch: Partial<CommunityWorkspace["identity"]>) => void;
  patchGovernance: (patch: Partial<CommunityWorkspace["governance"]>) => void;
  patchResources: (patch: Partial<CommunityWorkspace["resources"]>) => void;
  upsertProposal: (proposal: ChangeProposal) => void;
  selectProposal: (id: string | null) => void;
  addReview: (proposalId: string, review: Review) => void;
  addRelease: (release: CommunityRelease) => void;
  updateRelease: (release: CommunityRelease) => void;
  upsertMigration: (run: MigrationRun) => void;
  addFederation: (link: FederationLink) => void;
}

export const useInfrastructureStore = create<InfrastructureState>((set) => ({
  section: "overview",
  workspace: load(),
  selectedProposalId: null,
  setSection: (section) => set({ section }),
  replaceWorkspace: (workspace) => {
    const next = fresh(workspace);
    set({ workspace: next, selectedProposalId: null });
  },
  patchIdentity: (patch) =>
    set((state) => ({
      workspace: fresh({
        ...state.workspace,
        identity: { ...state.workspace.identity, ...patch },
      }),
    })),
  patchGovernance: (patch) =>
    set((state) => ({
      workspace: fresh({
        ...state.workspace,
        governance: { ...state.workspace.governance, ...patch },
      }),
    })),
  patchResources: (patch) =>
    set((state) => ({
      workspace: fresh({
        ...state.workspace,
        resources: { ...state.workspace.resources, ...patch },
      }),
    })),
  upsertProposal: (proposal) =>
    set((state) => {
      const exists = state.workspace.proposals.some((p) => p.id === proposal.id);
      const proposals = exists
        ? state.workspace.proposals.map((p) => (p.id === proposal.id ? proposal : p))
        : [...state.workspace.proposals, proposal];
      return {
        workspace: fresh({ ...state.workspace, proposals }),
        selectedProposalId: proposal.id,
      };
    }),
  selectProposal: (selectedProposalId) => set({ selectedProposalId }),
  addReview: (proposalId, review) =>
    set((state) => ({
      workspace: fresh({
        ...state.workspace,
        proposals: state.workspace.proposals.map((proposal) =>
          proposal.id === proposalId
            ? {
                ...proposal,
                reviews: [...proposal.reviews, review],
                status: "review",
                updatedAt: new Date().toISOString(),
              }
            : proposal,
        ),
      }),
    })),
  addRelease: (release) =>
    set((state) => ({
      workspace: fresh({
        ...state.workspace,
        releases: [...state.workspace.releases, release],
        proposals: state.workspace.proposals.map((proposal) =>
          release.changeIds.includes(proposal.id)
            ? { ...proposal, status: "released", updatedAt: new Date().toISOString() }
            : proposal,
        ),
      }),
    })),
  updateRelease: (release) =>
    set((state) => ({
      workspace: fresh({
        ...state.workspace,
        releases: state.workspace.releases.map((item) =>
          item.id === release.id ? release : item,
        ),
      }),
    })),
  upsertMigration: (run) =>
    set((state) => {
      const exists = state.workspace.migrations.some((item) => item.id === run.id);
      return {
        workspace: fresh({
          ...state.workspace,
          migrations: exists
            ? state.workspace.migrations.map((item) => (item.id === run.id ? run : item))
            : [...state.workspace.migrations, run],
        }),
      };
    }),
  addFederation: (link) =>
    set((state) => ({
      workspace: fresh({
        ...state.workspace,
        federation: [...state.workspace.federation, link],
      }),
    })),
}));
