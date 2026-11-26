import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Truck,
  Building2,
  Calendar,
  AlertTriangle,
  RefreshCw,
  PackageCheck,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Vendor } from '../../../types/vendor';
import {
  SamplePoInward,
  CreateSampleOutwardPayload
} from '../../../types/samplePo';
import { SamplePoService } from '../../../services/samplePoService';

interface SampleOutwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (entryNumber: string) => void;
  samplePos: SamplePoInward[];
  vendors: Vendor[];
  user: any;
  isDemoMode: boolean;
  initialInward?: SamplePoInward | null;
}

interface DispatchLineItemState {
  inwardItemId: string;
  itemName: string;
  styleNo: string;
  washType: string;
  unit: string;
  inwardQuantity: number;
  alreadyDispatched: number;
  balanceQuantity: number;
  dispatchQuantity: number | '';
  customerDcNumber: string;
  customerDcDate: string;
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '—';
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch {}
  return dateStr;
}

export const SampleOutwardModal: React.FC<SampleOutwardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  samplePos,
  vendors,
  user,
  isDemoMode,
  initialInward = null
}) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedVendorName, setSelectedVendorName] = useState<string>('');
  const [selectedInwardId, setSelectedInwardId] = useState<string>('');
  const [outwardDcNumber, setOutwardDcNumber] = useState<string>('');
  const [outwardDcDate, setOutwardDcDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState<string>('');
  const [lines, setLines] = useState<DispatchLineItemState[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const getPoVendorKey = (p: SamplePoInward): string => {
    return p.vendorId || `MANUAL_${(p.vendorName || '').trim().toUpperCase()}`;
  };

  const getPoRemainingBalance = (p: SamplePoInward): number => {
    if (p.items && p.items.length > 0) {
      return p.items.reduce(
        (sum, it) => sum + Math.max(0, Number(it.quantity || 0) - Number(it.dispatchedQuantity || 0)),
        0
      );
    }
    return Math.max(0, Number(p.totalQuantity || 0) - Number(p.totalDispatchedQuantity || 0));
  };

  // Only non-cancelled, non-completed Sample POs with remaining balance > 0
  const pendingSamplePos = useMemo(() => {
    return samplePos.filter((p) => {
      if (initialInward && p.id === initialInward.id) return true;
      const status = (p.status || '').toLowerCase();
      const dispatchStatus = (p.dispatchStatus || '').toLowerCase();
      if (status === 'cancelled' || status === 'completed' || dispatchStatus === 'completed') {
        return false;
      }
      return getPoRemainingBalance(p) > 0;
    });
  }, [samplePos, initialInward]);

  // Derive unique companies ONLY from pending Sample POs (including manually entered companies)
  const availableCompanies = useMemo(() => {
    const vendorById = new Map<string, Vendor>();
    vendors.forEach((v) => {
      const vid = v.vendorId || v.id;
      if (vid) vendorById.set(vid, v);
    });

    const map = new Map<string, { id: string; name: string; address?: string; gst?: string }>();
    pendingSamplePos.forEach((p) => {
      const compId = getPoVendorKey(p);
      const compName = (p.vendorName || '').trim();
      if (!compId || !compName || map.has(compId)) return;

      const matchedVendor = p.vendorId ? vendorById.get(p.vendorId) : undefined;
      map.set(compId, {
        id: compId,
        name: compName,
        address:
          p.vendorAddress ||
          (matchedVendor && typeof matchedVendor.address === 'string' ? matchedVendor.address : '') ||
          '',
        gst:
          p.vendorGst ||
          matchedVendor?.taxDetails?.gstin ||
          (matchedVendor as any)?.gstin ||
          ''
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, pendingSamplePos]);

  // Available Sample POs filtered by selected Company (if company selected)
  const eligibleSamplePos = useMemo(() => {
    return pendingSamplePos.filter((p) => {
      if (selectedVendorId) {
        return getPoVendorKey(p) === selectedVendorId;
      }
      return true;
    });
  }, [pendingSamplePos, selectedVendorId]);

  // Selected Inward Record
  const activeInward = useMemo(() => {
    return samplePos.find((p) => p.id === selectedInwardId) || null;
  }, [samplePos, selectedInwardId]);

  // Pre-load from initialInward if provided
  useEffect(() => {
    if (initialInward) {
      setSelectedVendorId(initialInward.vendorId || '');
      setSelectedVendorName(initialInward.vendorName || '');
      setSelectedInwardId(initialInward.id);
    }
  }, [initialInward]);

  // When selectedInwardId changes, populate line items
  useEffect(() => {
    if (!activeInward) {
      setLines([]);
      return;
    }

    // Auto sync vendor if not set
    if (!selectedVendorId && activeInward.vendorId) {
      setSelectedVendorId(activeInward.vendorId);
      setSelectedVendorName(activeInward.vendorName);
    }

    const itemLines: DispatchLineItemState[] = (activeInward.items || []).map((it) => {
      const dispatched = Number(it.dispatchedQuantity || 0);
      const balance = Math.max(0, Number(it.quantity || 0) - dispatched);
      return {
        inwardItemId: it.id,
        itemName: it.itemName || '',
        styleNo: it.styleNo || '',
        washType: it.washType || '',
        unit: it.unit || 'PCS',
        inwardQuantity: Number(it.quantity || 0),
        alreadyDispatched: dispatched,
        balanceQuantity: balance,
        dispatchQuantity: '',
        customerDcNumber: it.customerDcNumber || activeInward.customerDcNumber || '',
        customerDcDate: it.customerDcDate || activeInward.customerDcDate || ''
      };
    });

    setLines(itemLines);
  }, [activeInward, selectedVendorId]);

  // Handle line dispatch qty edit
  const handleLineQtyChange = (inwardItemId: string, valStr: string) => {
    if (valStr === '') {
      setLines((prev) =>
        prev.map((l) => (l.inwardItemId === inwardItemId ? { ...l, dispatchQuantity: '' } : l))
      );
      return;
    }
    const num = Number(valStr);
    if (isNaN(num)) return;

    setLines((prev) =>
      prev.map((l) => {
        if (l.inwardItemId !== inwardItemId) return l;
        const validNum = Math.max(0, Math.min(l.balanceQuantity, num));
        return {
          ...l,
          dispatchQuantity: validNum
        };
      })
    );
  };

  // Total dispatch quantity
  const totalDispatchQty = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(l.dispatchQuantity) || 0), 0);
  }, [lines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedInwardId || !activeInward) {
      setErrorMsg('Please select a valid Sample PO / Inward.');
      return;
    }

    if (!outwardDcNumber.trim()) {
      setErrorMsg('Please enter Outward DC Number.');
      return;
    }

    if (!outwardDcDate.trim()) {
      setErrorMsg('Please select Outward DC Date.');
      return;
    }

    const itemsToDispatch = lines.filter((l) => Number(l.dispatchQuantity) > 0);
    if (itemsToDispatch.length === 0) {
      setErrorMsg('Please enter a dispatch quantity greater than 0 for at least one item line.');
      return;
    }

    // Verify none exceeds balance
    for (const line of itemsToDispatch) {
      if (Number(line.dispatchQuantity) > line.balanceQuantity) {
        setErrorMsg(
          `Dispatch quantity for style "${line.styleNo}" exceeds available balance of ${line.balanceQuantity}.`
        );
        return;
      }
    }

    const comp = availableCompanies.find((c) => c.id === selectedVendorId);

    const payload: CreateSampleOutwardPayload = {
      inwardId: activeInward.id,
      inwardEntryNumber: activeInward.entryNumber,
      vendorId: selectedVendorId || activeInward.vendorId,
      vendorName: selectedVendorName || activeInward.vendorName,
      vendorAddress: comp?.address || activeInward.vendorAddress || '',
      vendorGst: comp?.gst || activeInward.vendorGst || '',
      isManualVendor: activeInward.isManualVendor,
      customerDcNumber: activeInward.customerDcNumber,
      customerDcDate: activeInward.customerDcDate,
      outwardDcNumber: outwardDcNumber.trim(),
      outwardDcDate: outwardDcDate.trim(),
      remarks: remarks.trim(),
      items: itemsToDispatch.map((l) => ({
        inwardItemId: l.inwardItemId,
        itemName: l.itemName,
        styleNo: l.styleNo,
        washType: l.washType,
        quantity: Number(l.dispatchQuantity),
        unit: l.unit,
        rate: 0,
        amount: 0,
        customerDcNumber: l.customerDcNumber,
        customerDcDate: l.customerDcDate
      }))
    };

    try {
      setSaving(true);
      const created = await SamplePoService.createSampleOutward(payload, user, isDemoMode);
      onSuccess(created.entryNumber);
      onClose();
    } catch (err: any) {
      console.error('Failed to create sample outward:', err);
      setErrorMsg(err?.message || 'Failed to save Sample Outward.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Sample Outward (Dispatch)"
      maxWidth="5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[78vh] overflow-y-auto pr-1 text-xs">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Section 1: Selection Cards (Company & Sample PO) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#1F4E79]" />
            <span>Select Customer Company &amp; Sample PO</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Company Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Company / Customer <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedVendorId}
                onChange={(e) => {
                  const vid = e.target.value;
                  setSelectedVendorId(vid);
                  const comp = availableCompanies.find((c) => c.id === vid);
                  setSelectedVendorName(comp ? comp.name : '');
                  // Reset inward if not belonging to this company
                  if (activeInward && getPoVendorKey(activeInward) !== vid) {
                    setSelectedInwardId('');
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="">Select Company...</option>
                {availableCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sample PO Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Sample PO / Inward No <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedInwardId}
                onChange={(e) => {
                  const inwId = e.target.value;
                  setSelectedInwardId(inwId);
                  const inw = pendingSamplePos.find((p) => p.id === inwId);
                  if (inw && !selectedVendorId) {
                    setSelectedVendorId(getPoVendorKey(inw));
                    setSelectedVendorName(inw.vendorName);
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="">Select Sample PO...</option>
                {eligibleSamplePos.map((p) => {
                  const bal = getPoRemainingBalance(p);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.entryNumber} — {p.vendorName} (Inw: {p.totalQuantity}, Bal: {bal})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Inward Meta Banner (Shows once PO is chosen) */}
          {activeInward && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200/80 shadow-2xs">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Inward PO No</span>
                  <span className="font-mono font-bold text-[#1F4E79]">{activeInward.entryNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer DC</span>
                  <span className="font-semibold text-slate-800">
                    {activeInward.customerDcNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer DC Date</span>
                  <span className="font-semibold text-slate-800">
                    {formatDisplayDate(activeInward.customerDcDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Inward Qty</span>
                  <span className="font-mono font-bold text-slate-800">{activeInward.totalQuantity} PCS</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Balance to Dispatch</span>
                  <span className="font-mono font-bold text-amber-700">
                    {Math.max(0, activeInward.totalQuantity - (activeInward.totalDispatchedQuantity || 0))} PCS
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Outward Challan Details (DC No, Date, Remarks) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
          <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-[#1F4E79]" />
            <span>Outward Challan Details</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Outward DC Number */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Outward DC Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={outwardDcNumber}
                onChange={(e) => setOutwardDcNumber(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Outward DC Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Outward DC Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={outwardDcDate}
                onChange={(e) => setOutwardDcDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Remarks
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Inward Data & Dispatch Line Quantities */}
        {activeInward && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                <PackageCheck className="w-3.5 h-3.5 text-[#1F4E79]" />
                <span>Inward Items &amp; Dispatch Allocation ({lines.length} Lines)</span>
              </h4>
              <div className="text-xs font-bold text-slate-700">
                Total Dispatch: <span className="font-mono text-[#1F4E79] font-extrabold">{totalDispatchQty} PCS</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg bg-white">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Style No</th>
                    <th className="py-2.5 px-3">Wash Type</th>
                    <th className="py-2.5 px-3">Customer DC</th>
                    <th className="py-2.5 px-3 text-right">Inward Qty</th>
                    <th className="py-2.5 px-3 text-right">Dispatched</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                    <th className="py-2.5 px-3 text-right min-w-[130px]">
                      Dispatch Qty <span className="text-rose-500">*</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, idx) => {
                    const isExhausted = line.balanceQuantity <= 0;
                    return (
                      <tr
                        key={line.inwardItemId}
                        className={isExhausted ? 'bg-slate-50/60 opacity-60' : 'hover:bg-slate-50/80'}
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-center">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{line.itemName}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">{line.styleNo}</td>
                        <td className="py-2.5 px-3 text-slate-600">{line.washType}</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {line.customerDcNumber}{' '}
                          <span className="text-[10px] text-slate-400 block">
                            {formatDisplayDate(line.customerDcDate)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                          {line.inwardQuantity} {line.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                          {line.alreadyDispatched} {line.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                          {line.balanceQuantity} {line.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            max={line.balanceQuantity}
                            disabled={isExhausted}
                            value={line.dispatchQuantity}
                            onChange={(e) => handleLineQtyChange(line.inwardItemId, e.target.value)}
                            className="w-24 text-right bg-white border border-slate-300 rounded p-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {activeInward ? (
              <span>
                Allocating dispatch for <strong className="text-slate-800">{activeInward.entryNumber}</strong> ({totalDispatchQty} pieces)
              </span>
            ) : (
              <span>Select a Company and Sample PO above to begin dispatch.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving || !activeInward || totalDispatchQty <= 0}
              icon={saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            >
              {saving ? 'Creating Outward...' : 'Confirm & Save Outward'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
