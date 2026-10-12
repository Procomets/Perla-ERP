import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { EmployeeMaster, EmployeeMasterFormData } from '../types/employee';

export const EMPLOYEE_COLLECTION = 'employeeMaster';

// Helper to convert Firestore timestamp or date string to Date
export const parseFirestoreDate = (val: any): Date => {
  if (!val) return new Date();
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate();
  }
  if (val.seconds) {
    return new Date(val.seconds * 1000);
  }
  if (typeof val === 'string' || typeof val === 'number') {
    return new Date(val);
  }
  return new Date();
};

export class EmployeeService {
  /**
   * Fetch all employees live from Firestore.
   * Returns empty array if no records exist in Firestore.
   */
  static async getEmployees(): Promise<EmployeeMaster[]> {
    try {
      const q = query(collection(db, EMPLOYEE_COLLECTION), orderBy('employeeId', 'asc'));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const fetched: EmployeeMaster[] = [];
        querySnapshot.forEach((d) => {
          const data = d.data();
          fetched.push({
            id: d.id,
            employeeId: data.employeeId || '',
            employeeCode: data.employeeCode || '',
            fullName: data.fullName || '',
            employeeType: data.employeeType || 'Monthly Salary',
            employmentStatus: data.employmentStatus || 'Active',
            gender: data.gender || 'Male',
            mobileNumber: data.mobileNumber || '',
            alternateMobile: data.alternateMobile || '',
            email: data.email || '',
            address: data.address || '',
            state: data.state || '',
            pincode: data.pincode || '',
            bloodGroup: data.bloodGroup || '',
            aadharNumber: data.aadharNumber || '',
            panNumber: data.panNumber || '',
            aadharPhotoUrl: data.aadharPhotoUrl || '',
            personPhotoUrl: data.personPhotoUrl || '',
            emergencyContactName: data.emergencyContactName || '',
            emergencyContactNumber: data.emergencyContactNumber || '',
            department: data.department || '',
            designation: data.designation || '',
            reportingManager: data.reportingManager || '',
            shift: data.shift || '',
            monthlyIncome: data.monthlyIncome || '',
            dailyWages: data.dailyWages || '',
            dateOfJoining: data.dateOfJoining || '',
            workLocation: data.workLocation || '',
            accountNumber: data.accountNumber || '',
            ifscCode: data.ifscCode || '',
            bankBranch: data.bankBranch || '',
            createdBy: data.createdBy || '',
            createdAt: parseFirestoreDate(data.createdAt),
            updatedAt: parseFirestoreDate(data.updatedAt)
          });
        });
        return fetched;
      }
    } catch (error) {
      console.warn('Could not read from Firestore employeeMaster collection:', error);
    }

    return [];
  }

  /**
   * Auto-generate next sequential Employee ID starting from EMP0001
   * (e.g. EMP0001, EMP0002, EMP0003...)
   */
  static generateNextEmployeeId(existingEmployees: EmployeeMaster[]): string {
    let maxNum = 0;
    existingEmployees.forEach((emp) => {
      if (emp.employeeId) {
        const match = emp.employeeId.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });

    const nextNum = maxNum + 1;
    return `EMP${nextNum.toString().padStart(4, '0')}`;
  }

  /**
   * Create new Employee in Firestore
   */
  static async createEmployee(
    formData: EmployeeMasterFormData,
    userEmail: string
  ): Promise<EmployeeMaster> {
    const docRef = doc(collection(db, EMPLOYEE_COLLECTION));
    const now = new Date();

    const newEmployee: Record<string, any> = {
      ...formData,
      employeeCode: formData.employeeCode || '',
      createdBy: userEmail || 'admin@perlatextiles.com',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(docRef, newEmployee);
    } catch (err) {
      console.error('Failed to create employee in Firestore:', err);
    }

    return {
      ...formData,
      id: docRef.id,
      createdBy: userEmail || 'admin@perlatextiles.com',
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Update existing Employee in Firestore
   */
  static async updateEmployee(
    id: string,
    formData: Partial<EmployeeMasterFormData>
  ): Promise<void> {
    const docRef = doc(db, EMPLOYEE_COLLECTION, id);
    try {
      await updateDoc(docRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(`Failed to update employee ${id} in Firestore:`, err);
      throw err;
    }
  }

  /**
   * Toggle Employment Status (Active <-> Inactive)
   */
  static async toggleEmployeeStatus(
    id: string,
    newStatus: 'Active' | 'Inactive'
  ): Promise<void> {
    const docRef = doc(db, EMPLOYEE_COLLECTION, id);
    try {
      await updateDoc(docRef, {
        employmentStatus: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(`Failed to toggle status for employee ${id}:`, err);
      throw err;
    }
  }

  /**
   * Delete Employee record from Firestore
   */
  static async deleteEmployee(id: string): Promise<void> {
    const docRef = doc(db, EMPLOYEE_COLLECTION, id);
    try {
      await deleteDoc(docRef);
    } catch (err) {
      console.error(`Failed to delete employee ${id} from Firestore:`, err);
      throw err;
    }
  }

  /**
   * Upload person or aadhar photo to Firebase Storage
   * Returns download URL, or falls back to Base64 data URL if storage upload fails
   */
  static async uploadPhoto(
    file: File,
    type: 'person' | 'aadhar',
    empId: string
  ): Promise<string> {
    try {
      if (storage) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const storagePath = `employees/${type}/${empId}_${Date.now()}_${cleanName}`;
        const fileRef = ref(storage, storagePath);
        await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(fileRef);
        return downloadUrl;
      }
    } catch (storageErr) {
      console.warn(`Firebase Storage upload failed for ${type} photo, falling back to Base64 Data URL:`, storageErr);
    }

    // Base64 Fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }
}
