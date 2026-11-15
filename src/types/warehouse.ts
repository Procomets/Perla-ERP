export type StockMovementType = 'INWARD' | 'OUTWARD';

export type StockSourceType =
  | 'PURCHASE_RECEIPT'
  | 'FIREWOOD_PURCHASE'
  | 'MANUAL_INWARD'
  | 'SHOPFLOOR_ISSUE'
  | 'PRODUCTION_CONSUMPTION'
  | 'ADJUSTMENT'
  | 'RETURN';

export type StockHealthStatus = 'Healthy' | 'Low Stock' | 'Critical' | 'Out Of Stock';

export interface WarehouseItemStock {
  id: string; // stock_${itemId}
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  baseUnit: string;
  availableStock: number; // Current physical balance
  minimumStockLevel: number;
  reorderLevel: number;
  healthStatus?: StockHealthStatus;
  averageRate?: number;
  storageLocation?: string;
  lastInwardDate?: string;
  lastOutwardDate?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface StockTransaction {
  id: string; // stk_tx_${timestamp}_${rand}
  transactionNumber: string; // e.g. TX-2026-0001
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  baseUnit: string;
  type: StockMovementType;
  source: StockSourceType;
  quantity: number; // positive number
  previousStock: number;
  newStock: number;
  referenceNumber: string; // e.g. PUR-2026-0001, DC-WOOD-01, JOB-101
  referenceId?: string; // ID of purchase, PO, or outward doc
  idempotencyKey?: string; // To prevent duplicate additions from same receipt
  purpose?: string; // For outward: e.g. "Fabric Washing & Scouring", "Boiler Fuel Feed"
  issuedTo?: string; // Person/department receiving the material
  receivedFrom?: string; // Vendor/supplier or inward delivery person
  date: string; // YYYY-MM-DD
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface IssueMaterialPayload {
  itemId: string;
  quantity: number;
  purpose: string;
  issuedTo: string;
  date: string;
  referenceNumber?: string;
  remarks?: string;
}

export interface InwardMaterialPayload {
  itemId: string;
  quantity: number;
  source: StockSourceType;
  referenceNumber: string;
  referenceId?: string;
  idempotencyKey?: string;
  receivedFrom?: string;
  date: string;
  remarks?: string;
}

export interface WarehouseDashboardMetrics {
  totalAvailableItems: number;
  lowStockItemsCount: number;
  totalInwardTransactions: number;
  totalOutwardTransactions: number;
  totalStockVolume: number;
  recentInwards: StockTransaction[];
  recentOutwards: StockTransaction[];
}

export interface WarehouseFilterOptions {
  search?: string;
  categoryId?: string;
  lowStockOnly?: boolean;
}

export interface TransactionFilterOptions {
  search?: string;
  itemId?: string;
  type?: 'ALL' | 'INWARD' | 'OUTWARD';
  startDate?: string;
  endDate?: string;
}

