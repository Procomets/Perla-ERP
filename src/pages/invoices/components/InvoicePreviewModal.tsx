import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Invoice } from '../../../types/invoice';
import { FileCheck, ArrowLeft, Printer } from 'lucide-react';
import { OfficialInvoiceDocument } from './OfficialInvoiceDocument';
import { InvoicePdfService } from '../../../services/invoicePdfService';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title="Tax Invoice Preview"
      maxWidth="5xl"
    >
      <div className="space-y-4">
        {/* Banner indicating preview mode */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 rounded-lg text-xs text-slate-700 border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              This preview matches the <strong>official Tax Invoice PDF</strong> export layout.
            </span>
          </div>
          <button
            onClick={() => InvoicePdfService.printInvoicePdf(draftInvoice)}
            className="flex items-center gap-1.5 text-xs text-slate-700 hover:text-black font-semibold underline decoration-slate-400 hover:decoration-black cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Sample
          </button>
        </div>

        {/* Paper Sheet Preview Container (A4 preview canvas) */}
        <div className="bg-slate-200/60 p-4 sm:p-6 rounded-xl overflow-x-auto shadow-inner flex justify-center">
          <OfficialInvoiceDocument invoice={draftInvoice} isDraft={true} />
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
