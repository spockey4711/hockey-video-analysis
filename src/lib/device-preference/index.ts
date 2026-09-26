/**
 * A per-device preference kept in `localStorage`: one of a fixed set of string
 * values, with a fallback for when nothing (or nothing valid) is stored. Used
 * for the display choices that belong to a screen rather than to an account -
 * the theme and the presentation text size - so they need no database.
 *
 * Each preference is a minimal external store for `useSyncExternalStore`:
 * {@link DevicePreference.read} is the snapshot, a {@link DevicePreference.write}
 * in this tab notifies subscribers synchronously, and a write in another tab of
 * the same browser arrives through the `storage` event. Storing the fallback
 * removes the key, so the default is the absence of a choice. Storage can be
 * missing (server render) or blocked (private mode); reads then give the
 * fallback and writes still reach this tab's subscribers.
 */

export interface DevicePreference<T extends string> {
  /** The `localStorage` key; list every one on the Datenschutz page. */
  readonly key: string;
  /** The value that stands for "no choice made". */
  readonly fallback: T;
  /** The stored choice, or the fallback. Safe to call on the server. */
  read(): T;
  /** Store a choice and tell this tab's subscribers. */
  write(value: T): void;
  /** Listen for changes from this tab or another; returns the unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

export interface DevicePreferenceOptions<T extends string> {
  readonly key: string;
  readonly values: readonly T[];
  readonly fallback: T;
}

/** Create the store for one per-device preference. */
export function createDevicePreference<T extends string>({
  key,
  values,
  fallback,
}: DevicePreferenceOptions<T>): DevicePreference<T> {
  const listeners = new Set<() => void>();
  // The last value written in this tab, so the choice holds for the page even
  // when storage is blocked and the write never lands.
  let unsaved: T | undefined;

  function isValue(value: unknown): value is T {
    return (
      typeof value === "string" && (values as readonly string[]).includes(value)
    );
  }

  function read(): T {
    if (unsaved !== undefined) return unsaved;
    try {
      const stored = window.localStorage.getItem(key);
      return isValue(stored) ? stored : fallback;
    } catch {
      /* No window (server render) or blocked storage. */
      return fallback;
    }
  }

  function write(value: T): void {
    unsaved = undefined;
    try {
      if (value === fallback) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      unsaved = value;
    }
    listeners.forEach((listener) => listener());
  }

  function onStorage(event: StorageEvent): void {
    // `key` is null when another tab cleared the whole storage.
    if (event.key !== null && event.key !== key) return;
    unsaved = undefined;
    listeners.forEach((listener) => listener());
  }

  function subscribe(onChange: () => void): () => void {
    if (listeners.size === 0) window.addEventListener("storage", onStorage);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) {
        window.removeEventListener("storage", onStorage);
      }
    };
  }

  return { key, fallback, read, write, subscribe };
}
