import React from 'react';
import { InvoiceHistoryItem } from '../../../types/statement';
import { formatDate, formatQuantity, formatCurrency } from '../../../utils/formatters';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import { History, ExternalLink, Receipt, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InvoicePdfService } from '../../../services/invoicePdfService';
import { InvoiceService } from '../../../services/invoiceService';

interface InvoiceHistoryTableProps {
  historyItems: InvoiceHistoryItem[];
  companyName?: string;
  onRefresh: () => void;
  isLoading: boolean;
}

export const InvoiceHistoryTable: React.FC<InvoiceHistoryTableProps> = ({
  historyItems,
  companyName,
  onRefresh,
  isLoading
}) => {
  const navigate = useNavigate();

  const handleDownloadInvoice = async (item: InvoiceHistoryItem) => {
    try {
      if (item.invoiceId) {
        const inv = await InvoiceService.getInvoiceById(item.invoiceId);
        if (inv) {
          await InvoicePdfService.downloadInvoicePdf(inv);
          return;
        }
      }
      const authUser = { uid: 'usr', displayName: 'Authorized User' };
      const draft = await InvoiceService.createInvoiceDraft([item.approvalId], authUser, true);
      await InvoicePdfService.downloadInvoicePdf(draft);
    } catch (e) {
      console.error('Failed to download invoice:', e);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
      {/* Header */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#1F4E79]" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Invoiced Historical Records Ledger
            </h3>
            <p className="text-[11px] text-slate-500">
              Fully reconciled colour lines that have been approved and billed to {companyName || 'Customers'}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-slate-500">
            {historyItems.length} invoiced line(s) recorded
          </span>
        </div>
      </div>

      {historyItems.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-slate-50/20">
          <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          No invoiced colour lines found in history yet. Lines approved and billed in the Invoice module will appear here.
        </div>
      ) : (
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-center border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-300">
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Invoice No</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Invoice Date</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Customer Company</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">PO Number</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Style & Item</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Colour Line</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Invoiced Qty</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Unit</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Rate</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Amount (₹)</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {historyItems.map((item) => (
                <tr key={item.approvalId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 border border-slate-200 text-center font-bold text-[#1F4E79] whitespace-nowrap">
                    <span className="font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {item.invoiceNo || 'INV-FINALIZED'}
                    </span>
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center text-slate-600 whitespace-nowrap">
                    {formatDate(item.invoiceDate || item.approvedAt)}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center font-semibold text-slate-900 whitespace-nowrap">
                    {item.companyName}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center font-bold text-slate-800 whitespace-nowrap">
                    {item.poNumber}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center text-slate-700 whitespace-nowrap">
                    <span className="font-mono font-medium">{item.styleNo}</span>
                    <span className="text-slate-400 block text-[11px]">{item.itemName}</span>
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center font-bold text-slate-900 whitespace-nowrap">
                    {item.colour}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center font-black text-emerald-700 whitespace-nowrap">
                    {item.quantity.toLocaleString('en-IN')}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center uppercase text-slate-500 font-semibold text-[11px] whitespace-nowrap">
                    {item.unit}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center text-slate-600 font-medium whitespace-nowrap">
                    {formatCurrency(item.rate)}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center font-black text-slate-900 whitespace-nowrap">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center whitespace-nowrap">
                    <StatusChip status="Invoiced" variant="slate" />
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        size="sm"
                        variant="primary"
                        className="text-xs flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                        onClick={() => handleDownloadInvoice(item)}
                        title="Download Tax Invoice PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs flex items-center gap-1"
                        onClick={() => navigate('/erp/invoices')}
                        title="Open Invoice module"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
