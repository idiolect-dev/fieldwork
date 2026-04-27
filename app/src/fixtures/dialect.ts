// Bundled fixtures the Dialect Composer's Import → fixture menu and
// the Sidebar's Templates section surface. Each fixture should
// illustrate ONE shape choice (single lens, multi-lens pipeline,
// deprecation, supersedes-chain) rather than every optional field.

export const dialectFixtures = [
  {
    name: "dialect/minimal",
    label: "minimal, one preferred lens",
    body: {
      name: "minimal",
      owningCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      preferredLenses: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/v1",
        },
      ],
      createdAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "dialect/multi-lens-pipeline",
    label: "multi-lens pipeline, three hops",
    body: {
      name: "research-pipeline-v1",
      description:
        "Pipeline that normalises encounter records through three lenses before publication.",
      owningCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      preferredLenses: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/normalise",
        },
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/enrich",
        },
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/publish",
        },
      ],
      version: "1.0",
      createdAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "dialect/with-deprecation",
    label: "deprecation, superseding an earlier preferred lens",
    body: {
      name: "v2",
      owningCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      preferredLenses: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/v2",
        },
      ],
      deprecations: [
        {
          ref: "at://did:plc:example/dev.panproto.schema.lens/v1",
          replacement:
            "at://did:plc:example/dev.panproto.schema.lens/v2",
          deprecatedAt: "2026-04-26T00:00:00Z",
          reason:
            "v1 lens has known coercion-law violations. v2 fixes them.",
        },
      ],
      version: "2",
      createdAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "dialect/with-idiolects",
    label: "idiolects (the schemas this dialect bundles)",
    body: {
      name: "encounter-corpus",
      description:
        "Dialect that bundles three schemas as the canonical idiolect set, with a single normalising lens.",
      owningCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      idiolects: [
        { uri: "at://did:plc:example/dev.panproto.schema/encounter-v2" },
        { uri: "at://did:plc:example/dev.panproto.schema/observation-v1" },
        { uri: "at://did:plc:example/dev.panproto.schema/correction-v1" },
      ],
      preferredLenses: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/normalise",
        },
      ],
      version: "1.0",
      createdAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "dialect/with-supersedes-chain",
    label: "version chain (previousVersion points back at v2)",
    body: {
      name: "v3",
      description:
        "Continuation of an earlier dialect. Subscribers can walk previousVersion back to v2.",
      owningCommunity:
        "at://did:plc:example/dev.idiolect.community/main",
      preferredLenses: [
        {
          uri: "at://did:plc:example/dev.panproto.schema.lens/v3",
        },
      ],
      previousVersion: "at://did:plc:example/dev.idiolect.dialect/v2",
      version: "3",
      createdAt: "2026-04-26T00:00:00Z",
    },
  },
];
