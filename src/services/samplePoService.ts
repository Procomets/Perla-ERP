import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SamplePoInward, SamplePoItem } from '../types/samplePo';

export const SAMPLE_PO_COLLECTION = 'sample_po_inwards';
export const SAMPLE_COUNTERS_COLLECTION = 'sample_counters';
export const SAMPLE_PO_CACHE_KEY = 'perla_sample_po_inwards_cache_v1';
export const SAMPLE_PO_EVENT = 'perla_sample_po_updated';

/**
 * Safely parse Firestore timestamp or string to ISO string
 */
export function parseFirestoreTimestamp(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val?.toDate === 'function') {
    try {
      return val.toDate().toISOString();
    } catch {}
  }
  if (typeof val === 'object' && val !== null) {
    const sec = typeof val.seconds === 'number'
      ? val.seconds
      : (typeof val._seconds === 'number'
        ? val._seconds
        : (val.seconds ? Number(val.seconds) : null));
    if (sec !== null && !isNaN(sec)) {
      return new Date(sec * 1000).toISOString();
    }
  }
  if (typeof val === 'string') {
    return val;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return String(val);
}

/**
 * Live schema sample document reflecting exact Firestore record provided by user
 */
export const INITIAL_DEMO_SAMPLE_PO: SamplePoInward = {
  id: 'v890V4597nSEnPqoZMAs',
  entryNumber: 'SMP-INW-2026-0005',
  customerDcNumber: '504',
  customerDcDate: '2026-11-22',
  dispatchStatus: 'pending',
  isManualVendor: false,
  status: 'active',
  totalQuantity: 144,
  totalDispatchedQuantity: 0,
  vendorId: 'ivqeteuSprtIiTfU1i6Z',
  vendorName: 'A.I.ENTERPRISES PVT LTD (KATTUPAKKAM)',
  vendorAddress: '',
  vendorGst: '',
  remarks: 'good',
  items: [
    {
      id: '[#2ba25]',
      itemName: 'plain clothes',
      styleNo: 'DRS 02',
      washType: 'Optical White Wash',
      quantity: 68,
      unit: 'PCS',
      customerDcNumber: '504',
      customerDcDate: '2026-11-22',
      dispatchedQuantity: 0
    },
    {
      id: '[#43f7d]',
      itemName: 'pink wear',
      styleNo: 'DRS 10',
      washType: 'Normal Wash',
      quantity: 76,
      unit: 'PCS',
      customerDcNumber: '202',
      customerDcDate: '2026-11-22',
      dispatchedQuantity: 0
    }
  ],
  createdAt: '2026-11-22T06:22:51.000Z',
  createdBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
  createdByName: 'Pranav',
  updatedAt: '2026-11-22T06:25:54.000Z',
  updatedBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
  updatedByName: 'Pranav'
};

export class SamplePoService {
  /**
   * Synchronously retrieve cache from localStorage
   */
  static getCache(): SamplePoInward[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(SAMPLE_PO_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read Sample PO cache:', e);
    }
    return [INITIAL_DEMO_SAMPLE_PO];
  }

