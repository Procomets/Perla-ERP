import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  query
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SampleInvoice } from '../types/sampleInvoice';
import { parseFirestoreTimestamp } from './samplePoService';

export const SAMPLE_INVOICE_COLLECTION = 'sample_invoices';
export const SAMPLE_INVOICE_CACHE_KEY = 'perla_sample_invoices_cache_v1';
export const SAMPLE_INVOICE_EVENT = 'perla_sample_invoices_updated';

function getCurrentIndianFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(-2);
  return `${startYear}-${endYearShort}`;
}

export class SampleInvoiceService {
  static getCache(): SampleInvoice[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(SAMPLE_INVOICE_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to read Sample Invoice cache:', e);
    }
    return [];
  }

  static setCache(data: SampleInvoice[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(SAMPLE_INVOICE_CACHE_KEY, JSON.stringify(data));
        window.dispatchEvent(new CustomEvent(SAMPLE_INVOICE_EVENT, { detail: data }));
      }
    } catch (e) {
      console.warn('Failed to write Sample Invoice cache:', e);
    }
  }

  private static getMaxLocalSeqForFY(fy: string): number {
    let maxSeq = 0;
    const ptpRegex = new RegExp(`^PTP\\/${fy.replace('-', '\\-')}\\/(\\d+)$`, 'i');

    // 1. Check sample invoices cache
    for (const inv of this.getCache()) {
      const m = inv.invoiceNo?.trim().match(ptpRegex);
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10) || 0);
    }

    // 2. Check main tax invoice counter & cached main invoices in localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const counterVal = localStorage.getItem(`perla_inv_counter_${fy}`);
        if (counterVal) {
          maxSeq = Math.max(maxSeq, parseInt(counterVal, 10) || 0);
        }
        const mainInvRaw = localStorage.getItem('perla_erp_invoices_v1') || localStorage.getItem('perla_erp_invoices');
        if (mainInvRaw) {
          const parsed = JSON.parse(mainInvRaw);
          if (Array.isArray(parsed)) {
            for (const inv of parsed) {
              const no = (inv?.invoiceNo || inv?.invoiceNumber || '').trim();
              const m = no.match(ptpRegex);
              if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10) || 0);
            }
          }
        }
      } catch {
        // ignore storage errors
      }
    }

    return maxSeq;
  }

  /**
   * Previews the next shared running Invoice Number (e.g. "PTP/2026-27/0008")
   * without incrementing the counter until the invoice is actually created.
   */
  static async peekNextInvoiceNo(): Promise<string> {
    const fy = getCurrentIndianFY();
    let maxSeq = this.getMaxLocalSeqForFY(fy);

    try {
      const counterRef = doc(db, 'invoice_counters', `invoice_${fy}`);
      const snap = await getDoc(counterRef);
      if (snap.exists()) {
        maxSeq = Math.max(maxSeq, Number(snap.data()?.currentSequence || 0));
      }
    } catch {
      // Fallback to local maxSeq
    }

    const nextSeq = maxSeq + 1;
    return `PTP/${fy}/${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Generates next atomic running Invoice Number shared with Main Tax Invoices: "PTP/2026-27/0008"
   */
  static async generateNextInvoiceNo(): Promise<string> {
    const fy = getCurrentIndianFY();
    const counterRef = doc(db, 'invoice_counters', `invoice_${fy}`);
    const localMax = this.getMaxLocalSeqForFY(fy);

    try {
      let nextSeq = localMax + 1;
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(counterRef);
        const firestoreCurrent = snap.exists() ? Number(snap.data()?.currentSequence || 0) : 0;
        nextSeq = Math.max(firestoreCurrent, localMax) + 1;
        txn.set(
          counterRef,
          { currentSequence: nextSeq, financialYear: fy, series: 'PTP', updatedAt: Timestamp.now() },
          { merge: true }
        );
      });

      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(`perla_inv_counter_${fy}`, String(nextSeq));
        } catch {}
      }

      return `PTP/${fy}/${String(nextSeq).padStart(4, '0')}`;
    } catch (err) {
      console.warn('Failed atomic sequence generation for sample invoice, using local fallback:', err);
      const nextSeq = localMax + 1;
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(`perla_inv_counter_${fy}`, String(nextSeq));
        } catch {}
      }
      return `PTP/${fy}/${String(nextSeq).padStart(4, '0')}`;
    }
  }

  static subscribeSampleInvoices(
    callback: (data: SampleInvoice[]) => void,
    onError?: (err: any) => void
  ): () => void {
    callback(this.getCache());

    const handleLocalEvent = (e: any) => {
      if (e?.detail) callback(e.detail as SampleInvoice[]);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(SAMPLE_INVOICE_EVENT, handleLocalEvent);
    }

    const q = query(collection(db, SAMPLE_INVOICE_COLLECTION));
    const unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const records: SampleInvoice[] = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data();
          return {
            id: docSnap.id,
            invoiceNo: raw.invoiceNo || docSnap.id,
            invoiceDate: raw.invoiceDate || '',
            hsnSacCode: raw.hsnSacCode || '998821',
            vendorId: raw.vendorId || '',
            vendorName: raw.vendorName || '',
            vendorAddress: raw.vendorAddress || '',
            vendorPhone: raw.vendorPhone || '',
            vendorGst: raw.vendorGst || '',
            items: Array.isArray(raw.items) ? raw.items : [],
            totalInwQty: Number(raw.totalInwQty || 0),
            totalOutQty: Number(raw.totalOutQty || 0),
            subtotal: Number(raw.subtotal || 0),
            discount: Number(raw.discount || 0),
            gstMode: raw.gstMode || 'cgst_sgst',
            cgstRate: Number(raw.cgstRate ?? 2.5),
            sgstRate: Number(raw.sgstRate ?? 2.5),
            igstRate: Number(raw.igstRate ?? 5.0),
            cgstAmount: Number(raw.cgstAmount || 0),
            sgstAmount: Number(raw.sgstAmount || 0),
            igstAmount: Number(raw.igstAmount || 0),
            forwarding: Number(raw.forwarding || 0),
            roundOff: Number(raw.roundOff || 0),
            totalAmount: Number(raw.totalAmount || 0),
            amountInWords: raw.amountInWords || '',
            status: raw.status || 'active',
            cancelReason: raw.cancelReason || '',
            createdAt: parseFirestoreTimestamp(raw.createdAt),
            createdBy: raw.createdBy || '',
            createdByName: raw.createdByName || '',
            updatedAt: parseFirestoreTimestamp(raw.updatedAt),
            updatedBy: raw.updatedBy || '',
            updatedByName: raw.updatedByName || ''
          };
        });

        records.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        this.setCache(records);
        callback(records);
      },
      (err) => {
        console.warn('Firestore Sample Invoice subscription warning:', err);
        if (onError) onError(err);
      }
    );

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SAMPLE_INVOICE_EVENT, handleLocalEvent);
      }
      unsubscribeFirestore();
    };
  }

  static async getSampleInvoices(isDemo: boolean = false): Promise<SampleInvoice[]> {
    if (isDemo) return this.getCache();
    try {
      const snap = await getDocs(collection(db, SAMPLE_INVOICE_COLLECTION));
      const list: SampleInvoice[] = snap.docs.map((docSnap) => {
        const raw = docSnap.data();
        return {
          id: docSnap.id,
          invoiceNo: raw.invoiceNo || docSnap.id,
          invoiceDate: raw.invoiceDate || '',
          hsnSacCode: raw.hsnSacCode || '998821',
          vendorId: raw.vendorId || '',
          vendorName: raw.vendorName || '',
          vendorAddress: raw.vendorAddress || '',
          vendorPhone: raw.vendorPhone || '',
          vendorGst: raw.vendorGst || '',
          items: Array.isArray(raw.items) ? raw.items : [],
          totalInwQty: Number(raw.totalInwQty || 0),
          totalOutQty: Number(raw.totalOutQty || 0),
          subtotal: Number(raw.subtotal || 0),
          discount: Number(raw.discount || 0),
          gstMode: raw.gstMode || 'cgst_sgst',
          cgstRate: Number(raw.cgstRate ?? 2.5),
          sgstRate: Number(raw.sgstRate ?? 2.5),
          igstRate: Number(raw.igstRate ?? 5.0),
          cgstAmount: Number(raw.cgstAmount || 0),
          sgstAmount: Number(raw.sgstAmount || 0),
          igstAmount: Number(raw.igstAmount || 0),
          forwarding: Number(raw.forwarding || 0),
          roundOff: Number(raw.roundOff || 0),
          totalAmount: Number(raw.totalAmount || 0),
          amountInWords: raw.amountInWords || '',
          status: raw.status || 'active',
          cancelReason: raw.cancelReason || '',
          createdAt: parseFirestoreTimestamp(raw.createdAt),
          createdBy: raw.createdBy || '',
          createdByName: raw.createdByName || '',
          updatedAt: parseFirestoreTimestamp(raw.updatedAt),
          updatedBy: raw.updatedBy || '',
          updatedByName: raw.updatedByName || ''
        };
      });
      list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      this.setCache(list);
      return list;
    } catch (err) {
      console.warn('Failed to fetch Sample Invoices from Firestore:', err);
      return this.getCache();
    }
  }

  static async createSampleInvoice(
    payload: Omit<SampleInvoice, 'id' | 'createdAt' | 'updatedAt'>,
    user: { uid: string; displayName?: string; email?: string },
    isDemo: boolean = false
  ): Promise<SampleInvoice> {
    const invoiceNo =
      payload.invoiceNo && payload.invoiceNo.trim()
        ? payload.invoiceNo.trim()
        : await this.generateNextInvoiceNo();

    // If a PTP/YYYY-YY/XXXX invoice number was supplied (e.g. from peekNextInvoiceNo),
    // sync the shared main invoice counter so the next Main or Sample invoice advances cleanly.
    const fy = getCurrentIndianFY();
    const ptpMatch = invoiceNo.match(new RegExp(`^PTP\\/${fy.replace('-', '\\-')}\\/(\\d+)$`, 'i'));
    if (ptpMatch) {
      const usedSeq = parseInt(ptpMatch[1], 10) || 0;
      if (usedSeq > 0) {
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const prevLocal = parseInt(localStorage.getItem(`perla_inv_counter_${fy}`) || '0', 10) || 0;
            if (usedSeq > prevLocal) {
              localStorage.setItem(`perla_inv_counter_${fy}`, String(usedSeq));
            }
          } catch {}
        }
        if (!isDemo) {
          try {
            const counterRef = doc(db, 'invoice_counters', `invoice_${fy}`);
            await runTransaction(db, async (txn) => {
              const snap = await txn.get(counterRef);
              const cur = snap.exists() ? Number(snap.data()?.currentSequence || 0) : 0;
              if (usedSeq > cur) {
                txn.set(
                  counterRef,
                  { currentSequence: usedSeq, financialYear: fy, series: 'PTP', updatedAt: Timestamp.now() },
                  { merge: true }
                );
              }
            });
          } catch {}
        }
      }
    }

    const now = new Date().toISOString();
    const docId = doc(collection(db, SAMPLE_INVOICE_COLLECTION)).id;

    const newInvoice: SampleInvoice = {
      ...payload,
      id: docId,
      invoiceNo,
      status: payload.status || 'active',
      createdAt: now,
      createdBy: user?.uid || 'admin',
      createdByName: user?.displayName || user?.email || 'Admin',
      updatedAt: now,
      updatedBy: user?.uid || 'admin',
      updatedByName: user?.displayName || user?.email || 'Admin'
    };

    if (!isDemo) {
      try {
        await setDoc(doc(db, SAMPLE_INVOICE_COLLECTION, docId), {
          ...newInvoice,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('Failed to save Sample Invoice to Firestore, saved locally:', err);
      }
    }

    const current = this.getCache();
    this.setCache([newInvoice, ...current.filter((c) => c.id !== docId)]);
    return newInvoice;
  }

  static async updateSampleInvoice(
    id: string,
    updates: Partial<SampleInvoice>,
    user: { uid: string; displayName?: string; email?: string },
    isDemo: boolean = false
  ): Promise<SampleInvoice> {
    const current = this.getCache();
    const existing = current.find((c) => c.id === id);
    if (!existing) throw new Error('Sample Invoice not found.');

    const now = new Date().toISOString();
    const merged: SampleInvoice = {
      ...existing,
      ...updates,
      updatedAt: now,
      updatedBy: user?.uid || existing.updatedBy,
      updatedByName: user?.displayName || user?.email || existing.updatedByName
    };

    if (!isDemo) {
      try {
        await updateDoc(doc(db, SAMPLE_INVOICE_COLLECTION, id), {
          ...updates,
          updatedAt: serverTimestamp(),
          updatedBy: user?.uid || 'admin',
          updatedByName: user?.displayName || user?.email || 'Admin'
        });
      } catch (err) {
        console.warn('Failed to update Sample Invoice in Firestore:', err);
      }
    }

    this.setCache(current.map((c) => (c.id === id ? merged : c)));
    return merged;
  }

  static async cancelSampleInvoice(
    id: string,
    reason: string,
    user: { uid: string; displayName?: string; email?: string },
    isDemo: boolean = false
  ): Promise<void> {
    await this.updateSampleInvoice(
      id,
      { status: 'cancelled', cancelReason: reason },
      user,
      isDemo
    );
  }
}
