// Simple persistent local DB using IndexedDB for organizations, members, and roles
// This is a minimal wrapper for demo purposes

export interface Member {
  id: string;
  name: string;
  age: number;
  role: 'admin' | 'member';
  connectionInfo: any;
}

export interface Organization {
  id: string;
  name: string;
  members: Member[];
}

const DB_NAME = 'GeoTrackDB';
const DB_VERSION = 1;
const ORG_STORE = 'organizations';

function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ORG_STORE)) {
        db.createObjectStore(ORG_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addOrganization(org: Organization) {
  const db = await getDb();
  const tx = db.transaction(ORG_STORE, 'readwrite');
  tx.objectStore(ORG_STORE).put(org);
  return tx.complete;
}

export async function getOrganizations(): Promise<Organization[]> {
  const db = await getDb();
  const tx = db.transaction(ORG_STORE, 'readonly');
  const store = tx.objectStore(ORG_STORE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateOrganization(org: Organization) {
  return addOrganization(org);
}

export async function deleteOrganization(id: string) {
  const db = await getDb();
  const tx = db.transaction(ORG_STORE, 'readwrite');
  tx.objectStore(ORG_STORE).delete(id);
  return tx.complete;
}

export async function addMemberToOrganization(orgId: string, member: Member) {
  const db = await getDb();
  const tx = db.transaction(ORG_STORE, 'readwrite');
  const store = tx.objectStore(ORG_STORE);
  const req = store.get(orgId);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const org = req.result;
      if (!org) return reject('Organization not found');
      org.members = org.members || [];
      org.members.push(member);
      store.put(org);
      resolve(true);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getOrganization(id: string): Promise<Organization | undefined> {
  const db = await getDb();
  const tx = db.transaction(ORG_STORE, 'readonly');
  const store = tx.objectStore(ORG_STORE);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
