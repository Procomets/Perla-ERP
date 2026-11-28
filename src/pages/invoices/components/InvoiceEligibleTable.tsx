import React, { useState, useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { LoadingOverlay } from '../../../components/ui/LoadingOverlay';
import { TableMaximizeWrapper } from '../../../components/ui/TableMaximizeWrapper';
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
  onApproveSelectedLines?: (
    items: { poId: string; poLineId: string; companyId?: string }[],
    options: { isFinalizedPO: boolean; syncPoQtyToDispatched: boolean }
  ) => Promise<void>;
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
  onApproveSelectedLines,
  isApproving,
  onRequestInvoicing,
  onGenerateInvoice,
  onDownloadInvoice,
  onSwitchTab
}) => {
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);
  const [approvingLineKey, setApprovingLineKey] = useState<string | null>(null);

  const [selectedEligibleKeys, setSelectedEligibleKeys] = useState<Set<string>>(new Set());
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [isFinalizedPOChoice, setIsFinalizedPOChoice] = useState(false);
  const [syncPoQtyChoice, setSyncPoQtyChoice] = useState(true);
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

  // Helper to convert an approved line to InvoiceEligibleItem for invoice generation
  const lineToEligibleItem = (line: InvoiceReadinessLine): InvoiceEligibleItem => {
    const existing = eligibleItems.find(
      (e) =>
        (line.approvalId && e.approvalId === line.approvalId) ||
        (e.poLineId === line.poLineId && e.approvalStatus === 'approved')
    );
    if (existing) return existing;

    const rate = Number(line.rate) || 0;
    const qty =
      Number(
        line.pendingApprovedQty && line.pendingApprovedQty > 0
          ? line.pendingApprovedQty
          : line.readyForInvoiceQty && line.readyForInvoiceQty > 0
            ? line.readyForInvoiceQty
            : line.cumulativeOutward
      ) || 0;
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
      previouslyInvoicedQty: line.previouslyInvoicedQty || 0,
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
      <TableMaximizeWrapper
        title="Invoice Generation (Approved Purchase Orders)"
        showFloatingButton={false}
        badge={
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
            {approvedPOGroups.length} POs
          </span>
        }
      >
        {(isMaximized) => (
          <Card className="overflow-hidden border border-slate-200 bg-white shadow-xs space-y-0 flex-1 flex flex-col min-h-0">
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
          <div
            data-table-scroll="true"
            className={`overflow-x-auto overflow-y-auto text-xs ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[620px]'}`}
          >
            <table className="w-full text-center border-collapse border border-slate-300">
              <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB]">
                <tr className="bg-[#EEF5FB] text-[#1F4E79] uppercase font-bold text-[11px] tracking-wider border-b-2 border-slate-300">
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">PO Number</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Style No</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Colour &amp; Code</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Process</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Inward Qty</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Billed Qty</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Unit</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Rate</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Est. Taxable</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Status</th>
                  <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 pr-12 border border-slate-300 text-center whitespace-nowrap min-w-[120px]">Select</th>
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
        )}
      </TableMaximizeWrapper>
    );
  }

  // =========================================================================
  // VIEW MODE: INVOICE-ELIGIBLE ITEMS (Reconciliation & Line Approval)
  // =========================================================================
  return (
    <TableMaximizeWrapper
      title="Colour-Wise Reconciliation & Invoice Readiness Ledger"
      badge={
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
          {pendingPOGroups.length} PO{pendingPOGroups.length !== 1 ? 's' : ''} • {totalReadyCount} Ready
        </span>
      }
    >
      {(isMaximized) => (
        <>
        <Card className="overflow-hidden border border-slate-200 bg-white shadow-xs space-y-0 flex-1 flex flex-col min-h-0">
          {/* Section Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
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
                  Tick ready colour lines (where Inward = Outward) and click "Move to Invoice Generation"
                </p>
              </div>

              {selectedEligibleKeys.size > 0 && (
                <div className="flex items-center gap-2 pr-10">
                  <button
                    type="button"
                    onClick={() => setSelectedEligibleKeys(new Set())}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-md cursor-pointer"
                  >
                    Clear ({selectedEligibleKeys.size})
                  </button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3.5 shadow-2xs cursor-pointer flex items-center gap-1.5"
                    onClick={() => {
                      setIsFinalizedPOChoice(false);
                      setSyncPoQtyChoice(true);
                      setShowApprovalModal(true);
                    }}
                    disabled={isApproving || isSubmittingApproval}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Move to Invoice Generation ({selectedEligibleKeys.size})
                  </Button>
                </div>
              )}
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
            <div
              data-table-scroll="true"
              className={`overflow-x-auto overflow-y-auto text-xs ${isMaximized ? 'flex-1 max-h-none' : 'max-h-[620px]'}`}
            >
              <table className="w-full text-center border-collapse border border-slate-300">
                <thead className="sticky top-0 z-20 shadow-[0_1px_3px_rgba(0,0,0,0.06)] bg-[#EEF5FB]">
                  <tr className="bg-[#EEF5FB] text-[#1F4E79] uppercase font-bold text-[11px] tracking-wider border-b-2 border-slate-300">
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">PO Number</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Style No</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Colour &amp; Code</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Process</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Ordered</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Received Inward</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Order - Inward Diff</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Dispatched Outward</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Inward - Outward Diff</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Unit</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Invoice Status</th>
                    <th className="sticky top-0 z-20 bg-[#EEF5FB] py-2.5 px-2.5 border border-slate-300 text-center w-12">
                      {(() => {
                        const allReadyKeys = pendingPOGroups.flatMap((g) =>
                          g.eligibleLines.map((l) => `${l.poId}:::${l.poLineId}`)
                        );
                        const allChecked =
                          allReadyKeys.length > 0 &&
                          allReadyKeys.every((k) => selectedEligibleKeys.has(k));
                        return (
                          <input
                            type="checkbox"
                            title="Select all ready colour lines"
                            checked={allChecked}
                            disabled={allReadyKeys.length === 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEligibleKeys(new Set(allReadyKeys));
                              } else {
                                setSelectedEligibleKeys(new Set());
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer accent-emerald-600"
                          />
                        );
                      })()}
                    </th>
                  </tr>
                </thead>
            <tbody>
              {pendingPOGroups.map((group) => {
                const hasUnapprovedEligible = group.eligibleLines.length > 0;
                const groupReadyKeys = group.eligibleLines.map((l) => `${l.poId}:::${l.poLineId}`);
                const isGroupAllChecked =
                  groupReadyKeys.length > 0 &&
                  groupReadyKeys.every((k) => selectedEligibleKeys.has(k));

                return (
                  <React.Fragment key={`pending_${group.poId || group.poNumber}`}>
                    {/* PO Group Header Banner */}
                    <tr className="bg-slate-100/95 border-t-2 border-b border-slate-300">
                      <td colSpan={11} className="py-2 px-4 text-left">
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

                          {hasUnapprovedEligible && (
                            <span className="text-[11px] font-semibold text-slate-600 select-none">
                              Select PO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2.5 border-l border-slate-300 text-center w-12">
                        {hasUnapprovedEligible ? (
                          <input
                            type="checkbox"
                            title={`Select all ready lines in PO #${group.poNumber}`}
                            checked={isGroupAllChecked}
                            onChange={(e) => {
                              const next = new Set(selectedEligibleKeys);
                              if (e.target.checked) {
                                groupReadyKeys.forEach((k) => next.add(k));
                              } else {
                                groupReadyKeys.forEach((k) => next.delete(k));
                              }
                              setSelectedEligibleKeys(next);
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer accent-emerald-600"
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Individual Colour Rows for this PO */}
                    {group.lines.map((line) => {
                      const orderInwardDiff = line.orderedVsInwardDiff;
                      const inwardOutwardDiff = line.balanceQty;
                      const rowKey = `${line.poId}:::${line.poLineId}`;
                      const isChecked = selectedEligibleKeys.has(rowKey);

                      return (
                        <tr
                          key={`pen_line_${line.poLineId}`}
                          className={`hover:bg-slate-50 transition-colors ${
                            isChecked
                              ? 'bg-emerald-50/60'
                              : line.isReadyForInvoice
                                ? 'bg-emerald-50/25'
                                : ''
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
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full font-bold text-[10px] inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Ready for Approval
                                  {line.previouslyInvoicedQty && line.previouslyInvoicedQty > 0
                                    ? ` (+${line.readyForInvoiceQty ?? line.cumulativeOutward})`
                                    : ''}
                                </span>
                                {line.previouslyInvoicedQty && line.previouslyInvoicedQty > 0 ? (
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {line.previouslyInvoicedQty} previously invoiced
                                  </span>
                                ) : null}
                              </div>
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
                          <td className="py-2.5 px-2.5 border border-slate-200 text-center whitespace-nowrap">
                            {line.isReadyForInvoice ? (
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = new Set(selectedEligibleKeys);
                                  if (e.target.checked) {
                                    next.add(rowKey);
                                  } else {
                                    next.delete(rowKey);
                                  }
                                  setSelectedEligibleKeys(next);
                                }}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer accent-emerald-600"
                              />
                            ) : (
                              <span className="text-slate-300">—</span>
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

      {/* PO Finalization & Balance Confirmation Modal */}
      {showApprovalModal && (() => {
        const selectedLines = pendingPOGroups.flatMap((g) =>
          g.eligibleLines.filter((l) => selectedEligibleKeys.has(`${l.poId}:::${l.poLineId}`))
        );
        const selectedPoIds = Array.from(new Set(selectedLines.map((l) => l.poId)));
        const affectedGroups = pendingPOGroups.filter((g) => selectedPoIds.includes(g.poId));
        const unbalancedLines = affectedGroups.flatMap((g) =>
          g.lines.filter((l) => l.orderedQty !== l.cumulativeOutward)
        );
        const hasUnbalancedPO = unbalancedLines.length > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-[2px] p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Move to Invoice Generation ({selectedLines.length} Colour Line{selectedLines.length !== 1 ? 's' : ''})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Confirm whether this is a mid-PO invoice or the finalized invoice for the PO.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !isSubmittingApproval && setShowApprovalModal(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 text-sm font-bold transition cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto text-xs">
                {/* PO Balance Status Summary */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      PO Order vs Dispatched Balance Check
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                        hasUnbalancedPO
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}
                    >
                      {hasUnbalancedPO ? 'Not Balanced' : 'Balanced'}
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50/60 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-4">PO &amp; Colour</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Ordered</th>
                          <th className="py-2 px-3 text-right whitespace-nowrap">Dispatched</th>
                          <th className="py-2 px-4 text-right whitespace-nowrap">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {affectedGroups.flatMap((g) =>
                          g.lines.map((l) => {
                            const isSelected = selectedEligibleKeys.has(`${l.poId}:::${l.poLineId}`);
                            const diff = l.orderedQty - l.cumulativeOutward;
                            const lineBalanced = diff === 0;
                            return (
                              <tr
                                key={`modal_line_${l.poLineId}`}
                                className={isSelected ? 'bg-emerald-50/50' : 'bg-white'}
                              >
                                <td className="py-2.5 px-4">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-bold text-slate-900 font-mono whitespace-nowrap">
                                      {l.poNumber}
                                    </span>
                                    <span className="text-slate-400">•</span>
                                    <span className="font-semibold text-slate-800">{l.colour}</span>
                                    {isSelected && (
                                      <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-bold whitespace-nowrap">
                                        Selected (+{l.readyForInvoiceQty ?? l.cumulativeOutward})
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                                  {l.orderedQty.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                                  {l.cumulativeOutward.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono font-bold whitespace-nowrap">
                                  {lineBalanced ? (
                                    <span className="text-emerald-700">0 (Balanced)</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                      Diff: {diff.toLocaleString()}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Finalized Invoice Question */}
                <div className="space-y-2.5">
                  <label className="block font-bold text-slate-900 text-xs">
                    Is this a finalized invoice for this PO?
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsFinalizedPOChoice(false)}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                        !isFinalizedPOChoice
                          ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          !isFinalizedPOChoice ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {!isFinalizedPOChoice && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">No — Mid-PO / Partial Invoice</div>
                        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Keep PO open &amp; editable. Future inward/outward entries can be invoiced again.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFinalizedPOChoice(true)}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                        isFinalizedPOChoice
                          ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isFinalizedPOChoice ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isFinalizedPOChoice && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">Yes — Finalize Invoice &amp; Lock PO</div>
                        <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          Mark PO as completed and lock PO editing.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* If Finalize chosen & PO is not balanced */}
                {isFinalizedPOChoice && hasUnbalancedPO && (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
                    <div className="font-bold text-amber-900">
                      PO Order Quantity and Dispatched Quantity are not balanced.
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      {unbalancedLines.length} colour line(s) have Ordered Qty different from Dispatched Qty.
                      Do you want to change the PO Order Quantity to match the Dispatched Quantity?
                    </p>
                    <label className="flex items-center gap-2 font-semibold text-amber-950 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={syncPoQtyChoice}
                        onChange={(e) => setSyncPoQtyChoice(e.target.checked)}
                        className="w-4 h-4 rounded border-amber-400 accent-amber-700 cursor-pointer"
                      />
                      <span>Yes, change PO Order Quantity to Dispatched Quantity</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  disabled={isSubmittingApproval}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-xs cursor-pointer"
                  loading={isSubmittingApproval}
                  loadingText="Moving..."
                  disabled={isSubmittingApproval || selectedLines.length === 0}
                  onClick={async () => {
                    setIsSubmittingApproval(true);
                    try {
                      const items = selectedLines.map((l) => ({
                        poId: l.poId,
                        poLineId: l.poLineId,
                        companyId: l.companyId
                      }));
                      if (onApproveSelectedLines) {
                        await onApproveSelectedLines(items, {
                          isFinalizedPO: isFinalizedPOChoice,
                          syncPoQtyToDispatched: isFinalizedPOChoice && hasUnbalancedPO && syncPoQtyChoice
                        });
                      } else {
                        for (const item of items) {
                          await onApproveLine(item.poId, item.poLineId, item.companyId);
                        }
                      }
                      setSelectedEligibleKeys(new Set());
                      setShowApprovalModal(false);
                    } finally {
                      setIsSubmittingApproval(false);
                    }
                  }}
                >
                  {isSubmittingApproval ? 'Moving...' : 'Confirm & Move to Invoice Generation'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      <LoadingOverlay
        isOpen={isSubmittingApproval}
        title={isFinalizedPOChoice ? 'Finalizing PO & Moving to Invoice Generation...' : 'Moving to Invoice Generation...'}
        message={
          isFinalizedPOChoice
            ? 'Updating Purchase Order status, locking completed lines, and preparing items for invoice billing...'
            : 'Approving selected colour lines and preparing them for invoice generation...'
        }
      />
        </>
      )}
    </TableMaximizeWrapper>
  );
};
