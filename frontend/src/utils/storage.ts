// ============================================================================
// MediKiosk — Bulletproof Safe LocalStorage & JSON Utilities
// Prevents any "undefined is not valid JSON" or corrupted storage crashes.
// ============================================================================

export function safeJsonParse<T = any>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') {
    return fallback;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function safeGetItem<T = any>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw || raw === 'undefined' || raw === 'null') {
      return fallback;
    }
    return safeJsonParse<T>(raw, fallback);
  } catch {
    return fallback;
  }
}

export function safeSetItem(key: string, value: any): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (value === undefined || value === null) {
      window.localStorage.removeItem(key);
      return;
    }
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (str === 'undefined' || str === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, str);
  } catch (e) {
    console.warn(`Failed to set localStorage key "${key}":`, e);
  }
}

export function cleanCorruptStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) {
        const val = window.localStorage.getItem(k);
        if (val === 'undefined' || val === 'null' || val === '[object Object]') {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
}
