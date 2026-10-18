import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Invoice } from '../../../types/invoice';
import { AlertTriangle } from 'lucide-react';

interface InvoiceCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onConfirmCancel: (invoiceId: string, reason: string) => Promise<void>;
}

export const InvoiceCancelModal: React.FC<InvoiceCancelModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onConfirmCancel
}) => {
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for cancelling this invoice.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await onConfirmCancel(invoice.id, reason.trim());
      setReason('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel invoice.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title="Authorize Invoice Cancellation"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-700">
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Permanent Cancellation Record:</span> Cancelling Tax Invoice{' '}
            <span className="font-mono font-bold text-rose-800">{invoice.invoiceNo}</span> will mark its status as
            cancelled in the ERP. Historical records and audit logs are preserved permanently according to GST compliance
            rules.
          </div>
        </div>

        <div>
          <label className="font-bold text-slate-800 block mb-1">
            Reason for Cancellation <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder="e.g. Quantity discrepancy corrected, rate amendment approved by customer, duplicate draft..."
            className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            required
          />
          {error && <p className="text-rose-600 mt-1 font-medium">{error}</p>}
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Dismiss
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={loading || !reason.trim()}
          >
            {loading ? 'Cancelling Invoice...' : 'Confirm Invoice Cancellation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
