export type AttendanceStatus = 'Present' | 'Absent' | 'Half-Day' | 'Leave' | 'Holiday';

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  role: string;
  joiningDate: string;
  phone: string;
  salaryType: 'Monthly' | 'Daily';
  baseSalary: number;
  active: boolean;
}

export interface AttendanceEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: AttendanceStatus;
  inTime?: string;
  outTime?: string;
  overtimeHours: number;
  remarks?: string;
  enteredBy: string;
}
