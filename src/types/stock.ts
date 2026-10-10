export type ItemCategory = 'Chemical' | 'Firewood' | 'Raw Material' | 'Packaging' | 'Finished Goods';

export interface InventoryItem {
  id: string;
  itemId: string;
  code: string;
  name: string;
  category: ItemCategory;
  baseUnit: string;
  currentStock: number;
  reorderLevel: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  active: boolean;
  chemicalType?: string;
  storageNotes?: string;
}

export type MovementType = 'Inward Purchase' | 'Chemical Consumption' | 'Manual Adjustment' | 'Return';

export interface StockMovement {
  id: string;
  movementId: string;
  itemId: string;
  itemName: string;
  movementType: MovementType;
  quantity: number; // positive for addition, negative for deduction
  unit: string;
  sourceType: 'Purchase' | 'Production' | 'Adjustment';
  sourceId: string;
  batchNo?: string;
  timestamp: string;
  createdBy: string;
  remarks?: string;
}

export interface ChemicalConsumptionLine {
  chemicalItemId: string;
  chemicalName: string;
  quantity: number;
  unit: string;
  batchNo?: string;
}

export interface ChemicalEntry {
  id: string;
  entryId: string;
  poId: string;
  poNumber: string;
  poLineId: string;
  styleNo: string;
  colour: string;
  processType: string;
  machineNo: string;
  operatorName: string;
  lotNo: string;
  processedQty: number;
  unit: string;
  startTime: string;
  endTime: string;
  date: string;
  consumptions: ChemicalConsumptionLine[];
  createdBy: string;
  createdAt: string;
}
