import { describe, expect, it } from "vitest";
import { buildPortableBundle } from "./export";
import { defaultCommunityWorkspace } from "./store";

describe("portable community bundle", () => {
  it("includes a deterministic inventory of every lifecycle object", () => {
    const workspace = {
      ...defaultCommunityWorkspace,
      proposals: [{ id: "c1" }] as typeof defaultCommunityWorkspace.proposals,
      releases: [{ id: "r1" }] as typeof defaultCommunityWorkspace.releases,
      migrations: [{ id: "m1" }] as typeof defaultCommunityWorkspace.migrations,
      federation: [{ id: "f1" }] as typeof defaultCommunityWorkspace.federation,
    };
    const bundle = buildPortableBundle(workspace, new Date("2026-09-18T12:00:00Z"));
    expect(bundle.format).toBe("dev.idiolect.community-workspace");
    expect(bundle.exportedAt).toBe("2026-09-18T12:00:00.000Z");
    expect(bundle.inventory.map((item) => item.path)).toEqual([
      "changes/c1.json",
      "releases/r1.json",
      "migrations/m1.json",
      "federation/f1.json",
    ]);
  });
});
