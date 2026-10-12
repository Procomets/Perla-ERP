export type AttendanceStatus = 'Present' | 'Absent' | 'P/N' | 'N';

export interface AttendanceRecord {
  id?: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  monthYear: string; // YYYY-MM
  status: AttendanceStatus;
  markedBy: string;
  updatedAt?: any; // Firestore Timestamp
}

export interface GeneralSettings {
  isBlocked: boolean;
  accessStartTime?: string; // HH:mm format, e.g. "09:00"
  accessEndTime?: string; // HH:mm format, e.g. "18:00"
  updatedAt?: any;
  updatedBy?: string;
}
