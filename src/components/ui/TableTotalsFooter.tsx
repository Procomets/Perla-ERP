import React from 'react';
import { formatCurrency, formatQuantity } from '../../utils/formatters';

export interface TableTotalsCell {
  colSpan?: number;
  label?: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  // Multi-unit quantity support (pieces and/or kg)
  pieces?: number;
  kgs?: number;
  quantity?: number;
  unit?: string;
  // Currency total support
  currency?: number;
  // Custom content override
  content?: React.ReactNode;
  value?: React.ReactNode;
  // Highlight cell with blue accent
  isTotal?: boolean;
  className?: string;
}

export interface TableTotalsFooterProps {
  cells: TableTotalsCell[];
  className?: string;
}

/**
 * Reusable Sticky Totals Footer Component for Perla ERP tables.
 * Pinned to the bottom of the table viewport (sticky bottom-0 z-20).
 * Supports:
 * - Summary label column (colSpan)
 * - Multi-unit quantities (pieces & kgs rendered on separate lines)
 * - Currency totals formatted with INR symbol
 * - Non-summable columns (clean dash placeholder)
 */
export const TableTotalsFooter: React.FC<TableTotalsFooterProps> = ({
  cells,
  className = ''
}) => {
  return (
    <tfoot
      className={`sticky bottom-0 z-20 bg-slate-100 shadow-[0_-2px_4px_rgba(0,0,0,0.06)] border-t-2 border-slate-300 text-xs ${className}`}
    >
      <tr className="bg-[#EEF5FB] text-slate-800 font-bold border-t-2 border-slate-300">
        {cells.map((cell, idx) => {
          const isRight =
            cell.align === 'right' ||
            cell.currency !== undefined ||
            cell.quantity !== undefined ||
            cell.pieces !== undefined ||
            cell.kgs !== undefined;
          const isCenter = cell.align === 'center';
          const alignClass = isRight ? 'text-right' : isCenter ? 'text-center' : 'text-left';
          const bgClass = cell.isTotal ? 'bg-blue-100/60' : 'bg-[#EEF5FB]';
          const isLast = idx === cells.length - 1;

          let content = cell.content !== undefined ? cell.content : cell.value;
          if (content === undefined) {
            if (cell.pieces !== undefined || cell.kgs !== undefined) {
              const pcs = cell.pieces || 0;
              const kg = cell.kgs || 0;
              if (pcs > 0 && kg > 0) {
                content = (
                  <div className="text-right">
                    <div className="font-extrabold text-[#1F4E79] whitespace-nowrap">
                      {formatQuantity(pcs, 'piece')}
                    </div>
                    <div className="text-[11px] font-bold text-slate-700 whitespace-nowrap mt-0.5">
                      {formatQuantity(kg, 'kg')}
                    </div>
                  </div>
                );
              } else if (kg > 0) {
                content = (
                  <div className="font-extrabold text-[#1F4E79] whitespace-nowrap">
                    {formatQuantity(kg, 'kg')}
                  </div>
                );
              } else {
                content = (
                  <div className="font-extrabold text-[#1F4E79] whitespace-nowrap">
                    {formatQuantity(pcs, cell.unit || 'piece')}
                  </div>
                );
              }
            } else if (cell.currency !== undefined) {
              content = (
                <span className="font-extrabold text-[#1F4E79] whitespace-nowrap font-mono">
                  {formatCurrency(cell.currency)}
                </span>
              );
            } else if (cell.quantity !== undefined) {
              content = (
                <span className="font-extrabold text-[#1F4E79] whitespace-nowrap font-mono">
                  {formatQuantity(cell.quantity, cell.unit || 'piece')}
                </span>
              );
            } else if (cell.label !== undefined) {
              content = (
                <span className="uppercase tracking-wider text-[11px] font-extrabold text-[#1F4E79]">
                  {cell.label}
                </span>
              );
            } else {
              content = <span className="text-slate-400">—</span>;
            }
          }

          return (
            <td
              key={idx}
              colSpan={cell.colSpan}
              style={{ backgroundColor: cell.isTotal ? '#DBEAFE' : '#EEF5FB' }}
              className={`py-2.5 px-3.5 border-r border-t-2 border-slate-300 ${alignClass} ${bgClass} sticky bottom-0 z-20 whitespace-nowrap font-mono shadow-[0_-1px_3px_rgba(0,0,0,0.05)] ${
                isLast ? 'pr-12 border-r-0' : ''
              } ${cell.className || ''}`}
            >
              {content}
            </td>
          );
        })}
      </tr>
    </tfoot>
  );
};
