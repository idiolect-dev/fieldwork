import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Fieldwork imports Panproto's public glue subpath so Vite owns wasm bundling
// (see `init.ts`). The package's generated declarations and hand-written
// `WasmGlueModule` disagree on one function in 0.74.4, so the initializer keeps
// an isolated cast. This test guards the runtime member contract until those
// upstream declarations converge.

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "../../node_modules/@panproto/core/dist");

/** Member names the installed `WasmGlueModule` interface declares. */
function requiredMembers(): string[] {
  const dts = readFileSync(resolve(pkg, "index.d.ts"), "utf8");
  const start = dts.indexOf("interface WasmGlueModule {");
  expect(start, "WasmGlueModule not found in index.d.ts").toBeGreaterThan(-1);
  const body = dts.slice(start, dts.indexOf("\n}", start));
  return [...body.matchAll(/^\s{4}(\w+)\??:/gm)].map((m) => m[1]);
}

/** Names the wasm-bindgen glue actually exports. */
function glueExports(): Set<string> {
  const js = readFileSync(resolve(pkg, "panproto_wasm.js"), "utf8");
  const names = [...js.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
  // `export { initSync, __wbg_init as default }` — the re-export list.
  for (const block of js.matchAll(/^export \{([^}]*)\}/gm)) {
    for (const part of block[1].split(",")) {
      const alias = part.trim().split(/\s+as\s+/);
      names.push((alias[1] ?? alias[0]).trim());
    }
  }
  return new Set(names.filter(Boolean));
}

describe("published panproto wasm glue", () => {
  it("declares a non-trivial contract", () => {
    // Guards the parser itself: a regex that silently matched nothing
    // would make every assertion below vacuous.
    expect(requiredMembers().length).toBeGreaterThan(20);
    expect(glueExports().size).toBeGreaterThan(20);
  });

  it("exports every member the interface requires", () => {
    const exported = glueExports();
    const missing = requiredMembers().filter((m) => !exported.has(m));
    expect(
      missing,
      `glue is missing ${missing.length} member(s) that WasmGlueModule requires; ` +
        `Panproto.init would read undefined for each at run time`,
    ).toEqual([]);
  });

  it("carries the default export init expects", () => {
    expect(glueExports().has("default")).toBe(true);
  });
});
