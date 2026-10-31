import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Invoice, InvoiceLine, RateBasis, InvoiceStatus } from '../../../types/invoice';
import { Vendor } from '../../../types/vendor';
import { VendorService } from '../../../services/vendorService';
import { OfficialInvoiceDocument } from './OfficialInvoiceDocument';
import {
  calculateLineAmount,
  calculateInvoiceTaxes,
  convertNumberToIndianWords,
  isIntraStateSupply,
  safeRound
} from '../../../utils/taxCalculations';
import {
  FileText,
  Building2,
  ListPlus,
  Calculator,
  Landmark,
  Download,
  Save,
  Trash2,
  Plus,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  Eye,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface InvoiceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  vendors?: Vendor[];
  onSavePermanent: (updatedInvoice: Invoice) => Promise<void>;
  onDownloadTemporary: (tempInvoice: Invoice) => Promise<void>;
}

export const InvoiceEditModal: React.FC<InvoiceEditModalProps> = ({
  isOpen,
  onClose,
  invoice,
  vendors: propVendors = [],
  onSavePermanent,
  onDownloadTemporary
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'lines' | 'totals' | 'bank' | 'preview'>('general');
  const [formData, setFormData] = useState<Invoice | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Master customer list
  const [customerMasterList, setCustomerMasterList] = useState<Vendor[]>(propVendors);
  const [selectedMasterVendorId, setSelectedMasterVendorId] = useState<string>('');
  const [masterSuccessMsg, setMasterSuccessMsg] = useState<string | null>(null);

  // Recalculation status feedback
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalcSuccess, setRecalcSuccess] = useState<string | null>(null);

  // Sync prop vendors or fetch from Master if empty
  useEffect(() => {
    if (propVendors && propVendors.length > 0) {
      setCustomerMasterList(propVendors);
    } else if (isOpen) {
      VendorService.getVendors({}, { page: 1, pageSize: 500 }, false)
        .then((res) => {
          const list = (res.vendors || []).filter(
            (v) => v.vendorType === 'customer' || v.vendorType === 'both' || (v as any).roles?.includes('Customer')
          );
          setCustomerMasterList(list);
        })
        .catch((err) => console.warn('Could not fetch customer master list:', err));
    }
  }, [propVendors, isOpen]);

  // Sync form data whenever invoice changes or modal opens
  useEffect(() => {
    if (invoice && isOpen) {
      // Deep clone to allow safe editing without mutating original until saved
      setFormData(JSON.parse(JSON.stringify(invoice)));
      setError(null);
      setRecalcSuccess(null);
      setMasterSuccessMsg(null);
      setSelectedMasterVendorId(invoice.customerId || invoice.companyId || '');
      setActiveTab('general');
    }
  }, [invoice, isOpen]);

  if (!isOpen || !formData) return null;

  // Handle simple top-level fields
  const handleTopLevelChange = (field: keyof Invoice, value: any) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  // Handle nested customer snapshot
  const handleCustomerChange = (field: string, value: any) => {
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        customerSnapshot: {
          ...prev.customerSnapshot,
          [field]: value
        }
      };
    });
  };

  // Handle selecting customer from Master
  const handleSelectCustomerFromMaster = (vendorId: string) => {
    setSelectedMasterVendorId(vendorId);
    if (!vendorId) return;

    const vendor = customerMasterList.find((v) => (v.vendorId || v.id) === vendorId);
    if (!vendor) return;

    const addressParts = [
      vendor.address?.addressLine1,
      vendor.address?.addressLine2
    ].filter(Boolean).join(', ') || (vendor as any).address || '';

    const gstin = vendor.taxDetails?.gstin || vendor.gstin || '';
    const pan = vendor.taxDetails?.pan || vendor.pan || '';
    const stateCode = vendor.address?.gstStateCode || vendor.stateCode || (gstin ? gstin.substring(0, 2) : '33');
    const state = vendor.address?.state || vendor.state || 'Tamil Nadu';
    const city = vendor.address?.city || vendor.city || '';
    const contactPerson = vendor.primaryContactName || (vendor as any).contacts?.[0]?.name || '';
    const phone = vendor.communication?.officePhone || vendor.communication?.mobileNumber || vendor.phone || '';
    const email = vendor.communication?.officialEmail || vendor.email || '';

    setFormData((prev) => {
      if (!prev) return null;

      // Check if state change affects intra-state tax status
      const isIntra = isIntraStateSupply(stateCode, state, prev.issuerSnapshot?.stateCode || '33');
      const taxResult = calculateInvoiceTaxes(prev.subtotal || 0, {
        isIntraState: isIntra,
        discountAmount: Number(prev.discountAmount) || 0,
        otherCharges: Number(prev.otherCharges) || 0
      });

      return {
        ...prev,
        customerId: vendor.vendorId || vendor.id || prev.customerId,
        companyId: vendor.vendorId || vendor.id || prev.companyId,
        customerSnapshot: {
          companyName: vendor.companyName,
          address: addressParts,
          city,
          state,
          stateCode,
          gstin,
          pan,
          contactPerson,
          phone,
          email
        },
        totalCgst: taxResult.cgstAmount,
        totalSgst: taxResult.sgstAmount,
        totalIgst: taxResult.igstAmount,
        finalTotal: taxResult.finalTotal,
        grandTotal: taxResult.finalTotal,
        amountInWords: convertNumberToIndianWords(taxResult.finalTotal)
      };
    });

    setMasterSuccessMsg(`Loaded details for "${vendor.companyName}" from Master`);
    setTimeout(() => setMasterSuccessMsg(null), 4000);
  };

  // Handle nested issuer snapshot
  const handleIssuerChange = (field: string, value: any) => {
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        issuerSnapshot: {
          ...prev.issuerSnapshot,
          [field]: value
        } as any
      };
    });
  };

  // Handle nested bank details
  const handleBankChange = (field: string, value: any) => {
    setFormData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        bankDetailsSnapshot: {
          ...prev.bankDetailsSnapshot,
          [field]: value
        } as any
      };
    });
  };

  // Handle line item changes
  const handleLineChange = (index: number, field: keyof InvoiceLine, value: any) => {
    setFormData((prev) => {
      if (!prev) return null;
      const updatedLines = [...prev.lines];
      const line = { ...updatedLines[index], [field]: value };

      if (['qty', 'rate', 'rateBasis', 'billableWeightKg'].includes(field as string)) {
        const qty = Number(field === 'qty' ? value : (line.qty ?? (line as any).quantity ?? 0));
        const rate = Number(field === 'rate' ? value : line.rate);
        const rateBasis = (field === 'rateBasis' ? value : (line.rateBasis || 'per_piece')) as RateBasis;
        const billableWeight = Number(field === 'billableWeightKg' ? value : (line.billableWeightKg ?? 0));

        line.qty = qty;
        (line as any).quantity = qty;
        line.rate = rate;
        line.rateBasis = rateBasis;
        line.billableWeightKg = billableWeight;
        line.amount = calculateLineAmount(qty, rate, rateBasis, billableWeight);
        line.taxableAmount = line.amount;
      } else if (field === 'amount') {
        const amt = Number(value) || 0;
        line.amount = amt;
        line.taxableAmount = amt;
      }

      updatedLines[index] = line;
      return { ...prev, lines: updatedLines };
    });
  };

  // Add a new line item
  const handleAddLine = () => {
    setFormData((prev) => {
      if (!prev) return null;
      const isIntra = isIntraStateSupply(
        prev.customerSnapshot?.stateCode,
        prev.customerSnapshot?.state,
        prev.issuerSnapshot?.stateCode || '33'
      );
      const newLine: InvoiceLine = {
        lineId: `line_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sourcePoLineId: `manual_${Date.now()}`,
        poNumber: prev.poNumber,
        styleNoSnapshot: prev.styleNo,
        description: 'Textile processing / Dyeing / Washing',
        hsnSac: '998821',
        colour: 'Standard',
        process: 'Dyeing',
        qty: 1,
        unit: 'piece',
        rateBasis: 'per_piece',
        rate: 0,
        amount: 0,
        taxableAmount: 0,
        cgstRate: isIntra ? 2.5 : 0,
        cgstAmount: 0,
        sgstRate: isIntra ? 2.5 : 0,
        sgstAmount: 0,
        igstRate: isIntra ? 0 : 5.0,
        igstAmount: 0
      };
      return { ...prev, lines: [...prev.lines, newLine] };
    });
  };

  // Remove a line item
  const handleRemoveLine = (index: number) => {
    setFormData((prev) => {
      if (!prev || prev.lines.length <= 1) return prev;
      const updatedLines = prev.lines.filter((_, i) => i !== index);
      return { ...prev, lines: updatedLines };
    });
  };

  // Auto-recalculate complete tax and subtotal breakdown based on current line items and standard GST rules
  const handleRecalculateTotals = () => {
    if (!formData) return;
    setIsRecalculating(true);

    try {
      const isIntra = isIntraStateSupply(
        formData.customerSnapshot?.stateCode,
        formData.customerSnapshot?.state,
        formData.issuerSnapshot?.stateCode || '33'
      );

      let derivedSubtotal = 0;
      const updatedLines = (formData.lines || []).map((line) => {
        const qty = Number(line.qty ?? (line as any).quantity ?? 0);
        const rate = Number(line.rate ?? 0);
        const basis = (line.rateBasis || 'per_piece') as RateBasis;
        const weight = Number(line.billableWeightKg ?? 0);

        let lineAmt = calculateLineAmount(qty, rate, basis, weight);
        if (lineAmt === 0 && Number(line.amount || line.taxableAmount || 0) > 0) {
          lineAmt = Number(line.amount || line.taxableAmount || 0);
        }

        derivedSubtotal += lineAmt;

        const cgstRate = isIntra ? (line.cgstRate || 2.5) : 0;
        const sgstRate = isIntra ? (line.sgstRate || 2.5) : 0;
        const igstRate = isIntra ? 0 : (line.igstRate || 5.0);

        const cgstAmt = safeRound((lineAmt * cgstRate) / 100, 2);
        const sgstAmt = safeRound((lineAmt * sgstRate) / 100, 2);
        const igstAmt = safeRound((lineAmt * igstRate) / 100, 2);

        return {
          ...line,
          qty,
          rate,
          rateBasis: basis,
          amount: lineAmt,
          taxableAmount: lineAmt,
          cgstRate,
          cgstAmount: cgstAmt,
          sgstRate,
          sgstAmount: sgstAmt,
          igstRate,
          igstAmount: igstAmt,
          lineTotal: safeRound(lineAmt + cgstAmt + sgstAmt + igstAmt, 2)
        };
      });

      // If line items sum is zero but manual subtotal was entered in Tab 3, preserve it
      let finalSubtotal = derivedSubtotal;
      if (finalSubtotal === 0 && Number(formData.subtotal || formData.taxableAmount || 0) > 0) {
        finalSubtotal = Number(formData.subtotal || formData.taxableAmount || 0);
      }

      const taxResult = calculateInvoiceTaxes(finalSubtotal, {
        isIntraState: isIntra,
        discountAmount: Number(formData.discountAmount) || 0,
        otherCharges: Number(formData.otherCharges) || 0
      });

      setFormData({
        ...formData,
        lines: updatedLines,
        subtotal: taxResult.subtotal,
        taxableAmount: taxResult.taxableAmount,
        totalCgst: taxResult.cgstAmount,
        totalSgst: taxResult.sgstAmount,
        totalIgst: taxResult.igstAmount,
        discountAmount: taxResult.discountAmount,
        otherCharges: taxResult.otherCharges,
        roundOff: taxResult.roundOff,
        finalTotal: taxResult.finalTotal,
        grandTotal: taxResult.finalTotal,
        amountInWords: convertNumberToIndianWords(taxResult.finalTotal)
      });

      const regime = isIntra
        ? `Intra-State (CGST ₹${taxResult.cgstAmount.toFixed(2)} + SGST ₹${taxResult.sgstAmount.toFixed(2)})`
        : `Inter-State (IGST ₹${taxResult.igstAmount.toFixed(2)})`;

      setRecalcSuccess(`✓ Totals recalculated successfully! ${regime} • Grand Total: ₹${taxResult.finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
      setTimeout(() => setRecalcSuccess(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'Error recalculating totals');
    } finally {
      setIsRecalculating(false);
    }
  };

  // Immediate manual adjustment recalculator for Tab 3 inputs
  const handleTaxOrAdjustmentChange = (
    field: 'subtotal' | 'totalCgst' | 'totalSgst' | 'totalIgst' | 'discountAmount' | 'otherCharges' | 'roundOff',
    val: number
  ) => {
    setFormData((prev) => {
      if (!prev) return null;
      const next = { ...prev, [field]: val };

      if (field === 'subtotal') {
        const isIntra = isIntraStateSupply(
          next.customerSnapshot?.stateCode,
          next.customerSnapshot?.state,
          next.issuerSnapshot?.stateCode || '33'
        );
        const taxResult = calculateInvoiceTaxes(val, {
          isIntraState: isIntra,
          discountAmount: Number(next.discountAmount) || 0,
          otherCharges: Number(next.otherCharges) || 0
        });
        return {
          ...next,
          subtotal: taxResult.subtotal,
          taxableAmount: taxResult.taxableAmount,
          totalCgst: taxResult.cgstAmount,
          totalSgst: taxResult.sgstAmount,
          totalIgst: taxResult.igstAmount,
          roundOff: taxResult.roundOff,
          finalTotal: taxResult.finalTotal,
          grandTotal: taxResult.finalTotal,
          amountInWords: convertNumberToIndianWords(taxResult.finalTotal)
        };
      }

      // If specific tax or charge field modified
      const sub = Number(next.subtotal) || 0;
      const disc = Number(next.discountAmount) || 0;
      const cgst = Number(next.totalCgst) || 0;
      const sgst = Number(next.totalSgst) || 0;
      const igst = Number(next.totalIgst) || 0;
      const other = Number(next.otherCharges) || 0;
      const round = Number(next.roundOff) || 0;

      const computedFinal = safeRound(sub - disc + cgst + sgst + igst + other + round, 2);
      return {
        ...next,
        taxableAmount: Math.max(0, safeRound(sub - disc, 2)),
        finalTotal: computedFinal,
        grandTotal: computedFinal,
        amountInWords: convertNumberToIndianWords(computedFinal)
      };
    });
  };

  // 1. Permanent Save Handler
  const handleSave = async () => {
    if (!formData) return;
    try {
      setIsSaving(true);
      setError(null);
      await onSavePermanent(formData);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save invoice changes to database.');
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Temporary Download Handler
  const handleDownloadTemp = async () => {
    if (!formData) return;
    try {
      setIsDownloading(true);
      setError(null);
      await onDownloadTemporary(formData);
    } catch (err: any) {
      setError(err?.message || 'Failed to generate temporary invoice PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? () => {} : onClose}
      title={`Admin Edit Mode: Tax Invoice • ${formData.invoiceNo || formData.id}`}
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* Admin Badge Banner */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Admin Elevated Edit:</strong> Changes can be previewed live, saved permanently to the database, or downloaded as a temporary draft PDF.
            </span>
          </div>
          <span className="font-mono text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded uppercase">
            Admin Access Only
          </span>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 text-xs font-bold gap-1 sm:gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'general'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            1. Invoice &amp; Parties
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lines')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'lines'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListPlus className="w-3.5 h-3.5" />
            2. Line Items ({formData.lines.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('totals')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'totals'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            3. Taxes &amp; Totals
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'bank'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            4. Bank &amp; Terms
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 border-b-2 transition-colors cursor-pointer shrink-0 ${
              activeTab === 'preview'
                ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50 rounded-t-md font-extrabold'
                : 'border-transparent text-emerald-700 hover:text-emerald-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            5. Live Invoice Preview
          </button>
        </div>

        {/* Tab 1: Invoice & Parties */}
        {activeTab === 'general' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Invoice Meta */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#1F4E79]" />
                Invoice Identification
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Number *</label>
                  <input
                    type="text"
                    value={formData.invoiceNo || ''}
                    onChange={(e) => handleTopLevelChange('invoiceNo', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    value={formData.invoiceDate ? formData.invoiceDate.split('T')[0] : ''}
                    onChange={(e) => handleTopLevelChange('invoiceDate', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Financial Year</label>
                  <input
                    type="text"
                    value={formData.financialYear || '2026-27'}
                    onChange={(e) => handleTopLevelChange('financialYear', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleTopLevelChange('status', e.target.value as InvoiceStatus)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  >
                    <option value="finalized">Finalized</option>
                    <option value="draft">Draft</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Internal PO Number</label>
                  <input
                    type="text"
                    value={formData.poNumber || ''}
                    onChange={(e) => handleTopLevelChange('poNumber', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Style Number</label>
                  <input
                    type="text"
                    value={formData.styleNo || ''}
                    onChange={(e) => handleTopLevelChange('styleNo', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Customer PO Ref</label>
                  <input
                    type="text"
                    value={formData.customerPoNumber || ''}
                    onChange={(e) => handleTopLevelChange('customerPoNumber', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                    placeholder="Optional customer ref"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Work Order (W.O.)</label>
                  <input
                    type="text"
                    value={formData.woNumber || ''}
                    onChange={(e) => handleTopLevelChange('woNumber', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                    placeholder="Optional W.O. #"
                  />
                </div>
              </div>
            </div>

            {/* Customer (Buyer) Details */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  Customer / Billed-To Party (Buyer)
                </h4>

                {/* Master Customer Fetch Dropdown */}
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Fetch from Master:
                  </label>
                  <select
                    value={selectedMasterVendorId}
                    onChange={(e) => handleSelectCustomerFromMaster(e.target.value)}
                    className="bg-emerald-50 border border-emerald-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 max-w-[260px] truncate"
                  >
                    <option value="">-- Choose Customer Master --</option>
                    {customerMasterList.map((v) => (
                      <option key={v.vendorId || v.id} value={v.vendorId || v.id}>
                        {v.companyName} {v.taxDetails?.gstin ? `(${v.taxDetails.gstin})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {masterSuccessMsg && (
                <div className="p-2 bg-emerald-100/80 border border-emerald-300 rounded-lg flex items-center gap-2 text-xs text-emerald-900 font-semibold animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>{masterSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Company / Customer Name *</label>
                  <input
                    type="text"
                    value={formData.customerSnapshot?.companyName || ''}
                    onChange={(e) => handleCustomerChange('companyName', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Customer GSTIN</label>
                  <input
                    type="text"
                    value={formData.customerSnapshot?.gstin || ''}
                    onChange={(e) => handleCustomerChange('gstin', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono uppercase text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.customerSnapshot?.contactPerson || ''}
                    onChange={(e) => handleCustomerChange('contactPerson', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Billing Address</label>
                  <input
                    type="text"
                    value={formData.customerSnapshot?.address || ''}
                    onChange={(e) => handleCustomerChange('address', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.customerSnapshot?.city || ''}
                    onChange={(e) => handleCustomerChange('city', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">State &amp; State Code</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="State"
                      value={formData.customerSnapshot?.state || ''}
                      onChange={(e) => handleCustomerChange('state', e.target.value)}
                      className="w-2/3 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                    />
                    <input
                      type="text"
                      placeholder="Code (e.g. 33)"
                      value={formData.customerSnapshot?.stateCode || ''}
                      onChange={(e) => handleCustomerChange('stateCode', e.target.value)}
                      className="w-1/3 bg-white border border-slate-300 rounded-lg px-1.5 py-1.5 text-center font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Issuer (Supplier) Details */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-700" />
                Issuer / Billed-From Party (Perla Processing Unit)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Issuer Company Name</label>
                  <input
                    type="text"
                    value={formData.issuerSnapshot?.companyName || ''}
                    onChange={(e) => handleIssuerChange('companyName', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Issuer GSTIN</label>
                  <input
                    type="text"
                    value={formData.issuerSnapshot?.gstin || ''}
                    onChange={(e) => handleIssuerChange('gstin', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono uppercase text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Issuer Phone / Email</label>
                  <input
                    type="text"
                    value={formData.issuerSnapshot?.phone || ''}
                    onChange={(e) => handleIssuerChange('phone', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Line Items */}
        {activeTab === 'lines' && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex justify-between items-center pb-1">
              <span className="text-xs text-slate-500 font-medium">
                Edit description, quantity, rates, and HSN codes for each row.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddLine}
                className="text-xs flex items-center gap-1.5 text-[#1F4E79] border-blue-300 hover:bg-blue-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Row
              </Button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left min-w-[1000px] divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-2.5 w-10 text-center">#</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Description</th>
                    <th className="py-2.5 px-2.5 w-24">HSN / SAC</th>
                    <th className="py-2.5 px-2.5 w-28">Colour</th>
                    <th className="py-2.5 px-2.5 w-24 text-right">Qty</th>
                    <th className="py-2.5 px-2.5 w-20">Unit</th>
                    <th className="py-2.5 px-2.5 w-24">Rate Basis</th>
                    <th className="py-2.5 px-2.5 w-24 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-2.5 w-24 text-right">Weight (kg)</th>
                    <th className="py-2.5 px-2.5 w-28 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-2 w-10 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {formData.lines.map((line, idx) => (
                    <tr key={line.lineId || idx} className="hover:bg-slate-50/70">
                      <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={line.description || ''}
                          onChange={(e) => handleLineChange(idx, 'description', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:bg-white focus:outline-none focus:border-[#1F4E79]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={line.hsnSac || '998821'}
                          onChange={(e) => handleLineChange(idx, 'hsnSac', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs font-mono text-center focus:bg-white focus:outline-none focus:border-[#1F4E79]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={line.colour || ''}
                          onChange={(e) => handleLineChange(idx, 'colour', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:bg-white focus:outline-none focus:border-[#1F4E79]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          value={line.qty}
                          onChange={(e) => handleLineChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-right font-bold focus:bg-white focus:outline-none focus:border-[#1F4E79]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={line.unit}
                          onChange={(e) => handleLineChange(idx, 'unit', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs uppercase focus:bg-white focus:outline-none focus:border-[#1F4E79]"
                        >
                          <option value="piece">Pcs</option>
                          <option value="kg">Kg</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={line.rateBasis}
                          onChange={(e) => handleLineChange(idx, 'rateBasis', e.target.value as RateBasis)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs focus:bg-white focus:outline-none focus:border-[#1F4E79]"
                        >
                          <option value="per_piece">/ Pc</option>
                          <option value="per_kg">/ Kg</option>
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.rate}
                          onChange={(e) => handleLineChange(idx, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-right font-medium focus:bg-white focus:outline-none focus:border-[#1F4E79]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.billableWeightKg ?? ''}
                          placeholder="—"
                          onChange={(e) => handleLineChange(idx, 'billableWeightKg', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-right focus:bg-white focus:outline-none focus:border-[#1F4E79]"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          value={line.amount}
                          onChange={(e) => handleLineChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-right font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-[#1F4E79]"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          disabled={formData.lines.length <= 1}
                          className="text-slate-400 hover:text-rose-600 disabled:opacity-20 cursor-pointer p-1 rounded"
                          title="Delete line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRecalculateTotals}
                disabled={isRecalculating}
                className="text-xs flex items-center gap-1.5 text-emerald-800 border-emerald-300 hover:bg-emerald-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                Recalculate All Tax Totals from Rows
              </Button>
            </div>
          </div>
        )}

        {/* Tab 3: Taxes & Totals */}
        {activeTab === 'totals' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900">
              <div className="space-y-0.5">
                <span className="font-semibold">Automatic Statutory Recalculation:</span>
                <p className="text-[11px] text-blue-700">
                  Clicking recalculate will re-derive standard GST (2.5% CGST + 2.5% SGST or 5% IGST) and word representations.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRecalculateTotals}
                disabled={isRecalculating}
                className="text-xs font-bold flex items-center gap-1.5 text-[#1F4E79] border-blue-300 bg-white hover:bg-blue-100 shadow-xs shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
                {isRecalculating ? 'Recalculating...' : 'Recalculate Totals'}
              </Button>
            </div>

            {recalcSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-semibold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{recalcSuccess}</span>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-[#1F4E79]" />
                Taxable Value &amp; GST Adjustments
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Taxable Subtotal (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.subtotal}
                    onChange={(e) => handleTaxOrAdjustmentChange('subtotal', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">CGST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.totalCgst}
                    onChange={(e) => handleTaxOrAdjustmentChange('totalCgst', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">SGST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.totalSgst}
                    onChange={(e) => handleTaxOrAdjustmentChange('totalSgst', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">IGST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.totalIgst}
                    onChange={(e) => handleTaxOrAdjustmentChange('totalIgst', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discountAmount || 0}
                    onChange={(e) => handleTaxOrAdjustmentChange('discountAmount', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Other Charges (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.otherCharges || 0}
                    onChange={(e) => handleTaxOrAdjustmentChange('otherCharges', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Round Off (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.roundOff || 0}
                    onChange={(e) => handleTaxOrAdjustmentChange('roundOff', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 text-right focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#1F4E79] mb-1">Final Grand Total (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.finalTotal}
                    onChange={(e) => handleTopLevelChange('finalTotal', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border-2 border-[#1F4E79] rounded-lg px-2.5 py-1.5 font-black text-slate-900 text-right text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Amount in Words</label>
                <input
                  type="text"
                  value={formData.amountInWords || ''}
                  onChange={(e) => handleTopLevelChange('amountInWords', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-serif italic text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Bank Details & Declarations */}
        {activeTab === 'bank' && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-[#1F4E79]" />
                Issuer Bank Account Details
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankDetailsSnapshot?.bankName || ''}
                    onChange={(e) => handleBankChange('bankName', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={formData.bankDetailsSnapshot?.accountName || ''}
                    onChange={(e) => handleBankChange('accountName', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={formData.bankDetailsSnapshot?.accountNumber || ''}
                    onChange={(e) => handleBankChange('accountNumber', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.bankDetailsSnapshot?.ifscCode || ''}
                    onChange={(e) => handleBankChange('ifscCode', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono uppercase text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Branch</label>
                  <input
                    type="text"
                    value={formData.bankDetailsSnapshot?.branch || ''}
                    onChange={(e) => handleBankChange('branch', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">UPI ID (Optional)</label>
                  <input
                    type="text"
                    value={formData.bankDetailsSnapshot?.upiId || ''}
                    onChange={(e) => handleBankChange('upiId', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Declaration &amp; Terms</h4>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Statutory Declaration</label>
                <textarea
                  rows={2}
                  value={formData.declarationSnapshot || ''}
                  onChange={(e) => handleTopLevelChange('declarationSnapshot', e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Live Invoice Preview */}
        {activeTab === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-slate-100 rounded-xl text-xs text-slate-700 border border-slate-200">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-slate-800">
                  Live Official Tax Invoice Preview (A4 Printable Document)
                </span>
              </div>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Live representation of current in-memory invoice values
              </span>
            </div>

            <div className="bg-slate-200/70 p-3 sm:p-6 rounded-xl overflow-x-auto shadow-inner flex justify-center border border-slate-300 max-h-[65vh]">
              <div className="scale-95 sm:scale-100 origin-top">
                <OfficialInvoiceDocument
                  invoice={formData}
                  isDraft={formData.status?.toLowerCase() === 'draft'}
                />
              </div>
            </div>
          </div>
        )}

        {/* 3 Explicit Action Buttons as Requested: Save Permanently | Download Temporarily | Cancel */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>All edits are verified before database persistence.</span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {/* 1. CANCEL BUTTON */}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving || isDownloading}
              className="text-xs font-semibold px-4 py-2 border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </Button>

            {/* 2. DOWNLOAD TEMPORARILY BUTTON */}
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemp}
              disabled={isSaving || isDownloading}
              icon={<Download className="w-4 h-4 text-emerald-700" />}
              className="text-xs font-bold px-4 py-2 text-emerald-800 border-emerald-400 bg-emerald-50/50 hover:bg-emerald-100/70 cursor-pointer"
              title="Download PDF immediately with current in-memory edits without altering the database"
            >
              {isDownloading ? 'Generating PDF...' : 'Download Temporarily'}
            </Button>

            {/* 3. SAVE PERMANENTLY BUTTON */}
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={isSaving || isDownloading}
              icon={<Save className="w-4 h-4" />}
              className="text-xs font-bold px-5 py-2 bg-[#1F4E79] hover:bg-[#15385b] text-white shadow-sm cursor-pointer"
              title="Save all changes permanently to the Firebase database and update the invoice"
            >
              {isSaving ? 'Saving to Database...' : 'Save Permanently'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
