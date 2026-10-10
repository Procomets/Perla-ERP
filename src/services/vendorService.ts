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
import { httpsCallable } from 'firebase/functions';
import { db, storage } from '../config/firebase';
import { getFunctions } from 'firebase/functions';
import app from '../config/firebase';
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

const functionsInstance = getFunctions(app);

// Seed initial mock data for seamless demo fallback
export const initialMockVendors: Vendor[] = [
  {
    vendorId: 'v-101',
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

// Local storage key for persistent demo state
const DEMO_VENDORS_KEY = 'perla_demo_vendors_v1';
const DEMO_CONTACTS_KEY = 'perla_demo_contacts_v1';
const DEMO_LOGS_KEY = 'perla_demo_logs_v1';

function getLocalDemoVendors(): Vendor[] {
  try {
    const data = localStorage.getItem(DEMO_VENDORS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to read demo vendors from localStorage', e);
  }
  localStorage.setItem(DEMO_VENDORS_KEY, JSON.stringify(initialMockVendors));
  return initialMockVendors;
}

function saveLocalDemoVendors(vendors: Vendor[]) {
  try {
    localStorage.setItem(DEMO_VENDORS_KEY, JSON.stringify(vendors));
  } catch (e) {
    console.error('Failed to save demo vendors to localStorage', e);
  }
}

export class VendorService {
  /**
   * Fetch Vendors with searching, filtering, and pagination support.
   */
  static async getVendors(
    filters: VendorFilterOptions = {},
    pagination: { page: number; pageSize: number } = { page: 1, pageSize: 10 },
    isDemo: boolean = false
  ): Promise<{ vendors: Vendor[]; pagination: VendorPagination }> {
    let allVendors: Vendor[] = [];

    if (!isDemo) {
      try {
        const q = query(collection(db, 'vendors'), orderBy('companyName', 'asc'), limit(100));
        const snap = await getDocs(q);
        if (!snap.empty) {
          allVendors = snap.docs.map((doc) => ({
            vendorId: doc.id,
            ...doc.data()
          })) as Vendor[];
        } else {
          allVendors = getLocalDemoVendors();
        }
      } catch (err) {
        console.warn('Firestore fetch failed, falling back to local demo vendor data', err);
        allVendors = getLocalDemoVendors();
      }
    } else {
      allVendors = getLocalDemoVendors();
    }

    // Apply Client-Side / Query filtering
    let filtered = [...allVendors];

    if (filters.searchQuery && filters.searchQuery.trim().length > 0) {
      const q = filters.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.companyName.toLowerCase().includes(q) ||
          v.vendorCode.toLowerCase().includes(q) ||
          (v.taxDetails.gstin && v.taxDetails.gstin.toLowerCase().includes(q)) ||
          (v.communication.officePhone && v.communication.officePhone.includes(q)) ||
          (v.communication.mobileNumber && v.communication.mobileNumber.includes(q)) ||
          (v.communication.officialEmail && v.communication.officialEmail.toLowerCase().includes(q)) ||
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
        (v) => v.address.state.toLowerCase() === filters.state?.toLowerCase()
      );
    }

    if (filters.gstStatus && filters.gstStatus !== 'all') {
      filtered = filtered.filter(
        (v) => v.taxDetails.gstRegistrationStatus === filters.gstStatus
      );
    }

    if (filters.hasSubcompany !== undefined && filters.hasSubcompany !== 'all') {
      filtered = filtered.filter((v) =>
        filters.hasSubcompany
          ? (v.subcompanyCount && v.subcompanyCount > 0) || v.vendorCategory === 'subcompany'
          : !v.subcompanyCount || v.subcompanyCount === 0
      );
    }

    if (filters.parentVendorId) {
      filtered = filtered.filter((v) => v.parentVendorId === filters.parentVendorId);
    }

    if (filters.missingDetails) {
      filtered = filtered.filter(
        (v) =>
          (v.taxDetails.gstRegistrationStatus === 'registered' && !v.taxDetails.gstin) ||
          !v.primaryContactName ||
          (!v.communication.officialEmail && !v.communication.mobileNumber)
      );
    }

    // Pagination calculations
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
      }
    };
  }

  /**
   * Fetch single vendor by ID with contacts, documents, and audit logs.
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
    const allVendors = getLocalDemoVendors();
    let vendor = allVendors.find((v) => v.vendorId === vendorId) || null;

    if (!isDemo && db) {
      try {
        const docRef = doc(db, 'vendors', vendorId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          vendor = { vendorId: snap.id, ...snap.data() } as Vendor;
        }
      } catch (err) {
        console.warn('Firestore fetch vendor by ID failed', err);
      }
    }

    if (!vendor) {
      return {
        vendor: null,
        contacts: [],
        subcompanies: [],
        parentVendor: null,
        documents: [],
        logs: []
      };
    }

    // Get child subcompanies
    const subcompanies = allVendors.filter((v) => v.parentVendorId === vendorId);
    const parentVendor = vendor.parentVendorId
      ? allVendors.find((v) => v.vendorId === vendor.parentVendorId) || null
      : null;

    // Contacts
    const contacts = initialMockContacts[vendorId] || [
      {
        contactId: `cnt_${vendorId}`,
        vendorId,
        personName: vendor.primaryContactName || 'Primary Representative',
        contactNumber: vendor.primaryContactPhone || vendor.communication.mobileNumber || '9842200000',
        email: vendor.primaryContactEmail || vendor.communication.officialEmail || '',
        isPrimary: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        updatedAt: new Date().toISOString(),
        updatedBy: 'system'
      }
    ];

    const logs = initialMockLogs[vendorId] || [
      {
        auditId: `log_${vendorId}`,
        vendorId,
        action: 'created',
        performedBy: 'System',
        performedAt: vendor.createdAt || new Date().toISOString(),
        summary: `Vendor ${vendor.companyName} record created.`
      }
    ];

    return {
      vendor,
      contacts,
      subcompanies,
      parentVendor,
      documents: [],
      logs
    };
  }

  /**
   * Create Vendor with atomic vendor code generation and validation.
   */
  static async createVendor(
    vendorData: Partial<Vendor>,
    contacts: Partial<VendorContact>[] = [],
    userId: string = 'admin-uid',
    isDemo: boolean = false
  ): Promise<{ vendorId: string; vendorCode: string }> {
    if (!isDemo) {
      try {
        // Attempt cloud function
        const createVendorFn = httpsCallable(functionsInstance, 'createVendor');
        const res: any = await createVendorFn({ ...vendorData, contacts });
        if (res.data?.vendorId && res.data?.vendorCode) {
          return { vendorId: res.data.vendorId, vendorCode: res.data.vendorCode };
        }
      } catch (err) {
        console.warn('Cloud function createVendor unavailable, using local atomic creation', err);
      }
    }

    // Local / Fallback Creation
    const existing = getLocalDemoVendors();
    const nextVal = existing.length + 1;
    const vendorCode = `VND-${String(nextVal).padStart(6, '0')}`;
    const vendorId = `v-${Date.now()}`;
    const now = new Date().toISOString();

    const primaryContact = contacts.find((c) => c.isPrimary && c.status !== 'inactive') || contacts[0];

    const newVendor: Vendor = {
      vendorId,
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

    const updatedVendors = [newVendor, ...existing];
    saveLocalDemoVendors(updatedVendors);

    // Save contacts
    initialMockContacts[vendorId] = contacts.map((c, idx) => ({
      contactId: c.contactId || `cnt_${Date.now()}_${idx}`,
      vendorId,
      personName: c.personName || 'Primary Contact',
      designation: c.designation || '',
      department: c.department || '',
      contactNumber: c.contactNumber || '9000000000',
      email: c.email || '',
      preferredContactMethod: c.preferredContactMethod || 'phone',
      isPrimary: c.isPrimary || idx === 0,
      notes: c.notes || '',
      status: c.status || 'active',
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId
    }));

    // Save audit log
    initialMockLogs[vendorId] = [
      {
        auditId: `log_${Date.now()}`,
        vendorId,
        action: 'created',
        performedBy: userId,
        performedAt: now,
        summary: `Vendor '${newVendor.companyName}' created with code ${vendorCode}.`
      }
    ];

    return { vendorId, vendorCode };
  }

  /**
   * Update Vendor record.
   */
  static async updateVendor(
    vendorId: string,
    updates: Partial<Vendor>,
    userId: string = 'admin-uid',
    isDemo: boolean = false
  ): Promise<boolean> {
    const existing = getLocalDemoVendors();
    const index = existing.findIndex((v) => v.vendorId === vendorId);
    if (index === -1) return false;

    // Validate Parent relationship cycle
    if (updates.parentVendorId !== undefined) {
      const vendorMap = new Map(existing.map((v) => [v.vendorId, { parentVendorId: v.parentVendorId }]));
      const val = validateParentRelationship(vendorId, updates.parentVendorId, vendorMap);
      if (!val.valid) {
        throw new Error(val.error || 'Invalid parent relationship');
      }
    }

    const now = new Date().toISOString();
    const updatedVendor = {
      ...existing[index],
      ...updates,
      updatedAt: now,
      updatedBy: userId
    };

    existing[index] = updatedVendor;
    saveLocalDemoVendors(existing);

    // Add Audit log
    const logs = initialMockLogs[vendorId] || [];
    logs.unshift({
      auditId: `log_${Date.now()}`,
      vendorId,
      action: 'updated',
      performedBy: userId,
      performedAt: now,
      changedFields: Object.keys(updates),
      summary: `Updated vendor fields: ${Object.keys(updates).join(', ')}`
    });
    initialMockLogs[vendorId] = logs;

    return true;
  }

  /**
   * Set Vendor Status (active/inactive).
   */
  static async setVendorStatus(
    vendorId: string,
    status: VendorStatus,
    userId: string = 'admin-uid',
    reason?: string
  ): Promise<boolean> {
    const existing = getLocalDemoVendors();
    const vendor = existing.find((v) => v.vendorId === vendorId);
    if (!vendor) return false;

    vendor.status = status;
    vendor.updatedAt = new Date().toISOString();
    vendor.updatedBy = userId;

    saveLocalDemoVendors(existing);

    const logs = initialMockLogs[vendorId] || [];
    logs.unshift({
      auditId: `log_${Date.now()}`,
      vendorId,
      action: status === 'active' ? 'activated' : 'deactivated',
      performedBy: userId,
      performedAt: new Date().toISOString(),
      summary: `Vendor status set to ${status}${reason ? `. Reason: ${reason}` : ''}`
    });
    initialMockLogs[vendorId] = logs;

    return true;
  }

  /**
   * Add a new Contact to Vendor.
   */
  static async addContact(
    vendorId: string,
    contact: Partial<VendorContact>,
    userId: string = 'admin-uid'
  ): Promise<VendorContact> {
    const contacts = initialMockContacts[vendorId] || [];

    // If new contact is primary, unmark existing primary contacts
    if (contact.isPrimary && contact.status !== 'inactive') {
      contacts.forEach((c) => {
        if (c.status === 'active') c.isPrimary = false;
      });
    }

    const now = new Date().toISOString();
    const newContact: VendorContact = {
      contactId: `cnt_${Date.now()}`,
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

    contacts.push(newContact);
    initialMockContacts[vendorId] = contacts;

    // Update vendor primary contact display helper
    const existing = getLocalDemoVendors();
    const vendor = existing.find((v) => v.vendorId === vendorId);
    if (vendor && newContact.isPrimary) {
      vendor.primaryContactName = newContact.personName;
      vendor.primaryContactPhone = newContact.contactNumber;
      vendor.primaryContactEmail = newContact.email;
      saveLocalDemoVendors(existing);
    }

    return newContact;
  }

  /**
   * Upload Document attachment.
   */
  static async uploadDocument(
    vendorId: string,
    file: File,
    documentType: DocumentType,
    userId: string = 'admin-uid'
  ): Promise<VendorDocument> {
    const docId = `doc_${Date.now()}`;
    const storagePath = `vendor_documents/${vendorId}/${docId}_${file.name}`;

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
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
      status: 'active',
      downloadUrl
    };

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
      if (gstin && v.taxDetails.gstin && v.taxDetails.gstin.trim().toUpperCase() === gstin.trim().toUpperCase()) {
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
   * Get Dashboard Summary Metrics.
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
    const all = getLocalDemoVendors();

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
        (v.taxDetails.gstRegistrationStatus === 'registered' && !v.taxDetails.gstin) ||
        !v.primaryContactName ||
        (!v.communication.officialEmail && !v.communication.mobileNumber)
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
