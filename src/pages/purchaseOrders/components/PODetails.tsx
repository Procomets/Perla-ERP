import React, { useState } from 'react';
import {
  ArrowLeft,
  Printer,
  Edit,
  Send,
  CheckCircle2,
  XCircle,
  Ban,
  GitFork,
  Building,
  Layers,
  FileText,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  FileCheck2
} from 'lucide-react';
import {
  PurchaseOrder,
  POAuditLog,
  POAmendment
} from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { InwardEntry, OutwardEntry } from '../../../types/inwardOutward';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Modal } from '../../../components/ui/Modal';
import {
  formatCurrency,
  formatQuantity,
  formatDate
} from '../../../utils/formatters';

interface PODetailsProps {
  po: PurchaseOrder;
  customer?: Vendor | null;
  logs: POAuditLog[];
  amendments: POAmendment[];
  inwards?: InwardEntry[];
  outwards?: OutwardEntry[];
  onBack: () => void;
  onEdit: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onCancelPO: (reason: string) => void;
  onAmend: (reason: string) => void;
  onPrint: () => void;
  canManage: boolean;
}

export const PODetails: React.FC<PODetailsProps> = ({
  po,
  customer,
  logs,
  amendments,
  inwards = [],
  outwards = [],
  onBack,
  onEdit,
  onSubmit,
  onApprove,
  onReject,
  onCancelPO,
  onAmend,
  onPrint,
  canManage
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'downstream'>('overview');

  // Modals state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);
  const [amendReason, setAmendReason] = useState('');

  const statusLower = po.status.toLowerCase();
  const isDraft = statusLower === 'draft';
  const isSubmitted = statusLower === 'submitted';
  const isApproved = statusLower === 'approved';
  const isCancelled = statusLower === 'cancelled';

  // Filter linked inward & outward transactions
  const linkedInwards = inwards.filter(
    (inE) => inE.poId === po.id || inE.poId === po.poId || inE.poNumber === po.poNumber
  );
  const linkedOutwards = outwards.filter(
    (outE) => outE.poId === po.id || outE.poId === po.poId || outE.poNumber === po.poNumber
  );

  // Compute received and dispatched totals
  let totalReceivedQty = 0;
  linkedInwards.forEach((inE) => {
    inE.lines.forEach((l) => {
      totalReceivedQty += Number(l.receivedQty) || 0;
    });
  });

  let totalDispatchedQty = 0;
  linkedOutwards.forEach((outE) => {
    outE.lines.forEach((l) => {
      totalDispatchedQty += Number(l.dispatchQty) || 0;
    });
  });

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejecting this Purchase Order.');
      return;
    }
    onReject(rejectReason.trim());
    setIsRejectModalOpen(false);
  };

  const handleConfirmCancel = () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancelling this Purchase Order.');
      return;
    }
    onCancelPO(cancelReason.trim());
    setIsCancelModalOpen(false);
  };

  const handleConfirmAmend = () => {
    if (!amendReason.trim()) {
      alert('Please provide a reason for amending this approved Purchase Order.');
      return;
    }
    onAmend(amendReason.trim());
    setIsAmendModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-black text-[#1F4E79] tracking-tight">
                  {po.poNumber}
                </h1>
                {po.revision && po.revision > 1 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    Revision {po.revision}
                  </span>
                )}
                <StatusChip status={po.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Customer Work Order • {po.customerName} • Ordered on{' '}
                {formatDate(po.orderDate)}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="w-4 h-4" />}
              onClick={onPrint}
            >
              Print / PDF
            </Button>

            {canManage && isDraft && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit className="w-4 h-4" />}
                onClick={onEdit}
              >
                Edit Draft
              </Button>
            )}

            {canManage && isDraft && (
              <Button
                variant="primary"
                size="sm"
                icon={<Send className="w-4 h-4" />}
                onClick={onSubmit}
              >
                Submit for Approval
              </Button>
            )}

            {canManage && (isSubmitted || isDraft) && (
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={onApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Approve PO
              </Button>
            )}

            {canManage && isSubmitted && (
              <Button
                variant="outline"
                size="sm"
                icon={<XCircle className="w-4 h-4 text-rose-500" />}
                onClick={() => setIsRejectModalOpen(true)}
              >
                Reject
              </Button>
            )}

            {canManage && isApproved && (
              <Button
                variant="secondary"
                size="sm"
                icon={<GitFork className="w-4 h-4 text-[#1F4E79]" />}
                onClick={() => setIsAmendModalOpen(true)}
              >
                Amend PO
              </Button>
            )}

            {canManage && !isCancelled && (
              <Button
                variant="outline"
                size="sm"
                icon={<Ban className="w-4 h-4 text-slate-400" />}
                onClick={() => setIsCancelModalOpen(true)}
              >
                Cancel PO
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 gap-6 text-xs font-semibold pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'overview'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Order Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`pb-2.5 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Audit History</span>
            <span className="px-1.5 py-0.2 bg-slate-100 rounded-full text-[10px]">
              {logs.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('downstream')}
            className={`pb-2.5 transition-colors cursor-pointer border-b-2 flex items-center gap-1.5 ${
              activeTab === 'downstream'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Downstream Operations</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px]">
              {linkedInwards.length + linkedOutwards.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Order Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Header Metadata Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Details Snapshot */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1F4E79] border-b border-slate-100 pb-2">
                <Building className="w-4 h-4" />
                <span>Customer & Billing Profile</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="text-base font-black text-slate-900">
                  {po.customerName}
                </div>
                {po.customerCode && (
                  <div className="text-slate-500">
                    Vendor Code:{' '}
                    <span className="font-mono font-bold text-slate-700">
                      {po.customerCode}
                    </span>
                  </div>
                )}
                {customer?.address && (
                  <div className="text-slate-600">
                    {customer.address.addressLine1}, {customer.address.city},{' '}
                    {customer.address.state} - {customer.address.pinCode}
                  </div>
                )}
                {customer?.taxDetails?.gstin && (
                  <div className="text-slate-500 font-mono text-[11px]">
                    GSTIN: {customer.taxDetails.gstin}
                  </div>
                )}
                {customer?.financialDetails?.paymentTerms && (
                  <div className="text-slate-500 text-[11px]">
                    Payment Terms: {customer.financialDetails.paymentTerms}
                  </div>
                )}
              </div>
            </div>

            {/* Work Order Specifications */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#1F4E79] border-b border-slate-100 pb-2">
                <FileText className="w-4 h-4" />
                <span>Processing Specifications</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Process Category
                  </span>
                  <span className="font-bold capitalize text-slate-900">
                    {po.processCategory}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Style Number
                  </span>
                  <span className="font-bold font-mono text-slate-900">
                    {po.styleNo || po.styleNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Item Name
                  </span>
                  <span className="font-semibold text-slate-800">
                    {po.itemName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Customer Ref No
                  </span>
                  <span className="font-semibold text-slate-800">
                    {po.customerReferenceNo || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Order Date
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(po.orderDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Expected Delivery
                  </span>
                  <span className="font-semibold text-slate-800">
                    {po.deliveryDate ? formatDate(po.deliveryDate) : 'Not specified'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Colour Lines Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#1F4E79]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Colour-Wise Specifications & Commercial Rates
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                {po.colourLines.length} colour configuration(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-semibold text-[11px]">
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Colour & Code</th>
                    <th className="py-2.5 px-4">Processing / Wash</th>
                    <th className="py-2.5 px-4 text-right">Quantity</th>
                    <th className="py-2.5 px-4">Unit</th>
                    <th className="py-2.5 px-4">Rate Basis</th>
                    <th className="py-2.5 px-4 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-4 text-right">Line Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {po.colourLines.map((line, idx) => (
                    <tr key={line.id || line.lineId || idx} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {line.colourName}
                        {line.colourCode && (
                          <span className="text-slate-400 font-mono text-[11px] block">
                            Code: {line.colourCode}
                          </span>
                        )}
                        {line.notes && (
                          <span className="text-slate-400 text-[10px] block italic">
                            {line.notes}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {line.processType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {line.quantity.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 uppercase text-slate-500 font-semibold">
                        {line.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-600 capitalize">
                        {line.rateBasis.replace('_', ' ')}
                        {line.billableWeightKg && (
                          <span className="text-[10px] text-amber-700 block">
                            (Billable: {line.billableWeightKg} kg)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 font-medium">
                        {formatCurrency(line.rate)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatCurrency(line.lineAmount || line.amount || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Quantities & Amount Ribbon */}
            <div className="p-4 bg-[#EEF5FB] border-t border-[#BDD7EE] flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-slate-500 block text-[11px]">
                    Total Ordered Pieces
                  </span>
                  <strong className="text-slate-900 text-sm">
                    {formatQuantity(po.totalQtyByUnit?.piece || 0, 'piece')}
                  </strong>
                </div>

                {(po.totalQtyByUnit?.kg || 0) > 0 && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">
                      Total Ordered Weight
                    </span>
                    <strong className="text-slate-900 text-sm">
                      {formatQuantity(po.totalQtyByUnit?.kg || 0, 'kg')}
                    </strong>
                  </div>
                )}
              </div>

              <div className="text-right">
                <span className="text-slate-500 block text-[11px]">
                  Total Work Order Value
                </span>
                <strong className="text-xl font-black text-[#1F4E79]">
                  {formatCurrency(po.totalAmount)}
                </strong>
              </div>
            </div>
          </div>

          {/* Instructions and Internal Remarks */}
          {(po.customerInstructions || po.internalRemarks) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {po.customerInstructions && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Customer Instructions
                  </div>
                  <p className="text-slate-600">{po.customerInstructions}</p>
                </div>
              )}

              {po.internalRemarks && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    Internal Shopfloor Remarks
                  </div>
                  <p className="text-slate-600">{po.internalRemarks}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Audit History */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="w-4 h-4 text-[#1F4E79]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Immutable Audit Log & Lifecycle Timeline
            </h3>
          </div>

          <div className="space-y-4">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No audit events recorded yet for this order.
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.auditId}
                  className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs"
                >
                  <div className="p-2 rounded-lg bg-white border border-slate-200 text-[#1F4E79] shrink-0">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                        {log.action}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(log.performedAt)}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium">{log.summary}</p>
                    <div className="text-[11px] text-slate-400">
                      Performed by:{' '}
                      <strong className="text-slate-600">
                        {log.performedByName || log.performedBy}
                      </strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {amendments.length > 0 && (
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Revision & Amendment Snapshots ({amendments.length})
              </h4>
              <div className="space-y-2.5">
                {amendments.map((amend) => (
                  <div
                    key={amend.amendmentId}
                    className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900">
                        Revision {amend.amendmentNumber}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDate(amend.requestedAt)}
                      </span>
                    </div>
                    <p className="text-slate-700">Reason: {amend.reason}</p>
                    <div className="text-[11px] text-slate-500">
                      Requested by: {amend.requestedByName || amend.requestedBy}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Downstream Operations Tracking */}
      {activeTab === 'downstream' && (
        <div className="space-y-6">
          {/* Operations Summary Highlight */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 text-[11px] font-semibold block uppercase">
                Ordered Quantity
              </span>
              <strong className="text-xl font-black text-slate-900">
                {formatQuantity(po.totalQuantity, po.colourLines[0]?.unit || 'piece')}
              </strong>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-emerald-700 text-[11px] font-semibold block uppercase">
                Cumulative Inward Received
              </span>
              <strong className="text-xl font-black text-emerald-700">
                {formatQuantity(totalReceivedQty, po.colourLines[0]?.unit || 'piece')}
              </strong>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-blue-700 text-[11px] font-semibold block uppercase">
                Cumulative Outward Dispatched
              </span>
              <strong className="text-xl font-black text-blue-700">
                {formatQuantity(totalDispatchedQty, po.colourLines[0]?.unit || 'piece')}
              </strong>
            </div>
          </div>

          {/* Linked Inward Material Receipts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Linked Inward Material Receipts ({linkedInwards.length})
                </h3>
              </div>
            </div>

            {linkedInwards.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No inward receipts recorded yet against this PO.
              </p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] uppercase">
                      <th className="py-2.5 px-4">Inward Ref</th>
                      <th className="py-2.5 px-4">Customer DC No</th>
                      <th className="py-2.5 px-4">DC Date</th>
                      <th className="py-2.5 px-4 text-right">Received Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {linkedInwards.map((inE) => {
                      const totalInward = inE.lines.reduce(
                        (acc, l) => acc + (Number(l.receivedQty) || 0),
                        0
                      );
                      return (
                        <tr key={inE.id || inE.entryId}>
                          <td className="py-3 px-4 font-bold text-[#1F4E79]">
                            {inE.entryId}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {inE.customerDcNo}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {formatDate(inE.customerDate)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-700">
                            {formatQuantity(totalInward, inE.lines[0]?.unit || 'piece')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Linked Outward Dispatches */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Linked Outward Delivery Dispatches ({linkedOutwards.length})
                </h3>
              </div>
            </div>

            {linkedOutwards.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No outward dispatches recorded yet against this PO.
              </p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[11px] uppercase">
                      <th className="py-2.5 px-4">Outward Ref</th>
                      <th className="py-2.5 px-4">Our DC No</th>
                      <th className="py-2.5 px-4">Vehicle No</th>
                      <th className="py-2.5 px-4">Dispatch Date</th>
                      <th className="py-2.5 px-4 text-right">Dispatched Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {linkedOutwards.map((outE) => {
                      const totalOutward = outE.lines.reduce(
                        (acc, l) => acc + (Number(l.dispatchQty) || 0),
                        0
                      );
                      return (
                        <tr key={outE.id || outE.entryId}>
                          <td className="py-3 px-4 font-bold text-[#1F4E79]">
                            {outE.entryId}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">
                            {outE.ourDcNo}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {outE.vehicleNo || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {formatDate(outE.ourDate)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-blue-700">
                            {formatQuantity(totalOutward, outE.lines[0]?.unit || 'piece')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <Modal
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          title={`Reject Purchase Order: ${po.poNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Please enter the business reason for rejecting this work order.
              This will be permanently recorded in the audit log.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Rate revision required, color availability mismatch..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-rose-500"
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmReject}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Modal */}
      {isCancelModalOpen && (
        <Modal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          title={`Cancel Purchase Order: ${po.poNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Cancelling an order cannot be undone. Orders with existing inward
                receipts cannot be cancelled.
              </span>
            </div>
            <textarea
              rows={3}
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-hidden"
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsCancelModalOpen(false)}>
                Go Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmCancel}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Amend Modal */}
      {isAmendModalOpen && (
        <Modal
          isOpen={isAmendModalOpen}
          onClose={() => setIsAmendModalOpen(false)}
          title={`Amend Approved Purchase Order: ${po.poNumber}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600">
              Creating an amendment will snapshot Revision {po.revision || 1} and
              increment the revision counter to {(po.revision || 1) + 1}. Please
              state the amendment reason:
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Customer requested quantity increase for Blue shade..."
              value={amendReason}
              onChange={(e) => setAmendReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-hidden"
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setIsAmendModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<GitFork className="w-4 h-4" />}
                onClick={handleConfirmAmend}
              >
                Proceed to Edit (Rev {(po.revision || 1) + 1})
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
