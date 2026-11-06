import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Invoice } from '../../../types/invoice';
import { FileCheck, ArrowLeft, Printer, Hash, Calendar, CreditCard, Percent, Ban } from 'lucide-react';
import { OfficialInvoiceDocument } from './OfficialInvoiceDocument';
import { InvoicePdfService } from '../../../services/invoicePdfService';
import {
  calculateInvoiceTaxes,
  convertNumberToIndianWords,
  isIntraStateSupply
} from '../../../utils/taxCalculations';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftInvoice: Invoice | null;
  isSubmitting: boolean;
  onConfirmFinalize: (finalDraft?: Invoice) => void;
}

const QUICK_PAYMENT_TERMS = [
  'Against Delivery / 30 Days',
  'Immediate Payment',
  'Against Delivery / 15 Days',
  'Against Delivery / 45 Days'
];

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  draftInvoice,
  isSubmitting,
  onConfirmFinalize
}) => {
  const [formData, setFormData] = useState<Invoice | null>(null);

  useEffect(() => {
    if (draftInvoice && isOpen) {
      const cloned: Invoice = JSON.parse(JSON.stringify(draftInvoice));
      if (!cloned.modeOfPayment && cloned.paymentTerms) {
        cloned.modeOfPayment = cloned.paymentTerms;
      } else if (!cloned.modeOfPayment) {
        cloned.modeOfPayment = 'Against Delivery / 30 Days';
      }
      setFormData(cloned);
    }
  }, [draftInvoice, isOpen]);

  if (!isOpen || !formData) return null;

  const isWithoutGst = Boolean(
    formData.isWithoutGst ||
    formData.gstType === 'without_gst' ||
    (Number(formData.totalCgst) === 0 && Number(formData.totalSgst) === 0 && Number(formData.totalIgst) === 0 && Number(formData.cgstRate) === 0)
  );

  // Toggle GST vs Without GST
  const handleToggleGstMode = (withoutGst: boolean) => {
    setFormData((prev) => {
      if (!prev) return null;
      const subtotal = Number(prev.subtotal) || 0;

      if (withoutGst) {
        const newWords = convertNumberToIndianWords(subtotal);
        const updatedLines = (prev.lines || []).map((l) => ({
          ...l,
          cgstRate: 0,
          cgstAmount: 0,
          sgstRate: 0,
          sgstAmount: 0,
          igstRate: 0,
          igstAmount: 0,
          lineTotal: Number(l.amount) || 0
        }));

        return {
          ...prev,
          isWithoutGst: true,
          gstType: 'without_gst',
          cgstRate: 0,
          totalCgst: 0,
          sgstRate: 0,
          totalSgst: 0,
          igstRate: 0,
          totalIgst: 0,
          roundOff: 0,
          finalTotal: subtotal,
          grandTotal: subtotal,
          amountInWords: newWords,
          lines: updatedLines
        };
      } else {
        const isIntra = isIntraStateSupply(
          prev.customerSnapshot?.stateCode || '33',
          prev.customerSnapshot?.state || 'Tamil Nadu',
          prev.issuerSnapshot?.stateCode || '33'
        );

        const taxResult = calculateInvoiceTaxes(subtotal, {
          isIntraState: isIntra,
          discountAmount: Number(prev.discountAmount) || 0,
          otherCharges: Number(prev.otherCharges) || 0
        });

        const updatedLines = (prev.lines || []).map((l) => {
          const lAmt = Number(l.amount) || 0;
          return {
            ...l,
            cgstRate: isIntra ? 2.5 : 0,
            cgstAmount: isIntra ? Math.round(lAmt * 0.025 * 100) / 100 : 0,
            sgstRate: isIntra ? 2.5 : 0,
            sgstAmount: isIntra ? Math.round(lAmt * 0.025 * 100) / 100 : 0,
            igstRate: !isIntra ? 5.0 : 0,
            igstAmount: !isIntra ? Math.round(lAmt * 0.05 * 100) / 100 : 0,
            lineTotal: lAmt + Math.round(lAmt * 0.05 * 100) / 100
          };
        });

        return {
          ...prev,
          isWithoutGst: false,
          gstType: 'with_gst',
          cgstRate: isIntra ? 2.5 : 0,
          totalCgst: taxResult.cgstAmount,
          sgstRate: isIntra ? 2.5 : 0,
          totalSgst: taxResult.sgstAmount,
          igstRate: !isIntra ? 5.0 : 0,
          totalIgst: taxResult.igstAmount,
          roundOff: taxResult.roundOff,
          finalTotal: taxResult.finalTotal,
          grandTotal: taxResult.finalTotal,
          amountInWords: convertNumberToIndianWords(taxResult.finalTotal),
          lines: updatedLines
        };
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Invoice Preview & Configuration"
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* Editable Parameters Strip */}
        <div className="bg-white border border-neutral-300 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-neutral-200 pb-3">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                <span>Editable Invoice Parameters</span>
                <span className="text-[10px] font-semibold text-neutral-500 lowercase">
                  (invoice no., date, payment terms &amp; gst type)
                </span>
              </h4>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-black border border-neutral-300">
                {isWithoutGst ? (
                  <>
                    <Ban className="w-3.5 h-3.5 text-black" />
                    Without GST (Total: ₹{(Number(formData.subtotal) || 0).toLocaleString('en-IN')})
                  </>
                ) : (
                  <>
                    <Percent className="w-3.5 h-3.5 text-black" />
                    With GST (Total: ₹{(Number(formData.finalTotal) || 0).toLocaleString('en-IN')})
                  </>
                )}
              </span>

              <button
                type="button"
                onClick={() => InvoicePdfService.printInvoicePdf(formData)}
                className="flex items-center gap-1.5 text-xs text-neutral-700 hover:text-black font-semibold underline decoration-neutral-400 hover:decoration-black cursor-pointer px-2 py-1"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Sample
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {/* 1. Invoice No. */}
            <div>
              <label className="h-5 text-[11px] font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Hash className="w-3.5 h-3.5 text-black shrink-0" />
                <span>Invoice No.</span>
              </label>
              <input
                type="text"
                value={formData.invoiceNo || formData.invoiceNumber || ''}
                onChange={(e) =>
                  setFormData((prev) =>
                    prev
                      ? {
                          ...prev,
                          invoiceNo: e.target.value,
                          invoiceNumber: e.target.value
                        }
                      : null
                  )
                }
                placeholder="Auto-generated if empty"
                className="h-10 w-full px-3 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-2xs"
              />
            </div>

            {/* 2. Date */}
            <div>
              <label className="h-5 text-[11px] font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-black shrink-0" />
                <span>Invoice Date</span>
              </label>
              <input
                type="date"
                value={formData.invoiceDate ? formData.invoiceDate.split('T')[0] : ''}
                onChange={(e) =>
                  setFormData((prev) =>
                    prev ? { ...prev, invoiceDate: e.target.value } : null
                  )
                }
                className="h-10 w-full px-3 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-2xs cursor-pointer"
              />
            </div>

            {/* 3. Mode/Terms of Payment */}
            <div>
              <label className="h-5 text-[11px] font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <CreditCard className="w-3.5 h-3.5 text-black shrink-0" />
                <span>Payment Terms</span>
              </label>
              <input
                type="text"
                value={formData.modeOfPayment || formData.paymentTerms || ''}
                onChange={(e) =>
                  setFormData((prev) =>
                    prev
                      ? {
                          ...prev,
                          modeOfPayment: e.target.value,
                          paymentTerms: e.target.value
                        }
                      : null
                  )
                }
                placeholder="Against Delivery / 30 Days"
                className="h-10 w-full px-3 bg-white border border-neutral-300 rounded-lg text-xs font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-2xs"
              />
            </div>

            {/* 4. GST Button (With GST vs Without GST) */}
            <div>
              <label className="h-5 text-[11px] font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <Percent className="w-3.5 h-3.5 text-black shrink-0" />
                <span>Tax Mode</span>
              </label>
              <div className="h-10 p-1 bg-neutral-100 border border-neutral-300 rounded-lg grid grid-cols-2 gap-1 items-stretch shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleToggleGstMode(false)}
                  className={`h-full rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    !isWithoutGst
                      ? 'bg-[#1F4E79] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title="Include GST (5%)"
                >
                  <Percent className="w-3 h-3" />
                  <span>With GST</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleGstMode(true)}
                  className={`h-full rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    isWithoutGst
                      ? 'bg-[#1F4E79] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title="All GST values 0, total = subtotal"
                >
                  <Ban className="w-3 h-3" />
                  <span>Without GST</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Paper Sheet Preview Container (A4 preview canvas) */}
        <div className="bg-neutral-200/60 p-4 sm:p-6 rounded-xl overflow-x-auto shadow-inner flex justify-center max-h-[560px] overflow-y-auto">
          <OfficialInvoiceDocument invoice={formData} isDraft={true} />
        </div>

        {/* Modal Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Back / Cancel
          </Button>

          <Button
            variant="primary"
            onClick={() => onConfirmFinalize(formData)}
            disabled={isSubmitting}
            icon={isSubmitting ? undefined : <FileCheck className="w-4 h-4" />}
            className="bg-[#1F4E79] hover:bg-[#163a5c] text-white border-[#1F4E79] shadow-xs cursor-pointer"
          >
            {isSubmitting ? 'Finalizing Invoice...' : 'Confirm & Finalize Invoice'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
