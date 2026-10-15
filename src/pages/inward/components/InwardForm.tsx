import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PurchaseOrder } from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { InwardEntry, InwardLine } from '../../../types/inward';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { formatQuantity, formatDate } from '../../../utils/formatters';
import { InwardService } from '../../../services/inwardService';
import { SearchableSelect, SelectOption, SelectOptionGroup } from './SearchableSelect';
import {
  ArrowLeft,
  CheckCircle2,
  FileClock,
  AlertTriangle,
  Info,
  Building,
  Layers,
  Calendar,
  FileText
} from 'lucide-react';

interface InwardFormProps {
  pos: PurchaseOrder[];
  vendors: Vendor[];
  initialInward?: InwardEntry | null;
  onSaveDraft: (data: any) => Promise<void>;
  onPostReceipt: (data: any) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export const InwardForm: React.FC<InwardFormProps> = ({
  pos,
  vendors,
  initialInward,
  onSaveDraft,
  onPostReceipt,
  onCancel,
  isSaving
}) => {
  // Filter eligible POs: approved, in_progress, partially_received, or previously assigned
  const eligiblePos = useMemo(() => {
    return pos.filter((p) => {
      const s = String(p.status || '').toLowerCase();
      return (
        s === 'approved' ||
        s === 'in_progress' ||
        s === 'partially_received' ||
        (initialInward && (p.id === initialInward.poId || p.poId === initialInward.poId))
      );
    });
  }, [pos, initialInward]);

  // Active customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialInward?.customerVendorId || initialInward?.customerId || ''
  );

  // Active PO selection
  const [selectedPoId, setSelectedPoId] = useState<string>(
    initialInward?.poId || ''
  );

  // Active Subcontractor selection
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>(
    initialInward?.subcontractorVendorId || initialInward?.subContractorId || ''
  );

  // Delivery Challan Details
  const [customerDcNo, setCustomerDcNo] = useState<string>(
    initialInward?.customerDcNo || ''
  );
  const [customerDate, setCustomerDate] = useState<string>(
    initialInward?.customerDate || new Date().toISOString().split('T')[0]
  );
  const [inwardDate, setInwardDate] = useState<string>(
    initialInward?.inwardDate || new Date().toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState<string>(initialInward?.remarks || '');

  // Line quantities entered by user: { [poLineId]: number }
  const [receivedQtyMap, setReceivedQtyMap] = useState<Record<string, number>>({});

  // Cumulative posted inward map: { [poLineId]: number }
  const [cumulativeMap, setCumulativeMap] = useState<Record<string, number>>({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Active customer vendors
  const eligibleCustomers = useMemo(() => {
    return vendors.filter((v) => v.vendorType === 'customer' || v.vendorType === 'both');
  }, [vendors]);

  // Find currently selected PO
  const activePo = useMemo(() => {
    return pos.find((p) => p.id === selectedPoId || p.poId === selectedPoId);
  }, [pos, selectedPoId]);

  // Find eligible subcontractors for the selected customer
  const eligibleSubcontractors = useMemo(() => {
    if (!selectedCustomerId) return [];
    return vendors.filter(
      (v) =>
        v.parentVendorId === selectedCustomerId ||
        (v.vendorCategory === 'subcontractor' || v.vendorCategory === 'subcompany')
    );
  }, [vendors, selectedCustomerId]);

  // If customer is selected, filter POs belonging to that customer
  const customerPOs = useMemo(() => {
    if (!selectedCustomerId) return eligiblePos;
    return eligiblePos.filter(
      (p) =>
        p.customerId === selectedCustomerId ||
        p.customerVendorId === selectedCustomerId
    );
  }, [eligiblePos, selectedCustomerId]);

  // Set default customer / PO once on mount if not set
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!selectedPoId && customerPOs.length > 0) {
      const firstPo = customerPOs[0];
      setSelectedPoId(firstPo.id || firstPo.poId);
      const cId = firstPo.customerId || firstPo.customerVendorId || '';
      setSelectedCustomerId(cId);
      hasInitializedRef.current = true;
    }
  }, [customerPOs, selectedPoId]);

  // Customer selection groups for SearchableSelect
  const customerSelectGroups: SelectOptionGroup[] = useMemo(() => {
    return [
      {
        title: 'Eligible Customer Companies',
        options: eligibleCustomers.map((c) => ({
          id: c.vendorId || c.id || '',
          primaryText: c.companyName,
          secondaryText: c.address?.city ? `${c.address.city}, ${c.address.state || ''}` : undefined,
          badge: c.vendorCode || 'VND',
          badgeVariant: 'blue' as const,
          meta: c
        }))
      }
    ];
  }, [eligibleCustomers]);

