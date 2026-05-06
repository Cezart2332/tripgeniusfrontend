const DB_NAME = 'places-cache';
const STORE_NAME = 'places';
const DB_VERSION = 1;

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
          const oneHour = 1000 * 60 * 60;
          if (Date.now() - result.cachedAt < oneHour) {
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
