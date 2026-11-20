import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  EBReadingRecord,
  CreateEBReadingPayload,
  UpdateEBReadingPayload,
  EBReadingFilterOptions
} from '../types/ebMonitoring';
import { EBSettingsService } from './ebSettingsService';

const EB_READINGS_CACHE_KEY = 'perla_eb_readings_cache_v1';

export class EBMonitoringService {
  /**
   * Safe document normalizer for Firestore / Cache records
   */
  static normalizeReading(id: string, data: any): EBReadingRecord {
    const openingReading = Number(data?.openingReading ?? 0) || 0;
    const closingReading = Number(data?.closingReading ?? 0) || 0;
    const defaultUnitPrice = EBSettingsService.getCache().unitPrice ?? 9.5;
    const spendingAmountPerUnit = Number(data?.spendingAmountPerUnit ?? data?.unitRate ?? defaultUnitPrice) || 0;

    const totalUnits = Number(
      data?.totalUnits ??
      Math.max(0, Math.round((closingReading - openingReading) * 100) / 100)
    ) || 0;

    const totalCost = Number(
      data?.totalCost ??
      Math.round(totalUnits * spendingAmountPerUnit * 100) / 100
    ) || 0;

    const readingNumber = data?.readingNumber || data?.entryId || `EB-${id.slice(0, 8)}`;

    return {
      id,
      readingNumber,
      date: data?.date || new Date().toISOString().split('T')[0],
      openingReading,
      openingTime: data?.openingTime || '06:00',
      closingReading,
      closingTime: data?.closingTime || '22:00',
      totalUnits,
      spendingAmountPerUnit,
      totalCost,
      readingTakenBy: data?.readingTakenBy || data?.operatorName || 'Operator',
      remarks: data?.remarks || '',
      createdBy: data?.createdBy || 'Authorized User',
      createdByName: data?.createdByName || null,
      createdAt: data?.createdAt || new Date().toISOString(),
      updatedAt: data?.updatedAt || new Date().toISOString()
    };
  }

  /**
   * Local cache access
   */
  private static getCache(): EBReadingRecord[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(EB_READINGS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map((item) =>
              this.normalizeReading(item.id || `cache_${Date.now()}`, item)
            );
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read EB readings cache', e);
    }
    return [];
  }

