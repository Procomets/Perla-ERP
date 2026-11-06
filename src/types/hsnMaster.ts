import { Timestamp } from 'firebase/firestore';

export interface HsnItem {
  id: string;
  hsnNo: string;
  description: string;
  isActive: boolean;
  createdAt: Timestamp | { seconds: number; nanoseconds: number } | any;
  createdBy: string;
  updatedAt?: Timestamp | { seconds: number; nanoseconds: number } | any;
  updatedBy?: string;
}

export interface HsnMasterDoc {
  items: HsnItem[];
}

