// Fixture lookup helper. The walkthrough seeds an example draft per
// flow by cloning one of these fixtures; tools can also import a
// fixture from the workspace's Import button or the sidebar's
// Templates section.

import { dialectFixtures } from "./dialect";
import { vocabFixtures } from "./vocab";
import { communityFixtures } from "./community";
import { recommendationFixtures } from "./recommendation";
import {
  deliberationFixtures,
  deliberationStatementFixtures,
  deliberationOutcomeFixtures,
} from "./deliberation";
import type { DraftKind } from "../workspace/types";

export interface Fixture {
  name: string;
  label: string;
  body: unknown;
}

export const FIXTURES: Record<DraftKind, Fixture[]> = {
  dialect: dialectFixtures,
  vocab: vocabFixtures,
  community: communityFixtures,
  recommendation: recommendationFixtures,
  deliberation: deliberationFixtures,
  "deliberation-statement": deliberationStatementFixtures,
  "deliberation-outcome": deliberationOutcomeFixtures,
};

/** Look up a fixture by its `name` field within the given kind's set. */
export function findFixture(
  kind: DraftKind,
  name: string,
): Fixture | undefined {
  return FIXTURES[kind]?.find((f) => f.name === name);
}