  // Subcontractor selection groups for SearchableSelect
  const subcontractorSelectGroups: SelectOptionGroup[] = useMemo(() => {
    const list: SelectOption[] = [
      {
        id: '',
        primaryText: '— Direct Delivery / None —',
        secondaryText: 'Deliver directly from customer'
      },
      ...eligibleSubcontractors.map((s) => ({
        id: s.vendorId || s.id || '',
        primaryText: s.companyName,
        badge: s.vendorCode || 'SUB',
        badgeVariant: 'slate' as const,
        meta: s
      }))
    ];

    return [
      {
        title: eligibleSubcontractors.length > 0 ? 'Assigned Subcontractors / Units' : undefined,
        options: list
      }
    ];
  }, [eligibleSubcontractors]);

  // Purchase Order selection groups (supports search by PO # and Style #, with cross-company discovery)
  const poSelectGroups: SelectOptionGroup[] = useMemo(() => {
    if (selectedCustomerId) {
      const companyPOs = eligiblePos.filter(
        (p) => p.customerId === selectedCustomerId || p.customerVendorId === selectedCustomerId
      );
      const otherPOs = eligiblePos.filter(
        (p) => p.customerId !== selectedCustomerId && p.customerVendorId !== selectedCustomerId
      );

      const currentCompanyName =
        eligibleCustomers.find((c) => (c.vendorId || c.id) === selectedCustomerId)?.companyName ||
        'Selected Company';

      const groups: SelectOptionGroup[] = [];

      groups.push({
        title: `POs for ${currentCompanyName} (${companyPOs.length})`,
        options: companyPOs.map((p) => {
          const pId = p.id || p.poId || '';
          const sNo = p.styleNo || p.styleNumber || '—';
          return {
            id: pId,
            primaryText: `${p.poNumber} — Style: ${sNo}`,
            secondaryText: `${p.itemName} • ${String(p.processCategory || '').toUpperCase()} • Ordered: ${formatDate(p.orderDate)}`,
            badge: `${p.totalQuantity?.toLocaleString() || ''} ${p.lines?.[0]?.unit || 'pcs'}`,
            badgeVariant: 'slate' as const,
            meta: p
          };
        })
      });

      if (otherPOs.length > 0) {
        groups.push({
          title: `POs from other companies (${otherPOs.length})`,
          isHighlighted: true,
          options: otherPOs.map((p) => {
            const pId = p.id || p.poId || '';
            const sNo = p.styleNo || p.styleNumber || '—';
            const cName = p.customerCompanyNameSnapshot || p.customerName || 'Other Company';
            return {
              id: pId,
              primaryText: `${p.poNumber} — Style: ${sNo}`,
              secondaryText: `${p.itemName} • Company: ${cName}`,
              badge: cName,
              badgeVariant: 'amber' as const,
              meta: p
            };
          })
        });
      }

      return groups;
    }

    // When no company is selected, show all POs
    return [
      {
        title: `All Available Purchase Orders (${eligiblePos.length})`,
        options: eligiblePos.map((p) => {
          const pId = p.id || p.poId || '';
          const sNo = p.styleNo || p.styleNumber || '—';
          const cName = p.customerCompanyNameSnapshot || p.customerName || 'Client';
          return {
            id: pId,
            primaryText: `${p.poNumber} — Style: ${sNo}`,
            secondaryText: `${p.itemName} • Company: ${cName}`,
            badge: cName,
            badgeVariant: 'blue' as const,
            meta: p
          };
        })
      }
    ];
  }, [eligiblePos, selectedCustomerId, eligibleCustomers]);

  // Synchronize customer when PO changes
  const handlePoChange = (poId: string) => {
    setSelectedPoId(poId);
    const matchedPo = pos.find((p) => p.id === poId || p.poId === poId);
    if (matchedPo) {
      const cId = matchedPo.customerId || matchedPo.customerVendorId || '';
      setSelectedCustomerId(cId);
      if (matchedPo.subcontractorId) {
        setSelectedSubcontractorId(matchedPo.subcontractorId);
      }
    }
    setValidationError(null);
  };

