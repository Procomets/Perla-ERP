import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  VehicleDailyEntry,
  CreateVehicleDailyEntryPayload,
  UpdateVehicleDailyEntryPayload,
  VehicleDailyFilterOptions,
  VehicleFuelType
} from '../types/vehicle';

const VEHICLE_DAILY_CACHE_KEY = 'perla_vehicle_daily_entries_cache_v2';

export const DEFAULT_FUEL_RATES: Record<VehicleFuelType, number> = {
  Diesel: 92.0,
  Petrol: 101.5,
  Electric: 14.0,
  CNG: 85.0
};

/**
 * Safely parse Firestore timestamp or string to ISO string
 */
export function parseFirestoreTimestamp(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val.toDate === 'function') {
    return val.toDate().toISOString();
  }
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  return new Date().toISOString();
}

// Initial demo entry reflecting the exact Firestore database schema
export const INITIAL_DEMO_DAILY_ENTRY: VehicleDailyEntry = {
  id: 'Kqe22WlJcHgRNKI6xF0e',
  entryNumber: 'VLOG-2026-0001',
  tripDate: '2026-11-21',
  vehicleId: 'ERQdH6fQw61UTLMmFGW3',
  vehicleNumber: '77814551',
  typeOfVehicle: 'LOAD VECHILE',
  modelMake: 'ASHOK LEYLAND',
  fuelType: 'Diesel',
  mileage: 10,
  startKm: 90,
  startTime: '11:36',
  endKm: 200,
  endTime: '12:15',
  distanceCovered: 110,
  timeTaken: '39m',
  estimatedFuelConsumed: 11,
  fuelRate: 92,
  amountSpent: 1012,
  driverName: 'Pranav',
  remarks: '',
  status: 'completed',
  createdBy: '7WfxoJvAyceJe1STVGNqKXgkvbN2',
  createdByName: 'Pranav ',
  createdAt: '2026-11-21T06:46:31.000Z',
  updatedAt: '2026-11-21T06:46:31.000Z',

  // Backward-compatible UI aliases:
  entryId: 'VLOG-2026-0001',
  date: '2026-11-21',
  vehicleNo: '77814551',
  totalDistance: 110,
  timeTakenMinutes: 39,
  timeTakenFormatted: '39m',
  fuelConsumed: 11
};

export class VehicleMonitoringService {
  /**
   * Helper to calculate time difference between HH:mm start and end
   */
  static calculateTimeDiff(
    startTime?: string,
    endTime?: string
  ): { minutes: number; formatted: string } {
    if (!startTime || !endTime) return { minutes: 0, formatted: '—' };
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) {
      return { minutes: 0, formatted: '—' };
    }

    let startTotal = sH * 60 + sM;
    let endTotal = eH * 60 + eM;
    if (endTotal < startTotal) {
      endTotal += 24 * 60; // Crosses midnight
    }

    const diffMinutes = endTotal - startTotal;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;

    let formatted = '';
    if (hours > 0 && mins > 0) {
      formatted = `${hours}h ${mins}m`;
    } else if (hours > 0) {
      formatted = `${hours}h`;
    } else {
      formatted = `${mins}m`;
    }

