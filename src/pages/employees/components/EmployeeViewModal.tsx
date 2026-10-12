import React, { useState } from 'react';
import { X, Edit, ExternalLink, User } from 'lucide-react';
import { EmployeeMaster } from '../../../types/employee';

interface EmployeeViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeMaster | null;
  onEdit: (emp: EmployeeMaster) => void;
  onToggleStatus: (emp: EmployeeMaster) => void;
}

export const EmployeeViewModal: React.FC<EmployeeViewModalProps> = ({
  isOpen,
  onClose,
  employee,
  onEdit,
  onToggleStatus
}) => {
  const [showFullAadhar, setShowFullAadhar] = useState(false);

  if (!isOpen || !employee) return null;

  const isActive = employee.employmentStatus === 'Active';

  // Format compensation
  const compensationText =
    employee.employeeType === 'Monthly Salary'
      ? employee.monthlyIncome ? `₹${Number(employee.monthlyIncome).toLocaleString('en-IN')} / mo` : '—'
      : employee.dailyWages ? `₹${Number(employee.dailyWages).toLocaleString('en-IN')} / day` : '—';

  // Format date helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Subtle backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden text-slate-800 animate-in fade-in zoom-in-98 duration-150">
          
          {/* Header - Clean, seamless & airy */}
          <div className="px-7 pt-7 pb-6 flex items-start justify-between border-b border-slate-100">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                {employee.personPhotoUrl ? (
                  <img src={employee.personPhotoUrl} alt={employee.fullName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-lg text-slate-500 bg-slate-100">
                    {employee.fullName ? employee.fullName.charAt(0).toUpperCase() : <User className="w-6 h-6 text-slate-400" />}
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
                    {employee.fullName}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                      isActive
                        ? 'text-emerald-700 bg-emerald-50/80 border border-emerald-200/60'
                        : 'text-slate-500 bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {employee.employmentStatus}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                  <span className="font-mono font-medium text-slate-700">{employee.employeeId}</span>
                  <span className="text-slate-300">•</span>
                  <span>{employee.designation || 'Staff'}</span>
                  {employee.department && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span>{employee.department}</span>
                    </>
                  )}
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600">{employee.employeeType}</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer -mr-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Bar - Borderless & Lightweight */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-7 py-4 bg-slate-50/60 border-b border-slate-100 text-xs">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">Department</span>
              <span className="font-medium text-slate-800 mt-0.5 block truncate">{employee.department || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">Shift</span>
              <span className="font-medium text-slate-800 mt-0.5 block truncate">{employee.shift || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">Compensation</span>
              <span className="font-semibold text-slate-900 mt-0.5 block truncate">{compensationText}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">Date of Joining</span>
              <span className="font-medium text-slate-800 mt-0.5 block truncate">{formatDate(employee.dateOfJoining)}</span>
            </div>
          </div>

          {/* Modal Body - Clean Typography & Subtle Dividers */}
          <div className="p-7 max-h-[62vh] overflow-y-auto space-y-6 text-xs">
            
            {/* Section 1: Contact & Personal Details */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Contact & Personal
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
                <div>
                  <span className="text-slate-400 text-[11px] block">Mobile Number</span>
                  <span className="font-medium text-slate-800 text-sm">{employee.mobileNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Alternate Mobile</span>
                  <span className="font-medium text-slate-800 text-sm">{employee.alternateMobile || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Email</span>
                  <span className="font-medium text-slate-800 text-sm break-all">{employee.email || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Gender</span>
                  <span className="font-medium text-slate-800">{employee.gender || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Blood Group</span>
                  <span className="font-medium text-slate-800">{employee.bloodGroup || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Work Location</span>
                  <span className="font-medium text-slate-800">{employee.workLocation || '—'}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 2: Address & Identification */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Address & Identity
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                <div>
                  <span className="text-slate-400 text-[11px] block">Residential Address</span>
                  <p className="font-medium text-slate-800 mt-0.5 leading-relaxed">{employee.address || '—'}</p>
                  <div className="flex items-center gap-4 mt-2 text-slate-600">
                    <span>{employee.state || '—'}</span>
                    {employee.pincode && <span>PIN: {employee.pincode}</span>}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Aadhaar Number</span>
                      <span className="font-mono font-medium text-slate-800">
                        {employee.aadharNumber || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">PAN Number</span>
                      <span className="font-mono font-medium text-slate-800 uppercase">
                        {employee.panNumber || '—'}
                      </span>
                    </div>
                  </div>

                  {employee.aadharPhotoUrl && (
                    <div className="pt-1">
                      <span className="text-slate-400 text-[11px] block mb-1.5">Aadhaar Document</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowFullAadhar(true)}
                          className="relative group w-28 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-2xs hover:border-slate-400 transition cursor-pointer"
                        >
                          <img
                            src={employee.aadharPhotoUrl}
                            alt="Aadhaar"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        </button>
                        <a
                          href={employee.aadharPhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 font-medium transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View Full</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 3: Organization & Emergency Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                  Work Details
                </h3>
                <div className="space-y-2.5">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Reporting Manager</span>
                    <span className="font-medium text-slate-800">{employee.reportingManager || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Designation</span>
                    <span className="font-medium text-slate-800">{employee.designation || '—'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                  Emergency Contact
                </h3>
                <div className="space-y-2.5">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Contact Name</span>
                    <span className="font-medium text-slate-800">{employee.emergencyContactName || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Contact Number</span>
                    <span className="font-medium text-slate-800">{employee.emergencyContactNumber || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Section 4: Bank Details */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Bank Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-slate-400 text-[11px] block">Account Number</span>
                  <span className="font-mono font-medium text-slate-800">{employee.accountNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">IFSC Code</span>
                  <span className="font-mono font-medium text-slate-800 uppercase">{employee.ifscCode || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Branch</span>
                  <span className="font-medium text-slate-800">{employee.bankBranch || '—'}</span>
                </div>
              </div>
            </div>

            {/* Subtle System Audit Info */}
            <div className="pt-2 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Registered by: {employee.createdBy || 'Admin'}</span>
              {employee.createdAt && <span>Added {new Date(employee.createdAt).toLocaleDateString()}</span>}
            </div>

          </div>

          {/* Footer - Minimal & Refined */}
          <div className="px-7 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onToggleStatus(employee)}
              className="text-xs font-medium text-slate-500 hover:text-amber-600 transition cursor-pointer"
            >
              {isActive ? 'Deactivate Employee' : 'Activate Employee'}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(employee);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                <Edit className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Aadhaar Image Preview Modal */}
      {showFullAadhar && employee.aadharPhotoUrl && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-white rounded-2xl overflow-hidden p-2 shadow-2xl">
            <button
              onClick={() => setShowFullAadhar(false)}
              className="absolute top-4 right-4 p-1.5 bg-black/60 hover:bg-black text-white rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={employee.aadharPhotoUrl} alt="Aadhaar Document" className="w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};
