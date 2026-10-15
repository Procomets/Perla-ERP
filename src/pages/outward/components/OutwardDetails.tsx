import React, { useState } from 'react';
import { OutwardEntry, OutwardAuditLog } from '../../../types/outward';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Modal } from '../../../components/ui/Modal';
import { formatDate } from '../../../utils/formatters';
import {
  ArrowLeft,
  Printer,
  RotateCcw,
  AlertTriangle,
  Edit,
  CheckCircle2,
  Truck,
  Building,
  Layers,
  Calendar,
  FileText
} from 'lucide-react';

interface OutwardDetailsProps {
  outward: OutwardEntry;
  auditLogs?: OutwardAuditLog[];
  onBack: () => void;
  onPrint: () => void;
  onEditDraft?: () => void;
  onPostDraft?: () => Promise<void>;
  onReverse: (reason: string) => Promise<void>;
  canManage: boolean;
  isProcessing: boolean;
}

export const OutwardDetails: React.FC<OutwardDetailsProps> = ({
  outward,
  auditLogs = [],
  onBack,
  onPrint,
  onEditDraft,
  onPostDraft,
  onReverse,
  canManage,
  isProcessing
}) => {
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [reverseError, setReverseError] = useState<string | null>(null);

  const handleConfirmReverse = async () => {
    if (!reversalReason || reversalReason.trim().length < 5) {
      setReverseError('Please enter a detailed reversal reason of at least 5 characters.');
      return;
    }

    try {
      setReverseError(null);
      await onReverse(reversalReason.trim());
      setIsReverseModalOpen(false);
      setReversalReason('');
    } catch (err: any) {
      setReverseError(err?.message || 'Failed to reverse outward dispatch.');
    }
  };

  const lines = outward.lines || [];

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Outward Dispatches
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-[#1F4E79]">
              {outward.outwardNo || outward.entryId || 'OUT/PENDING'}
            </h2>
            {outward.status === 'posted' && <StatusChip status="Posted" variant="green" />}
            {outward.status === 'draft' && <StatusChip status="Draft" variant="slate" />}
            {outward.status === 'reversed' && <StatusChip status="Reversed" variant="rose" />}
            {outward.status === 'cancelled' && <StatusChip status="Cancelled" variant="rose" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Perla Textiles Processor — Thirumudivakkam, Tamil Nadu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrint} className="flex items-center gap-1.5 text-xs">
            <Printer className="w-4 h-4" />
            Print DC
          </Button>

          {outward.status === 'draft' && canManage && (
            <>
              {onPostDraft && (
                <Button
                  size="sm"
                  onClick={onPostDraft}
                  disabled={isProcessing}
                  className="bg-[#1F4E79] hover:bg-[#163858] text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isProcessing ? 'Posting...' : 'Move to Posted'}
                </Button>
              )}

              {onEditDraft && (
                <Button variant="outline" size="sm" onClick={onEditDraft} className="flex items-center gap-1.5 text-xs">
                  <Edit className="w-4 h-4" />
                  Edit Draft
                </Button>
              )}
            </>
          )}

          {outward.status === 'posted' && canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReverseModalOpen(true)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center gap-1.5 text-xs font-semibold"
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              Reverse Dispatch
            </Button>
          )}
        </div>
      </div>

      {/* Reversal Banner if Reversed */}
      {outward.status === 'reversed' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-rose-900 text-sm">Outward Dispatch Reversed</p>
            <p className="text-rose-700">
              This dispatch was reversed by{' '}
              <strong>{outward.reversedByName || outward.reversedBy || 'Authorized User'}</strong> on{' '}
              {formatDate(outward.reversedAt)}. The dispatchable balances for this PO have been restored.
            </p>
            {outward.reversalReason && (
              <p className="text-slate-700 italic bg-white/60 p-2 rounded border border-rose-200/60 mt-1">
                Reason: &ldquo;{outward.reversalReason}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      {/* Section 1: Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Customer & PO Details */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building className="w-4 h-4 text-[#1F4E79]" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Customer & Order Details
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <p className="text-slate-400">Customer Company</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">
                {outward.customerCompanyNameSnapshot || outward.customerName || 'Customer'}
              </p>
            </div>
            {outward.subcontractorNameSnapshot && (
              <div>
                <p className="text-slate-400">Subcontractor</p>
                <p className="font-semibold text-slate-800 mt-0.5">
                  {outward.subcontractorNameSnapshot}
                </p>
              </div>
            )}
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">PO Number:</span>
              <span className="font-bold text-[#1F4E79]">
                {outward.poNumberSnapshot || outward.poNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Style Number:</span>
              <span className="font-semibold text-slate-800">
                {outward.styleNoSnapshot || outward.styleNo}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Item Name:</span>
              <span className="font-medium text-slate-800">
                {outward.itemNameSnapshot || outward.itemName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Process Category:</span>
              <span className="font-semibold uppercase text-slate-800">
                {outward.processCategorySnapshot || outward.processCategory}
              </span>
            </div>
          </div>
        </div>

        {/* Challan & Date Details */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Calendar className="w-4 h-4 text-[#1F4E79]" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Challan & Dates
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <p className="text-slate-400">Our DC Number</p>
              <p className="font-bold text-slate-900 text-sm mt-0.5">{outward.ourDcNo}</p>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Dispatch Date:</span>
              <span className="font-semibold text-slate-800">
                {formatDate(outward.outwardDate)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Created At:</span>
              <span className="text-slate-700">{formatDate(outward.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Created By:</span>
              <span className="font-medium text-slate-800">
                {outward.createdByName || outward.createdBy}
              </span>
            </div>
            {outward.postedAt && (
              <div className="flex justify-between">
                <span className="text-slate-400">Posted By:</span>
                <span className="font-medium text-emerald-700">
                  {outward.postedByName || outward.postedBy} ({formatDate(outward.postedAt)})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Logistics & Vehicle */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Truck className="w-4 h-4 text-[#1F4E79]" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Logistics & Transport
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Vehicle Number:</span>
              <span className="font-semibold text-slate-800">
                {outward.vehicleNumber || outward.vehicleNo || 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Driver Name:</span>
              <span className="font-medium text-slate-800">
                {outward.driverName || 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Transporter:</span>
              <span className="font-medium text-slate-800">
                {outward.transporterNameSnapshot || 'In-House Logistics'}
              </span>
            </div>
            {outward.destination && (
              <div className="flex justify-between">
                <span className="text-slate-400">Destination:</span>
                <span className="font-medium text-slate-800 text-right">{outward.destination}</span>
              </div>
            )}
            {outward.remarks && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400">Remarks:</span>
                <p className="text-slate-700 italic mt-0.5">&ldquo;{outward.remarks}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Colour-Wise Quantities Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Layers className="w-4 h-4 text-[#1F4E79]" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Colour-Wise Outward Quantity Breakdown
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <th className="p-2.5 border border-slate-200 text-center w-12">S.No.</th>
                <th className="p-2.5 border border-slate-200 min-w-[150px]">Colour</th>
                <th className="p-2.5 border border-slate-200">Process</th>
                <th className="p-2.5 border border-slate-200 text-right">Ordered Qty</th>
                <th className="p-2.5 border border-slate-200 text-center w-16">Unit</th>
                <th className="p-2.5 border border-slate-200 text-right">Total Inward</th>
                <th className="p-2.5 border border-slate-200 text-right">Prev Dispatched</th>
                <th className="p-2.5 border border-slate-200 text-right">Available Before</th>
                <th className="p-2.5 border border-slate-200 text-right bg-blue-50/40 text-blue-900 font-bold">This DC Dispatch</th>
                <th className="p-2.5 border border-slate-200 text-right">Balance After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lines.map((line, idx) => {
                const ord = Number(line.orderedQtySnapshot) || 0;
                const inw = Number(line.cumulativeInwardQtySnapshot) || 0;
                const prev = Number(line.previouslyDispatchedQtySnapshot) || 0;
                const avail =
                  line.availableForDispatchSnapshot !== undefined
                    ? Number(line.availableForDispatchSnapshot)
                    : Math.max(0, inw - prev);
                const disp = Number(line.dispatchQty) || 0;
                const rem =
                  line.remainingAfterDispatchSnapshot !== undefined
                    ? Number(line.remainingAfterDispatchSnapshot)
                    : Math.max(0, avail - disp);

                return (
                  <tr key={line.outwardLineId || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-2.5 border border-slate-200 text-center text-slate-500 font-medium">
                      {idx + 1}
                    </td>
                    <td className="p-2.5 border border-slate-200 font-semibold text-slate-900">
                      {line.colourNameSnapshot || line.colour}
                      {line.colourCodeSnapshot && (
                        <span className="block text-[11px] text-slate-400 font-normal">
                          Code: {line.colourCodeSnapshot}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-slate-600">
                      {line.washTypeSnapshot || line.processType || 'Standard Wash'}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-medium text-slate-700">
                      {ord.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-center text-slate-500 uppercase text-[10px] font-medium">
                      {line.unit}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-medium text-slate-700">
                      {inw.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right text-slate-500">
                      {prev.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-semibold text-emerald-700">
                      {avail.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-bold text-blue-700 bg-blue-50/20">
                      {disp.toLocaleString()}
                    </td>
                    <td className="p-2.5 border border-slate-200 text-right font-semibold text-[#1F4E79]">
                      {rem.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Audit Ledger & Logs */}
      {auditLogs && auditLogs.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <FileText className="w-4 h-4 text-[#1F4E79]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Audit Trail & Transaction History
            </h3>
          </div>
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.auditId}
                className="p-3 bg-slate-50/70 rounded-lg border border-slate-200/70 text-xs flex flex-col sm:flex-row justify-between gap-2"
              >
                <div>
                  <span className="font-bold text-slate-900 capitalize mr-2">
                    {log.action}
                  </span>
                  <span className="text-slate-600">{log.summary}</span>
                </div>
                <div className="text-[11px] text-slate-400 whitespace-nowrap">
                  {log.performedByName || log.performedBy} • {formatDate(log.performedAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {isReverseModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsReverseModalOpen(false)}
          title="Reverse Outward Dispatch"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Reversing outward dispatch{' '}
              <strong className="text-slate-900">{outward.outwardNo}</strong> will restore the
              dispatchable quantities back to Purchase Order{' '}
              <strong>{outward.poNumberSnapshot || outward.poNumber}</strong>.
            </p>

            {reverseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {reverseError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Reversal Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Explain why this dispatch is being reversed (e.g. wrong batch delivered, customer return, clerical correction)..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReverseModalOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                onClick={handleConfirmReverse}
                disabled={isProcessing}
              >
                {isProcessing ? 'Reversing...' : 'Confirm Reversal'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
