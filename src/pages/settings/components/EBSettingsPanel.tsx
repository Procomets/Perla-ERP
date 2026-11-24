import React, { useState, useEffect } from 'react';
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  Lock,
  Clock,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { isUserAdmin } from '../../../utils/permissions';
import { EBSettingsService, DEFAULT_EB_SETTINGS } from '../../../services/ebSettingsService';
import { EBSettings } from '../../../types/ebMonitoring';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

interface EBSettingsPanelProps {
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const EBSettingsPanel: React.FC<EBSettingsPanelProps> = ({ onNotify }) => {
  const { user, isAdmin } = useAuth();
  const userIsAdmin = Boolean(isAdmin || isUserAdmin(user));

  const [settings, setSettings] = useState<EBSettings>(() => EBSettingsService.getCache() || DEFAULT_EB_SETTINGS);
  const [unitPriceInput, setUnitPriceInput] = useState<string>(() =>
    String(EBSettingsService.getCache()?.unitPrice ?? 9.5)
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = EBSettingsService.subscribeSettings(
      (data) => {
        if (isMounted && data) {
          setSettings(data);
          setUnitPriceInput(String(data.unitPrice ?? 9.5));
          setLoading(false);
        }
      },
      (err) => {
        console.warn('Real-time subscription fallback for EB settings:', err);
        EBSettingsService.getSettings()
          .then((data) => {
            if (isMounted && data) {
              setSettings(data);
              setUnitPriceInput(String(data.unitPrice ?? 9.5));
              setLoading(false);
            }
          })
          .catch(() => {
            if (isMounted) setLoading(false);
          });
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIsAdmin) {
      setNotice({
        type: 'error',
        text: 'Access Denied: Only administrators can modify electricity unit pricing.'
      });
      return;
    }

    const price = parseFloat(unitPriceInput);
    if (isNaN(price) || price < 0) {
      setNotice({
        type: 'error',
        text: 'Please enter a valid unit price greater than or equal to 0.'
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const updated = await EBSettingsService.updateSettings(price, {
        uid: user?.uid || 'admin',
        displayName: user?.displayName || user?.email || 'Admin',
        email: user?.email
      });

      setSettings(updated);
      setNotice({
        type: 'success',
        text: `EB unit price updated to ₹${updated.unitPrice.toFixed(2)}/kW successfully.`
      });
      if (onNotify) {
        onNotify('success', `EB Unit Price updated to ₹${updated.unitPrice.toFixed(2)}/kW.`);
      }
    } catch (err: any) {
      console.error('Error saving EB settings:', err);
      setNotice({
        type: 'error',
        text: err?.message || 'Failed to update EB unit price.'
      });
      if (onNotify) {
        onNotify('error', 'Failed to update EB unit price.');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatLastUpdated = (dateVal?: any): string => {
    if (!dateVal) return 'Recently';
    try {
      let d: Date | null = null;
      if (typeof dateVal?.toDate === 'function') {
        d = dateVal.toDate();
      } else if (dateVal instanceof Date) {
        d = dateVal;
      } else if (typeof dateVal === 'object' && dateVal !== null) {
        const sec = typeof dateVal.seconds === 'number'
          ? dateVal.seconds
          : (typeof dateVal._seconds === 'number'
            ? dateVal._seconds
            : (dateVal.seconds ? Number(dateVal.seconds) : null));
        if (sec !== null && !isNaN(sec)) {
          d = new Date(sec * 1000);
        }
      } else if (typeof dateVal === 'string' || typeof dateVal === 'number') {
        const parsed = new Date(dateVal);
        if (!isNaN(parsed.getTime())) {
          d = parsed;
        }
      }

      if (d && !isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
      return typeof dateVal === 'string' ? dateVal : 'Recently';
    } catch {
      return 'Recently';
    }
  };

  const currentSettings = settings || DEFAULT_EB_SETTINGS;

  return (
    <div className="space-y-4 max-w-3xl">
      <Card className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">EB / Electricity Unit Price Settings</h3>
            <p className="text-xs text-slate-500">
              Configure factory electricity spending rate (₹ per kW) used across daily EB monitoring
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#1F4E79]" />
            Loading EB settings...
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-5 space-y-5">
            {notice && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  notice.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {notice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{notice.text}</span>
              </div>
            )}

            {!userIsAdmin && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800 font-medium">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Read-Only Access:</strong> Only administrators can edit the electricity unit rate. Contact your system admin to request changes.
                </span>
              </div>
            )}

            {/* Unit Price Input Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Current Price for 1 Unit (₹ / kW) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2 max-w-sm">
                <span className="w-10 h-10 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 font-mono">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!userIsAdmin || saving}
                  value={unitPriceInput}
                  onChange={(e) => setUnitPriceInput(e.target.value)}
                  placeholder="9.50"
                  required
                  className={`flex-1 h-10 px-3 text-sm font-mono font-bold rounded-lg border transition focus:outline-none focus:ring-2 focus:ring-[#1F4E79] ${
                    !userIsAdmin
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-slate-900 border-slate-300'
                  }`}
                />
                <span className="w-14 h-10 flex items-center justify-center bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                  / kW
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                This rate is automatically used as the default unit price when recording daily meter readings in the EB Monitoring module.
              </p>
            </div>

            {/* Last Updated Meta Information */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Last Modified:{' '}
                  <strong className="text-slate-800 font-semibold">
                    {String(formatLastUpdated(currentSettings?.updatedAt))}
                  </strong>
                </span>
              </div>
              {currentSettings?.updatedByName && (
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <UserCheck className="w-3 h-3 text-slate-400" />
                  <span>By: {typeof currentSettings.updatedByName === 'string' ? currentSettings.updatedByName : String(currentSettings.updatedByName)}</span>
                </div>
              )}
            </div>

            {/* Submit Action (Admin Only) */}
            {userIsAdmin && (
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={
                    saving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )
                  }
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Unit Price'}
                </Button>
              </div>
            )}
          </form>
        )}
      </Card>
    </div>
  );
};
