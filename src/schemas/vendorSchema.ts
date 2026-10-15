import { z } from 'zod';

export const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const phoneRegex = /^[0-9+\-\s]{10,15}$/;

export const vendorAddressSchema = z.object({
  addressLine1: z.string().min(1, 'Address Line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().min(1, 'State is required'),
  pinCode: z.string().optional(),
  country: z.string().default('India'),
  gstStateCode: z.string().optional()
});

export const vendorTaxDetailsSchema = z.object({
  gstRegistrationStatus: z.enum([
    'registered',
    'unregistered',
    'composition',
    'not_applicable'
  ]),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  cin: z.string().optional(),
  udyamRegistrationNumber: z.string().optional(),
  otherRegistrationNumber: z.string().optional()
}).refine(
  (data) => {
    if (data.gstRegistrationStatus === 'registered') {
      return Boolean(
        data.gstin &&
          data.gstin.trim().length > 0 &&
          gstinRegex.test(data.gstin.trim().toUpperCase())
      );
    }
    if (data.gstin && data.gstin.trim().length > 0) {
      return gstinRegex.test(data.gstin.trim().toUpperCase());
    }
    return true;
  },
  {
    message:
      'GSTIN is mandatory when GST Registration Status is Registered Regular, and must follow standard 15-character format (e.g. 33AAAAA0000A1Z5)',
    path: ['gstin']
  }
).refine(
  (data) => {
    if (data.pan && data.pan.trim().length > 0) {
      return panRegex.test(data.pan.trim().toUpperCase());
    }
    return true;
  },
  {
    message: 'Invalid PAN format (e.g. ABCDE1234F)',
    path: ['pan']
  }
);

export const vendorFinancialDetailsSchema = z.object({
  paymentTerms: z.enum([
    'immediate',
    '7_days',
    '15_days',
    '30_days',
    '45_days',
    '60_days',
    'custom'
  ]).optional().default('30_days'),
  customPaymentDays: z.number().min(1).optional(),
  creditLimit: z.number().min(0).optional(),
  openingBalance: z.number().optional(),
  openingBalanceType: z.enum(['receivable', 'payable', 'none']).optional(),
  preferredPaymentMethod: z
    .enum(['bank_transfer', 'upi', 'cheque', 'cash', 'other'])
    .optional(),
  bankAccountHolderName: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  branchName: z.string().optional(),
  upiId: z.string().optional()
}).refine(
  (data) => {
    if (data.ifscCode && data.ifscCode.trim().length > 0) {
      return ifscRegex.test(data.ifscCode.trim().toUpperCase());
    }
    return true;
  },
  {
    message: 'Invalid IFSC Code format (e.g. SBIN0001234)',
    path: ['ifscCode']
  }
);

export const vendorCommunicationSchema = z.object({
  officialEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  officePhone: z.string().optional(),
  mobileNumber: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
  alternateContactNumber: z.string().optional()
});

export const vendorContactSchema = z.object({
  contactId: z.string().optional(),
  personName: z.string().min(1, 'Contact Person Name is required'),
  designation: z.string().optional(),
  department: z.string().optional(),
  contactNumber: z.string().min(10, 'Contact number must be at least 10 digits'),
  alternateNumber: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  preferredContactMethod: z.enum(['phone', 'email', 'whatsapp']).optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active')
});

export const vendorInputSchema = z.object({
  companyName: z.string().min(1, 'Company Name is required'),
  legalCompanyName: z.string().optional(),
  vendorType: z.enum(['customer', 'supplier', 'both']),
  vendorCategory: z.enum([
    'main_company',
    'subcontractor',
    'subcompany',
    'transporter',
    'other'
  ]),
  parentVendorId: z.string().nullable().optional(),
  businessDescription: z.string().optional(),
  address: vendorAddressSchema,
  taxDetails: vendorTaxDetailsSchema,
  financialDetails: vendorFinancialDetailsSchema,
  communication: vendorCommunicationSchema,
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  contacts: z.array(vendorContactSchema).default([])
}).refine(
  (data) => {
    // Validate primary contact count: max 1 active primary contact
    const activePrimaryContacts = data.contacts.filter(
      (c) => c.isPrimary && c.status === 'active'
    );
    return activePrimaryContacts.length <= 1;
  },
  {
    message: 'Only one active primary contact is allowed per vendor',
    path: ['contacts']
  }
);

/**
 * Validates circular relationships when assigning a parent vendor.
 * Returns true if valid, false if parentVendorId would create a cycle.
 */
export function validateParentRelationship(
  currentVendorId: string,
  targetParentId: string | null | undefined,
  allVendorsMap: Map<string, { parentVendorId?: string | null }>
): { valid: boolean; error?: string } {
  if (!targetParentId) return { valid: true };
  if (currentVendorId === targetParentId) {
    return { valid: false, error: 'A company cannot be its own parent.' };
  }

  // Traverse up the chain to detect cycles
  let current: string | null | undefined = targetParentId;
  const visited = new Set<string>([currentVendorId]);

  while (current) {
    if (visited.has(current)) {
      return {
        valid: false,
        error: 'Circular parent-child relationship detected. This assignment is invalid.'
      };
    }
    visited.add(current);
    const parentDoc = allVendorsMap.get(current);
    current = parentDoc ? parentDoc.parentVendorId : null;
  }

  return { valid: true };
}
