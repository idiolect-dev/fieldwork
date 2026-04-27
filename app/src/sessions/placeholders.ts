// User-aware placeholder strings for editor inputs.
//
// When the user is signed in, swap their DID into example at-uri /
// DID placeholders so what they see lines up with what they'd
// actually type. Falls back to a generic literal otherwise.

import { useSessionsStore } from "./store";

export function useActiveDid(): string | null {
  const sessions = useSessionsStore((s) => s.sessions);
  const activeDid = useSessionsStore((s) => s.activeDid);
  if (!activeDid) return null;
  return sessions[activeDid]?.did ?? null;
}

/** `did:plc:...` substitute for a hardcoded `did:plc:...` literal. */
export function userDidOrLiteral(): string {
  const did = useActiveDid();
  return did ?? "did:plc:...";
}

/**
 * Substitute the active DID into an at-uri placeholder of the form
 * `at://did:plc:.../<rest>`. Returns the input unchanged when no
 * session is active.
 */
export function useAtUriPlaceholder(template: string): string {
  const did = useActiveDid();
  if (!did) return template;
  return template.replace("did:plc:...", did);
}
