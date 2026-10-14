import PocketBase, { BaseAuthStore, isTokenExpired } from 'pocketbase';

const PB_URL = 'https://pb.xenreality.com';
const CACHE_PREFIX = 'xr_sso_';

// Best-effort SSO for cards that link to a separately-hosted dashboard
// authenticating against its own PocketBase collection (not xr_employees),
// e.g. Rnb/Chumbak/Livspace/Carrefour all use "bata_users" with the same
// credentials as the launcher login. Called right after a successful
// xr_employees login, with the same identity/password the person just typed
// (never stored, used once here and discarded).
//
// Uses its own in-memory-only auth store (BaseAuthStore, no localStorage) so
// this never touches or is touched by the main xr_employees session in
// src/pb.js — pb is a shared singleton and authenticating against a second
// collection on it would overwrite that session.
export async function trySilentLogin(collection, identity, password) {
  try {
    const client = new PocketBase(PB_URL, new BaseAuthStore());
    const { token } = await client.collection(collection).authWithPassword(identity, password);
    sessionStorage.setItem(CACHE_PREFIX + collection, token);
  } catch {
    // No matching account in that collection for this person (or it's down) —
    // the linked site just falls back to showing its own login, same as today.
  }
}

// Returns a still-valid cached token for `collection`, or null. Token is only
// ever used within seconds of being minted (the far side calls authRefresh()
// immediately on load), so the sessionStorage cache mainly exists so a reload
// of the launcher in the same tab doesn't need to re-run trySilentLogin.
export function getCachedSsoToken(collection) {
  try {
    const token = sessionStorage.getItem(CACHE_PREFIX + collection);
    if (!token || isTokenExpired(token)) return null;
    return token;
  } catch {
    return null;
  }
}
