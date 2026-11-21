import { Timestamp } from 'firebase/firestore';

export type MachineProcessType =
  | 'Dyeing'
  | 'Washing'
  | 'Boiler'
  | 'Drying'
  | 'Finishing'
  | 'Hydro Extractor'
  | 'Other'
  | string;

export interface MachineItem {
  id: string; // Internal unique document key
  machineId: string; // Unique Machine Code / ID (e.g. MCH-001, DY-01, BLR-01)
  name: string; // Machine Name
  modelYear: string; // Model Year (e.g. 2022, 2024)
  processType: MachineProcessType; // Machine used for (Dyeing, Washing, Boiler, etc.)
  capacity?: string; // Optional capacity (e.g. 250 kg, 3 Ton/hr)
  manufacturer?: string; // Optional manufacturer/brand
  serialNo?: string; // Optional serial number
  status: 'active' | 'inactive';
  remarks?: string;
  createdAt: Timestamp | { seconds: number; nanoseconds: number } | any;
  createdBy: string;
  updatedAt?: Timestamp | { seconds: number; nanoseconds: number } | any;
  updatedBy?: string;
}

export interface MachineMasterDoc {
  machines: MachineItem[];
}
