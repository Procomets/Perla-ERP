export type ProcessCategory = 'Washing' | 'Dyeing';
export type RateBasis = 'per piece' | 'per kg';
export type UnitType = 'piece' | 'kg';
export type POStatus = 'Draft' | 'Approved' | 'In Progress' | 'Completed' | 'Cancelled';

export interface POLine {
  lineId: string;
  colourName: string;
  colourCode?: string;
  processType: string; // e.g. Enzyme Wash, Softener Wash, Reactive Dyeing
  quantity: number;
  unit: UnitType;
  rate: number;
  rateBasis: RateBasis;
  amount: number;
}

export interface PurchaseOrder {
  id: string;
  poId: string;
  poNumber: string;
  customerId: string;
  customerName: string;
  processCategory: ProcessCategory;
  styleNo: string;
  itemName: string; // e.g. Men's Denim Shirt
  orderDate: string;
  deliveryDate?: string;
  status: POStatus;
  lines: POLine[];
  totalQuantity: number;
  totalAmount: number;
  createdBy: string;
  createdAt: string;
  notes?: string;
}
