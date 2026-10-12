import { Timestamp } from 'firebase/firestore';

export interface SalaryRecord {
  id?: string;
  employeeId: string;
  monthYear: string; // YYYY-MM
  period?: 'monthly' | 'first15' | 'next15'; // Default to 'monthly' if undefined
  
  // User Editable Fields for Monthly Salary
  asOnDateSalary?: number;
  hike?: number;
  pf?: number;
  esi?: number;
  salaryAdvance?: number;
  lop?: number;
  remark?: string;

  // Editable Fields for 15 Days Labour Wages
  previousHolding?: number;
  holdingAmount?: number;
  commissionRate?: number;
  commissionAmount?: number;

  // Metadata
  updatedAt?: Timestamp | any;
  updatedBy: string;
}

export type Period = 'first15' | 'next15';
