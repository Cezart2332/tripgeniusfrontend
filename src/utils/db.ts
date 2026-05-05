export interface CachedRoute {
  id: string; // "startLat,startLng-endLat,endLng"
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  routeData: any;
  timestamp: number;
}

const DB_NAME = 'NavigationDB';
const STORE_NAME = 'routes';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

export async function saveRouteToIndexedDB(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  routeData: any
): Promise<void> {
  const db = await openDB();
  const id = `${start.lat},${start.lng}-${end.lat},${end.lng}`;
  const route: CachedRoute = {
    id,
    start,
    end,
    routeData,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(route);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function getNearestCachedRoute(endLat: number, endLng: number): Promise<CachedRoute | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const routes: CachedRoute[] = request.result;
      const nearbyRoutes = routes
        .filter((r) => haversine(endLat, endLng, r.end.lat, r.end.lng) <= 0.5)
        .sort((a, b) => b.timestamp - a.timestamp);

      resolve(nearbyRoutes.length > 0 ? nearbyRoutes[0] : null);
    };
  });
}

export async function getAllRoutes(): Promise<CachedRoute[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const request = index.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const routes = request.result as CachedRoute[];
      resolve(routes.reverse()); // index is ascending, so we reverse for descending
    };
  });
}
