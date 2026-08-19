import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ATPROTO_BASE_SCOPE, REPO_SCOPES, getScopesForIntent } from "./scopes";

const LENS_WRITE_SCOPE = "repo:dev.panproto.schema.lens";

// The static `oauth/client-metadata.json` is what the auth server
// reads in production to validate every requested scope. It has to
// list a superset of every scope fieldwork might ask for, otherwise
// the auth server returns `invalid_scope`. The dev-mode loopback
// `client_id` is synthesised from `REPO_SCOPES` directly, so dev
// silently picks up additions to that map; prod doesn't. This test
// asserts the static file stays in lockstep so the next time
// somebody adds a scope to `REPO_SCOPES`, CI catches the drift.
describe("oauth client-metadata.json parity with REPO_SCOPES", () => {
  it("declares every scope fieldwork might request", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const metadataPath = resolve(
      here,
      "../../public/oauth/client-metadata.json",
    );
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
      scope: string;
    };
    const declared = new Set(metadata.scope.split(/\s+/));
    expect(declared.has(ATPROTO_BASE_SCOPE)).toBe(true);
    for (const scope of Object.values(REPO_SCOPES)) {
      expect(declared, `missing ${scope} in client-metadata.json`).toContain(
        scope,
      );
    }
  });
});

// fieldwork stopped publishing lenses when protolab 0.8.0 took over
// authoring *and* publishing them; this page only reads. Listing public
// records needs no grant, so the write scope would be surplus — and a
// surplus write scope is exactly what granular OAuth exists to avoid.
// Locked down here because the natural way to regress it is for somebody
// to re-add a lens upload without noticing the scope came back with it.
describe("lens write scope is not requested", () => {
  it("is absent from every intent", () => {
    for (const intent of ["read-only", "curator", "full"] as const) {
      expect(getScopesForIntent(intent)).not.toContain(LENS_WRITE_SCOPE);
    }
  });

  it("is absent from REPO_SCOPES", () => {
    expect(Object.values(REPO_SCOPES)).not.toContain(LENS_WRITE_SCOPE);
  });

  it("is absent from client-metadata.json", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const metadata = JSON.parse(
      readFileSync(resolve(here, "../../public/oauth/client-metadata.json"), "utf8"),
    ) as { scope: string };
    expect(metadata.scope.split(/\s+/)).not.toContain(LENS_WRITE_SCOPE);
  });
});
