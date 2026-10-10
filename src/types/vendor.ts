export type VendorType = 'customer' | 'supplier' | 'both';

export type VendorCategory =
  | 'main_company'
  | 'subcontractor'
  | 'subcompany'
  | 'transporter'
  | 'other';

export type GSTRegistrationStatus =
  | 'registered'
  | 'unregistered'
  | 'composition'
  | 'not_applicable';

export type PaymentTerms =
  | 'immediate'
  | '7_days'
  | '15_days'
  | '30_days'
  | '45_days'
  | '60_days'
  | 'custom';

export type OpeningBalanceType = 'receivable' | 'payable' | 'none';

export type PreferredPaymentMethod =
  | 'bank_transfer'
  | 'upi'
  | 'cheque'
  | 'cash'
  | 'other';

export type PreferredContactMethod = 'phone' | 'email' | 'whatsapp';

export type DocumentType =
  | 'gst_certificate'
  | 'pan_document'
  | 'bank_proof'
  | 'business_agreement'
  | 'other';

export type VendorStatus = 'active' | 'inactive';
export type DocumentStatus = 'active' | 'archived';

export interface VendorAddress {
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  state: string;
  pinCode?: string;
  country: string;
  gstStateCode?: string;
}

export interface VendorTaxDetails {
  gstRegistrationStatus: GSTRegistrationStatus;
  gstin?: string;
  pan?: string;
  cin?: string;
  udyamRegistrationNumber?: string;
  otherRegistrationNumber?: string;
}

export interface VendorFinancialDetails {
  paymentTerms: PaymentTerms;
  customPaymentDays?: number;
  creditLimit?: number;
  openingBalance?: number;
  openingBalanceType?: OpeningBalanceType;
  preferredPaymentMethod?: PreferredPaymentMethod;
  bankAccountHolderName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  upiId?: string;
}

export interface VendorCommunication {
  officialEmail?: string;
  officePhone?: string;
  mobileNumber?: string;
  website?: string;
  alternateContactNumber?: string;
}

export interface Vendor {
  vendorId: string;
  vendorCode: string;
  companyName: string;
  legalCompanyName?: string;
  vendorType: VendorType;
  vendorCategory: VendorCategory;
  parentVendorId?: string | null;
  businessDescription?: string;
  address: VendorAddress;
  taxDetails: VendorTaxDetails;
  financialDetails: VendorFinancialDetails;
  communication: VendorCommunication;
  notes?: string;
  status: VendorStatus;
  createdAt: any;
  createdBy: string;
  updatedAt: any;
  updatedBy: string;
  schemaVersion: number;

  // Backward compatibility & Flutter cross-module helpers
  id?: string;
  roles?: string[];
  city?: string;
  state?: string;
  pinCode?: string;
  stateCode?: string;
  gstin?: string;
  pan?: string;
  paymentTerms?: string;
  email?: string;
  phone?: string;
  active?: boolean;
  contacts?: VendorContact[];

  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  subcompanyCount?: number;
}

export interface VendorContact {
  contactId: string;
  vendorId: string;
  personName: string;
  designation?: string;
  department?: string;
  contactNumber: string;
  alternateNumber?: string;
  email?: string;
  preferredContactMethod?: PreferredContactMethod;
  isPrimary: boolean;
  notes?: string;
  status: VendorStatus;
  createdAt: any;
  createdBy: string;
  updatedAt: any;
  updatedBy: string;
}

export interface VendorDocument {
  documentId: string;
  vendorId: string;
  documentType: DocumentType;
  fileName: string;
  storagePath: string;
  contentType: string;
  fileSize: number;
  uploadedAt: any;
  uploadedBy: string;
  status: DocumentStatus;
  downloadUrl?: string;
}

export interface VendorCounter {
  counterKey: string;
  currentValue: number;
  updatedAt: any;
}

export type AuditAction =
  | 'created'
  | 'updated'
  | 'activated'
  | 'deactivated'
  | 'contact_added'
  | 'contact_updated'
  | 'contact_deactivated'
  | 'document_uploaded'
  | 'document_archived'
  | 'parent_changed';

export interface VendorAuditLog {
  auditId: string;
  vendorId: string;
  action: AuditAction;
  performedBy: string;
  performedAt: any;
  changedFields?: string[];
  summary?: string;
}

export interface VendorFilterOptions {
  searchQuery?: string;
  vendorType?: VendorType | 'all';
  status?: VendorStatus | 'all';
  state?: string;
  gstStatus?: GSTRegistrationStatus | 'all';
  hasSubcompany?: boolean | 'all';
  missingDetails?: boolean;
  startDate?: string;
  endDate?: string;
  parentVendorId?: string;
}

export interface VendorPagination {
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}
