import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  FileText,
  CreditCard,
  Mail,
  Users,
  GitFork,
  Paperclip,
  History,
  Lock,
  Edit,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Plus,
  Download,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Phone,
  Briefcase
} from 'lucide-react';
import {
  Vendor,
  VendorContact,
  VendorDocument,
  VendorAuditLog,
  DocumentType
} from '../../../types/vendor';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import { VendorService } from '../../../services/vendorService';

interface VendorDetailsProps {
  vendorId: string;
  userRole?: string;
  onBack: () => void;
  onEdit: (vendorId: string) => void;
  onNavigateToVendor: (vendorId: string) => void;
}

export const VendorDetails: React.FC<VendorDetailsProps> = ({
  vendorId,
  userRole = 'Admin',
  onBack,
  onEdit,
  onNavigateToVendor
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'tax' | 'financial' | 'contacts' | 'subcompanies' | 'documents' | 'history'
  >('overview');

  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<{
    vendor: Vendor | null;
    contacts: VendorContact[];
    subcompanies: Vendor[];
    parentVendor: Vendor | null;
    documents: VendorDocument[];
    logs: VendorAuditLog[];
  }>({
    vendor: null,
    contacts: [],
    subcompanies: [],
    parentVendor: null,
    documents: [],
    logs: []
  });

  // Modal State for adding contact or document
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContact, setNewContact] = useState({
    personName: '',
    designation: '',
    department: '',
    contactNumber: '',
    email: '',
    isPrimary: false
  });

  const [showUploadDocModal, setShowUploadDocModal] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('gst_certificate');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDetails = async () => {
    setLoading(true);
    const data = await VendorService.getVendorById(vendorId);
    setVendorData(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDetails();
  }, [vendorId]);

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-semibold text-slate-600">Loading Vendor Details...</p>
      </div>
    );
  }

  const { vendor, contacts, subcompanies, parentVendor, documents, logs } = vendorData;

  if (!vendor) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-4">
        <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">Vendor Not Found</h3>
        <p className="text-xs text-slate-500">The requested vendor master record could not be located.</p>
        <Button variant="outline" onClick={onBack}>
          Return to Vendor List
        </Button>
      </div>
    );
  }

  const isFinancialAccessRestricted = userRole === 'Supervisor';

  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.personName || !newContact.contactNumber) return;
    await VendorService.addContact(vendorId, newContact);
    setShowAddContactModal(false);
    setNewContact({
      personName: '',
      designation: '',
      department: '',
      contactNumber: '',
      email: '',
      isPrimary: false
    });
    fetchDetails();
  };

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    const uploaded = await VendorService.uploadDocument(vendorId, selectedFile, docType);
    setVendorData((prev) => ({
      ...prev,
      documents: [uploaded, ...prev.documents]
    }));
    setShowUploadDocModal(false);
    setSelectedFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors shrink-0 cursor-pointer mt-1"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono font-extrabold text-[#1F4E79] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-sm">
                  {vendor.vendorCode}
                </span>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">{vendor.companyName}</h1>
                <StatusChip status={vendor.status === 'active' ? 'Active' : 'Inactive'} />
              </div>

              {vendor.legalCompanyName && (
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Legal Name: <span className="text-slate-700 font-semibold">{vendor.legalCompanyName}</span>
                </p>
              )}

              <div className="flex items-center gap-4 mt-2 text-xs text-slate-600 flex-wrap">
                <span className="font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                  Type: {vendor.vendorType}
                </span>
                <span className="capitalize bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                  Category: {vendor.vendorCategory.replace('_', ' ')}
                </span>
                <span>
                  State: <strong className="text-slate-800">{vendor.address.state}</strong>
                </span>
                {parentVendor && (
                  <button
                    onClick={() => onNavigateToVendor(parentVendor.vendorId)}
                    className="flex items-center gap-1 text-teal-700 hover:text-teal-900 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 cursor-pointer"
                  >
                    <GitFork className="w-3 h-3" />
                    Parent: {parentVendor.companyName}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" icon={<Edit className="w-4 h-4" />} onClick={() => onEdit(vendor.vendorId)}>
              Edit Vendor
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pt-2">
          {[
            { id: 'overview', label: 'Overview', icon: <Building2 className="w-4 h-4" /> },
            { id: 'tax', label: 'Tax & Compliance', icon: <FileText className="w-4 h-4" /> },
            { id: 'financial', label: 'Financial & Banking', icon: <CreditCard className="w-4 h-4" /> },
            { id: 'contacts', label: `Contacts (${contacts.length})`, icon: <Users className="w-4 h-4" /> },
            { id: 'subcompanies', label: `Subcompanies (${subcompanies.length})`, icon: <GitFork className="w-4 h-4" /> },
            { id: 'documents', label: `Documents (${documents.length})`, icon: <Paperclip className="w-4 h-4" /> },
            { id: 'history', label: 'Activity History', icon: <History className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl transition-all border-b-2 cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB CONTENT PANELS */}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <h3 className="font-bold text-sm text-[#1F4E79] flex items-center gap-2 border-b pb-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              Registered Address
            </h3>
            <div className="space-y-1 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">{vendor.address.addressLine1}</p>
              {vendor.address.addressLine2 && <p>{vendor.address.addressLine2}</p>}
              <p>
                {vendor.address.city || 'Coimbatore'}, {vendor.address.district || 'Coimbatore'}
              </p>
              <p>
                {vendor.address.state} - {vendor.address.pinCode || '641004'}, {vendor.address.country}
              </p>
              {vendor.address.gstStateCode && (
                <p className="pt-2 text-slate-500 font-mono">GST State Code: {vendor.address.gstStateCode}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <h3 className="font-bold text-sm text-[#1F4E79] flex items-center gap-2 border-b pb-2">
              <Mail className="w-4 h-4 text-indigo-600" />
              Official Communication
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Official Email:</span>
                <span className="font-semibold text-slate-800">{vendor.communication.officialEmail || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Office Phone:</span>
                <span className="font-mono text-slate-800">{vendor.communication.officePhone || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mobile Number:</span>
                <span className="font-mono text-slate-800">{vendor.communication.mobileNumber || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Website:</span>
                <span className="font-semibold text-blue-600">
                  {vendor.communication.website ? (
                    <a href={vendor.communication.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline">
                      {vendor.communication.website} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    '-'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAX TAB */}
      {activeTab === 'tax' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <h3 className="font-bold text-sm text-[#1F4E79] flex items-center gap-2 border-b pb-2">
            <FileText className="w-4 h-4 text-purple-600" />
            Taxation & Statutory Registration
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold text-[10px]">GST Registration Status</span>
              <p className="font-bold text-slate-900 mt-1 capitalize">{vendor.taxDetails.gstRegistrationStatus.replace('_', ' ')}</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold text-[10px]">GSTIN</span>
              <p className="font-mono font-bold text-blue-800 mt-1">{vendor.taxDetails.gstin || 'Unregistered'}</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold text-[10px]">PAN</span>
              <p className="font-mono font-bold text-slate-800 mt-1">{vendor.taxDetails.pan || '-'}</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold text-[10px]">CIN</span>
              <p className="font-mono text-slate-800 mt-1">{vendor.taxDetails.cin || '-'}</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold text-[10px]">Udyam Registration</span>
              <p className="font-mono text-slate-800 mt-1">{vendor.taxDetails.udyamRegistrationNumber || '-'}</p>
            </div>
          </div>
        </div>
      )}

      {/* FINANCIAL & BANKING TAB */}
      {activeTab === 'financial' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-sm text-[#1F4E79] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-600" />
              Financial Terms & Banking Details
            </h3>

            {isFinancialAccessRestricted && (
              <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-rose-300">
                <Lock className="w-3.5 h-3.5" />
                Access Restricted (Supervisor)
              </span>
            )}
          </div>

          {isFinancialAccessRestricted ? (
            <div className="bg-rose-50 border border-rose-200 p-6 rounded-xl text-center space-y-2">
              <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
              <h4 className="font-bold text-sm text-rose-900">Restricted Financial Information</h4>
              <p className="text-xs text-rose-700 max-w-md mx-auto">
                Per security policy section 9, Supervisor accounts are not authorized to view full banking details or credit terms.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 uppercase font-semibold text-[10px]">Payment Terms</span>
                  <p className="font-bold text-slate-800 mt-1 capitalize">
                    {vendor.financialDetails.paymentTerms.replace('_', ' ')}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 uppercase font-semibold text-[10px]">Credit Limit</span>
                  <p className="font-bold text-emerald-800 mt-1 font-mono">
                    ₹{(vendor.financialDetails.creditLimit || 0).toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 uppercase font-semibold text-[10px]">Opening Balance</span>
                  <p className="font-bold text-slate-800 mt-1 font-mono">
                    ₹{(vendor.financialDetails.openingBalance || 0).toLocaleString()}{' '}
                    <span className="text-[10px] uppercase font-normal text-slate-500">
                      ({vendor.financialDetails.openingBalanceType || 'none'})
                    </span>
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 uppercase font-semibold text-[10px]">Payment Method</span>
                  <p className="font-bold text-slate-800 mt-1 capitalize">
                    {(vendor.financialDetails.preferredPaymentMethod || 'bank_transfer').replace('_', ' ')}
                  </p>
                </div>
              </div>

              {/* Bank Account Info */}
              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-2">
                <h4 className="font-bold text-xs text-amber-900 uppercase tracking-wider">Bank Account Credentials</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px]">Account Holder:</span>
                    <p className="font-bold text-slate-900">{vendor.financialDetails.bankAccountHolderName || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Bank Name:</span>
                    <p className="font-bold text-slate-900">{vendor.financialDetails.bankName || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Account Number:</span>
                    <p className="font-mono font-bold text-blue-900">{vendor.financialDetails.bankAccountNumber || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">IFSC Code:</span>
                    <p className="font-mono font-bold text-slate-900">{vendor.financialDetails.ifscCode || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">Branch Name:</span>
                    <p className="font-semibold text-slate-800">{vendor.financialDetails.branchName || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px]">UPI ID:</span>
                    <p className="font-mono text-slate-900">{vendor.financialDetails.upiId || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONTACTS TAB */}
      {activeTab === 'contacts' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-sm text-[#1F4E79] flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              Contact Persons ({contacts.length})
            </h3>
            <Button variant="outline" size="sm" onClick={() => setShowAddContactModal(true)} icon={<Plus className="w-4 h-4" />}>
              Add Contact Person
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map((c) => (
              <div
                key={c.contactId}
                className={`p-4 rounded-xl border space-y-2 ${
                  c.isPrimary ? 'border-blue-300 bg-blue-50/30' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{c.personName}</h4>
                      {c.isPrimary && (
                        <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Primary Contact
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      {c.designation || 'Representative'} {c.department ? `(${c.department})` : ''}
                    </p>
                  </div>
                  <StatusChip status={c.status === 'active' ? 'Active' : 'Inactive'} />
                </div>

                <div className="pt-2 border-t border-slate-200/60 text-xs space-y-1 font-mono text-slate-700">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.contactNumber}</span>
                  </div>
                  {c.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-sans">{c.email}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBCOMPANIES TAB */}
      {activeTab === 'subcompanies' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <h3 className="font-bold text-sm text-[#1F4E79] flex items-center gap-2 border-b pb-2">
            <GitFork className="w-4 h-4 text-teal-600" />
            Associated Subcompanies & Subcontractors ({subcompanies.length})
          </h3>

          {subcompanies.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-xs font-semibold">No associated subcompanies or subcontractors linked to this vendor.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subcompanies.map((sub) => (
                <div
                  key={sub.vendorId}
                  onClick={() => onNavigateToVendor(sub.vendorId)}
                  className="p-4 rounded-xl border border-teal-200 bg-teal-50/30 hover:bg-teal-50 transition-colors cursor-pointer flex justify-between items-center"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-teal-800">{sub.vendorCode}</span>
                    <h4 className="font-bold text-sm text-slate-900">{sub.companyName}</h4>
                    <p className="text-xs text-slate-500 capitalize">{sub.vendorCategory.replace('_', ' ')}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    View Child
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-sm text-[#1F4E79] flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-rose-600" />
              Vendor Document Attachments
            </h3>
            <Button variant="outline" size="sm" onClick={() => setShowUploadDocModal(true)} icon={<Plus className="w-4 h-4" />}>
              Upload Document
            </Button>
          </div>

          {documents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <p className="text-xs font-semibold">No document attachments uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.documentId}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <Paperclip className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="font-bold text-slate-800">{doc.fileName}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{doc.documentType.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {doc.downloadUrl && (
                    <a
                      href={doc.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-1 font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTIVITY HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <h3 className="font-bold text-sm text-[#1F4E79] flex items-center gap-2 border-b pb-2">
            <History className="w-4 h-4 text-blue-600" />
            Audit Trail & Activity Log
          </h3>

          <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {logs.map((log) => (
              <div key={log.auditId} className="pl-8 relative flex flex-col gap-1">
                <div className="absolute left-1.5 top-1.5 w-3 h-3 bg-blue-600 rounded-full ring-4 ring-white"></div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-900 uppercase tracking-wider">{log.action}</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">{new Date(log.performedAt).toLocaleString()}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-semibold text-blue-800">By {log.performedBy}</span>
                </div>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  {log.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for Adding Contact */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-bold text-base text-slate-900">Add New Contact Person</h3>
            <form onSubmit={handleAddContactSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Person Name *</label>
                <input
                  type="text"
                  required
                  value={newContact.personName}
                  onChange={(e) => setNewContact({ ...newContact, personName: e.target.value })}
                  className="w-full border rounded-xl p-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Designation</label>
                <input
                  type="text"
                  value={newContact.designation}
                  onChange={(e) => setNewContact({ ...newContact, designation: e.target.value })}
                  className="w-full border rounded-xl p-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Contact Number *</label>
                <input
                  type="text"
                  required
                  value={newContact.contactNumber}
                  onChange={(e) => setNewContact({ ...newContact, contactNumber: e.target.value })}
                  className="w-full border rounded-xl p-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Email</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="w-full border rounded-xl p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddContactModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save Contact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Document Upload */}
      {showUploadDocModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-bold text-base text-slate-900">Upload Vendor Document</h3>
            <form onSubmit={handleFileUploadSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as any)}
                  className="w-full border rounded-xl p-2"
                >
                  <option value="gst_certificate">GST Certificate</option>
                  <option value="pan_document">PAN Document</option>
                  <option value="bank_proof">Bank Proof (Cancelled Cheque)</option>
                  <option value="business_agreement">Business Agreement</option>
                  <option value="other">Other Document</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Select File (PDF / Image)</label>
                <input
                  type="file"
                  required
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full border rounded-xl p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowUploadDocModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Upload
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
