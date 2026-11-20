import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  VehicleRecord,
  CreateVehiclePayload,
  UpdateVehiclePayload,
  VehicleFilterOptions
} from '../types/vehicle';

const VEHICLES_CACHE_KEY = 'perla_vehicles_cache_v1';

export class VehicleService {
  /**
   * Helper to format YYYY-MM-DD date into DD-MM-YYYY format matching screenshot
   * (e.g. "2028-08-04" -> "04-08-2028")
   */
  static formatDisplayDate(dateStr?: string | null): string {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        // YYYY-MM-DD -> DD-MM-YYYY
        return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      }
    } catch {
      // Fallback
    }
    return dateStr;
  }

  /**
   * Calculate renewal status for FC or Insurance due date
   */
  static getDueStatus(dateStr?: string | null): {
    status: 'expired' | 'due-soon' | 'valid' | 'unknown';
    daysRemaining: number;
    label: string;
  } {
    if (!dateStr) {
      return { status: 'unknown', daysRemaining: 0, label: 'Not Set' };
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const target = new Date(dateStr);
      target.setHours(0, 0, 0, 0);

      if (isNaN(target.getTime())) {
        return { status: 'unknown', daysRemaining: 0, label: 'Invalid Date' };
      }

      const diffTime = target.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) {
        return {
          status: 'expired',
          daysRemaining,
          label: `Expired (${Math.abs(daysRemaining)}d ago)`
        };
      } else if (daysRemaining <= 30) {
        return {
          status: 'due-soon',
          daysRemaining,
          label: daysRemaining === 0 ? 'Due Today' : `Due in ${daysRemaining}d`
        };
      } else {
        return {
          status: 'valid',
          daysRemaining,
          label: `Valid (${daysRemaining}d left)`
        };
      }
    } catch {
      return { status: 'unknown', daysRemaining: 0, label: 'Unknown' };
    }
  }

  /**
   * Safe document normalizer for Firestore / Cache records
   */
  static normalizeVehicle(id: string, data: any): VehicleRecord {
    const rawNo = (data?.vehicleNo || '').toString().trim().toUpperCase();
    const cleanNo = rawNo.replace(/\s+/g, '');

    return {
      id,
      vehicleNo: cleanNo || rawNo || 'UNKNOWN-VEHICLE',
      typeOfVehicle: (data?.typeOfVehicle || 'COMMERCIAL VEHICLE').toString().trim().toUpperCase(),
      modelMake: (data?.modelMake || 'TATA').toString().trim().toUpperCase(),
      fuelType: data?.fuelType || 'Diesel',
      mileage: data?.mileage !== undefined && data?.mileage !== null ? data.mileage : '',
      purchaseYear: data?.purchaseYear || new Date().getFullYear(),
      fcDueDate: data?.fcDueDate || '',
      insuranceDueDate: data?.insuranceDueDate || '',
      ownerType: data?.ownerType || 'Own',
      driverName: data?.driverName || '',
      driverPhone: data?.driverPhone || '',
      status: data?.status || 'Active',
      remarks: data?.remarks || '',
      createdAt: data?.createdAt || new Date().toISOString(),
      updatedAt: data?.updatedAt || new Date().toISOString(),
      createdBy: data?.createdBy || 'System',
      createdByName: data?.createdByName || 'Authorized User'
    };
  }

  /**
   * Local storage cache methods
   */
  static getCache(): VehicleRecord[] {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = localStorage.getItem(VEHICLES_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map((item) =>
              this.normalizeVehicle(item.id || `veh_${Date.now()}`, item)
            );
          }
        }
      }
    } catch (e) {
      console.warn('Failed to read vehicles cache', e);
    }
    return [];
  }

  static setCache(records: VehicleRecord[]): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(VEHICLES_CACHE_KEY, JSON.stringify(records));
      }
    } catch (e) {
      console.warn('Failed to write vehicles cache', e);
    }
  }

  /**
   * Fetch all vehicles with optional client-side filters
   */
  static async getVehicles(
    filters?: VehicleFilterOptions,
    isDemo: boolean = false
  ): Promise<VehicleRecord[]> {
    let vehicles: VehicleRecord[] = [];

    if (!isDemo) {
      try {
        const snap = await getDocs(collection(db, 'vehicles'));
        if (!snap.empty) {
          vehicles = snap.docs.map((d) => this.normalizeVehicle(d.id, d.data()));
          // Sort alphabetically by vehicleNo
          vehicles.sort((a, b) => a.vehicleNo.localeCompare(b.vehicleNo));
          this.setCache(vehicles);
        } else {
          vehicles = this.getCache();
        }
      } catch (err) {
        console.warn('Firestore fetch failed for vehicles, reading from cache:', err);
        vehicles = this.getCache();
      }
    } else {
      vehicles = this.getCache();
    }

    // Client-side Filters
    if (filters) {
      const { search, status, typeOfVehicle, modelMake, fuelType } = filters;

      if (status && status !== 'all') {
        vehicles = vehicles.filter((v) => v.status === status);
      }

      if (typeOfVehicle && typeOfVehicle !== 'all') {
        vehicles = vehicles.filter(
          (v) => (v.typeOfVehicle || '').toLowerCase() === typeOfVehicle.toLowerCase()
        );
      }

      if (modelMake && modelMake !== 'all') {
        vehicles = vehicles.filter(
          (v) => (v.modelMake || '').toLowerCase() === modelMake.toLowerCase()
        );
      }

      if (fuelType && fuelType !== 'all') {
        vehicles = vehicles.filter(
          (v) => (v.fuelType || 'Diesel').toLowerCase() === fuelType.toLowerCase()
        );
      }

      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        vehicles = vehicles.filter((v) => {
          return (
            (v.vehicleNo || '').toLowerCase().includes(term) ||
            (v.typeOfVehicle || '').toLowerCase().includes(term) ||
            (v.modelMake || '').toLowerCase().includes(term) ||
            (v.fuelType || '').toLowerCase().includes(term) ||
            String(v.mileage || '').toLowerCase().includes(term) ||
            String(v.purchaseYear).includes(term) ||
            (v.driverName || '').toLowerCase().includes(term) ||
            (v.driverPhone || '').includes(term) ||
            (v.remarks || '').toLowerCase().includes(term)
          );
        });
      }
    }

    return vehicles;
  }

  /**
   * Create a new vehicle record in Firestore
   */
  static async createVehicle(
    payload: CreateVehiclePayload,
    user: { uid: string; displayName?: string; email?: string }
  ): Promise<VehicleRecord> {
    const rawNo = payload.vehicleNo.trim().toUpperCase();
    const cleanNo = rawNo.replace(/\s+/g, '');

    if (!cleanNo) {
      throw new Error('Please enter a valid vehicle number (e.g. TN87H9298).');
    }

    if (!payload.typeOfVehicle.trim()) {
      throw new Error('Please enter or select the type of vehicle.');
    }

    if (!payload.modelMake.trim()) {
      throw new Error('Please enter or select the vehicle model / make.');
    }

    if (!payload.purchaseYear) {
      throw new Error('Please enter the purchase year.');
    }

    if (!payload.fcDueDate) {
      throw new Error('Please provide the FC due date.');
    }

    if (!payload.insuranceDueDate) {
      throw new Error('Please provide the insurance due date.');
    }

    // Check duplicate vehicle number in existing cache/records
    const current = this.getCache();
    const isDuplicate = current.some((v) => v.vehicleNo.replace(/\s+/g, '') === cleanNo);
    if (isDuplicate) {
      throw new Error(`Vehicle number "${cleanNo}" already exists in Vehicle Master.`);
    }

    const now = new Date().toISOString();
    const docRef = doc(collection(db, 'vehicles'));

    const newRecord: VehicleRecord = {
      id: docRef.id,
      vehicleNo: cleanNo,
      typeOfVehicle: payload.typeOfVehicle.trim().toUpperCase(),
      modelMake: payload.modelMake.trim().toUpperCase(),
      fuelType: payload.fuelType || 'Diesel',
      mileage:
        payload.mileage !== undefined && payload.mileage !== null && payload.mileage !== ''
          ? payload.mileage
          : '',
      purchaseYear: payload.purchaseYear,
      fcDueDate: payload.fcDueDate,
      insuranceDueDate: payload.insuranceDueDate,
      ownerType: payload.ownerType || 'Own',
      driverName: payload.driverName?.trim() || '',
      driverPhone: payload.driverPhone?.trim() || '',
      status: payload.status || 'Active',
      remarks: payload.remarks?.trim() || '',
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid || 'admin',
      createdByName: user.displayName || user.email || 'Authorized User'
    };

    // Save to Firestore
    try {
      await setDoc(docRef, newRecord);
    } catch (err) {
      console.warn('Firestore setDoc failed for vehicle, saving to local cache:', err);
    }

    // Update Cache
    const updatedList = [...current, newRecord].sort((a, b) =>
      a.vehicleNo.localeCompare(b.vehicleNo)
    );
    this.setCache(updatedList);

    return newRecord;
  }

  /**
   * Update an existing vehicle record
   */
  static async updateVehicle(
    id: string,
    payload: UpdateVehiclePayload,
    user: { uid: string; displayName?: string; email?: string }
  ): Promise<VehicleRecord> {
    const current = this.getCache();
    const existing = current.find((v) => v.id === id);

    let cleanNo = existing?.vehicleNo || '';
    if (payload.vehicleNo) {
      cleanNo = payload.vehicleNo.trim().toUpperCase().replace(/\s+/g, '');
      // Check duplicate against other records
      const isDuplicate = current.some(
        (v) => v.id !== id && v.vehicleNo.replace(/\s+/g, '') === cleanNo
      );
      if (isDuplicate) {
        throw new Error(`Vehicle number "${cleanNo}" already exists for another vehicle.`);
      }
    }

    const now = new Date().toISOString();
    const updateData: Partial<VehicleRecord> = {
      ...(payload.vehicleNo ? { vehicleNo: cleanNo } : {}),
      ...(payload.typeOfVehicle ? { typeOfVehicle: payload.typeOfVehicle.trim().toUpperCase() } : {}),
      ...(payload.modelMake ? { modelMake: payload.modelMake.trim().toUpperCase() } : {}),
      ...(payload.fuelType ? { fuelType: payload.fuelType } : {}),
      ...(payload.mileage !== undefined ? { mileage: payload.mileage } : {}),
      ...(payload.purchaseYear !== undefined ? { purchaseYear: payload.purchaseYear } : {}),
      ...(payload.fcDueDate ? { fcDueDate: payload.fcDueDate } : {}),
      ...(payload.insuranceDueDate ? { insuranceDueDate: payload.insuranceDueDate } : {}),
      ...(payload.ownerType ? { ownerType: payload.ownerType } : {}),
      ...(payload.driverName !== undefined ? { driverName: payload.driverName.trim() } : {}),
      ...(payload.driverPhone !== undefined ? { driverPhone: payload.driverPhone.trim() } : {}),
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.remarks !== undefined ? { remarks: payload.remarks.trim() } : {}),
      updatedAt: now
    };

    // Update in Firestore
    try {
      const docRef = doc(db, 'vehicles', id);
      await updateDoc(docRef, updateData as any);
    } catch (err) {
      console.warn('Firestore updateDoc failed for vehicle, falling back to setDoc:', err);
      try {
        const docRef = doc(db, 'vehicles', id);
        await setDoc(docRef, updateData, { merge: true });
      } catch (e) {
        console.warn('Firestore fallback setDoc failed:', e);
      }
    }

    const updatedRecord: VehicleRecord = {
      ...(existing || ({} as VehicleRecord)),
      id,
      ...updateData,
      vehicleNo: updateData.vehicleNo || existing?.vehicleNo || cleanNo,
      typeOfVehicle: updateData.typeOfVehicle || existing?.typeOfVehicle || '',
      modelMake: updateData.modelMake || existing?.modelMake || '',
      fuelType: updateData.fuelType || existing?.fuelType || 'Diesel',
      mileage: updateData.mileage !== undefined ? updateData.mileage : (existing?.mileage ?? ''),
      purchaseYear: updateData.purchaseYear ?? existing?.purchaseYear ?? new Date().getFullYear(),
      fcDueDate: updateData.fcDueDate || existing?.fcDueDate || '',
      insuranceDueDate: updateData.insuranceDueDate || existing?.insuranceDueDate || '',
      status: updateData.status || existing?.status || 'Active',
      updatedAt: now
    };

    const updatedList = current.map((v) => (v.id === id ? updatedRecord : v));
    this.setCache(updatedList);

    return updatedRecord;
  }

  /**
   * Delete a vehicle from Firestore
   */
  static async deleteVehicle(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'vehicles', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Firestore deleteDoc failed for vehicle:', err);
    }

    const current = this.getCache();
    this.setCache(current.filter((v) => v.id !== id));
  }
}
