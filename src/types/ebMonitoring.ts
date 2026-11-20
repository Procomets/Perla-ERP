export interface EBReadingRecord {
  id: string;
  readingNumber: string; // e.g. "EB-2026-0001"
  date: string; // YYYY-MM-DD
  openingReading: number; // in kW
  openingTime: string; // e.g. "06:00"
  closingReading: number; // in kW
  closingTime: string; // e.g. "22:00"
  totalUnits: number; // closingReading - openingReading in kW
  spendingAmountPerUnit: number; // Spending amount per unit in ₹
  totalCost: number; // totalUnits * spendingAmountPerUnit in ₹
  readingTakenBy: string; // Person name
  remarks?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateEBReadingPayload {
  date: string;
  openingReading: number;
  openingTime: string;
  closingReading: number;
  closingTime: string;
  spendingAmountPerUnit: number;
  readingTakenBy: string;
  remarks?: string;
}

export interface UpdateEBReadingPayload extends Partial<CreateEBReadingPayload> {}

export interface EBReadingFilterOptions {
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface EBSettings {
  unitPrice: number; // Spending amount per unit in ₹ / kW
  updatedAt?: string;
  updatedBy?: string;
  updatedByName?: string;
}
