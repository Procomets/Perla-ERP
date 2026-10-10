import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  FileText,
  CreditCard,
  Mail,
  Users,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Info,
  Lock,
  Save,
  RotateCcw,
  X,
  AlertTriangle
} from 'lucide-react';
import {
  Vendor,
  VendorContact,
  VendorType,
  VendorCategory,
  GSTRegistrationStatus,
  PaymentTerms,
  OpeningBalanceType,
  PreferredPaymentMethod,
  PreferredContactMethod,
  DocumentType
} from '../../../types/vendor';
import {
  vendorInputSchema,
  gstinRegex,
  panRegex,
  ifscRegex
} from '../../../schemas/vendorSchema';
import { VendorService } from '../../../services/vendorService';
import { Button } from '../../../components/ui/Button';

interface VendorFormProps {
  initialVendor?: Vendor | null;
  existingVendors: Vendor[];
  onSave: (vendorData: Partial<Vendor>, contacts: Partial<VendorContact>[], isAddAnother?: boolean) => Promise<void>;
  onCancel: () => void;
  userRole?: string;
}

export const VendorForm: React.FC<VendorFormProps> = ({
  initialVendor,
  existingVendors,
  onSave,
  onCancel,
  userRole = 'Admin'
}) => {
  const isEditMode = Boolean(initialVendor?.vendorId);

  // Section 1 — Company Information
  const [companyName, setCompanyName] = useState(initialVendor?.companyName || '');
  const [legalCompanyName, setLegalCompanyName] = useState(initialVendor?.legalCompanyName || '');
  const [vendorType, setVendorType] = useState<VendorType>(initialVendor?.vendorType || 'customer');
  const [vendorCategory, setVendorCategory] = useState<VendorCategory>(initialVendor?.vendorCategory || 'main_company');
  const [parentVendorId, setParentVendorId] = useState<string | null>(initialVendor?.parentVendorId || null);
  const [businessDescription, setBusinessDescription] = useState(initialVendor?.businessDescription || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(initialVendor?.status || 'active');

  // Section 2 — Address Details
  const [addressLine1, setAddressLine1] = useState(initialVendor?.address?.addressLine1 || '');
  const [addressLine2, setAddressLine2] = useState(initialVendor?.address?.addressLine2 || '');
  const [city, setCity] = useState(initialVendor?.address?.city || 'Coimbatore');
  const [district, setDistrict] = useState(initialVendor?.address?.district || 'Coimbatore');
  const [state, setState] = useState(initialVendor?.address?.state || 'Tamil Nadu');
  const [pinCode, setPinCode] = useState(initialVendor?.address?.pinCode || '641004');
  const [country, setCountry] = useState(initialVendor?.address?.country || 'India');
  const [gstStateCode, setGstStateCode] = useState(initialVendor?.address?.gstStateCode || '33');

  // Section 3 — Tax & Registration
  const [gstRegistrationStatus, setGstRegistrationStatus] = useState<GSTRegistrationStatus>(
    initialVendor?.taxDetails?.gstRegistrationStatus || 'registered'
  );
  const [gstin, setGstin] = useState(initialVendor?.taxDetails?.gstin || '');
  const [pan, setPan] = useState(initialVendor?.taxDetails?.pan || '');
  const [cin, setCin] = useState(initialVendor?.taxDetails?.cin || '');
  const [udyamRegistrationNumber, setUdyamRegistrationNumber] = useState(
    initialVendor?.taxDetails?.udyamRegistrationNumber || ''
  );
  const [otherRegistrationNumber, setOtherRegistrationNumber] = useState(
    initialVendor?.taxDetails?.otherRegistrationNumber || ''
  );

  // Section 4 — Financial Details
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(
    initialVendor?.financialDetails?.paymentTerms || '30_days'
  );
  const [customPaymentDays, setCustomPaymentDays] = useState<number>(
    initialVendor?.financialDetails?.customPaymentDays || 30
  );
  const [creditLimit, setCreditLimit] = useState<number>(
    initialVendor?.financialDetails?.creditLimit || 1000000
  );
  const [openingBalance, setOpeningBalance] = useState<number>(
    initialVendor?.financialDetails?.openingBalance || 0
  );
  const [openingBalanceType, setOpeningBalanceType] = useState<OpeningBalanceType>(
    initialVendor?.financialDetails?.openingBalanceType || 'none'
  );
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<PreferredPaymentMethod>(
    initialVendor?.financialDetails?.preferredPaymentMethod || 'bank_transfer'
  );
  const [bankAccountHolderName, setBankAccountHolderName] = useState(
    initialVendor?.financialDetails?.bankAccountHolderName || ''
  );
  const [bankName, setBankName] = useState(initialVendor?.financialDetails?.bankName || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(
    initialVendor?.financialDetails?.bankAccountNumber || ''
  );
  const [ifscCode, setIfscCode] = useState(initialVendor?.financialDetails?.ifscCode || '');
  const [branchName, setBranchName] = useState(initialVendor?.financialDetails?.branchName || '');
  const [upiId, setUpiId] = useState(initialVendor?.financialDetails?.upiId || '');

  // Section 5 — Official Communication Details
  const [officialEmail, setOfficialEmail] = useState(initialVendor?.communication?.officialEmail || '');
  const [officePhone, setOfficePhone] = useState(initialVendor?.communication?.officePhone || '');
  const [mobileNumber, setMobileNumber] = useState(initialVendor?.communication?.mobileNumber || '');
  const [website, setWebsite] = useState(initialVendor?.communication?.website || '');
  const [alternateContactNumber, setAlternateContactNumber] = useState(
    initialVendor?.communication?.alternateContactNumber || ''
  );

  // Section 6 — Contacts List
  const [contacts, setContacts] = useState<Partial<VendorContact>[]>(
    initialVendor?.primaryContactName
      ? [
          {
            personName: initialVendor.primaryContactName,
            contactNumber: initialVendor.primaryContactPhone || '9842200000',
            email: initialVendor.primaryContactEmail || '',
            isPrimary: true,
            status: 'active'
          }
        ]
      : [
          {
            personName: '',
            designation: 'Manager',
            department: 'Purchase / Sales',
            contactNumber: '',
            email: '',
            preferredContactMethod: 'phone',
            isPrimary: true,
            status: 'active'
          }
        ]
  );

  // Section 7 — Notes & Attachments
  const [notes, setNotes] = useState(initialVendor?.notes || '');
  const [uploadedFiles, setUploadedFiles] = useState<{ file: File; docType: DocumentType }[]>([]);

  // Validation Errors & Duplicate Alerts
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto populate GST State Code and PAN from GSTIN if entered
  useEffect(() => {
    if (gstin && gstin.trim().length === 15) {
      const stateCodePart = gstin.trim().substring(0, 2);
      const panPart = gstin.trim().substring(2, 12);
      if (!gstStateCode) setGstStateCode(stateCodePart);
      if (!pan) setPan(panPart);
    }
  }, [gstin]);

  // Real-time Duplicate Vendor check
  useEffect(() => {
    if (companyName.trim().length > 3 && !isEditMode) {
      VendorService.checkDuplicateVendor(companyName, gstin).then((res) => {
        if (res.isDuplicate) {
          setDuplicateWarning(res.matchReason || 'Similar vendor record already exists!');
        } else {
          setDuplicateWarning(null);
        }
      });
    } else {
      setDuplicateWarning(null);
    }
  }, [companyName, gstin, isEditMode]);

  // Contact person handlers
  const handleAddContact = () => {
    setContacts([
      ...contacts,
      {
        personName: '',
        designation: '',
        department: '',
        contactNumber: '',
        email: '',
        preferredContactMethod: 'phone',
        isPrimary: contacts.length === 0, // Primary if first contact
        status: 'active'
      }
    ]);
  };

  const handleUpdateContact = (index: number, field: string, value: any) => {
    const updated = [...contacts];
    if (field === 'isPrimary' && value === true) {
      // Unmark other contacts as primary
      updated.forEach((c, idx) => {
        c.isPrimary = idx === index;
      });
    } else {
      (updated[index] as any)[field] = value;
    }
    setContacts(updated);
  };

  const handleRemoveContact = (index: number) => {
    if (contacts.length <= 1) return;
    const updated = contacts.filter((_, idx) => idx !== index);
    if (!updated.some((c) => c.isPrimary) && updated.length > 0) {
      updated[0].isPrimary = true;
    }
    setContacts(updated);
  };

  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!companyName.trim()) errs.companyName = 'Company Name is required.';
    if (!addressLine1.trim()) errs.addressLine1 = 'Address Line 1 is required.';
    if (!state.trim()) errs.state = 'State is required.';

    if (gstRegistrationStatus === 'registered' || gstRegistrationStatus === 'composition') {
      if (gstin && !gstinRegex.test(gstin.trim().toUpperCase())) {
        errs.gstin = 'Invalid GSTIN format. Standard Indian GSTIN is 15 alphanumeric characters (e.g. 33AAAAA0000A1Z5).';
      }
    }

    if (pan && pan.trim().length > 0 && !panRegex.test(pan.trim().toUpperCase())) {
      errs.pan = 'Invalid PAN format (e.g. ABCDE1234F).';
    }

    if (ifscCode && ifscCode.trim().length > 0 && !ifscRegex.test(ifscCode.trim().toUpperCase())) {
      errs.ifscCode = 'Invalid IFSC Code format (e.g. SBIN0001234).';
    }

    // Contact person validation
    if (contacts.length > 0) {
      contacts.forEach((c, idx) => {
        if (!c.personName?.trim()) {
          errs[`contact_${idx}_name`] = `Contact #${idx + 1} Person Name is required.`;
        }
        if (!c.contactNumber?.trim()) {
          errs[`contact_${idx}_phone`] = `Contact #${idx + 1} Phone Number is required.`;
        }
      });
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent, isAddAnother: boolean = false) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload: Partial<Vendor> = {
        companyName: companyName.trim(),
        legalCompanyName: legalCompanyName.trim() || undefined,
        vendorType,
        vendorCategory,
        parentVendorId: parentVendorId || null,
        businessDescription: businessDescription.trim() || undefined,
        address: {
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim() || undefined,
          district: district.trim() || undefined,
          state: state.trim(),
          pinCode: pinCode.trim() || undefined,
          country: country.trim() || 'India',
          gstStateCode: gstStateCode.trim() || undefined
        },
        taxDetails: {
          gstRegistrationStatus,
          gstin: gstin.trim().toUpperCase() || undefined,
          pan: pan.trim().toUpperCase() || undefined,
          cin: cin.trim() || undefined,
          udyamRegistrationNumber: udyamRegistrationNumber.trim() || undefined,
          otherRegistrationNumber: otherRegistrationNumber.trim() || undefined
        },
        financialDetails: {
          paymentTerms,
          customPaymentDays: paymentTerms === 'custom' ? Number(customPaymentDays) : undefined,
          creditLimit: Number(creditLimit) || 0,
          openingBalance: Number(openingBalance) || 0,
          openingBalanceType,
          preferredPaymentMethod,
          bankAccountHolderName: bankAccountHolderName.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankAccountNumber: bankAccountNumber.trim() || undefined,
          ifscCode: ifscCode.trim().toUpperCase() || undefined,
          branchName: branchName.trim() || undefined,
          upiId: upiId.trim() || undefined
        },
        communication: {
          officialEmail: officialEmail.trim() || undefined,
          officePhone: officePhone.trim() || undefined,
          mobileNumber: mobileNumber.trim() || undefined,
          website: website.trim() || undefined,
          alternateContactNumber: alternateContactNumber.trim() || undefined
        },
        notes: notes.trim() || undefined,
        status
      };

      await onSave(payload, contacts, isAddAnother);
    } catch (error: any) {
      setErrors({ submit: error?.message || 'Failed to save vendor record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setCompanyName('');
    setLegalCompanyName('');
    setGstin('');
    setPan('');
    setAddressLine1('');
    setOfficialEmail('');
    setMobileNumber('');
    setContacts([
      {
        personName: '',
        contactNumber: '',
        isPrimary: true,
        status: 'active'
      }
    ]);
    setErrors({});
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6 pb-12">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79] flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {isEditMode ? `Edit Vendor: ${initialVendor?.companyName}` : 'Add New Vendor & Client Record'}
          </h2>
          <p className="text-xs text-slate-500">
            Fill out all 7 sections to create a verified, audit-logged vendor master record.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} icon={<Save className="w-4 h-4" />}>
            {isSubmitting ? 'Saving...' : 'Save Vendor Master'}
          </Button>
        </div>
      </div>

      {/* Duplicate Warning Alert */}
      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl text-amber-900 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Potential Duplicate Vendor Detected</h4>
            <p className="text-xs text-amber-800">{duplicateWarning}</p>
            <p className="text-[11px] text-amber-700 mt-1 italic">
              Please double check to avoid creating duplicate vendor entries.
            </p>
          </div>
        </div>
      )}

      {/* Form Submission Error Banner */}
      {errors.submit && (
        <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl text-rose-900 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="text-xs font-semibold">{errors.submit}</span>
        </div>
      )}

      {/* SECTION 1: Company Information */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 text-[#1F4E79]">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-base">Section 1 — Company Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Company Name <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sree Kumar Texind Corporation"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {errors.companyName && <p className="text-rose-600 text-[11px] mt-1">{errors.companyName}</p>}
          </div>

          {/* Legal Company Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Legal Company Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Sree Kumar Texind Corp Pvt Ltd"
              value={legalCompanyName}
              onChange={(e) => setLegalCompanyName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* Vendor Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Vendor Code (System Generated)
            </label>
            <input
              type="text"
              disabled
              value={initialVendor?.vendorCode || 'VND-00000X (Auto Generated)'}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-sm font-mono text-slate-600 font-bold"
            />
          </div>

          {/* Vendor Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Vendor Type <span className="text-rose-600">*</span>
            </label>
            <select
              value={vendorType}
              onChange={(e) => setVendorType(e.target.value as VendorType)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium"
            >
              <option value="customer">Customer Only</option>
              <option value="supplier">Supplier Only</option>
              <option value="both">Both (Customer & Supplier)</option>
            </select>
          </div>

          {/* Vendor Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Vendor Category <span className="text-rose-600">*</span>
            </label>
            <select
              value={vendorCategory}
              onChange={(e) => setVendorCategory(e.target.value as VendorCategory)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium"
            >
              <option value="main_company">Main Company</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="subcompany">Subcompany</option>
              <option value="transporter">Transporter</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Parent Company Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Parent Company (Optional)
            </label>
            <select
              value={parentVendorId || ''}
              onChange={(e) => setParentVendorId(e.target.value || null)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium"
            >
              <option value="">None (Independent Parent Company)</option>
              {existingVendors
                .filter((v) => v.vendorId !== initialVendor?.vendorId)
                .map((v) => (
                  <option key={v.vendorId} value={v.vendorId}>
                    {v.companyName} ({v.vendorCode})
                  </option>
                ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Account Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Business Description */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Business Description / Operations Summary
            </label>
            <input
              type="text"
              placeholder="e.g. Spinning yarn, garment washing jobwork, chemical supply"
              value={businessDescription}
              onChange={(e) => setBusinessDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Address Details */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 text-[#1F4E79]">
          <MapPin className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-base">Section 2 — Address Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Address Line 1 <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Door No, Street Name, Industrial Area"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {errors.addressLine1 && <p className="text-rose-600 text-[11px] mt-1">{errors.addressLine1}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Address Line 2
            </label>
            <input
              type="text"
              placeholder="Landmark, Building Name"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">City</label>
            <input
              type="text"
              placeholder="e.g. Coimbatore / Tirupur"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">District</label>
            <input
              type="text"
              placeholder="e.g. Coimbatore"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              State <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Tamil Nadu"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">PIN Code</label>
            <input
              type="text"
              placeholder="641004"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              GST State Code
            </label>
            <input
              type="text"
              placeholder="33 (Tamil Nadu)"
              value={gstStateCode}
              onChange={(e) => setGstStateCode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Tax and Registration Details */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-[#1F4E79]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-base">Section 3 — Tax and Registration Details</h3>
          </div>
          <span className="text-xs bg-purple-50 text-purple-800 px-2.5 py-1 rounded-full border border-purple-200">
            Unregistered Vendors Allowed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              GST Registration Status
            </label>
            <select
              value={gstRegistrationStatus}
              onChange={(e) => setGstRegistrationStatus(e.target.value as GSTRegistrationStatus)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium"
            >
              <option value="registered">Registered Regular</option>
              <option value="unregistered">Unregistered Vendor</option>
              <option value="composition">Composition Scheme</option>
              <option value="not_applicable">Not Applicable</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              GSTIN {gstRegistrationStatus === 'registered' && <span className="text-rose-600">*</span>}
            </label>
            <input
              type="text"
              placeholder="33AAAAA0000A1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {errors.gstin && <p className="text-rose-600 text-[11px] mt-1">{errors.gstin}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">PAN</label>
            <input
              type="text"
              placeholder="AAAAA0000A"
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {errors.pan && <p className="text-rose-600 text-[11px] mt-1">{errors.pan}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              CIN (Company Identification No)
            </label>
            <input
              type="text"
              placeholder="U17111TZ2010PTC015890"
              value={cin}
              onChange={(e) => setCin(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Udyam Registration Number
            </label>
            <input
              type="text"
              placeholder="UDYAM-TN-03-0000000"
              value={udyamRegistrationNumber}
              onChange={(e) => setUdyamRegistrationNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Other Registration / License
            </label>
            <input
              type="text"
              placeholder="Factory License / Pollution Control No"
              value={otherRegistrationNumber}
              onChange={(e) => setOtherRegistrationNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: Financial Details */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-[#1F4E79]">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-base">Section 4 — Financial Details</h3>
          </div>
          <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-900 px-2.5 py-1 rounded-full border border-amber-300 font-semibold">
            <Lock className="w-3 h-3 text-amber-700" />
            Restricted Access Fields
          </span>
        </div>

        {/* Verification Alert Banner */}
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-blue-900 flex items-start gap-2.5 text-xs">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Accounting Compliance Note:</span> Entering an opening balance does not automatically post a confirmed accounting journal entry. It is marked for verification and manager approval.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Payment Terms
            </label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value as PaymentTerms)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium"
            >
              <option value="immediate">Immediate Payment</option>
              <option value="7_days">7 Days Net</option>
              <option value="15_days">15 Days Net</option>
              <option value="30_days">30 Days Net</option>
              <option value="45_days">45 Days Net</option>
              <option value="60_days">60 Days Net</option>
              <option value="custom">Custom Credit Period</option>
            </select>
          </div>

          {paymentTerms === 'custom' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Custom Payment Days
              </label>
              <input
                type="number"
                value={customPaymentDays}
                onChange={(e) => setCustomPaymentDays(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Credit Limit (₹)
            </label>
            <input
              type="number"
              placeholder="1000000"
              value={creditLimit}
              onChange={(e) => setCreditLimit(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Opening Balance (₹)
            </label>
            <input
              type="number"
              placeholder="0"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Opening Balance Type
            </label>
            <select
              value={openingBalanceType}
              onChange={(e) => setOpeningBalanceType(e.target.value as OpeningBalanceType)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium"
            >
              <option value="none">None (Zero Balance)</option>
              <option value="receivable">Receivable (Customer owes us)</option>
              <option value="payable">Payable (We owe supplier)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Preferred Payment Method
            </label>
            <select
              value={preferredPaymentMethod}
              onChange={(e) => setPreferredPaymentMethod(e.target.value as PreferredPaymentMethod)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium"
            >
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="upi">UPI / Virtual Payment</option>
              <option value="cheque">Account Payee Cheque</option>
              <option value="cash">Cash Settlement</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Banking Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Bank Account Holder Name
            </label>
            <input
              type="text"
              placeholder="Account Name"
              value={bankAccountHolderName}
              onChange={(e) => setBankAccountHolderName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Bank Name</label>
            <input
              type="text"
              placeholder="e.g. State Bank of India"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Bank Account Number
            </label>
            <input
              type="text"
              placeholder="Account Number"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">IFSC Code</label>
            <input
              type="text"
              placeholder="SBIN0001234"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            {errors.ifscCode && <p className="text-rose-600 text-[11px] mt-1">{errors.ifscCode}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Branch Name</label>
            <input
              type="text"
              placeholder="Branch Location"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              UPI ID (Optional)
            </label>
            <input
              type="text"
              placeholder="vendor@upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* SECTION 5: Official Communication Details */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 text-[#1F4E79]">
          <Mail className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-base">Section 5 — Official Communication Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Official Email
            </label>
            <input
              type="email"
              placeholder="contact@company.com"
              value={officialEmail}
              onChange={(e) => setOfficialEmail(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Office Phone / Landline
            </label>
            <input
              type="text"
              placeholder="0422-2578900"
              value={officePhone}
              onChange={(e) => setOfficePhone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Mobile Number
            </label>
            <input
              type="text"
              placeholder="9842212345"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Website</label>
            <input
              type="text"
              placeholder="https://company.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Alternate Contact Number
            </label>
            <input
              type="text"
              placeholder="Emergency / Alternate Phone"
              value={alternateContactNumber}
              onChange={(e) => setAlternateContactNumber(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* SECTION 6: Contact Persons */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-[#1F4E79]">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-600" />
            <h3 className="font-bold text-base">Section 6 — Contact Persons</h3>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddContact}
            icon={<Plus className="w-4 h-4" />}
          >
            + Add Contact Person
          </Button>
        </div>

        <p className="text-xs text-slate-500">
          Specify executive key contacts. Exactly one active contact can be designated as the Primary Contact.
        </p>

        <div className="space-y-4">
          {contacts.map((contact, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border transition-all ${
                contact.isPrimary
                  ? 'border-blue-300 bg-blue-50/40 shadow-2xs'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                    Contact #{index + 1}
                  </span>

                  <label className="flex items-center gap-1.5 text-xs font-bold text-blue-800 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                    <input
                      type="radio"
                      name="primaryContactSelection"
                      checked={Boolean(contact.isPrimary)}
                      onChange={() => handleUpdateContact(index, 'isPrimary', true)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Primary Contact</span>
                  </label>
                </div>

                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveContact(index)}
                    className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Person Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Full Person Name"
                    value={contact.personName || ''}
                    onChange={(e) => handleUpdateContact(index, 'personName', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors[`contact_${index}_name`] && (
                    <p className="text-rose-600 text-[10px] mt-0.5">{errors[`contact_${index}_name`]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Purchase Manager / Director"
                    value={contact.designation || ''}
                    onChange={(e) => handleUpdateContact(index, 'designation', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Quality / Finance"
                    value={contact.department || ''}
                    onChange={(e) => handleUpdateContact(index, 'department', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Contact Number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="10-digit Mobile Number"
                    value={contact.contactNumber || ''}
                    onChange={(e) => handleUpdateContact(index, 'contactNumber', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {errors[`contact_${index}_phone`] && (
                    <p className="text-rose-600 text-[10px] mt-0.5">{errors[`contact_${index}_phone`]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="person@company.com"
                    value={contact.email || ''}
                    onChange={(e) => handleUpdateContact(index, 'email', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Preferred Communication
                  </label>
                  <select
                    value={contact.preferredContactMethod || 'phone'}
                    onChange={(e) => handleUpdateContact(index, 'preferredContactMethod', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium"
                  >
                    <option value="phone">Phone Call</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp Business</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 7: Notes and Attachments */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 text-[#1F4E79]">
          <Paperclip className="w-5 h-5 text-rose-600" />
          <h3 className="font-bold text-base">Section 7 — Notes and Attachments</h3>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Internal Vendor Notes & Remarks
          </label>
          <textarea
            rows={3}
            placeholder="Add internal observations, compliance notes, or special credit terms..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Form Action Buttons Bar */}
      <div className="sticky bottom-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-300 shadow-lg flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Form
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          {!isEditMode && (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={(e) => handleSubmit(e, true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition-colors cursor-pointer"
            >
              Save & Add Another
            </button>
          )}

          <Button type="submit" variant="primary" disabled={isSubmitting} icon={<CheckCircle2 className="w-4 h-4" />}>
            {isSubmitting ? 'Saving Vendor...' : isEditMode ? 'Update Vendor' : 'Save Vendor Master'}
          </Button>
        </div>
      </div>
    </form>
  );
};
