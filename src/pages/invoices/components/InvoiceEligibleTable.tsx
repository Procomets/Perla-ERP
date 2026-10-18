import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { InvoiceEligibleItem } from '../../../types/invoice';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import {
  Receipt,
  Download,
  FileCheck2,
  ArrowRight,
  Info
} from 'lucide-react';

interface InvoiceEligibleTableProps {
  eligibleItems: InvoiceEligibleItem[];
  loading: boolean;
  onGenerateInvoice: (selectedApprovalIds: string[]) => void;
  onDownloadInvoice: (item: InvoiceEligibleItem) => void;
  onNavigateStatement?: () => void;
}

export const InvoiceEligibleTable: React.FC<InvoiceEligibleTableProps> = ({
  eligibleItems,
  loading,
  onGenerateInvoice,
  onDownloadInvoice,
  onNavigateStatement
}) => {
  return (
    <Card className="overflow-hidden border border-slate-200 bg-white">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-600" />
            Approved Colour Lines Ready for Invoicing
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Click &ldquo;Download Invoice&rdquo; on any line to immediately generate and download the official Tax Invoice PDF.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
          {eligibleItems.length} line{eligibleItems.length === 1 ? '' : 's'} eligible
        </span>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">
          <div className="w-8 h-8 border-2 border-[#1F4E79] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading eligible colour lines...
        </div>
      ) : eligibleItems.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Info className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-800">No Approved Lines Waiting for Invoicing</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            All approved quantities have been invoiced, or no reconciliation colour lines have been approved yet.
          </p>
          {onNavigateStatement && (
            <button
              type="button"
              onClick={onNavigateStatement}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F4E79] hover:underline cursor-pointer"
            >
              Go to Statement Module <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-3">PO Number</th>
                <th className="py-3 px-3">Style / Item</th>
                <th className="py-3 px-3">Colour & Process</th>
                <th className="py-3 px-3 text-right">Approved Qty</th>
                <th className="py-3 px-3 text-center">Basis</th>
                <th className="py-3 px-3 text-right">Agreed Rate</th>
                <th className="py-3 px-3 text-right">Est. Taxable Value</th>
                <th className="py-3 px-3">Approval Date</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eligibleItems.map((item) => (
                <tr
                  key={item.approvalId}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-slate-900">{item.companyName}</td>
                  <td className="py-3 px-3 font-mono font-medium text-slate-700">{item.poNumber}</td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800 block">{item.styleNo}</span>
                    <span className="text-[10px] text-slate-500">{item.itemName}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-800 block">{item.colour}</span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      {item.washType} ({item.processCategory})
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {item.remainingApprovedQty.toLocaleString('en-IN')} {item.unit}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {item.rateBasis === 'per_kg' ? '₹/Kg' : '₹/Piece'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-800">
                    ₹{item.rate.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-[#1F4E79]">
                    {formatCurrency(item.estimatedTaxableAmount)}
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-[11px]">
                    {formatDate(item.approvedAt)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onDownloadInvoice(item)}
                        icon={<Download className="w-3.5 h-3.5" />}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs"
                      >
                        Download Invoice
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGenerateInvoice([item.approvalId])}
                        icon={<Receipt className="w-3.5 h-3.5" />}
                      >
                        Review
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
