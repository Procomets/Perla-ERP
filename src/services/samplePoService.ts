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
import {
  SamplePoInward,
  SamplePoItem,
  SamplePoOutward,
  SamplePoOutwardItem,
  CreateSampleOutwardPayload
} from '../types/samplePo';

export const SAMPLE_PO_COLLECTION = 'sample_po_inwards';
export const SAMPLE_COUNTERS_COLLECTION = 'sample_counters';
export const SAMPLE_PO_CACHE_KEY = 'perla_sample_po_inwards_cache_v1';
export const SAMPLE_PO_EVENT = 'perla_sample_po_updated';

export const SAMPLE_OUTWARD_COLLECTION = 'sample_po_outwards';
export const SAMPLE_OUTWARD_CACHE_KEY = 'perla_sample_po_outwards_cache_v1';
export const SAMPLE_OUTWARD_EVENT = 'perla_sample_po_outwards_updated';

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

/**
 * Live schema sample document for Sample Outward reflecting exact Firestore record provided by user
 */
export const INITIAL_DEMO_SAMPLE_OUTWARD: SamplePoOutward = {
  id: '8c9FbVlEAUCbnidtgWhR',
  entryNumber: 'SMP-DSP-2026-0005',
  inwardId: '0yQCaOgqeRDQHvrTHxzt',
  inwardEntryNumber: 'SMP-INW-2026-0006',
  vendorId: 'RUurFR28Gf5cMQzF7OLQ',
  vendorName: 'A A GARMENTS',
  vendorAddress: '',
  vendorGst: '',
  isManualVendor: false,
  customerDcDate: '2026-11-24',
  customerDcNumber: '3445',
  outwardDcDate: '2026-11-25',
  outwardDcNumber: '246',
  remarks: '',
  status: 'active',
  totalAmount: 0,
  totalQuantity: 22,
  items: [
    {
      id: '[#9b233]',
      inwardItemId: '[#24baf]',
      itemName: 'Shirt',
      styleNo: '121',
      washType: 'MID WASH',
      quantity: 22,
      unit: 'PCS',
      rate: 0,
      amount: 0,
      customerDcDate: '2026-11-24',
      customerDcNumber: '3445',
      outwardDcDate: '2026-11-25',
      outwardDcNumber: '246'
    }
  ],
  createdAt: '2026-11-25T07:49:40.000Z',
  createdBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
  createdByName: 'Pranav',
  updatedAt: '2026-11-25T07:49:40.000Z',
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

  // =========================================================================
  // SAMPLE OUTWARD (SAMPLE DISPATCH) METHODS
  // =========================================================================

  /**
   * Synchronously retrieve Sample Outwards cache from localStorage
   */
  static getOutwardCache(): SamplePoOutward[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(SAMPLE_OUTWARD_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read Sample Outward cache:', e);
    }
    return [INITIAL_DEMO_SAMPLE_OUTWARD];
  }

  /**
   * Save Sample Outwards cache to localStorage and dispatch event
   */
  static setOutwardCache(data: SamplePoOutward[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(SAMPLE_OUTWARD_CACHE_KEY, JSON.stringify(data));
        window.dispatchEvent(
          new CustomEvent(SAMPLE_OUTWARD_EVENT, { detail: data })
        );
      }
    } catch (e) {
      console.warn('Failed to write Sample Outward cache:', e);
    }
  }

  /**
   * Generates next SMP-DSP-YYYY-XXXX atomically using sample_counters
   */
  static async generateNextOutwardEntryNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const counterDocId = `smp_dsp_${year}`;
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
          nextSeq = 1;
          txn.set(counterRef, { currentSeq: nextSeq, year, createdAt: serverTimestamp() });
        }
      });

      // 2. Cross-check against existing items in cache to avoid collision
      const cached = this.getOutwardCache();
      const existingSeqs = cached
        .filter((c) => c.entryNumber && c.entryNumber.startsWith(`SMP-DSP-${year}-`))
        .map((c) => {
          const match = c.entryNumber.match(/SMP-DSP-\d+-(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        });

      const maxExisting = existingSeqs.length > 0 ? Math.max(...existingSeqs) : 0;
      if (nextSeq <= maxExisting) {
        nextSeq = maxExisting + 1;
        try {
          await setDoc(counterRef, { currentSeq: nextSeq, year, updatedAt: serverTimestamp() }, { merge: true });
        } catch {}
      }

      return `SMP-DSP-${year}-${String(nextSeq).padStart(4, '0')}`;
    } catch (err) {
      console.warn('Failed atomic sequence generation in sample_counters for outward, using local fallback:', err);
      const cached = this.getOutwardCache();
      const existingSeqs = cached
        .filter((c) => c.entryNumber && c.entryNumber.startsWith(`SMP-DSP-${year}-`))
        .map((c) => {
          const match = c.entryNumber.match(/SMP-DSP-\d+-(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        });
      const nextSeq = (existingSeqs.length > 0 ? Math.max(...existingSeqs) : 5) + 1;
      return `SMP-DSP-${year}-${String(nextSeq).padStart(4, '0')}`;
    }
  }

  /**
   * Subscribe to real-time Sample Outwards from Firestore
   */
  static subscribeSampleOutwards(
    callback: (data: SamplePoOutward[]) => void,
    onError?: (err: any) => void
  ): () => void {
    // Deliver cached data right away
    callback(this.getOutwardCache());

    // Listen to local window events
    const handleLocalEvent = (e: any) => {
      if (e?.detail) {
        callback(e.detail as SamplePoOutward[]);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(SAMPLE_OUTWARD_EVENT, handleLocalEvent);
    }

    // Query Firestore sample_po_outwards
    const q = query(collection(db, SAMPLE_OUTWARD_COLLECTION));
    const unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const records: SamplePoOutward[] = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          const items: SamplePoOutwardItem[] = Array.isArray(raw.items)
            ? raw.items.map((it: any, idx: number) => ({
                id: it.id || `[#${Math.random().toString(16).substring(2, 7)}]`,
                inwardItemId: it.inwardItemId || '',
                itemName: it.itemName || 'Garment Item',
                styleNo: it.styleNo || `ST-${idx + 1}`,
                washType: it.washType || 'Standard Wash',
                quantity: Number(it.quantity || 0),
                unit: it.unit || 'PCS',
                rate: Number(it.rate || 0),
                amount: Number(it.amount || 0),
                customerDcNumber: it.customerDcNumber || raw.customerDcNumber || '-',
                customerDcDate: it.customerDcDate || raw.customerDcDate || '-',
                outwardDcNumber: it.outwardDcNumber || raw.outwardDcNumber || '-',
                outwardDcDate: it.outwardDcDate || raw.outwardDcDate || '-'
              }))
            : [];

          const totalQuantity = typeof raw.totalQuantity === 'number'
            ? raw.totalQuantity
            : items.reduce((sum, it) => sum + it.quantity, 0);

          const totalAmount = typeof raw.totalAmount === 'number'
            ? raw.totalAmount
            : items.reduce((sum, it) => sum + (it.amount || 0), 0);

          return {
            id: docSnap.id,
            entryNumber: raw.entryNumber || `SMP-DSP-${docSnap.id.substring(0, 6)}`,
            inwardId: raw.inwardId || '',
            inwardEntryNumber: raw.inwardEntryNumber || '',
            vendorId: raw.vendorId || '',
            vendorName: raw.vendorName || 'Unnamed Vendor',
            vendorAddress: raw.vendorAddress || '',
            vendorGst: raw.vendorGst || '',
            isManualVendor: Boolean(raw.isManualVendor),
            customerDcNumber: raw.customerDcNumber || '-',
            customerDcDate: raw.customerDcDate || '-',
            outwardDcNumber: raw.outwardDcNumber || '-',
            outwardDcDate: raw.outwardDcDate || '-',
            remarks: raw.remarks || '',
            status: raw.status || 'active',
            totalQuantity,
            totalAmount,
            items,
            createdAt: parseFirestoreTimestamp(raw.createdAt),
            createdBy: raw.createdBy || '',
            createdByName: raw.createdByName || '',
            updatedAt: parseFirestoreTimestamp(raw.updatedAt),
            updatedBy: raw.updatedBy || '',
            updatedByName: raw.updatedByName || ''
          };
        });

        if (records.length > 0) {
          this.setOutwardCache(records);
          callback(records);
        }
      },
      (err) => {
        console.warn('Firestore Sample Outward subscription warning:', err);
        if (onError) onError(err);
      }
    );

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SAMPLE_OUTWARD_EVENT, handleLocalEvent);
      }
      unsubscribeFirestore();
    };
  }

  /**
   * Get all Sample Outwards (from Firestore or cache)
   */
  static async getSampleOutwards(isDemo: boolean = false): Promise<SamplePoOutward[]> {
    if (isDemo) {
      return this.getOutwardCache();
    }
    try {
      const snap = await getDocs(collection(db, SAMPLE_OUTWARD_COLLECTION));
      if (!snap.empty) {
        const list: SamplePoOutward[] = snap.docs.map((docSnap) => {
          const raw = docSnap.data();
          const items: SamplePoOutwardItem[] = Array.isArray(raw.items)
            ? raw.items.map((it: any, idx: number) => ({
                id: it.id || `[#${Math.random().toString(16).substring(2, 7)}]`,
                inwardItemId: it.inwardItemId || '',
                itemName: it.itemName || 'Garment Item',
                styleNo: it.styleNo || `ST-${idx + 1}`,
                washType: it.washType || 'Standard Wash',
                quantity: Number(it.quantity || 0),
                unit: it.unit || 'PCS',
                rate: Number(it.rate || 0),
                amount: Number(it.amount || 0),
                customerDcNumber: it.customerDcNumber || raw.customerDcNumber || '-',
                customerDcDate: it.customerDcDate || raw.customerDcDate || '-',
                outwardDcNumber: it.outwardDcNumber || raw.outwardDcNumber || '-',
                outwardDcDate: it.outwardDcDate || raw.outwardDcDate || '-'
              }))
            : [];

          const totalQuantity = typeof raw.totalQuantity === 'number'
            ? raw.totalQuantity
            : items.reduce((sum, it) => sum + it.quantity, 0);

          const totalAmount = typeof raw.totalAmount === 'number'
            ? raw.totalAmount
            : items.reduce((sum, it) => sum + (it.amount || 0), 0);

          return {
            id: docSnap.id,
            entryNumber: raw.entryNumber || `SMP-DSP-${docSnap.id.substring(0, 6)}`,
            inwardId: raw.inwardId || '',
            inwardEntryNumber: raw.inwardEntryNumber || '',
            vendorId: raw.vendorId || '',
            vendorName: raw.vendorName || 'Unnamed Vendor',
            vendorAddress: raw.vendorAddress || '',
            vendorGst: raw.vendorGst || '',
            isManualVendor: Boolean(raw.isManualVendor),
            customerDcNumber: raw.customerDcNumber || '-',
            customerDcDate: raw.customerDcDate || '-',
            outwardDcNumber: raw.outwardDcNumber || '-',
            outwardDcDate: raw.outwardDcDate || '-',
            remarks: raw.remarks || '',
            status: raw.status || 'active',
            totalQuantity,
            totalAmount,
            items,
            createdAt: parseFirestoreTimestamp(raw.createdAt),
            createdBy: raw.createdBy || '',
            createdByName: raw.createdByName || '',
            updatedAt: parseFirestoreTimestamp(raw.updatedAt),
            updatedBy: raw.updatedBy || '',
            updatedByName: raw.updatedByName || ''
          };
        });
        this.setOutwardCache(list);
        return list;
      }
    } catch (err) {
      console.warn('Failed to fetch Sample Outwards from Firestore, returning cache:', err);
    }
    return this.getOutwardCache();
  }

  /**
   * Create a new Sample Outward dispatch record:
   * 1. Saves outward record into sample_po_outwards
   * 2. Updates matching sample_po_inwards with dispatchedQuantity, totalDispatchedQuantity, and dispatchStatus
   */
  static async createSampleOutward(
    payload: CreateSampleOutwardPayload,
    user: { uid: string; displayName?: string; email?: string },
    isDemo: boolean = false
  ): Promise<SamplePoOutward> {
    const entryNumber = await this.generateNextOutwardEntryNumber();

    const items: SamplePoOutwardItem[] = (payload.items || []).map((it) => ({
      id: `[#${Math.random().toString(16).substring(2, 7)}]`,
      inwardItemId: it.inwardItemId || '',
      itemName: (it.itemName || '').trim(),
      styleNo: (it.styleNo || '').trim(),
      washType: (it.washType || '').trim(),
      quantity: Number(it.quantity || 0),
      unit: (it.unit || 'PCS').trim().toUpperCase(),
      rate: Number(it.rate || 0),
      amount: Number(it.amount || 0),
      customerDcNumber: (it.customerDcNumber || payload.customerDcNumber || '').trim(),
      customerDcDate: (it.customerDcDate || payload.customerDcDate || '').trim(),
      outwardDcNumber: (payload.outwardDcNumber || '').trim(),
      outwardDcDate: (payload.outwardDcDate || '').trim()
    }));

    const totalQuantity = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
    const totalAmount = items.reduce((sum, it) => sum + (it.amount || 0), 0);

    const now = new Date().toISOString();
    const docId = doc(collection(db, SAMPLE_OUTWARD_COLLECTION)).id;

    const newRecord: SamplePoOutward = {
      id: docId,
      entryNumber,
      inwardId: payload.inwardId,
      inwardEntryNumber: payload.inwardEntryNumber,
      vendorId: payload.vendorId || '',
      vendorName: payload.vendorName || '',
      vendorAddress: payload.vendorAddress || '',
      vendorGst: payload.vendorGst || '',
      isManualVendor: Boolean(payload.isManualVendor),
      customerDcNumber: payload.customerDcNumber || '',
      customerDcDate: payload.customerDcDate || '',
      outwardDcNumber: payload.outwardDcNumber || '',
      outwardDcDate: payload.outwardDcDate || now.split('T')[0],
      remarks: payload.remarks || '',
      status: 'active',
      totalQuantity,
      totalAmount,
      items,
      createdAt: now,
      createdBy: user?.uid || 'admin',
      createdByName: user?.displayName || user?.email || 'Pranav',
      updatedAt: now,
      updatedBy: user?.uid || 'admin',
      updatedByName: user?.displayName || user?.email || 'Pranav'
    };

    // 1. Save Outward to Firestore
    if (!isDemo) {
      try {
        await setDoc(doc(db, SAMPLE_OUTWARD_COLLECTION, docId), {
          ...newRecord,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Failed to save Sample Outward to Firestore, saved locally:', err);
      }
    }

    // 2. Update matching Inward document to record dispatched quantities
    if (payload.inwardId) {
      const inwardCache = this.getCache();
      const targetInward = inwardCache.find((inw) => inw.id === payload.inwardId);

      if (targetInward) {
        const updatedItems = (targetInward.items || []).map((inwIt) => {
          // Find matching dispatched line
          const matchingOut = items.find(
            (o) => (o.inwardItemId && o.inwardItemId === inwIt.id) ||
                   (o.styleNo === inwIt.styleNo && o.washType === inwIt.washType)
          );
          const addQty = matchingOut ? matchingOut.quantity : 0;
          return {
            ...inwIt,
            dispatchedQuantity: (inwIt.dispatchedQuantity || 0) + addQty
          };
        });

        const updatedTotalDispatched = updatedItems.reduce(
          (sum, it) => sum + (it.dispatchedQuantity || 0),
          0
        );

        let newDispatchStatus: 'pending' | 'partial' | 'completed' = 'pending';
        if (updatedTotalDispatched >= targetInward.totalQuantity && targetInward.totalQuantity > 0) {
          newDispatchStatus = 'completed';
        } else if (updatedTotalDispatched > 0) {
          newDispatchStatus = 'partial';
        }

        const updatedInward: SamplePoInward = {
          ...targetInward,
          items: updatedItems,
          totalDispatchedQuantity: updatedTotalDispatched,
          dispatchStatus: newDispatchStatus,
          updatedAt: now,
          updatedBy: user?.uid || targetInward.updatedBy,
          updatedByName: user?.displayName || targetInward.updatedByName
        };

        if (!isDemo) {
          try {
            await updateDoc(doc(db, SAMPLE_PO_COLLECTION, targetInward.id), {
              items: updatedItems,
              totalDispatchedQuantity: updatedTotalDispatched,
              dispatchStatus: newDispatchStatus,
              updatedAt: serverTimestamp(),
              updatedBy: user?.uid || 'admin',
              updatedByName: user?.displayName || 'Pranav'
            });
          } catch (err) {
            console.warn('Failed to update Inward record in Firestore:', err);
          }
        }

        const nextInwards = inwardCache.map((c) =>
          c.id === targetInward.id ? updatedInward : c
        );
        this.setCache(nextInwards);
      }
    }

    // 3. Update Outwards cache
    const currentOutwards = this.getOutwardCache();
    const nextOutwards = [newRecord, ...currentOutwards.filter((c) => c.id !== docId)];
    this.setOutwardCache(nextOutwards);

    return newRecord;
  }

  /**
   * Delete a Sample Outward record:
   * 1. Rolls back dispatched quantities on corresponding Inward
   * 2. Removes outward record from Firestore and cache
   */
  static async deleteSampleOutward(id: string, isDemo: boolean = false): Promise<void> {
    const currentOutwards = this.getOutwardCache();
    const targetOutward = currentOutwards.find((o) => o.id === id);

    if (targetOutward && targetOutward.inwardId) {
      const inwardCache = this.getCache();
      const targetInward = inwardCache.find((inw) => inw.id === targetOutward.inwardId);

      if (targetInward) {
        const updatedItems = (targetInward.items || []).map((inwIt) => {
          const matchingOut = (targetOutward.items || []).find(
            (o) => (o.inwardItemId && o.inwardItemId === inwIt.id) ||
                   (o.styleNo === inwIt.styleNo && o.washType === inwIt.washType)
          );
          const rollbackQty = matchingOut ? matchingOut.quantity : 0;
          return {
            ...inwIt,
            dispatchedQuantity: Math.max(0, (inwIt.dispatchedQuantity || 0) - rollbackQty)
          };
        });

        const updatedTotalDispatched = updatedItems.reduce(
          (sum, it) => sum + (it.dispatchedQuantity || 0),
          0
        );

        let newDispatchStatus: 'pending' | 'partial' | 'completed' = 'pending';
        if (updatedTotalDispatched >= targetInward.totalQuantity && targetInward.totalQuantity > 0) {
          newDispatchStatus = 'completed';
        } else if (updatedTotalDispatched > 0) {
          newDispatchStatus = 'partial';
        }

        const updatedInward: SamplePoInward = {
          ...targetInward,
          items: updatedItems,
          totalDispatchedQuantity: updatedTotalDispatched,
          dispatchStatus: newDispatchStatus,
          updatedAt: new Date().toISOString()
        };

        if (!isDemo) {
          try {
            await updateDoc(doc(db, SAMPLE_PO_COLLECTION, targetInward.id), {
              items: updatedItems,
              totalDispatchedQuantity: updatedTotalDispatched,
              dispatchStatus: newDispatchStatus,
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            console.warn('Failed to rollback Inward in Firestore on outward delete:', err);
          }
        }

        const nextInwards = inwardCache.map((c) =>
          c.id === targetInward.id ? updatedInward : c
        );
        this.setCache(nextInwards);
      }
    }

    if (!isDemo) {
      try {
        await deleteDoc(doc(db, SAMPLE_OUTWARD_COLLECTION, id));
      } catch (err) {
        console.warn('Failed to delete Sample Outward in Firestore:', err);
      }
    }

    const filtered = currentOutwards.filter((c) => c.id !== id);
    this.setOutwardCache(filtered);
  }
}
