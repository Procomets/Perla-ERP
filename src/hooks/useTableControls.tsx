import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | 'normal';

export interface TableColumnConfig<T> {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date';
  getValue?: (item: T) => any;
}

export interface UseTableControlsOptions<T> {
  columns: TableColumnConfig<T>[];
  defaultSortField?: string | null;
  defaultSortDirection?: SortDirection;
}

/**
 * Standard reusable table controls hook for Perla ERP tables.
 * Provides:
 * - 3-State Column Sorting (Ascending -> Descending -> Normal / Unsorted)
 * - Column-Wise Search Bar with column selector dropdown
 * - Inline Column-By-Column Filter inputs with toggle and clear
 * - Filter active status detection and master Reset functionality
 */
export function useTableControls<T>(data: T[], options: UseTableControlsOptions<T>) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchColumn, setSearchColumn] = useState<string>('ALL');
  const [showColumnFilters, setShowColumnFilters] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortField, setSortField] = useState<string | null>(options.defaultSortField ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(options.defaultSortDirection ?? 'normal');

  // 3-state sorting cycle: Default Direction -> Opposite Direction -> Normal (Unsorted)
  const handleSort = (field: string) => {
    const col = options.columns.find((c) => c.key === field);
    const isNumericOrDate = col?.type === 'number' || col?.type === 'date';
    const firstDirection: SortDirection = isNumericOrDate ? 'desc' : 'asc';
    const secondDirection: SortDirection = isNumericOrDate ? 'asc' : 'desc';

    if (sortField !== field || sortDirection === 'normal') {
      setSortField(field);
      setSortDirection(firstDirection);
    } else if (sortDirection === firstDirection) {
      setSortDirection(secondDirection);
    } else {
      setSortField(null);
      setSortDirection('normal');
    }
  };

  // Helper to render sort icon in column headers
  const renderSortIcon = (field: string) => {
    const isCurrent = sortField === field && sortDirection !== 'normal';
    return (
      <span
        className={`inline-flex items-center transition-colors shrink-0 ml-1 ${
          isCurrent ? 'text-slate-900 font-bold' : 'text-slate-400 opacity-60 group-hover:opacity-100'
        }`}
        title={
          sortField === field && sortDirection === 'asc'
            ? 'Sorted ascending (click to sort descending or reset to normal)'
            : sortField === field && sortDirection === 'desc'
            ? 'Sorted descending (click to reset to normal)'
            : 'Click to sort'
        }
      >
        {isCurrent ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3" />
        )}
      </span>
    );
  };

  // Check if any filter or custom sort is currently applied
  const isAnyFilterActive = useMemo(() => {
    return (
      searchQuery.trim() !== '' ||
      searchColumn !== 'ALL' ||
      Object.values(columnFilters).some((v) => (v || '').trim() !== '') ||
      (sortField !== null && sortDirection !== 'normal')
    );
  }, [searchQuery, searchColumn, columnFilters, sortField, sortDirection]);

  // Master reset for search, column filters, and sorting
  const handleResetFilters = () => {
    setSearchQuery('');
    setSearchColumn('ALL');
    setColumnFilters({});
    setSortField(null);
    setSortDirection('normal');
  };

  // Filter data based on search bar query & individual column filters
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // 1. Search Bar Query
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        if (searchColumn === 'ALL') {
          const matchesAny = options.columns.some((col) => {
            const rawVal = col.getValue ? col.getValue(item) : (item as any)[col.key];
            if (rawVal === undefined || rawVal === null) return false;
            return String(rawVal).toLowerCase().includes(q);
          });
          if (!matchesAny) return false;
        } else {
          const col = options.columns.find((c) => c.key === searchColumn);
          if (col) {
            const rawVal = col.getValue ? col.getValue(item) : (item as any)[col.key];
            if (rawVal === undefined || rawVal === null) return false;
            if (!String(rawVal).toLowerCase().includes(q)) return false;
          }
        }
      }

      // 2. Inline Column Filters
      for (const [colKey, colVal] of Object.entries(columnFilters)) {
        const val = (colVal || '').trim().toLowerCase();
        if (!val) continue;

        const col = options.columns.find((c) => c.key === colKey);
        const rawVal = col && col.getValue ? col.getValue(item) : (item as any)[colKey];
        if (rawVal === undefined || rawVal === null) return false;
        if (!String(rawVal).toLowerCase().includes(val)) return false;
      }

      return true;
    });
  }, [data, searchQuery, searchColumn, columnFilters, options.columns]);

  // Sort filtered data based on active sort field & direction
  const processedData = useMemo(() => {
    if (!sortField || sortDirection === 'normal') {
      return filteredData;
    }

    const col = options.columns.find((c) => c.key === sortField);
    return [...filteredData].sort((a, b) => {
      const valA = col && col.getValue ? col.getValue(a) : (a as any)[sortField];
      const valB = col && col.getValue ? col.getValue(b) : (b as any)[sortField];

      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      if (col?.type === 'number') {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      const strA = String(valA);
      const strB = String(valB);
      const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortField, sortDirection, options.columns]);

  return {
    // State
    searchQuery,
    setSearchQuery,
    searchColumn,
    setSearchColumn,
    showColumnFilters,
    setShowColumnFilters,
    columnFilters,
    setColumnFilters,
    sortField,
    sortDirection,

    // Handlers & Helpers
    handleSort,
    renderSortIcon,
    handleResetFilters,
    isAnyFilterActive,

    // Data
    processedData,
    totalCount: data.length,
    filteredCount: processedData.length
  };
}
