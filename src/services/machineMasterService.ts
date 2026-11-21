import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { MachineItem } from '../types/machineMaster';

export const GENERAL_SETTINGS_COLLECTION = 'generalSettings';
export const MACHINE_MASTER_DOC_ID = 'machine_master';
const MACHINE_STORAGE_KEY = 'perla_machine_master_cache';

export const DEFAULT_INITIAL_MACHINES: MachineItem[] = [
  {
    id: 'mch_seed_001',
    machineId: 'DY-01',
    name: 'Soft Flow Dyeing Machine #1',
    modelYear: '2021',
    processType: 'Dyeing',
    capacity: '250 kg',
    manufacturer: 'Fongs',
    serialNo: 'FNG-2021-098',
    status: 'active',
    remarks: 'High temperature & high pressure piece dyeing machine',
    createdAt: { seconds: 1700000000, nanoseconds: 0 },
    createdBy: 'system'
  },
  {
    id: 'mch_seed_002',
    machineId: 'WASH-01',
    name: 'Front Loading Washing Machine #1',
    modelYear: '2022',
    processType: 'Washing',
    capacity: '150 kg',
    manufacturer: 'Texpa',
    serialNo: 'TXP-W22-104',
    status: 'active',
    remarks: 'Used for enzyme, bio, and softener wash cycles',
    createdAt: { seconds: 1700000001, nanoseconds: 0 },
    createdBy: 'system'
  },
  {
    id: 'mch_seed_003',
    machineId: 'BLR-01',
    name: 'Industrial Wood-Fired Steam Boiler',
    modelYear: '2020',
    processType: 'Boiler',
    capacity: '3 Ton/hr',
    manufacturer: 'Thermax',
    serialNo: 'THX-BLR-882',
    status: 'active',
    remarks: 'Main steam generation plant powered by firewood consignments',
    createdAt: { seconds: 1700000002, nanoseconds: 0 },
    createdBy: 'system'
  },
  {
    id: 'mch_seed_004',
    machineId: 'DY-02',
    name: 'Sample Dyeing Machine',
    modelYear: '2023',
    processType: 'Dyeing',
    capacity: '25 kg',
    manufacturer: 'Fongs',
    serialNo: 'FNG-SMP-044',
    status: 'active',
    remarks: 'Lab dip and small lot sample processing',
    createdAt: { seconds: 1700000003, nanoseconds: 0 },
    createdBy: 'system'
  },
  {
    id: 'mch_seed_005',
    machineId: 'HYD-01',
    name: 'Hydro Extractor Centrifuge',
    modelYear: '2022',
    processType: 'Drying',
    capacity: '100 kg',
    manufacturer: 'Apex Machinery',
    serialNo: 'APX-HYD-551',
    status: 'active',
    remarks: 'High speed de-watering centrifuge',
    createdAt: { seconds: 1700000004, nanoseconds: 0 },
    createdBy: 'system'
  }
];

export const generateMachineKey = (): string => {
  const timestamp = Date.now();
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `mch_${timestamp}_${randomHex}`;
};

function getLocalMachineCache(): MachineItem[] {
  try {
    const raw = localStorage.getItem(MACHINE_STORAGE_KEY);
    if (!raw) return DEFAULT_INITIAL_MACHINES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_INITIAL_MACHINES;
  } catch {
    return DEFAULT_INITIAL_MACHINES;
  }
}

