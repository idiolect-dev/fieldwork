export const recommendationFixtures = [
  {
    name: "recommendation/single-lens",
    label: "single-lens path, no conditions",
    body: {
      issuingCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      lensPath: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/v1",
        },
      ],
      conditions: [],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "recommendation/source-and-target",
    label:
      "applies when source AND target schemas match (postfix and-tree)",
    body: {
      issuingCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      lensPath: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/migrate-v1-to-v2",
        },
      ],
      // Postfix-form combinator tree: pushes two atomic predicates,
      // then conditionAnd pops them. Reads as "source is X AND target is Y".
      conditions: [
        {
          $type: "dev.idiolect.recommendation#conditionSourceIs",
          schema: {
            uri: "at://did:plc:example/dev.panproto.schema/encounter-v1",
          },
        },
        {
          $type: "dev.idiolect.recommendation#conditionTargetIs",
          schema: {
            uri: "at://did:plc:example/dev.panproto.schema/encounter-v2",
          },
        },
        {
          $type: "dev.idiolect.recommendation#conditionAnd",
        },
      ],
      annotations:
        "Use this lens when migrating any v1 encounter into v2. The and-tree gates on both source and target schemas.",
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "recommendation/with-required-verifications",
    label: "single lens, gated on roundtrip + theorem",
    body: {
      issuingCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      lensPath: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/lossless-v1",
        },
      ],
      conditions: [],
      requiredVerifications: [
        {
          $type: "dev.idiolect.defs#lpRoundtrip",
          domain: "all valid v1 encounter records",
        },
        {
          $type: "dev.idiolect.defs#lpTheorem",
          statement: "forall r, unlens (lens r) = r",
          system: "lean4",
        },
      ],
      annotations:
        "We endorse this lens only after the listed roundtrip domain and theorem are verified upstream.",
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "recommendation/with-caveats",
    label: "single lens with structured caveats",
    body: {
      issuingCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      lensPath: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/lossy-summariser",
        },
      ],
      conditions: [],
      caveats: [
        {
          mode: "loses-dialect-markers",
          affects: ["dialect", "register"],
          severity: "high",
        },
        {
          mode: "degrades-on-long-inputs",
          affects: ["body"],
          severity: "low",
        },
      ],
      caveatsText:
        "Acceptable for indexable summaries. Do not use when the downstream consumer needs to reproduce dialect markers.",
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "recommendation/action-subsumed-precondition",
    label:
      "precondition: invocation action is subsumed by 'training'",
    body: {
      issuingCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      lensPath: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/training-only",
        },
      ],
      conditions: [],
      preconditions: [
        {
          $type: "dev.idiolect.recommendation#conditionActionSubsumedBy",
          action: "training",
          vocabulary: {
            uri: "at://did:plc:example/dev.idiolect.vocab/training-actions-v1",
          },
        },
      ],
      annotations:
        "Consumers should adopt this only when their declared action is subsumed by 'training' under the cited vocabulary.",
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
];
