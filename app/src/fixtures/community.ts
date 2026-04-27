export const communityFixtures = [
  {
    name: "community/two-members",
    label: "two members + plain-text conventions",
    body: {
      name: "research-corp",
      description:
        "A small research community shipping shared lenses for atproto encounter records.",
      members: ["did:plc:alice", "did:plc:bob"],
      conventionsText:
        "Encounters must cite a published lens. Recommendations require at least one verification.",
      createdAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "community/structured-conventions",
    label: "structured conventions (review cadence + verification req)",
    body: {
      name: "lens-review-board",
      description:
        "Community that reviews and endorses lenses against typed verification policies.",
      members: ["did:plc:alice", "did:plc:bob", "did:plc:carol"],
      conventions: [
        {
          $type: "dev.idiolect.community#conventionReviewCadence",
          maxDays: 5,
          scope: "lens-review",
        },
        {
          $type: "dev.idiolect.community#conventionVerificationReq",
          kind: "roundtrip-test",
        },
        {
          $type: "dev.idiolect.community#conventionDeprecationPolicy",
          noticePeriodDays: 30,
          replacementRequired: true,
        },
      ],
      conventionsText:
        "Tone: terse, citation-heavy. Style: prefer typed conventions over prose for anything machine-checkable.",
      createdAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "community/with-roll-and-endorsements",
    label: "external membership roll + endorsed peers",
    body: {
      name: "atproto-translators",
      description:
        "Larger community that maintains its membership roll separately and endorses peer communities as legitimate interlocutors.",
      membershipRoll:
        "at://did:plc:example/dev.idiolect.community.roll/main",
      endorsedCommunities: [
        "at://did:plc:other/dev.idiolect.community/main",
        "at://did:plc:peer/dev.idiolect.community/main",
      ],
      createdAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "community/with-core-sets",
    label: "core schemas + core lenses pinned",
    body: {
      name: "ml-corpus-stewards",
      description:
        "Community publishing the canonical schema + lens set for its dataset.",
      members: ["did:plc:alice", "did:plc:bob"],
      coreSchemas: [
        {
          uri: "at://did:plc:example/dev.panproto.schema/encounter-v1",
        },
        {
          uri: "at://did:plc:example/dev.panproto.schema/observation-v1",
        },
      ],
      coreLenses: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/encounter-to-observation",
        },
      ],
      conventionsText:
        "Records that drift from the core schemas must publish a migration lens before they can be cited.",
      createdAt: "2026-04-26T00:00:00Z",
    },
  },
];
