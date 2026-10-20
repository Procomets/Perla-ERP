import React, { useState } from 'react';
import { InwardEntry, InwardAuditLog } from '../../../types/inward';
import { Vendor } from '../../../types/vendor';
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
  Lock
} from 'lucide-react';
import { POLockStatus, POLockService } from '../../../services/poLockService';

interface InwardDetailsProps {
  inward: InwardEntry;
  auditLogs?: InwardAuditLog[];
  customerVendor?: Vendor | null;
  onBack: () => void;
  onPrint: () => void;
  onEditDraft?: () => void;
  onPostDraft?: () => Promise<void>;
  onReverse: (reason: string) => Promise<void>;
  canManage: boolean;
  isProcessing: boolean;
  lockedPOMap?: Record<string, POLockStatus>;
}

export const InwardDetails: React.FC<InwardDetailsProps> = ({
  inward,
  auditLogs,
  customerVendor,
  onBack,
  onPrint,
  onEditDraft,
  onPostDraft,
  onReverse,
  canManage,
  isProcessing,
  lockedPOMap = {}
}) => {
  const lockStatus = POLockService.isLocked(inward, lockedPOMap);
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
      setReverseError(err?.message || 'Failed to reverse inward receipt.');
    }
  };

  const lines = inward.lines || [];

  // Customer company details
  const companyName = inward.customerCompanyNameSnapshot || customerVendor?.companyName || inward.customerName || 'Customer';
  const companyCode = customerVendor?.vendorCode || (customerVendor as any)?.code || (customerVendor as any)?.companyCode || inward.customerVendorId || inward.customerId || '—';
  const gstin = customerVendor?.taxDetails?.gstin || (customerVendor as any)?.gstin || (customerVendor?.taxDetails?.gstRegistrationStatus === 'unregistered' ? 'Unregistered' : '—');

  const vendorAddress = customerVendor?.address;
  const addressLine1 = typeof vendorAddress === 'object' ? vendorAddress?.addressLine1 : (typeof vendorAddress === 'string' ? vendorAddress : '');
  const addressLine2 = typeof vendorAddress === 'object' ? vendorAddress?.addressLine2 : '';
  const city = (typeof vendorAddress === 'object' ? vendorAddress?.city : '') || customerVendor?.city || '';
  const state = (typeof vendorAddress === 'object' ? vendorAddress?.state : '') || customerVendor?.state || '';
  const pinCode = (typeof vendorAddress === 'object' ? vendorAddress?.pinCode : '') || customerVendor?.pinCode || '';

  const formattedAddress = [addressLine1, addressLine2].filter(Boolean).join(', ');
  const cityState = [city, state].filter(Boolean).join(', ') + (pinCode ? ` - ${pinCode}` : '');

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Inward List
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-[#1F4E79]">
              {inward.inwardNo || inward.entryId || 'INW/PENDING'}
            </h2>
            {inward.status === 'posted' && <StatusChip status="Posted" variant="green" />}
            {inward.status === 'draft' && <StatusChip status="Draft" variant="slate" />}
            {inward.status === 'reversed' && <StatusChip status="Reversed" variant="rose" />}
            {inward.status === 'cancelled' && <StatusChip status="Cancelled" variant="rose" />}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Perla Textiles Processor — Thirumudivakkam, Tamil Nadu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<Printer className="w-4 h-4" />} onClick={onPrint}>
            Print Receipt
          </Button>

          {inward.status === 'draft' && canManage && (
            <>
              {onPostDraft && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={onPostDraft}
                  disabled={isProcessing}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                >
                  {isProcessing ? 'Posting...' : 'Move to Posted'}
                </Button>
              )}

              {onEditDraft && (
                lockStatus ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    icon={<Lock className="w-4 h-4 text-slate-400" />}
                    title={lockStatus.reason}
                    className="opacity-50 cursor-not-allowed text-slate-400 border-slate-200"
                  >
                    Edit Draft
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" icon={<Edit className="w-4 h-4" />} onClick={onEditDraft}>
                    Edit Draft
                  </Button>
                )
              )}
            </>
          )}

          {inward.status === 'posted' && canManage && (
            lockStatus ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                icon={<Lock className="w-4 h-4 text-slate-400" />}
                title={lockStatus.reason}
                className="opacity-50 cursor-not-allowed text-slate-400 border-slate-200"
              >
                Reverse Receipt
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCcw className="w-4 h-4 text-rose-600" />}
                onClick={() => setIsReverseModalOpen(true)}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                Reverse Receipt
              </Button>
            )
          )}
        </div>
      </div>

      {/* Lock Banner if Statement is Approved or Invoiced */}
      {lockStatus && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-900 font-medium shadow-2xs">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold block text-amber-950">Purchase Order Locked from Modification</span>
            <span className="text-amber-800">{lockStatus.reason}</span>
          </div>
        </div>
      )}

      {/* Reversal Banner if reversed */}
      {inward.status === 'reversed' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-900">
          <div className="flex items-center gap-2 font-bold text-rose-700">
            <AlertTriangle className="w-4 h-4" /> This Inward Receipt was Reversed
          </div>
          <p>
            <span className="font-semibold">Reason:</span> {inward.reversalReason || 'No reason provided'}
          </p>
          <p className="text-[11px] text-rose-600">
            Reversed by: {inward.reversedByName || inward.reversedBy || 'Authorized Manager'} on{' '}
            {formatDate(inward.reversedAt)}
          </p>
        </div>
      )}

      {/* Information Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer & Fulfillment */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79] pb-2 border-b border-slate-100">
            Customer & Fulfillment
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Customer Company</span>
              <span className="font-semibold text-slate-800 text-sm">
                {companyName}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Company Code</span>
                <span className="font-mono font-semibold text-slate-700">
                  {companyCode}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">GST NO</span>
                <span className="font-mono font-semibold text-slate-700">
                  {gstin}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Address</span>
              <span className="text-slate-700 leading-snug block">
                {formattedAddress || '—'}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">City & State</span>
              <span className="font-medium text-slate-700">
                {cityState || '—'}
              </span>
            </div>

            {inward.subcontractorNameSnapshot && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Subcontractor Unit</span>
                <span className="font-medium text-slate-700">{inward.subcontractorNameSnapshot}</span>
              </div>
            )}
          </div>
        </div>

        {/* Order Information */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79] pb-2 border-b border-slate-100">
            Order Information
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Purchase Order No</span>
              <span className="font-semibold text-[#1F4E79]">{inward.poNumberSnapshot || inward.poNumber}</span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Style Number</span>
              <span className="font-semibold text-slate-800">{inward.styleNoSnapshot || inward.styleNo}</span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Item Description</span>
              <span className="font-medium text-slate-700">{inward.itemNameSnapshot || inward.itemName}</span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Process Category</span>
              <span className="font-semibold text-slate-700 uppercase">
                {inward.processCategorySnapshot || inward.processCategory}
              </span>
            </div>
          </div>
        </div>

        {/* Delivery Challan Metadata */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79] pb-2 border-b border-slate-100">
            Delivery Challan Metadata
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Customer DC Number</span>
              <span className="font-semibold text-slate-800">
                {inward.customerDcNo}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Customer DC Date</span>
              <span className="font-medium text-slate-800">{formatDate(inward.customerDate)}</span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Actual Inward Date</span>
              <span className="font-medium text-slate-800">{formatDate(inward.inwardDate)}</span>
            </div>
            {inward.remarks && (
              <div>
                <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider mb-0.5">Remarks</span>
                <span className="text-slate-600 italic">{inward.remarks}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Colour-Wise Quantity Breakdown Table */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79] pb-2 border-b border-slate-100">
          Colour-Wise Quantities Breakdown
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#EEF5FB] text-[#1F4E79] font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 text-center w-12">S.No</th>
                <th className="p-2.5">Colour Name</th>
                <th className="p-2.5">Wash / Process</th>
                <th className="p-2.5 text-right">Ordered Qty</th>
                <th className="p-2.5 text-center">Unit</th>
                <th className="p-2.5 text-right">Previously Received</th>
                <th className="p-2.5 text-right font-bold text-emerald-700 bg-emerald-50/50">
                  Current Received
                </th>
                <th className="p-2.5 text-right">Cumulative Received</th>
                <th className="p-2.5 text-right">Balance Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {lines.map((l, idx) => (
                <tr key={l.inwardLineId || l.lineId || idx} className="hover:bg-slate-50">
                  <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                  <td className="p-2.5 font-semibold text-slate-900">
                    {l.colourNameSnapshot || l.colour}
                    {l.colourCodeSnapshot && (
                      <span className="text-[10px] text-slate-400 ml-1">({l.colourCodeSnapshot})</span>
                    )}
                  </td>
                  <td className="p-2.5 text-slate-600">{l.washTypeSnapshot || l.processType}</td>
                  <td className="p-2.5 text-right">{l.orderedQtySnapshot?.toLocaleString()}</td>
                  <td className="p-2.5 text-center">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                      {l.unit}
                    </span>
                  </td>
                  <td className="p-2.5 text-right text-slate-500">
                    {l.previouslyReceivedQtySnapshot?.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-right font-bold text-emerald-700 bg-emerald-50/30">
                    {l.receivedQty?.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-right text-slate-800">
                    {l.cumulativeReceivedQtySnapshot?.toLocaleString()}
                  </td>
                  <td className="p-2.5 text-right font-bold text-slate-600">
                    {l.balanceAfterReceiptSnapshot?.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quantities summary by unit */}
        <div className="pt-2 flex flex-wrap gap-4 text-xs font-semibold">
          {inward.totalQtyByUnit?.piece !== undefined && (
            <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800">
              Total Pieces Current Received:{' '}
              <span className="font-bold">{inward.totalQtyByUnit.piece.toLocaleString()} pcs</span>
            </div>
          )}

          {inward.totalQtyByUnit?.kg !== undefined && inward.totalQtyByUnit.kg > 0 && (
            <div className="px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-200 text-indigo-800">
              Total Kilograms Current Received:{' '}
              <span className="font-bold">{inward.totalQtyByUnit.kg.toLocaleString()} kg</span>
            </div>
          )}
        </div>
      </div>

      {/* Authorised Reversal Modal */}
      <Modal
        isOpen={isReverseModalOpen}
        onClose={() => setIsReverseModalOpen(false)}
        title="Authorised Inward Reversal"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <span className="font-bold block mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Warning: Controlled Reversal Action
            </span>
            Reversing receipt <span className="font-mono font-bold">{inward.inwardNo}</span> will mark it as reversed,
            adjust cumulative inward balances, and recalculate PO completion status. Reversal will be blocked if any
            received quantities have already been dispatched in Outward.
          </div>

          {reverseError && (
            <div className="p-3 bg-rose-100 text-rose-800 rounded font-medium">
              {reverseError}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reason for Reversal <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Goods returned to customer due to fabric defect before processing / Entered duplicate DC entry."
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-[#1F4E79] focus:border-[#1F4E79]"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setIsReverseModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleConfirmReverse}
              disabled={isProcessing}
              className="bg-rose-700 hover:bg-rose-800 text-white"
            >
              {isProcessing ? 'Processing Reversal...' : 'Confirm Reversal'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
