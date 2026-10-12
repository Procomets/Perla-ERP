import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  Building,
  Layers,
  Calendar,
  AlertCircle,
  FileCheck2,
  Info
} from 'lucide-react';
import {
  PurchaseOrder,
  POColourLine,
  ProcessCategory,
  QuantityUnit,
  RateBasis
} from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  calculateLineAmount,
  calculatePOTotals,
  purchaseOrderFormSchema
} from '../../../schemas/poSchema';
import { formatCurrency, formatQuantity } from '../../../utils/formatters';

interface POFormProps {
  initialPO?: PurchaseOrder | null;
  vendors: Vendor[];
  onSave: (
    poData: Partial<PurchaseOrder>,
    status: 'draft' | 'submitted'
  ) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export const POForm: React.FC<POFormProps> = ({
  initialPO,
  vendors,
  onSave,
  onCancel,
  isSaving
}) => {
  // Filter active eligible customer vendors
  const eligibleCustomers = vendors.filter(
    (v) =>
      v.vendorType === 'customer' ||
      v.vendorType === 'both' ||
      v.roles?.includes('Customer') ||
      v.roles?.includes('Both')
  );

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialPO?.customerId || initialPO?.customerVendorId || eligibleCustomers[0]?.vendorId || eligibleCustomers[0]?.id || ''
  );
  const [processCategory, setProcessCategory] = useState<ProcessCategory>(
    initialPO?.processCategory || 'washing'
  );
  const [styleNo, setStyleNo] = useState<string>(
    initialPO?.styleNo || initialPO?.styleNumber || ''
  );
  const [itemName, setItemName] = useState<string>(
    initialPO?.itemName || ''
  );
  const [orderDate, setOrderDate] = useState<string>(
    initialPO?.orderDate || new Date().toISOString().split('T')[0]
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(
    initialPO?.deliveryDate || initialPO?.expectedCompletionDate || ''
  );
  const [customerReferenceNo, setCustomerReferenceNo] = useState<string>(
    initialPO?.customerReferenceNo || ''
  );
  const [customerInstructions, setCustomerInstructions] = useState<string>(
    initialPO?.customerInstructions || ''
  );
  const [internalRemarks, setInternalRemarks] = useState<string>(
    initialPO?.internalRemarks || initialPO?.notes || ''
  );

  // Colour Lines State
  const defaultInitialLines: POColourLine[] = initialPO?.colourLines?.length
    ? initialPO.colourLines
    : initialPO?.lines?.length
    ? initialPO.lines
    : [
        {
          id: `pol_${Date.now()}_1`,
          lineId: `pol_${Date.now()}_1`,
          colourName: 'Indigo Shadow',
          colourCode: '',
          processType: 'Softener Wash',
          quantity: 1000,
          unit: 'piece',
          rateBasis: 'per_piece',
          rate: 6.0,
          lineAmount: 6000.0,
          amount: 6000.0,
          notes: ''
        }
      ];

  const [lines, setLines] = useState<POColourLine[]>(defaultInitialLines);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Selected customer snapshot
  const selectedCustomer = eligibleCustomers.find(
    (c) => (c.vendorId || c.id) === selectedCustomerId
  );

  // Add colour row
  const handleAddLine = () => {
    const newLineId = `pol_${Date.now()}_${lines.length + 1}`;
    const defaultWash =
      processCategory.toLowerCase() === 'dyeing'
        ? 'Reactive Dyeing'
        : 'Softener Wash';

    const newLine: POColourLine = {
      id: newLineId,
      lineId: newLineId,
      colourName: '',
      colourCode: '',
      processType: defaultWash,
      quantity: 500,
      unit: 'piece',
      rateBasis: 'per_piece',
      rate: 6.0,
      lineAmount: 3000.0,
      amount: 3000.0,
      notes: ''
    };

    setLines([...lines, newLine]);
  };

  // Remove colour row
  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      alert('A Purchase Order must contain at least one colour line.');
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  // Change colour line field
  const handleLineChange = (
    index: number,
    field: keyof POColourLine,
    value: any
  ) => {
    const updated = [...lines];
    const item = { ...updated[index], [field]: value };

    // Recompute line amount
    item.lineAmount = calculateLineAmount(item);
    item.amount = item.lineAmount;

    updated[index] = item;
    setLines(updated);
  };

  // Live totals calculation
  const totals = calculatePOTotals(lines);

  // Form submission handler
  const handleSubmit = async (targetStatus: 'draft' | 'submitted') => {
    setValidationErrors([]);

    const payload = {
      customerId: selectedCustomerId,
      processCategory,
      styleNo: styleNo.trim(),
      itemName: itemName.trim(),
      orderDate,
      deliveryDate: deliveryDate || null,
      expectedCompletionDate: deliveryDate || null,
      customerReferenceNo: customerReferenceNo.trim() || undefined,
      customerInstructions: customerInstructions.trim() || undefined,
      internalRemarks: internalRemarks.trim() || undefined,
      notes: internalRemarks.trim() || undefined,
      colourLines: lines
    };

    // Validate using Zod schema
    const parseResult = purchaseOrderFormSchema.safeParse(payload);
    if (!parseResult.success) {
      const errMsgs = parseResult.error.issues.map((iss) => iss.message);
      setValidationErrors(errMsgs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    await onSave(payload, targetStatus);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#1F4E79]">
              {initialPO
                ? `Edit Purchase Order (${initialPO.poNumber})`
                : 'Create Purchase Order (Work Order)'}
            </h2>
            <p className="text-xs text-slate-500">
              Textile customer processing order with colour-wise breakdown
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Save className="w-4 h-4" />}
            onClick={() => handleSubmit('draft')}
            disabled={isSaving}
          >
            Save as Draft
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Send className="w-4 h-4" />}
            onClick={() => handleSubmit('submitted')}
            disabled={isSaving}
          >
            Submit for Approval
          </Button>
        </div>
      </div>

      {/* Validation Errors Alert */}
      {validationErrors.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-900 mb-1">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>Please correct the following errors:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-2 text-rose-700">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section 1: Customer & Work Order Specifications */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building className="w-4 h-4 text-[#1F4E79]" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            1. Customer & Work Order Header
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer Selection */}
          <div className="md:col-span-1 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Customer Company <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1F4E79]/20 focus:border-[#1F4E79]"
              required
            >
              {eligibleCustomers.map((c) => (
                <option key={c.vendorId || c.id} value={c.vendorId || c.id}>
                  {c.companyName} ({c.vendorCode || 'Client'})
                </option>
              ))}
            </select>

            {selectedCustomer && (
              <div className="mt-2 p-2.5 rounded-lg bg-[#EEF5FB] border border-[#BDD7EE] text-[11px] text-slate-700 space-y-1">
                <div className="font-semibold text-[#1F4E79]">
                  {selectedCustomer.companyName}
                </div>
                <div className="text-slate-500">
                  Code: <span className="font-mono">{selectedCustomer.vendorCode}</span> •{' '}
                  {selectedCustomer.address?.city || 'Tamil Nadu'}
                </div>
                {selectedCustomer.taxDetails?.gstin && (
                  <div className="text-slate-500 font-mono">
                    GSTIN: {selectedCustomer.taxDetails.gstin}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Process Category */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Process Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProcessCategory('washing')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                  processCategory.toLowerCase() === 'washing'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Washing
              </button>
              <button
                type="button"
                onClick={() => setProcessCategory('dyeing')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                  processCategory.toLowerCase() === 'dyeing'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Dyeing
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Select whether this work order is for washing finishing or dyeing
            </p>
          </div>

          {/* Style Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Style Number <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. 2467 or APX-DENIM-9021"
              value={styleNo}
              onChange={(e) => setStyleNo(e.target.value)}
              required
            />
            <p className="text-[11px] text-slate-400">
              Customer garment style reference code
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Item Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Item Name / Description <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Men's Denim Shirt, Shoe, etc."
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
          </div>

          {/* Order Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Order Date <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
          </div>

          {/* Expected Delivery Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Expected Delivery Date
            </label>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Colour-Wise Order Lines */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#1F4E79]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              2. Colour-Wise Order Details
            </h3>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={handleAddLine}
          >
            Add Colour Row
          </Button>
        </div>

        {/* Dynamic Colour Rows */}
        <div className="space-y-3">
          {lines.map((line, idx) => {
            const isPerKg =
              line.rateBasis === 'per_kg' ||
              line.rateBasis === 'perKg' ||
              line.rateBasis === 'per kg';
            const showBillableWeight = line.unit === 'piece' && isPerKg;

            return (
              <div
                key={line.id || line.lineId || idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors space-y-2 text-xs"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <span className="font-bold text-[#1F4E79]">
                    Row #{idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      Line Total:{' '}
                      <strong className="text-slate-900 text-xs">
                        {formatCurrency(line.lineAmount || 0)}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      disabled={lines.length <= 1}
                      className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="Remove Row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
                  {/* Colour Name */}
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Colour Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Pantone Brunnet"
                      value={line.colourName}
                      onChange={(e) =>
                        handleLineChange(idx, 'colourName', e.target.value)
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                      required
                    />
                  </div>

                  {/* Colour Code */}
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Colour Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 19-0912"
                      value={line.colourCode || ''}
                      onChange={(e) =>
                        handleLineChange(idx, 'colourCode', e.target.value)
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                    />
                  </div>

                  {/* Wash / Process Type */}
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Wash / Process *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Softener Wash"
                      value={line.processType}
                      onChange={(e) =>
                        handleLineChange(idx, 'processType', e.target.value)
                      }
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                      required
                    />
                  </div>

                  {/* Quantity & Unit */}
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Quantity & Unit *
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineChange(
                            idx,
                            'quantity',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-2/3 bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                        required
                      />
                      <select
                        value={line.unit}
                        onChange={(e) =>
                          handleLineChange(
                            idx,
                            'unit',
                            e.target.value as QuantityUnit
                          )
                        }
                        className="w-1/3 bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-medium text-slate-700"
                      >
                        <option value="piece">Pcs</option>
                        <option value="kg">Kg</option>
                      </select>
                    </div>
                  </div>

                  {/* Rate & Rate Basis */}
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Rate Basis & Rate (₹) *
                    </label>
                    <div className="flex gap-1">
                      <select
                        value={line.rateBasis}
                        onChange={(e) =>
                          handleLineChange(
                            idx,
                            'rateBasis',
                            e.target.value as RateBasis
                          )
                        }
                        className="w-1/2 bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-medium text-slate-700"
                      >
                        <option value="per_piece">/ Pc</option>
                        <option value="per_kg">/ Kg</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Rate ₹"
                        value={line.rate}
                        onChange={(e) =>
                          handleLineChange(
                            idx,
                            'rate',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-1/2 bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                        required
                      />
                    </div>
                  </div>

                  {/* Remarks / Billable Weight */}
                  <div className="md:col-span-1 space-y-1">
                    {showBillableWeight ? (
                      <>
                        <label className="text-[11px] font-semibold text-amber-700">
                          Billable Wt (kg) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Billable kg"
                          value={line.billableWeightKg || ''}
                          onChange={(e) =>
                            handleLineChange(
                              idx,
                              'billableWeightKg',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-medium text-amber-900 focus:outline-hidden"
                          required
                        />
                      </>
                    ) : (
                      <>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Row Remarks
                        </label>
                        <input
                          type="text"
                          placeholder="Optional remarks"
                          value={line.notes || line.remarks || ''}
                          onChange={(e) =>
                            handleLineChange(idx, 'notes', e.target.value)
                          }
                          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-700"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Calculated Totals Summary Ribbon */}
        <div className="bg-[#EEF5FB] border border-[#BDD7EE] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-slate-500 block text-[11px]">
                Total Colour Lines
              </span>
              <strong className="text-slate-900 text-sm">
                {lines.length} lines
              </strong>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">
                Total Ordered Pieces
              </span>
              <strong className="text-slate-900 text-sm">
                {formatQuantity(totals.totalQtyByUnit.piece || 0, 'piece')}
              </strong>
            </div>

            {(totals.totalQtyByUnit.kg || 0) > 0 && (
              <div>
                <span className="text-slate-500 block text-[11px]">
                  Total Ordered Weight
                </span>
                <strong className="text-slate-900 text-sm">
                  {formatQuantity(totals.totalQtyByUnit.kg || 0, 'kg')}
                </strong>
              </div>
            )}
          </div>

          <div className="text-right">
            <span className="text-slate-500 block text-[11px]">
              Total Work Order Value
            </span>
            <strong className="text-lg font-black text-[#1F4E79]">
              {formatCurrency(totals.totalAmount)}
            </strong>
          </div>
        </div>
      </div>

      {/* Section 3: Commercial & Operational Instructions */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Info className="w-4 h-4 text-[#1F4E79]" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            3. References & Instructions
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Customer Reference No
            </label>
            <Input
              placeholder="e.g. CUST-WO-2026-90"
              value={customerReferenceNo}
              onChange={(e) => setCustomerReferenceNo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Customer Processing Instructions
            </label>
            <input
              type="text"
              placeholder="e.g. Special silicone softening ratio, maintain 5% shrink test..."
              value={customerInstructions}
              onChange={(e) => setCustomerInstructions(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
            />
          </div>
        </div>

        <div className="space-y-1.5 pt-2">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Internal Remarks / Notes
          </label>
          <textarea
            rows={2}
            placeholder="Internal shopfloor comments or routing notes..."
            value={internalRemarks}
            onChange={(e) => setInternalRemarks(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
          />
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-3">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          icon={<Save className="w-4 h-4" />}
          onClick={() => handleSubmit('draft')}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button
          variant="primary"
          icon={<Send className="w-4 h-4" />}
          onClick={() => handleSubmit('submitted')}
          disabled={isSaving}
        >
          {isSaving ? 'Submitting...' : 'Submit for Approval'}
        </Button>
      </div>
    </div>
  );
};
