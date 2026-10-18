import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Invoice } from '../../../types/invoice';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import {
  Printer,
  Download,
  Building2,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertOctagon,
  Clock
} from 'lucide-react';

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onDownloadPdf: (invoice: Invoice) => void;
  onPrintPdf: (invoice: Invoice) => void;
}

export const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onDownloadPdf,
  onPrintPdf
}) => {
  if (!invoice) return null;

  const isCancelled = invoice.status.toLowerCase() === 'cancelled';
  const isDraft = invoice.status.toLowerCase() === 'draft';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Tax Invoice • ${invoice.invoiceNo || invoice.invoiceNumber || invoice.id}`}
      maxWidth="2xl"
    >
      <div className="space-y-6 text-slate-800">
        {/* Status Callout if Cancelled */}
        {isCancelled && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-900">
            <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Cancelled Invoice:</span> This invoice was cancelled on{' '}
              {formatDate(invoice.cancelledAt)} by {invoice.cancelledByName || 'Admin'}.
              {invoice.cancellationReason && (
                <p className="mt-0.5 font-medium">Reason: {invoice.cancellationReason}</p>
              )}
            </div>
          </div>
        )}

        {/* Invoice Printable Sheet Preview */}
        <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-xs">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-3">
            <div>
              <h2 className="text-lg font-black text-[#1F4E79] tracking-tight">
                {invoice.issuerSnapshot?.companyName || 'PERLA TEXTILES PROCESSOR'}
              </h2>
              <p className="text-xs text-slate-500">
                {invoice.issuerSnapshot?.addressLine1 || 'Plot 42, SIDCO Industrial Estate, Thirumudivakkam, Chennai - 600132'}
              </p>
              <p className="text-[11px] text-slate-600 font-mono mt-0.5">
                GSTIN: <span className="font-semibold text-slate-800">{invoice.issuerSnapshot?.gstin || '33AAACP8899P1Z4'}</span> | State: Tamil Nadu (33)
              </p>
            </div>

            <div className="text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-1 ${
                isCancelled
                  ? 'bg-rose-100 text-rose-800'
                  : isDraft
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {invoice.status}
              </span>
              <p className="text-xs text-slate-500 font-mono">Invoice No: <span className="font-bold text-slate-900">{invoice.invoiceNo}</span></p>
              <p className="text-xs text-slate-500">Date: <span className="font-semibold text-slate-800">{formatDate(invoice.invoiceDate)}</span></p>
            </div>
          </div>

          {/* Customer & Order Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
              <span className="text-[11px] font-bold text-[#1F4E79] uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Billed To / Consignee
              </span>
              <p className="font-bold text-sm text-slate-900">{invoice.customerSnapshot?.companyName}</p>
              <p className="text-slate-600 mt-0.5">{invoice.customerSnapshot?.address}</p>
              <p className="text-slate-600">{invoice.customerSnapshot?.city}, {invoice.customerSnapshot?.state}</p>
              <p className="font-mono text-slate-800 font-medium mt-1">
                GSTIN: {invoice.customerSnapshot?.gstin || 'Unregistered'} (State Code: {invoice.customerSnapshot?.stateCode || '33'})
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
              <span className="text-[11px] font-bold text-[#1F4E79] uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Order References
              </span>
              <div className="flex justify-between">
                <span className="text-slate-500">Purchase Order:</span>
                <span className="font-semibold text-slate-900 font-mono">{invoice.poNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Style Number:</span>
                <span className="font-semibold text-slate-900">{invoice.styleNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Financial Year:</span>
                <span className="font-semibold text-slate-900 font-mono">{invoice.financialYear}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Place of Supply:</span>
                <span className="font-semibold text-slate-900">{invoice.customerSnapshot?.state}</span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mt-5 overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="py-2 px-3 text-center w-8">#</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-center">HSN/SAC</th>
                  <th className="py-2 px-3 text-center">Colour</th>
                  <th className="py-2 px-3 text-center">Process</th>
                  <th className="py-2 px-3 text-right">Quantity</th>
                  <th className="py-2 px-3 text-center">Basis</th>
                  <th className="py-2 px-3 text-right">Rate</th>
                  <th className="py-2 px-3 text-right">Taxable Amt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines.map((line, idx) => (
                  <tr key={line.lineId || idx}>
                    <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">{line.description}</td>
                    <td className="py-2 px-3 text-center font-mono text-slate-600">{line.hsnSac || '998821'}</td>
                    <td className="py-2 px-3 text-center">{line.colour}</td>
                    <td className="py-2 px-3 text-center capitalize">{line.process}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-800">
                      {line.qty.toLocaleString('en-IN')} {line.unit}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                        {line.rateBasis === 'per_kg' ? '₹/Kg' : '₹/Pc'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">
                      ₹{line.rate.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                      {formatCurrency(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 mt-2">
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <span className="font-bold text-[#1F4E79] flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider">
                  <CreditCard className="w-3.5 h-3.5" /> Remittance Bank Details
                </span>
                <p className="text-slate-700 font-medium">{invoice.bankDetailsSnapshot?.bankName || 'HDFC Bank, Thirumudivakkam Branch'}</p>
                <p className="text-slate-600">A/C Name: {invoice.bankDetailsSnapshot?.accountName || 'Perla Textiles Processor'}</p>
                <p className="font-mono font-bold text-slate-800">
                  A/C No: {invoice.bankDetailsSnapshot?.accountNumber || '50200012345678'} | IFSC: {invoice.bankDetailsSnapshot?.ifscCode || 'HDFC0001234'}
                </p>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 text-xs">
                <span className="font-bold text-[#1F4E79] block mb-0.5">Amount in Words:</span>
                <p className="font-semibold text-slate-800 italic">{invoice.amountInWords}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Subtotal:</span>
                <span className="font-mono font-semibold text-slate-900">{formatCurrency(invoice.subtotal)}</span>
              </div>

              {invoice.totalCgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>CGST ({invoice.cgstRate || 2.5}%):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(invoice.totalCgst)}</span>
                </div>
              )}

              {invoice.totalSgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>SGST ({invoice.sgstRate || 2.5}%):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(invoice.totalSgst)}</span>
                </div>
              )}

              {invoice.totalIgst > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>IGST ({invoice.igstRate || 5.0}%):</span>
                  <span className="font-mono font-semibold text-slate-900">{formatCurrency(invoice.totalIgst)}</span>
                </div>
              )}

              {invoice.roundOff !== 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Round Off:</span>
                  <span className="font-mono">{formatCurrency(invoice.roundOff)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2.5 border-t-2 border-slate-300 text-sm">
                <span className="font-black text-[#1F4E79] uppercase tracking-wide">Total Payable:</span>
                <span className="font-black text-lg text-[#1F4E79] font-mono">
                  {formatCurrency(invoice.finalTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onPrintPdf(invoice)}
              icon={<Printer className="w-4 h-4" />}
            >
              Print Tax Invoice
            </Button>
            <Button
              variant="primary"
              onClick={() => onDownloadPdf(invoice)}
              icon={<Download className="w-4 h-4" />}
            >
              Download PDF
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
