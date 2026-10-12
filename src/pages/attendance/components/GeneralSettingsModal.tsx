import React, { useState, useEffect } from 'react';
import { X, Clock, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { GeneralSettings } from '../../../types/attendance';
import { AttendanceService } from '../../../services/attendanceService';

interface GeneralSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GeneralSettings;
  onSave: (updated: Partial<GeneralSettings>) => Promise<void>;
  currentUserEmail?: string;
}

export const GeneralSettingsModal: React.FC<GeneralSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  currentUserEmail = 'admin@perlatextiles.com'
}) => {
  const [startTime, setStartTime] = useState(settings.accessStartTime || '09:00');
  const [endTime, setEndTime] = useState(settings.accessEndTime || '18:00');
  const [isBlocked, setIsBlocked] = useState(settings.isBlocked || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStartTime(settings.accessStartTime || '09:00');
    setEndTime(settings.accessEndTime || '18:00');
    setIsBlocked(settings.isBlocked || false);
    setError(null);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSave({
        accessStartTime: startTime,
        accessEndTime: endTime,
        isBlocked
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update timing settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
          
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Attendance Timing Settings</h3>
                <p className="text-xs text-slate-400">Stored in Firebase generalSettings collection</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Timing Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-500 font-semibold text-[11px] block mb-1">
                  Access Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-800 focus:outline-none focus:border-slate-800 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="text-slate-500 font-semibold text-[11px] block mb-1">
                  Access End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-800 focus:outline-none focus:border-slate-800 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Lock Switch */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 text-xs block">Lock Attendance Entry</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Temporarily lock entry for regular users regardless of time
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBlocked}
                  onChange={(e) => setIsBlocked(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* Role Permissions Information Note */}
            <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl text-[11px] text-blue-900 leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-blue-800">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Access Control Rules</span>
              </div>
              <p>
                • <strong>Regular Users:</strong> Can only mark attendance between <strong>{startTime}</strong> and <strong>{endTime}</strong>, and strictly for <strong>Today</strong>.
              </p>
              <p>
                • <strong>Administrators:</strong> Have <strong>unrestricted 24/7 access</strong> across <strong>all past and future dates</strong>.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition shadow-2xs flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Settings</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
