// offlineProfile.ts
// Minimal offline emergency profile cache for the PWA.
//
// PRIVACY: stores ONLY the minimum necessary identity/contact data for the
// offline emergency screen (name, email, optionally age, and explicit emergency
// contacts). NEVER used for medical records, Health Pack, passwords, or JWTs
// (the JWT stays in the existing auth storage and is not duplicated here).
//
// TRUTHFULNESS: contacts are only ever cached from REAL data the app actually
// has (passed explicitly by callers). This module never fabricates anything.
// The app currently has no live emergency-contacts source, so in practice the
// cache typically holds name/email only; tap-to-call contact actions render
// only when real contact entries exist in the cache.

export interface OfflineEmergencyContact {
  name: string;
  phone: string;
  relation?: string;
}

export interface OfflineProfile {
  name?: string;
  email?: string;
  age?: number;
  emergencyContacts: OfflineEmergencyContact[];
  updatedAt?: string;
}

const STORAGE_KEY = "caresetu_offline_profile";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode / quota). The cached profile is a
    // best-effort enhancement only — the queue in IndexedDB is the source of
    // truth for synced SOS payloads.
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getOfflineProfile(): OfflineProfile | null {
  const raw = safeGet(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.emergencyContacts)
      ? parsed
      : { ...parsed, emergencyContacts: [] };
  } catch {
    return null;
  }
}

/** Cache a partial profile (e.g. after login: name + email from the auth user). */
export function cacheOfflineProfile(patch: {
  name?: string;
  email?: string;
  age?: number;
  emergencyContacts?: OfflineEmergencyContact[];
}): void {
  const current = getOfflineProfile() ?? { emergencyContacts: [] };
  const merged: OfflineProfile = {
    ...current,
    ...patch,
    emergencyContacts: patch.emergencyContacts || current.emergencyContacts || [],
  };
  merged.updatedAt = new Date().toISOString();
  const clean: OfflineProfile = {
    name: merged.name,
    email: merged.email,
    age: typeof merged.age === "number" ? merged.age : undefined,
    emergencyContacts: (merged.emergencyContacts || []).filter(
      (c) => c && typeof c.name === "string" && typeof c.phone === "string" && c.phone.length > 0
    ),
    updatedAt: merged.updatedAt,
  };
  safeSet(STORAGE_KEY, JSON.stringify(clean));
}

/** Cache real emergency contacts when the app has them (tap-to-call offline). */
export function cacheEmergencyContacts(contacts: OfflineEmergencyContact[]): void {
  const current = getOfflineProfile() ?? { emergencyContacts: [] };
  cacheOfflineProfile({ ...current, emergencyContacts: contacts });
}

export function clearOfflineProfile(): void {
  safeRemove(STORAGE_KEY);
}