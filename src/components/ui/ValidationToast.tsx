import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';

export interface ValidationToastProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  errors: string[];
  autoCloseMs?: number;
}

/**
 * Universal Validation Error Toast for Perla ERP
 * Displays floating red toaster notification when unfilled or compulsory fields exist before submission.
 */
export const ValidationToast: React.FC<ValidationToastProps> = ({
  isOpen,
  onClose,
  title = 'Cannot Submit Form',
  subtitle = 'Please fill all compulsory fields to submit:',
  errors = [],
  autoCloseMs = 8000
}) => {
  useEffect(() => {
    if (isOpen && autoCloseMs > 0 && errors.length > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCloseMs, errors.length, onClose]);

  if (!isOpen || errors.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-5 right-5 z-[9999] max-w-md w-[calc(100vw-2.5rem)] sm:w-[420px] bg-red-600 text-white rounded-2xl shadow-2xl border-2 border-red-700/80 p-4 transition-all duration-200 animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-700/90 rounded-xl shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5 text-white" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white tracking-wide">
              {title}
            </h4>
            <p className="text-xs text-red-100">
              {subtitle}
            </p>
            <ul className="list-disc list-inside space-y-1 pt-1.5 text-xs text-white max-h-60 overflow-y-auto pr-1">
              {errors.map((err, idx) => (
                <li key={idx} className="font-semibold leading-relaxed">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-red-200 hover:text-white p-1 rounded-lg hover:bg-red-700/60 transition cursor-pointer shrink-0"
          title="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
