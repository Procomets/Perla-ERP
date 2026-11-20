import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  VehicleDailyEntry,
  CreateVehicleDailyEntryPayload,
  UpdateVehicleDailyEntryPayload,
  VehicleDailyFilterOptions,
  VehicleFuelType
} from '../types/vehicle';

const VEHICLE_DAILY_CACHE_KEY = 'perla_vehicle_daily_entries_cache_v1';

export const DEFAULT_FUEL_RATES: Record<VehicleFuelType, number> = {
  Diesel: 92.0,
  Petrol: 101.5,
  Electric: 14.0,
  CNG: 85.0
};

// Demo initial entry if database is completely empty
export const INITIAL_DEMO_DAILY_ENTRY: VehicleDailyEntry = {
  id: 'vlog_demo_001',
  entryId: 'VLOG-2026-0001',
  date: '2026-11-20',
  vehicleId: 'veh_demo_01',
  vehicleNo: 'TN87H9298',
  typeOfVehicle: 'NEW TIPPER 12 WHEEL',
  modelMake: 'TATA',
  fuelType: 'Diesel',
  mileage: 4.5,
  startKm: 12450,
  startTime: '08:00',
  endKm: 12570,
  endTime: '17:30',
  totalDistance: 120,
  timeTakenMinutes: 570,
  timeTakenFormatted: '9h 30m',
  fuelRate: 92.0,
  fuelConsumed: 26.67,
  amountSpent: 2453.64,
  driverName: 'K. Murugan',
  remarks: 'Daily raw material transport to factory stockyard',
  createdAt: '2026-11-20T08:00:00.000Z',
  updatedAt: '2026-11-20T17:30:00.000Z',
  createdBy: 'system',
  createdByName: 'Admin'
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
   * Normalizer for incoming Firestore / Cache data
   */
  static normalizeEntry(id: string, data: any): VehicleDailyEntry {
    const startKm = Number(data?.startKm ?? 0) || 0;
    const endKm = Number(data?.endKm ?? 0) || 0;
    const totalDistance = Number(
      data?.totalDistance ?? Math.max(0, Math.round((endKm - startKm) * 100) / 100)
    );
    const mileage = Number(data?.mileage ?? 4.5) || 4.5;
    const fuelRate = Number(data?.fuelRate ?? DEFAULT_FUEL_RATES[data?.fuelType as VehicleFuelType] ?? 92.0);
    const fuelConsumed = Number(
      data?.fuelConsumed ?? (mileage > 0 ? Math.round((totalDistance / mileage) * 100) / 100 : 0)
    );
    const amountSpent = Number(
      data?.amountSpent ?? Math.round(fuelConsumed * fuelRate * 100) / 100
    );

    const timeDiff = this.calculateTimeDiff(data?.startTime, data?.endTime);

    return {
      id,
      entryId: data?.entryId || `VLOG-${id.slice(0, 8).toUpperCase()}`,
      date: data?.date || new Date().toISOString().split('T')[0],
      vehicleId: data?.vehicleId || '',
      vehicleNo: (data?.vehicleNo || '').toUpperCase(),
      typeOfVehicle: (data?.typeOfVehicle || '').toUpperCase(),
      modelMake: (data?.modelMake || '').toUpperCase(),
      fuelType: (data?.fuelType as VehicleFuelType) || 'Diesel',
      mileage,
      startKm,
      startTime: data?.startTime || '08:00',
      endKm,
      endTime: data?.endTime || '17:00',
      totalDistance,
      timeTakenMinutes: data?.timeTakenMinutes ?? timeDiff.minutes,
      timeTakenFormatted: data?.timeTakenFormatted || timeDiff.formatted,
      fuelRate,
      fuelConsumed,
      amountSpent,
      driverName: data?.driverName || 'Driver',
      remarks: data?.remarks || '',
      createdBy: data?.createdBy || 'System',
      createdByName: data?.createdByName || 'Authorized User',
      createdAt: data?.createdAt || new Date().toISOString(),
      updatedAt: data?.updatedAt || new Date().toISOString()
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
          if (Array.isArray(parsed)) {
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
   */
  static async getEntries(filters?: VehicleDailyFilterOptions): Promise<VehicleDailyEntry[]> {
    let entries: VehicleDailyEntry[] = [];

    try {
      const snap = await getDocs(collection(db, 'vehicle_daily_entries'));
      if (!snap.empty) {
        entries = snap.docs.map((d) => this.normalizeEntry(d.id, d.data()));
        entries.sort(
          (a, b) =>
            (b.date || '').localeCompare(a.date || '') ||
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
      const { search, vehicleNo, fuelType, startDate, endDate } = filters;

      if (vehicleNo && vehicleNo !== 'all') {
        entries = entries.filter(
          (e) => (e.vehicleNo || '').toLowerCase() === vehicleNo.toLowerCase()
        );
      }

      if (fuelType && fuelType !== 'all') {
        entries = entries.filter(
          (e) => (e.fuelType || 'Diesel').toLowerCase() === fuelType.toLowerCase()
        );
      }

      if (startDate) {
        entries = entries.filter((e) => e.date >= startDate);
      }

      if (endDate) {
        entries = entries.filter((e) => e.date <= endDate);
      }

      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        entries = entries.filter((e) => {
          return (
            (e.entryId || '').toLowerCase().includes(term) ||
            (e.vehicleNo || '').toLowerCase().includes(term) ||
            (e.driverName || '').toLowerCase().includes(term) ||
            (e.typeOfVehicle || '').toLowerCase().includes(term) ||
            (e.modelMake || '').toLowerCase().includes(term) ||
            (e.fuelType || '').toLowerCase().includes(term) ||
            (e.date || '').includes(term) ||
            String(e.totalDistance).includes(term) ||
            String(e.amountSpent).includes(term) ||
            (e.remarks || '').toLowerCase().includes(term)
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
    vehicleNo: string,
    targetDate: string,
    existingList?: VehicleDailyEntry[]
  ): VehicleDailyEntry | null {
    const list = existingList && existingList.length > 0 ? existingList : this.getCache();
    const cleanNo = vehicleNo.trim().toUpperCase().replace(/\s+/g, '');
    const vehicleEntries = list.filter(
      (e) => e.vehicleNo.trim().toUpperCase().replace(/\s+/g, '') === cleanNo
    );

    if (vehicleEntries.length === 0) return null;

    const sorted = [...vehicleEntries].sort(
      (a, b) =>
        (b.date || '').localeCompare(a.date || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    const before = sorted.find((e) => e.date < targetDate);
    return before || sorted[0];
  }

  /**
   * Create a new Vehicle Daily Entry in Firestore
   */
  static async createEntry(
    payload: CreateVehicleDailyEntryPayload,
    user: { uid: string; displayName?: string; email?: string }
  ): Promise<VehicleDailyEntry> {
    const now = new Date().toISOString();
    const year = new Date(payload.date || now).getFullYear();
    const counterDocRef = doc(db, 'counters', `vehicle_daily_${year}`);
    const entryDocRef = doc(collection(db, 'vehicle_daily_entries'));

    const timeDiff = this.calculateTimeDiff(payload.startTime, payload.endTime);
    const totalDistance = Math.max(0, Math.round((payload.endKm - payload.startKm) * 100) / 100);
    const mileage = payload.mileage > 0 ? payload.mileage : 4.5;
    const fuelRate = payload.fuelRate ?? DEFAULT_FUEL_RATES[payload.fuelType] ?? 92.0;
    const fuelConsumed = Math.round((totalDistance / mileage) * 100) / 100;
    const amountSpent = payload.amountSpent ?? Math.round(fuelConsumed * fuelRate * 100) / 100;

    let entryId = `VLOG-${year}-0001`;

    try {
      entryId = await runTransaction(db, async (txn) => {
        const counterSnap = await txn.get(counterDocRef);
        let nextSeq = 1;
        if (counterSnap.exists()) {
          nextSeq = (counterSnap.data()?.currentSeq || 0) + 1;
        }

        const generatedId = `VLOG-${year}-${String(nextSeq).padStart(4, '0')}`;
        txn.set(counterDocRef, { currentSeq: nextSeq, updatedAt: now }, { merge: true });

        const record: VehicleDailyEntry = {
          id: entryDocRef.id,
          entryId: generatedId,
          date: payload.date,
          vehicleId: payload.vehicleId || '',
          vehicleNo: payload.vehicleNo.trim().toUpperCase(),
          typeOfVehicle: payload.typeOfVehicle || '',
          modelMake: payload.modelMake || '',
          fuelType: payload.fuelType,
          mileage,
          startKm: payload.startKm,
          startTime: payload.startTime,
          endKm: payload.endKm,
          endTime: payload.endTime,
          totalDistance,
          timeTakenMinutes: timeDiff.minutes,
          timeTakenFormatted: timeDiff.formatted,
          fuelRate,
          fuelConsumed,
          amountSpent,
          driverName: payload.driverName.trim(),
          remarks: payload.remarks?.trim() || '',
          createdBy: user.uid,
          createdByName: user.displayName || user.email || 'Authorized User',
          createdAt: now,
          updatedAt: now
        };

        txn.set(entryDocRef, record);
        return generatedId;
      });
    } catch (txnErr) {
      console.warn('Firestore transaction failed, fallback write:', txnErr);
      const existing = this.getCache();
      entryId = `VLOG-${year}-${String(existing.length + 1).padStart(4, '0')}`;

      const record: VehicleDailyEntry = {
        id: entryDocRef.id,
        entryId,
        date: payload.date,
        vehicleId: payload.vehicleId || '',
        vehicleNo: payload.vehicleNo.trim().toUpperCase(),
        typeOfVehicle: payload.typeOfVehicle || '',
        modelMake: payload.modelMake || '',
        fuelType: payload.fuelType,
        mileage,
        startKm: payload.startKm,
        startTime: payload.startTime,
        endKm: payload.endKm,
        endTime: payload.endTime,
        totalDistance,
        timeTakenMinutes: timeDiff.minutes,
        timeTakenFormatted: timeDiff.formatted,
        fuelRate,
        fuelConsumed,
        amountSpent,
        driverName: payload.driverName.trim(),
        remarks: payload.remarks?.trim() || '',
        createdBy: user.uid,
        createdByName: user.displayName || user.email || 'Authorized User',
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(entryDocRef, record);
      } catch (setErr) {
        console.warn('Fallback setDoc failed:', setErr);
      }
    }

    const createdRecord: VehicleDailyEntry = {
      id: entryDocRef.id,
      entryId,
      date: payload.date,
      vehicleId: payload.vehicleId || '',
      vehicleNo: payload.vehicleNo.trim().toUpperCase(),
      typeOfVehicle: payload.typeOfVehicle || '',
      modelMake: payload.modelMake || '',
      fuelType: payload.fuelType,
      mileage,
      startKm: payload.startKm,
      startTime: payload.startTime,
      endKm: payload.endKm,
      endTime: payload.endTime,
      totalDistance,
      timeTakenMinutes: timeDiff.minutes,
      timeTakenFormatted: timeDiff.formatted,
      fuelRate,
      fuelConsumed,
      amountSpent,
      driverName: payload.driverName.trim(),
      remarks: payload.remarks?.trim() || '',
      createdBy: user.uid,
      createdByName: user.displayName || user.email || 'Authorized User',
      createdAt: now,
      updatedAt: now
    };

    const current = this.getCache();
    const updated = [createdRecord, ...current.filter((e) => e.id !== createdRecord.id)];
    this.setCache(updated);

    return createdRecord;
  }

  /**
   * Update an existing daily entry
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
    const totalDistance = Math.max(0, Math.round((endKm - startKm) * 100) / 100);
    const mileage = (payload.mileage && payload.mileage > 0) ? payload.mileage : (existing?.mileage || 4.5);
    const fuelType = payload.fuelType || existing?.fuelType || 'Diesel';
    const fuelRate = payload.fuelRate ?? existing?.fuelRate ?? DEFAULT_FUEL_RATES[fuelType] ?? 92.0;
    const fuelConsumed = Math.round((totalDistance / mileage) * 100) / 100;
    const amountSpent = payload.amountSpent ?? Math.round(fuelConsumed * fuelRate * 100) / 100;

    const updateData: Partial<VehicleDailyEntry> = {
      ...(payload.date ? { date: payload.date } : {}),
      ...(payload.vehicleNo ? { vehicleNo: payload.vehicleNo.trim().toUpperCase() } : {}),
      ...(payload.typeOfVehicle ? { typeOfVehicle: payload.typeOfVehicle } : {}),
      ...(payload.modelMake ? { modelMake: payload.modelMake } : {}),
      fuelType,
      mileage,
      startKm,
      startTime,
      endKm,
      endTime,
      totalDistance,
      timeTakenMinutes: timeDiff.minutes,
      timeTakenFormatted: timeDiff.formatted,
      fuelRate,
      fuelConsumed,
      amountSpent,
      ...(payload.driverName ? { driverName: payload.driverName.trim() } : {}),
      ...(payload.remarks !== undefined ? { remarks: payload.remarks.trim() } : {}),
      updatedAt: now
    };

    try {
      await updateDoc(entryDocRef, updateData as any);
    } catch (err) {
      console.warn('Firestore updateDoc failed, fallback setDoc:', err);
      try {
        await setDoc(entryDocRef, updateData, { merge: true });
      } catch (e) {
        console.warn('Firestore fallback setDoc failed:', e);
      }
    }

    const updatedRecord: VehicleDailyEntry = {
      ...(existing || ({} as VehicleDailyEntry)),
      id,
      entryId: existing?.entryId || `VLOG-${id.slice(0, 8).toUpperCase()}`,
      ...updateData,
      date: updateData.date || existing?.date || now.split('T')[0],
      vehicleNo: updateData.vehicleNo || existing?.vehicleNo || '',
      fuelType,
      mileage,
      startKm,
      startTime,
      endKm,
      endTime,
      totalDistance,
      timeTakenMinutes: timeDiff.minutes,
      timeTakenFormatted: timeDiff.formatted,
      fuelRate,
      fuelConsumed,
      amountSpent,
      driverName: updateData.driverName || existing?.driverName || 'Driver',
      updatedAt: now
    };

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