  const handleSelectPo = (opt: SelectOption) => {
    const po = opt.meta as PurchaseOrder | undefined;
    if (!po) return;

    const poId = po.id || po.poId;
    setSelectedPoId(poId);

    // If PO belongs to another company, automatically switch customer to this PO's company!
    const targetCustomerId = po.customerId || po.customerVendorId || '';
    if (targetCustomerId && targetCustomerId !== selectedCustomerId) {
      setSelectedCustomerId(targetCustomerId);
      if (po.subcontractorId) {
        setSelectedSubcontractorId(po.subcontractorId);
      } else {
        setSelectedSubcontractorId('');
      }
    } else if (po.subcontractorId) {
      setSelectedSubcontractorId(po.subcontractorId);
    }

    setValidationError(null);
  };

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    // Find if current PO belongs to this customer; if not, pick the first PO of that customer
    const validPOs = eligiblePos.filter(
      (p) => p.customerId === customerId || p.customerVendorId === customerId
    );
    if (validPOs.length > 0) {
      setSelectedPoId(validPOs[0].id || validPOs[0].poId);
    } else {
      setSelectedPoId('');
    }
    setSelectedSubcontractorId('');
    setValidationError(null);
  };

  const handleSelectCustomer = (opt: SelectOption) => {
    handleCustomerChange(opt.id);
  };

  const handleSelectSubcontractor = (opt: SelectOption) => {
    setSelectedSubcontractorId(opt.id);
  };

  const handleQtyChange = (lineId: string, val: number, maxAvailable: number) => {
    const cleanVal = Math.max(0, isNaN(val) ? 0 : val);
    setReceivedQtyMap((prev) => ({ ...prev, [lineId]: cleanVal }));
    setValidationError(null);
  };

  // Calculated totals grouped separately by Unit (Piece and Kg never summed together!)
  const lineDetails = useMemo(() => {
    if (!activePo) return [];
    const lines = activePo.colourLines || activePo.lines || [];

    return lines.map((l, idx) => {
      const lineId = l.id || l.lineId;
      const ordered = Math.max(0, Number(l.quantity) || 0);
      const prev = Math.max(0, cumulativeMap[lineId] || 0);
      const remaining = Math.max(0, ordered - prev);
      const current = Math.max(0, Number(receivedQtyMap[lineId] ?? 0));
      const cumulative = prev + current;
      const balanceAfter = Math.max(0, ordered - cumulative);
      const isOver = current > remaining;

      return {
        sNo: idx + 1,
        lineId,
        colourName: l.colourName,
        colourCode: l.colourCode,
        itemName: l.itemName || activePo.itemName,
        processType: l.processType || 'Softener Wash',
        orderedQty: ordered,
        unit: l.unit || 'piece',
        previouslyReceivedQty: prev,
        remainingOrderQty: remaining,
        currentReceiptQty: current,
        cumulativeReceivedQty: cumulative,
        balanceAfterReceipt: balanceAfter,
        isOver
      };
    });
  }, [activePo, cumulativeMap, receivedQtyMap]);

  const unitTotals = useMemo(() => {
    const totals: Record<string, { ordered: number; prev: number; current: number; balanceAfter: number }> = {
      piece: { ordered: 0, prev: 0, current: 0, balanceAfter: 0 },
      kg: { ordered: 0, prev: 0, current: 0, balanceAfter: 0 }
    };

    lineDetails.forEach((ld) => {
      const u = ld.unit === 'kg' ? 'kg' : 'piece';
      if (totals[u]) {
        totals[u].ordered += ld.orderedQty;
        totals[u].prev += ld.previouslyReceivedQty;
        totals[u].current += ld.currentReceiptQty;
        totals[u].balanceAfter += ld.balanceAfterReceipt;
      }
    });

    return totals;
  }, [lineDetails]);

  // Validation function
  const validateForm = () => {
    if (!activePo) {
      setValidationError('Please select an active Purchase Order.');
      return false;
    }

    if (!selectedCustomerId) {
      setValidationError('Please select a Customer / Company.');
      return false;
    }

    if (!customerDcNo || customerDcNo.trim().length === 0) {
      setValidationError('Customer Delivery Challan (DC) Number is required.');
      return false;
    }

    if (!customerDate) {
      setValidationError('Customer DC Date is required.');
      return false;
    }

    if (!inwardDate) {
      setValidationError('Inward receipt date is required.');
      return false;
    }

    // Check for over-receipt
    const overLine = lineDetails.find((l) => l.isOver);
    if (overLine) {
      setValidationError(
        `Over-receipt on colour '${overLine.colourName}': entered quantity (${overLine.currentReceiptQty}) exceeds remaining order quantity (${overLine.remainingOrderQty} ${overLine.unit}).`
      );
      return false;
    }

    // Check that at least one line has positive quantity
    const totalCurrent = lineDetails.reduce((acc, l) => acc + l.currentReceiptQty, 0);
    if (totalCurrent <= 0) {
      setValidationError('Please enter a received quantity greater than 0 for at least one colour line.');
      return false;
    }

    setValidationError(null);
    return true;
  };

  const buildPayload = () => {
    const customer = vendors.find(
      (v) => (v.vendorId || v.id) === selectedCustomerId
    );
    const subcontractor = selectedSubcontractorId
      ? vendors.find((v) => (v.vendorId || v.id) === selectedSubcontractorId) || null
      : null;

    const linesPayload = lineDetails.map((ld) => ({
      poLineId: ld.lineId,
      colourName: ld.colourName,
      colourCode: ld.colourCode || null,
      itemName: ld.itemName,
      processType: ld.processType,
      orderedQty: ld.orderedQty,
      unit: ld.unit,
      previouslyReceivedQty: ld.previouslyReceivedQty,
      receivedQty: ld.currentReceiptQty
    }));

    return {
      draftInwardId: initialInward?.inwardId,
      po: activePo!,
      customer: customer!,
      subcontractor,
      customerDate,
      customerDcNo: customerDcNo.trim(),
      inwardDate,
      remarks: remarks.trim(),
      lines: linesPayload
    };
  };

  const handleSubmitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const payload = buildPayload();
    await onPostReceipt(payload);
  };

  const handleSaveDraft = async () => {
    if (!activePo || !selectedCustomerId) {
      setValidationError('Please select at least a Customer and a Purchase Order to save draft.');
      return;
    }
    const payload = buildPayload();
    await onSaveDraft(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Inward List
          </button>
          <h2 className="text-xl font-bold text-[#1F4E79]">
            {initialInward?.status === 'draft' ? 'Edit Inward Draft' : 'New Customer Inward Receipt'}
          </h2>
          <p className="text-xs text-slate-500">
            Perla Textiles Processor — Thirumudivakkam, Tamil Nadu
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<FileClock className="w-4 h-4" />}
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            Save Draft
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            icon={<CheckCircle2 className="w-4 h-4" />}
            onClick={handleSubmitPost}
            disabled={isSaving}
          >
            {isSaving ? 'Posting Receipt...' : 'Post Inward Receipt'}
          </Button>
        </div>
      </div>

      {/* Validation banner */}
      {validationError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Validation Error: </span>
            {validationError}
          </div>
        </div>
      )}

      {/* Form Details Grid */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-6 relative z-30">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79] pb-3 border-b border-slate-100 flex items-center gap-2">
          <Building className="w-4 h-4 text-slate-400" /> 1. Customer & Purchase Order Reference
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Customer / Company Searchable Dropdown */}
          <SearchableSelect
            label="Customer / Company"
            required
            value={selectedCustomerId}
            placeholder="-- Select Customer --"
            searchPlaceholder="Search customer company name or code..."
            groups={customerSelectGroups}
            onSelect={handleSelectCustomer}
            onClear={() => handleCustomerChange('')}
            formatTriggerLabel={(opt) => (
              <span className="truncate">
                {opt.primaryText} {opt.badge && `(${opt.badge})`}
              </span>
            )}
          />

          {/* Subcontractor Searchable Dropdown */}
          <SearchableSelect
            label="Subcontractor (Optional)"
            value={selectedSubcontractorId}
            placeholder="-- Direct Delivery / None --"
            searchPlaceholder="Search subcontractor unit..."
            groups={subcontractorSelectGroups}
            onSelect={handleSelectSubcontractor}
            onClear={() => setSelectedSubcontractorId('')}
            formatTriggerLabel={(opt) => (
              <span className="truncate">
                {opt.primaryText} {opt.badge && opt.id ? `(${opt.badge})` : ''}
              </span>
            )}
          />

          {/* Purchase Order Searchable Dropdown (supports PO # and Style #, plus other companies) */}
          <SearchableSelect
            label="Purchase Order"
            required
            value={selectedPoId}
            placeholder="-- Select Eligible PO --"
            searchPlaceholder="Search by PO #, Style #, or Item..."
            groups={poSelectGroups}
            onSelect={handleSelectPo}
            onClear={() => setSelectedPoId('')}
            formatTriggerLabel={(opt) => {
              const p = opt.meta as PurchaseOrder | undefined;
              if (p) {
                const sNo = p.styleNo || p.styleNumber || '—';
                return (
                  <span className="truncate font-semibold text-slate-800">
                    {p.poNumber} — {sNo} ({p.itemName})
                  </span>
                );
              }
              return <span className="truncate">{opt.primaryText}</span>;
            }}
          />
        </div>

        {/* Read-only snapshot information from selected PO */}
        {activePo && (
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 sm:p-5 grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-200 mt-4">
            <div className="md:pr-4">
              <span className="text-slate-500 block text-[11px] uppercase font-semibold tracking-wider mb-1">
                Style Number
              </span>
              <span className="text-sm font-bold text-slate-900 block truncate">{activePo.styleNo || activePo.styleNumber}</span>
            </div>
            <div className="pt-3 md:pt-0 md:px-4">
              <span className="text-slate-500 block text-[11px] uppercase font-semibold tracking-wider mb-1">
                Item Description
              </span>
              <span className="text-sm font-semibold text-slate-800 block truncate">{activePo.itemName}</span>
            </div>
            <div className="pt-3 md:pt-0 md:px-4">
              <span className="text-slate-500 block text-[11px] uppercase font-semibold tracking-wider mb-1">
                Process Category
              </span>
              <span className="text-sm font-bold text-[#1F4E79] uppercase block truncate">{activePo.processCategory}</span>
            </div>
            <div className="pt-3 md:pt-0 md:pl-4">
              <span className="text-slate-500 block text-[11px] uppercase font-semibold tracking-wider mb-1">
                PO Order Date
              </span>
              <span className="text-sm font-semibold text-slate-800 block truncate">{formatDate(activePo.orderDate)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Customer Delivery Challan Details */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-6 relative z-20">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79] pb-3 border-b border-slate-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" /> 2. Delivery Challan & Receipt Information
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Input
            label="Customer DC Number *"
            placeholder="e.g. DC-APEX-8891"
            className="h-10"
            value={customerDcNo}
            onChange={(e) => {
              setCustomerDcNo(e.target.value);
              setValidationError(null);
            }}
            required
          />

          <Input
            label="Customer DC Date *"
            type="date"
            className="h-10"
            value={customerDate}
            onChange={(e) => {
              setCustomerDate(e.target.value);
              setValidationError(null);
            }}
            required
          />

          <Input
            label="Inward Receipt Date *"
            type="date"
            className="h-10"
            value={inwardDate}
            onChange={(e) => {
              setInwardDate(e.target.value);
              setValidationError(null);
            }}
            required
          />
        </div>

        <div className="pt-2">
          <Input
            label="Receipt Remarks / Inspection Notes"
            placeholder="e.g. First delivery batch received via tempo. Fabric quality and shade verified."
            className="h-10"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </div>

      {/* Colour-Wise Quantity Entry Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-5 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#1F4E79] flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" /> 3. Colour-Wise Inward Quantity Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter the exact quantities delivered in this receipt against each ordered colour line.
            </p>
          </div>

          {isLoadingBalances && (
            <span className="text-xs text-slate-400 italic">Recalculating cumulative balances...</span>
          )}
        </div>

        {lineDetails.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            Please select a Purchase Order above to view its colour lines and record quantities.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EEF5FB] text-[#1F4E79] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-3 text-center w-12">S.No</th>
                  <th className="px-3.5 py-3">Colour Name</th>
                  <th className="px-3.5 py-3">Item</th>
                  <th className="px-3.5 py-3">Wash Process</th>
                  <th className="px-3.5 py-3 text-right">Ordered Qty</th>
                  <th className="px-3.5 py-3 text-center">Unit</th>
                  <th className="px-3.5 py-3 text-right">Prev Received</th>
                  <th className="px-3.5 py-3 text-right font-bold text-[#1F4E79]">Remaining Qty</th>
                  <th className="px-3.5 py-3 text-right w-36 bg-blue-50/50">Current Received Qty *</th>
                  <th className="px-3.5 py-3 text-right">Cumulative Qty</th>
                  <th className="px-3.5 py-3 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {lineDetails.map((line) => (
                  <tr
                    key={line.lineId}
                    className={`hover:bg-slate-50 transition-colors ${
                      line.isOver ? 'bg-rose-50' : line.currentReceiptQty > 0 ? 'bg-emerald-50/20' : ''
                    }`}
                  >
                    <td className="px-3.5 py-3 text-center text-slate-400">{line.sNo}</td>

                    <td className="px-3.5 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span>{line.colourName}</span>
                        {line.colourCode && (
                          <span className="text-[10px] text-slate-400 font-normal">({line.colourCode})</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3.5 py-3 text-slate-600 truncate max-w-[120px]">{line.itemName}</td>

                    <td className="px-3.5 py-3 text-slate-600">{line.processType}</td>

                    <td className="px-3.5 py-3 text-right font-semibold text-slate-700">
                      {line.orderedQty.toLocaleString()}
                    </td>

                    <td className="px-3.5 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-600">
                        {line.unit}
                      </span>
                    </td>

                    <td className="px-3.5 py-3 text-right text-slate-500">
                      {line.previouslyReceivedQty.toLocaleString()}
                    </td>

                    <td className="px-3.5 py-3 text-right font-bold text-[#1F4E79]">
                      {line.remainingOrderQty.toLocaleString()}
                    </td>

                    {/* Current Receipt Input */}
                    <td className="px-3.5 py-2.5 bg-blue-50/30">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max={line.remainingOrderQty}
                          step={line.unit === 'kg' ? '0.01' : '1'}
                          value={receivedQtyMap[line.lineId] ?? 0}
                          onChange={(e) =>
                            handleQtyChange(line.lineId, parseFloat(e.target.value), line.remainingOrderQty)
                          }
                          className={`w-full text-right px-2.5 py-1.5 text-xs font-bold rounded border ${
                            line.isOver
                              ? 'border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-500'
                              : 'border-slate-300 focus:ring-[#1F4E79] focus:border-[#1F4E79] bg-white'
                          }`}
                        />
                      </div>
                    </td>

                    <td className="px-3.5 py-3 text-right font-semibold text-slate-800">
                      {line.cumulativeReceivedQty.toLocaleString()}
                    </td>

                    <td className="px-3.5 py-3 text-right font-bold text-slate-600">
                      {line.balanceAfterReceipt.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quantity Summary Card by Unit */}
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {unitTotals.piece.ordered > 0 && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-emerald-800 uppercase tracking-wider text-[11px] block">
                Total Pieces Summary
              </span>
              <div className="flex justify-between items-center text-slate-600">
                <span>Ordered Pieces:</span>
                <span className="font-semibold text-slate-800">{unitTotals.piece.ordered.toLocaleString()} pcs</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Previously Received:</span>
                <span className="font-medium">{unitTotals.piece.prev.toLocaleString()} pcs</span>
              </div>
              <div className="flex justify-between items-center text-emerald-700 font-bold border-t border-emerald-200/60 pt-2">
                <span>Current Received:</span>
                <span>{unitTotals.piece.current.toLocaleString()} pcs</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 font-bold">
                <span>Balance After Receipt:</span>
                <span>{unitTotals.piece.balanceAfter.toLocaleString()} pcs</span>
              </div>
            </div>
          )}

          {unitTotals.kg.ordered > 0 && (
            <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-indigo-800 uppercase tracking-wider text-[11px] block">
                Total Kilograms (Fabric Weight) Summary
              </span>
              <div className="flex justify-between items-center text-slate-600">
                <span>Ordered Weight:</span>
                <span className="font-semibold text-slate-800">{unitTotals.kg.ordered.toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Previously Received:</span>
                <span className="font-medium">{unitTotals.kg.prev.toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between items-center text-indigo-700 font-bold border-t border-indigo-200/60 pt-2">
                <span>Current Received:</span>
                <span>{unitTotals.kg.current.toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between items-center text-slate-700 font-bold">
                <span>Balance After Receipt:</span>
                <span>{unitTotals.kg.balanceAfter.toLocaleString()} kg</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="flex justify-end items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>

        <Button
          type="button"
          variant="secondary"
          icon={<FileClock className="w-4 h-4" />}
          onClick={handleSaveDraft}
          disabled={isSaving}
        >
          Save Draft
        </Button>

        <Button
          type="button"
          variant="primary"
          icon={<CheckCircle2 className="w-4 h-4" />}
          onClick={handleSubmitPost}
          disabled={isSaving}
        >
          {isSaving ? 'Posting Receipt...' : 'Post Inward Receipt'}
        </Button>
      </div>
    </div>
  );
};
