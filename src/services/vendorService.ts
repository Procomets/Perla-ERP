import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import {
  Vendor,
  VendorContact,
  VendorDocument,
  VendorAuditLog,
  VendorFilterOptions,
  VendorPagination,
  DocumentType,
  VendorStatus
} from '../types/vendor';
import { validateParentRelationship } from '../schemas/vendorSchema';

/**
 * Recursively removes undefined fields from objects/arrays so Firestore never throws unsupported field value error.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanFirestoreData(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date || typeof (obj as any).toDate === 'function') {
      return obj;
    }
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

// Seed initial mock data for automatic live Firestore creation
export const initialMockVendors: Vendor[] = [
  {
    vendorId: 'v-101',
    id: 'v-101',
    vendorCode: 'VND-000001',
    companyName: 'Sree Kumar Texind Corporation',
    legalCompanyName: 'Sree Kumar Texind Corp Pvt Ltd',
    vendorType: 'both',
    vendorCategory: 'main_company',
    parentVendorId: null,
    businessDescription: 'Leading textile yarn spinner and fabric processor in South India',
    address: {
      addressLine1: '45 Avinashi Road',
      addressLine2: 'Near Hope College',
      city: 'Coimbatore',
      district: 'Coimbatore',
      state: 'Tamil Nadu',
      pinCode: '641004',
      country: 'India',
      gstStateCode: '33'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '33AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      cin: 'U17111TZ2010PTC015890',
      udyamRegistrationNumber: 'UDYAM-TN-03-0012345'
    },
    financialDetails: {
      paymentTerms: '30_days',
      creditLimit: 5000000,
      openingBalance: 250000,
      openingBalanceType: 'payable',
      preferredPaymentMethod: 'bank_transfer',
      bankAccountHolderName: 'Sree Kumar Texind Corporation',
      bankName: 'State Bank of India',
      bankAccountNumber: '30918274650',
      ifscCode: 'SBIN0001234',
      branchName: 'Main Branch Coimbatore',
      upiId: 'sreekumar@sbi'
    },
    communication: {
      officialEmail: 'contact@sreekumartex.com',
      officePhone: '0422-2578900',
      mobileNumber: '9842212345',
      website: 'https://sreekumartex.com'
    },
    notes: 'Key partner for premium cotton yarn processing',
    status: 'active',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    createdBy: 'admin-uid',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
    schemaVersion: 1,
    primaryContactName: 'K. Senthil Kumar',
    primaryContactPhone: '9842212345',
    primaryContactEmail: 'senthil@sreekumartex.com',
    subcompanyCount: 2
  },
  {
    vendorId: 'v-102',
    id: 'v-102',
    vendorCode: 'VND-000002',
    companyName: 'Paramount Apparel Processing',
    legalCompanyName: 'Paramount Apparel India Pvt Ltd',
    vendorType: 'customer',
    vendorCategory: 'main_company',
    parentVendorId: null,
    businessDescription: 'Export garments washing and specialty denim washing client',
    address: {
      addressLine1: '12 Mangalam Road',
      city: 'Tirupur',
      district: 'Tirupur',
      state: 'Tamil Nadu',
      pinCode: '641604',
      country: 'India',
      gstStateCode: '33'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '33BBBBB1111B1Z2',
      pan: 'BBBBB1111B'
    },
    financialDetails: {
      paymentTerms: '45_days',
      creditLimit: 3000000,
      openingBalance: 120000,
      openingBalanceType: 'receivable',
      preferredPaymentMethod: 'bank_transfer',
      bankAccountHolderName: 'Paramount Apparel India Pvt Ltd',
      bankName: 'HDFC Bank',
      bankAccountNumber: '50200012345678',
      ifscCode: 'HDFC0000123',
      branchName: 'Tirupur Main'
    },
    communication: {
      officialEmail: 'info@paramountapparel.com',
      officePhone: '0421-2244556',
      mobileNumber: '9894011223'
    },
    notes: 'Requires eco-friendly GOTS certified washing dyes',
    status: 'active',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    createdBy: 'manager-uid',
    updatedAt: new Date().toISOString(),
    updatedBy: 'manager-uid',
    schemaVersion: 1,
    primaryContactName: 'R. Rajesh',
    primaryContactPhone: '9894011223',
    primaryContactEmail: 'rajesh@paramountapparel.com',
    subcompanyCount: 0
  },
  {
    vendorId: 'v-103',
    id: 'v-103',
    vendorCode: 'VND-000003',
    companyName: 'Sree Kumar Subcontractor Unit A',
    legalCompanyName: 'Sree Kumar Texind Unit A Subcontracting',
    vendorType: 'supplier',
    vendorCategory: 'subcontractor',
    parentVendorId: 'v-101',
    businessDescription: 'Jobwork garment washing & enzyme treatment subcontract unit',
    address: {
      addressLine1: '88 SIDCO Industrial Estate',
      city: 'Coimbatore',
      district: 'Coimbatore',
      state: 'Tamil Nadu',
      pinCode: '641021',
      country: 'India',
      gstStateCode: '33'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '33CCCCC2222C1Z9',
      pan: 'CCCCC2222C'
    },
    financialDetails: {
      paymentTerms: '15_days',
      creditLimit: 1000000,
      openingBalance: 0,
      openingBalanceType: 'none',
      preferredPaymentMethod: 'bank_transfer',
      bankAccountHolderName: 'Sree Kumar Subcontractor Unit A',
      bankName: 'ICICI Bank',
      bankAccountNumber: '001205001234',
      ifscCode: 'ICIC0000012',
      branchName: 'Coimbatore SIDCO'
    },
    communication: {
      officialEmail: 'unita@sreekumartex.com',
      officePhone: '0422-2678100',
      mobileNumber: '9789012345'
    },
    notes: 'Subcontracting unit under Sree Kumar Texind Parent',
    status: 'active',
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    createdBy: 'admin-uid',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
    schemaVersion: 1,
    primaryContactName: 'M. Anand',
    primaryContactPhone: '9789012345',
    primaryContactEmail: 'anand@sreekumartex.com',
    subcompanyCount: 0
  },
  {
    vendorId: 'v-104',
    id: 'v-104',
    vendorCode: 'VND-000004',
    companyName: 'Perla Dyes & Auxiliaries Chemical Ltd',
    legalCompanyName: 'Perla Dyes & Auxiliaries Chemical India Pvt Ltd',
    vendorType: 'supplier',
    vendorCategory: 'main_company',
    parentVendorId: null,
    businessDescription: 'Raw material chemical supplier for reactive dyes and softening agents',
    address: {
      addressLine1: 'Plot 104 GIDC Chemical Complex',
      city: 'Ahmedabad',
      district: 'Ahmedabad',
      state: 'Gujarat',
      pinCode: '382445',
      country: 'India',
      gstStateCode: '24'
    },
    taxDetails: {
      gstRegistrationStatus: 'registered',
      gstin: '24DDDDD3333D1Z4',
      pan: 'DDDDD3333D'
    },
    financialDetails: {
      paymentTerms: '60_days',
      creditLimit: 10000000,
      openingBalance: 450000,
      openingBalanceType: 'payable',
      preferredPaymentMethod: 'bank_transfer',
      bankAccountHolderName: 'Perla Dyes & Auxiliaries Chemical Ltd',
      bankName: 'Axis Bank',
      bankAccountNumber: '918020012345678',
      ifscCode: 'UTIB0000045',
      branchName: 'Ahmedabad GIDC'
    },
    communication: {
      officialEmail: 'sales@perladyes.com',
      officePhone: '079-25890011',
      mobileNumber: '9909012345',
      website: 'https://perladyes.com'
    },
    notes: 'Bulk supplier for reactive blue, bio-polishing enzymes, and fixing agents',
    status: 'active',
    createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
    createdBy: 'admin-uid',
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin-uid',
    schemaVersion: 1,
    primaryContactName: 'J. Patel',
    primaryContactPhone: '9909012345',
    primaryContactEmail: 'jpatel@perladyes.com',
    subcompanyCount: 0
  },
  {
    vendorId: 'v-105',
    id: 'v-105',
    vendorCode: 'VND-000005',
    companyName: 'Lalitha Logistics Transporters',
    legalCompanyName: 'Lalitha Goods Transports LLP',
    vendorType: 'supplier',
    vendorCategory: 'transporter',
    parentVendorId: null,
    businessDescription: 'Inter-state fabric transport and chemical drum logistics',
    address: {
      addressLine1: '23 Truck Terminal Complex',
      city: 'Salem',
      district: 'Salem',
      state: 'Tamil Nadu',
      pinCode: '636005',
      country: 'India',
      gstStateCode: '33'
    },
    taxDetails: {
      gstRegistrationStatus: 'composition',
      gstin: '33EEEEE4444E1Z1',
      pan: 'EEEEE4444E'
    },
    financialDetails: {
      paymentTerms: '7_days',
      creditLimit: 500000,
      openingBalance: 15000,
      openingBalanceType: 'payable',
      preferredPaymentMethod: 'upi',
      upiId: 'lalithatransport@paytm'
    },
    communication: {
      officialEmail: 'dispatch@lalithatransport.com',
      officePhone: '0427-2345678',
      mobileNumber: '9443212345'
    },
    notes: 'Provides specialized covered container trucks for finished dyed garments',
    status: 'inactive',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    createdBy: 'manager-uid',
    updatedAt: new Date().toISOString(),
    updatedBy: 'manager-uid',
    schemaVersion: 1,
    primaryContactName: 'P. Murugan',
    primaryContactPhone: '9443212345',
    subcompanyCount: 0
  }
];

export const initialMockContacts: Record<string, VendorContact[]> = {
  'v-101': [
    {
      contactId: 'c-1',
      vendorId: 'v-101',
      personName: 'K. Senthil Kumar',
      designation: 'Managing Director',
      department: 'Management',
      contactNumber: '9842212345',
      email: 'senthil@sreekumartex.com',
      preferredContactMethod: 'phone',
      isPrimary: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin-uid',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid'
    },
    {
      contactId: 'c-2',
      vendorId: 'v-101',
      personName: 'V. Prakash',
      designation: 'Accounts & Finance Manager',
      department: 'Finance',
      contactNumber: '9842299887',
      email: 'prakash.accounts@sreekumartex.com',
      preferredContactMethod: 'email',
      isPrimary: false,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'admin-uid',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin-uid'
    }
  ],
  'v-102': [
    {
      contactId: 'c-3',
      vendorId: 'v-102',
      personName: 'R. Rajesh',
      designation: 'Sourcing & Production Head',
      department: 'Production',
      contactNumber: '9894011223',
      email: 'rajesh@paramountapparel.com',
      preferredContactMethod: 'whatsapp',
      isPrimary: true,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: 'manager-uid',
      updatedAt: new Date().toISOString(),
      updatedBy: 'manager-uid'
    }
  ]
};

export const initialMockLogs: Record<string, VendorAuditLog[]> = {
  'v-101': [
    {
      auditId: 'log-1',
      vendorId: 'v-101',
      action: 'created',
      performedBy: 'Admin (Thiru M.)',
      performedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      summary: 'Created vendor Sree Kumar Texind Corporation with Vendor Code VND-000001.'
    },
    {
      auditId: 'log-2',
      vendorId: 'v-101',
      action: 'contact_added',
      performedBy: 'Admin (Thiru M.)',
      performedAt: new Date(Date.now() - 25 * 86400000).toISOString(),
      summary: 'Added primary contact K. Senthil Kumar.'
    }
  ]
};

const DEMO_VENDORS_KEY = 'perla_demo_vendors_v1';

function getLocalDemoVendors(): Vendor[] {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const data = localStorage.getItem(DEMO_VENDORS_KEY);
      if (data) return JSON.parse(data);
      localStorage.setItem(DEMO_VENDORS_KEY, JSON.stringify(initialMockVendors));
    } catch (e) {
      console.error('Failed to read demo vendors from localStorage', e);
    }
  }
  return initialMockVendors;
}

function saveLocalDemoVendors(vendors: Vendor[]) {
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      localStorage.setItem(DEMO_VENDORS_KEY, JSON.stringify(vendors));
    } catch (e) {
      console.error('Failed to save demo vendors to localStorage', e);
    }
  }
}

export class VendorService {
  /**
   * Fetch Vendors with searching, filtering, and pagination support.
   * Directly reads from Firebase Firestore `vendors` collection.
   */
  static async getVendors(
    filters: VendorFilterOptions = {},
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 10 },
    isDemo: boolean = false
  ): Promise<{ vendors: Vendor[]; pagination: VendorPagination; parentCompanies?: string[] }> {
    let allVendors: Vendor[] = [];

    if (!isDemo) {
      try {
        const snap = await getDocs(collection(db, 'vendors'));
        if (!snap.empty) {
          allVendors = (snap.docs.map((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            return {
              ...data,
              id: docId,
              vendorId: data.vendorId || docId,
              docId
            };
          }) as unknown) as Vendor[];
          saveLocalDemoVendors(allVendors);
        } else {
          allVendors = [];
          if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
            try {
              localStorage.removeItem(DEMO_VENDORS_KEY);
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (err) {
        console.warn('Firestore fetch failed:', err);
        allVendors = [];
      }
    } else {
      allVendors = getLocalDemoVendors();
    }

    // Resolve parent company names across all vendors
    const vendorNameMap = new Map<string, string>();
    allVendors.forEach((v) => {
      if (v.vendorId) vendorNameMap.set(v.vendorId, v.companyName);
      if (v.id) vendorNameMap.set(v.id, v.companyName);
    });

    allVendors.forEach((v) => {
      if (v.vendorCategory !== 'main_company' && v.parentVendorId && vendorNameMap.has(v.parentVendorId)) {
        v.parentVendorName = vendorNameMap.get(v.parentVendorId);
      }
    });

    // Apply Client-Side / Query filtering
    let filtered = [...allVendors];

    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.companyName.toLowerCase().includes(q) ||
          (v.parentVendorName && v.parentVendorName.toLowerCase().includes(q)) ||
          (v.vendorCode && v.vendorCode.toLowerCase().includes(q)) ||
          (v.taxDetails?.gstin && v.taxDetails.gstin.toLowerCase().includes(q)) ||
          (v.communication?.officePhone && v.communication.officePhone.includes(q)) ||
          (v.communication?.mobileNumber && v.communication.mobileNumber.includes(q)) ||
          (v.communication?.officialEmail && v.communication.officialEmail.toLowerCase().includes(q)) ||
          (v.primaryContactName && v.primaryContactName.toLowerCase().includes(q))
      );
    }

    if (filters.vendorType && filters.vendorType !== 'all') {
      filtered = filtered.filter((v) => v.vendorType === filters.vendorType);
    }

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter((v) => v.status === filters.status);
    }

    if (filters.state && filters.state.trim().length > 0) {
      filtered = filtered.filter(
        (v) => v.address?.state?.toLowerCase() === filters.state?.toLowerCase()
      );
    }

    if (filters.gstStatus && filters.gstStatus !== 'all') {
      filtered = filtered.filter(
        (v) => v.taxDetails?.gstRegistrationStatus === filters.gstStatus
      );
    }

    if (filters.hasSubcompany !== undefined && filters.hasSubcompany !== 'all') {
      filtered = filtered.filter((v) =>
        filters.hasSubcompany
          ? (v.subcompanyCount && v.subcompanyCount > 0) || v.vendorCategory === 'subcompany'
          : !v.subcompanyCount || v.subcompanyCount === 0
      );
    }

    if (filters.parentVendorId && filters.parentVendorId !== 'all') {
      filtered = filtered.filter((v) => v.parentVendorId === filters.parentVendorId);
    }

    if (filters.parentCompanyName && filters.parentCompanyName !== 'all') {
      if (filters.parentCompanyName === 'none') {
        filtered = filtered.filter(
          (v) => !v.parentVendorId || v.vendorCategory === 'main_company'
        );
      } else if (filters.parentCompanyName === 'has_parent') {
        filtered = filtered.filter(
          (v) => Boolean(v.parentVendorId) && v.vendorCategory !== 'main_company'
        );
      } else {
        const target = filters.parentCompanyName.toLowerCase().trim();
        filtered = filtered.filter((v) => {
          const pName =
            v.parentVendorName ||
            (v.parentVendorId ? vendorNameMap.get(v.parentVendorId) : null);
          return pName?.toLowerCase() === target;
        });
      }
    }

    if (filters.missingDetails) {
      filtered = filtered.filter(
        (v) =>
          (v.taxDetails?.gstRegistrationStatus === 'registered' && !v.taxDetails?.gstin) ||
          !v.primaryContactName ||
          (!v.communication?.officialEmail && !v.communication?.mobileNumber)
      );
    }

    // Sort by latest created first
    filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Extract all unique parent company names across the entire vendor directory
    const distinctParentNames = Array.from(
      new Set(
        allVendors
          .map((v) =>
            v.parentVendorName ||
            (v.parentVendorId ? vendorNameMap.get(v.parentVendorId) : null)
          )
          .filter((name): name is string => Boolean(name && name.trim().length > 0))
      )
    ).sort();

    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / pagination.pageSize) || 1;
    const currentPage = Math.min(Math.max(1, pagination.page), totalPages);
    const startIndex = (currentPage - 1) * pagination.pageSize;
    const paginatedVendors = filtered.slice(startIndex, startIndex + pagination.pageSize);

    return {
      vendors: paginatedVendors,
      pagination: {
        page: currentPage,
        pageSize: pagination.pageSize,
        totalRecords,
        totalPages
      },
      parentCompanies: distinctParentNames
    };
  }

  /**
   * Fetch single vendor by ID directly from Firestore with contacts, documents, and audit logs.
   */
  static async getVendorById(
    vendorId: string,
    isDemo: boolean = false
  ): Promise<{
    vendor: Vendor | null;
    contacts: VendorContact[];
    subcompanies: Vendor[];
    parentVendor: Vendor | null;
    documents: VendorDocument[];
    logs: VendorAuditLog[];
  }> {
    let vendor: Vendor | null = null;
    let contacts: VendorContact[] = [];
    let subcompanies: Vendor[] = [];
    let parentVendor: Vendor | null = null;
    let documents: VendorDocument[] = [];
    let logs: VendorAuditLog[] = [];

    try {
      const vSnap = await getDoc(doc(db, 'vendors', vendorId));
      if (vSnap.exists()) {
        vendor = { vendorId: vSnap.id, id: vSnap.id, ...vSnap.data() } as Vendor;

        // Fetch contacts subcollection from Firestore
        const cSnap = await getDocs(collection(db, 'vendors', vendorId, 'contacts'));
        if (!cSnap.empty) {
          contacts = cSnap.docs.map((d) => ({ contactId: d.id, ...d.data() })) as VendorContact[];
        }

        // Fetch documents subcollection
        const dSnap = await getDocs(collection(db, 'vendors', vendorId, 'documents'));
        if (!dSnap.empty) {
          documents = dSnap.docs.map((d) => ({ documentId: d.id, ...d.data() })) as VendorDocument[];
        }

        // Fetch audit logs
        const lSnap = await getDocs(query(collection(db, 'vendor_audit_logs'), where('vendorId', '==', vendorId)));
        if (!lSnap.empty) {
          logs = lSnap.docs.map((d) => ({ auditId: d.id, ...d.data() })) as VendorAuditLog[];
        }
      }
    } catch (err) {
      console.warn('Firestore fetch vendor by ID failed:', err);
    }

    if (!vendor && isDemo) {
      const allVendors = getLocalDemoVendors();
      vendor = allVendors.find((v) => v.vendorId === vendorId) || null;
    }

    if (vendor) {
      if (isDemo) {
        const allVendors = getLocalDemoVendors();
        subcompanies = allVendors.filter((v) => v.parentVendorId === vendorId);
        parentVendor = vendor.parentVendorId
          ? allVendors.find((v) => v.vendorId === vendor.parentVendorId) || null
          : null;

        if (contacts.length === 0) {
          contacts = initialMockContacts[vendorId] || [
            {
              contactId: `cnt_${vendorId}`,
              vendorId,
              personName: vendor.primaryContactName || 'Primary Representative',
              contactNumber: vendor.primaryContactPhone || vendor.communication?.mobileNumber || '9842200000',
              email: vendor.primaryContactEmail || vendor.communication?.officialEmail || '',
              isPrimary: true,
              status: 'active',
              createdAt: new Date().toISOString(),
              createdBy: 'system',
              updatedAt: new Date().toISOString(),
              updatedBy: 'system'
            }
          ];
        }

        if (logs.length === 0) {
          logs = initialMockLogs[vendorId] || [
            {
              auditId: `log_${vendorId}`,
              vendorId,
              action: 'created',
              performedBy: 'System',
              performedAt: vendor.createdAt || new Date().toISOString(),
              summary: `Vendor ${vendor.companyName} record created.`
            }
          ];
        }
      }
    }

    return {
      vendor,
      contacts,
      subcompanies,
      parentVendor,
      documents,
      logs
    };
  }

  /**
   * Create Vendor directly in Firebase Firestore with atomic code generation.
   */
  static async createVendor(
    vendorData: Partial<Vendor>,
    contacts: Partial<VendorContact>[] = [],
    userId: string = 'admin-uid',
    isDemo: boolean = false
  ): Promise<{ vendorId: string; vendorCode: string }> {
    const now = new Date().toISOString();
    const vendorRef = doc(collection(db, 'vendors'));
    const vendorId = vendorRef.id;

    let vendorCode = '';

    // Atomic Vendor Code generation using Firestore Transaction with safe fallback
    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'vendor_counters', 'vendor_code');
        const counterDoc = await transaction.get(counterRef);

        let nextVal = 1;
        if (counterDoc.exists()) {
          nextVal = (counterDoc.data()?.currentValue || 0) + 1;
        }

        transaction.set(
          counterRef,
          { counterKey: 'vendor_code', currentValue: nextVal, updatedAt: now },
          { merge: true }
        );
        vendorCode = `VND-${String(nextVal).padStart(6, '0')}`;
      });
    } catch (err) {
      console.warn('Firestore counter transaction failed, falling back to counting vendor docs:', err);
      try {
        const snap = await getDocs(collection(db, 'vendors'));
        const nextNumber = snap.size + 1;
        vendorCode = `VND-${String(nextNumber).padStart(6, '0')}`;
      } catch {
        const existing = getLocalDemoVendors();
        vendorCode = `VND-${String(existing.length + 1).padStart(6, '0')}`;
      }
    }

    const primaryContact = contacts.find((c) => c.isPrimary && c.status !== 'inactive') || contacts[0];

    const newVendor: Vendor = {
      vendorId,
      id: vendorId,
      vendorCode,
      companyName: vendorData.companyName || 'New Company',
      legalCompanyName: vendorData.legalCompanyName || '',
      vendorType: vendorData.vendorType || 'customer',
      vendorCategory: vendorData.vendorCategory || 'main_company',
      parentVendorId: vendorData.parentVendorId || null,
      businessDescription: vendorData.businessDescription || '',
      address: vendorData.address || {
        addressLine1: 'Address 1',
        state: 'Tamil Nadu',
        country: 'India'
      },
      taxDetails: vendorData.taxDetails || { gstRegistrationStatus: 'unregistered' },
      financialDetails: vendorData.financialDetails || { paymentTerms: '30_days' },
      communication: vendorData.communication || {},
      notes: vendorData.notes || '',
      status: vendorData.status || 'active',
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      schemaVersion: 1,
      primaryContactName: primaryContact?.personName,
      primaryContactPhone: primaryContact?.contactNumber,
      primaryContactEmail: primaryContact?.email,
      subcompanyCount: 0
    };

    // 1. Primary write to live Firebase Firestore `vendors` collection
    try {
      const cleanedVendor = cleanFirestoreData(newVendor);
      await setDoc(vendorRef, cleanedVendor);
      console.log(`Successfully created vendor ${vendorCode} (ID: ${vendorId}) in live Firebase Firestore!`);
    } catch (err: any) {
      console.error('Failed writing vendor to live Firestore:', err);
      throw new Error(`Failed to save vendor to Firestore: ${err?.message || err}`);
    }

    // 2. Write contacts to Firestore subcollection (isolated try/catch so subcollection won't block vendor creation)
    try {
      const validContacts = contacts.filter((c) => c.personName?.trim() || c.contactNumber?.trim());
      for (const c of validContacts) {
        const cRef = doc(collection(db, 'vendors', vendorId, 'contacts'));
        await setDoc(cRef, cleanFirestoreData({
          ...c,
          contactId: cRef.id,
          vendorId,
          personName: c.personName?.trim() || 'Primary Contact',
          contactNumber: c.contactNumber?.trim() || '',
          isPrimary: Boolean(c.isPrimary),
          status: c.status || 'active',
          createdAt: now,
          createdBy: userId,
          updatedAt: now,
          updatedBy: userId
        }));
      }
    } catch (contactErr) {
      console.warn('Could not write vendor contacts subcollection to Firestore:', contactErr);
    }

    // 3. Write Audit Log to Firestore `vendor_audit_logs` collection (isolated try/catch)
    try {
      const logRef = doc(collection(db, 'vendor_audit_logs'));
      await setDoc(logRef, cleanFirestoreData({
        auditId: logRef.id,
        vendorId,
        action: 'created',
        performedBy: userId,
        performedAt: now,
        summary: `Vendor '${newVendor.companyName}' created with code ${vendorCode}.`
      }));
    } catch (logErr) {
      console.warn('Could not write vendor audit log to Firestore:', logErr);
    }

    // Keep local storage backup in sync
    const existing = getLocalDemoVendors();
    saveLocalDemoVendors([newVendor, ...existing]);

    return { vendorId, vendorCode };
  }

  /**
   * Update Vendor record directly in Firebase Firestore.
   */
  static async updateVendor(
    vendorId: string,
    updates: Partial<Vendor>,
    userId: string = 'admin-uid',
    isDemo: boolean = false
  ): Promise<boolean> {
    const now = new Date().toISOString();

    // 1. Update Vendor in Firestore
    try {
      const vRef = doc(db, 'vendors', vendorId);
      await updateDoc(vRef, cleanFirestoreData({
        ...updates,
        updatedAt: now,
        updatedBy: userId
      }));
    } catch (err) {
      console.error('Firestore update failed:', err);
      throw new Error(`Failed to update vendor in Firestore: ${(err as any)?.message || err}`);
    }

    // 2. Write Audit Log to Firestore (isolated try/catch)
    try {
      const logRef = doc(collection(db, 'vendor_audit_logs'));
      await setDoc(logRef, cleanFirestoreData({
        auditId: logRef.id,
        vendorId,
        action: 'updated',
        performedBy: userId,
        performedAt: now,
        changedFields: Object.keys(updates),
        summary: `Updated vendor fields: ${Object.keys(updates).join(', ')}`
      }));
    } catch (logErr) {
      console.warn('Could not write update audit log to Firestore:', logErr);
    }

    const existing = getLocalDemoVendors();
    const index = existing.findIndex((v) => v.vendorId === vendorId);
    if (index !== -1) {
      existing[index] = { ...existing[index], ...updates, updatedAt: now, updatedBy: userId };
      saveLocalDemoVendors(existing);
    }

    return true;
  }

  /**
   * Set Vendor Status (active/inactive) directly in Firebase Firestore.
   */
  static async setVendorStatus(
    vendorId: string,
    status: VendorStatus,
    userId: string = 'admin-uid',
    reason?: string
  ): Promise<boolean> {
    const now = new Date().toISOString();

    try {
      const vRef = doc(db, 'vendors', vendorId);
      await updateDoc(vRef, {
        status,
        updatedAt: now,
        updatedBy: userId
      });

      const logRef = doc(collection(db, 'vendor_audit_logs'));
      await setDoc(logRef, {
        auditId: logRef.id,
        vendorId,
        action: status === 'active' ? 'activated' : 'deactivated',
        performedBy: userId,
        performedAt: now,
        summary: `Vendor status set to ${status}${reason ? `. Reason: ${reason}` : ''}`
      });
    } catch (err) {
      console.warn('Firestore setVendorStatus failed:', err);
    }

    const existing = getLocalDemoVendors();
    const vendor = existing.find((v) => v.vendorId === vendorId);
    if (vendor) {
      vendor.status = status;
      vendor.updatedAt = now;
      vendor.updatedBy = userId;
      saveLocalDemoVendors(existing);
    }

    return true;
  }

  /**
   * Add a new Contact to Vendor in Firebase Firestore.
   */
  static async addContact(
    vendorId: string,
    contact: Partial<VendorContact>,
    userId: string = 'admin-uid'
  ): Promise<VendorContact> {
    const now = new Date().toISOString();
    const cRef = doc(collection(db, 'vendors', vendorId, 'contacts'));
    const contactId = cRef.id;

    const newContact: VendorContact = {
      contactId,
      vendorId,
      personName: contact.personName || 'Contact Person',
      designation: contact.designation || '',
      department: contact.department || '',
      contactNumber: contact.contactNumber || '9000000000',
      alternateNumber: contact.alternateNumber || '',
      email: contact.email || '',
      preferredContactMethod: contact.preferredContactMethod || 'phone',
      isPrimary: Boolean(contact.isPrimary),
      notes: contact.notes || '',
      status: contact.status || 'active',
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId
    };

    try {
      await setDoc(cRef, newContact);

      // Write audit log to Firestore
      const logRef = doc(collection(db, 'vendor_audit_logs'));
      await setDoc(logRef, {
        auditId: logRef.id,
        vendorId,
        action: 'contact_added',
        performedBy: userId,
        performedAt: now,
        summary: `Added contact '${newContact.personName}'`
      });
    } catch (err) {
      console.warn('Firestore addContact failed:', err);
    }

    const contacts = initialMockContacts[vendorId] || [];
    contacts.push(newContact);
    initialMockContacts[vendorId] = contacts;

    return newContact;
  }

  /**
   * Upload Document attachment to Firebase Storage & Firestore metadata.
   */
  static async uploadDocument(
    vendorId: string,
    file: File,
    documentType: DocumentType,
    userId: string = 'admin-uid'
  ): Promise<VendorDocument> {
    const docId = `doc_${Date.now()}`;
    const storagePath = `vendor_documents/${vendorId}/${docId}_${file.name}`;
    const now = new Date().toISOString();

    let downloadUrl = '';
    try {
      if (storage) {
        const fileRef = ref(storage, storagePath);
        await uploadBytes(fileRef, file);
        downloadUrl = await getDownloadURL(fileRef);
      }
    } catch (err) {
      console.warn('Storage upload unavailable, using blob URL preview', err);
      downloadUrl = URL.createObjectURL(file);
    }

    const docRecord: VendorDocument = {
      documentId: docId,
      vendorId,
      documentType,
      fileName: file.name,
      storagePath,
      contentType: file.type || 'application/pdf',
      fileSize: file.size,
      uploadedAt: now,
      uploadedBy: userId,
      status: 'active',
      downloadUrl
    };

    try {
      const dRef = doc(db, 'vendors', vendorId, 'documents', docId);
      await setDoc(dRef, docRecord);
    } catch (err) {
      console.warn('Firestore document metadata write failed:', err);
    }

    return docRecord;
  }

  /**
   * Check for probable duplicate vendors before creating.
   */
  static async checkDuplicateVendor(
    companyName: string,
    gstin?: string,
    vendorCode?: string
  ): Promise<{ isDuplicate: boolean; matchedVendor?: Vendor; matchReason?: string }> {
    const all = getLocalDemoVendors();
    const normalizedName = companyName.trim().toLowerCase();

    for (const v of all) {
      if (v.companyName.trim().toLowerCase() === normalizedName) {
        return {
          isDuplicate: true,
          matchedVendor: v,
          matchReason: `Exact company name match: "${v.companyName}" (${v.vendorCode})`
        };
      }
      if (gstin && v.taxDetails?.gstin && v.taxDetails.gstin.trim().toUpperCase() === gstin.trim().toUpperCase()) {
        return {
          isDuplicate: true,
          matchedVendor: v,
          matchReason: `Matching GSTIN: "${v.taxDetails.gstin}" (${v.companyName})`
        };
      }
      if (vendorCode && v.vendorCode.trim().toUpperCase() === vendorCode.trim().toUpperCase()) {
        return {
          isDuplicate: true,
          matchedVendor: v,
          matchReason: `Duplicate Vendor Code: "${v.vendorCode}"`
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Get Dashboard Summary Metrics directly from Firestore.
   */
  static async getDashboardMetrics(isDemo: boolean = false): Promise<{
    totalVendors: number;
    activeVendors: number;
    inactiveVendors: number;
    customers: number;
    suppliers: number;
    bothCount: number;
    subcompanyCount: number;
    missingDetailsCount: number;
  }> {
    let all: Vendor[] = [];

    try {
      const snap = await getDocs(collection(db, 'vendors'));
      if (!snap.empty) {
        all = snap.docs.map((d) => ({ vendorId: d.id, ...d.data() })) as Vendor[];
      } else {
        all = getLocalDemoVendors();
      }
    } catch (err) {
      all = getLocalDemoVendors();
    }

    const activeVendors = all.filter((v) => v.status === 'active').length;
    const inactiveVendors = all.filter((v) => v.status === 'inactive').length;
    const customers = all.filter((v) => v.vendorType === 'customer').length;
    const suppliers = all.filter((v) => v.vendorType === 'supplier').length;
    const bothCount = all.filter((v) => v.vendorType === 'both').length;
    const subcompanyCount = all.filter(
      (v) => v.vendorCategory === 'subcontractor' || v.vendorCategory === 'subcompany' || Boolean(v.parentVendorId)
    ).length;

    const missingDetailsCount = all.filter(
      (v) =>
        (v.taxDetails?.gstRegistrationStatus === 'registered' && !v.taxDetails?.gstin) ||
        !v.primaryContactName ||
        (!v.communication?.officialEmail && !v.communication?.mobileNumber)
    ).length;

    return {
      totalVendors: all.length,
      activeVendors,
      inactiveVendors,
      customers,
      suppliers,
      bothCount,
      subcompanyCount,
      missingDetailsCount
    };
  }
}
