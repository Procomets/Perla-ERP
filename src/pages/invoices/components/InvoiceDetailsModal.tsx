import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Invoice } from '../../../types/invoice';
import { formatDate } from '../../../utils/formatters';
import { Printer, Download, AlertOctagon } from 'lucide-react';
import { OfficialInvoiceDocument } from './OfficialInvoiceDocument';

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
      maxWidth="5xl"
    >
      <div className="space-y-4">
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

        {/* Paper Sheet Preview Container (A4 preview canvas) */}
        <div className="bg-slate-200/60 p-4 sm:p-6 rounded-xl overflow-x-auto shadow-inner flex justify-center">
          <OfficialInvoiceDocument invoice={invoice} isDraft={isDraft} />
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
