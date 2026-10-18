import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Invoice } from '../../../types/invoice';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { CheckCircle2, ShieldCheck, FileCheck } from 'lucide-react';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftInvoice: Invoice | null;
  isSubmitting: boolean;
  onConfirmFinalize: () => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  draftInvoice,
  isSubmitting,
  onConfirmFinalize
}) => {
  if (!draftInvoice) return null;

  const isIntraState =
    (draftInvoice.customerSnapshot.stateCode === '33' ||
      draftInvoice.customerSnapshot.state?.toLowerCase().includes('tamil nadu')) &&
    draftInvoice.totalIgst === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Tax Invoice Preview"
      maxWidth="4xl"
    >
      <div className="space-y-6 text-slate-800 p-1">
        {/* Invoice Paper Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header Row */}
          <div className="p-6 border-b border-slate-200 bg-slate-50/40">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    {draftInvoice.issuerSnapshot?.companyName || 'PERLA TEXTILES PROCESSOR'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                    Draft
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {draftInvoice.issuerSnapshot?.addressLine1 ||
                    'NO.107, INDUSTRIAL ESTATE, THIRUMUDIVAKKAM, SIDCO, CHENNAI-600044'}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 font-mono mt-1.5">
                  <span>
                    GSTIN: <strong className="text-slate-800">{draftInvoice.issuerSnapshot?.gstin || '33AMMPK2032Q1ZU'}</strong>
                  </span>
                  <span>State: <strong>Tamil Nadu (33)</strong></span>
                  {draftInvoice.issuerSnapshot?.pan && (
                    <span>PAN: <strong>{draftInvoice.issuerSnapshot.pan}</strong></span>
                  )}
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="text-left sm:text-right text-xs space-y-1 bg-white sm:bg-transparent p-3 sm:p-0 rounded-lg border sm:border-0 border-slate-200">
                <div>
                  <span className="text-slate-500">Invoice Date:</span>{' '}
                  <strong className="text-slate-900">{formatDate(draftInvoice.invoiceDate)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Financial Year:</span>{' '}
                  <strong className="text-slate-900">{draftInvoice.financialYear}</strong>
                </div>
                <div>
                  <span className="text-slate-500">PO Number:</span>{' '}
                  <strong className="text-slate-900 font-mono">{draftInvoice.poNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Style No:</span>{' '}
                  <strong className="text-slate-900">{draftInvoice.styleNo}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Client & Tax Info */}
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-slate-200">
            <div>
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-1">
                Billed To (Buyer)
              </p>
              <h4 className="text-base font-bold text-slate-900">{draftInvoice.customerSnapshot.companyName}</h4>
              <p className="text-xs text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                {draftInvoice.customerSnapshot.address}
                {draftInvoice.customerSnapshot.city ? `, ${draftInvoice.customerSnapshot.city}` : ''}
                {draftInvoice.customerSnapshot.state ? `, ${draftInvoice.customerSnapshot.state}` : ''}
              </p>
              <div className="mt-2 text-xs font-mono text-slate-700">
                <span>GSTIN: </span>
                <strong className="text-slate-900 font-semibold">
                  {draftInvoice.customerSnapshot.gstin || 'Unregistered'}
                </strong>
                <span className="text-slate-500 ml-2">
                  (Code: {draftInvoice.customerSnapshot.stateCode || '33'})
                </span>
              </div>
            </div>

            <div className="sm:border-l sm:border-slate-100 sm:pl-6 space-y-2 text-xs">
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2">
                Order & Tax Details
              </p>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Place of Supply</span>
                <span className="font-semibold text-slate-800">{draftInvoice.customerSnapshot.state || 'Tamil Nadu'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">GST Classification</span>
                <span className={`font-semibold ${isIntraState ? 'text-emerald-700' : 'text-blue-700'}`}>
                  {isIntraState ? 'Intra-State (CGST + SGST @ 2.50% each)' : 'Inter-State (IGST @ 5.00%)'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Reverse Charge</span>
                <span className="font-semibold text-slate-700">N.A. (Not Applicable)</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="py-3 px-4 w-10 text-center">#</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-3 text-center">HSN/SAC</th>
                  <th className="py-3 px-4">Colour</th>
                  <th className="py-3 px-4">Process</th>
                  <th className="py-3 px-4 text-right">Quantity</th>
                  <th className="py-3 px-4 text-right">Rate</th>
                  <th className="py-3 px-4 text-right">Taxable Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draftInvoice.lines.map((line, idx) => (
                  <tr key={line.lineId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{line.description}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-600">{line.hsnSac || '998821'}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{line.colour}</td>
                    <td className="py-3 px-4 capitalize text-slate-700">{line.process}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {line.qty.toLocaleString('en-IN')} <span className="text-[11px] font-normal text-slate-500">{line.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-800">
                      ₹{line.rate.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Summary Section */}
          <div className="p-6 border-t border-slate-200 bg-slate-50/30 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left: Bank Info & Amount in Words */}
            <div className="space-y-4">
              <div className="p-3.5 bg-white rounded-lg border border-slate-200 text-xs">
                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                  Bank Details for Remittance
                </p>
                <p className="font-bold text-slate-900">
                  {draftInvoice.bankDetailsSnapshot?.bankName || 'STATE BANK OF INDIA'}
                </p>
                <p className="text-slate-600 text-xs mt-0.5">
                  A/C No: <strong className="font-mono text-slate-800">{draftInvoice.bankDetailsSnapshot?.accountNumber || '30407742234'}</strong>
                  {' · '}
                  IFSC: <strong className="font-mono text-slate-800">{draftInvoice.bankDetailsSnapshot?.ifscCode || 'SBIN0012931'}</strong>
                </p>
              </div>

              <div className="p-3.5 bg-blue-50/50 rounded-lg border border-blue-100 text-xs">
                <span className="text-slate-500 text-[11px] uppercase tracking-wider block font-semibold mb-0.5">
                  Amount in Words:
                </span>
                <p className="font-bold text-slate-900 leading-relaxed">{draftInvoice.amountInWords}</p>
              </div>
            </div>

            {/* Right: Calculations */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900">{formatCurrency(draftInvoice.subtotal)}</span>
              </div>

              {draftInvoice.totalCgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Add : CGST (2.50%):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(draftInvoice.totalCgst)}</span>
                </div>
              )}

              {draftInvoice.totalSgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Add : SGST (2.50%):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(draftInvoice.totalSgst)}</span>
                </div>
              )}

              {draftInvoice.totalIgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Add : IGST (5.00%):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(draftInvoice.totalIgst)}</span>
                </div>
              )}

              {draftInvoice.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Round Off:</span>
                  <span className="font-mono">{formatCurrency(draftInvoice.roundOff)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-900">Total Amount with Tax:</span>
                <span className="font-bold text-lg text-[#1F4E79] font-mono">
                  {formatCurrency(draftInvoice.finalTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex justify-between items-center pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={onConfirmFinalize}
            disabled={isSubmitting}
            icon={isSubmitting ? undefined : <FileCheck className="w-4 h-4" />}
          >
            {isSubmitting ? 'Finalizing Invoice...' : 'Confirm & Finalize Tax Invoice'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
