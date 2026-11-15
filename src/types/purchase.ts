export type PurchaseStatus = 'Draft' | 'Confirmed' | 'Received' | 'Cancelled';

export type PurchaseType =
  | 'Raw Material'
  | 'Chemical'
  | 'Firewood'
  | 'Packaging'
  | 'General';

export interface PurchaseLineItem {
  lineId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  remarks?: string;
}

export interface RawMaterialPurchase {
  id: string; // pur_${timestamp}_${rand}
  purchaseNumber: string; // e.g. PUR-2026-0001
  purchaseDate: string; // YYYY-MM-DD
  purchaseType: PurchaseType;
  vendorId: string;
  vendorName: string;
  vendorCode?: string;
  supplierInvoiceNo: string;
  supplierInvoiceDate?: string;
  vehicleNo?: string;
  driverName?: string;
  driverPhone?: string;
  lines: PurchaseLineItem[];
  totalQuantity: number;
  grandTotal: number;
  status: PurchaseStatus;
  stockInwardCompleted: boolean;
  inwardTransactionIds?: string[];
  receivedDate?: string;
  receivedBy?: string;
  receivedByName?: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

export interface PurchaseFilterOptions {
  search?: string;
  status?: 'ALL' | PurchaseStatus;
  purchaseType?: 'ALL' | PurchaseType;
  vendorId?: string;
  startDate?: string;
  endDate?: string;
}

