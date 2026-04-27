export const vocabFixtures = [
  {
    name: "vocab/action-three-tier",
    label: "action, three-tier closed-with-default",
    body: {
      name: "training-actions-v1",
      description:
        "Top action subsumes every concrete training action.",
      world: "closed-with-default",
      top: "any_action",
      actions: [
        { id: "any_action", parents: [] },
        { id: "train_model", parents: ["any_action"] },
        { id: "fine_tune", parents: ["train_model"] },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "vocab/action-hierarchy-closed",
    label: "action, strict hierarchy-closed world",
    body: {
      name: "data-actions-v1",
      description:
        "Only declared edges hold. Consumers fall back to string equality for undeclared actions.",
      world: "hierarchy-closed",
      top: "any_action",
      actions: [
        { id: "any_action", parents: [] },
        { id: "read", parents: ["any_action"] },
        { id: "write", parents: ["any_action"] },
        { id: "transform", parents: ["any_action"] },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "vocab/action-broad-tree",
    label: "action, broader hierarchy with 8 entries",
    body: {
      name: "ml-pipeline-actions-v1",
      description:
        "Actions covering ingestion, training, and serving phases of an ML workflow.",
      world: "closed-with-default",
      top: "any_action",
      actions: [
        { id: "any_action", parents: [] },
        { id: "ingest", parents: ["any_action"] },
        { id: "annotate", parents: ["ingest"] },
        { id: "preprocess", parents: ["ingest"] },
        { id: "train", parents: ["any_action"] },
        { id: "evaluate", parents: ["train"] },
        { id: "serve", parents: ["any_action"] },
        { id: "log", parents: ["serve"] },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "vocab/purpose-open",
    label: "purpose, open-world (two example entries)",
    body: {
      name: "purposes-open",
      world: "open",
      top: "any_purpose",
      actions: [
        { id: "any_purpose", parents: [] },
        { id: "academic", parents: ["any_purpose"] },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
  {
    name: "vocab/purpose-with-classes",
    label: "purpose, entries tagged with attitudinal class",
    body: {
      name: "research-purposes-v1",
      description:
        "Purposes for research-data use, with each entry pinned to an attitudinal composition class.",
      world: "closed-with-default",
      top: "any_purpose",
      actions: [
        { id: "any_purpose", parents: [] },
        {
          id: "academic_publication",
          parents: ["any_purpose"],
          class: "dev.idiolect.asserted_use",
        },
        {
          id: "internal_review",
          parents: ["any_purpose"],
          class: "dev.idiolect.intended_use",
        },
        {
          id: "third_party_audit",
          parents: ["any_purpose"],
          class: "dev.idiolect.permitted_use",
        },
      ],
      occurredAt: "2026-04-26T00:00:00Z",
    },
  },
];
