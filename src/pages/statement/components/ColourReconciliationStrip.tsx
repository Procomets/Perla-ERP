import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatementColourLineDetail } from '../../../types/statement';
import { StatusChip } from '../../../components/ui/StatusChip';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency, formatQuantity } from '../../../utils/formatters';
import { CheckCircle2, ShieldCheck, AlertCircle, Layers, Check, Receipt } from 'lucide-react';

interface ColourReconciliationStripProps {
  colourLines: StatementColourLineDetail[];
  companyName: string;
  onApproveLine: (poId: string, poLineId: string) => Promise<void>;
  onApproveEntirePO?: (poId: string) => Promise<void>;
  isApproving: boolean;
}

export const ColourReconciliationStrip: React.FC<ColourReconciliationStripProps> = ({
  colourLines,
  companyName,
  onApproveLine,
  onApproveEntirePO,
  isApproving
}) => {
  const navigate = useNavigate();
  const [selectedLineForApproval, setSelectedLineForApproval] = useState<StatementColourLineDetail | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Multi-Colour PO Approval State
  const [selectedPOForApproval, setSelectedPOForApproval] = useState<{
    poId: string;
    poNumber: string;
    styleNo: string;
    itemName: string;
    lines: StatementColourLineDetail[];
    eligibleLines: StatementColourLineDetail[];
    alreadyApprovedLines: StatementColourLineDetail[];
  } | null>(null);
  const [poApprovalError, setPoApprovalError] = useState<string | null>(null);

  const eligibleCount = colourLines.filter((l) => l.isReadyForInvoice).length;
  const approvedCount = colourLines.filter((l) => l.isApprovedForInvoice).length;
  const invoicedCount = colourLines.filter((l) => l.isInvoiced).length;

  // Group colour lines by Purchase Order
  const poGroups = React.useMemo(() => {
    const groups: {
      poId: string;
      poNumber: string;
      styleNo: string;
      itemName: string;
      lines: StatementColourLineDetail[];
      eligibleLines: StatementColourLineDetail[];
      alreadyApprovedLines: StatementColourLineDetail[];
      hasMultipleColours: boolean;
    }[] = [];

    const map = new Map<string, StatementColourLineDetail[]>();
    colourLines.forEach((l) => {
      const key = l.poId || l.poNumber;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    });

    map.forEach((lines) => {
      const first = lines[0];
      const eligibleLines = lines.filter((l) => l.isReadyForInvoice && !l.isApprovedForInvoice && !l.isInvoiced);
      const alreadyApprovedLines = lines.filter((l) => l.isApprovedForInvoice || l.isInvoiced);
      groups.push({
        poId: first.poId,
        poNumber: first.poNumber,
        styleNo: first.styleNo,
        itemName: first.itemName,
        lines,
        eligibleLines,
        alreadyApprovedLines,
        hasMultipleColours: lines.length > 1
      });
    });

    return groups;
  }, [colourLines]);

  const handleConfirmApproval = async () => {
    if (!selectedLineForApproval) return;
    try {
      setApprovalError(null);
      await onApproveLine(selectedLineForApproval.poId, selectedLineForApproval.poLineId);
      setSelectedLineForApproval(null);
    } catch (err: any) {
      setApprovalError(err.message || 'Failed to approve colour line for invoice.');
    }
  };

  const handleConfirmPOApproval = async () => {
    if (!selectedPOForApproval || !onApproveEntirePO) return;
    try {
      setPoApprovalError(null);
      await onApproveEntirePO(selectedPOForApproval.poId);
      setSelectedPOForApproval(null);
    } catch (err: any) {
      setPoApprovalError(err.message || 'Failed to approve entire PO for invoice.');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-0">
      {/* Header Bar */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#1F4E79]" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Colour-Wise Reconciliation & Invoice Readiness Ledger
            </h3>
            <p className="text-[11px] text-slate-500">
              Each colour is reconciled independently using its stable PO colour-line ID.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {eligibleCount > 0 && (
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold text-[11px] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {eligibleCount} Ready for Invoice
            </span>
          )}
          {approvedCount > 0 && (
            <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full font-bold text-[11px] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              {approvedCount} Approved
            </span>
          )}
          {invoicedCount > 0 && (
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-semibold text-[11px]">
              {invoicedCount} Billed
            </span>
          )}
        </div>
      </div>

      {/* Colour Lines Table */}
      {colourLines.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          No colour lines found for the selected scope.
        </div>
      ) : (
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-center border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">PO Number</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Style No</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Colour & Code</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Process</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Ordered</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Received Inward</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Order - Inward Diff</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Dispatched Outward</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Inward - Outward Diff</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Unit</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Invoice Status</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {poGroups.map((group) => (
                <React.Fragment key={group.poId || group.poNumber}>
                  {/* PO Group Header Banner when PO has more than 1 colour */}
                  {group.hasMultipleColours && (
                    <tr className="bg-slate-100/95 border-t-2 border-b border-slate-300">
                      <td colSpan={12} className="py-2.5 px-4 text-left">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#1F4E79] font-mono text-xs">
                              PO #{group.poNumber}
                            </span>
                            <span className="text-[11px] text-slate-600 font-semibold">
                              • {group.styleNo} • {group.itemName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                              {group.lines.length} Colours
                            </span>
                            {group.alreadyApprovedLines.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                {group.alreadyApprovedLines.length} already in invoice (excluded from re-approval)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {onApproveEntirePO && group.eligibleLines.length > 0 && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1 h-auto shadow-2xs"
                                onClick={() => {
                                  setPoApprovalError(null);
                                  setSelectedPOForApproval(group);
                                }}
                                disabled={isApproving}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Approve Entire PO ({group.eligibleLines.length} Colour{group.eligibleLines.length > 1 ? 's' : ''})
                              </Button>
                            )}
                            {group.eligibleLines.length === 0 && group.alreadyApprovedLines.length === group.lines.length && (
                              <span className="text-xs font-bold text-blue-700 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" /> Entire PO Approved
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Individual Colour Rows */}
                  {group.lines.map((line) => {
                    const orderInwardDiff = line.orderedVsInwardDiff ?? (line.orderedQty - line.cumulativeInward);
                    return (
                      <tr
                        key={line.poLineId}
                        className={`hover:bg-slate-50 transition-colors ${
                          line.isReadyForInvoice ? 'bg-emerald-50/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-[#1F4E79] whitespace-nowrap">
                          {line.poNumber}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center font-mono font-medium text-slate-700 whitespace-nowrap">
                          {line.styleNo}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center font-semibold text-slate-900 whitespace-nowrap">
                          {line.colour}
                          {line.colourCode && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {line.colourCode}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center text-slate-600 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                            {line.processType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center font-semibold text-slate-700 whitespace-nowrap">
                          {line.orderedQty.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-emerald-700 whitespace-nowrap">
                          {line.cumulativeInward.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-slate-800 whitespace-nowrap">
                          {orderInwardDiff.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-blue-700 whitespace-nowrap">
                          {line.cumulativeOutward.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-slate-800 whitespace-nowrap">
                          {line.balanceQty.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center text-slate-600 uppercase font-semibold text-[11px] whitespace-nowrap">
                          {line.unit}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center whitespace-nowrap">
                          {line.isInvoiced ? (
                            <StatusChip status="Invoiced" variant="slate" />
                          ) : line.isApprovedForInvoice ? (
                            <StatusChip status="Approved for Invoice" variant="green" />
                          ) : line.isReadyForInvoice ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 animate-pulse">
                              <Check className="w-3 h-3" /> Ready for Invoice
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">In Progress</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-center whitespace-nowrap">
                          {line.isReadyForInvoice && (
                            <Button
                              size="sm"
                              variant="success"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs mx-auto"
                              onClick={() => {
                                setApprovalError(null);
                                setSelectedLineForApproval(line);
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Approve to Invoice
                            </Button>
                          )}
                          {line.isApprovedForInvoice && (
                            <span className="text-xs font-bold text-blue-700 flex items-center justify-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" /> Approved
                            </span>
                          )}
                          {line.isInvoiced && (
                            <span className="text-[11px] font-semibold text-slate-400">
                              {line.invoiceNo || 'Billed'}
                            </span>
                          )}
                          {!line.isReadyForInvoice && !line.isApprovedForInvoice && !line.isInvoiced && (
                            <span className="text-xs text-slate-400 italic">
                              {line.cumulativeInward === 0
                                ? 'Awaiting Inward'
                                : line.balanceQty > 0
                                ? `Pending ${line.balanceQty} ${line.unit}`
                                : 'In Transit'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Approval Confirmation Modal */}
      {selectedLineForApproval && (
        <Modal
          isOpen={!!selectedLineForApproval}
          onClose={() => {
            if (!isApproving) setSelectedLineForApproval(null);
          }}
          title="Confirm Invoice Approval"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Quantities Fully Reconciled — Eligible for Invoicing
              </div>
              <p className="text-xs text-emerald-700 leading-relaxed">
                The total received inward quantity strictly equals the total outward dispatched quantity for this colour line. Approval will make this line immediately available in the Invoice module for billing.
              </p>
            </div>

            {/* Reconciliation Snapshot */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Customer Company:</span>
                <span className="font-bold text-slate-900">{companyName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Purchase Order:</span>
                <span className="font-bold text-[#1F4E79]">{selectedLineForApproval.poNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Style / Item:</span>
                <span className="font-semibold text-slate-800">
                  {selectedLineForApproval.styleNo} • {selectedLineForApproval.itemName}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Colour Line:</span>
                <span className="font-bold text-slate-900">{selectedLineForApproval.colour}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Processing / Wash:</span>
                <span className="font-medium text-slate-700">{selectedLineForApproval.processType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Ordered Quantity:</span>
                <span className="font-bold text-slate-800">
                  {formatQuantity(selectedLineForApproval.orderedQty, selectedLineForApproval.unit)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Total Inward Received:</span>
                <span className="font-black text-emerald-700">
                  {formatQuantity(selectedLineForApproval.cumulativeInward, selectedLineForApproval.unit)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Order vs Inward Diff:</span>
                <span className={`font-bold ${(selectedLineForApproval.orderedVsInwardDiff ?? 0) === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {(selectedLineForApproval.orderedVsInwardDiff ?? 0) === 0
                    ? '0 (Fully Received)'
                    : `${selectedLineForApproval.orderedVsInwardDiff} ${selectedLineForApproval.unit} Pending`}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Total Outward Dispatched:</span>
                <span className="font-black text-blue-700">
                  {formatQuantity(selectedLineForApproval.cumulativeOutward, selectedLineForApproval.unit)}
                </span>
              </div>
              <div className="flex justify-between py-1 text-slate-900">
                <span className="text-slate-500 font-bold">Remaining Balance:</span>
                <span className="font-black text-emerald-700">
                  0 {selectedLineForApproval.unit} (Complete)
                </span>
              </div>
            </div>

            {approvalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{approvalError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLineForApproval(null)}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                onClick={handleConfirmApproval}
                disabled={isApproving}
              >
                {isApproving ? 'Verifying & Approving...' : 'Confirm Approval to Invoice'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Entire PO Approval Confirmation Modal */}
      {selectedPOForApproval && (
        <Modal
          isOpen={!!selectedPOForApproval}
          onClose={() => {
            if (!isApproving) setSelectedPOForApproval(null);
          }}
          title={`Approve Entire Purchase Order — PO #${selectedPOForApproval.poNumber}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Approve {selectedPOForApproval.eligibleLines.length} Eligible Colour(s) to Invoice
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Approving this Purchase Order will move all remaining eligible colours to the Invoice module. All required rates, processes, and quantities will be preserved for invoice billing.
              </p>
            </div>

            {selectedPOForApproval.alreadyApprovedLines.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  <strong>Notice:</strong> {selectedPOForApproval.alreadyApprovedLines.length} colour(s) ({selectedPOForApproval.alreadyApprovedLines.map(l => l.colour).join(', ')}) have already been moved to Invoice and will <strong>not</strong> be re-added or duplicated.
                </span>
              </div>
            )}

            {/* List of Colours in PO */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 uppercase tracking-wider">
                  Colours in PO #{selectedPOForApproval.poNumber} ({selectedPOForApproval.styleNo} • {selectedPOForApproval.itemName})
                </span>
                <span className="font-semibold text-slate-500">
                  {selectedPOForApproval.eligibleLines.length} of {selectedPOForApproval.lines.length} will be approved
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                      <th className="py-2 px-2">Colour</th>
                      <th className="py-2 px-2">Process</th>
                      <th className="py-2 px-2 text-right">Inward</th>
                      <th className="py-2 px-2 text-right">Outward</th>
                      <th className="py-2 px-2 text-right">Rate</th>
                      <th className="py-2 px-2 text-center">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedPOForApproval.lines.map((l) => {
                      const isEligible = l.isReadyForInvoice && !l.isApprovedForInvoice && !l.isInvoiced;
                      const isAlreadyMoved = l.isApprovedForInvoice || l.isInvoiced;
                      return (
                        <tr key={l.poLineId} className={isEligible ? 'bg-emerald-50/50' : 'opacity-75'}>
                          <td className="py-2 px-2 font-bold text-slate-900">{l.colour}</td>
                          <td className="py-2 px-2 text-slate-600">{l.processType}</td>
                          <td className="py-2 px-2 text-right font-medium text-emerald-700">
                            {formatQuantity(l.cumulativeInward, l.unit)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-blue-700">
                            {formatQuantity(l.cumulativeOutward, l.unit)}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">₹{l.rate.toFixed(2)}</td>
                          <td className="py-2 px-2 text-center">
                            {isEligible ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Ready to Approve ({formatQuantity(l.cumulativeOutward, l.unit)})
                              </span>
                            ) : isAlreadyMoved ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                Already In Invoices (Skipped)
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                Pending Delivery Match
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {poApprovalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{poApprovalError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPOForApproval(null)}
                disabled={isApproving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                onClick={handleConfirmPOApproval}
                disabled={isApproving || selectedPOForApproval.eligibleLines.length === 0}
              >
                {isApproving
                  ? 'Approving Colours...'
                  : `Confirm Approval of ${selectedPOForApproval.eligibleLines.length} Colour(s)`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
