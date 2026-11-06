import React, { useState, useMemo } from 'react';
import { PurchaseOrder } from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { InwardEntry } from '../../../types/inward';
import { Modal } from '../../../components/ui/Modal';
import { formatDate } from '../../../utils/formatters';
import { Search, ChevronRight, ArrowRight, Package, X } from 'lucide-react';

interface QuickInwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  pos: PurchaseOrder[];
  inwards: InwardEntry[];
  vendors: Vendor[];
  onSelectPo: (po: PurchaseOrder) => void;
}

export const QuickInwardModal: React.FC<QuickInwardModalProps> = ({
  isOpen,
  onClose,
  pos,
  inwards,
  vendors,
  onSelectPo
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
    // Only consider posted inwards for official receipts
    const postedInwards = inwards.filter(
      (inw) => (inw.status || '').toLowerCase() === 'posted'
    );

    // Map: poId (or poNumber) -> lines map or totals
    // A PO can have multiple lines with piece and kg
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

        // If totalQtyByUnit is present, use it or calculate from lines
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
            // Fallback to totalQtyByUnit
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

        // Determine vendor details
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
      // Only keep POs that have remaining inward capacity
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

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Inward - Select Purchase Order"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by PO #, Style #, Customer, or Item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent bg-white shadow-2xs"
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

        {/* PO Cards Container */}
        <div className="max-h-[62vh] overflow-y-auto space-y-3 pr-1">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Eligible Purchase Orders Found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'No purchase orders match your search criteria.'
                  : 'All active purchase orders have either been fully received or completed.'}
              </p>
            </div>
          ) : (
            filteredList.map((stat) => {
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

              // Formatting quantity text
              const formatQtyStr = (pcs: number, kg: number) => {
                if (pcs > 0 && kg > 0) return `${pcs} pcs + ${kg} kg`;
                if (kg > 0) return `${kg} kg`;
                return `${pcs} pcs`;
              };

              return (
                <div
                  key={po.id || po.poId}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all text-xs"
                >
                  {/* Top Header: PO No & Customer on Left, Ready Badge on Right */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm tracking-tight">
                        {po.poNumber}
                      </div>
                      <div className="text-slate-600 font-medium text-[11px] uppercase tracking-wide">
                        {customerName} {vendorCode ? `(${vendorCode})` : ''}
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      Ready For Inward
                    </span>
                  </div>

                  {/* Item / Style / Process */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="text-slate-700">
                      <span className="font-bold text-slate-800">Item: {po.itemName || '—'}</span>
                      <span className="mx-1.5 text-slate-300">•</span>
                      <span className="font-medium text-slate-600">Style: {po.styleNo || po.styleNumber || '—'}</span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-slate-100 text-slate-700 uppercase">
                      {processType}
                    </span>
                  </div>

                  {/* Metrics Box (Ordered, Received, Outstanding) */}
                  <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-3 grid grid-cols-3 text-center mb-3">
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

                  {/* Footer: Order Date & Receive Goods Action */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
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
            })
          )}
        </div>
      </div>
    </Modal>
  );
};