  /**
   * Save cache to localStorage and dispatch event
   */
  static setCache(data: SamplePoInward[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(SAMPLE_PO_CACHE_KEY, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent(SAMPLE_PO_EVENT, { detail: data }));
      }
    } catch (e) {
      console.warn('Failed to write Sample PO cache:', e);
    }
  }

  /**
   * Generates next atomic Entry Number in format: SMP-INW-YYYY-XXXX (e.g. SMP-INW-2026-0006)
   */
  static async generateNextEntryNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counterDocId = `smp_inw_${year}`;
    const counterRef = doc(db, SAMPLE_COUNTERS_COLLECTION, counterDocId);

    try {
      let nextSeq = 1;

      // 1. Transactional atomic sequence from sample_counters
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(counterRef);
        if (snap.exists()) {
          const currentSeq = Number(snap.data()?.currentSeq || 0);
          nextSeq = currentSeq + 1;
          txn.update(counterRef, { currentSeq: nextSeq, updatedAt: serverTimestamp() });
        } else {
          // Inspect current highest entry in sample_po_inwards collection
          nextSeq = 1;
          txn.set(counterRef, { currentSeq: nextSeq, year, createdAt: serverTimestamp() });
        }
      });

      // 2. Cross-check against existing items in cache/collection to avoid collision
      const cached = this.getCache();
      const existingSeqs = cached
        .filter((c) => c.entryNumber && c.entryNumber.startsWith(`SMP-INW-${year}-`))
        .map((c) => {
          const match = c.entryNumber.match(/SMP-INW-\d+-(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        });

      const maxExisting = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;
      if (nextSeq <= maxExisting) {
        nextSeq = maxExisting + 1;
        // Bump the counter doc to reflect max
        try {
          await setDoc(counterRef, { currentSeq: nextSeq, year, updatedAt: serverTimestamp() }, { merge: true });
        } catch {}
      }

      return `SMP-INW-${year}-${String(nextSeq).padStart(4, '0')}`;
    } catch (err) {
      console.warn('Failed atomic sequence generation in sample_counters, using local fallback:', err);
      const cached = this.getCache();
      const existingSeqs = cached
        .filter((c) => c.entryNumber && c.entryNumber.startsWith(`SMP-INW-${year}-`))
        .map((c) => {
          const match = c.entryNumber.match(/SMP-INW-\d+-(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        });
      const nextSeq = (existingSeqs.length > 0 ? Math.max(...existingSeqs) : 5) + 1;
      return `SMP-INW-${year}-${String(nextSeq).padStart(4, '0')}`;
    }
  }

  /**
   * Subscribe to real-time updates from Firestore
   */
  static subscribeSamplePos(
    callback: (data: SamplePoInward[]) => void,
    onError?: (err: any) => void
  ): () => void {
    // Deliver cached data right away
    callback(this.getCache());

    // Listen to local window events
    const handleLocalEvent = (e: any) => {
      if (e?.detail) {
        callback(e.detail as SamplePoInward[]);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(SAMPLE_PO_EVENT, handleLocalEvent);
    }

    // Query Firestore sample_po_inwards
    const q = query(collection(db, SAMPLE_PO_COLLECTION));
    const unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const records: SamplePoInward[] = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          const items: SamplePoItem[] = Array.isArray(raw.items)
            ? raw.items.map((it: any, idx: number) => ({
                id: it.id || `[#${Math.random().toString(16).substring(2, 7)}]`,
                itemName: it.itemName || 'Garment Item',
                styleNo: it.styleNo || `ST-${idx + 1}`,
                washType: it.washType || 'Standard Wash',
                quantity: Number(it.quantity || 0),
                unit: it.unit || 'PCS',
                customerDcNumber: it.customerDcNumber || raw.customerDcNumber || '-',
                customerDcDate: it.customerDcDate || raw.customerDcDate || '-',
                dispatchedQuantity: Number(it.dispatchedQuantity || 0)
              }))
            : [];

          const totalQuantity = typeof raw.totalQuantity === 'number'
            ? raw.totalQuantity
            : items.reduce((sum, it) => sum + it.quantity, 0);

          const totalDispatchedQuantity = typeof raw.totalDispatchedQuantity === 'number'
            ? raw.totalDispatchedQuantity
            : items.reduce((sum, it) => sum + (it.dispatchedQuantity || 0), 0);

          return {
            id: docSnap.id,
            entryNumber: raw.entryNumber || `SMP-INW-${docSnap.id.substring(0, 6)}`,
            customerDcNumber: raw.customerDcNumber || '-',
            customerDcDate: raw.customerDcDate || '-',
            vendorId: raw.vendorId || '',
            vendorName: raw.vendorName || 'Unnamed Vendor',
            vendorAddress: raw.vendorAddress || '',
            vendorGst: raw.vendorGst || '',
            isManualVendor: Boolean(raw.isManualVendor),
            dispatchStatus: raw.dispatchStatus || 'pending',
            status: raw.status || 'active',
            items,
            totalQuantity,
            totalDispatchedQuantity,
            remarks: raw.remarks || '',
            createdAt: parseFirestoreTimestamp(raw.createdAt),
            createdBy: raw.createdBy || '',
            createdByName: raw.createdByName || '',
            updatedAt: parseFirestoreTimestamp(raw.updatedAt),
            updatedBy: raw.updatedBy || '',
            updatedByName: raw.updatedByName || ''
          };
        });

        // Sort descending by entryNumber or createdAt
        records.sort((a, b) => (b.entryNumber || '').localeCompare(a.entryNumber || ''));

        this.setCache(records);
        callback(records);
      },
      (err) => {
        console.warn('Real-time subscription error for sample_po_inwards:', err);
        onError?.(err);
      }
    );

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SAMPLE_PO_EVENT, handleLocalEvent);
      }
      unsubscribeFirestore();
    };
  }

  /**
   * Fetch all records directly from Firestore or cache fallback
   */
  static async getSamplePos(isDemo: boolean = false): Promise<SamplePoInward[]> {
    if (isDemo) return this.getCache();

    try {
      const snap = await getDocs(collection(db, SAMPLE_PO_COLLECTION));
      if (!snap.empty) {
        const records: SamplePoInward[] = snap.docs.map((docSnap) => {
          const raw = docSnap.data();
          const items: SamplePoItem[] = Array.isArray(raw.items)
            ? raw.items.map((it: any, idx: number) => ({
                id: it.id || `[#${Math.random().toString(16).substring(2, 7)}]`,
                itemName: it.itemName || 'Garment Item',
                styleNo: it.styleNo || `ST-${idx + 1}`,
                washType: it.washType || 'Standard Wash',
                quantity: Number(it.quantity || 0),
                unit: it.unit || 'PCS',
                customerDcNumber: it.customerDcNumber || raw.customerDcNumber || '-',
                customerDcDate: it.customerDcDate || raw.customerDcDate || '-',
                dispatchedQuantity: Number(it.dispatchedQuantity || 0)
              }))
            : [];

          return {
            id: docSnap.id,
            entryNumber: raw.entryNumber || `SMP-INW-${docSnap.id.substring(0, 6)}`,
            customerDcNumber: raw.customerDcNumber || '-',
            customerDcDate: raw.customerDcDate || '-',
            vendorId: raw.vendorId || '',
            vendorName: raw.vendorName || 'Unnamed Vendor',
            vendorAddress: raw.vendorAddress || '',
            vendorGst: raw.vendorGst || '',
            isManualVendor: Boolean(raw.isManualVendor),
            dispatchStatus: raw.dispatchStatus || 'pending',
            status: raw.status || 'active',
            items,
            totalQuantity: typeof raw.totalQuantity === 'number' ? raw.totalQuantity : items.reduce((s, i) => s + i.quantity, 0),
            totalDispatchedQuantity: typeof raw.totalDispatchedQuantity === 'number' ? raw.totalDispatchedQuantity : 0,
            remarks: raw.remarks || '',
            createdAt: parseFirestoreTimestamp(raw.createdAt),
            createdBy: raw.createdBy || '',
            createdByName: raw.createdByName || '',
            updatedAt: parseFirestoreTimestamp(raw.updatedAt),
            updatedBy: raw.updatedBy || '',
            updatedByName: raw.updatedByName || ''
          };
        });
        records.sort((a, b) => (b.entryNumber || '').localeCompare(a.entryNumber || ''));
        this.setCache(records);
        return records;
      }
    } catch (e) {
      console.warn('Failed to fetch from Firestore sample_po_inwards, using cache:', e);
    }
    return this.getCache();
  }

  /**
   * Create a new Sample PO record
   */
  static async createSamplePo(
    payload: Omit<SamplePoInward, 'id' | 'createdAt' | 'updatedAt' | 'totalQuantity' | 'totalDispatchedQuantity'> & {
      items: SamplePoItem[];
    },
    user: { uid: string; displayName?: string; email?: string },
    isDemo: boolean = false
  ): Promise<SamplePoInward> {
    const entryNumber = payload.entryNumber && payload.entryNumber.trim()
      ? payload.entryNumber.trim()
      : await this.generateNextEntryNumber();

    const items: SamplePoItem[] = (payload.items || []).map((it, idx) => ({
      id: it.id && it.id.trim() ? it.id.trim() : `[#${Math.random().toString(16).substring(2, 7)}]`,
      itemName: (it.itemName || '').trim(),
      styleNo: (it.styleNo || '').trim(),
      washType: (it.washType || '').trim(),
      quantity: Number(it.quantity || 0),
      unit: (it.unit || 'PCS').trim().toUpperCase(),
      customerDcNumber: (it.customerDcNumber || payload.customerDcNumber || '').trim(),
      customerDcDate: (it.customerDcDate || payload.customerDcDate || '').trim(),
      dispatchedQuantity: Number(it.dispatchedQuantity || 0)
    }));

    const totalQuantity = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const totalDispatchedQuantity = items.reduce((sum, it) => sum + (it.dispatchedQuantity || 0), 0);

    const now = new Date().toISOString();
    const docId = doc(collection(db, SAMPLE_PO_COLLECTION)).id;

    const newRecord: SamplePoInward = {
      id: docId,
      entryNumber,
      customerDcNumber: payload.customerDcNumber || '',
      customerDcDate: payload.customerDcDate || now.split('T')[0],
      vendorId: payload.vendorId || '',
      vendorName: payload.vendorName || '',
      vendorAddress: payload.vendorAddress || '',
      vendorGst: payload.vendorGst || '',
      isManualVendor: Boolean(payload.isManualVendor),
      dispatchStatus: payload.dispatchStatus || 'pending',
      status: payload.status || 'active',
      items,
      totalQuantity,
      totalDispatchedQuantity,
      remarks: payload.remarks || '',
      createdAt: now,
      createdBy: user?.uid || 'admin',
      createdByName: user?.displayName || user?.email || 'Pranav',
      updatedAt: now,
      updatedBy: user?.uid || 'admin',
      updatedByName: user?.displayName || user?.email || 'Pranav'
    };

    if (!isDemo) {
      try {
        await setDoc(doc(db, SAMPLE_PO_COLLECTION, docId), {
          ...newRecord,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Failed to save Sample PO to Firestore, saved locally:', err);
      }
    }

    const current = this.getCache();
    const updated = [newRecord, ...current.filter((c) => c.id !== docId)];
    this.setCache(updated);

    return newRecord;
  }

  /**
   * Update an existing Sample PO record
   */
  static async updateSamplePo(
    id: string,
    updates: Partial<SamplePoInward>,
    user: { uid: string; displayName?: string; email?: string },
    isDemo: boolean = false
  ): Promise<SamplePoInward> {
    const current = this.getCache();
    const existing = current.find((c) => c.id === id);
    if (!existing) {
      throw new Error(`Sample PO with ID "${id}" not found.`);
    }

    const updatedItems = updates.items ? updates.items.map((it, idx) => ({
      id: it.id || `[#${Math.random().toString(16).substring(2, 7)}]`,
      itemName: (it.itemName || '').trim(),
      styleNo: (it.styleNo || '').trim(),
      washType: (it.washType || '').trim(),
      quantity: Number(it.quantity || 0),
      unit: (it.unit || 'PCS').trim().toUpperCase(),
      customerDcNumber: (it.customerDcNumber || updates.customerDcNumber || existing.customerDcNumber || '').trim(),
      customerDcDate: (it.customerDcDate || updates.customerDcDate || existing.customerDcDate || '').trim(),
      dispatchedQuantity: Number(it.dispatchedQuantity || 0)
    })) : existing.items;

    const totalQuantity = updatedItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const totalDispatchedQuantity = updatedItems.reduce((sum, it) => sum + (it.dispatchedQuantity || 0), 0);

    const now = new Date().toISOString();
    const merged: SamplePoInward = {
      ...existing,
      ...updates,
      items: updatedItems,
      totalQuantity,
      totalDispatchedQuantity,
      updatedAt: now,
      updatedBy: user?.uid || existing.updatedBy,
      updatedByName: user?.displayName || user?.email || existing.updatedByName
    };

    if (!isDemo) {
      try {
        await updateDoc(doc(db, SAMPLE_PO_COLLECTION, id), {
          ...updates,
          items: updatedItems,
          totalQuantity,
          totalDispatchedQuantity,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || 'admin',
          updatedByName: user?.displayName || user?.email || 'Pranav'
        });
      } catch (err) {
        console.warn('Failed to update Sample PO in Firestore, cached locally:', err);
      }
    }

    const nextCache = current.map((c) => (c.id === id ? merged : c));
    this.setCache(nextCache);

    return merged;
  }

  /**
   * Delete a Sample PO record from Firestore and cache
   */
  static async deleteSamplePo(id: string, isDemo: boolean = false): Promise<void> {
    if (!isDemo) {
      try {
        await deleteDoc(doc(db, SAMPLE_PO_COLLECTION, id));
      } catch (err) {
        console.warn('Failed to delete Sample PO in Firestore:', err);
      }
    }

    const current = this.getCache();
    const filtered = current.filter((c) => c.id !== id);
    this.setCache(filtered);
  }
}
