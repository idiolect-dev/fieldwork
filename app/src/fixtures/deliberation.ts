import type { Fixture } from "./index";

// Seed deliberations a community organiser can clone-and-edit. The
// shape mirrors the v0.7.0 dev.idiolect.deliberation lexicon.

export const deliberationFixtures: Fixture[] = [
  {
    name: "verification-policy-v2",
    label: "Adopt verification policy v2",
    body: {
      owningCommunity: "at://example.com/dev.idiolect.community/main",
      topic: "Should we adopt verification policy v2?",
      description:
        "Background: v1 required only roundtrip-test verifications for a lens to fulfil a recommendation. v2 promotes property-test to the floor and lets formal-proof + coercion-law verifications skip the request-for-comment window. This deliberation collects member positions before the vote on 2026-05-15.",
      authRequired: true,
      classification: "proposal",
      status: "open",
      createdAt: "2026-04-29T00:00:00.000Z",
    },
  },
  {
    name: "open-rfc-question",
    label: "Should grievances be public by default?",
    body: {
      owningCommunity: "at://example.com/dev.idiolect.community/main",
      topic: "Should grievances be public-detailed by default?",
      authRequired: false,
      classification: "question",
      status: "open",
      createdAt: "2026-04-29T00:00:00.000Z",
    },
  },
  {
    name: "retrospective-2026-q1",
    label: "Q1 2026 retrospective",
    body: {
      owningCommunity: "at://example.com/dev.idiolect.community/main",
      topic: "Q1 2026 retrospective: what did we learn?",
      description:
        "An open retrospective on the first quarter under the new dialect. Statements welcome on what worked, what broke, what to change before Q2.",
      authRequired: true,
      classification: "retrospective",
      status: "closed",
      closedAt: "2026-04-15T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
    },
  },
];

export const deliberationStatementFixtures: Fixture[] = [
  {
    name: "seed-claim",
    label: "Seed claim: formal proofs are stronger",
    body: {
      deliberation: {
        uri: "at://example.com/dev.idiolect.deliberation/v2-policy",
        cid: "bafyreidfcm4u3vnuph5ltwdpssiz3a4xfbm2otjrdisftwnbfmnxd6lsxm",
      },
      text: "A formal proof entails the property-test claim transitively, so requiring property-test should not block a verification that ships a formal proof.",
      classification: "claim",
      anonymous: false,
      createdAt: "2026-04-29T00:00:00.000Z",
    },
  },
  {
    name: "seed-dissent",
    label: "Seed dissent: review burden",
    body: {
      deliberation: {
        uri: "at://example.com/dev.idiolect.deliberation/v2-policy",
        cid: "bafyreidfcm4u3vnuph5ltwdpssiz3a4xfbm2otjrdisftwnbfmnxd6lsxm",
      },
      text: "Promoting property-test to the floor doubles the review burden on small communities. Suggest a six-month transition window.",
      classification: "dissent",
      anonymous: false,
      createdAt: "2026-04-29T00:00:00.000Z",
    },
  },
];

export const deliberationOutcomeFixtures: Fixture[] = [
  {
    name: "v2-policy-tally",
    label: "Tally: verification-policy-v2",
    body: {
      deliberation: {
        uri: "at://example.com/dev.idiolect.deliberation/v2-policy",
        cid: "bafyreidfcm4u3vnuph5ltwdpssiz3a4xfbm2otjrdisftwnbfmnxd6lsxm",
      },
      statementTallies: [
        {
          statement: {
            uri: "at://example.com/dev.idiolect.deliberationStatement/seed-claim",
            cid: "bafyreidfcm4u3vnuph5ltwdpssiz3a4xfbm2otjrdisftwnbfmnxd6lsxm",
          },
          counts: [
            { stance: "agree", count: 17 },
            { stance: "disagree", count: 4 },
            { stance: "pass", count: 2 },
          ],
        },
      ],
      stanceVocab: {
        uri: "at://idiolect-dev/dev.idiolect.vocab/vote-stances-v1",
      },
      computedAt: "2026-04-29T01:00:00.000Z",
      occurredAt: "2026-04-29T01:00:00.000Z",
    },
  },
];
