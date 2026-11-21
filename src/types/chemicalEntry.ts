export type ChemicalEntryType = 'Purchase' | 'Consumption';
export type ProcessMaterialType = 'chemical' | 'wood';

export interface ChemicalEntryRecord {
  id: string;
  entryNumber: string; // e.g. "CHM-2026-0001" or "WD-2026-0001"
  entryType: ChemicalEntryType;
  materialType?: ProcessMaterialType; // 'chemical' | 'wood'
  date: string; // YYYY-MM-DD

  // Chemical or Wood details linked directly to Item Master
  itemId: string;
  itemCode: string;
  chemicalName: string; // item display name (chemical or wood material)
  unit: string;
  baseQuantity?: number; // Converted quantity in item's warehouse base unit (e.g. 1.5 t for 1500 kg)
  baseUnit?: string; // Warehouse base unit (e.g. 't')

  // Quantity and Pricing
  quantity: number;
  rate: number;
  totalAmount: number;

  // Purchase Specifics
  supplierId?: string | null;
  supplierName?: string | null;
  supplierInvoiceNo?: string | null;
  isReceived?: boolean;
  receivedDate?: string | null;

  // Consumption Specifics
  poId?: string | null;
  poNumber?: string | null;
  styleNo?: string | null;
  batchNo?: string | null;
  processType?: string | null; // e.g. Bleaching, Dyeing, Scouring, Washing, Steam Generation
  machineNo?: string | null;
  boilerNo?: string | null;
  startTime?: string | null; // e.g. "09:30"
  endTime?: string | null; // e.g. "11:45"
  operatorName?: string | null;

  // Stock Movement & Audit
  remarks?: string | null;
  stockTransactionId?: string | null;
  stockTransactionNumber?: string | null;
  stockUpdated: boolean;
  idempotencyKey?: string | null;

  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateChemicalEntryPayload {
  materialType?: ProcessMaterialType;
  entryType: ChemicalEntryType;
  itemId: string;
  date: string;
  quantity: number;
  rate?: number;
  totalAmount?: number;
  unit?: string;
  baseQuantity?: number;
  baseUnit?: string;
  supplierId?: string;
  supplierName?: string;
  supplierInvoiceNo?: string;
  isReceived?: boolean;
  poId?: string;
  poNumber?: string;
  styleNo?: string;
  batchNo?: string;
  processType?: string;
  machineNo?: string;
  boilerNo?: string;
  startTime?: string;
  endTime?: string;
  operatorName?: string;
  remarks?: string;
  idempotencyKey?: string;
}

export interface ChemicalEntryFilterOptions {
  search?: string;
  materialType?: ProcessMaterialType | 'ALL';
  entryType?: ChemicalEntryType | 'ALL';
  startDate?: string;
  endDate?: string;
  itemId?: string;
}