function setLocalMachineCache(items: MachineItem[]): void {
  try {
    localStorage.setItem(MACHINE_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Could not write to local machine cache:', err);
  }
}

export class MachineMasterService {
  private static getDocRef() {
    return doc(db, GENERAL_SETTINGS_COLLECTION, MACHINE_MASTER_DOC_ID);
  }

  /**
   * Fetch all machines from Firestore / Local Cache
   */
  static async getMachines(): Promise<MachineItem[]> {
    try {
      const docSnap = await getDoc(this.getDocRef());
      if (docSnap.exists()) {
        const data = docSnap.data();
        const list = Array.isArray(data?.machines) ? data.machines : [];
        if (list.length > 0) {
          setLocalMachineCache(list);
          return list;
        }
      }

      // If document doesn't exist or is empty, initialize with default seeds
      const initial = DEFAULT_INITIAL_MACHINES;
      setLocalMachineCache(initial);
      try {
        await setDoc(this.getDocRef(), { machines: initial }, { merge: true });
      } catch (writeErr) {
        console.warn('Could not auto-seed machine_master doc in Firebase:', writeErr);
      }
      return initial;
    } catch (err) {
      console.warn('Error reading machine_master from Firebase, using cache:', err);
      return getLocalMachineCache();
    }
  }

  /**
   * Realtime subscription to machines
   */
  static subscribeMachines(
    onSuccess: (items: MachineItem[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const docRef = this.getDocRef();

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const list = Array.isArray(data?.machines) ? data.machines : [];
          if (list.length > 0) {
            setLocalMachineCache(list);
            onSuccess(list);
            return;
          }
        }

        // Fallback / seed if empty
        const cached = getLocalMachineCache();
        onSuccess(cached);

        // Attempt seeding in background
        setDoc(docRef, { machines: cached }, { merge: true }).catch(() => {});
      },
      (error) => {
        console.warn('Firestore machine_master subscription error, using local cache:', error);
        onSuccess(getLocalMachineCache());
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  }

  /**
   * Add a new machine record
   */
  static async addMachine(
    machineData: Omit<MachineItem, 'id' | 'createdAt'>,
    userId: string
  ): Promise<MachineItem> {
    const current = await this.getMachines();

    // Check unique machineId constraint
    const targetCode = machineData.machineId.trim().toLowerCase();
    const existing = current.find(
      (m) => m.machineId.trim().toLowerCase() === targetCode
    );
    if (existing) {
      throw new Error(`Machine ID "${machineData.machineId}" is already assigned to "${existing.name}". Please choose a unique Machine ID.`);
    }

    const newItem: MachineItem = {
      ...machineData,
      id: generateMachineKey(),
      machineId: machineData.machineId.trim().toUpperCase(),
      name: machineData.name.trim(),
      modelYear: machineData.modelYear.trim(),
      processType: machineData.processType,
      status: machineData.status || 'active',
      createdAt: Timestamp.now(),
      createdBy: userId
    };

    const updated = [newItem, ...current];
    setLocalMachineCache(updated);

    try {
      await setDoc(this.getDocRef(), { machines: updated }, { merge: true });
    } catch (err) {
      console.warn('Failed to persist addMachine to Firebase, cached locally:', err);
    }

    return newItem;
  }

  /**
   * Update an existing machine record
   */
  static async updateMachine(
    id: string,
    updates: Partial<MachineItem>,
    userId: string
  ): Promise<void> {
    const current = await this.getMachines();
    const idx = current.findIndex((m) => m.id === id);
    if (idx === -1) {
      throw new Error('Machine not found.');
    }

    // Check unique machineId constraint if changing machineId
    if (updates.machineId) {
      const targetCode = updates.machineId.trim().toLowerCase();
      const duplicate = current.find(
        (m) => m.id !== id && m.machineId.trim().toLowerCase() === targetCode
      );
      if (duplicate) {
        throw new Error(`Machine ID "${updates.machineId}" is already assigned to "${duplicate.name}". Please choose a unique Machine ID.`);
      }
    }

    const existing = current[idx];
    const updatedItem: MachineItem = {
      ...existing,
      ...updates,
      machineId: updates.machineId ? updates.machineId.trim().toUpperCase() : existing.machineId,
      name: updates.name ? updates.name.trim() : existing.name,
      modelYear: updates.modelYear ? updates.modelYear.trim() : existing.modelYear,
      updatedAt: Timestamp.now(),
      updatedBy: userId
    };

    const updated = [...current];
    updated[idx] = updatedItem;
    setLocalMachineCache(updated);

    try {
      await setDoc(this.getDocRef(), { machines: updated }, { merge: true });
    } catch (err) {
      console.warn('Failed to persist updateMachine to Firebase, cached locally:', err);
    }
  }

  /**
   * Delete a machine record
   */
  static async deleteMachine(id: string): Promise<void> {
    const current = await this.getMachines();
    const updated = current.filter((m) => m.id !== id);
    setLocalMachineCache(updated);

    try {
      await setDoc(this.getDocRef(), { machines: updated }, { merge: true });
    } catch (err) {
      console.warn('Failed to persist deleteMachine to Firebase, cached locally:', err);
    }
  }
}
