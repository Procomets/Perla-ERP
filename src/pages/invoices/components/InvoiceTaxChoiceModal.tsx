import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { InvoiceEligibleItem } from '../../../types/invoice';
import {
  Percent,
  Ban
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

interface InvoiceTaxChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InvoiceEligibleItem[];
  onConfirm: (
    gstType: 'with_gst' | 'without_gst',
    action: 'direct_download' | 'review_draft'
  ) => void;
  isProcessing?: boolean;
}

export const InvoiceTaxChoiceModal: React.FC<InvoiceTaxChoiceModalProps> = ({
  isOpen,
  onClose,
  items,
  onConfirm,
  isProcessing = false
}) => {
  const [selectedGstType, setSelectedGstType] = useState<'with_gst' | 'without_gst'>('with_gst');

  if (!isOpen || items.length === 0) return null;

  const firstItem = items[0];
  const companyName = firstItem.companyName || 'Customer';
  const poNumber = firstItem.poNumber;
  const styleNo = firstItem.styleNo;

  const totalQuantity = items.reduce((sum, item) => sum + (Number(item.remainingApprovedQty) || 0), 0);
  const subtotal = items.reduce((sum, item) => sum + (Number(item.estimatedTaxableAmount) || 0), 0);

  // Approximate standard 5% GST for comparison preview
  const estimatedGstAmount = Math.round(subtotal * 0.05 * 100) / 100;
  const totalWithGst = Math.round(subtotal + estimatedGstAmount);
  const totalWithoutGst = subtotal;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isProcessing ? () => {} : onClose}
      title="Select Invoice Tax Configuration"
      maxWidth="xl"
    >
      <div className="space-y-5 py-1">
        {/* Order Context Strip */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-xs">{companyName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-100 text-[#1F4E79]">
                PO #{poNumber}
              </span>
              <span className="text-[11px] text-slate-600 font-medium">Style: {styleNo}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/80">
            <span className="text-slate-600">
              {items.length} Colour Line{items.length > 1 ? 's' : ''} ({totalQuantity.toLocaleString()} {items[0]?.unit || 'pcs'})
            </span>
            <span className="font-bold text-slate-800">
              Taxable Subtotal: <span className="font-mono text-[#1F4E79]">{formatCurrency(subtotal)}</span>
            </span>
          </div>
        </div>

        {/* GST Type Selection Cards */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
            Choose Invoice Type:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: With GST */}
            <div
              onClick={() => setSelectedGstType('with_gst')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                selectedGstType === 'with_gst'
                  ? 'border-[#1F4E79] bg-blue-50/40 shadow-xs ring-1 ring-[#1F4E79]'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="p-2 rounded-lg bg-blue-100 text-[#1F4E79]">
                    <Percent className="w-4 h-4 stroke-[2.5]" />
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1F4E79]">
                    With GST • Tax Invoice
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Export</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    With GST (CGST/SGST 5% or IGST 5%) applied. Uses Export Tax Invoice series.
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200/80 flex items-baseline justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Est. Grand Total</span>
                <span className="font-bold font-mono text-slate-900 text-sm">
                  {formatCurrency(totalWithGst)}
                </span>
              </div>
            </div>

            {/* Card 2: Without GST */}
            <div
              onClick={() => setSelectedGstType('without_gst')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                selectedGstType === 'without_gst'
                  ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
                    <Ban className="w-4 h-4 stroke-[2.5]" />
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Without GST • Separate Series
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Domestic</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Without GST (0% tax applied). Generates under a separate Domestic invoice number series.
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200/80 flex items-baseline justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Final Total</span>
                <span className="font-bold font-mono text-emerald-800 text-sm">
                  {formatCurrency(totalWithoutGst)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Informative Notice */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <p className="text-[11px] leading-relaxed">
            {selectedGstType === 'without_gst' ? (
              <span>
                <strong>Domestic Invoicing (Without GST):</strong> This invoice will be generated without GST under the separate Domestic invoice number series (DOM) and stored in your Firebase cloud database.
              </span>
            ) : (
              <span>
                <strong>Export Invoicing (With GST):</strong> This invoice will compute standard GST rates according to buyer state location under the Export Tax Invoice series (PTP) and be stored in your Firebase cloud database.
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto text-xs py-1.5 h-auto cursor-pointer"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => onConfirm(selectedGstType, 'review_draft')}
              className="w-full sm:w-auto text-xs py-1.5 h-auto font-semibold cursor-pointer flex items-center justify-center"
            >
              <span>Review &amp; Edit Draft</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              disabled={isProcessing}
              onClick={() => onConfirm(selectedGstType, 'direct_download')}
              className="w-full sm:w-auto bg-[#1F4E79] hover:bg-[#163a5c] text-white font-semibold text-xs py-1.5 h-auto shadow-xs cursor-pointer flex items-center justify-center"
            >
              <span>{isProcessing ? 'Generating...' : 'Generate & Download PDF'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
