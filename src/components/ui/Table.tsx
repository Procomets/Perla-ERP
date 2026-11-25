import React from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records found',
  onRowClick
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto bg-white rounded-xl">
      <table className="w-full text-left text-xs text-slate-700 border-collapse">
        <thead className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider sticky top-0 z-10 border-b-2 border-slate-300 text-[11px]">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={`px-5 py-3 border-r border-slate-200 last:border-r-0 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-medium">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-400 font-normal">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick && onRowClick(row)}
                className={`hover:bg-slate-50 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                <td colSpan={0} className="hidden"></td>
                {columns.map((col, cIdx) => (
                  <td key={cIdx} className={`px-5 py-3.5 whitespace-nowrap text-slate-800 ${col.className || ''}`}>
                    {typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : (row[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
