// Persistent violation evidence storage (IndexedDB)
export interface ViolationRecord {
  id: string;
  type: string;
  createdAt: number; // epoch ms
  speed?: number;
  objects?: string;
  confidence?: number;
  lat?: number | null;
  lng?: number | null;
  blob: Blob;
}

const DB_NAME = 'aegis_violations';
const STORE = 'violations';
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (!('indexedDB' in window)) {
        console.warn('IndexedDB not supported');
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.error('IndexedDB open error:', req.error);
        resolve(null);
      };
    } catch (e) {
      console.error('IndexedDB init error:', e);
      resolve(null);
    }
  });
  return dbPromise;
}

export async function saveViolation(record: ViolationRecord): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.error('saveViolation error:', tx.error);
        resolve(false);
      };
    } catch (e) {
      console.error('saveViolation error:', e);
      resolve(false);
    }
  });
}

export async function getAllViolations(): Promise<ViolationRecord[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result as ViolationRecord[]);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteViolation(id: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function clearViolations(): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
