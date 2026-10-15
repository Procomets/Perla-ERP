import React from 'react';
import { InwardDashboardMetrics } from '../../../types/inward';

interface InwardDashboardProps {
  metrics: InwardDashboardMetrics;
  onFilterStatus?: (status: string) => void;
}

export const InwardDashboard: React.FC<InwardDashboardProps> = ({ metrics, onFilterStatus }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Inward Receipts */}
      <div
        onClick={() => onFilterStatus?.('all')}
        className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors cursor-pointer"
      >
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Total Inward Receipts
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{metrics.totalInwardCount}</span>
          <span className="text-xs text-slate-400">deliveries</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">All recorded receipts</p>
      </div>

      {/* 2. Pieces Received */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Pieces Received
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {metrics.totalPiecesReceived.toLocaleString()}
          </span>
          <span className="text-xs font-semibold text-slate-500">pcs</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">From posted transactions</p>
      </div>

      {/* 3. Fabric / Kg Received */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Fabric / Weight Received
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">
            {metrics.totalKgReceived.toLocaleString()}
          </span>
          <span className="text-xs font-semibold text-slate-500">kg</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Weight-based lots</p>
      </div>

      {/* 4. Workflow Status */}
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
              {metrics.postedCount}
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
              {metrics.draftCount}
            </span>
            <span className="text-xs text-slate-500 ml-1">Draft</span>
          </button>
          {metrics.reversedCount > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <button
                onClick={() => onFilterStatus?.('reversed')}
                className="text-left group"
                title="Filter by Reversed"
              >
                <span className="text-2xl font-bold text-rose-600 ml-1">
                  {metrics.reversedCount}
                </span>
                <span className="text-xs text-slate-500 ml-1">Reversed</span>
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1">Posted / Draft / Reversed</p>
      </div>
    </div>
  );
};

