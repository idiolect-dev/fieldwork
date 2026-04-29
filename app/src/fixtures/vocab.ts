export const vocabFixtures = [
  {
    name: "vocab/graph-subsumption",
    label: "single-relation subsumption (subsumed_by edges)",
    body: {
      name: "training-actions-v1",
      description:
        "Three-tier subsumption hierarchy expressed as typed nodes plus subsumed_by edges. The root node has no outbound subsumed_by edge.",
      world: "closed-with-default",
      nodes: [
        { id: "any_action", kind: "action", label: "any action" },
        { id: "train_model", kind: "action", label: "train model" },
        { id: "fine_tune", kind: "action", label: "fine tune" },
      ],
      edges: [
        { source: "train_model", target: "any_action", relationSlug: "subsumed_by" },
        { source: "fine_tune", target: "train_model", relationSlug: "subsumed_by" },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "vocab/graph-multi-relation",
    label: "multi-relation (subsumed_by, broader_than, equivalent_to)",
    body: {
      name: "purposes-multi-relation-v1",
      description:
        "Typed multi-relation knowledge graph. Subsumption, SKOS-style broader_than, and cross-vocab equivalent_to coexist on the same node set.",
      world: "closed-with-default",
      nodes: [
        { id: "any_purpose", kind: "purpose", label: "any purpose" },
        { id: "research", kind: "purpose", label: "research" },
        { id: "academic_publication", kind: "purpose", label: "academic publication" },
        { id: "internal_review", kind: "purpose", label: "internal review" },
        {
          id: "scholarly_publication",
          kind: "purpose",
          label: "scholarly publication",
          alternateLabels: ["scholarship"],
        },
      ],
      edges: [
        { source: "research", target: "any_purpose", relationSlug: "subsumed_by" },
        { source: "academic_publication", target: "research", relationSlug: "subsumed_by" },
        { source: "internal_review", target: "research", relationSlug: "subsumed_by" },
        { source: "scholarly_publication", target: "academic_publication", relationSlug: "broader_than" },
        { source: "academic_publication", target: "scholarly_publication", relationSlug: "equivalent_to" },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "vocab/graph-owl-lite",
    label: "OWL Lite property characteristics (transitive, inverseOf)",
    body: {
      name: "policy-relations-v1",
      description:
        "Declares two relations as nodes with OWL Lite property characteristics. `subsumed_by` is transitive, so `A subsumed_by B subsumed_by C` implies `A subsumed_by C`. `subsumes` is the inverse. Reasoners and the orchestrator's traversal cache use these to close the relation algebraically.",
      world: "closed-with-default",
      nodes: [
        {
          id: "subsumed_by",
          kind: "relation",
          label: "subsumed_by",
          transitive: true,
          asymmetric: true,
          irreflexive: true,
          inverseOf: "subsumes",
        },
        {
          id: "subsumes",
          kind: "relation",
          label: "subsumes",
          transitive: true,
          asymmetric: true,
          irreflexive: true,
          inverseOf: "subsumed_by",
        },
        { id: "any_action", kind: "action", label: "any action" },
        { id: "modify_data", kind: "action", label: "modify data" },
        { id: "redact", kind: "action", label: "redact" },
      ],
      edges: [
        { source: "modify_data", target: "any_action", relationSlug: "subsumed_by" },
        { source: "redact", target: "modify_data", relationSlug: "subsumed_by" },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "vocab/graph-skos-annotated",
    label: "SKOS Core annotations (scopeNote, examples, externalIds)",
    body: {
      name: "data-categories-skos-v1",
      description:
        "Full SKOS Core annotation surface. scopeNote, example, historyNote, editorialNote, notation, externalIds against systems like Wikidata, and a SKOS Collection grouping nodes via member_of.",
      world: "open",
      nodes: [
        {
          id: "personal_data_category",
          kind: "concept",
          label: "personal data category",
          notation: "PDC",
          scopeNote: "Top of the personal-data taxonomy. Use a narrower term when possible.",
        },
        {
          id: "contact_information",
          kind: "concept",
          label: "contact information",
          alternateLabels: ["contact info"],
          hiddenLabels: ["contact-details"],
          example: "Email address, postal address, phone number.",
          editorialNote: "Pending split into electronic vs. physical sub-categories.",
          externalIds: [
            { system: "wikidata", id: "Q1145903", matchType: "exact" },
          ],
          status: "active",
          member_of: ["sensitive_categories"],
        },
        {
          id: "sensitive_categories",
          kind: "collection",
          label: "Sensitive categories (SKOS Collection)",
          historyNote: "Collection introduced 2026-Q2 to group GDPR special-category fields.",
        },
      ],
      edges: [
        {
          source: "contact_information",
          target: "personal_data_category",
          relationSlug: "broader_than",
          confidence: 0.95,
        },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "vocab/graph-vote-stances",
    label: "deliberation vote stances (polar_opposite_of, symmetric)",
    body: {
      name: "vote-stances-v1",
      description:
        "Default vocab for dev.idiolect.deliberationVote.stance. Seeds three-way stances and declares polar_opposite_of as symmetric so equivalence chasing across vocabs can route between agree and disagree consistently.",
      world: "open",
      nodes: [
        {
          id: "polar_opposite_of",
          kind: "relation",
          label: "polar opposite of",
          symmetric: true,
          irreflexive: true,
        },
        { id: "agree", kind: "stance", label: "agree" },
        { id: "pass", kind: "stance", label: "pass / unsure" },
        { id: "disagree", kind: "stance", label: "disagree" },
      ],
      edges: [
        { source: "agree", target: "disagree", relationSlug: "polar_opposite_of" },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
];
