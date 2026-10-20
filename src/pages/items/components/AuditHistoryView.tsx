import React, { useState, useEffect } from 'react';
import { ItemAuditLog } from '../../../types/item';
import { Table, Column } from '../../../components/ui/Table';
import { formatDate } from '../../../utils/formatters';
import { ItemService } from '../../../services/itemService';
import { History, Search, UserCheck } from 'lucide-react';

export const AuditHistoryView: React.FC = () => {
  const [logs, setLogs] = useState<ItemAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    ItemService.getAuditLogs()
      .then((data) => setLogs(data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(
    (l) =>
      l.summary?.toLowerCase().includes(search.toLowerCase()) ||
      l.itemCode?.toLowerCase().includes(search.toLowerCase()) ||
      l.changedByName?.toLowerCase().includes(search.toLowerCase())
  );

  const columns: Column<ItemAuditLog>[] = [
    {
      header: 'Timestamp',
      accessor: (row) => (
        <span className="text-xs text-slate-500 font-mono">{formatDate(row.changedAt)}</span>
      )
    },
    {
      header: 'Action Taken',
      accessor: (row) => {
        const badgeColors: Record<string, string> = {
          created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          updated: 'bg-blue-50 text-blue-700 border-blue-200',
          deactivated: 'bg-rose-50 text-rose-700 border-rose-200',
          reactivated: 'bg-purple-50 text-purple-700 border-purple-200'
        };
        const color = badgeColors[row.action] || 'bg-slate-100 text-slate-700 border-slate-200';
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border uppercase ${color}`}>
            {row.action}
          </span>
        );
      }
    },
    {
      header: 'Item Code',
      accessor: (row) => (
        <span className="font-bold text-[#1F4E79] font-mono text-xs">{row.itemCode}</span>
      )
    },
    {
      header: 'Event Summary',
      accessor: (row) => (
        <span className="text-xs text-slate-800 font-medium">{row.summary}</span>
      )
    },
    {
      header: 'Authorized User',
      accessor: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-700">
          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.changedByName || 'Authorized Staff'}</span>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-[#1F4E79]" />
            Item Master Audit Trail & Change Log
          </h3>
          <p className="text-xs text-slate-500">
            Immutable log of all item creations, specification revisions, and deactivations
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit trail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:bg-white focus:ring-2 focus:ring-[#1F4E79]/20"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading audit history...</div>
        ) : (
          <Table columns={columns} data={filtered} keyExtractor={(row) => row.auditId || row.id || ''} />
        )}
      </div>
    </div>
  );
};
