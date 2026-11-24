import React, { useState, useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { InvoiceEligibleItem, InvoiceReadinessPOGroup, InvoiceReadinessLine } from '../../../types/invoice';
import {
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';

interface InvoiceEligibleTableProps {
  mode?: 'eligible' | 'generation';
  readinessGroups: InvoiceReadinessPOGroup[];
  eligibleItems: InvoiceEligibleItem[];
  loading: boolean;
  searchQuery?: string;
  onApproveLine: (poId: string, poLineId: string, companyId?: string) => Promise<void>;
  onApproveEntirePO: (poId: string, companyId?: string) => Promise<void>;
  isApproving: boolean;
  onRequestInvoicing: (
    items: InvoiceEligibleItem[],
    initialAction?: 'direct_download' | 'review_draft'
  ) => void;
  onGenerateInvoice?: (selectedApprovalIds: string[]) => void;
  onDownloadInvoice?: (items: InvoiceEligibleItem | InvoiceEligibleItem[]) => void;
  onSwitchTab?: (tab: 'eligible' | 'generation' | 'history') => void;
}

export const InvoiceEligibleTable: React.FC<InvoiceEligibleTableProps> = ({
  mode = 'eligible',
  readinessGroups,
  eligibleItems,
  loading,
  searchQuery = '',
  onApproveLine,
  onApproveEntirePO,
  isApproving,
  onRequestInvoicing,
  onGenerateInvoice,
  onDownloadInvoice,
  onSwitchTab
}) => {
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);
  const [approvingLineKey, setApprovingLineKey] = useState<string | null>(null);

  // Helper to convert an approved line to InvoiceEligibleItem for invoice generation
  const lineToEligibleItem = (line: InvoiceReadinessLine): InvoiceEligibleItem => {
    const existing = eligibleItems.find((e) => e.approvalId === line.approvalId);
    if (existing) return existing;

    const rate = Number(line.rate) || 0;
    const qty = Number(line.cumulativeOutward) || 0;
    const estimatedTaxableAmount = rate * qty;

    return {
      approvalId: line.approvalId || `appr_${line.poId}_${line.poLineId}`,
      poLineId: line.poLineId,
      companyId: line.companyId,
      companyName: line.companyName,
      poId: line.poId,
      poNumber: line.poNumber,
      customerPoNumber: line.customerPoNumber || null,
      woNumber: line.customerPoNumber || null,
      styleNo: line.styleNo,
      itemName: line.itemName,
      colour: line.colour,
      processCategory: 'washing',
      washType: line.processType,
      hsnSac: line.hsnNo || '998821',
      hsnNo: line.hsnNo || '998821',
      approvedQuantity: qty,
      previouslyInvoicedQty: 0,
      remainingApprovedQty: qty,
      unit: line.unit || 'piece',
      rate,
      rateBasis: line.rateBasis || 'per_piece',
      estimatedTaxableAmount,
      approvedAt: line.approvedAt || new Date().toISOString(),
      approvedByName: line.approvedByName || 'Authorized User',
      approvalStatus: 'approved'
    };
  };

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return readinessGroups;
    const q = searchQuery.toLowerCase().trim();
    return readinessGroups
      .map((group) => {
        const matchesGroup =
          group.companyName.toLowerCase().includes(q) ||
          group.poNumber.toLowerCase().includes(q) ||
          group.styleNo.toLowerCase().includes(q) ||
          group.itemName.toLowerCase().includes(q);

        if (matchesGroup) return group;

        const matchingLines = group.lines.filter(
          (l) =>
            l.colour.toLowerCase().includes(q) ||
            l.processType.toLowerCase().includes(q) ||
            (l.colourCode && l.colourCode.toLowerCase().includes(q))
        );

        if (matchingLines.length > 0) {
          return {
            ...group,
            lines: matchingLines,
            eligibleLines: group.eligibleLines.filter((l) => matchingLines.some((m) => m.poLineId === l.poLineId)),
            approvedLines: group.approvedLines.filter((l) => matchingLines.some((m) => m.poLineId === l.poLineId))
          };
        }
        return null;
      })
      .filter((g): g is InvoiceReadinessPOGroup => g !== null);
  }, [readinessGroups, searchQuery]);

  // Aggregate totals
  const totalReadyCount = useMemo(() => {
    return readinessGroups.reduce((sum, g) => sum + g.eligibleLines.length, 0);
  }, [readinessGroups]);

  const totalApprovedCount = useMemo(() => {
    return readinessGroups.reduce((sum, g) => sum + g.approvedLines.length, 0);
  }, [readinessGroups]);

  // Approved PO groups (for Invoice Generation section)
  const approvedPOGroups = useMemo(() => {
    return filteredGroups
      .filter((g) => g.approvedLines.length > 0)
      .map((g) => ({
        ...g,
        lines: g.approvedLines
      }));
  }, [filteredGroups]);

  // Pending PO groups (for Invoice-Eligible Items / Reconciliation section)
  const pendingPOGroups = useMemo(() => {
    return filteredGroups
      .filter((g) => g.lines.some((l) => !l.isApprovedForInvoice && !l.isInvoiced))
      .map((g) => ({
        ...g,
        lines: g.lines.filter((l) => !l.isApprovedForInvoice && !l.isInvoiced)
      }));
  }, [filteredGroups]);

  // Active PO lock: Once a colour line from PO X is selected, all lines from other POs are blocked!
  const activeSelectedPo = useMemo(() => {
    if (selectedApprovalIds.length === 0) return null;
    for (const group of readinessGroups) {
      for (const line of group.approvedLines) {
        if (line.approvalId && selectedApprovalIds.includes(line.approvalId)) {
          return { poId: group.poId, poNumber: group.poNumber, companyName: group.companyName };
        }
      }
    }
    return null;
  }, [readinessGroups, selectedApprovalIds]);

  // Handle single PO selection toggle
  const handleToggleItem = (approvalId: string, itemPoId?: string) => {
    if (
      activeSelectedPo &&
      itemPoId &&
      itemPoId !== activeSelectedPo.poId &&
      !selectedApprovalIds.includes(approvalId)
    ) {
      return;
    }
    setSelectedApprovalIds((prev) =>
      prev.includes(approvalId) ? prev.filter((id) => id !== approvalId) : [...prev, approvalId]
    );
  };

  // Convert selected approval IDs to eligible items
  const selectedApprovedItems = useMemo(() => {
    const list: InvoiceEligibleItem[] = [];
    readinessGroups.forEach((g) => {
      g.approvedLines.forEach((l) => {
        if (l.approvalId && selectedApprovalIds.includes(l.approvalId)) {
          list.push(lineToEligibleItem(l));
        }
      });
    });
    return list;
  }, [readinessGroups, selectedApprovalIds, eligibleItems]);

  // Trigger invoice creation with tax choice modal
  const triggerInvoicing = (
    items: InvoiceEligibleItem[],
    action: 'direct_download' | 'review_draft' = 'direct_download'
  ) => {
    if (onRequestInvoicing) {
      onRequestInvoicing(items, action);
    } else if (action === 'review_draft' && onGenerateInvoice) {
      onGenerateInvoice(items.map((i) => i.approvalId));
    } else if (onDownloadInvoice) {
      onDownloadInvoice(items);
    }
  };

  // =========================================================================
  // VIEW MODE: INVOICE GENERATION (Approved POs ready for billing)
  // =========================================================================
  if (mode === 'generation') {
    return (
      <Card className="overflow-hidden border border-slate-200 bg-white shadow-xs space-y-0">
        {/* Section Header */}
        <div className="p-4 bg-[#EEF5FB]/60 border-b border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#1F4E79]">
                Invoice Generation (Approved Purchase Orders)
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1F4E79] border border-blue-200">
                {approvedPOGroups.length} PO{approvedPOGroups.length !== 1 ? 's' : ''} • {totalApprovedCount} Approved Line{totalApprovedCount !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-normal mt-0.5">
              Select colour lines from the same PO to bill combined or single invoices with customizable GST settings
            </p>
          </div>
        </div>

        {/* Single-PO Multi-Select Action Strip */}
        {selectedApprovalIds.length > 0 && (
          <div className="px-4 py-3 bg-[#EEF5FB] border-b border-blue-200 flex flex-wrap items-center justify-end gap-2 text-xs animate-in fade-in">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedApprovalIds([])}
              className="text-xs py-1 h-auto cursor-pointer border-slate-300 text-slate-700 hover:bg-white"
            >
              Clear Selection
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => triggerInvoicing(selectedApprovedItems, 'direct_download')}
              className="bg-[#1F4E79] hover:bg-[#163a5c] text-white font-semibold text-xs py-1 h-auto shadow-xs cursor-pointer"
            >
              Generate Combined Invoice ({selectedApprovalIds.length} Colours)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerInvoicing(selectedApprovedItems, 'review_draft')}
              className="text-xs py-1 h-auto font-semibold cursor-pointer border-[#1F4E79] text-[#1F4E79] hover:bg-blue-50"
            >
              Review Draft ({selectedApprovalIds.length} Colours)
            </Button>
          </div>
        )}

        {/* Section Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs space-y-2">
            <div className="w-6 h-6 border-2 border-[#1F4E79] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-semibold text-slate-700">Loading approved purchase orders...</p>
          </div>
        ) : approvedPOGroups.length === 0 ? (
          <div className="p-12 text-center text-xs space-y-3 bg-white">
            <div className="space-y-1">
              <h5 className="font-bold text-slate-800 text-sm">
                No Approved POs Ready for Invoicing
              </h5>
              <p className="text-slate-500 max-w-md mx-auto text-[11px]">
                {searchQuery
                  ? 'No approved purchase order matches your current search term.'
                  : 'Reconcile completed garment quantities and approve ready colour lines from the "Invoice-Eligible Items" section.'}
              </p>
            </div>
            {onSwitchTab && (
              <button
                type="button"
                onClick={() => onSwitchTab('eligible')}
                className="inline-flex items-center px-3.5 py-1.5 bg-[#1F4E79] hover:bg-[#163a5c] text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
              >
                <span>Go to Invoice-Eligible Items</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-center border-collapse border border-slate-300">
              <thead>
                <tr className="bg-[#EEF5FB] text-[#1F4E79] uppercase font-bold text-[11px] tracking-wider border-b-2 border-slate-300">
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">PO Number</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Style No</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Colour &amp; Code</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Process</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Inward Qty</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Billed Qty</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Unit</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Rate</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Est. Taxable</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Select</th>
                </tr>
              </thead>
              <tbody>
                {approvedPOGroups.map((group) => {
                  const isPoBlockedFromSelection = Boolean(
                    activeSelectedPo &&
                    group.poId !== activeSelectedPo.poId &&
                    group.poNumber !== activeSelectedPo.poNumber
                  );

                  return (
                    <React.Fragment key={`approved_${group.poId || group.poNumber}`}>
                      {/* PO Header Strip */}
                      <tr className="bg-[#EEF5FB]/70 border-t-2 border-b border-blue-200">
                        <td colSpan={11} className="py-2 px-4 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#1F4E79] font-mono text-xs">
                              PO #{group.poNumber}
                            </span>
                            <span className="text-[11px] text-slate-700 font-semibold">
                              • {group.styleNo} • {group.itemName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#1F4E79] border border-blue-200">
                              {group.companyName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1F4E79]">
                              {group.approvedLines.length} Approved Colour{group.approvedLines.length > 1 ? 's' : ''} Ready to Bill
                            </span>
                            {isPoBlockedFromSelection && (
                              <span className="text-[10px] text-amber-700 font-semibold">
                                Selection locked to PO #{activeSelectedPo?.poNumber}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Approved Colour Rows */}
                      {group.lines.map((line) => {
                        const isChecked = Boolean(
                          line.approvalId && selectedApprovalIds.includes(line.approvalId)
                        );
                        const isLineBlocked = Boolean(
                          activeSelectedPo &&
                          group.poId !== activeSelectedPo.poId &&
                          group.poNumber !== activeSelectedPo.poNumber
                        );
                        const lineRate = Number(line.rate) || 0;
                        const lineEstTaxable = lineRate * (Number(line.cumulativeOutward) || 0);

                        return (
                          <tr
                            key={`appr_line_${line.poLineId}`}
                            className={`hover:bg-slate-50 transition-colors ${
                              isChecked ? 'bg-blue-50/50' : 'bg-white'
                            }`}
                          >
                            <td className="py-2 px-3 border border-slate-200 text-center font-bold text-[#1F4E79] whitespace-nowrap">
                              {line.poNumber}
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center font-mono font-medium text-slate-700 whitespace-nowrap">
                              {line.styleNo}
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center font-semibold text-slate-900 whitespace-nowrap">
                              <span className="font-bold">{line.colour}</span>
                              {line.colourCode && (
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  {line.colourCode}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center text-slate-700 whitespace-nowrap">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium uppercase text-slate-600">
                                {line.processType}
                              </span>
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center font-bold text-slate-800 whitespace-nowrap">
                              {line.cumulativeInward.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center font-bold text-slate-900 whitespace-nowrap">
                              {line.cumulativeOutward.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center font-bold uppercase text-[10px] text-slate-600 whitespace-nowrap">
                              {line.unit}
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center font-mono text-slate-700 whitespace-nowrap">
                              ₹{lineRate.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center font-mono font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(lineEstTaxable)}
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center whitespace-nowrap">
                              <span className="px-2.5 py-0.5 bg-blue-50 text-[#1F4E79] border border-blue-200 rounded-full font-bold text-[10px]">
                                Approved
                              </span>
                            </td>
                            <td className="py-2 px-3 border border-slate-200 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={isLineBlocked}
                                  onChange={() => {
                                    if (isLineBlocked) return;
                                    if (line.approvalId) handleToggleItem(line.approvalId, group.poId);
                                  }}
                                  className={`w-4 h-4 rounded text-[#1F4E79] border-slate-300 focus:ring-[#1F4E79] ${
                                    isLineBlocked
                                      ? 'cursor-not-allowed opacity-30 bg-slate-100'
                                      : 'cursor-pointer'
                                  }`}
                                  title={
                                    isLineBlocked
                                      ? `Blocked: Line belongs to PO #${group.poNumber}. Selection is locked to PO #${activeSelectedPo?.poNumber}. Clear selection first to select another PO.`
                                      : 'Select this colour line to generate invoice'
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  // =========================================================================
  // VIEW MODE: INVOICE-ELIGIBLE ITEMS (Reconciliation & Line Approval)
  // =========================================================================
  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-xs space-y-0">
      {/* Section Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Colour-Wise Reconciliation &amp; Invoice Readiness Ledger
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              {pendingPOGroups.length} PO{pendingPOGroups.length !== 1 ? 's' : ''} • {totalReadyCount} Ready for Approval
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-normal mt-0.5">
            Inspect inward vs outward dispatches. Completed colour lines display "Approve to Invoice" to promote them to Invoice Generation
          </p>
        </div>
      </div>

      {/* Section Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs space-y-2">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-slate-700">Loading reconciliation ledger across POs...</p>
        </div>
      ) : pendingPOGroups.length === 0 ? (
        <div className="p-12 text-center text-xs space-y-3 bg-white">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <div className="space-y-1">
            <h5 className="font-bold text-slate-800 text-sm">
              All Purchase Order Lines Approved!
            </h5>
            <p className="text-slate-500 max-w-md mx-auto text-[11px]">
              {searchQuery
                ? 'No pending purchase order matches your current search term.'
                : 'There are no pending colour lines waiting for reconciliation approval. All ready lines have been approved and moved to the "Invoice Generation" section.'}
            </p>
          </div>
          {onSwitchTab && (
            <button
              type="button"
              onClick={() => onSwitchTab('generation')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
            >
              <span>Go to Invoice Generation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-center border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase font-semibold text-[11px] tracking-wider">
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">PO Number</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Style No</th>
                <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Colour &amp; Code</th>
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
              {pendingPOGroups.map((group) => {
                const hasUnapprovedEligible = group.eligibleLines.length > 0;

                return (
                  <React.Fragment key={`pending_${group.poId || group.poNumber}`}>
                    {/* PO Group Header Banner */}
                    <tr className="bg-slate-100/95 border-t-2 border-b border-slate-300">
                      <td colSpan={12} className="py-2 px-4 text-left">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 font-mono text-xs">
                              PO #{group.poNumber}
                            </span>
                            <span className="text-[11px] text-slate-700 font-semibold">
                              • {group.styleNo} • {group.itemName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-slate-700 border border-slate-300">
                              {group.companyName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                              {group.lines.length} Colour{group.lines.length > 1 ? 's' : ''} in Scope
                            </span>
                            {hasUnapprovedEligible && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                {group.eligibleLines.length} Ready for Approval
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {hasUnapprovedEligible && (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1 h-auto shadow-2xs cursor-pointer flex items-center gap-1"
                                onClick={async () => {
                                  await onApproveEntirePO(group.poId, group.companyId);
                                }}
                                disabled={isApproving}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve Entire PO ({group.eligibleLines.length} Colour{group.eligibleLines.length > 1 ? 's' : ''})
                              </Button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Individual Colour Rows for this PO */}
                    {group.lines.map((line) => {
                      const orderInwardDiff = line.orderedVsInwardDiff;
                      const inwardOutwardDiff = line.balanceQty;
                      const isLineApproving = isApproving && approvingLineKey === line.poLineId;

                      return (
                        <tr
                          key={`pen_line_${line.poLineId}`}
                          className={`hover:bg-slate-50 transition-colors ${
                            line.isReadyForInvoice ? 'bg-emerald-50/25' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-slate-900 whitespace-nowrap">
                            {line.poNumber}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center font-mono font-medium text-slate-700 whitespace-nowrap">
                            {line.styleNo}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center font-semibold text-slate-900 whitespace-nowrap">
                            <span className="font-bold">{line.colour}</span>
                            {line.colourCode && (
                              <span className="block text-[10px] text-slate-400 font-mono">
                                {line.colourCode}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center text-slate-700 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-medium uppercase text-slate-600">
                              {line.processType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center font-medium text-slate-700 whitespace-nowrap">
                            {line.orderedQty.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-slate-900 whitespace-nowrap">
                            {line.cumulativeInward.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center font-semibold whitespace-nowrap">
                            <span
                              className={
                                orderInwardDiff === 0
                                  ? 'text-emerald-700'
                                  : orderInwardDiff > 0
                                  ? 'text-amber-700'
                                  : 'text-blue-700'
                              }
                            >
                              {orderInwardDiff}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-blue-700 whitespace-nowrap">
                            {line.cumulativeOutward.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center font-semibold whitespace-nowrap">
                            <span
                              className={
                                inwardOutwardDiff === 0
                                  ? 'text-emerald-700 font-bold'
                                  : inwardOutwardDiff > 0
                                  ? 'text-rose-600 font-bold'
                                  : 'text-purple-700 font-bold'
                              }
                            >
                              {inwardOutwardDiff}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center font-bold uppercase text-[10px] text-slate-600 whitespace-nowrap">
                            {line.unit}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center whitespace-nowrap">
                            {line.isReadyForInvoice ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Ready for Invoice
                              </span>
                            ) : line.cumulativeInward === 0 ? (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-full font-medium text-[10px]">
                                Pending Inward
                              </span>
                            ) : line.balanceQty > 0 ? (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-medium text-[10px]">
                                Pending Outward ({line.balanceQty})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-medium text-[10px]">
                                In Progress
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 border border-slate-200 text-center whitespace-nowrap">
                            {line.isReadyForInvoice ? (
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1 px-3 shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                onClick={async () => {
                                  setApprovingLineKey(line.poLineId);
                                  try {
                                    await onApproveLine(line.poId, line.poLineId, line.companyId);
                                  } finally {
                                    setApprovingLineKey(null);
                                  }
                                }}
                                disabled={isApproving}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {isLineApproving ? 'Approving...' : 'Approve to Invoice'}
                              </Button>
                            ) : (
                              /* Unfinished line: WITHOUT APPROVAL BUTTON as requested */
                              <span className="text-slate-400 font-bold">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
