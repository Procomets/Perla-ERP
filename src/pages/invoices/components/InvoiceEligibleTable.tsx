import React, { useState, useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { InvoiceEligibleItem } from '../../../types/invoice';
import { formatCurrency, formatDate } from '../../../utils/formatters';

interface InvoiceEligibleTableProps {
  eligibleItems: InvoiceEligibleItem[];
  loading: boolean;
  onGenerateInvoice: (selectedApprovalIds: string[]) => void;
  onDownloadInvoice: (items: InvoiceEligibleItem | InvoiceEligibleItem[]) => void;
  onNavigateStatement?: () => void;
}

export const InvoiceEligibleTable: React.FC<InvoiceEligibleTableProps> = ({
  eligibleItems,
  loading,
  onGenerateInvoice,
  onDownloadInvoice,
  onNavigateStatement
}) => {
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Search filter
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return eligibleItems;
    const q = searchQuery.toLowerCase().trim();
    return eligibleItems.filter(
      (item) =>
        item.companyName.toLowerCase().includes(q) ||
        item.poNumber.toLowerCase().includes(q) ||
        item.styleNo.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        item.colour.toLowerCase().includes(q) ||
        item.washType.toLowerCase().includes(q) ||
        item.processCategory.toLowerCase().includes(q)
    );
  }, [eligibleItems, searchQuery]);

  // Group eligible items by Purchase Order (most recent approval timestamp first)
  const poGroups = useMemo(() => {
    // Sort items so most recent approved items appear first
    const sorted = [...filteredItems].sort((a, b) => {
      const timeA = new Date(a.approvedAt || 0).getTime();
      const timeB = new Date(b.approvedAt || 0).getTime();
      return timeB - timeA;
    });

    const map = new Map<string, InvoiceEligibleItem[]>();
    sorted.forEach((item) => {
      const key = item.poNumber || item.poId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });

    return Array.from(map.entries())
      .map(([poKey, items]) => {
        const totalQty = items.reduce((sum, i) => sum + (Number(i.remainingApprovedQty) || 0), 0);
        const totalValue = items.reduce((sum, i) => sum + (Number(i.estimatedTaxableAmount) || 0), 0);
        const maxTime = Math.max(...items.map((i) => new Date(i.approvedAt || 0).getTime()));
        return {
          poKey,
          poNumber: items[0].poNumber,
          styleNo: items[0].styleNo,
          itemName: items[0].itemName,
          companyName: items[0].companyName,
          companyId: items[0].companyId,
          items,
          totalQty,
          totalValue,
          unit: items[0].unit || 'piece',
          hasMultipleColours: items.length > 1,
          latestApprovedAt: maxTime
        };
      })
      .sort((a, b) => b.latestApprovedAt - a.latestApprovedAt);
  }, [filteredItems]);

  const allSelected =
    filteredItems.length > 0 && selectedApprovalIds.length === filteredItems.length;

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedApprovalIds([]);
    } else {
      setSelectedApprovalIds(filteredItems.map((i) => i.approvalId));
    }
  };

  const handleToggleItem = (approvalId: string) => {
    setSelectedApprovalIds((prev) =>
      prev.includes(approvalId) ? prev.filter((id) => id !== approvalId) : [...prev, approvalId]
    );
  };

  const handleSelectGroup = (items: InvoiceEligibleItem[]) => {
    const ids = items.map((i) => i.approvalId);
    const allGroupSelected = ids.every((id) => selectedApprovalIds.includes(id));
    if (allGroupSelected) {
      setSelectedApprovalIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedApprovalIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const selectedItems = eligibleItems.filter((i) => selectedApprovalIds.includes(i.approvalId));
  const isSingleCompanySelection =
    selectedItems.length === 0 ||
    selectedItems.every((i) => i.companyId === selectedItems[0].companyId);

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-xs">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            Approved Colour Lines Ready for Invoicing
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Full colour-wise order specifications with Purchase Order number and client company details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Quick Search */}
          <div className="relative flex-1 lg:w-64">
            <input
              type="text"
              placeholder="Search PO, Company, Colour..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#1F4E79] focus:bg-white"
            />
          </div>

          <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 whitespace-nowrap">
            {eligibleItems.length} colour line{eligibleItems.length === 1 ? '' : 's'} eligible
          </span>
        </div>
      </div>

      {/* Multi-Selection Bulk Action Bar */}
      {selectedApprovalIds.length > 0 && (
        <div className="px-5 py-3 bg-blue-50/90 border-b border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-blue-900">
            <span className="font-bold">
              {selectedApprovalIds.length} colour line{selectedApprovalIds.length > 1 ? 's' : ''} selected
            </span>
            {!isSingleCompanySelection && (
              <span className="text-rose-600 font-semibold ml-2">
                (Warning: Selected lines belong to different companies. Please select lines from one company.)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedApprovalIds([])}
              className="text-xs py-1 h-auto"
            >
              Clear Selection
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!isSingleCompanySelection}
              onClick={() => onDownloadInvoice(selectedItems)}
              className="bg-black hover:bg-neutral-800 text-white font-semibold text-xs py-1 h-auto"
            >
              Download Combined Invoice ({selectedApprovalIds.length} Colours)
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!isSingleCompanySelection}
              onClick={() => onGenerateInvoice(selectedApprovalIds)}
              className="text-xs py-1 h-auto font-semibold"
            >
              Review ({selectedApprovalIds.length} Colours)
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm">
          Loading eligible colour lines...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center">
          <h4 className="text-sm font-bold text-slate-800">
            {searchQuery ? 'No Matching Colour Lines Found' : 'No Approved Lines Waiting for Invoicing'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            {searchQuery
              ? 'Try modifying your search term for PO number, company name, or colour.'
              : 'All approved quantities have been invoiced, or no reconciliation colour lines have been approved yet.'}
          </p>
          {onNavigateStatement && !searchQuery && (
            <button
              type="button"
              onClick={onNavigateStatement}
              className="mt-4 inline-flex items-center text-xs font-semibold text-[#1F4E79] hover:underline cursor-pointer"
            >
              Go to Statement Module &rarr;
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[1280px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-[#1F4E79] border-slate-300 focus:ring-0 cursor-pointer"
                    title={allSelected ? 'Deselect all' : 'Select all'}
                  />
                </th>
                <th className="py-3 px-3 min-w-[180px]">Company Name</th>
                <th className="py-3 px-3 min-w-[160px]">PO Number</th>
                <th className="py-3 px-3 min-w-[150px]">Style & Item</th>
                <th className="py-3 px-3 min-w-[200px]">Colour & Specifications</th>
                <th className="py-3 px-3 min-w-[120px] text-right">Approved Qty</th>
                <th className="py-3 px-3 min-w-[90px] text-center">Basis</th>
                <th className="py-3 px-3 min-w-[100px] text-right">Agreed Rate</th>
                <th className="py-3 px-3 min-w-[130px] text-right">Est. Taxable Value</th>
                <th className="py-3 px-3 min-w-[130px]">Approval Date</th>
                <th className="py-3 px-4 min-w-[220px] text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {poGroups.map((group) => {
                const groupItemIds = group.items.map((i) => i.approvalId);
                const isGroupSelected = groupItemIds.every((id) => selectedApprovalIds.includes(id));

                return (
                  <React.Fragment key={group.poKey}>
                    {/* PO Group Banner for Multiple Colours */}
                    {group.hasMultipleColours && (
                      <tr className="bg-[#F0F5FA] border-t-2 border-b border-[#BDD7EE]">
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isGroupSelected}
                            onChange={() => handleSelectGroup(group.items)}
                            className="w-4 h-4 rounded text-[#1F4E79] border-slate-300 focus:ring-0 cursor-pointer"
                            title={isGroupSelected ? 'Deselect this PO group' : 'Select all colours in this PO'}
                          />
                        </td>
                        <td colSpan={10} className="py-2.5 px-3">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[#1F4E79] font-mono text-xs">
                                PO #{group.poNumber}
                              </span>
                              <span className="text-[11px] text-slate-700 font-semibold">
                                • {group.companyName}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                • Style: <strong className="text-slate-800">{group.styleNo}</strong> ({group.itemName})
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                {group.items.length} Colours Approved ({group.totalQty.toLocaleString('en-IN')} {group.unit})
                              </span>
                              <span className="text-[11px] font-bold text-slate-700">
                                Total: {formatCurrency(group.totalValue)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => onDownloadInvoice(group.items)}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-1 h-auto shadow-2xs whitespace-nowrap"
                                title={`Download tax invoice including all ${group.items.length} colours`}
                              >
                                Download Invoice (All {group.items.length} Colours)
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onGenerateInvoice(group.items.map((i) => i.approvalId))}
                                className="text-xs py-1 h-auto font-semibold whitespace-nowrap"
                                title={`Review combined invoice draft for all ${group.items.length} colours`}
                              >
                                Review ({group.items.length} Colours)
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Individual Item Rows */}
                    {group.items.map((item) => {
                      const isSelected = selectedApprovalIds.includes(item.approvalId);
                      return (
                        <tr
                          key={item.approvalId}
                          className={`hover:bg-blue-50/30 transition-colors ${
                            isSelected ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleItem(item.approvalId)}
                              className="w-4 h-4 rounded text-[#1F4E79] border-slate-300 focus:ring-0 cursor-pointer"
                            />
                          </td>

                          {/* Company Name */}
                          <td className="py-3 px-3">
                            <div className="whitespace-nowrap">
                              <span className="font-bold text-slate-900 text-xs block">
                                {item.companyName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                Customer Client
                              </span>
                            </div>
                          </td>

                          {/* PO Number */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {item.poNumber}
                            </span>
                          </td>

                          {/* Style & Item */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900 text-xs">
                              {item.styleNo}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              {item.itemName || 'Garments'}
                            </div>
                          </td>

                          {/* Colour & Specifications */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                              {item.colour}
                            </div>
                            <div className="text-[11px] text-slate-600 mt-0.5">
                              <span>{item.washType}</span>
                              <span className="text-slate-400 ml-1">({item.processCategory})</span>
                            </div>
                            {item.billableWeightKg ? (
                              <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                                Billable: {item.billableWeightKg} kg
                              </div>
                            ) : null}
                          </td>

                          {/* Approved Qty */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="font-bold text-slate-900 text-xs">
                              {item.remainingApprovedQty.toLocaleString('en-IN')}{' '}
                              <span className="font-normal text-slate-500 text-[11px]">{item.unit}</span>
                            </span>
                          </td>

                          {/* Basis */}
                          <td className="py-3 px-3 text-center whitespace-nowrap text-xs text-slate-700">
                            {item.rateBasis === 'per_kg' ? '₹ / Kg' : '₹ / Pc'}
                          </td>

                          {/* Agreed Rate */}
                          <td className="py-3 px-3 text-right whitespace-nowrap font-bold text-slate-900 text-xs">
                            ₹{item.rate.toFixed(2)}
                          </td>

                          {/* Est. Taxable Value */}
                          <td className="py-3 px-3 text-right whitespace-nowrap font-black text-[#1F4E79] text-xs">
                            {formatCurrency(item.estimatedTaxableAmount)}
                          </td>

                          {/* Approval Date */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="text-slate-600 text-[11px] font-medium">
                              {formatDate(item.approvedAt)}
                            </div>
                            {item.approvedByName && (
                              <div className="text-[10px] text-slate-400">
                                by {item.approvedByName}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => onDownloadInvoice(item)}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-1 px-3 shadow-2xs"
                                title={`Download tax invoice for colour ${item.colour}`}
                              >
                                Download Invoice
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onGenerateInvoice([item.approvalId])}
                                className="text-xs py-1 px-2.5 font-semibold"
                                title="Review and finalize tax invoice draft"
                              >
                                Review
                              </Button>
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
};
