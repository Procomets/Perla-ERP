import React, { useState, useEffect } from 'react';
import { MasterItem, ItemAuditLog } from '../../../types/item';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { StatusChip } from '../../../components/ui/StatusChip';
import { ItemService } from '../../../services/itemService';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import {
  Package,
  FlaskConical,
  Flame,
  Boxes,
  Warehouse,
  ShieldAlert,
  Building2,
  Clock,
  History,
  Tag,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText
} from 'lucide-react';

interface ItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MasterItem | null;
  onEdit?: (item: MasterItem) => void;
  onDeactivate?: (item: MasterItem) => void;
  onReactivate?: (item: MasterItem) => void;
  isAdminOrManager?: boolean;
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  isOpen,
  onClose,
  item,
  onEdit,
  onDeactivate,
  onReactivate,
  isAdminOrManager = false
}) => {
  const [activeTab, setActiveTab] = useState<'specs' | 'chemical' | 'stock' | 'history'>('specs');
  const [auditLogs, setAuditLogs] = useState<ItemAuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (item && isOpen) {
      setLoadingLogs(true);
      ItemService.getAuditLogs(item.id)
        .then((logs) => setAuditLogs(logs))
        .catch(() => setAuditLogs([]))
        .finally(() => setLoadingLogs(false));
    }
  }, [item, isOpen]);

  if (!item) return null;

  const isLowStock = (item.currentStock || 0) <= (item.reorderLevel || 0);
  const isChemical = item.itemType === 'chemical';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" maxWidth="2xl">
      <div className="space-y-5">
        {/* Header Strip */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-sm ${
                item.itemType === 'chemical'
                  ? 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                  : item.itemType === 'firewood'
                  ? 'bg-gradient-to-tr from-amber-600 to-orange-600'
                  : item.itemType === 'raw_material'
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-600'
                  : 'bg-gradient-to-tr from-[#1F4E79] to-[#2B6CB0]'
              }`}
            >
              {item.itemType === 'chemical' ? (
                <FlaskConical className="w-6 h-6" />
              ) : item.itemType === 'firewood' ? (
                <Flame className="w-6 h-6" />
              ) : item.itemType === 'raw_material' ? (
                <Boxes className="w-6 h-6" />
              ) : (
                <Package className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">{item.itemName}</h3>
                <StatusChip
                  status={item.status === 'active' ? 'Active' : 'Inactive'}
                  variant={item.status === 'active' ? 'green' : 'slate'}
                />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                <span className="font-bold text-[#1F4E79] tracking-wider font-mono">{item.itemCode}</span>
                <span>•</span>
                <span>{item.categoryName}</span>
                {item.storageLocation && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Warehouse className="w-3 h-3 text-slate-400" />
                      {item.storageLocation}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdminOrManager && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onEdit?.(item);
                  }}
                >
                  Edit Item
                </Button>
                {item.status === 'active' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={() => {
                      onClose();
                      onDeactivate?.(item);
                    }}
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => {
                      onClose();
                      onReactivate?.(item);
                    }}
                    icon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Reactivate
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === 'specs'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Specifications
          </button>

          {isChemical && (
            <button
              type="button"
              onClick={() => setActiveTab('chemical')}
              className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === 'chemical'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Chemical & Safety
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'stock'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            Stock Ledger
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-[#1F4E79] text-[#1F4E79]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Audit Trail
          </button>
        </div>

        {/* TAB 1: SPECIFICATIONS */}
        {activeTab === 'specs' && (
          <div className="space-y-4 text-xs">
            {item.description && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
                <span className="font-bold text-slate-900 block mb-0.5">Description & Purpose:</span>
                <p>{item.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Base Unit of Measure
                </span>
                <span className="font-bold text-slate-800 text-sm">{item.baseUnit}</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Standard Rate
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {item.defaultPurchaseRate ? formatCurrency(item.defaultPurchaseRate) : 'N/A'}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  HSN / GST Code
                </span>
                <span className="font-bold text-slate-800 text-sm">{item.hsnCode || 'N/A'}</span>
                {item.taxRatePercent !== undefined && (
                  <span className="text-[11px] text-slate-500 block">GST: {item.taxRatePercent}%</span>
                )}
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Reorder Threshold
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {item.reorderLevel} {item.baseUnit}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Minimum Buffer Stock
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {item.minimumStockLevel} {item.baseUnit}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Storage Location
                </span>
                <span className="font-bold text-slate-800 text-sm">{item.storageLocation || 'Factory Yard'}</span>
              </div>
            </div>

            {/* Supplier Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1F4E79]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Preferred Supplier (Vendor Master)
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {item.preferredSupplierName || 'Direct / Multi-Supplier Procurement'}
                  </span>
                  {item.supplierItemCode && (
                    <span className="text-[11px] text-slate-500 block">Supplier Code: {item.supplierItemCode}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CHEMICAL SAFETY */}
        {activeTab === 'chemical' && isChemical && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Chemical Specification Sheet:</span>
                <span>
                  {item.chemicalDetails?.chemicalCategory} • {item.chemicalDetails?.chemicalGrade}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Manufacturer / Brand
                </span>
                <span className="font-bold text-slate-800">
                  {item.chemicalDetails?.manufacturer || 'N/A'} {item.chemicalDetails?.brand ? `(${item.chemicalDetails.brand})` : ''}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Working pH Range
                </span>
                <span className="font-bold text-slate-800">{item.chemicalDetails?.phRange || '6.0 - 7.5'}</span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Shelf Life
                </span>
                <span className="font-bold text-slate-800">{item.chemicalDetails?.shelfLife || '12 Months'}</span>
              </div>
            </div>

            {/* Safety instructions */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">Safety & First Aid Instructions:</span>
                <p className="text-slate-600">
                  {item.chemicalDetails?.safetyInstructions || 'Standard textile chemical handling protocols apply.'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900 block mb-0.5">PPE & Handling Precautions:</span>
                <p className="text-slate-600">
                  {item.chemicalDetails?.handlingPrecautions || 'Wear rubber gloves and safety goggles.'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900 block mb-0.5">Storage Instructions:</span>
                <p className="text-slate-600">
                  {item.chemicalDetails?.storageInstructions || 'Store in cool, dry ventilated chemical warehouse.'}
                </p>
              </div>
            </div>

            <div className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Batch/Lot Tracking: {item.chemicalDetails?.batchTrackingRequired ? 'Enforced' : 'Optional'}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Expiry Enforcement: {item.chemicalDetails?.expiryTrackingRequired ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: STOCK SUMMARY */}
        {activeTab === 'stock' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Current Warehouse Balance
                </span>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-black ${
                      isLowStock ? 'text-amber-600' : 'text-emerald-700'
                    }`}
                  >
                    {item.currentStock || 0}
                  </span>
                  <span className="text-sm font-bold text-slate-500">{item.baseUnit}</span>
                </div>
              </div>

              <div>
                <StatusChip
                  status={isLowStock ? 'Low Stock Warning' : 'Stock Optimal'}
                  variant={isLowStock ? 'amber' : 'green'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Reorder Level Threshold
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {item.reorderLevel} {item.baseUnit}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Buffer Reserve
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {item.minimumStockLevel} {item.baseUnit}
                </span>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs">
              <span className="font-bold block mb-0.5">Authoritative Ledger Notice:</span>
              <span>
                All stock additions occur strictly via Raw Material/Firewood Purchase Receipts, and deductions occur
                via Chemical Entry or Dispatch modules.
              </span>
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3 text-xs">
            {loadingLogs ? (
              <div className="text-center py-6 text-slate-400">Loading audit history...</div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-6 text-slate-400">No modification events logged for this item.</div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div key={log.auditId || log.id} className="p-3 rounded-xl border border-slate-200 bg-white">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-900">{log.summary}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{formatDate(log.changedAt)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      By: <span className="font-semibold text-slate-700">{log.changedByName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
