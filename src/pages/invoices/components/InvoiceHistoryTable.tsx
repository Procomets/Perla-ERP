import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Invoice } from '../../../types/invoice';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import {
  FileText,
  Download,
  Printer,
  Eye,
  XCircle,
  Clock,
  CheckCircle2,
  AlertOctagon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface InvoiceHistoryTableProps {
  invoices: Invoice[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  loading: boolean;
  isAdmin: boolean;
  onPageChange: (newPage: number) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onPrintPdf: (invoice: Invoice) => void;
  onOpenCancel: (invoice: Invoice) => void;
}

export const InvoiceHistoryTable: React.FC<InvoiceHistoryTableProps> = ({
  invoices,
  totalCount,
  currentPage,
  pageSize,
  loading,
  isAdmin,
  onPageChange,
  onViewInvoice,
  onDownloadPdf,
  onPrintPdf,
  onOpenCancel
}) => {
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const renderStatus = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'finalized') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> Finalized
        </span>
      );
    }
    if (s === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3" /> Draft
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
          <AlertOctagon className="w-3 h-3" /> Cancelled
        </span>
      );
    }
    return <StatusChip status={status} />;
  };

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#1F4E79]" />
            Generated Tax Invoices & Records
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Full audit log of finalized, draft, and cancelled invoices. Click any invoice to view, print, or download PDF.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200 self-start sm:self-auto">
          {totalCount} total invoice{totalCount === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">
          <div className="w-8 h-8 border-2 border-[#1F4E79] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading invoices...
        </div>
      ) : invoices.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-800">No Invoices Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            No invoices match the current filters or no tax invoices have been generated yet.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 min-w-[170px]">Invoice No</th>
                <th className="py-3 px-3 min-w-[120px]">Date</th>
                <th className="py-3 px-3 min-w-[220px]">Customer / Company</th>
                <th className="py-3 px-3 min-w-[180px]">PO &amp; Style</th>
                <th className="py-3 px-3 min-w-[120px] text-right">Taxable Subtotal</th>
                <th className="py-3 px-3 min-w-[100px] text-right">GST Total</th>
                <th className="py-3 px-3 min-w-[120px] text-right">Grand Total</th>
                <th className="py-3 px-3 min-w-[110px] text-center">Status</th>
                <th className="py-3 px-4 min-w-[180px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...invoices]
                .sort((a, b) => {
                  const timeA = new Date(a.createdAt || a.updatedAt || a.invoiceDate || 0).getTime();
                  const timeB = new Date(b.createdAt || b.updatedAt || b.invoiceDate || 0).getTime();
                  return timeB - timeA;
                })
                .map((inv) => {
                  const gstTotal = (inv.totalCgst || 0) + (inv.totalSgst || 0) + (inv.totalIgst || 0);
                  const isCancelled = inv.status.toLowerCase() === 'cancelled';
                  return (
                  <tr
                    key={inv.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCancelled ? 'bg-rose-50/20 opacity-75' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-900 text-xs block">
                        {inv.invoiceNo || inv.invoiceNumber || inv.id}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">FY: {inv.financialYear || '2026-27'}</span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 whitespace-nowrap font-medium">
                      {formatDate(inv.invoiceDate)}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-bold text-slate-900 text-xs block">
                        {inv.customerSnapshot?.companyName || 'Customer'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        GSTIN: {inv.customerSnapshot?.gstin || 'Unregistered'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-slate-900 text-xs block">{inv.poNumber}</span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">Style: {inv.styleNo}</span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                      {formatCurrency(inv.subtotal || inv.taxableAmount || 0)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                      {formatCurrency(gstTotal)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-bold text-slate-900 font-mono whitespace-nowrap text-xs">
                      {formatCurrency(inv.finalTotal || inv.grandTotal || 0)}
                    </td>
                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      {renderStatus(inv.status)}
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDownloadPdf(inv)}
                          className="text-xs font-bold text-emerald-800 border-emerald-300 hover:bg-emerald-50 h-auto py-1 px-2.5"
                        >
                          Download
                        </Button>
                        <button
                          type="button"
                          onClick={() => onViewInvoice(inv)}
                          title="View Invoice Details"
                          className="p-1.5 text-slate-600 hover:text-black hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintPdf(inv)}
                          title="Print Tax Invoice"
                          className="p-1.5 text-slate-600 hover:text-black hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isAdmin && !isCancelled && (
                          <button
                            type="button"
                            onClick={() => onOpenCancel(inv)}
                            title="Cancel Invoice"
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} records
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="p-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="p-1.5 rounded border border-slate-300 disabled:opacity-40 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};
