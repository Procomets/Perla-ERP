import { Timestamp } from 'firebase/firestore';

export interface ColourItem {
  id: string;
  name: string;
  normalizedName: string;
  isActive: boolean;
  createdAt: Timestamp | { seconds: number; nanoseconds: number } | any;
  createdBy: string;
  updatedAt?: Timestamp | { seconds: number; nanoseconds: number } | any;
  updatedBy?: string;
}

export interface ColourMasterDoc {
  colours: ColourItem[];
}
