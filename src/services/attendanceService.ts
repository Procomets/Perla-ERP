import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { AttendanceRecord, AttendanceStatus, GeneralSettings } from '../types/attendance';

export const ATTENDANCE_COLLECTION = 'attendance';
export const GENERAL_SETTINGS_COLLECTION = 'generalSettings';
export const GENERAL_SETTINGS_DOC_ID = 'attendance_timing';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  isBlocked: false,
  accessStartTime: '09:00',
  accessEndTime: '18:00'
};

/**
 * Calculate decimal working hours between timeIn and timeOut (HH:mm)
 */
export function calculateWorkingHours(timeIn?: string | null, timeOut?: string | null): number {
  if (!timeIn || !timeOut) return 0;
  const inParts = timeIn.split(':').map((s) => parseInt(s, 10));
  const outParts = timeOut.split(':').map((s) => parseInt(s, 10));
  if (
    inParts.length < 2 ||
    outParts.length < 2 ||
    isNaN(inParts[0]) ||
    isNaN(inParts[1]) ||
    isNaN(outParts[0]) ||
    isNaN(outParts[1])
  ) {
    return 0;
  }
  let startMin = inParts[0] * 60 + inParts[1];
  let endMin = outParts[0] * 60 + outParts[1];
  if (endMin < startMin) {
    // Overnight shifts (e.g. 21:00 to 06:00)
    endMin += 24 * 60;
  }
  const diffMinutes = endMin - startMin;
  const hours = diffMinutes / 60;
  return Math.round(hours * 100) / 100;
}

/**
 * Format decimal hours to number string (e.g. 8.5 -> "8.5", 3 -> "3")
 */
export function formatWorkingHours(hours?: number | null): string {
  if (!hours || hours <= 0) return '0';
  return `${Math.round(hours * 100) / 100}`;
}

/**
 * Calculate attendance shift status ('Present' | 'N' | 'P/N') based on timeIn, timeOut, and workingHours:
 * - 'Present': Day Shift (Standard morning/afternoon shift, workingHours < 13.5)
 * - 'N': Night Shift (Starts between 18:00 and 04:59, or runs overnight past midnight, workingHours < 13.5)
 * - 'P/N': Double Shift (Day + Night, workingHours >= 13.5)
 */
export function calculateShiftStatus(
  timeIn?: string | null,
  timeOut?: string | null,
  workingHours?: number | null
): AttendanceStatus {
  if (!timeIn && !timeOut) return 'Absent';

  // 1. Calculate decimal working hours if timeOut is available
  const hours =
    workingHours !== undefined && workingHours !== null && workingHours > 0
      ? workingHours
      : timeIn && timeOut
      ? calculateWorkingHours(timeIn, timeOut)
      : 0;

  // 2. Double Shift: 13.5 or more working hours (two shifts back-to-back, e.g. Day + Night)
  if (hours >= 13.5) {
    return 'P/N';
  }

  // 3. Parse timeIn hours
  if (timeIn) {
    const inParts = timeIn.split(':').map((s) => parseInt(s, 10));
    const inHour = !isNaN(inParts[0]) ? inParts[0] : 9;

    // Shift clocked in at night (18:00 to 04:59) -> Night Shift
    if (inHour >= 18 || inHour < 5) {
      return 'N';
    }

    // If timeOut exists: check if shift crossed midnight into early morning
    if (timeOut) {
      const outParts = timeOut.split(':').map((s) => parseInt(s, 10));
      const outHour = !isNaN(outParts[0]) ? outParts[0] : 18;

      // Started late afternoon (>= 15:00) and ended early morning (< 09:00)
      if (inHour >= 15 && outHour < 9 && outHour >= 0) {
        return 'N';
      }
    }

    // Otherwise, Day Shift
    return 'Present';
  }

  // If only timeOut exists
  return 'Present';
}

/**
 * Human-readable shift label for display
 */
export function getShiftLabel(status?: AttendanceStatus | null): string {
  switch (status) {
    case 'N':
      return 'Night Shift';
    case 'P/N':
      return 'Double Shift';
    case 'Present':
      return 'Day Shift';
    case 'Absent':
      return 'Absent';
    default:
      return 'Not In';
  }
}

/**
 * Format 24-hour "HH:mm" time to 12-hour "hh:mm A" (e.g. "09:30" -> "09:30 AM", "18:45" -> "06:45 PM")
 */
export function formatTime24To12(timeStr?: string | null): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1].padStart(2, '0');
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // 0 becomes 12
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

