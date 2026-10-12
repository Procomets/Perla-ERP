import {
  collection,
  getDocs,
  query,
  where,
  setDoc,
  doc,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { SalaryRecord } from '../types/salarySheet';

export const SALARY_COLLECTION = 'salarySheets';

/**
 * Fetch all salary records for a specific month (YYYY-MM) from Firestore
 */
export const getSalaryRecordsForMonth = async (monthYear: string): Promise<SalaryRecord[]> => {
  try {
    const q = query(
      collection(db, SALARY_COLLECTION),
      where('monthYear', '==', monthYear)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SalaryRecord[];
  } catch (error) {
    console.error('Error fetching salary records for month:', monthYear, error);
    return [];
  }
};

/**
 * Save or update a single salary record in Firestore
 */
export const saveSalaryRecord = async (
  record: Omit<SalaryRecord, 'id' | 'updatedAt'>,
  email: string
): Promise<void> => {
  const periodStr = record.period && record.period !== 'monthly' ? `_${record.period}` : '';
  const docId = `${record.employeeId}_${record.monthYear}${periodStr}`;
  const docRef = doc(db, SALARY_COLLECTION, docId);

  await setDoc(docRef, {
    ...record,
    updatedAt: serverTimestamp(),
    updatedBy: email
  }, { merge: true });
};

/**
 * Batch save multiple salary records in Firestore
 */
export const saveSalaryRecordsBatch = async (
  records: Omit<SalaryRecord, 'id' | 'updatedAt'>[],
  email: string
): Promise<void> => {
  if (records.length === 0) return;
  const batch = writeBatch(db);

  records.forEach(record => {
    const periodStr = record.period && record.period !== 'monthly' ? `_${record.period}` : '';
    const docId = `${record.employeeId}_${record.monthYear}${periodStr}`;
    const docRef = doc(db, SALARY_COLLECTION, docId);
    batch.set(docRef, {
      ...record,
      updatedAt: serverTimestamp(),
      updatedBy: email
    }, { merge: true });
  });

  await batch.commit();
};
