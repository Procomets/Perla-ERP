import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Check,
  X,
  Building2
} from 'lucide-react';
import {
  Vendor,
  VendorContact,
  VendorType,
  VendorCategory,
  GSTRegistrationStatus,
  PreferredPaymentMethod
} from '../../../types/vendor';
import {
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
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [isParentDropdownOpen, setIsParentDropdownOpen] = useState(false);
  const parentDropdownRef = useRef<HTMLDivElement>(null);

  // Close parent company dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (parentDropdownRef.current && !parentDropdownRef.current.contains(e.target as Node)) {
        setIsParentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter ONLY Main Companies (excluding the current vendor if editing)
  const mainCompanyVendors = useMemo(() => {
    return existingVendors.filter((v) => {
      if (initialVendor?.vendorId && v.vendorId === initialVendor.vendorId) {
        return false;
      }
      const cat = (v.vendorCategory || (v as any).category || '').toLowerCase().replace(/[\s-]+/g, '_');
      return cat === 'main_company';
    });
  }, [existingVendors, initialVendor]);

  // Filter main companies by search term (company name, vendor code, legal name)
  const filteredParentCompanies = useMemo(() => {
    if (!parentSearchQuery.trim()) return mainCompanyVendors;
    const q = parentSearchQuery.toLowerCase();
    return mainCompanyVendors.filter((v) => {
      const nameMatch = v.companyName?.toLowerCase().includes(q);
      const codeMatch = v.vendorCode?.toLowerCase().includes(q);
      const legalMatch = v.legalCompanyName?.toLowerCase().includes(q);
      return nameMatch || codeMatch || legalMatch;
    });
  }, [mainCompanyVendors, parentSearchQuery]);

  // Selected parent company object
  const selectedParentVendor = useMemo(() => {
    return mainCompanyVendors.find((v) => v.vendorId === parentVendorId);
  }, [mainCompanyVendors, parentVendorId]);

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
        isPrimary: contacts.length === 0,
        status: 'active'
      }
    ]);
  };

  const handleUpdateContact = (index: number, field: string, value: any) => {
    const updated = [...contacts];
    if (field === 'isPrimary' && value === true) {
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

    if (!companyName.trim()) {
      errs.companyName = 'Company Name is required.';
    }

    if (gstRegistrationStatus === 'registered') {
      if (!gstin || !gstin.trim()) {
        errs.gstin = 'GSTIN is mandatory when GST Registration Status is Registered Regular.';
      } else if (!gstinRegex.test(gstin.trim().toUpperCase())) {
        errs.gstin = 'Invalid GSTIN format. Standard Indian GSTIN is 15 alphanumeric characters (e.g. 33AAAAA0000A1Z5).';
      }
    } else if (gstin && gstin.trim().length > 0) {
      if (!gstinRegex.test(gstin.trim().toUpperCase())) {
        errs.gstin = 'Invalid GSTIN format. Standard Indian GSTIN is 15 alphanumeric characters (e.g. 33AAAAA0000A1Z5).';
      }
    }

    if (pan && pan.trim().length > 0 && !panRegex.test(pan.trim().toUpperCase())) {
      errs.pan = 'Invalid PAN format (e.g. ABCDE1234F).';
    }

    if (ifscCode && ifscCode.trim().length > 0 && !ifscRegex.test(ifscCode.trim().toUpperCase())) {
      errs.ifscCode = 'Invalid IFSC Code format (e.g. SBIN0001234).';
    }

    // Only validate contacts if any field is partially filled
    contacts.forEach((c, idx) => {
      const hasAnyField = Boolean(c.personName?.trim() || c.contactNumber?.trim() || c.email?.trim());
      if (hasAnyField) {
        if (!c.personName?.trim()) {
          errs[`contact_${idx}_name`] = `Contact #${idx + 1} Person Name is required.`;
        }
        if (!c.contactNumber?.trim()) {
          errs[`contact_${idx}_phone`] = `Contact #${idx + 1} Phone Number is required.`;
        }
      }
    });

    if (Object.keys(errs).length > 0) {
      const messages = Object.values(errs).slice(0, 3).join(' • ');
      errs.submit = `Please fill required fields: ${messages}`;
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent, isAddAnother: boolean = false) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});
    try {
      const validContacts = contacts.filter((c) => c.personName?.trim() || c.contactNumber?.trim());
      const payload: Partial<Vendor> = {
        companyName: companyName.trim(),
        legalCompanyName: legalCompanyName.trim() || undefined,
        vendorType,
        vendorCategory,
        parentVendorId: vendorCategory === 'main_company' ? null : (parentVendorId || null),
        businessDescription: businessDescription.trim() || undefined,
        address: {
          addressLine1: addressLine1.trim() || 'N/A',
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim() || 'Coimbatore',
          district: district.trim() || undefined,
          state: state.trim() || 'Tamil Nadu',
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
          paymentTerms: initialVendor?.financialDetails?.paymentTerms || '30_days',
          customPaymentDays: initialVendor?.financialDetails?.customPaymentDays,
          creditLimit: initialVendor?.financialDetails?.creditLimit,
          openingBalance: initialVendor?.financialDetails?.openingBalance,
          openingBalanceType: initialVendor?.financialDetails?.openingBalanceType,
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

      await onSave(payload, validContacts, isAddAnother);
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
    <form onSubmit={(e) => handleSubmit(e, false)} noValidate className="space-y-6 pb-12">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79]">
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
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Vendor Master'}
          </Button>
        </div>
      </div>

      {/* Duplicate Warning Alert */}
      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-xl text-amber-900 shadow-2xs">
          <h4 className="font-bold text-sm">Potential Duplicate Vendor Detected</h4>
          <p className="text-xs text-amber-800">{duplicateWarning}</p>
          <p className="text-[11px] text-amber-700 mt-1 italic">
            Please double check to avoid creating duplicate vendor entries.
          </p>
        </div>
      )}

      {/* Form Submission Error Banner */}
      {errors.submit && (
        <div className="bg-rose-50 border border-rose-300 p-4 rounded-xl text-rose-900">
          <span className="text-xs font-semibold">{errors.submit}</span>
        </div>
      )}

      {/* SECTION 1: Company Information */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="pb-3 border-b border-slate-200 text-[#1F4E79]">
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
              onChange={(e) => {
                const newCat = e.target.value as VendorCategory;
                setVendorCategory(newCat);
                if (newCat === 'main_company') {
                  setParentVendorId(null);
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium"
            >
              <option value="main_company">Main Company</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="subcompany">Subcompany</option>
              <option value="transporter">Transporter</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Parent Company Selection - Only shown if Vendor Category is other than Main Company */}
          {vendorCategory !== 'main_company' && (
            <div ref={parentDropdownRef} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Parent Company
                </label>
                <span className="text-[10px] text-slate-400 font-medium">Main Companies Only</span>
              </div>

              {/* Selector Trigger Button */}
              <div
                onClick={() => setIsParentDropdownOpen((prev) => !prev)}
                className={`w-full bg-white border ${
                  isParentDropdownOpen ? 'border-[#1F4E79] ring-2 ring-[#1F4E79]/20' : 'border-slate-300'
                } rounded-xl p-2.5 text-sm font-medium flex items-center justify-between cursor-pointer transition`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  {selectedParentVendor ? (
                    <span className="text-slate-900 truncate">
                      {selectedParentVendor.companyName}{' '}
                      <span className="text-xs text-slate-400 font-mono">({selectedParentVendor.vendorCode})</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">Select Parent Company</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {parentVendorId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setParentVendorId(null);
                        setParentSearchQuery('');
                      }}
                      className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Clear Parent Company"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
                      isParentDropdownOpen ? 'rotate-180 text-[#1F4E79]' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Dropdown Popover */}
              {isParentDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Search input in dropdown */}
                  <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search main company name or code..."
                        value={parentSearchQuery}
                        onChange={(e) => setParentSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                      />
                      {parentSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setParentSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Company List */}
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {/* Option to clear / no parent */}
                    <div
                      onClick={() => {
                        setParentVendorId(null);
                        setIsParentDropdownOpen(false);
                        setParentSearchQuery('');
                      }}
                      className={`p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-slate-500 italic ${
                        !parentVendorId ? 'bg-slate-50 text-slate-900 font-semibold' : ''
                      }`}
                    >
                      <span>No Parent Company</span>
                      {!parentVendorId && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    </div>

                    {filteredParentCompanies.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {mainCompanyVendors.length === 0
                          ? 'No vendors found with category: Main Company'
                          : `No main companies match "${parentSearchQuery}"`}
                      </div>
                    ) : (
                      filteredParentCompanies.map((v) => {
                        const isSelected = parentVendorId === v.vendorId;
                        return (
                          <div
                            key={v.vendorId}
                            onClick={() => {
                              setParentVendorId(v.vendorId);
                              setIsParentDropdownOpen(false);
                              setParentSearchQuery('');
                            }}
                            className={`p-2.5 hover:bg-blue-50/60 cursor-pointer flex items-center justify-between transition ${
                              isSelected ? 'bg-blue-50/80 font-semibold' : ''
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-slate-900 font-medium truncate flex items-center gap-1.5">
                                <span>{v.companyName}</span>
                                <span className="font-mono text-[10px] text-slate-400">({v.vendorCode})</span>
                              </div>
                              {v.legalCompanyName && v.legalCompanyName !== v.companyName && (
                                <p className="text-[10px] text-slate-400 truncate">{v.legalCompanyName}</p>
                              )}
                            </div>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-2" />}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>
                      Showing {filteredParentCompanies.length} of {mainCompanyVendors.length} Main Companies
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

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
          <div className={vendorCategory === 'main_company' ? 'md:col-span-3' : 'md:col-span-2'}>
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
        <div className="pb-3 border-b border-slate-200 text-[#1F4E79]">
          <h3 className="font-bold text-base">Section 2 — Address Details</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Address Line 1
            </label>
            <input
              type="text"
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
          <h3 className="font-bold text-base">Section 3 — Tax and Registration Details</h3>
          {gstRegistrationStatus === 'registered' ? (
            <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 font-medium">
              GSTIN Mandatory for Registered
            </span>
          ) : (
            <span className="text-xs bg-purple-50 text-purple-800 px-2.5 py-1 rounded-full border border-purple-200">
              Unregistered Vendors Allowed (GSTIN Optional)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              GST Registration Status <span className="text-rose-600">*</span>
            </label>
            <select
              value={gstRegistrationStatus}
              onChange={(e) => {
                const newStatus = e.target.value as GSTRegistrationStatus;
                setGstRegistrationStatus(newStatus);
                if (newStatus !== 'registered' && errors.gstin && (!gstin || gstin.trim().length === 0)) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.gstin;
                    return next;
                  });
                }
              }}
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="registered">Registered Regular</option>
              <option value="unregistered">Unregistered Vendor</option>
              <option value="composition">Composition Scheme</option>
              <option value="not_applicable">Not Applicable</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              GSTIN {gstRegistrationStatus === 'registered' ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="text-[10px] text-slate-400 font-normal lowercase">(optional)</span>
              )}
            </label>
            <input
              type="text"
              placeholder={gstRegistrationStatus === 'registered' ? "33AAAAA0000A1Z5 (Mandatory)" : "33AAAAA0000A1Z5 (Optional)"}
              value={gstin}
              onChange={(e) => {
                const val = e.target.value.toUpperCase();
                setGstin(val);
                if (errors.gstin) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.gstin;
                    return next;
                  });
                }
              }}
              className={`w-full bg-slate-50 border rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:bg-white ${
                errors.gstin ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' : 'border-slate-300 focus:ring-blue-500'
              }`}
            />
            {errors.gstin && <p className="text-rose-600 text-[11px] mt-1 font-medium">{errors.gstin}</p>}
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
          <h3 className="font-bold text-base">Section 4 — Financial Details</h3>
          <span className="text-xs bg-amber-50 text-amber-900 px-2.5 py-1 rounded-full border border-amber-300 font-semibold">
            Restricted Access Fields
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

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
        <div className="pb-3 border-b border-slate-200 text-[#1F4E79]">
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
          <h3 className="font-bold text-base">Section 6 — Contact Persons</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddContact}
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
                    className="text-rose-600 hover:text-rose-800 px-2 py-1 text-xs rounded-lg hover:bg-rose-100 transition-colors cursor-pointer font-bold"
                  >
                    Remove
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
        <div className="pb-3 border-b border-slate-200 text-[#1F4E79]">
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
      <div className="sticky bottom-4 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-300 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        {errors.submit && (
          <div className="w-full sm:w-auto px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
            {errors.submit}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold px-3 py-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
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

          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving Vendor...' : isEditMode ? 'Update Vendor' : 'Save Vendor Master'}
          </Button>
        </div>
      </div>
    </form>
  );
};
