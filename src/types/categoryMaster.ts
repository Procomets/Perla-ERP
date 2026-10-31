import { Timestamp } from 'firebase/firestore';

export interface ItemCategoryMasterItem {
  id: string;
  categoryId: string;
  name: string;
  categoryName: string;
  categoryCode: string;
  normalizedName: string;
  description?: string;
  isActive: boolean;
  status: 'active' | 'inactive';
  createdAt: Timestamp | { seconds: number; nanoseconds: number } | any;
  createdBy: string;
  updatedAt?: Timestamp | { seconds: number; nanoseconds: number } | any;
  updatedBy?: string;
}

export interface ItemCategoryMasterDoc {
  categories: ItemCategoryMasterItem[];
}
