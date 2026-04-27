// Module-level cache for bsky actor profiles, keyed by DID.
//
// Used by anything that needs to render a DID as a human-readable
// (avatar, handle, displayName) card; first call hits the public
// AppView once, subsequent calls hit the cache.

import { useEffect, useState } from "react";

export interface ActorProfile {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

const CACHE = new Map<string, ActorProfile>();
const PENDING = new Map<string, Promise<ActorProfile>>();

async function fetchProfile(did: string): Promise<ActorProfile> {
  if (CACHE.has(did)) return CACHE.get(did)!;
  if (PENDING.has(did)) return PENDING.get(did)!;
  const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`;
  const promise = fetch(url)
    .then(async (r) => {
      if (!r.ok) return { did };
      const data: {
        did?: string;
        handle?: string;
        displayName?: string;
        avatar?: string;
      } = await r.json();
      return {
        did: data.did ?? did,
        handle: data.handle,
        displayName: data.displayName,
        avatar: data.avatar,
      } as ActorProfile;
    })
    .catch(() => ({ did }) as ActorProfile)
    .then((profile) => {
      CACHE.set(did, profile);
      PENDING.delete(did);
      return profile;
    });
  PENDING.set(did, promise);
  return promise;
}

/**
 * Seed the cache with a profile we already have (e.g. a session's
 * own avatar + handle, freshly resolved typeahead actors). Avoids a
 * round-trip when the calling component already knows the answer.
 */
export function seedActorProfile(profile: ActorProfile): void {
  CACHE.set(profile.did, profile);
}

export function useActorProfile(did: string | null | undefined): ActorProfile | null {
  const [profile, setProfile] = useState<ActorProfile | null>(
    did ? (CACHE.get(did) ?? null) : null,
  );
  useEffect(() => {
    if (!did) {
      setProfile(null);
      return;
    }
    if (CACHE.has(did)) {
      setProfile(CACHE.get(did) ?? null);
      return;
    }
    let cancelled = false;
    void fetchProfile(did).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [did]);
  return profile;
}
