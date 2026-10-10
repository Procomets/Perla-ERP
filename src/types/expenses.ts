export interface EBEntry {
  id: string;
  entryId: string;
  date: string;
  meterId: string;
  kwhReading: number;
  kvahReading: number;
  unitRate: number;
  calculatedAmount: number;
  remarks?: string;
  createdBy: string;
}

export interface TransportExpense {
  id: string;
  expenseId: string;
  date: string;
  category: 'Inward Freight' | 'Outward Freight' | 'Raw Material Transport' | 'General';
  transporterVendorId?: string;
  transporterName: string;
  vehicleNo: string;
  driverName?: string;
  sourceDestination: string;
  linkedReference?: string; // e.g. PO or DC No
  amount: number;
  paymentStatus: 'Pending' | 'Paid';
  notes?: string;
  createdBy: string;
}
