import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
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
   * Mark or clear daily attendance for an employee
   */
  static async markAttendance(
    employeeId: string,
    date: string,
    monthYear: string,
    status: AttendanceStatus | null,
    markedBy: string
  ): Promise<void> {
    const docId = `${employeeId}_${date}`;
    const docRef = doc(db, ATTENDANCE_COLLECTION, docId);

    if (status === null) {
      await deleteDoc(docRef);
      return;
    }

    const record: Omit<AttendanceRecord, 'id'> = {
      employeeId,
      date,
      monthYear,
      status,
      markedBy,
      updatedAt: serverTimestamp()
    };

    await setDoc(docRef, record);
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
