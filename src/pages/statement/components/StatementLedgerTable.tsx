import React from 'react';
import {
  StatementInwardRow,
  StatementOutwardRow,
  StatementUnitTotal
} from '../../../types/statement';
import { formatDate } from '../../../utils/formatters';
import { ArrowDownLeft, ArrowUpRight, Scale, PackageCheck } from 'lucide-react';

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
  const maxRows = Math.max(inwards.length, outwards.length);

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
            {inwards.length} Inward DC(s)
          </span>
          <span className="flex items-center gap-1 text-blue-800">
            <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
            {outwards.length} Outward DC(s)
          </span>
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
                    {inwards.length} transaction(s)
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
                    {outwards.length} transaction(s)
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
                  No transactions recorded yet for this scope. Select a Customer and Purchase Order to view live reconciliation ledger.
                </td>
              </tr>
            ) : (
              Array.from({ length: maxRows }).map((_, idx) => {
                const inRow = inwards[idx];
                const outRow = outwards[idx];
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
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Statement Totals & Balance Reconciliation Summary
          </span>
          <span className="text-[11px] text-slate-500">
            Strict unit separation (Pieces & Kilograms reconciled independently)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {unitTotals.map((tot) => {
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
