export type AttendanceStatus = 'Present' | 'Absent' | 'Half-Day' | 'Leave' | 'Holiday';

export type EmployeeType = 'Monthly Salary' | 'Labour';
export type EmploymentStatus = 'Active' | 'Inactive';
export type Gender = 'Male' | 'Female' | 'Other';

export interface EmployeeMaster {
  id: string; // Firestore document ID
  employeeId: string; // e.g. "EMP0001"
  employeeCode?: string; // Optional legacy code
  fullName: string;
  employeeType: EmployeeType;
  employmentStatus: EmploymentStatus;
  gender: Gender;
  mobileNumber: string;
  alternateMobile: string;
  email: string;
  address: string;
  state: string;
  pincode: string;
  bloodGroup: string;
  aadharNumber: string;
  panNumber: string;
  aadharPhotoUrl: string;
  personPhotoUrl: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  department: string;
  designation: string;
  reportingManager: string;
  shift: string;
  monthlyIncome: string;
  dailyWages: string;
  dateOfJoining: string;
  workLocation: string;
  accountNumber: string;
  ifscCode: string;
  bankBranch: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export type EmployeeMasterFormData = Omit<EmployeeMaster, 'id' | 'createdAt' | 'updatedAt'>;

export interface EmployeeFilterOptions {
  searchQuery: string;
  employeeType: 'all' | 'Monthly Salary' | 'Labour';
  status: 'all' | 'Active' | 'Inactive';
}

// Backwards-compatible Employee interface for Attendance and Payroll
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
