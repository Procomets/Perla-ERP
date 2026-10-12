import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Download,
  Eye,
  Edit,
  Trash2,
  Users,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { EmployeeMaster, EmployeeMasterFormData, EmployeeFilterOptions } from '../../types/employee';
import { EmployeeService } from '../../services/employeeService';
import { EmployeeFormModal } from './components/EmployeeFormModal';
import { EmployeeViewModal } from './components/EmployeeViewModal';
import { EmployeeDeleteConfirmModal } from './components/EmployeeDeleteConfirmModal';
import { useAuth } from '../../context/AuthContext';

export const EmployeeMasterPage: React.FC = () => {
  const { user } = useAuth();
  const currentUserEmail = user?.email || 'admin@perlatextiles.com';

  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [filters, setFilters] = useState<EmployeeFilterOptions>({
    searchQuery: '',
    employeeType: 'all',
    status: 'all'
  });

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeMaster | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Data
  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await EmployeeService.getEmployees();
      setEmployees(data);
    } catch (err: any) {
      console.error('Failed to load employee master:', err);
      showFeedback('error', 'Failed to load employees from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // Search query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchesName = (emp.fullName || '').toLowerCase().includes(q);
        const matchesEmpId = (emp.employeeId || '').toLowerCase().includes(q);
        const matchesMobile = (emp.mobileNumber || '').includes(q);
        const matchesDept = (emp.department || '').toLowerCase().includes(q);
        const matchesAadhar = (emp.aadharNumber || '').includes(q);

        if (!matchesName && !matchesEmpId && !matchesMobile && !matchesDept && !matchesAadhar) {
          return false;
        }
      }

      // Employee Type filter
      if (filters.employeeType !== 'all') {
        if (emp.employeeType !== filters.employeeType) return false;
      }

      // Status filter
      if (filters.status !== 'all') {
        if (emp.employmentStatus !== filters.status) return false;
      }

      return true;
    });
  }, [employees, filters]);

  // Metric stats
  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.employmentStatus === 'Active').length;
    const monthly = employees.filter((e) => e.employeeType === 'Monthly Salary').length;
    const labour = employees.filter((e) => e.employeeType === 'Labour').length;
    return { total, active, monthly, labour };
  }, [employees]);

  // Handlers
  const handleOpenAdd = () => {
    setSelectedEmployee(null);
    setIsFormOpen(true);
  };

  const handleEdit = (emp: EmployeeMaster) => {
    setSelectedEmployee(emp);
    setIsFormOpen(true);
  };

  const handleView = (emp: EmployeeMaster) => {
    setSelectedEmployee(emp);
    setIsViewOpen(true);
  };

  const handleDeleteClick = (emp: EmployeeMaster) => {
    setSelectedEmployee(emp);
    setIsDeleteOpen(true);
  };

  const handleSaveEmployee = async (formData: EmployeeMasterFormData) => {
    if (selectedEmployee) {
      await EmployeeService.updateEmployee(selectedEmployee.id, formData);
      showFeedback('success', `Employee ${formData.fullName} updated.`);
    } else {
      await EmployeeService.createEmployee(formData, currentUserEmail);
      showFeedback('success', `Employee ${formData.fullName} registered.`);
    }
    await loadEmployees();
  };

  const handleToggleStatus = async (emp: EmployeeMaster) => {
    const nextStatus = emp.employmentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await EmployeeService.toggleEmployeeStatus(emp.id, nextStatus);
      showFeedback('success', `Status changed to ${nextStatus}.`);
      await loadEmployees();
    } catch (err: any) {
      showFeedback('error', `Failed to update status: ${err.message || 'Error'}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedEmployee) return;
    setIsDeleting(true);
    try {
      await EmployeeService.deleteEmployee(selectedEmployee.id);
      showFeedback('success', `Employee deleted.`);
      setIsDeleteOpen(false);
      setSelectedEmployee(null);
      await loadEmployees();
    } catch (err: any) {
      showFeedback('error', `Failed to delete: ${err.message || 'Error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredEmployees.length === 0) {
      showFeedback('error', 'No employees to export.');
      return;
    }

    const headers = [
      'Employee ID',
      'Full Name',
      'Type',
      'Status',
      'Mobile Number',
      'Alternate Mobile',
      'Email',
      'Gender',
      'Department',
      'Designation',
      'Shift',
      'Monthly Income',
      'Daily Wages',
      'Date of Joining',
      'Aadhaar Number',
      'PAN Number',
      'Address',
      'State',
      'Pincode',
      'Blood Group',
      'Emergency Contact Name',
      'Emergency Contact Number',
      'Account Number',
      'IFSC Code',
      'Bank Branch'
    ];

    const rows = filteredEmployees.map((e) => [
      `"${e.employeeId || ''}"`,
      `"${e.fullName || ''}"`,
      `"${e.employeeType || ''}"`,
      `"${e.employmentStatus || ''}"`,
      `"${e.mobileNumber || ''}"`,
      `"${e.alternateMobile || ''}"`,
      `"${e.email || ''}"`,
      `"${e.gender || ''}"`,
      `"${e.department || ''}"`,
      `"${e.designation || ''}"`,
      `"${e.shift || ''}"`,
      `"${e.monthlyIncome || ''}"`,
      `"${e.dailyWages || ''}"`,
      `"${e.dateOfJoining || ''}"`,
      `"${e.aadharNumber || ''}"`,
      `"${e.panNumber || ''}"`,
      `"${(e.address || '').replace(/"/g, '""')}"`,
      `"${e.state || ''}"`,
      `"${e.pincode || ''}"`,
      `"${e.bloodGroup || ''}"`,
      `"${e.emergencyContactName || ''}"`,
      `"${e.emergencyContactNumber || ''}"`,
      `"${e.accountNumber || ''}"`,
      `"${e.ifscCode || ''}"`,
      `"${e.bankBranch || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `perla_employees_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback('success', `Exported ${filteredEmployees.length} employees to CSV`);
  };

  return (
    <div className="space-y-5">
      {/* Feedback Toast */}
      {feedbackMessage && (
        <div
          className={`fixed top-5 right-5 z-60 flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-lg border text-xs font-medium animate-in slide-in-from-top-3 duration-150 ${
            feedbackMessage.type === 'success'
              ? 'bg-slate-900 border-slate-800 text-white'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Top Header - Minimal & Airy */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Employee Master</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Directory of factory workers, administrative staff, and compensation records
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-medium hover:bg-slate-50 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Strip - Ultra-Minimal */}
      <div className="flex items-center flex-wrap gap-4 px-5 py-3 bg-white rounded-2xl border border-slate-200/80 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Total:</span>
          <span className="font-semibold text-slate-900">{stats.total}</span>
        </div>
        <span className="text-slate-200">•</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Active:</span>
          <span className="font-semibold text-emerald-700">{stats.active}</span>
        </div>
        <span className="text-slate-200">•</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Monthly Salary:</span>
          <span className="font-semibold text-slate-800">{stats.monthly}</span>
        </div>
        <span className="text-slate-200">•</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Labour:</span>
          <span className="font-semibold text-slate-800">{stats.labour}</span>
        </div>
      </div>

      {/* Filter Bar - Clean & Seamless */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, phone, department..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50/60 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-800 transition"
            />
          </div>

          {/* Employee Type Filter */}
          <div>
            <select
              value={filters.employeeType}
              onChange={(e) => setFilters({ ...filters, employeeType: e.target.value as any })}
              className="w-full px-3.5 py-2 bg-slate-50/60 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-slate-800 transition cursor-pointer"
            >
              <option value="all">All Employment Types</option>
              <option value="Monthly Salary">Monthly Salary</option>
              <option value="Labour">Labour</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
              className="w-full px-3.5 py-2 bg-slate-50/60 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-slate-800 transition cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card - Minimal & Clean */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-5">Employee ID</th>
                <th className="py-3 px-5">Name</th>
                <th className="py-3 px-5">Type</th>
                <th className="py-3 px-5">Mobile</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/70 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                    <span>Loading employees...</span>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-slate-600 text-xs">No employees found</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {filters.searchQuery || filters.employeeType !== 'all' || filters.status !== 'all'
                        ? 'Try clearing the search or filters.'
                        : 'Click "Add Employee" above to register an employee.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const isActive = emp.employmentStatus === 'Active';
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Column 1: Employee ID */}
                      <td className="py-3.5 px-5 font-mono font-semibold text-slate-800">
                        {emp.employeeId}
                      </td>

                      {/* Column 2: Name */}
                      <td className="py-3.5 px-5 font-medium text-slate-900">
                        {emp.fullName}
                      </td>

                      {/* Column 3: Type */}
                      <td className="py-3.5 px-5">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium text-slate-600 bg-slate-100">
                          {emp.employeeType}
                        </span>
                      </td>

                      {/* Column 4: Mobile */}
                      <td className="py-3.5 px-5 text-slate-600">
                        {emp.mobileNumber || '—'}
                      </td>

                      {/* Column 5: Status */}
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                            isActive
                              ? 'text-emerald-700 bg-emerald-50/80 border border-emerald-200/60'
                              : 'text-slate-500 bg-slate-100 border border-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {emp.employmentStatus}
                        </span>
                      </td>

                      {/* Column 6: Actions */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center justify-end gap-2.5">
                          {/* View */}
                          <button
                            title="View Profile"
                            onClick={() => handleView(emp)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            title="Edit"
                            onClick={() => handleEdit(emp)}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Deactivate / Activate link */}
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`text-[11px] font-medium cursor-pointer transition px-1 ${
                              isActive
                                ? 'text-slate-500 hover:text-amber-600'
                                : 'text-emerald-600 hover:text-emerald-700'
                            }`}
                          >
                            {isActive ? 'Deactivate' : 'Activate'}
                          </button>

                          {/* Delete */}
                          <button
                            title="Delete"
                            onClick={() => handleDeleteClick(emp)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div>
            Showing <span className="font-medium text-slate-700">{filteredEmployees.length}</span> of{' '}
            <span className="font-medium text-slate-700">{employees.length}</span> employees
          </div>

          <button
            onClick={loadEmployees}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <EmployeeFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveEmployee}
        initialEmployee={selectedEmployee}
        existingEmployees={employees}
        currentUserEmail={currentUserEmail}
      />

      <EmployeeViewModal
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
        employee={selectedEmployee}
        onEdit={(emp) => {
          setSelectedEmployee(emp);
          setIsFormOpen(true);
        }}
        onToggleStatus={(emp) => handleToggleStatus(emp)}
      />

      <EmployeeDeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        employee={selectedEmployee}
        isDeleting={isDeleting}
      />
    </div>
  );
};
