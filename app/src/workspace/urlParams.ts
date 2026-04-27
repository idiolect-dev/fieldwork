// One-shot URL-param ingestion for community-branded fieldwork
// instances.
//
// A community that wants to host their own fieldwork; at e.g.
// `research-corp.dev/fieldwork/?community=at://...&appview=...`; can
// preload the workspace via query params. Communities that fork the
// repo for a custom domain don't need any code change; the params
// flow into `useWorkspaceStore` on first paint and persist into
// localStorage from there.
//
// Recognised params:
//
//   ?appview=<url>         ; override the default AppView base URL
//   ?community=<at-uri>    ; auto-import the community record
//   ?did=<did:plc:...>     ; pre-fill the publishing DID
//   ?tool=<dialect|vocab|…>; open the named tool on first paint
//
// Params are read once on boot, applied to the store, and cleared
// from the address bar (history.replaceState) so a refresh doesn't
// re-trigger import. The persisted workspace state takes precedence
// for everything except `tool` (which is per-page state, not a
// draft).

import { useWorkspaceStore } from "./store";
import type { ToolKey } from "./store";
import { resolveAtUri } from "../import/atUri";
import { wasm } from "../wasm/loader";
import { mintDraftId } from "./ids";
import type { Draft } from "./types";

const VALID_TOOLS: ToolKey[] = [
  "dialect",
  "vocab",
  "lexicon",
  "community",
  "recommendation",
];

/**
 * Read query params, apply to the workspace, and clear them from
 * the address bar. Idempotent: a no-op when the URL has no
 * fieldwork params.
 *
 * Returns a promise that resolves once any auto-import has
 * completed (so the caller can show a spinner over the boot).
 */
export async function ingestUrlParams(): Promise<void> {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const params = url.searchParams;

  const appview = params.get("appview");
  const did = params.get("did");
  const community = params.get("community");
  const tool = params.get("tool") as ToolKey | null;

  let touched = false;
  const store = useWorkspaceStore.getState();

  if (appview) {
    store.setAppView({ baseUrl: appview });
    touched = true;
  }
  if (did) {
    store.setPublishingDid(did);
    touched = true;
  }
  if (tool && VALID_TOOLS.includes(tool)) {
    store.setTool(tool);
    touched = true;
  }
  if (community) {
    try {
      const body = await resolveAtUri(
        community,
        appview ?? store.appView.baseUrl,
      );
      const id = mintDraftId("community");
      const draft = wasm().importRecord(
        "community",
        body,
        id,
        deriveLabel(body) ?? community,
      ) as Draft;
      store.importDraft(draft);
      store.setActive("community", id);
      touched = true;
    } catch (e) {
      // Surface in the console; don't block boot. The user can
      // re-trigger from the Import button.
      // eslint-disable-next-line no-console
      console.warn("URL-param community import failed:", e);
    }
  }

  if (touched) {
    // Clear the params so a refresh doesn't re-trigger.
    url.searchParams.delete("appview");
    url.searchParams.delete("did");
    url.searchParams.delete("community");
    url.searchParams.delete("tool");
    history.replaceState(null, "", url.toString());
  }
}

function deriveLabel(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const v = obj["name"];
  return typeof v === "string" && v.length > 0 ? v : null;
}
