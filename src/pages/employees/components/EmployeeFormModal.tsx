import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, AlertCircle, Loader2 } from 'lucide-react';
import { EmployeeMaster, EmployeeMasterFormData, EmployeeType, EmploymentStatus, Gender } from '../../../types/employee';
import { EmployeeService } from '../../../services/employeeService';

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EmployeeMasterFormData) => Promise<void>;
  initialEmployee?: EmployeeMaster | null;
  existingEmployees: EmployeeMaster[];
  currentUserEmail?: string;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEmployee,
  existingEmployees,
  currentUserEmail = 'admin@perlatextiles.com'
}) => {
  const isEditMode = Boolean(initialEmployee);

  // Auto-calculated default for Employee ID
  const defaultNextId = EmployeeService.generateNextEmployeeId(existingEmployees);

  // Form State - ID
  const [employeeId, setEmployeeId] = useState(initialEmployee?.employeeId || defaultNextId);

  // Employment Info
  const [employeeType, setEmployeeType] = useState<EmployeeType>(initialEmployee?.employeeType || 'Monthly Salary');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>(initialEmployee?.employmentStatus || 'Active');

  // Personal Information
  const [fullName, setFullName] = useState(initialEmployee?.fullName || '');
  const [gender, setGender] = useState<Gender>(initialEmployee?.gender || 'Male');
  const [mobileNumber, setMobileNumber] = useState(initialEmployee?.mobileNumber || '');
  const [alternateMobile, setAlternateMobile] = useState(initialEmployee?.alternateMobile || '');
  const [email, setEmail] = useState(initialEmployee?.email || '');

  // Address & Identification
  const [address, setAddress] = useState(initialEmployee?.address || '');
  const [state, setState] = useState(initialEmployee?.state || 'Tamil Nadu');
  const [pincode, setPincode] = useState(initialEmployee?.pincode || '');
  const [bloodGroup, setBloodGroup] = useState(initialEmployee?.bloodGroup || 'O+');
  const [aadharNumber, setAadharNumber] = useState(initialEmployee?.aadharNumber || '');
  const [panNumber, setPanNumber] = useState(initialEmployee?.panNumber || '');

  // Documents & Photos
  const [personPhotoUrl, setPersonPhotoUrl] = useState(initialEmployee?.personPhotoUrl || '');
  const [aadharPhotoUrl, setAadharPhotoUrl] = useState(initialEmployee?.aadharPhotoUrl || '');
  const [uploadingPerson, setUploadingPerson] = useState(false);
  const [uploadingAadhar, setUploadingAadhar] = useState(false);

  // Emergency Contact
  const [emergencyContactName, setEmergencyContactName] = useState(initialEmployee?.emergencyContactName || '');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState(initialEmployee?.emergencyContactNumber || '');

  // Work Details
  const [department, setDepartment] = useState(initialEmployee?.department || '');
  const [designation, setDesignation] = useState(initialEmployee?.designation || '');
  const [reportingManager, setReportingManager] = useState(initialEmployee?.reportingManager || '');
  const [shift, setShift] = useState(initialEmployee?.shift || 'Shift 1');
  const [monthlyIncome, setMonthlyIncome] = useState(initialEmployee?.monthlyIncome || '');
  const [dailyWages, setDailyWages] = useState(initialEmployee?.dailyWages || '');
  const [dateOfJoining, setDateOfJoining] = useState(initialEmployee?.dateOfJoining || new Date().toISOString().split('T')[0]);
  const [workLocation, setWorkLocation] = useState(initialEmployee?.workLocation || 'Perundurai Plant');

  // Bank Details
  const [accountNumber, setAccountNumber] = useState(initialEmployee?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(initialEmployee?.ifscCode || '');
  const [bankBranch, setBankBranch] = useState(initialEmployee?.bankBranch || '');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const personFileRef = useRef<HTMLInputElement>(null);
  const aadharFileRef = useRef<HTMLInputElement>(null);

  // Re-sync if initialEmployee changes
  useEffect(() => {
    if (initialEmployee) {
      setEmployeeId(initialEmployee.employeeId);
      setEmployeeType(initialEmployee.employeeType);
      setEmploymentStatus(initialEmployee.employmentStatus);
      setFullName(initialEmployee.fullName);
      setGender(initialEmployee.gender);
      setMobileNumber(initialEmployee.mobileNumber);
      setAlternateMobile(initialEmployee.alternateMobile);
      setEmail(initialEmployee.email);
      setAddress(initialEmployee.address);
      setState(initialEmployee.state);
      setPincode(initialEmployee.pincode);
      setBloodGroup(initialEmployee.bloodGroup);
      setAadharNumber(initialEmployee.aadharNumber);
      setPanNumber(initialEmployee.panNumber);
      setPersonPhotoUrl(initialEmployee.personPhotoUrl || '');
      setAadharPhotoUrl(initialEmployee.aadharPhotoUrl || '');
      setEmergencyContactName(initialEmployee.emergencyContactName);
      setEmergencyContactNumber(initialEmployee.emergencyContactNumber);
      setDepartment(initialEmployee.department);
      setDesignation(initialEmployee.designation);
      setReportingManager(initialEmployee.reportingManager);
      setShift(initialEmployee.shift);
      setMonthlyIncome(initialEmployee.monthlyIncome);
      setDailyWages(initialEmployee.dailyWages);
      setDateOfJoining(initialEmployee.dateOfJoining);
      setWorkLocation(initialEmployee.workLocation);
      setAccountNumber(initialEmployee.accountNumber);
      setIfscCode(initialEmployee.ifscCode);
      setBankBranch(initialEmployee.bankBranch);
    } else {
      const nextId = EmployeeService.generateNextEmployeeId(existingEmployees);
      setEmployeeId(nextId);
      setEmployeeType('Monthly Salary');
      setEmploymentStatus('Active');
      setFullName('');
      setGender('Male');
      setMobileNumber('');
      setAlternateMobile('');
      setEmail('');
      setAddress('');
      setState('Tamil Nadu');
      setPincode('');
      setBloodGroup('O+');
      setAadharNumber('');
      setPanNumber('');
      setPersonPhotoUrl('');
      setAadharPhotoUrl('');
      setEmergencyContactName('');
      setEmergencyContactNumber('');
      setDepartment('');
      setDesignation('');
      setReportingManager('');
      setShift('Shift 1');
      setMonthlyIncome('');
      setDailyWages('');
      setDateOfJoining(new Date().toISOString().split('T')[0]);
      setWorkLocation('Perundurai Plant');
      setAccountNumber('');
      setIfscCode('');
      setBankBranch('');
    }
    setErrorMessage(null);
  }, [initialEmployee, isOpen, existingEmployees]);

  if (!isOpen) return null;

  // Handle Photo File Upload
  const handlePhotoUpload = async (file: File, type: 'person' | 'aadhar') => {
    try {
      if (type === 'person') setUploadingPerson(true);
      else setUploadingAadhar(true);

      const url = await EmployeeService.uploadPhoto(file, type, employeeId || 'temp');
      if (type === 'person') setPersonPhotoUrl(url);
      else setAadharPhotoUrl(url);
    } catch (err: any) {
      console.error('Failed to upload photo:', err);
      setErrorMessage(`Failed to upload ${type} photo: ${err.message || 'Error'}`);
    } finally {
      if (type === 'person') setUploadingPerson(false);
      else setUploadingAadhar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }
    if (!mobileNumber.trim()) {
      setErrorMessage('Mobile Number is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData: EmployeeMasterFormData = {
        employeeId: employeeId.trim(),
        employeeCode: '',
        fullName: fullName.trim(),
        employeeType,
        employmentStatus,
        gender,
        mobileNumber: mobileNumber.trim(),
        alternateMobile: alternateMobile.trim(),
        email: email.trim(),
        address: address.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        bloodGroup: bloodGroup.trim(),
        aadharNumber: aadharNumber.trim(),
        panNumber: panNumber.trim(),
        aadharPhotoUrl: aadharPhotoUrl.trim(),
        personPhotoUrl: personPhotoUrl.trim(),
        emergencyContactName: emergencyContactName.trim(),
        emergencyContactNumber: emergencyContactNumber.trim(),
        department: department.trim(),
        designation: designation.trim(),
        reportingManager: reportingManager.trim(),
        shift: shift.trim(),
        monthlyIncome: employeeType === 'Monthly Salary' ? monthlyIncome.trim() : '',
        dailyWages: employeeType === 'Labour' ? dailyWages.trim() : '',
        dateOfJoining: dateOfJoining.trim(),
        workLocation: workLocation.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim(),
        bankBranch: bankBranch.trim(),
        createdBy: initialEmployee?.createdBy || currentUserEmail
      };

      await onSave(formData);
      onClose();
    } catch (err: any) {
      console.error('Error saving employee:', err);
      setErrorMessage(err.message || 'Failed to save employee record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800/10 transition';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden text-slate-800 animate-in fade-in zoom-in-98 duration-150">
          
          {/* Header */}
          <div className="px-7 pt-6 pb-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {isEditMode ? 'Edit Employee' : 'New Employee'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditMode ? `Update records for ${initialEmployee?.fullName}` : 'Fill in the information below to add a new employee'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-7 max-h-[72vh] overflow-y-auto space-y-6 text-xs">
            {errorMessage && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SECTION 1: Employment Info */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Employment Info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Employee ID */}
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Employee ID</label>
                  <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-800 flex items-center justify-between">
                    <span>{employeeId}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-medium">Auto</span>
                  </div>
                </div>

                {/* Employee Type */}
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Employee Type *</label>
                  <select
                    value={employeeType}
                    onChange={(e) => setEmployeeType(e.target.value as EmployeeType)}
                    className={inputClass}
                  >
                    <option value="Monthly Salary">Monthly Salary</option>
                    <option value="Labour">Labour</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Status *</label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value as EmploymentStatus)}
                    className={inputClass}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* SECTION 2: Personal Information */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Personal Information
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Gender *</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className={inputClass}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Mobile Number *</label>
                    <input
                      type="tel"
                      placeholder="10-digit number"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Alternate Mobile</label>
                    <input
                      type="tel"
                      placeholder="Optional"
                      value={alternateMobile}
                      onChange={(e) => setAlternateMobile(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* SECTION 3: Address & Identification */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Address & Identification
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Residential Address *</label>
                  <textarea
                    rows={2}
                    placeholder="Door no, Street, Area, City..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">State *</label>
                    <input
                      type="text"
                      placeholder="State"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Pincode *</label>
                    <input
                      type="text"
                      placeholder="Pincode"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Blood Group *</label>
                    <input
                      type="text"
                      placeholder="e.g. O+, B+"
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Aadhaar Number *</label>
                    <input
                      type="text"
                      placeholder="12-digit Aadhaar"
                      value={aadharNumber}
                      onChange={(e) => setAadharNumber(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">PAN Number</label>
                    <input
                      type="text"
                      placeholder="10-digit PAN"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      className={`${inputClass} uppercase`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* SECTION 4: Documents & Photos */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Photos & Documents
              </h3>

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={personFileRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], 'person')}
              />
              <input
                type="file"
                ref={aadharFileRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0], 'aadhar')}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Person Photo */}
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/40 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">Person Photo</span>
                    {personPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setPersonPhotoUrl('')}
                        className="text-[11px] text-rose-500 hover:text-rose-600 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {personPhotoUrl && (
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 mx-auto">
                      <img src={personPhotoUrl} alt="Person" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => personFileRef.current?.click()}
                    disabled={uploadingPerson}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
                  >
                    {uploadingPerson ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{personPhotoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                  </button>
                </div>

                {/* Aadhaar Photo */}
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50/40 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700">Aadhaar Card Photo</span>
                    {aadharPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setAadharPhotoUrl('')}
                        className="text-[11px] text-rose-500 hover:text-rose-600 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {aadharPhotoUrl && (
                    <div className="w-24 h-14 rounded-xl overflow-hidden border border-slate-200 mx-auto">
                      <img src={aadharPhotoUrl} alt="Aadhar" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => aadharFileRef.current?.click()}
                    disabled={uploadingAadhar}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
                  >
                    {uploadingAadhar ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    ) : (
                      <Camera className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{aadharPhotoUrl ? 'Change Document' : 'Upload Document'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* SECTION 5: Emergency Contact */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Emergency Contact
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Contact Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Sister / Spouse"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Contact Number *</label>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={emergencyContactNumber}
                    onChange={(e) => setEmergencyContactNumber(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* SECTION 6: Work Details */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Work Details
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Department *</label>
                    <input
                      type="text"
                      placeholder="e.g. Processing"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Designation *</label>
                    <input
                      type="text"
                      placeholder="e.g. Machine Operator"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Reporting Manager</label>
                    <input
                      type="text"
                      placeholder="e.g. Plant Supervisor"
                      value={reportingManager}
                      onChange={(e) => setReportingManager(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Shift</label>
                    <input
                      type="text"
                      placeholder="e.g. Shift 1"
                      value={shift}
                      onChange={(e) => setShift(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">
                      {employeeType === 'Monthly Salary' ? 'Monthly Income (₹)' : 'Daily Wages (₹)'}
                    </label>
                    {employeeType === 'Monthly Salary' ? (
                      <input
                        type="number"
                        placeholder="e.g. 25000"
                        value={monthlyIncome}
                        onChange={(e) => setMonthlyIncome(e.target.value)}
                        className={inputClass}
                      />
                    ) : (
                      <input
                        type="number"
                        placeholder="e.g. 700"
                        value={dailyWages}
                        onChange={(e) => setDailyWages(e.target.value)}
                        className={inputClass}
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Date of Joining</label>
                    <input
                      type="date"
                      value={dateOfJoining}
                      onChange={(e) => setDateOfJoining(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-[11px] block mb-1">Work Location</label>
                    <input
                      type="text"
                      placeholder="e.g. Plant 1"
                      value={workLocation}
                      onChange={(e) => setWorkLocation(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* SECTION 7: Bank Details */}
            <div>
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                Bank Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="Account number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="IFSC"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    className={`${inputClass} uppercase`}
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-[11px] block mb-1">Branch</label>
                  <input
                    type="text"
                    placeholder="Branch name"
                    value={bankBranch}
                    onChange={(e) => setBankBranch(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Form Actions Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition cursor-pointer shadow-2xs flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{isEditMode ? 'Save Changes' : 'Create Employee'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
