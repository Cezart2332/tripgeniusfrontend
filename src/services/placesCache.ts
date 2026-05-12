const DB_NAME = 'places-cache';
const STORE_NAME = 'places';
const DB_VERSION = 1;

const TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days — attractions don't change often

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'bbox' });
      }
    };
  });
}

/**
 * Returns cached places for a bounding box.
 * - Online: respects the 7-day TTL.
 * - Offline: returns any cached data regardless of age (stale-while-offline).
 */
export async function getCached(bboxKey: string): Promise<any | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bboxKey);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const isStale = Date.now() - result.cachedAt > TTL_MS;
          // Serve stale data when offline so the map still shows attractions
          if (!isStale || !navigator.onLine) {
            resolve(result.data);
            return;
          }
        }
        resolve(null);
      };
    });
  } catch (error) {
    console.error('IndexedDB get error:', error);
    return null;
  }
}

export async function setCache(bboxKey: string, data: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ bbox: bboxKey, data, cachedAt: Date.now() });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('IndexedDB set error:', error);
  }
}
