export type ItemType =
  | 'general'
  | 'chemical'
  | 'firewood'
  | 'raw_material'
  | 'packing'
  | 'consumable'
  | 'maintenance'
  | 'other';

export type ItemStatus = 'active' | 'inactive';

export type ChemicalGrade =
  | 'Textile Processing Grade'
  | 'Industrial Grade'
  | 'Technical Grade'
  | 'Analytical Grade'
  | 'Commercial Grade';

export type ChemicalCategoryType =
  | 'Detergent'
  | 'Softener'
  | 'Enzyme'
  | 'Bleaching Agent'
  | 'Dye'
  | 'Fixing Agent'
  | 'Neutralizer'
  | 'Finishing Chemical'
  | 'Wetting Agent'
  | 'Desizing Agent'
  | 'Other';

export interface UnitOfMeasure {
  id: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  symbol: string;
  unitType: 'weight' | 'volume' | 'count' | 'length' | 'package' | 'other';
  baseUnit?: string;
  conversionFactorToBase?: number;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ItemCategoryRecord {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryCode: string;
  description?: string;
  parentCategoryId?: string | null;
  status: ItemStatus;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChemicalDetails {
  itemId: string;
  chemicalCode: string;
  chemicalName: string;
  chemicalDisplayName: string;
  chemicalCategory: ChemicalCategoryType | string;
  chemicalType: string;
  chemicalGrade?: ChemicalGrade | string;
  manufacturer?: string;
  brand?: string;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  supplierProductCode?: string;
  purchaseUnit: string;
  consumptionUnit: string;
  conversionFactor: number;
  defaultPurchaseRate?: number;
  minimumStockLevel?: number;
  reorderLevel?: number;
  storageLocation?: string;
  batchTrackingRequired: boolean;
  expiryTrackingRequired: boolean;
  shelfLifeMonths?: number;
  shelfLife?: string;
  safetyInstructions?: string;
  storageInstructions?: string;
  handlingPrecautions?: string;
  sdsStoragePath?: string;
  technicalSheetStoragePath?: string;
  sdsFileName?: string;
  technicalSheetFileName?: string;
  hazardClassification?: string;
  phRange?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MasterItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  subcategoryId?: string;
  subcategoryName?: string;
  itemType: ItemType;
  description?: string;
  baseUnitId: string;
  baseUnit: string;
  baseUnitSymbol?: string;
  secondaryUnitId?: string;
  secondaryUnit?: string;
  conversionFactor?: number;
  defaultPurchaseRate?: number;
  minimumStockLevel?: number;
  reorderLevel?: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  supplierItemCode?: string;
  storageLocation?: string;
  hsnCode?: string;
  taxRatePercent?: number;
  batchTrackingEnabled?: boolean;
  expiryTrackingEnabled?: boolean;
  status: ItemStatus;
  currentStock?: number;
  remarks?: string;
  chemicalDetails?: ChemicalDetails;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedBy: string;
  updatedByName?: string;
  updatedAt: string;
}

export interface ItemAuditLog {
  id?: string;
  auditId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  action: 'created' | 'updated' | 'deactivated' | 'reactivated' | 'chemical_updated';
  changedBy: string;
  changedByName: string;
  changedAt: string;
  summary: string;
  previousValues?: Partial<MasterItem>;
  newValues?: Partial<MasterItem>;
}

export interface ItemFilterOptions {
  searchQuery?: string;
  category?: string;
  itemType?: ItemType | 'all';
  status?: ItemStatus | 'all';
  supplierId?: string;
  lowStockOnly?: boolean;
}

export interface ItemPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
