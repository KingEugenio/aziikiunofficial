// Minimal IndexedDB wrapper backing the offline-sync engine (see api.ts's
// request() and offlineSync.ts). Two object stores:
//   - response-cache: the last successful body of every GET this browser
//     has made, keyed by API path - lets the app render existing data when
//     opened with no network at all, not just queue writes.
//   - write-queue: mutating requests (POST/PUT/PATCH/DELETE) that failed
//     because the network was genuinely unreachable (not a validation or
//     auth error from the server - see the try/catch split in api.ts),
//     replayed in order once the browser comes back online.
// No new dependency - IndexedDB is a native browser API and the schema
// here is simple enough not to need a wrapper library.

const DB_NAME = "aziiki-offline";
const DB_VERSION = 1;
const CACHE_STORE = "response-cache";
const QUEUE_STORE = "write-queue";

export interface QueuedWrite {
  id: number;
  path: string;
  method: string;
  body: string | undefined;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "path" });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedResponse(path: string): Promise<unknown | undefined> {
  try {
    const row = await withStore<{ path: string; data: unknown } | undefined>(CACHE_STORE, "readonly", (store) => store.get(path));
    return row?.data;
  } catch {
    return undefined;
  }
}

export async function setCachedResponse(path: string, data: unknown): Promise<void> {
  try {
    await withStore(CACHE_STORE, "readwrite", (store) => store.put({ path, data, cachedAt: Date.now() }));
  } catch {
    // Best-effort - a cache write failure should never break the actual request.
  }
}

export async function enqueueWrite(entry: Omit<QueuedWrite, "id" | "createdAt">): Promise<void> {
  await withStore(QUEUE_STORE, "readwrite", (store) => store.add({ ...entry, createdAt: Date.now() }));
}

export async function listQueuedWrites(): Promise<QueuedWrite[]> {
  try {
    return await withStore<QueuedWrite[]>(QUEUE_STORE, "readonly", (store) => store.getAll());
  } catch {
    return [];
  }
}

export async function removeQueuedWrite(id: number): Promise<void> {
  await withStore(QUEUE_STORE, "readwrite", (store) => store.delete(id));
}
