import React, { useState, useMemo } from 'react';
import { PurchaseOrder } from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { InwardEntry } from '../../../types/inward';
import { formatDate } from '../../../utils/formatters';
import { Search, ChevronRight, Package, X, ArrowLeft } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface QuickInwardViewProps {
  pos: PurchaseOrder[];
  inwards: InwardEntry[];
  vendors: Vendor[];
  onSelectPo: (po: PurchaseOrder) => void;
  onBackToTable: () => void;
}

export const QuickInwardView: React.FC<QuickInwardViewProps> = ({
  pos,
  inwards,
  vendors,
  onSelectPo,
  onBackToTable
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Map vendor ID/Code to Vendor for display
  const vendorMap = useMemo(() => {
    const map = new Map<string, Vendor>();
    vendors.forEach((v) => {
      if (v.id) map.set(v.id, v);
      if (v.vendorId) map.set(v.vendorId, v);
    });
    return map;
  }, [vendors]);

  // Compute cumulative posted receipts for each PO line and whole PO
  const poStatsList = useMemo(() => {
    const postedInwards = inwards.filter(
      (inw) => (inw.status || '').toLowerCase() === 'posted'
    );

    return pos
      .filter((p) => {
        const s = (p.status || '').toLowerCase();
        return s !== 'cancelled' && s !== 'completed';
      })
      .map((po) => {
        const poId = po.id || po.poId;
        const poNumber = po.poNumber;

        // Find all posted inwards matching this PO
        const matchingInwards = postedInwards.filter(
          (inw) =>
            (poId && (inw.poId === poId || inw.id === poId)) ||
            (poNumber && (inw.poNumber === poNumber || inw.poNumberSnapshot === poNumber))
        );

        // Lines in PO
        const lines = po.colourLines || po.lines || [];

        let orderedPieces = 0;
        let orderedKg = 0;

        if (po.totalQtyByUnit) {
          orderedPieces = Number(po.totalQtyByUnit.piece || 0);
          orderedKg = Number(po.totalQtyByUnit.kg || 0);
        } else if (lines.length > 0) {
          lines.forEach((l) => {
            const u = (l.unit || '').toLowerCase();
            const q = Number(l.quantity || 0);
            if (u === 'kg') orderedKg += q;
            else orderedPieces += q;
          });
        } else {
          orderedPieces = Number(po.totalQuantity || 0);
        }

        // Calculate received from matching inwards
        let receivedPieces = 0;
        let receivedKg = 0;

        matchingInwards.forEach((inw) => {
          if (inw.lines && inw.lines.length > 0) {
            inw.lines.forEach((line) => {
              const u = (line.unit || '').toLowerCase();
              const q = Number(line.receivedQty || 0);
              if (u === 'kg') receivedKg += q;
              else receivedPieces += q;
            });
          } else if (inw.totalQtyByUnit) {
            receivedPieces += Number(inw.totalQtyByUnit.piece || 0);
            receivedKg += Number(inw.totalQtyByUnit.kg || 0);
          } else {
            receivedPieces += Number(inw.totalQuantity || 0);
          }
        });

        const outstandingPieces = Math.max(0, orderedPieces - receivedPieces);
        const outstandingKg = Math.max(0, orderedKg - receivedKg);

        const totalOrdered = orderedPieces + orderedKg;
        const totalOutstanding = outstandingPieces + outstandingKg;

        const vendor =
          vendorMap.get(po.customerId || '') ||
          vendorMap.get(po.customerVendorId || '');
        const customerName =
          vendor?.companyName ||
          po.customerName ||
          po.customerCompanyNameSnapshot ||
          'Customer';
        const vendorCode = vendor?.vendorId || po.customerCode || '';

        const processType = (po.processCategory || 'WASHING').toUpperCase();

        return {
          po,
          customerName,
          vendorCode,
          processType,
          orderedPieces,
          orderedKg,
          receivedPieces,
          receivedKg,
          outstandingPieces,
          outstandingKg,
          totalOrdered,
          totalOutstanding
        };
      })
      .filter((stat) => stat.totalOutstanding > 0);
  }, [pos, inwards, vendorMap]);

  // Filter based on search query
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return poStatsList;
    const q = searchTerm.toLowerCase();
    return poStatsList.filter((stat) => {
      const p = stat.po;
      return (
        (p.poNumber || '').toLowerCase().includes(q) ||
        (p.styleNo || p.styleNumber || '').toLowerCase().includes(q) ||
        (p.itemName || '').toLowerCase().includes(q) ||
        stat.customerName.toLowerCase().includes(q) ||
        stat.vendorCode.toLowerCase().includes(q)
      );
    });
  }, [poStatsList, searchTerm]);

  // Formatting quantity text
  const formatQtyStr = (pcs: number, kg: number) => {
    if (pcs > 0 && kg > 0) return `${pcs} pcs + ${kg} kg`;
    if (kg > 0) return `${kg} kg`;
    return `${pcs} pcs`;
  };

  return (
    <div className="space-y-4">
      {/* Top Header Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={onBackToTable}
          >
            Back to Inward Receipts
          </Button>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Quick Inward — Select Purchase Order</h2>
            <p className="text-[11px] text-slate-500">
              Showing {filteredList.length} purchase orders ready for inward receipt
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search PO #, Style #, Customer, or Item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent bg-slate-50"
            autoFocus
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid of Cards */}
      {filteredList.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-xl">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No Eligible Purchase Orders Found</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'No purchase orders match your search criteria.'
              : 'All active purchase orders have either been fully received or completed.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredList.map((stat) => {
            const {
              po,
              customerName,
              vendorCode,
              processType,
              orderedPieces,
              orderedKg,
              receivedPieces,
              receivedKg,
              outstandingPieces,
              outstandingKg
            } = stat;

            return (
              <div
                key={po.id || po.poId}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header: PO No & Customer on Left, Ready Badge on Right */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm tracking-tight truncate">
                        {po.poNumber}
                      </div>
                      <div className="text-slate-600 font-medium text-[11px] uppercase tracking-wide truncate">
                        {customerName} {vendorCode ? `(${vendorCode})` : ''}
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      Ready For Inward
                    </span>
                  </div>

                  {/* Item / Style / Process */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="text-slate-700 text-xs truncate">
                      <span className="font-bold text-slate-800">Item: {po.itemName || '—'}</span>
                      <span className="mx-1.5 text-slate-300">•</span>
                      <span className="font-medium text-slate-600">Style: {po.styleNo || po.styleNumber || '—'}</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 uppercase shrink-0">
                      {processType}
                    </span>
                  </div>

                  {/* Metrics Box (Ordered, Received, Outstanding) */}
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 grid grid-cols-3 text-center mb-4">
                    <div className="border-r border-slate-200/80 pr-2">
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                        Ordered
                      </div>
                      <div className="font-bold text-slate-900 text-xs">
                        {formatQtyStr(orderedPieces, orderedKg)}
                      </div>
                    </div>

                    <div className="border-r border-slate-200/80 px-2">
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                        Received
                      </div>
                      <div className="font-bold text-blue-600 text-xs">
                        {formatQtyStr(receivedPieces, receivedKg)}
                      </div>
                    </div>

                    <div className="pl-2">
                      <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">
                        Outstanding
                      </div>
                      <div className="font-bold text-amber-600 text-xs">
                        {formatQtyStr(outstandingPieces, outstandingKg)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer: Order Date & Receive Goods Action */}
                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mt-1">
                  <div className="text-[11px] text-slate-500">
                    Order Date: <span className="font-medium text-slate-700">{formatDate(po.orderDate)}</span>
                  </div>

                  <button
                    onClick={() => onSelectPo(po)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors group cursor-pointer"
                  >
                    <span>Receive Goods</span>
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