  private static setCache(records: EBReadingRecord[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(EB_READINGS_CACHE_KEY, JSON.stringify(records));
      }
    } catch (e) {
      console.warn('Failed to write EB readings cache', e);
    }
  }

  /**
   * Fetch all EB readings with optional client filters
   */
  static async getReadings(
    filters?: EBReadingFilterOptions,
    isDemo: boolean = false
  ): Promise<EBReadingRecord[]> {
    let readings: EBReadingRecord[] = [];

    if (!isDemo) {
      try {
        const snap = await getDocs(collection(db, 'eb_readings'));
        if (!snap.empty) {
          readings = snap.docs.map((d) => this.normalizeReading(d.id, d.data()));
          // Sort descending by date, then by creation timestamp
          readings.sort(
            (a, b) =>
              (b.date || '').localeCompare(a.date || '') ||
              (b.createdAt || '').localeCompare(a.createdAt || '')
          );
          this.setCache(readings);
        } else {
          readings = this.getCache();
        }
      } catch (err) {
        console.warn('Firestore fetch failed for eb_readings, reading from cache:', err);
        readings = this.getCache();
      }
    } else {
      readings = this.getCache();
    }

    // Client-side Filters
    if (filters) {
      const { search, startDate, endDate } = filters;

      if (startDate) {
        readings = readings.filter((r) => r.date >= startDate);
      }

      if (endDate) {
        readings = readings.filter((r) => r.date <= endDate);
      }

      if (search && search.trim()) {
        const queryTerm = search.trim().toLowerCase();
        readings = readings.filter((r) => {
          return (
            (r.readingNumber || '').toLowerCase().includes(queryTerm) ||
            (r.date || '').toLowerCase().includes(queryTerm) ||
            (r.readingTakenBy || '').toLowerCase().includes(queryTerm) ||
            (r.remarks || '').toLowerCase().includes(queryTerm) ||
            String(r.openingReading).includes(queryTerm) ||
            String(r.closingReading).includes(queryTerm) ||
            String(r.totalUnits).includes(queryTerm)
          );
        });
      }
    }

    return readings;
  }

  /**
   * Find the most recent reading to automatically provide
   * previous day's closing reading as next day's opening reading
   */
  static async getLatestReading(): Promise<EBReadingRecord | null> {
    try {
      // 1. Check fresh from Firestore
      try {
        const snap = await getDocs(collection(db, 'eb_readings'));
        if (!snap.empty) {
          const list = snap.docs.map((d) => this.normalizeReading(d.id, d.data()));
          list.sort(
            (a, b) =>
              (b.date || '').localeCompare(a.date || '') ||
              (b.createdAt || '').localeCompare(a.createdAt || '')
          );
          this.setCache(list);
          return list[0] || null;
        }
      } catch (e) {
        console.warn('Firestore getDocs failed in getLatestReading:', e);
      }

      // 2. Fallback to local cache
      const cached = this.getCache();
      if (cached.length > 0) {
        const sorted = [...cached].sort(
          (a, b) =>
            (b.date || '').localeCompare(a.date || '') ||
            (b.createdAt || '').localeCompare(a.createdAt || '')
        );
        return sorted[0] || null;
      }
    } catch (e) {
      console.warn('Failed to get latest EB reading:', e);
    }
    return null;
  }

  /**
   * Create a new EB Reading
   */
  static async createReading(
    payload: CreateEBReadingPayload,
    user: { uid: string; displayName?: string }
  ): Promise<EBReadingRecord> {
    const openingReading = Number(payload.openingReading || 0);
    const closingReading = Number(payload.closingReading || 0);

    if (closingReading < openingReading) {
      throw new Error(
        `Closing reading (${closingReading} kW) cannot be less than opening reading (${openingReading} kW).`
      );
    }

    const spendingAmountPerUnit = Number(payload.spendingAmountPerUnit || 0);
    if (spendingAmountPerUnit <= 0) {
      throw new Error('Spending amount per unit must be greater than zero.');
    }

    const totalUnits = Math.round((closingReading - openingReading) * 100) / 100;
    const totalCost = Math.round(totalUnits * spendingAmountPerUnit * 100) / 100;

    const now = new Date().toISOString();
    const year = new Date(payload.date).getFullYear() || new Date().getFullYear();

    const counterDocRef = doc(db, 'eb_counters', `reading_seq_${year}`);
    const readingDocRef = doc(collection(db, 'eb_readings'));

    let readingNumber = `EB-${year}-0001`;

    try {
      readingNumber = await runTransaction(db, async (txn) => {
        const counterSnap = await txn.get(counterDocRef);
        let nextSeq = 1;
        if (counterSnap.exists()) {
          nextSeq = (counterSnap.data()?.currentSeq || 0) + 1;
        }

        const generatedNumber = `EB-${year}-${String(nextSeq).padStart(4, '0')}`;

        txn.set(counterDocRef, { currentSeq: nextSeq, updatedAt: now }, { merge: true });

        const record: EBReadingRecord = {
          id: readingDocRef.id,
          readingNumber: generatedNumber,
          date: payload.date,
          openingReading,
          openingTime: payload.openingTime,
          closingReading,
          closingTime: payload.closingTime,
          totalUnits,
          spendingAmountPerUnit,
          totalCost,
          readingTakenBy: payload.readingTakenBy.trim(),
          remarks: payload.remarks?.trim() || '',
          createdBy: user.uid,
          createdByName: user.displayName || 'Authorized User',
          createdAt: now,
          updatedAt: now
        };

        txn.set(readingDocRef, record);
        return generatedNumber;
      });
    } catch (txnErr) {
      console.warn('Firestore transaction failed, fallback direct write:', txnErr);
      const existing = this.getCache();
      const yearCount = existing.filter((r) => r.date?.startsWith(String(year))).length;
      readingNumber = `EB-${year}-${String(yearCount + 1).padStart(4, '0')}`;

      const record: EBReadingRecord = {
        id: readingDocRef.id,
        readingNumber,
        date: payload.date,
        openingReading,
        openingTime: payload.openingTime,
        closingReading,
        closingTime: payload.closingTime,
        totalUnits,
        spendingAmountPerUnit,
        totalCost,
        readingTakenBy: payload.readingTakenBy.trim(),
        remarks: payload.remarks?.trim() || '',
        createdBy: user.uid,
        createdByName: user.displayName || 'Authorized User',
        createdAt: now,
        updatedAt: now
      };
      await setDoc(readingDocRef, record);
    }

    const newRecord: EBReadingRecord = {
      id: readingDocRef.id,
      readingNumber,
      date: payload.date,
      openingReading,
      openingTime: payload.openingTime,
      closingReading,
      closingTime: payload.closingTime,
      totalUnits,
      spendingAmountPerUnit,
      totalCost,
      readingTakenBy: payload.readingTakenBy.trim(),
      remarks: payload.remarks?.trim() || '',
      createdBy: user.uid,
      createdByName: user.displayName || 'Authorized User',
      createdAt: now,
      updatedAt: now
    };

    const current = this.getCache();
    this.setCache([newRecord, ...current.filter((r) => r.id !== newRecord.id)]);
    return newRecord;
  }

  /**
   * Update an existing EB Reading
   */
  static async updateReading(
    id: string,
    payload: UpdateEBReadingPayload,
    user: { uid: string; displayName?: string }
  ): Promise<EBReadingRecord> {
    const now = new Date().toISOString();
    const readingDocRef = doc(db, 'eb_readings', id);

    const cached = this.getCache();
    const existing = cached.find((r) => r.id === id);

    const openingReading = payload.openingReading !== undefined ? Number(payload.openingReading) : (existing?.openingReading || 0);
    const closingReading = payload.closingReading !== undefined ? Number(payload.closingReading) : (existing?.closingReading || 0);

    if (closingReading < openingReading) {
      throw new Error(
        `Closing reading (${closingReading} kW) cannot be less than opening reading (${openingReading} kW).`
      );
    }

    const spendingAmountPerUnit = payload.spendingAmountPerUnit !== undefined
      ? Number(payload.spendingAmountPerUnit)
      : (existing?.spendingAmountPerUnit || EBSettingsService.getCache().unitPrice || 9.5);

    const totalUnits = Math.round((closingReading - openingReading) * 100) / 100;
    const totalCost = Math.round(totalUnits * spendingAmountPerUnit * 100) / 100;

    const updateData: Partial<EBReadingRecord> = {
      ...(payload.date ? { date: payload.date } : {}),
      openingReading,
      ...(payload.openingTime ? { openingTime: payload.openingTime } : {}),
      closingReading,
      ...(payload.closingTime ? { closingTime: payload.closingTime } : {}),
      totalUnits,
      spendingAmountPerUnit,
      totalCost,
      ...(payload.readingTakenBy ? { readingTakenBy: payload.readingTakenBy.trim() } : {}),
      ...(payload.remarks !== undefined ? { remarks: payload.remarks.trim() } : {}),
      updatedAt: now
    };

    try {
      await updateDoc(readingDocRef, updateData);
    } catch (err) {
      console.warn('Firestore updateDoc failed for eb_readings, updating cache:', err);
    }

    const updatedRecord: EBReadingRecord = {
      ...(existing || ({} as EBReadingRecord)),
      id,
      readingNumber: existing?.readingNumber || `EB-${id.slice(0, 8)}`,
      date: payload.date || existing?.date || now.split('T')[0],
      openingReading,
      openingTime: payload.openingTime || existing?.openingTime || '06:00',
      closingReading,
      closingTime: payload.closingTime || existing?.closingTime || '22:00',
      totalUnits,
      spendingAmountPerUnit,
      totalCost,
      readingTakenBy: payload.readingTakenBy || existing?.readingTakenBy || 'Operator',
      remarks: payload.remarks !== undefined ? payload.remarks : existing?.remarks || '',
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    this.setCache(cached.map((r) => (r.id === id ? updatedRecord : r)));
    return updatedRecord;
  }

  /**
   * Delete an EB Reading
   */
  static async deleteReading(id: string): Promise<void> {
    try {
      const readingDocRef = doc(db, 'eb_readings', id);
      await deleteDoc(readingDocRef);
    } catch (err) {
      console.warn('Firestore deleteDoc failed for eb_readings, updating cache:', err);
    }

    const current = this.getCache();
    this.setCache(current.filter((r) => r.id !== id));
  }
}
