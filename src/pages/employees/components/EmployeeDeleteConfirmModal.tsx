import React from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { EmployeeMaster } from '../../../types/employee';
import { Button } from '../../../components/ui/Button';

interface EmployeeDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  employee: EmployeeMaster | null;
  isDeleting: boolean;
}

export const EmployeeDeleteConfirmModal: React.FC<EmployeeDeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  employee,
  isDeleting
}) => {
  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Delete Employee</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Are you sure you want to permanently delete this employee record? This action cannot be undone.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 text-xs space-y-1">
            <div className="font-semibold text-slate-900">{employee.fullName}</div>
            <div className="text-slate-500 font-medium">
              <span>{employee.employeeId}</span>
            </div>
            <div className="text-slate-500">{employee.department} • {employee.designation}</div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
