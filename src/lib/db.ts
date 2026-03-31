import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'GoldCalcDB';
const STORE_NAME = 'calculations';
const DB_VERSION = 1;

export interface LocalCalculation {
  id: string;
  customerName: string;
  ornamentName: string;
  weight: number;
  purity: number;
  goldPrice: number;
  makingChargeType: 'fixed' | 'percent';
  makingChargeValue: number;
  wastagePercent: number;
  kdmCharges: number;
  goldPriceAmt: number;
  makingChargesAmt: number;
  wastagePrice: number;
  gstAmt: number;
  totalPrice: number;
  effectiveRate: number;
  createdAt: number; // Store as timestamp for local
  synced: boolean;
}

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
        store.createIndex('synced', 'synced');
      }
    },
  });
}

export async function saveLocalCalculation(calc: LocalCalculation) {
  const db = await initDB();
  await db.put(STORE_NAME, calc);
}

export async function getLocalCalculations(): Promise<LocalCalculation[]> {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME, 'createdAt');
}

export async function deleteLocalCalculation(id: string) {
  const db = await initDB();
  await db.delete(STORE_NAME, id);
}

export async function getUnsyncedCalculations(): Promise<LocalCalculation[]> {
  const db = await initDB();
  return db.getAllFromIndex(STORE_NAME, 'synced', 0); // 0 for false
}

export async function markAsSynced(id: string) {
  const db = await initDB();
  const calc = await db.get(STORE_NAME, id);
  if (calc) {
    calc.synced = true;
    await db.put(STORE_NAME, calc);
  }
}
