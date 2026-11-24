import React from 'react';
import { PODashboardMetrics } from '../../../types/po';
import { formatCurrency } from '../../../utils/formatters';

interface PODashboardProps {
  metrics: PODashboardMetrics;
  onFilterStatus?: (status: string) => void;
  activeStatusFilter?: string;
}

export const PODashboard: React.FC<PODashboardProps> = ({
  metrics,
  onFilterStatus,
  activeStatusFilter = 'all'
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Purchase Orders */}
      <div
        onClick={() => onFilterStatus?.('all')}
        className={`bg-white p-4 rounded-xl border shadow-2xs hover:border-slate-300 transition-colors cursor-pointer ${
          activeStatusFilter === 'all'
            ? 'border-slate-300'
            : 'border-slate-200'
        }`}
      >
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Total Purchase Orders
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{metrics.totalPOs}</span>
          <span className="text-xs text-slate-400">orders</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">All recorded orders</p>
      </div>

      {/* 2. Pieces Ordered */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Pieces Ordered
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {metrics.totalPieces.toLocaleString('en-IN')}
          </span>
          <span className="text-xs font-semibold text-slate-500">pcs</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">From active purchase orders</p>
      </div>

      {/* 3. Fabric / Weight & Value */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Fabric / Weight Ordered
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {metrics.totalKg.toLocaleString('en-IN')}
          </span>
          <span className="text-xs font-semibold text-slate-500">kg</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {metrics.totalOrderValue > 0
            ? `Weight-based lots · ${formatCurrency(metrics.totalOrderValue)}`
            : 'Weight-based lots'}
        </p>
      </div>

      {/* 4. Workflow Status */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Workflow Status
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onFilterStatus?.('approved')}
            className="text-left group cursor-pointer"
            title="Filter by Approved"
          >
            <span
              className={`text-2xl font-bold transition-colors ${
                (activeStatusFilter || '').toLowerCase() === 'approved'
                  ? 'text-[#1F4E79]'
                  : 'text-slate-900 group-hover:text-[#1F4E79]'
              }`}
            >
              {metrics.approvedPOs}
            </span>
            <span className="text-xs text-slate-500 ml-1">Approved</span>
          </button>

          <span className="text-slate-300">·</span>

          <button
            type="button"
            onClick={() => onFilterStatus?.('draft')}
            className="text-left group cursor-pointer"
            title="Filter by Draft"
          >
            <span
              className={`text-2xl font-bold transition-colors ${
                (activeStatusFilter || '').toLowerCase() === 'draft'
                  ? 'text-[#1F4E79]'
                  : 'text-slate-900 group-hover:text-[#1F4E79]'
              }`}
            >
              {metrics.draftPOs}
            </span>
            <span className="text-xs text-slate-500 ml-1">Draft</span>
          </button>

          {metrics.cancelledPOs > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => onFilterStatus?.('cancelled')}
                className="text-left group cursor-pointer"
                title="Filter by Cancelled"
              >
                <span
                  className={`text-2xl font-bold transition-colors ${
                    (activeStatusFilter || '').toLowerCase() === 'cancelled'
                      ? 'text-rose-700'
                      : 'text-rose-600 group-hover:text-rose-700'
                  }`}
                >
                  {metrics.cancelledPOs}
                </span>
                <span className="text-xs text-slate-500 ml-1">Cancelled</span>
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">Approved / Draft / Cancelled</p>
      </div>
    </div>
  );
};
