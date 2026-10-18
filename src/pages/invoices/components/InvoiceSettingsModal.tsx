import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { CompanyInvoiceSettings } from '../../../types/invoice';
import { InvoiceSettingsService } from '../../../services/invoiceSettingsService';
import { Check } from 'lucide-react';

interface InvoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export const InvoiceSettingsModal: React.FC<InvoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved
}) => {
  const [settings, setSettings] = useState<CompanyInvoiceSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      InvoiceSettingsService.getSettings()
        .then((s) => {
          setSettings(s);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen]);

  const handleChange = (field: keyof CompanyInvoiceSettings, val: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: val });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      setSaving(true);
      await InvoiceSettingsService.updateSettings(settings);
      setSavedSuccess(true);
      if (onSettingsSaved) onSettingsSaved();
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (e) {
      console.error('Failed to save invoice settings:', e);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title="Company Invoice & Tax Settings"
      maxWidth="2xl"
    >
      {loading || !settings ? (
        <div className="p-12 text-center text-xs text-neutral-500">Loading settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6 text-xs text-black max-h-[75vh] overflow-y-auto px-1">
          {savedSuccess && (
            <div className="p-3 bg-neutral-100 border border-neutral-300 text-black rounded-lg flex items-center gap-2 text-xs font-semibold">
              <Check className="w-4 h-4 text-black stroke-[2.5]" /> Settings saved successfully!
            </div>
          )}

          {/* Section 1: Issuer Profile */}
          <div className="space-y-4">
            <div className="border-b border-black/10 pb-2">
              <h4 className="text-xs font-bold text-black uppercase tracking-wider">
                Issuer Business Profile
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Company Name <span className="text-black">*</span>
                </label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  GSTIN <span className="text-black">*</span>
                </label>
                <input
                  type="text"
                  value={settings.gstin}
                  onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-mono font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Registered Address
                </label>
                <input
                  type="text"
                  value={settings.addressLine1}
                  onChange={(e) => handleChange('addressLine1', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  City & State
                </label>
                <input
                  type="text"
                  value={`${settings.city}, ${settings.state}`}
                  onChange={(e) => {
                    const parts = e.target.value.split(',');
                    handleChange('city', parts[0]?.trim() || '');
                    if (parts[1]) handleChange('state', parts[1]?.trim() || '');
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  GST State Code
                </label>
                <input
                  type="text"
                  value={settings.stateCode}
                  onChange={(e) => handleChange('stateCode', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-mono font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  PAN (Permanent Account Number)
                </label>
                <input
                  type="text"
                  value={settings.pan || ''}
                  onChange={(e) => handleChange('pan', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-mono font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  placeholder="e.g. AMMPK2032Q"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Default HSN / SAC Code
                </label>
                <input
                  type="text"
                  value={settings.defaultHsnSacCode || '998821'}
                  onChange={(e) => handleChange('defaultHsnSacCode', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-mono font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Bank Details */}
          <div className="space-y-4 pt-2">
            <div className="border-b border-black/10 pb-2">
              <h4 className="text-xs font-bold text-black uppercase tracking-wider">
                Remittance Bank Details
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Bank Name <span className="text-black">*</span>
                </label>
                <input
                  type="text"
                  value={settings.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Account Holder Name <span className="text-black">*</span>
                </label>
                <input
                  type="text"
                  value={settings.accountName}
                  onChange={(e) => handleChange('accountName', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  Account Number <span className="text-black">*</span>
                </label>
                <input
                  type="text"
                  value={settings.accountNumber}
                  onChange={(e) => handleChange('accountNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-mono font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  IFSC Code <span className="text-black">*</span>
                </label>
                <input
                  type="text"
                  value={settings.ifscCode}
                  onChange={(e) => handleChange('ifscCode', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-mono font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 3: Default GST Rates */}
          <div className="space-y-4 pt-2">
            <div className="border-b border-black/10 pb-2">
              <h4 className="text-xs font-bold text-black uppercase tracking-wider">
                Default GST Rates
              </h4>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  CGST (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.defaultCgstRate}
                  onChange={(e) => handleChange('defaultCgstRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-mono font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  SGST (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.defaultSgstRate}
                  onChange={(e) => handleChange('defaultSgstRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-mono font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wide mb-1">
                  IGST (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.defaultIgstRate}
                  onChange={(e) => handleChange('defaultIgstRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-xs text-black font-mono font-medium bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-black/10">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-100 hover:text-black transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold rounded-md bg-black text-white hover:bg-neutral-800 transition-colors shadow-xs"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
