// Mint short, sortable, opaque ids for new drafts. The `<kind>-` prefix
// makes the workspace sidebar readable; the random tail is base32 of
// 5 random bytes (≈40 bits, plenty for an in-memory workspace).

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export function mintDraftId(kind: string): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  let acc = 0n;
  for (const b of bytes) acc = (acc << 8n) | BigInt(b);
  let tail = "";
  for (let i = 0; i < 8; i++) {
    tail = ALPHABET[Number(acc & 31n)] + tail;
    acc >>= 5n;
  }
  return `${kind}-${tail}`;
}
