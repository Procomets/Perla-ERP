import React, { useState, useMemo } from 'react';
import {
  StatementInwardRow,
  StatementOutwardRow,
  StatementUnitTotal
} from '../../../types/statement';
import { formatDate } from '../../../utils/formatters';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  PackageCheck,
  Search,
  Palette,
  Calendar,
  X,
  RotateCcw
} from 'lucide-react';

interface StatementLedgerTableProps {
  inwards: StatementInwardRow[];
  outwards: StatementOutwardRow[];
  unitTotals: StatementUnitTotal[];
  companyName: string;
}

export const StatementLedgerTable: React.FC<StatementLedgerTableProps> = ({
  inwards,
  outwards,
  unitTotals,
  companyName
}) => {
  // Section-specific filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColour, setSelectedColour] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Extract distinct colours present across inward and outward data
  const availableColours = useMemo(() => {
    const set = new Set<string>();
    inwards.forEach((row) => {
      if (row.colour && row.colour.trim() && row.colour.trim() !== 'All Colours') {
        set.add(row.colour.trim());
      }
    });
    outwards.forEach((row) => {
      if (row.colour && row.colour.trim() && row.colour.trim() !== 'All Colours') {
        set.add(row.colour.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [inwards, outwards]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() || selectedColour !== 'all' || fromDate || toDate
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedColour('all');
    setFromDate('');
    setToDate('');
  };

  // Helper to extract YYYY-MM-DD from various date formats
  const parseRowDateString = (rawDate: any): string => {
    if (!rawDate) return '';
    if (typeof rawDate === 'string') {
      const match = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {
      return '';
    }
    return '';
  };

  // Filter Inward rows
  const filteredInwards = useMemo(() => {
    return inwards.filter((row) => {
      // Colour filter
      if (
        selectedColour !== 'all' &&
        row.colour?.trim().toLowerCase() !== selectedColour.trim().toLowerCase()
      ) {
        return false;
      }
      // Date filter
      if (fromDate || toDate) {
        const rowDate = parseRowDateString(row.date);
        if (fromDate && (!rowDate || rowDate < fromDate)) return false;
        if (toDate && (!rowDate || rowDate > toDate)) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const dcMatch = row.dcNo?.toLowerCase().includes(q);
        const colourMatch = row.colour?.toLowerCase().includes(q);
        const inwardNoMatch = row.inwardNo?.toLowerCase().includes(q);
        const qtyMatch = row.qtyReceived?.toString().includes(q);
        const unitMatch = row.unit?.toLowerCase().includes(q);
        const formattedDateMatch = formatDate(row.date)?.toLowerCase().includes(q);
        if (
          !dcMatch &&
          !colourMatch &&
          !inwardNoMatch &&
          !qtyMatch &&
          !unitMatch &&
          !formattedDateMatch
        ) {
          return false;
        }
      }
      return true;
    });
  }, [inwards, selectedColour, fromDate, toDate, searchQuery]);

  // Filter Outward rows
  const filteredOutwards = useMemo(() => {
    return outwards.filter((row) => {
      // Colour filter
      if (
        selectedColour !== 'all' &&
        row.colour?.trim().toLowerCase() !== selectedColour.trim().toLowerCase()
      ) {
        return false;
      }
      // Date filter
      if (fromDate || toDate) {
        const rowDate = parseRowDateString(row.date);
        if (fromDate && (!rowDate || rowDate < fromDate)) return false;
        if (toDate && (!rowDate || rowDate > toDate)) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const dcMatch = row.dcNo?.toLowerCase().includes(q);
        const colourMatch = row.colour?.toLowerCase().includes(q);
        const outwardNoMatch = row.outwardNo?.toLowerCase().includes(q);
        const qtyMatch = row.qtyDispatched?.toString().includes(q);
        const unitMatch = row.unit?.toLowerCase().includes(q);
        const formattedDateMatch = formatDate(row.date)?.toLowerCase().includes(q);
        if (
          !dcMatch &&
          !colourMatch &&
          !outwardNoMatch &&
          !qtyMatch &&
          !unitMatch &&
          !formattedDateMatch
        ) {
          return false;
        }
      }
      return true;
    });
  }, [outwards, selectedColour, fromDate, toDate, searchQuery]);

  const maxRows = Math.max(filteredInwards.length, filteredOutwards.length);

  // Compute summary totals for filtered rows
  const displayedUnitTotals = useMemo(() => {
    if (!hasActiveFilters) return unitTotals;

    return unitTotals.map((tot) => {
      const filteredInward = filteredInwards
        .filter((r) => r.unit === tot.unit)
        .reduce((sum, r) => sum + r.qtyReceived, 0);
      const filteredOutward = filteredOutwards
        .filter((r) => r.unit === tot.unit)
        .reduce((sum, r) => sum + r.qtyDispatched, 0);
      const roundedInward = tot.unit === 'kg' ? Math.round(filteredInward * 100) / 100 : filteredInward;
      const roundedOutward = tot.unit === 'kg' ? Math.round(filteredOutward * 100) / 100 : filteredOutward;
      const balance = tot.unit === 'kg' ? Math.round((roundedInward - roundedOutward) * 100) / 100 : roundedInward - roundedOutward;

      return {
        ...tot,
        totalInward: roundedInward,
        totalOutward: roundedOutward,
        balance,
        orderVsInwardDiff: tot.totalOrdered - roundedInward
      };
    });
  }, [unitTotals, hasActiveFilters, filteredInwards, filteredOutwards]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
      {/* Table Header Banner */}
      <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#1F4E79]" />
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Side-by-Side Dual Ledger Reconciliation Table
            </h3>
            <p className="text-[11px] text-slate-500">
              Chronological posted transactions ledger for {companyName}. Left: Inward receipts • Right: Outward delivery dispatches.
            </p>
          </div>
        </div>

        <div className="text-xs font-semibold text-slate-500 flex items-center gap-4">
          <span className="flex items-center gap-1 text-emerald-800">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            {hasActiveFilters ? `${filteredInwards.length} of ${inwards.length}` : inwards.length} Inward DC(s)
          </span>
          <span className="flex items-center gap-1 text-blue-800">
            <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
            {hasActiveFilters ? `${filteredOutwards.length} of ${outwards.length}` : outwards.length} Outward DC(s)
          </span>
        </div>
      </div>

      {/* Section-Specific Filter Bar: Search, Colour, Date-Wise */}
      <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* 1. Search Bar */}
          <div className="relative flex-1 sm:flex-initial sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search DC No, Colour, Qty..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-[#1F4E79] transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Colour Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-2xs">
            <Palette className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Colour:</label>
            <select
              value={selectedColour}
              onChange={(e) => setSelectedColour(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-1"
            >
              <option value="all">
                All Colours {availableColours.length > 0 ? `(${availableColours.length})` : ''}
              </option>
              {availableColours.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Date-Wise Filter */}
          <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2.5 py-1 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Date:</span>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                title="From Date"
                className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                title="To Date"
                className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer ml-0.5"
                  title="Clear date filter"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Summary & Reset Button */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <>
              <span className="text-[11px] font-bold text-[#1F4E79] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                Matched: {filteredInwards.length} Inward • {filteredOutwards.length} Outward
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                title="Reset table filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Dual-Section Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-center text-xs border-collapse border border-slate-300 min-w-[900px]">
          <thead>
            {/* Top Super-Header Row */}
            <tr className="border-b border-slate-300 text-xs font-bold uppercase tracking-wider">
              {/* Left Section Heading */}
              <th
                colSpan={5}
                className="py-3 px-4 bg-emerald-50 text-emerald-950 border border-slate-300 border-r-4 border-r-slate-400"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-black text-emerald-900">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                    INWARD (Receipts from Customer)
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold lowercase">
                    {filteredInwards.length} transaction(s){hasActiveFilters && ` (of ${inwards.length})`}
                  </span>
                </div>
              </th>

              {/* Right Section Heading */}
              <th
                colSpan={5}
                className="py-3 px-4 bg-blue-50 text-blue-950 border border-slate-300"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-black text-blue-900">
                    <ArrowUpRight className="w-4 h-4 text-blue-700" />
                    OUTWARD (Dispatches to Customer)
                  </span>
                  <span className="text-[11px] text-blue-700 font-semibold lowercase">
                    {filteredOutwards.length} transaction(s){hasActiveFilters && ` (of ${outwards.length})`}
                  </span>
                </div>
              </th>
            </tr>

            {/* Column Headers */}
            <tr className="bg-slate-100 text-slate-700 font-semibold text-[11px] uppercase border-b border-slate-300">
              {/* Inward Columns */}
              <th className="py-2.5 px-3 border border-slate-300 text-center w-28 whitespace-nowrap">Date</th>
              <th className="py-2.5 px-3 border border-slate-300 text-center w-36 whitespace-nowrap">DC No.</th>
              <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Colour</th>
              <th className="py-2.5 px-3 border border-slate-300 text-center w-28 whitespace-nowrap">Qty Received</th>
              <th className="py-2.5 px-3 border border-slate-300 border-r-4 border-r-slate-400 text-center w-16 whitespace-nowrap">Unit</th>

              {/* Outward Columns */}
              <th className="py-2.5 px-3 border border-slate-300 text-center w-28 whitespace-nowrap">Date</th>
              <th className="py-2.5 px-3 border border-slate-300 text-center w-36 whitespace-nowrap">DC No.</th>
              <th className="py-2.5 px-3 border border-slate-300 text-center whitespace-nowrap">Colour</th>
              <th className="py-2.5 px-3 border border-slate-300 text-center w-28 whitespace-nowrap">Qty Dispatched</th>
              <th className="py-2.5 px-3 border border-slate-300 text-center w-16 whitespace-nowrap">Unit</th>
            </tr>
          </thead>

          <tbody>
            {maxRows === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="py-12 text-center text-xs text-slate-400 bg-slate-50/30 border border-slate-200"
                >
                  <PackageCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  {hasActiveFilters ? (
                    <div className="space-y-2">
                      <p className="font-semibold text-slate-600">No transactions match your filter criteria.</p>
                      <p className="text-[11px] text-slate-400">
                        Try adjusting your search query, colour selection, or date range.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F4E79] bg-blue-50 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Table Filters
                      </button>
                    </div>
                  ) : (
                    'No transactions recorded yet for this scope. Select a Customer and Purchase Order to view live reconciliation ledger.'
                  )}
                </td>
              </tr>
            ) : (
              Array.from({ length: maxRows }).map((_, idx) => {
                const inRow = filteredInwards[idx];
                const outRow = filteredOutwards[idx];
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={idx}
                    className={`${isEven ? 'bg-white' : 'bg-slate-50/40'} hover:bg-slate-100/50 transition-colors`}
                  >
                    {/* --- LEFT SECTION: INWARD --- */}
                    {inRow ? (
                      <>
                        <td className="py-2 px-3 border border-slate-200 text-center text-slate-600 whitespace-nowrap">
                          {formatDate(inRow.date)}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-semibold text-slate-800 whitespace-nowrap">
                          <span className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            {inRow.dcNo}
                          </span>
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-medium text-slate-900 whitespace-nowrap">
                          {inRow.colour}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-bold text-emerald-700 whitespace-nowrap">
                          {inRow.qtyReceived.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 border-r-4 border-r-slate-400 text-center text-slate-500 uppercase font-semibold text-[10px] whitespace-nowrap">
                          {inRow.unit}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3 border border-slate-200 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                        <td className="py-2 px-3 border border-slate-200 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                        <td className="py-2 px-3 border border-slate-200 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                        <td className="py-2 px-3 border border-slate-200 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                        <td className="py-2 px-3 border border-slate-200 border-r-4 border-r-slate-400 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                      </>
                    )}

                    {/* --- RIGHT SECTION: OUTWARD --- */}
                    {outRow ? (
                      <>
                        <td className="py-2 px-3 border border-slate-200 text-center text-slate-600 whitespace-nowrap">
                          {formatDate(outRow.date)}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-semibold text-slate-800 whitespace-nowrap">
                          <span className="font-mono text-[#1F4E79] bg-blue-50 px-1.5 py-0.5 rounded text-[11px] font-bold">
                            {outRow.dcNo}
                          </span>
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-medium text-slate-900 whitespace-nowrap">
                          {outRow.colour}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center font-bold text-blue-700 whitespace-nowrap">
                          {outRow.qtyDispatched.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-3 border border-slate-200 text-center text-slate-500 uppercase font-semibold text-[10px] whitespace-nowrap">
                          {outRow.unit}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3 border border-slate-200 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                        <td className="py-2 px-3 border border-slate-200 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                        <td className="py-2 px-3 border border-slate-200 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                        <td className="py-2 px-3 border border-slate-200 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                        <td className="py-2 px-3 border border-slate-200 text-slate-300 italic text-[11px] text-center whitespace-nowrap">—</td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* D. Quantity Summary at the Bottom */}
      <div className="p-5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-t border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            Statement Totals & Balance Reconciliation Summary
            {hasActiveFilters && (
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full normal-case">
                Filtered View
              </span>
            )}
          </span>
          <span className="text-[11px] text-slate-500">
            Strict unit separation (Pieces & Kilograms reconciled independently)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedUnitTotals.map((tot) => {
            const isBalanced = tot.balance === 0 && tot.totalInward > 0;
            return (
              <div
                key={tot.unit}
                className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold uppercase text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1F4E79]"></span>
                    Unit: {tot.unit.toUpperCase()} Summary
                  </span>
                  {isBalanced ? (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      Reconciled (Balance: 0)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      Remaining: {tot.balance.toLocaleString('en-IN')} {tot.unit}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {/* Total Ordered */}
                  <div className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-700 uppercase block">
                      Total Ordered
                    </span>
                    <strong className="text-base font-black text-slate-800">
                      {(tot.totalOrdered || 0).toLocaleString('en-IN')}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">{tot.unit}</span>
                  </div>

                  {/* Total Inward */}
                  <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                      Total Inward
                    </span>
                    <strong className="text-base font-black text-emerald-700">
                      {tot.totalInward.toLocaleString('en-IN')}
                    </strong>
                    <span className="text-[10px] text-emerald-600 block">
                      {tot.orderVsInwardDiff === 0
                        ? '0 Pending (Complete)'
                        : tot.orderVsInwardDiff > 0
                        ? `${tot.orderVsInwardDiff} Pending Inward`
                        : `${Math.abs(tot.orderVsInwardDiff)} Excess Inward`}
                    </span>
                  </div>

                  {/* Total Outward */}
                  <div className="p-2.5 bg-blue-50/60 rounded-lg border border-blue-100">
                    <span className="text-[10px] font-bold text-blue-800 uppercase block">
                      Total Outward
                    </span>
                    <strong className="text-base font-black text-blue-700">
                      {tot.totalOutward.toLocaleString('en-IN')}
                    </strong>
                    <span className="text-[10px] text-blue-600 block">{tot.unit}</span>
                  </div>

                  {/* Dispatch Balance Qty (Inward - Outward) */}
                  <div
                    className={`p-2.5 rounded-lg border ${
                      isBalanced
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-amber-50/60 border-amber-200'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase block ${
                        isBalanced ? 'text-emerald-800' : 'text-amber-800'
                      }`}
                    >
                      Dispatch Balance
                    </span>
                    <strong
                      className={`text-base font-black ${
                        isBalanced ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {tot.balance.toLocaleString('en-IN')}
                    </strong>
                    <span
                      className={`text-[10px] block ${
                        isBalanced ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {isBalanced ? '0 Pending (Ready)' : `${tot.balance} Pending Dispatch`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
