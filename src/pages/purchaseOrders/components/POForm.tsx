import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  CheckCircle2,
  Building,
  Layers,
  Calendar,
  AlertCircle,
  FileCheck2,
  Info,
  Palette,
  Network,
  X,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ColourItem } from '../../../types/colourMaster';
import { ColourMasterService } from '../../../services/colourMasterService';
import { ProcessItem } from '../../../types/processMaster';
import { ProcessMasterService } from '../../../services/processMasterService';
import { VendorService } from '../../../services/vendorService';
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
    status: 'draft' | 'approved' | string
  ) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  isAdmin?: boolean;
}

export const POForm: React.FC<POFormProps> = ({
  initialPO,
  vendors,
  onSave,
  onCancel,
  isSaving,
  isAdmin
}) => {
  const { activeRole, user } = useAuth();
  const isUserAdmin =
    isAdmin ??
    (activeRole === 'Admin' ||
      (user as any)?.role === 'Admin' ||
      (user as any)?.role === 'admin');
  const [allVendors, setAllVendors] = useState<Vendor[]>(() => {
    return (vendors || []).map((v) => ({
      ...v,
      vendorId: v.vendorId || v.id || v.vendorCode || v.companyName,
      id: v.id || v.vendorId || v.vendorCode || v.companyName
    }));
  });

  // Load latest live vendors directly from Vendor Master
  useEffect(() => {
    let isMounted = true;
    async function refreshVendors() {
      try {
        const res = await VendorService.getVendors({}, { page: 1, pageSize: 500 });
        if (isMounted && res.vendors && res.vendors.length > 0) {
          const normalized = res.vendors.map((v) => ({
            ...v,
            vendorId: v.vendorId || v.id || v.vendorCode || v.companyName,
            id: v.id || v.vendorId || v.vendorCode || v.companyName
          }));
          setAllVendors(normalized);
        }
      } catch (err) {
        console.warn('Could not refresh vendor master list:', err);
      }
    }
    refreshVendors();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter strictly: Company Category: main_company, Vendor Type: customer / both
  const eligibleCustomers = useMemo(() => {
    return allVendors.filter((v) => {
      const cat = String(v.vendorCategory || (v as any).category || '').toLowerCase().replace(/[\s-]+/g, '_');
      const isMainCompany = cat === 'main_company' || !cat;
      const vType = String(v.vendorType || '').toLowerCase();
      const isCustomer =
        vType === 'customer' ||
        vType === 'both' ||
        v.roles?.includes('Customer') ||
        v.roles?.includes('Both');
      return isMainCompany && isCustomer;
    });
  }, [allVendors]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    if (initialPO?.customerId) return initialPO.customerId;
    if (initialPO?.customerVendorId) return initialPO.customerVendorId;
    if (eligibleCustomers[0]) {
      return (
        eligibleCustomers[0].vendorId ||
        eligibleCustomers[0].id ||
        eligibleCustomers[0].vendorCode ||
        ''
      );
    }
    return '';
  });

  // Clean string helper for case & symbol insensitive matching
  const cleanStr = (s: any): string => {
    if (!s) return '';
    return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Selected customer snapshot - guaranteed never null when eligibleCustomers has items
  const selectedCustomer = useMemo(() => {
    if (eligibleCustomers.length === 0) return null;
    if (!selectedCustomerId) return eligibleCustomers[0];

    const target = selectedCustomerId.toLowerCase().trim();
    const targetClean = cleanStr(selectedCustomerId);

    return (
      eligibleCustomers.find((c) => {
        const vId = c.vendorId ? String(c.vendorId).toLowerCase().trim() : '';
        const id = c.id ? String(c.id).toLowerCase().trim() : '';
        const code = c.vendorCode ? String(c.vendorCode).toLowerCase().trim() : '';
        const name = c.companyName ? String(c.companyName).toLowerCase().trim() : '';
        return (
          vId === target ||
          id === target ||
          code === target ||
          name === target ||
          cleanStr(vId) === targetClean ||
          cleanStr(id) === targetClean ||
          cleanStr(code) === targetClean ||
          cleanStr(name) === targetClean
        );
      }) ||
      allVendors.find((c) => {
        const vId = c.vendorId ? String(c.vendorId).toLowerCase().trim() : '';
        const id = c.id ? String(c.id).toLowerCase().trim() : '';
        const code = c.vendorCode ? String(c.vendorCode).toLowerCase().trim() : '';
        const name = c.companyName ? String(c.companyName).toLowerCase().trim() : '';
        return (
          vId === target ||
          id === target ||
          code === target ||
          name === target ||
          cleanStr(vId) === targetClean ||
          cleanStr(id) === targetClean ||
          cleanStr(code) === targetClean ||
          cleanStr(name) === targetClean
        );
      }) ||
      eligibleCustomers[0]
    );
  }, [eligibleCustomers, allVendors, selectedCustomerId]);

  // Ensure selectedCustomerId is valid
  useEffect(() => {
    if (!selectedCustomerId && eligibleCustomers.length > 0) {
      setSelectedCustomerId(
        eligibleCustomers[0].vendorId ||
          eligibleCustomers[0].id ||
          eligibleCustomers[0].vendorCode ||
          ''
      );
    }
  }, [eligibleCustomers, selectedCustomerId]);

  // Subcontractor / Subcompany Unit toggle state: 'none' | 'subcontractor' | 'subcompany'
  const [unitType, setUnitType] = useState<'none' | 'subcontractor' | 'subcompany'>(() => {
    if (initialPO?.subcontractorType === 'subcompany') return 'subcompany';
    if (initialPO?.subcontractorType === 'subcontractor' || initialPO?.subcontractorId) return 'subcontractor';
    return 'none';
  });

  const [selectedSubUnitId, setSelectedSubUnitId] = useState<string>(
    initialPO?.subcontractorId || initialPO?.subcompanyId || ''
  );

  // Find ALL child vendors belonging to the selected main company
  const respectiveUnits = useMemo(() => {
    if (!selectedCustomer) return [];

    const targetIdentifiers = new Set<string>();
    const addId = (val: any) => {
      if (!val) return;
      const str = String(val).trim().toLowerCase();
      if (str) targetIdentifiers.add(str);
      const cleaned = cleanStr(val);
      if (cleaned) targetIdentifiers.add(cleaned);
      // Extract numbers from code e.g. VND-000006 -> "000006", "6"
      const match = String(val).match(/\d+/);
      if (match) {
        targetIdentifiers.add(match[0]);
        targetIdentifiers.add(String(parseInt(match[0], 10)));
      }
    };

    addId(selectedCustomerId);
    addId(selectedCustomer.vendorId);
    addId(selectedCustomer.id);
    addId(selectedCustomer.vendorCode);
    addId(selectedCustomer.companyName);
    addId(selectedCustomer.legalCompanyName);

    return allVendors.filter((v) => {
      // Main company itself is not its own child
      const cat = String(v.vendorCategory || (v as any).category || '').toLowerCase().replace(/[\s-]+/g, '_');
      if (cat === 'main_company') return false;

      // Cannot be the same vendor as the selected customer
      const vKey = cleanStr(v.vendorId || v.id || v.vendorCode || v.companyName);
      const cKey = cleanStr(selectedCustomer.vendorId || selectedCustomer.id || selectedCustomer.vendorCode || selectedCustomer.companyName);
      if (vKey && cKey && vKey === cKey) return false;

      // Check all parent reference fields
      const pFields = [
        v.parentVendorId,
        (v as any).parentCompany,
        (v as any).parentVendorName,
        (v as any).parentId,
        (v as any).parentCustomerId,
        (v as any).parentCode,
        (v as any).parentVendorCode,
        (v as any).parent,
        (v as any).mainCompany,
        (v as any).mainCompanyId,
        (v as any).mainCompanyName
      ];

      for (const p of pFields) {
        if (!p) continue;
        const pStr = String(p).trim().toLowerCase();
        const pClean = cleanStr(p);
        if (targetIdentifiers.has(pStr) || targetIdentifiers.has(pClean)) {
          return true;
        }
        const match = String(p).match(/\d+/);
        if (match && (targetIdentifiers.has(match[0]) || targetIdentifiers.has(String(parseInt(match[0], 10))))) {
          return true;
        }
      }

      // Also check if company name matches e.g. "Procomets Unit A" or "Procomets Subcontractor"
      if (selectedCustomer.companyName) {
        const cClean = cleanStr(selectedCustomer.companyName);
        const vClean = cleanStr(v.companyName);
        if (cClean.length >= 4 && vClean.includes(cClean)) {
          return true;
        }
      }

      return false;
    });
  }, [allVendors, selectedCustomerId, selectedCustomer]);

  // Respective Subcontractors of this Main Company
  const respectiveSubcontractors = useMemo(() => {
    return respectiveUnits.filter((v) => {
      const cat = String(v.vendorCategory || (v as any).category || '').toLowerCase().replace(/[\s-]+/g, '_');
      // Subcontractor, supplier, jobwork, or any linked child not strictly a subcompany
      return cat === 'subcontractor' || cat === 'supplier' || cat === 'jobwork' || cat !== 'subcompany';
    });
  }, [respectiveUnits]);

  // Respective Subcompanies of this Main Company
  const respectiveSubcompanies = useMemo(() => {
    return respectiveUnits.filter((v) => {
      const cat = String(v.vendorCategory || (v as any).category || '').toLowerCase().replace(/[\s-]+/g, '_');
      // Subcompany, or any linked child not strictly a subcontractor
      return cat === 'subcompany' || cat === 'sub_company' || cat !== 'subcontractor';
    });
  }, [respectiveUnits]);

  const activeSubUnitList = unitType === 'subcontractor' ? respectiveSubcontractors : respectiveSubcompanies;

  const selectedSubUnit = useMemo(() => {
    if (!selectedSubUnitId) return null;
    return allVendors.find((v) => (v.vendorId || v.id) === selectedSubUnitId) || null;
  }, [allVendors, selectedSubUnitId]);

  // When customer changes, verify if selectedSubUnitId belongs to new customer
  useEffect(() => {
    if (unitType === 'none') {
      setSelectedSubUnitId('');
      return;
    }
    const currentList = unitType === 'subcontractor' ? respectiveSubcontractors : respectiveSubcompanies;
    const isCurrentStillRespective = currentList.some(
      (u) => (u.vendorId || u.id) === selectedSubUnitId
    );
    if (!isCurrentStillRespective) {
      if (currentList.length > 0) {
        setSelectedSubUnitId(currentList[0].vendorId || currentList[0].id || '');
      } else {
        setSelectedSubUnitId('');
      }
    }
  }, [selectedCustomerId, unitType, respectiveSubcontractors, respectiveSubcompanies]);
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
          colourName: '',
          colourCode: null,
          colourId: null,
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
  const [masterColours, setMasterColours] = useState<ColourItem[]>([]);
  const [masterProcesses, setMasterProcesses] = useState<ProcessItem[]>([]);

  // Other Colour Modal State
  const [isOtherColourModalOpen, setIsOtherColourModalOpen] = useState(false);
  const [newColourName, setNewColourName] = useState('');
  const [targetLineIndex, setTargetLineIndex] = useState<number | null>(null);
  const [isAddingColour, setIsAddingColour] = useState(false);

  // Other Process Modal State
  const [isOtherProcessModalOpen, setIsOtherProcessModalOpen] = useState(false);
  const [newProcessModalName, setNewProcessModalName] = useState('');
  const [targetProcessLineIndex, setTargetProcessLineIndex] = useState<number | null>(null);
  const [isAddingProcess, setIsAddingProcess] = useState(false);

  // Subscribe to Colour Master from generalSettings
  useEffect(() => {
    const unsubscribe = ColourMasterService.subscribeColours((items) => {
      setMasterColours(items);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to Wash / Process Master from generalSettings
  useEffect(() => {
    const unsubscribe = ProcessMasterService.subscribeProcesses((items) => {
      setMasterProcesses(items);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenAddOtherProcess = (lineIndex: number) => {
    setTargetProcessLineIndex(lineIndex);
    setNewProcessModalName('');
    setIsOtherProcessModalOpen(true);
  };

  const handleSaveNewProcess = async () => {
    const trimmed = newProcessModalName.trim();
    if (!trimmed) return;
    if (targetProcessLineIndex === null || !lines[targetProcessLineIndex]) return;

    try {
      setIsAddingProcess(true);
      const newProc = await ProcessMasterService.addProcess(
        trimmed,
        user?.uid || 'user',
        processCategory || 'washing'
      );

      const updated = [...lines];
      updated[targetProcessLineIndex] = {
        ...updated[targetProcessLineIndex],
        processType: newProc.name
      };
      setLines(updated);
      setIsOtherProcessModalOpen(false);
      setNewProcessModalName('');
    } catch (err: any) {
      // If already exists in Process Master, link to it directly
      const normalized = trimmed.toLowerCase();
      const existing = masterProcesses.find(
        (p) => p.normalizedName === normalized || p.name.toLowerCase() === normalized
      );
      if (existing) {
        const updated = [...lines];
        updated[targetProcessLineIndex] = {
          ...updated[targetProcessLineIndex],
          processType: existing.name
        };
        setLines(updated);
        setIsOtherProcessModalOpen(false);
        setNewProcessModalName('');
      } else {
        alert(err.message || 'Failed to save wash/process to Master');
      }
    } finally {
      setIsAddingProcess(false);
    }
  };

  const handleOpenAddOther = (lineIndex: number) => {
    setTargetLineIndex(lineIndex);
    setNewColourName('');
    setIsOtherColourModalOpen(true);
  };

  const handleSaveNewColour = async () => {
    const trimmed = newColourName.trim();
    if (!trimmed) return;
    if (targetLineIndex === null || !lines[targetLineIndex]) return;

    try {
      setIsAddingColour(true);
      const newColour = await ColourMasterService.addColour(
        trimmed,
        user?.uid || 'user'
      );

      // Successfully saved to Colour Master Firestore collection
      const updated = [...lines];
      updated[targetLineIndex] = {
        ...updated[targetLineIndex],
        colourName: newColour.name,
        colourId: newColour.id
      };
      setLines(updated);
      setIsOtherColourModalOpen(false);
      setNewColourName('');
    } catch (err: any) {
      // If already exists in Colour Master, link to it directly
      const normalized = trimmed.toLowerCase();
      const existing = masterColours.find(
        (c) => c.normalizedName === normalized || c.name.toLowerCase() === normalized
      );
      if (existing) {
        const updated = [...lines];
        updated[targetLineIndex] = {
          ...updated[targetLineIndex],
          colourName: existing.name,
          colourId: existing.id
        };
        setLines(updated);
        setIsOtherColourModalOpen(false);
        setNewColourName('');
      } else {
        alert(err.message || 'Failed to save colour to Colour Master');
      }
    } finally {
      setIsAddingColour(false);
    }
  };

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
      colourCode: null,
      colourId: null,
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

    // Auto-link colourId from Colour Master when colourName changes
    if (field === 'colourName') {
      const trimmed = String(value).trim().toLowerCase();
      const matched = masterColours.find(
        (c) => c.name.toLowerCase() === trimmed || c.normalizedName === trimmed
      );
      if (matched) {
        item.colourId = matched.id;
      }
    }

    // Recompute line amount
    item.lineAmount = calculateLineAmount(item);
    item.amount = item.lineAmount;

    updated[index] = item;
    setLines(updated);
  };

  // Live totals calculation
  const totals = calculatePOTotals(lines);

  // Form submission handler
  const handleSubmit = async (targetStatus: 'draft' | 'submitted' | string) => {
    setValidationErrors([]);

    const payload = {
      customerId: selectedCustomerId,
      customerCode: selectedCustomer?.vendorCode || '',
      customerName: selectedCustomer?.companyName || '',
      customerCompanyNameSnapshot: selectedCustomer?.companyName || '',
      // Subcontractor / Subcompany unit assignment
      subcontractorType: unitType === 'none' ? null : unitType,
      subcontractorId: unitType !== 'none' && selectedSubUnit ? (selectedSubUnit.vendorId || selectedSubUnit.id) : null,
      subcontractorCode: unitType !== 'none' && selectedSubUnit ? (selectedSubUnit.vendorCode || null) : null,
      subcontractorName: unitType !== 'none' && selectedSubUnit ? selectedSubUnit.companyName : null,
      subcompanyId: unitType === 'subcompany' && selectedSubUnit ? (selectedSubUnit.vendorId || selectedSubUnit.id) : null,
      subcompanyCode: unitType === 'subcompany' && selectedSubUnit ? (selectedSubUnit.vendorCode || null) : null,
      subcompanyName: unitType === 'subcompany' && selectedSubUnit ? selectedSubUnit.companyName : null,
      processCategory,
      styleNo: styleNo.trim(),
      styleNumber: styleNo.trim(),
      itemName: itemName.trim(),
      orderDate,
      deliveryDate: deliveryDate || null,
      expectedCompletionDate: deliveryDate || null,
      customerReferenceNo: customerReferenceNo.trim() || undefined,
      customerInstructions: customerInstructions.trim() || undefined,
      internalRemarks: internalRemarks.trim() || undefined,
      notes: internalRemarks.trim() || undefined,
      colourLines: lines.map((l) => ({
        ...l,
        colourCode: null,
        colourId: l.colourId || null,
        notes: l.notes || null,
        rateBasis: l.rateBasis === 'per_piece' ? 'perPiece' : l.rateBasis === 'per_kg' ? 'perKg' : l.rateBasis
      }))
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
          {initialPO ? (
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-4 h-4" />}
              onClick={() => handleSubmit(initialPO.status === 'approved' ? 'approved' : 'draft')}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          ) : isUserAdmin ? (
            <>
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
                icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => handleSubmit('approved')}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Approve & Save PO
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-4 h-4" />}
              onClick={() => handleSubmit('draft')}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save as Draft'}
            </Button>
          )}
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
          {/* Customer Selection: Strictly Main Company Customers */}
          <div className="md:col-span-1 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Customer Company <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Main Companies Only</span>
            </div>
            <select
              value={selectedCustomer ? (selectedCustomer.vendorId || selectedCustomer.id || selectedCustomer.vendorCode) : selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1F4E79]/20 focus:border-[#1F4E79]"
              required
            >
              {eligibleCustomers.length === 0 ? (
                <option value="">No Main Company Customers Found</option>
              ) : (
                eligibleCustomers.map((c) => {
                  const val = c.vendorId || c.id || c.vendorCode || c.companyName;
                  return (
                    <option key={val} value={val}>
                      {c.companyName} ({c.vendorCode || 'Client'})
                    </option>
                  );
                })
              )}
            </select>

            {selectedCustomer && (
              <div className="mt-2 p-2.5 rounded-lg bg-[#EEF5FB] border border-[#BDD7EE] text-[11px] text-slate-700 space-y-1">
                <div className="font-semibold text-[#1F4E79] flex items-center justify-between">
                  <span>{selectedCustomer.companyName}</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-mono px-1.5 py-0.5 rounded font-medium">
                    Main Company
                  </span>
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
              placeholder="e.g. 7777 / SKT-DENIM-9021"
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
              placeholder="e.g. Denim Shirts / Men's Twill Jeans"
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

        {/* Subcontractor or Subcompany Toggle Section */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-800 rounded-lg">
                <Network className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Order Processing Unit
                </span>
                <span className="text-[11px] text-slate-500">
                  Select whether this order is fulfilled direct, or assigned to a linked Subcontractor or Subcompany
                </span>
              </div>
            </div>

            {/* 3-way Toggle: Direct (Main Company) | Subcontractor | Subcompany */}
            <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200 shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => {
                  setUnitType('none');
                  setSelectedSubUnitId('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  unitType === 'none'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Direct (Main Company)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnitType('subcontractor');
                  if (respectiveSubcontractors.length > 0) {
                    setSelectedSubUnitId(respectiveSubcontractors[0].vendorId || respectiveSubcontractors[0].id || '');
                  } else {
                    setSelectedSubUnitId('');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  unitType === 'subcontractor'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Subcontractor
              </button>
              <button
                type="button"
                onClick={() => {
                  setUnitType('subcompany');
                  if (respectiveSubcompanies.length > 0) {
                    setSelectedSubUnitId(respectiveSubcompanies[0].vendorId || respectiveSubcompanies[0].id || '');
                  } else {
                    setSelectedSubUnitId('');
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  unitType === 'subcompany'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Subcompany
              </button>
            </div>
          </div>

          {/* Subcontractor / Subcompany Selection Dropdown & Card */}
          {unitType !== 'none' && (
            <div className="p-4 bg-white rounded-xl border border-blue-200 bg-blue-50/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Select {unitType === 'subcontractor' ? 'Subcontractor' : 'Subcompany'}
                </label>
                <span className="text-[11px] text-slate-500">
                  Respective units of: <strong className="text-[#1F4E79]">{selectedCustomer?.companyName || 'Main Company'}</strong>
                </span>
              </div>

              <select
                value={selectedSubUnitId}
                onChange={(e) => setSelectedSubUnitId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1F4E79]/20 focus:border-[#1F4E79]"
              >
                <option value="">
                  {activeSubUnitList.length === 0
                    ? `-- No ${unitType === 'subcontractor' ? 'Subcontractors' : 'Subcompanies'} linked to ${selectedCustomer?.companyName || 'Main Company'} --`
                    : `-- Select ${unitType === 'subcontractor' ? 'Subcontractor' : 'Subcompany'} --`}
                </option>
                {activeSubUnitList.map((u) => (
                  <option key={u.vendorId || u.id} value={u.vendorId || u.id}>
                    {u.companyName} ({u.vendorCode || 'Unit'})
                  </option>
                ))}
              </select>

              {/* Unit snapshot */}
              {selectedSubUnit ? (
                <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 space-y-1 shadow-2xs">
                  <div className="font-bold text-[#1F4E79] flex items-center justify-between">
                    <span>{selectedSubUnit.companyName}</span>
                    <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {selectedSubUnit.vendorCode}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Category: <span className="capitalize font-semibold text-slate-700">{selectedSubUnit.vendorCategory?.replace('_', ' ') || unitType}</span> •{' '}
                    City: {selectedSubUnit.address?.city || 'Tamil Nadu'}
                  </div>
                  {selectedSubUnit.taxDetails?.gstin && (
                    <div className="text-slate-500 font-mono text-[11px]">
                      GSTIN: {selectedSubUnit.taxDetails.gstin}
                    </div>
                  )}
                </div>
              ) : activeSubUnitList.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  No {unitType === 'subcontractor' ? 'subcontractors' : 'subcompanies'} linked to{' '}
                  <strong>{selectedCustomer?.companyName}</strong> in Vendor Master yet.
                  To link a unit, set its Category to <em>{unitType === 'subcontractor' ? 'Subcontractor' : 'Subcompany'}</em> and Parent Company to <em>{selectedCustomer?.companyName}</em> in <strong>Vendor Master</strong>.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Colour-Wise Order Lines */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-[#1F4E79]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              2. Colour-Wise Order Details
            </h3>
            {masterColours.length > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#1F4E79] border border-blue-200">
                <Palette className="w-3 h-3 text-[#1F4E79]" />
                {masterColours.filter((c) => c.isActive).length} master colours
              </span>
            )}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
                  {/* Colour Name */}
                  <div className="md:col-span-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Colour Name *
                      </label>
                      <button
                        type="button"
                        onClick={() => handleOpenAddOther(idx)}
                        className="text-[10px] text-[#1F4E79] hover:underline font-bold cursor-pointer"
                        title="Add a new colour to General Settings > Colour Master"
                      >
                        + Other
                      </button>
                    </div>
                    <select
                      value={line.colourName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__other__') {
                          handleOpenAddOther(idx);
                        } else {
                          const matched = masterColours.find((c) => c.name === val);
                          const updated = [...lines];
                          updated[idx] = {
                            ...updated[idx],
                            colourName: val,
                            colourId: matched ? matched.id : null
                          };
                          setLines(updated);
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                      required
                    >
                      <option value="">Select Colour...</option>
                      {line.colourName &&
                        !masterColours.some(
                          (c) => c.name.toLowerCase() === line.colourName.toLowerCase()
                        ) && (
                          <option value={line.colourName}>
                            {line.colourName} (Custom)
                          </option>
                        )}
                      {masterColours
                        .filter((c) => c.isActive)
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      <option value="__other__" className="text-[#1F4E79] font-bold">
                        + Other (Enter New Colour)...
                      </option>
                    </select>
                  </div>

                  {/* Wash / Process Type */}
                  <div className="md:col-span-1 space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      Wash / Process *
                    </label>
                    <select
                      value={line.processType}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__other_process__') {
                          handleOpenAddOtherProcess(idx);
                        } else {
                          handleLineChange(idx, 'processType', val);
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79]"
                      required
                    >
                      <option value="">Select Process...</option>
                      {line.processType &&
                        !masterProcesses.some(
                          (p) => p.name.toLowerCase() === line.processType.toLowerCase()
                        ) && (
                          <option value={line.processType}>
                            {line.processType} (Custom)
                          </option>
                        )}
                      {masterProcesses
                        .filter((p) => p.isActive)
                        .map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      <option value="__other_process__" className="text-[#1F4E79] font-bold">
                        + Other (Enter New Process)...
                      </option>
                    </select>
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

      {/* Bottom Action Footer */}
      <div className="flex items-center justify-end gap-3 pt-3">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        {initialPO ? (
          <Button
            variant="primary"
            icon={<Save className="w-4 h-4" />}
            onClick={() => handleSubmit(initialPO.status === 'approved' ? 'approved' : 'draft')}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        ) : isUserAdmin ? (
          <>
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
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => handleSubmit('approved')}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSaving ? 'Approving...' : 'Approve & Save PO'}
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            icon={<Save className="w-4 h-4" />}
            onClick={() => handleSubmit('draft')}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save as Draft'}
          </Button>
        )}
      </div>

      {/* Add New Colour to General Settings > Colour Master Modal */}
      {isOtherColourModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-[#1F4E79] rounded-lg">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add New Colour
                  </h3>
                  <p className="text-xs text-slate-500">
                    Save into General Settings &gt; Colour Master
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOtherColourModalOpen(false);
                  setNewColourName('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                New Colour Name <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Lavender, Olive Green, Navy Blue..."
                value={newColourName}
                onChange={(e) => setNewColourName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveNewColour();
                  }
                }}
              />
              <p className="text-[11px] text-slate-400">
                This colour will be automatically added to the Colour Master collection and selected for Row #{targetLineIndex !== null ? targetLineIndex + 1 : 1}.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsOtherColourModalOpen(false);
                  setNewColourName('');
                }}
                disabled={isAddingColour}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveNewColour}
                disabled={isAddingColour || !newColourName.trim()}
              >
                {isAddingColour ? 'Saving to Master...' : 'Save & Select Colour'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Wash / Process to General Settings > Process Master Modal */}
      {isOtherProcessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-[#1F4E79] rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add New Wash / Process
                  </h3>
                  <p className="text-xs text-slate-500">
                    Save into General Settings &gt; Wash / Process Master
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOtherProcessModalOpen(false);
                  setNewProcessModalName('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                New Wash / Process Name <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Acid Wash, Enzyme Bio Wash, Pigment Dyeing..."
                value={newProcessModalName}
                onChange={(e) => setNewProcessModalName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveNewProcess();
                  }
                }}
              />
              <p className="text-[11px] text-slate-400">
                This process will be automatically saved to the Process Master collection and selected for Row #{targetProcessLineIndex !== null ? targetProcessLineIndex + 1 : 1}.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsOtherProcessModalOpen(false);
                  setNewProcessModalName('');
                }}
                disabled={isAddingProcess}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveNewProcess}
                disabled={isAddingProcess || !newProcessModalName.trim()}
              >
                {isAddingProcess ? 'Saving to Master...' : 'Save & Select Process'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