/**
 * Get current system time in "HH:mm" 24h format
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export class AttendanceService {
  /**
   * Fetch attendance records for a specific month (YYYY-MM)
   */
  static async getAttendanceForMonth(monthYear: string): Promise<AttendanceRecord[]> {
    try {
      const q = query(
        collection(db, ATTENDANCE_COLLECTION),
        where('monthYear', '==', monthYear)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as AttendanceRecord[];
    } catch (error) {
      console.warn('Failed to fetch attendance for month:', monthYear, error);
      return [];
    }
  }

  /**
   * Fetch yearly attendance records for an employee
   */
  static async getYearlyAttendanceForEmployee(
    employeeId: string,
    year: string
  ): Promise<AttendanceRecord[]> {
    try {
      const q = query(
        collection(db, ATTENDANCE_COLLECTION),
        where('employeeId', '==', employeeId)
      );
      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as AttendanceRecord[];
      return records.filter((r) => r.date.startsWith(year));
    } catch (error) {
      console.warn('Failed to fetch yearly attendance for employee:', employeeId, error);
      return [];
    }
  }

  /**
   * Fetch attendance records for a specific date (YYYY-MM-DD)
   */
  static async getAttendanceForDate(date: string): Promise<AttendanceRecord[]> {
    try {
      const q = query(
        collection(db, ATTENDANCE_COLLECTION),
        where('date', '==', date)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      })) as AttendanceRecord[];
    } catch (error) {
      console.warn('Failed to fetch attendance for date:', date, error);
      return [];
    }
  }

  /**
   * Mark or clear daily attendance for an employee.
   * Merges with existing record to preserve any recorded timeIn/timeOut.
   */
  static async markAttendance(
    employeeId: string,
    date: string,
    monthYear: string,
    status: AttendanceStatus | null,
    markedBy: string,
    extra?: Partial<AttendanceRecord>
  ): Promise<void> {
    const docId = `${employeeId}_${date}`;
    const docRef = doc(db, ATTENDANCE_COLLECTION, docId);

    if (status === null && !extra?.timeIn && !extra?.timeOut) {
      await deleteDoc(docRef);
      return;
    }

    const record: any = {
      employeeId,
      date,
      monthYear,
      status: status || 'Present',
      markedBy,
      updatedAt: serverTimestamp()
    };

    if (extra?.timeIn !== undefined) record.timeIn = extra.timeIn;
    if (extra?.timeOut !== undefined) record.timeOut = extra.timeOut;
    if (extra?.workingHours !== undefined) record.workingHours = extra.workingHours;

    await setDoc(docRef, record, { merge: true });
  }

  /**
   * Record or update time-based attendance (Time In / Time Out) for an employee.
   * Automatically sets status to 'Present' upon recording Time In and computes working hours.
   */
  static async recordTimeAttendance(
    employeeId: string,
    date: string,
    monthYear: string,
    data: {
      timeIn?: string | null;
      timeOut?: string | null;
      status?: AttendanceStatus | null;
      workingHours?: number;
    },
    markedBy: string
  ): Promise<AttendanceRecord> {
    const docId = `${employeeId}_${date}`;
    const docRef = doc(db, ATTENDANCE_COLLECTION, docId);

    // If clearing everything
    if (data.status === null && !data.timeIn && !data.timeOut) {
      await deleteDoc(docRef);
      return {
        id: docId,
        employeeId,
        date,
        monthYear,
        status: 'Present',
        markedBy
      };
    }

    // Calculate working hours if both timeIn and timeOut exist
    let workingHours = data.workingHours;
    if (workingHours === undefined && data.timeIn && data.timeOut) {
      workingHours = calculateWorkingHours(data.timeIn, data.timeOut);
    }

    // Auto-calculate shift status ('Present' | 'N' | 'P/N') according to timeIn and timeOut
    const status: AttendanceStatus =
      data.status ||
      calculateShiftStatus(data.timeIn, data.timeOut, workingHours);

    const payload: any = {
      employeeId,
      date,
      monthYear,
      status,
      markedBy,
      updatedAt: serverTimestamp()
    };

    if (data.timeIn !== undefined) payload.timeIn = data.timeIn;
    if (data.timeOut !== undefined) payload.timeOut = data.timeOut;
    if (workingHours !== undefined) payload.workingHours = workingHours;

    await setDoc(docRef, payload, { merge: true });

    return {
      id: docId,
      employeeId,
      date,
      monthYear,
      status,
      timeIn: payload.timeIn ?? null,
      timeOut: payload.timeOut ?? null,
      workingHours: payload.workingHours ?? 0,
      markedBy
    };
  }

  /**
   * Fetch General Settings (attendance entry window timings & lock status)
   */
  static async getGeneralSettings(): Promise<GeneralSettings> {
    try {
      const docRef = doc(db, GENERAL_SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC_ID);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          isBlocked: data.isBlocked ?? false,
          accessStartTime: data.accessStartTime || DEFAULT_GENERAL_SETTINGS.accessStartTime,
          accessEndTime: data.accessEndTime || DEFAULT_GENERAL_SETTINGS.accessEndTime,
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy
        };
      }
    } catch (error) {
      console.warn('Failed to read generalSettings collection, using defaults:', error);
    }
    return DEFAULT_GENERAL_SETTINGS;
  }

  /**
   * Realtime subscription to General Settings in Firebase Firestore
   */
  static subscribeGeneralSettings(callback: (settings: GeneralSettings) => void): () => void {
    const docRef = doc(db, GENERAL_SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC_ID);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          callback({
            isBlocked: data.isBlocked ?? false,
            accessStartTime: data.accessStartTime || DEFAULT_GENERAL_SETTINGS.accessStartTime,
            accessEndTime: data.accessEndTime || DEFAULT_GENERAL_SETTINGS.accessEndTime,
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy
          });
        } else {
          callback(DEFAULT_GENERAL_SETTINGS);
        }
      },
      (error) => {
        console.warn('Subscription to generalSettings failed, using defaults:', error);
      }
    );
  }

  /**
   * Update General Settings in Firebase Firestore
   */
  static async updateGeneralSettings(
    settings: Partial<GeneralSettings>,
    updatedBy: string
  ): Promise<void> {
    const docRef = doc(db, GENERAL_SETTINGS_COLLECTION, GENERAL_SETTINGS_DOC_ID);
    await setDoc(
      docRef,
      {
        ...settings,
        updatedBy,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }
}
