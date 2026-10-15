import React from 'react';
import { OutwardDashboardMetrics } from '../../../types/outward';

interface OutwardDashboardProps {
  metrics: OutwardDashboardMetrics;
  onFilterStatus?: (status: string) => void;
}

export const OutwardDashboard: React.FC<OutwardDashboardProps> = ({ metrics, onFilterStatus }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Outward Dispatches */}
      <div
        onClick={() => onFilterStatus?.('all')}
        className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors cursor-pointer"
      >
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Total Outward Dispatches
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{metrics.totalOutwardsCount}</span>
          <span className="text-xs text-slate-400">deliveries</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">All recorded outwards</p>
      </div>

      {/* 2. Pieces Dispatched */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Pieces Dispatched
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {metrics.totalPiecesDispatched.toLocaleString()}
          </span>
          <span className="text-xs font-semibold text-slate-500">pcs</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">From posted dispatches</p>
      </div>

      {/* 3. Fabric / Kg Dispatched */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Fabric / Weight Dispatched
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {metrics.totalKgDispatched.toLocaleString()}
          </span>
          <span className="text-xs font-semibold text-slate-500">kg</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Weight-based dispatches</p>
      </div>

      {/* 4. Workflow Status & Pending Balances */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Workflow Status
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => onFilterStatus?.('posted')}
            className="text-left group"
            title="Filter by Posted"
          >
            <span className="text-2xl font-bold text-slate-900 group-hover:text-[#1F4E79] transition-colors">
              {metrics.postedOutwardsCount}
            </span>
            <span className="text-xs text-slate-500 ml-1">Posted</span>
          </button>
          <span className="text-slate-300">·</span>
          <button
            onClick={() => onFilterStatus?.('draft')}
            className="text-left group"
            title="Filter by Draft"
          >
            <span className="text-2xl font-bold text-slate-900 group-hover:text-[#1F4E79] transition-colors">
              {metrics.draftOutwardsCount}
            </span>
            <span className="text-xs text-slate-500 ml-1">Draft</span>
          </button>
          {metrics.reversedOutwardsCount > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => onFilterStatus?.('reversed')}
                className="text-left group"
                title="Filter by Reversed"
              >
                <span className="text-2xl font-bold text-rose-600 ml-1">
                  {metrics.reversedOutwardsCount}
                </span>
                <span className="text-xs text-slate-500 ml-1">Reversed</span>
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {metrics.totalPiecesAvailableToDispatch.toLocaleString()} pcs pending dispatch
        </p>
      </div>
    </div>
  );
};
