import React, { useState, useEffect } from 'react';
import {
  Building2,
  Landmark,
  Percent,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  RotateCcw,
  ShieldCheck
} from 'lucide-react';
import { CompanyInvoiceSettings } from '../../../types/invoice';
import {
  InvoiceSettingsService,
  DEFAULT_INVOICE_SETTINGS
} from '../../../services/invoiceSettingsService';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';

interface TaxAndIssuerSettingsProps {
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const TaxAndIssuerSettings: React.FC<TaxAndIssuerSettingsProps> = ({ onNotify }) => {
  const [settings, setSettings] = useState<CompanyInvoiceSettings>(DEFAULT_INVOICE_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<CompanyInvoiceSettings>(DEFAULT_INVOICE_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load settings on mount (subscribing for real-time updates from Firebase)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const unsubscribe = InvoiceSettingsService.subscribeSettings(
      (data) => {
        if (isMounted) {
          setSettings(data);
          setInitialSettings(data);
          setLoading(false);
        }
      },
      (err) => {
        console.warn('Real-time subscription failed, falling back to direct get:', err);
        InvoiceSettingsService.getSettings()
          .then((data) => {
            if (isMounted) {
              setSettings(data);
              setInitialSettings(data);
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

  const handleChange = (field: keyof CompanyInvoiceSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleReset = () => {
    setSettings(initialSettings);
    setSaveNotice(null);
    if (onNotify) onNotify('info', 'Changes reverted to stored settings.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveNotice(null);

    // Validation
    if (!settings.companyName.trim()) {
      setSaveNotice({ type: 'error', text: 'Company Name is required.' });
      setSaving(false);
      return;
    }
    if (!settings.gstin.trim()) {
      setSaveNotice({ type: 'error', text: 'GSTIN is required.' });
      setSaving(false);
      return;
    }
    if (!settings.bankName.trim() || !settings.accountNumber.trim() || !settings.ifscCode.trim()) {
      setSaveNotice({ type: 'error', text: 'Bank Name, Account Number, and IFSC Code are required.' });
      setSaving(false);
      return;
    }

    try {
      const saved = await InvoiceSettingsService.updateSettings(settings);
      setSettings(saved);
      setInitialSettings(saved);
      setSaveNotice({
        type: 'success',
        text: 'Tax & Issue Settings saved successfully!'
      });
      if (onNotify) {
        onNotify('success', 'Tax & Issue Settings saved successfully.');
      }
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setSaveNotice({
        type: 'error',
        text: err?.message || 'Failed to save settings to Firebase. Please try again.'
      });
      if (onNotify) {
        onNotify('error', 'Failed to save Tax & Issuer settings to Firebase.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-12 text-center space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[#1F4E79] mx-auto" />
        <p className="text-xs font-medium text-slate-500">
          Loading Tax & Issuer Settings from Firebase generalSettings...
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-[#1F4E79]">Tax &amp; Issue Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Issuer business profile, GST credentials, remittance bank details, and default GST tax rates
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            icon={saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          >
            {saving ? 'Saving to Firebase...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      {/* Save Notification Banner */}
      {saveNotice && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in duration-200 ${
            saveNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {saveNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{saveNotice.text}</span>
          </div>
          <button
            onClick={() => setSaveNotice(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold px-1"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: ISSUER BUSINESS PROFILE */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1F4E79] flex items-center justify-center font-bold">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Issuer Business Profile
                </h3>
                <p className="text-[11px] text-slate-500">
                  Legal company identity printed on all customer tax invoices and delivery documentation
                </p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-400">Required fields marked with *</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Company Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. PERLA TEXTILES PROCESSOR"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                GSTIN <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={settings.gstin}
                onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. 33AMMPK2032Q1ZU"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Registered Address Line 1
              </label>
              <input
                type="text"
                value={settings.addressLine1}
                onChange={(e) => handleChange('addressLine1', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. NO.107, INDUSTRIAL ESTATE"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Address Line 2 / Area
              </label>
              <input
                type="text"
                value={settings.addressLine2 || ''}
                onChange={(e) => handleChange('addressLine2', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. THIRUMUDIVAKKAM, SIDCO"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                City &amp; State
              </label>
              <input
                type="text"
                value={`${settings.city || ''}${settings.state ? ', ' + settings.state : ''}`}
                onChange={(e) => {
                  const parts = e.target.value.split(',');
                  handleChange('city', parts[0]?.trim() || '');
                  if (parts[1] !== undefined) {
                    handleChange('state', parts[1]?.trim() || '');
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. CHENNAI, Tamil Nadu"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                GST State Code
              </label>
              <input
                type="text"
                value={settings.stateCode}
                onChange={(e) => handleChange('stateCode', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. 33"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                PIN Code
              </label>
              <input
                type="text"
                value={settings.pincode || ''}
                onChange={(e) => handleChange('pincode', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. 600044"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                PAN (Permanent Account Number)
              </label>
              <input
                type="text"
                value={settings.pan || ''}
                onChange={(e) => handleChange('pan', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. AMMPK2032Q"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Default HSN / SAC Code
              </label>
              <input
                type="text"
                value={settings.defaultHsnSacCode || '998821'}
                onChange={(e) => handleChange('defaultHsnSacCode', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. 998821"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Official Phone
              </label>
              <input
                type="text"
                value={settings.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. 044-24781234"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Billing Email
              </label>
              <input
                type="email"
                value={settings.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. billing@perlatextiles.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Tagline / Business Description
              </label>
              <input
                type="text"
                value={settings.tagline || ''}
                onChange={(e) => handleChange('tagline', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. Specialized Garment Washing, Dyeing & Finishing Services"
              />
            </div>
          </div>
        </Card>

        {/* SECTION 2: REMITTANCE BANK DETAILS */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Landmark className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Remittance Bank Details
                </h3>
                <p className="text-[11px] text-slate-500">
                  Designated bank account printed on customer invoices for RTGS/NEFT/IMPS transfers
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Bank Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={settings.bankName}
                onChange={(e) => handleChange('bankName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. STATE BANK OF INDIA"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Account Holder Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={settings.accountName}
                onChange={(e) => handleChange('accountName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. PERLA TEXTILES PROCESSOR"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Account Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={settings.accountNumber}
                onChange={(e) => handleChange('accountNumber', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. 30407742234"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                IFSC Code <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={settings.ifscCode}
                onChange={(e) => handleChange('ifscCode', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. SBIN0012931"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Bank Branch
              </label>
              <input
                type="text"
                value={settings.bankBranch || ''}
                onChange={(e) => handleChange('bankBranch', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. SIDCO Thirumudivakkam, Chennai"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                UPI ID (Optional)
              </label>
              <input
                type="text"
                value={settings.upiId || ''}
                onChange={(e) => handleChange('upiId', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. perlatextiles@sbi"
              />
            </div>
          </div>
        </Card>

        {/* SECTION 3: DEFAULT GST TAX RATES */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Default GST Tax Rates
                </h3>
                <p className="text-[11px] text-slate-500">
                  Standard tax percentage rates auto-applied during invoice draft calculation
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                CGST Rate (%) (Intra-State)
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.01"
                  value={settings.defaultCgstRate}
                  onChange={(e) => handleChange('defaultCgstRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">Applies to customers in Tamil Nadu (State Code 33)</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                SGST Rate (%) (Intra-State)
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.01"
                  value={settings.defaultSgstRate}
                  onChange={(e) => handleChange('defaultSgstRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">Applies to customers in Tamil Nadu (State Code 33)</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                IGST Rate (%) (Inter-State)
              </label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.01"
                  value={settings.defaultIgstRate}
                  onChange={(e) => handleChange('defaultIgstRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">Applies to customers outside Tamil Nadu</p>
            </div>
          </div>
        </Card>

        {/* SECTION 4: INVOICE DECLARATION, TERMS & SIGNATORY */}
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Invoice Declaration &amp; Authorised Signatory
                </h3>
                <p className="text-[11px] text-slate-500">
                  Legal declarations and signatory details printed on PDF invoices
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Authorised Signatory Name
              </label>
              <input
                type="text"
                value={settings.signatoryName || ''}
                onChange={(e) => handleChange('signatoryName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. Authorised Signatory"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Signatory Designation
              </label>
              <input
                type="text"
                value={settings.signatoryDesignation || ''}
                onChange={(e) => handleChange('signatoryDesignation', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="e.g. Managing Partner / Accounts Manager"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Legal Declaration
              </label>
              <textarea
                rows={2}
                value={settings.declaration || ''}
                onChange={(e) => handleChange('declaration', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="We declare that this invoice shows the actual price of the goods described..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Terms &amp; Conditions (One per line)
              </label>
              <textarea
                rows={3}
                value={Array.isArray(settings.termsAndConditions) ? settings.termsAndConditions.join('\n') : ''}
                onChange={(e) =>
                  handleChange(
                    'termsAndConditions',
                    e.target.value.split('\n').filter((l) => l.trim().length > 0)
                  )
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent transition-all shadow-2xs"
                placeholder="Mode/Terms of Payment: 30 Days Credit&#10;Disputes, if any, subject to Chennai jurisdiction only."
              />
            </div>
          </div>
        </Card>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Settings are securely saved and applied to all generated invoices</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleReset}
              disabled={saving}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              Reset
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={saving}
              icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
