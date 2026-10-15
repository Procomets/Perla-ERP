import { Timestamp } from 'firebase/firestore';

export interface ProcessItem {
  id: string;
  name: string;
  normalizedName: string;
  category?: 'washing' | 'dyeing' | 'other' | string;
  isActive: boolean;
  createdAt: Timestamp | { seconds: number; nanoseconds: number } | any;
  createdBy: string;
  updatedAt?: Timestamp | { seconds: number; nanoseconds: number } | any;
  updatedBy?: string;
}

export interface ProcessMasterDoc {
  processes: ProcessItem[];
}