    return { minutes: diffMinutes, formatted };
  }

  /**
   * Helper to format time to 12-hour AM/PM string
   */
  static format12HourTime(timeStr?: string | null): string {
    if (!timeStr) return '—';
    const trimmed = timeStr.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
    return trimmed;
  }

  /**
   * Normalizer for incoming Firestore / Cache data matching exact user schema
   */
  static normalizeEntry(id: string, data: any): VehicleDailyEntry {
    const docId = data?.id || id;
    const startKm = Number(data?.startKm ?? 0) || 0;
    const endKm = Number(data?.endKm ?? 0) || 0;
    const distanceCovered = Number(
      data?.distanceCovered ??
      data?.totalDistance ??
      Math.max(0, Math.round((endKm - startKm) * 100) / 100)
    );
    const mileage = Number(data?.mileage ?? 10) || 10;
    const fuelType = (data?.fuelType as VehicleFuelType) || 'Diesel';
    const fuelRate = Number(
      data?.fuelRate ?? DEFAULT_FUEL_RATES[fuelType as VehicleFuelType] ?? 92.0
    );
    const estimatedFuelConsumed = Number(
      data?.estimatedFuelConsumed ??
      data?.fuelConsumed ??
      (mileage > 0 ? Math.round((distanceCovered / mileage) * 100) / 100 : 0)
    );
    const amountSpent = Number(
      data?.amountSpent ?? Math.round(estimatedFuelConsumed * fuelRate * 100) / 100
    );

    const timeDiff = this.calculateTimeDiff(data?.startTime, data?.endTime);
    const timeTaken = data?.timeTaken || data?.timeTakenFormatted || timeDiff.formatted;
    const entryNumber = data?.entryNumber || data?.entryId || `VLOG-${docId.slice(0, 8).toUpperCase()}`;
    const tripDate = data?.tripDate || data?.date || new Date().toISOString().split('T')[0];
    const vehicleNumber = (data?.vehicleNumber || data?.vehicleNo || '').toUpperCase();
    const typeOfVehicle = (data?.typeOfVehicle || '').toUpperCase();
    const modelMake = (data?.modelMake || '').toUpperCase();
    const driverName = data?.driverName || 'Driver';
    const status = data?.status || 'completed';
    const remarks = data?.remarks || '';
    const vehicleId = data?.vehicleId || '';

    const createdAt = parseFirestoreTimestamp(data?.createdAt);
    const updatedAt = parseFirestoreTimestamp(data?.updatedAt);

    return {
      id: docId,
      entryNumber,
      tripDate,
      vehicleId,
      vehicleNumber,
      typeOfVehicle,
      modelMake,
      fuelType,
      mileage,
      startKm,
      startTime: data?.startTime || '08:00',
      endKm,
      endTime: data?.endTime || '17:00',
      distanceCovered,
      timeTaken,
      estimatedFuelConsumed,
      fuelRate,
      amountSpent,
      driverName,
      remarks,
      status,
      createdBy: data?.createdBy || 'System',
      createdByName: data?.createdByName || 'Authorized User',
      createdAt,
      updatedAt,

      // Backward-compatible UI aliases:
      entryId: entryNumber,
      date: tripDate,
      vehicleNo: vehicleNumber,
      totalDistance: distanceCovered,
      timeTakenMinutes: data?.timeTakenMinutes ?? timeDiff.minutes,
      timeTakenFormatted: timeTaken,
      fuelConsumed: estimatedFuelConsumed
    };
  }

  /**
   * Cache reading and writing
   */
  static getCache(): VehicleDailyEntry[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(VEHICLE_DAILY_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item) =>
              this.normalizeEntry(item.id || `vlog_${Date.now()}`, item)
            );
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read vehicle daily entries cache:', e);
    }
    return [INITIAL_DEMO_DAILY_ENTRY];
  }

  static setCache(records: VehicleDailyEntry[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(VEHICLE_DAILY_CACHE_KEY, JSON.stringify(records));
      }
    } catch (e) {
      console.warn('Failed to write vehicle daily entries cache:', e);
    }
  }

  /**
   * Fetch all daily monitoring entries with optional filtering
   * Checks both primary 'vehicle_daily_entries' and fallback collection
   */
  static async getEntries(filters?: VehicleDailyFilterOptions): Promise<VehicleDailyEntry[]> {
    let entries: VehicleDailyEntry[] = [];

    try {
      let snap = await getDocs(collection(db, 'vehicle_daily_entries'));
      if (snap.empty) {
        // Fallback check in case the user named collection differently
        try {
          const altSnap = await getDocs(collection(db, 'daily_expense_vehicle_monitor'));
          if (!altSnap.empty) {
            snap = altSnap;
          }
        } catch {
          // ignore fallback error
        }
      }

      if (!snap.empty) {
        entries = snap.docs.map((d) => this.normalizeEntry(d.id, d.data()));
        entries.sort(
          (a, b) =>
            (b.tripDate || b.date || '').localeCompare(a.tripDate || a.date || '') ||
            (b.createdAt || '').localeCompare(a.createdAt || '')
        );
        this.setCache(entries);
      } else {
        entries = this.getCache();
      }
    } catch (err) {
      console.warn('Firestore fetch failed for vehicle_daily_entries, using cache:', err);
      entries = this.getCache();
    }

    // Apply Client-Side Filters
    if (filters) {
      const { search, vehicleNumber, vehicleNo, fuelType, status, startDate, endDate } = filters;
      const targetVehicle = vehicleNumber || vehicleNo;

      if (targetVehicle && targetVehicle !== 'all') {
        const cleanTarget = targetVehicle.toLowerCase().trim();
        entries = entries.filter((e) => {
          const vNum = (e.vehicleNumber || e.vehicleNo || '').toLowerCase().trim();
          return vNum === cleanTarget;
        });
      }

      if (fuelType && fuelType !== 'all') {
        entries = entries.filter(
          (e) => (e.fuelType || 'Diesel').toLowerCase() === fuelType.toLowerCase()
        );
      }

      if (status && status !== 'all') {
        entries = entries.filter(
          (e) => (e.status || 'completed').toLowerCase() === status.toLowerCase()
        );
      }

      if (startDate) {
        entries = entries.filter((e) => (e.tripDate || e.date || '') >= startDate);
      }

      if (endDate) {
        entries = entries.filter((e) => (e.tripDate || e.date || '') <= endDate);
      }

      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        entries = entries.filter((e) => {
          const entryNum = (e.entryNumber || e.entryId || '').toLowerCase();
          const vNum = (e.vehicleNumber || e.vehicleNo || '').toLowerCase();
          const driver = (e.driverName || '').toLowerCase();
          const vehicleType = (e.typeOfVehicle || '').toLowerCase();
          const model = (e.modelMake || '').toLowerCase();
          const fuel = (e.fuelType || '').toLowerCase();
          const dateStr = (e.tripDate || e.date || '').toLowerCase();
          const distStr = String(e.distanceCovered ?? e.totalDistance ?? '');
          const spentStr = String(e.amountSpent || '');
          const statusStr = (e.status || '').toLowerCase();
          const remarksStr = (e.remarks || '').toLowerCase();

          return (
            entryNum.includes(term) ||
            vNum.includes(term) ||
            driver.includes(term) ||
            vehicleType.includes(term) ||
            model.includes(term) ||
            fuel.includes(term) ||
            dateStr.includes(term) ||
            distStr.includes(term) ||
            spentStr.includes(term) ||
            statusStr.includes(term) ||
            remarksStr.includes(term)
          );
        });
      }
    }

    return entries;
  }

  /**
   * Find most recent preceding log for a specific vehicle
   * to automatically fetch the recent end odometer reading and end time
   */
  static getPrecedingVehicleEntry(
    vehicleNumber: string,
    targetDate: string,
    existingList?: VehicleDailyEntry[]
  ): VehicleDailyEntry | null {
    const list = existingList && existingList.length > 0 ? existingList : this.getCache();
    const cleanNo = vehicleNumber.trim().toUpperCase().replace(/\s+/g, '');
    const vehicleEntries = list.filter((e) => {
      const vNum = (e.vehicleNumber || e.vehicleNo || '').trim().toUpperCase().replace(/\s+/g, '');
      return vNum === cleanNo;
    });

    if (vehicleEntries.length === 0) return null;

    const sorted = [...vehicleEntries].sort(
      (a, b) =>
        (b.tripDate || b.date || '').localeCompare(a.tripDate || a.date || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    const before = sorted.find((e) => (e.tripDate || e.date || '') < targetDate);
    return before || sorted[0];
  }

  /**
   * Create a new Vehicle Daily Entry in Firestore matching exact schema
   */
  static async createEntry(
    payload: CreateVehicleDailyEntryPayload,
    user: { uid: string; displayName?: string; email?: string }
  ): Promise<VehicleDailyEntry> {
    const now = new Date().toISOString();
    const tripDate = payload.tripDate || payload.date || now.split('T')[0];
    const year = new Date(tripDate).getFullYear();
    const counterDocRef = doc(db, 'counters', `vehicle_daily_${year}`);
    const entryDocRef = doc(collection(db, 'vehicle_daily_entries'));

    const timeDiff = this.calculateTimeDiff(payload.startTime, payload.endTime);
    const distanceCovered = Math.max(0, Math.round((payload.endKm - payload.startKm) * 100) / 100);
    const mileage = payload.mileage > 0 ? payload.mileage : 10;
    const fuelType = payload.fuelType || 'Diesel';
    const fuelRate = payload.fuelRate ?? DEFAULT_FUEL_RATES[fuelType as VehicleFuelType] ?? 92.0;
    const estimatedFuelConsumed = Math.round((distanceCovered / mileage) * 100) / 100;
    const amountSpent = payload.amountSpent ?? Math.round(estimatedFuelConsumed * fuelRate * 100) / 100;
    const timeTaken = payload.timeTaken || payload.timeTakenFormatted || timeDiff.formatted;
    const vehicleNumber = (payload.vehicleNumber || payload.vehicleNo || '').trim().toUpperCase();

    let entryNumber = payload.entryNumber || `VLOG-${year}-0001`;

    try {
      entryNumber = await runTransaction(db, async (txn) => {
        const counterSnap = await txn.get(counterDocRef);
        let nextSeq = 1;
        if (counterSnap.exists()) {
          nextSeq = (counterSnap.data()?.currentSeq || 0) + 1;
        }

        const generatedId = `VLOG-${year}-${String(nextSeq).padStart(4, '0')}`;
        txn.set(counterDocRef, { currentSeq: nextSeq, updatedAt: now }, { merge: true });

        // Document matching exact Firestore schema
        const docRecord = {
          id: entryDocRef.id,
          entryNumber: generatedId,
          tripDate,
          vehicleId: payload.vehicleId || '',
          vehicleNumber,
          typeOfVehicle: (payload.typeOfVehicle || '').toUpperCase(),
          modelMake: (payload.modelMake || '').toUpperCase(),
          fuelType,
          mileage,
          startKm: payload.startKm,
          startTime: payload.startTime,
          endKm: payload.endKm,
          endTime: payload.endTime,
          distanceCovered,
          timeTaken,
          estimatedFuelConsumed,
          fuelRate,
          amountSpent,
          driverName: payload.driverName.trim(),
          remarks: payload.remarks?.trim() || '',
          status: payload.status || 'completed',
          createdBy: user.uid,
          createdByName: (user.displayName || user.email || 'Authorized User').trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        txn.set(entryDocRef, docRecord);
        return generatedId;
      });
    } catch (txnErr) {
      console.warn('Firestore transaction failed, fallback write:', txnErr);
      const existing = this.getCache();
      entryNumber = `VLOG-${year}-${String(existing.length + 1).padStart(4, '0')}`;

      const docRecord = {
        id: entryDocRef.id,
        entryNumber,
        tripDate,
        vehicleId: payload.vehicleId || '',
        vehicleNumber,
        typeOfVehicle: (payload.typeOfVehicle || '').toUpperCase(),
        modelMake: (payload.modelMake || '').toUpperCase(),
        fuelType,
        mileage,
        startKm: payload.startKm,
        startTime: payload.startTime,
        endKm: payload.endKm,
        endTime: payload.endTime,
        distanceCovered,
        timeTaken,
        estimatedFuelConsumed,
        fuelRate,
        amountSpent,
        driverName: payload.driverName.trim(),
        remarks: payload.remarks?.trim() || '',
        status: payload.status || 'completed',
        createdBy: user.uid,
        createdByName: (user.displayName || user.email || 'Authorized User').trim(),
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(entryDocRef, docRecord);
      } catch (setErr) {
        console.warn('Fallback setDoc failed:', setErr);
      }
    }

    const createdRecord = this.normalizeEntry(entryDocRef.id, {
      id: entryDocRef.id,
      entryNumber,
      tripDate,
      vehicleId: payload.vehicleId || '',
      vehicleNumber,
      typeOfVehicle: payload.typeOfVehicle || '',
      modelMake: payload.modelMake || '',
      fuelType,
      mileage,
      startKm: payload.startKm,
      startTime: payload.startTime,
      endKm: payload.endKm,
      endTime: payload.endTime,
      distanceCovered,
      timeTaken,
      estimatedFuelConsumed,
      fuelRate,
      amountSpent,
      driverName: payload.driverName.trim(),
      remarks: payload.remarks?.trim() || '',
      status: payload.status || 'completed',
      createdBy: user.uid,
      createdByName: user.displayName || user.email || 'Authorized User',
      createdAt: now,
      updatedAt: now
    });

    const current = this.getCache();
    const updated = [createdRecord, ...current.filter((e) => e.id !== createdRecord.id)];
    this.setCache(updated);

    return createdRecord;
  }

  /**
   * Update an existing daily entry matching exact schema
   */
  static async updateEntry(
    id: string,
    payload: UpdateVehicleDailyEntryPayload,
    user: { uid: string; displayName?: string; email?: string }
  ): Promise<VehicleDailyEntry> {
    const now = new Date().toISOString();
    const entryDocRef = doc(db, 'vehicle_daily_entries', id);

    const cached = this.getCache();
    const existing = cached.find((e) => e.id === id);

    const startKm = payload.startKm !== undefined ? Number(payload.startKm) : (existing?.startKm || 0);
    const endKm = payload.endKm !== undefined ? Number(payload.endKm) : (existing?.endKm || 0);
    const startTime = payload.startTime || existing?.startTime || '08:00';
    const endTime = payload.endTime || existing?.endTime || '17:00';

    const timeDiff = this.calculateTimeDiff(startTime, endTime);
    const distanceCovered = Math.max(0, Math.round((endKm - startKm) * 100) / 100);
    const mileage = (payload.mileage && payload.mileage > 0) ? payload.mileage : (existing?.mileage || 10);
    const fuelType = payload.fuelType || existing?.fuelType || 'Diesel';
    const fuelRate = payload.fuelRate ?? existing?.fuelRate ?? DEFAULT_FUEL_RATES[fuelType as VehicleFuelType] ?? 92.0;
    const estimatedFuelConsumed = Math.round((distanceCovered / mileage) * 100) / 100;
    const amountSpent = payload.amountSpent ?? Math.round(estimatedFuelConsumed * fuelRate * 100) / 100;
    const timeTaken = payload.timeTaken || payload.timeTakenFormatted || timeDiff.formatted;
    const tripDate = payload.tripDate || payload.date || existing?.tripDate || existing?.date || now.split('T')[0];
    const vehicleNumber = (payload.vehicleNumber || payload.vehicleNo || existing?.vehicleNumber || existing?.vehicleNo || '').trim().toUpperCase();

    const updateData: any = {
      tripDate,
      vehicleNumber,
      ...(payload.vehicleId ? { vehicleId: payload.vehicleId } : {}),
      ...(payload.typeOfVehicle ? { typeOfVehicle: payload.typeOfVehicle.toUpperCase() } : {}),
      ...(payload.modelMake ? { modelMake: payload.modelMake.toUpperCase() } : {}),
      fuelType,
      mileage,
      startKm,
      startTime,
      endKm,
      endTime,
      distanceCovered,
      timeTaken,
      estimatedFuelConsumed,
      fuelRate,
      amountSpent,
      ...(payload.driverName ? { driverName: payload.driverName.trim() } : {}),
      ...(payload.remarks !== undefined ? { remarks: payload.remarks.trim() } : {}),
      status: payload.status || existing?.status || 'completed',
      updatedAt: serverTimestamp()
    };

    try {
      await updateDoc(entryDocRef, updateData);
    } catch (err) {
      console.warn('Firestore updateDoc failed, fallback setDoc:', err);
      try {
        await setDoc(entryDocRef, { ...updateData, updatedAt: now }, { merge: true });
      } catch (e) {
        console.warn('Firestore fallback setDoc failed:', e);
      }
    }

    const updatedRecord = this.normalizeEntry(id, {
      ...(existing || ({} as VehicleDailyEntry)),
      id,
      ...updateData,
      updatedAt: now
    });

    this.setCache(cached.map((e) => (e.id === id ? updatedRecord : e)));
    return updatedRecord;
  }

  /**
   * Delete a vehicle daily entry
   */
  static async deleteEntry(id: string): Promise<void> {
    try {
      const entryDocRef = doc(db, 'vehicle_daily_entries', id);
      await deleteDoc(entryDocRef);
    } catch (err) {
      console.warn('Firestore deleteDoc failed for vehicle daily entry:', err);
    }

    const current = this.getCache();
    this.setCache(current.filter((e) => e.id !== id));
  }
}
