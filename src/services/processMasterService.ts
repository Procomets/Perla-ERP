import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ProcessItem } from '../types/processMaster';

export const GENERAL_SETTINGS_COLLECTION = 'generalSettings';
export const PROCESS_MASTER_DOC_ID = 'process_master';

/**
 * Generates an ID matching the format: proc_<13-digit-timestamp>_<8-char-hex>
 * Example: proc_1791901486147_3e63ea0e
 */
export const generateProcessId = (): string => {
  const timestamp = Date.now();
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `proc_${timestamp}_${randomHex}`;
};

export const DEFAULT_INITIAL_PROCESSES = [
  'Softener Wash',
  'Bio Wash',
  'Silicon Wash',
  'Enzyme Wash',
  'Acid Wash',
  'Bleach Wash',
  'Vintage Wash',
  'Normal Dyeing',
  'Tie Dye',
  'Pigment Dyeing'
];

export class ProcessMasterService {
  private static getDocRef() {
    return doc(db, GENERAL_SETTINGS_COLLECTION, PROCESS_MASTER_DOC_ID);
  }

  /**
   * Fetch all wash/processes from generalSettings -> process_master
   */
  static async getProcesses(): Promise<ProcessItem[]> {
    try {
      const docSnap = await getDoc(this.getDocRef());
      if (docSnap.exists()) {
        const data = docSnap.data();
        const processes = Array.isArray(data?.processes) ? data.processes : [];
        return processes;
      }

      // Initialize with standard industry defaults if document doesn't exist
      const defaultItems: ProcessItem[] = DEFAULT_INITIAL_PROCESSES.map((name) => ({
        id: generateProcessId(),
        name,
        normalizedName: name.trim().toLowerCase(),
        isActive: true,
        createdAt: Timestamp.now(),
        createdBy: 'system'
      }));

      try {
        await setDoc(this.getDocRef(), { processes: defaultItems }, { merge: true });
      } catch (writeErr) {
        console.warn('Could not auto-seed process_master, returning defaults in memory:', writeErr);
      }

      return defaultItems;
    } catch (error) {
      console.error('Error fetching process master:', error);
      throw error;
    }
  }

  /**
   * Listen to real-time changes to the process_master document
   */
  static subscribeProcesses(
    callback: (processes: ProcessItem[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    return onSnapshot(
      this.getDocRef(),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const processes = Array.isArray(data?.processes) ? data.processes : [];
          callback(processes);
        } else {
          // Auto-seed defaults if not present
          const defaultItems: ProcessItem[] = DEFAULT_INITIAL_PROCESSES.map((name) => ({
            id: generateProcessId(),
            name,
            normalizedName: name.trim().toLowerCase(),
            isActive: true,
            createdAt: Timestamp.now(),
            createdBy: 'system'
          }));
          setDoc(this.getDocRef(), { processes: defaultItems }, { merge: true }).catch(() => {});
          callback(defaultItems);
        }
      },
      (error) => {
        console.error('Process master subscription error:', error);
        if (onError) onError(error);
      }
    );
  }

  /**
   * Add a new wash/process to process_master
   */
  static async addProcess(
    name: string,
    userId: string,
    category?: 'washing' | 'dyeing' | 'other' | string
  ): Promise<ProcessItem> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Process name cannot be empty.');
    }

    const normalized = trimmed.toLowerCase();
    const existing = await this.getProcesses();

    const isDuplicate = existing.some(
      (p) => p.normalizedName === normalized || p.name.toLowerCase() === normalized
    );

    if (isDuplicate) {
      throw new Error(`Wash / Process "${trimmed}" already exists in Master.`);
    }

    const newItem: ProcessItem = {
      id: generateProcessId(),
      name: trimmed,
      normalizedName: normalized,
      category: category || (trimmed.toLowerCase().includes('dye') ? 'dyeing' : 'washing'),
      isActive: true,
      createdAt: Timestamp.now(),
      createdBy: userId || 'system'
    };

    const updatedList = [...existing, newItem];

    await setDoc(
      this.getDocRef(),
      { processes: updatedList },
      { merge: true }
    );

    return newItem;
  }

  /**
   * Update an existing wash/process name or active status
   */
  static async updateProcess(
    id: string,
    updates: { name?: string; isActive?: boolean; category?: string },
    userId: string
  ): Promise<void> {
    const existing = await this.getProcesses();
    const index = existing.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Process with ID "${id}" not found.`);
    }

    let updatedName = existing[index].name;
    let updatedNormalized = existing[index].normalizedName;

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new Error('Process name cannot be empty.');
      }
      const normalized = trimmed.toLowerCase();

      // Check if duplicate of another item
      const isDuplicate = existing.some(
        (p) => p.id !== id && (p.normalizedName === normalized || p.name.toLowerCase() === normalized)
      );
      if (isDuplicate) {
        throw new Error(`Process "${trimmed}" already exists.`);
      }

      updatedName = trimmed;
      updatedNormalized = normalized;
    }

    const updatedItem: ProcessItem = {
      ...existing[index],
      name: updatedName,
      normalizedName: updatedNormalized,
      category: updates.category !== undefined ? updates.category : existing[index].category,
      isActive: updates.isActive !== undefined ? updates.isActive : existing[index].isActive,
      updatedAt: Timestamp.now(),
      updatedBy: userId || 'system'
    };

    const updatedList = [...existing];
    updatedList[index] = updatedItem;

    await setDoc(
      this.getDocRef(),
      { processes: updatedList },
      { merge: true }
    );
  }

  /**
   * Delete a process from process_master
   */
  static async deleteProcess(id: string): Promise<void> {
    const existing = await this.getProcesses();
    const filtered = existing.filter((p) => p.id !== id);

    await setDoc(
      this.getDocRef(),
      { processes: filtered },
      { merge: true }
    );
  }
}
