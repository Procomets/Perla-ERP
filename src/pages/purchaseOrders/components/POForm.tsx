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
  AlertCircle,
  FileCheck2,
  Info,
  Palette,
  X,
  Sparkles,
  Lock,
  Hash
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ColourItem } from '../../../types/colourMaster';
import { ColourMasterService } from '../../../services/colourMasterService';
import { ProcessItem } from '../../../types/processMaster';
import { ProcessMasterService } from '../../../services/processMasterService';
import { HsnItem } from '../../../types/hsnMaster';
import { HsnMasterService } from '../../../services/hsnMasterService';
import { VendorService } from '../../../services/vendorService';
import {
  PurchaseOrder,
  POColourLine,
  ProcessCategory,
  QuantityUnit,
  RateBasis
} from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { ValidationToast } from '../../../components/ui/ValidationToast';
import { LoadingOverlay } from '../../../components/ui/LoadingOverlay';
import { InwardEntry } from '../../../types/inwardOutward';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import {
  calculateLineAmount,
  calculatePOTotals,
  purchaseOrderFormSchema
} from '../../../schemas/poSchema';
import { formatCurrency, formatQuantity } from '../../../utils/formatters';
import { hasInwardForPO } from '../../../utils/calculations';
import { InwardService } from '../../../services/inwardService';
import { SearchableSelect, SelectOption, SelectOptionGroup } from '../../inward/components/SearchableSelect';
import { POLockService, POLockStatus } from '../../../services/poLockService';

interface POFormProps {
  initialPO?: PurchaseOrder | null;
  vendors: Vendor[];
  inwards?: InwardEntry[];
  lockedPOMap?: Record<string, POLockStatus>;
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
  inwards = [],
  lockedPOMap,
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
  const hasInward = initialPO ? hasInwardForPO(initialPO, inwards) : false;

  const poLockStatus = useMemo(() => {
    if (!initialPO) return null;
    return POLockService.getPOStatus(initialPO, lockedPOMap);
  }, [initialPO, lockedPOMap]);

  const isPoFullyLocked = Boolean(poLockStatus?.isFullyLocked);
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

  // Option groups for searchable customer dropdown
  const customerOptionGroups: SelectOptionGroup[] = useMemo(() => {
    if (eligibleCustomers.length === 0) return [];
    return [
      {
        title: 'Main Company Customers',
        options: eligibleCustomers.map((c) => {
          const idVal = c.vendorId || c.id || c.vendorCode || c.companyName;
          return {
            id: idVal,
            primaryText: c.companyName,
            secondaryText: c.address?.city ? `${c.address.city} • Code: ${c.vendorCode || '—'}` : `Code: ${c.vendorCode || '—'}`,
            badge: c.vendorCode || 'Client',
            badgeVariant: 'blue' as const,
            meta: c
          };
        })
      }
    ];
  }, [eligibleCustomers]);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    if (initialPO?.customerId) return initialPO.customerId;
    if (initialPO?.customerVendorId) return initialPO.customerVendorId;
    return '';
  });

  // Clean string helper for case & symbol insensitive matching
  const cleanStr = (s: any): string => {
    if (!s) return '';
    return String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Selected customer snapshot - null when no customer is selected
  const selectedCustomer = useMemo(() => {
    if (eligibleCustomers.length === 0 || !selectedCustomerId) return null;

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
      null
    );
  }, [eligibleCustomers, allVendors, selectedCustomerId]);

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
  // Helper to check if vendor is the currently selected customer
  const isCurrentCustomer = (v: Vendor) => {
    if (!selectedCustomer) return false;
    const vKey = cleanStr(v.vendorId || v.id || v.vendorCode || v.companyName);
    const cKey = cleanStr(selectedCustomer.vendorId || selectedCustomer.id || selectedCustomer.vendorCode || selectedCustomer.companyName);
    if (vKey && cKey && vKey === cKey) return true;
    if (v.companyName && selectedCustomer.companyName && v.companyName.trim().toLowerCase() === selectedCustomer.companyName.trim().toLowerCase()) return true;
    return false;
  };

  // 1. Respective (linked) Subcontractors of this Main Company
  const respectiveSubcontractors = useMemo(() => {
    return respectiveUnits.filter((v) => {
      const cat = String(v.vendorCategory || (v as any).category || '').toLowerCase().replace(/[\s-]+/g, '_');
      return cat === 'subcontractor' || cat === 'supplier' || cat === 'jobwork' || cat !== 'subcompany';
    });
  }, [respectiveUnits]);

  // 2. Respective (linked) Subcompanies of this Main Company
  const respectiveSubcompanies = useMemo(() => {
    return respectiveUnits.filter((v) => {
      const cat = String(v.vendorCategory || (v as any).category || '').toLowerCase().replace(/[\s-]+/g, '_');
      return cat === 'subcompany' || cat === 'sub_company' || cat !== 'subcontractor';
    });
  }, [respectiveUnits]);

  // Units directly linked to the current company
  const linkedUnits = unitType === 'subcontractor' ? respectiveSubcontractors : respectiveSubcompanies;

  // 3. All other companies/vendors in the system except the current customer and already linked units
  const otherCompanies = useMemo(() => {
    const linkedIds = new Set(linkedUnits.map((u) => u.vendorId || u.id));
    return allVendors
      .filter((v) => !isCurrentCustomer(v) && !linkedIds.has(v.vendorId || v.id))
      .sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
  }, [allVendors, linkedUnits, selectedCustomer]);

  // All eligible units: linked units first, then all other companies
  const activeSubUnitList = useMemo(() => {
    return [...linkedUnits, ...otherCompanies];
  }, [linkedUnits, otherCompanies]);

  const selectedSubUnit = useMemo(() => {
    if (!selectedSubUnitId) return null;
    return allVendors.find((v) => (v.vendorId || v.id) === selectedSubUnitId) || null;
  }, [allVendors, selectedSubUnitId]);

  // Auto-selection: when unitType or customer changes, prioritize linked units
  useEffect(() => {
    if (unitType === 'none') {
      setSelectedSubUnitId('');
      return;
    }
    // If current selected unit is the customer itself, clear it
    if (selectedSubUnitId && selectedCustomer && (selectedSubUnitId === selectedCustomer.vendorId || selectedSubUnitId === selectedCustomer.id)) {
      setSelectedSubUnitId('');
    }
    // If no unit is currently selected, default to the first linked unit if available
    if (!selectedSubUnitId && linkedUnits.length > 0) {
      setSelectedSubUnitId(linkedUnits[0].vendorId || linkedUnits[0].id || '');
    }
  }, [selectedCustomerId, unitType, linkedUnits]);
  const [processCategory, setProcessCategory] = useState<ProcessCategory>(
    initialPO?.processCategory || ('' as any)
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
  const [customerPoNumber, setCustomerPoNumber] = useState<string>(
    initialPO?.customerPoNumber || ''
  );
  const [customerPoDate, setCustomerPoDate] = useState<string>(
    initialPO?.customerPoDate || ''
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
          processType: '',
          quantity: '' as any,
          unit: 'piece',
          rateBasis: 'per_piece',
          rate: '' as any,
          lineAmount: 0,
          amount: 0,
          notes: ''
        }
      ];

  const [lines, setLines] = useState<POColourLine[]>(defaultInitialLines);
  const [toastTitle, setToastTitle] = useState<string>('Cannot Submit Purchase Order');
  const [toastSubtitle, setToastSubtitle] = useState<string>('Please fill all compulsory fields to submit:');
  const [toastErrors, setToastErrors] = useState<string[]>([]);
  const [showToast, setShowToast] = useState<boolean>(false);

  const triggerToast = (title: string, subtitle: string, errors: string[]) => {
    setToastTitle(title);
    setToastSubtitle(subtitle);
    setToastErrors(errors);
    setShowToast(true);
  };

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);
  const [masterColours, setMasterColours] = useState<ColourItem[]>([]);
  const [masterProcesses, setMasterProcesses] = useState<ProcessItem[]>([]);
  const [masterHsns, setMasterHsns] = useState<HsnItem[]>([]);

  // Live inward quantities received per colour line
  const [liveInwardMap, setLiveInwardMap] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    if (!initialPO) {
      setLiveInwardMap({});
      return;
    }

    const fetchInwards = async () => {
      try {
        const poId = initialPO.id || initialPO.poId || '';
        const poNumber = initialPO.poNumber;
        const map = await InwardService.getCumulativePostedInwardMap(
          poId,
          undefined,
          false,
          poNumber
        );
        if (isMounted) {
          setLiveInwardMap(map);
        }
      } catch (err) {
        console.warn('Could not load live inward balances for PO edit:', err);
      }
    };

    fetchInwards();

    return () => {
      isMounted = false;
    };
  }, [initialPO?.id, initialPO?.poId, initialPO?.poNumber]);

  // Synchronous fallback map from inwards prop
  const inwardMapFromProps = useMemo(() => {
    const map: Record<string, number> = {};
    if (!initialPO || !inwards || inwards.length === 0) return map;

    const poId = (initialPO.id || initialPO.poId || '').toLowerCase().trim();
    const poNum = (initialPO.poNumber || '').toLowerCase().trim();

    for (const inw of inwards) {
      if (inw.status === 'reversed' || inw.status === 'cancelled') continue;
      const inwPoId = (inw.poId || '').toLowerCase().trim();
      const inwPoNum = (inw.poNumber || (inw as any).poNumberSnapshot || '').toLowerCase().trim();

      const matches =
        (poId && inwPoId && inwPoId === poId) ||
        (poNum && inwPoNum && inwPoNum === poNum && !poNum.includes('pending'));

      if (matches) {
        for (const line of inw.lines || []) {
          const lid = line.poLineId || line.lineId;
          const qty = Number(line.receivedQty) || 0;
          if (lid) {
            map[lid] = (map[lid] || 0) + qty;
          }
          const cName = (line.colour || (line as any).colourNameSnapshot || '').trim().toLowerCase();
          if (cName) {
            map[`colour_${cName}`] = (map[`colour_${cName}`] || 0) + qty;
            map[cName] = (map[cName] || 0) + qty;
          }
        }
      }
    }
    return map;
  }, [initialPO, inwards]);

  // Helper to determine minimum allowable quantity for a colour line based on inward received
  const getMinAllowedQtyForLine = (line: POColourLine): number => {
    if (!initialPO) return 0;
    const lineId = line.id || line.lineId || '';
    const colourKey = (line.colourName || '').trim().toLowerCase();

    return Math.max(
      0,
      liveInwardMap[lineId] ??
      liveInwardMap[`colour_${colourKey}`] ??
      liveInwardMap[colourKey] ??
      inwardMapFromProps[lineId] ??
      inwardMapFromProps[`colour_${colourKey}`] ??
      inwardMapFromProps[colourKey] ??
      0
    );
  };

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

  // Other HSN Modal State
  const [isOtherHsnModalOpen, setIsOtherHsnModalOpen] = useState(false);
  const [newHsnNo, setNewHsnNo] = useState('');
  const [newHsnDescription, setNewHsnDescription] = useState('');
  const [targetHsnLineIndex, setTargetHsnLineIndex] = useState<number | null>(null);
  const [isAddingHsn, setIsAddingHsn] = useState(false);

  // Subscribe to HSN Master from generalSettings
  useEffect(() => {
    const unsubscribe = HsnMasterService.subscribeHsnItems((items) => {
      setMasterHsns(items);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenAddOtherHsn = (lineIndex: number) => {
    setTargetHsnLineIndex(lineIndex);
    setNewHsnNo('');
    setNewHsnDescription('');
    setIsOtherHsnModalOpen(true);
  };

  const handleSaveNewHsn = async () => {
    const trimmedHsn = newHsnNo.trim();
    const trimmedDesc = newHsnDescription.trim();
    if (!trimmedHsn || !trimmedDesc) return;
    if (targetHsnLineIndex === null || !lines[targetHsnLineIndex]) return;

    try {
      setIsAddingHsn(true);
      const newHsn = await HsnMasterService.addHsnItem(
        trimmedHsn,
        trimmedDesc,
        user?.uid || 'user'
      );

      const updated = [...lines];
      updated[targetHsnLineIndex] = {
        ...updated[targetHsnLineIndex],
        hsnNo: newHsn.hsnNo,
        hsnDescription: newHsn.description
      };
      setLines(updated);
      setIsOtherHsnModalOpen(false);
      setNewHsnNo('');
      setNewHsnDescription('');
    } catch (err: any) {
      alert(err.message || 'Failed to save HSN entry');
    } finally {
      setIsAddingHsn(false);
    }
  };

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

    const newLine: POColourLine = {
      id: newLineId,
      lineId: newLineId,
      colourName: '',
      colourCode: null,
      colourId: null,
      processType: '',
      hsnNo: '',
      quantity: '' as any,
      unit: 'piece',
      rateBasis: 'per_piece',
      rate: '' as any,
      lineAmount: 0,
      amount: 0,
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
    const targetLine = lines[index];
    if (initialPO && POLockService.isLineLocked(initialPO, targetLine, lockedPOMap)) {
      alert(`Cannot remove colour '${targetLine.colourName || `Row #${index + 1}`}': This colour line has already been invoiced.`);
      return;
    }
    const minQty = getMinAllowedQtyForLine(targetLine);
    if (minQty > 0) {
      alert(
        `Cannot remove colour '${targetLine.colourName || `Row #${index + 1}`}': ${minQty.toLocaleString()} ${targetLine.unit} has already been received in Inward entries.`
      );
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
    if (initialPO && POLockService.isLineLocked(initialPO, lines[index], lockedPOMap)) {
      return;
    }
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
    setToastErrors([]);
    setShowToast(false);

    if (initialPO) {
      if (isPoFullyLocked) {
        const lockMsg = poLockStatus?.reason || 'All colour lines have been invoiced completely. PO entry cannot be edited.';
        triggerToast('Purchase Order Entry Locked', 'This purchase order cannot be edited:', [lockMsg]);
        return;
      }
      if (poLockStatus && (poLockStatus.invoicedLinesCount > 0 || poLockStatus.approvedLinesCount > 0)) {
        const origLines = initialPO.colourLines || initialPO.lines || [];
        for (const orig of origLines) {
          if (POLockService.isLineLocked(initialPO, orig, lockedPOMap)) {
            const currentLine = lines.find(
              (l) =>
                (l.id && l.id === orig.id) ||
                (orig.lineId && l.lineId === orig.lineId) ||
                (l.colourName && l.colourName.trim().toLowerCase() === orig.colourName.trim().toLowerCase())
            );
            if (!currentLine) {
              const msg = `Cannot remove colour line '${orig.colourName}': It has already been invoiced.`;
              triggerToast('Cannot Remove Invoiced Line', '', [msg]);
              return;
            }
            if (Number(currentLine.quantity) !== Number(orig.quantity)) {
              const msg = `Cannot change quantity for colour line '${orig.colourName}': It has already been invoiced.`;
              triggerToast('Cannot Change Invoiced Quantity', '', [msg]);
              return;
            }
            if (Number(currentLine.rate) !== Number(orig.rate)) {
              const msg = `Cannot change rate for colour line '${orig.colourName}': It has already been invoiced.`;
              triggerToast('Cannot Change Invoiced Rate', '', [msg]);
              return;
            }
            if (currentLine.unit !== orig.unit) {
              const msg = `Cannot change unit for colour line '${orig.colourName}': It has already been invoiced.`;
              triggerToast('Cannot Change Invoiced Unit', '', [msg]);
              return;
            }
          }
        }
      }
    }

    const errors: string[] = [];

    // 1. Customer Company
    if (!selectedCustomerId) {
      errors.push('Customer Company is required.');
    }

    // 2. Process Category
    if (!processCategory) {
      errors.push('Process Category (Washing or Dyeing) is required.');
    }

    // 3. Style Number
    if (!styleNo || !styleNo.trim()) {
      errors.push('Style Number is required.');
    }

    // 4. Item Name / Description
    if (!itemName || !itemName.trim()) {
      errors.push('Item Name / Description is required.');
    }

    // 5. Order Date
    if (!orderDate) {
      errors.push('Order Date is required.');
    }

    // 6. Subcontractor / Subcompany Unit
    if (unitType !== 'none' && !selectedSubUnitId) {
      errors.push(
        `Please select a ${
          unitType === 'subcontractor' ? 'Subcontractor Unit' : 'Sister Company Unit'
        }.`
      );
    }

    // 7. Colour Lines
    if (!lines || lines.length === 0) {
      errors.push('At least one colour row is required.');
    } else {
      lines.forEach((line, idx) => {
        const rowNum = idx + 1;
        const lineDesc = line.colourName ? `Row #${rowNum} (${line.colourName})` : `Row #${rowNum}`;

        if (!line.colourName || !line.colourName.trim()) {
          errors.push(`Row #${rowNum}: Colour Name is required.`);
        }

        if (!line.processType || !line.processType.trim()) {
          errors.push(`Row #${rowNum}: Wash / Process is required.`);
        }

        const rawQty = line.quantity as any;
        const numQty = Number(rawQty);
        if (rawQty === '' || rawQty === null || rawQty === undefined || isNaN(numQty) || numQty <= 0) {
          errors.push(`Row #${rowNum}: Quantity must be greater than 0.`);
        } else {
          // Check against inward received minimum
          const minQty = getMinAllowedQtyForLine(line);
          if (minQty > 0 && numQty < minQty) {
            errors.push(
              `${lineDesc}: Quantity cannot be less than ${minQty.toLocaleString()} ${line.unit} (already received in Inward entries).`
            );
          }
        }

        const rawRate = line.rate as any;
        const numRate = Number(rawRate);
        if (rawRate === '' || rawRate === null || rawRate === undefined || isNaN(numRate) || numRate < 0) {
          errors.push(`Row #${rowNum}: Rate (₹) is required.`);
        }

        const isPerKg =
          line.rateBasis === 'per_kg' ||
          line.rateBasis === 'perKg' ||
          line.rateBasis === ('per kg' as any);
        if (line.unit === 'piece' && isPerKg) {
          const rawWeight = line.billableWeightKg;
          const numWeight = Number(rawWeight);
          if (rawWeight === undefined || rawWeight === null || isNaN(numWeight) || numWeight <= 0) {
            errors.push(`Row #${rowNum}: Billable weight (kg) is required when rate basis is Per Kg.`);
          }
        }
      });

      // Duplicate colour & process check
      const seen = new Set<string>();
      lines.forEach((line, idx) => {
        if (line.colourName && line.processType) {
          const key = `${line.colourName.trim().toLowerCase()}_${line.processType.trim().toLowerCase()}`;
          if (seen.has(key)) {
            errors.push(
              `Row #${idx + 1}: Duplicate colour & process '${line.colourName} - ${line.processType}' detected.`
            );
          }
          seen.add(key);
        }
      });
    }

    if (errors.length > 0) {
      triggerToast(
        'Cannot Save Purchase Order',
        'Please correct the following errors:',
        errors
      );
      return;
    }

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
      customerPoNumber: customerPoNumber.trim() || undefined,
      customerPoDate: customerPoDate || undefined,
      customerReferenceNo: customerReferenceNo.trim() || undefined,
      customerInstructions: customerInstructions.trim() || undefined,
      internalRemarks: internalRemarks.trim() || undefined,
      notes: internalRemarks.trim() || undefined,
      colourLines: lines.map((l) => ({
        ...l,
        quantity: Number(l.quantity) || 0,
        rate: Number(l.rate) || 0,
        lineAmount: calculateLineAmount({
          ...l,
          quantity: Number(l.quantity) || 0,
          rate: Number(l.rate) || 0
        }),
        amount: calculateLineAmount({
          ...l,
          quantity: Number(l.quantity) || 0,
          rate: Number(l.rate) || 0
        }),
        hsnNo: (l.hsnNo || '').trim(),
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
      triggerToast(
        'Cannot Submit Purchase Order',
        'Please fill all compulsory fields to submit:',
        errMsgs
      );
      return;
    }

    try {
      await onSave(payload, targetStatus);
    } catch (err: any) {
      const msg = err.message || 'Failed to save Purchase Order.';
      triggerToast('Error Saving Purchase Order', '', [msg]);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 relative">
      {/* Toast Notification for Unfilled / Compulsory Missing Fields & Notices */}
      <ValidationToast
        isOpen={showToast}
        onClose={() => setShowToast(false)}
        title={toastTitle}
        subtitle={toastSubtitle}
        errors={toastErrors}
      />

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
      </div>

      {/* Whole PO Locked Banner if all lines moved to invoice generation */}
      {isPoFullyLocked && (
        <div className="bg-rose-50 border border-rose-300 rounded-xl p-4 flex items-center gap-3 text-rose-900 shadow-2xs">
          <div className="p-2.5 bg-rose-100 rounded-xl text-rose-800 shrink-0">
            <Lock className="w-5 h-5 text-rose-700" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-rose-950">Purchase Order Entry Locked</h4>
            <p className="text-xs text-rose-800 mt-0.5">
              All colour lines for this purchase order have been moved to invoice generation. This purchase order cannot be edited.
            </p>
          </div>
        </div>
      )}

      {/* Partial Lock Notice if some colour lines are invoiced */}
      {!isPoFullyLocked && poLockStatus && poLockStatus.invoicedLinesCount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-900 shadow-2xs">
          <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
            <Lock className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-950">
              Invoiced Lines: {poLockStatus.invoicedLinesCount} of {poLockStatus.totalLines} Colour Lines Invoiced
            </h4>
            <p className="text-xs text-emerald-800 mt-0.5">
              Colour lines that have already been invoiced cannot be modified or removed. All other colour lines remain editable (minimum allowable quantity is the inward received).
            </p>
          </div>
        </div>
      )}

      {/* Section 1: Customer & Work Order Specifications */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            1. Customer & Work Order Header
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Customer Selection: Strictly Main Company Customers */}
          <div className="md:col-span-1 space-y-1.5 relative z-20">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Customer Company <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Main Companies Only</span>
            </div>
            <SearchableSelect
              value={selectedCustomer ? (selectedCustomer.vendorId || selectedCustomer.id || selectedCustomer.vendorCode || selectedCustomer.companyName) : selectedCustomerId}
              placeholder=""
              searchPlaceholder=""
              groups={customerOptionGroups}
              onSelect={(opt) => setSelectedCustomerId(opt.id)}
              formatTriggerLabel={(opt) => (
                <span className="truncate font-semibold text-slate-900 text-xs">
                  {opt.primaryText} {opt.badge && `(${opt.badge})`}
                </span>
              )}
            />
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
                  processCategory?.toLowerCase() === 'washing'
                    ? 'bg-black text-white border-black shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                Washing
              </button>
              <button
                type="button"
                onClick={() => setProcessCategory('dyeing')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                  processCategory?.toLowerCase() === 'dyeing'
                    ? 'bg-black text-white border-black shadow-xs'
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
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
          </div>

          {/* Customer PO Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Customer PO Number
            </label>
            <Input
              value={customerPoNumber}
              onChange={(e) => setCustomerPoNumber(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">
              Customer's PO reference code
            </p>
          </div>

          {/* Customer PO Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Customer PO Date
            </label>
            <Input
              type="date"
              value={customerPoDate}
              onChange={(e) => setCustomerPoDate(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">
              Date on customer's purchase order
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Colour-Wise Order Lines */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            2. Colour-Wise Order Details
          </h3>
          {!isPoFullyLocked && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleAddLine}
            >
              Add Colour Row
            </Button>
          )}
        </div>

        {/* Dynamic Colour Rows */}
        <div className="space-y-3">
          {lines.map((line, idx) => {
            const minQty = getMinAllowedQtyForLine(line);
            const hasInwardForThisRow = minQty > 0;
            const isBelowInward = hasInwardForThisRow && (Number(line.quantity) || 0) < minQty;
            const isLineInvoiced = Boolean(
              initialPO && POLockService.isLineLocked(initialPO, line, lockedPOMap)
            );
            const isLineApproved = Boolean(
              initialPO && POLockService.isLineApproved(initialPO, line, lockedPOMap)
            );
            const isRowDisabled = isLineInvoiced || isPoFullyLocked;

            const isPerKg =
              line.rateBasis === 'per_kg' ||
              line.rateBasis === 'perKg' ||
              line.rateBasis === 'per kg';
            const showBillableWeight = line.unit === 'piece' && isPerKg;

            return (
              <div
                key={line.id || line.lineId || idx}
                className={`p-3.5 rounded-xl border transition-colors space-y-2 text-xs ${
                  isLineInvoiced
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : isBelowInward
                    ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-200'
                    : isLineApproved
                    ? 'border-blue-200 bg-blue-50/20'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1F4E79]">
                      Row #{idx + 1}
                    </span>
                    {isLineInvoiced && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-emerald-600" />
                        Invoiced (Locked)
                      </span>
                    )}
                    {isLineApproved && !isLineInvoiced && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                        <FileCheck2 className="w-2.5 h-2.5 text-blue-600" />
                        Moved to Invoice Generation
                      </span>
                    )}
                    {hasInwardForThisRow && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isBelowInward
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        Inward Received: {minQty.toLocaleString()} {line.unit}
                      </span>
                    )}
                  </div>
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
                      disabled={lines.length <= 1 || hasInwardForThisRow || isRowDisabled}
                      className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title={
                        isLineInvoiced
                          ? 'Cannot remove: this colour line has already been invoiced.'
                          : isPoFullyLocked
                          ? 'Cannot remove: PO entry is locked.'
                          : hasInwardForThisRow
                          ? `Cannot remove: ${minQty.toLocaleString()} ${line.unit} already received in Inward entries`
                          : lines.length <= 1
                          ? 'PO must have at least one line'
                          : 'Remove Row'
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 items-start">
                  {/* Colour Name */}
                  <div className="md:col-span-1 space-y-1">
                    <div className="flex items-center justify-between h-5">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Colour Name *
                      </label>
                      {!hasInwardForThisRow && !isRowDisabled && (
                        <button
                          type="button"
                          onClick={() => handleOpenAddOther(idx)}
                          className="text-[10px] text-[#1F4E79] hover:underline font-bold cursor-pointer"
                          title="Add a new colour to General Settings > Colour Master"
                        >
                          + Other
                        </button>
                      )}
                    </div>
                    <select
                      value={line.colourName}
                      disabled={hasInwardForThisRow || isRowDisabled}
                      title={
                        isLineInvoiced
                          ? 'Colour cannot be changed: line has already been invoiced.'
                          : hasInwardForThisRow
                          ? `Colour cannot be changed: ${minQty.toLocaleString()} ${line.unit} already received in Inward.`
                          : undefined
                      }
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
                      className={`w-full h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79] ${
                        hasInwardForThisRow || isRowDisabled
                          ? 'disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed'
                          : ''
                      }`}
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
                      {!hasInwardForThisRow && !isRowDisabled && (
                        <option value="__other__" className="text-[#1F4E79] font-bold">
                          + Other (Enter New Colour)...
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Wash / Process Type */}
                  <div className="md:col-span-1 space-y-1">
                    <div className="flex items-center justify-between h-5">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Wash / Process *
                      </label>
                    </div>
                    <select
                      value={line.processType}
                      disabled={isRowDisabled}
                      title={isLineInvoiced ? 'Process cannot be changed: line has already been invoiced.' : undefined}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__other_process__') {
                          handleOpenAddOtherProcess(idx);
                        } else {
                          handleLineChange(idx, 'processType', val);
                        }
                      }}
                      className={`w-full h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79] ${
                        isRowDisabled ? 'disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed' : ''
                      }`}
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
                      {!isRowDisabled && (
                        <option value="__other_process__" className="text-[#1F4E79] font-bold">
                          + Other (Enter New Process)...
                        </option>
                      )}
                    </select>
                  </div>

                  {/* HSN No. */}
                  <div className="md:col-span-1 space-y-1">
                    <div className="flex items-center justify-between h-5">
                      <label className="text-[11px] font-semibold text-slate-600">
                        HSN No. *
                      </label>
                      {!isRowDisabled && (
                        <button
                          type="button"
                          onClick={() => handleOpenAddOtherHsn(idx)}
                          className="text-[10px] text-[#1F4E79] hover:underline font-bold cursor-pointer"
                          title="Add a new HSN to General Settings > HSN Master"
                        >
                          + Other
                        </button>
                      )}
                    </div>
                    <select
                      value={line.hsnNo || ''}
                      disabled={isRowDisabled}
                      title={isLineInvoiced ? 'HSN cannot be changed: line has already been invoiced.' : undefined}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__other_hsn__') {
                          handleOpenAddOtherHsn(idx);
                        } else {
                          const matchedHsn = masterHsns.find((h) => h.hsnNo === val);
                          const updated = [...lines];
                          updated[idx] = {
                            ...updated[idx],
                            hsnNo: val,
                            hsnDescription: matchedHsn?.description || ''
                          };
                          setLines(updated);
                        }
                      }}
                      className={`w-full h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79] ${
                        isRowDisabled ? 'disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed' : ''
                      }`}
                      required
                    >
                      <option value="">Select HSN...</option>
                      {line.hsnNo && !masterHsns.some((h) => h.hsnNo === line.hsnNo) && (
                        <option value={line.hsnNo}>
                          {line.hsnNo} (Custom)
                        </option>
                      )}
                      {masterHsns
                        .filter((h) => h.isActive)
                        .map((h) => (
                          <option key={h.id} value={h.hsnNo} title={`${h.hsnNo} - ${h.description}`}>
                            {h.hsnNo} {h.description ? `(${h.description.slice(0, 16)}...)` : ''}
                          </option>
                        ))}
                      {!isRowDisabled && (
                        <option value="__other_hsn__" className="text-[#1F4E79] font-bold">
                          + Other (Enter New HSN)...
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Quantity & Unit */}
                  <div className="md:col-span-1 space-y-1">
                    <div className="flex items-center justify-between h-5">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Quantity & Unit *
                      </label>
                      {hasInwardForThisRow && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                            isBelowInward
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-amber-100/70 text-amber-700 border-amber-300'
                          }`}
                          title={`Minimum allowable: ${minQty.toLocaleString()} ${line.unit} (Inward received)`}
                        >
                          Min: {minQty.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 h-9">
                      <input
                        type="number"
                        min={hasInwardForThisRow ? minQty : 1}
                        value={line.quantity === 0 || (line.quantity as any) === '' ? '' : line.quantity}
                        disabled={isRowDisabled}
                        readOnly={isRowDisabled}
                        title={
                          isLineInvoiced
                            ? 'Quantity cannot be changed: line has already been invoiced.'
                            : hasInwardForThisRow
                            ? `Min allowable quantity: ${minQty} ${line.unit}`
                            : undefined
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            handleLineChange(idx, 'quantity', '' as any);
                          } else {
                            const val = parseFloat(raw);
                            handleLineChange(
                              idx,
                              'quantity',
                              isNaN(val) ? ('' as any) : val
                            );
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.keyCode === 38 || e.keyCode === 40) {
                            e.preventDefault();
                          }
                        }}
                        onBlur={() => {
                          if (hasInwardForThisRow && (Number(line.quantity) || 0) < minQty) {
                            handleLineChange(idx, 'quantity', minQty);
                            triggerToast(
                              'Quantity Auto-Adjusted',
                              'Quantity cannot be less than received inward:',
                              [
                                `Row #${idx + 1} (${line.colourName || 'Colour'}): Quantity cannot be less than ${minQty.toLocaleString()} ${line.unit} (already received in Inward entries). Auto-adjusted to ${minQty.toLocaleString()}.`
                              ]
                            );
                          }
                        }}
                        className={`w-2/3 h-9 bg-white rounded-lg px-2 text-xs font-medium focus:outline-hidden transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden ${
                          isRowDisabled
                            ? 'bg-slate-100 text-slate-600 cursor-not-allowed border-slate-200'
                            : isBelowInward
                            ? 'border-2 border-rose-500 bg-rose-50/50 text-rose-900 focus:border-rose-600'
                            : 'border border-slate-200 text-slate-900 focus:border-[#1F4E79]'
                        }`}
                        required
                      />
                      <select
                        value={line.unit}
                        disabled={hasInwardForThisRow || isRowDisabled}
                        title={
                          isLineInvoiced
                            ? 'Unit cannot be changed: line has already been invoiced.'
                            : hasInwardForThisRow
                            ? 'Unit locked because inward entries have already been received in this unit.'
                            : undefined
                        }
                        onChange={(e) =>
                          handleLineChange(
                            idx,
                            'unit',
                            e.target.value as QuantityUnit
                          )
                        }
                        className={`w-1/3 h-9 bg-white border border-slate-200 rounded-lg px-1 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79] ${
                          hasInwardForThisRow || isRowDisabled
                            ? 'disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed'
                            : ''
                        }`}
                      >
                        <option value="piece">Pcs</option>
                        <option value="kg">Kg</option>
                      </select>
                    </div>
                    {isBelowInward && (
                      <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 pt-0.5">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 text-rose-600" />
                        <span>Cannot be less than inward received ({minQty.toLocaleString()} {line.unit})</span>
                      </div>
                    )}
                  </div>

                  {/* Rate & Rate Basis */}
                  <div className="md:col-span-1 space-y-1">
                    <div className="flex items-center justify-between h-5">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Rate Basis & Rate (₹) *
                      </label>
                    </div>
                    <div className="flex gap-1 h-9">
                      <select
                        value={line.rateBasis}
                        disabled={isRowDisabled}
                        title={isLineInvoiced ? 'Rate basis cannot be changed: line has already been invoiced.' : undefined}
                        onChange={(e) =>
                          handleLineChange(
                            idx,
                            'rateBasis',
                            e.target.value as RateBasis
                          )
                        }
                        className={`w-1/2 h-9 bg-white border border-slate-200 rounded-lg px-1 text-[11px] font-medium text-slate-700 ${
                          isRowDisabled ? 'disabled:bg-slate-100 disabled:cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="per_piece">/ Pc</option>
                        <option value="per_kg">/ Kg</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={line.rate === 0 || (line.rate as any) === '' ? '' : line.rate}
                        disabled={isRowDisabled}
                        readOnly={isRowDisabled}
                        title={isLineInvoiced ? 'Rate cannot be changed: line has already been invoiced.' : undefined}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            handleLineChange(idx, 'rate', '' as any);
                          } else {
                            handleLineChange(
                              idx,
                              'rate',
                              parseFloat(raw) || 0
                            );
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.keyCode === 38 || e.keyCode === 40) {
                            e.preventDefault();
                          }
                        }}
                        className={`w-1/2 h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#1F4E79] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden ${
                          isRowDisabled ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>

                  {/* Remarks / Billable Weight */}
                  <div className="md:col-span-1 space-y-1">
                    <div className="flex items-center justify-between h-5">
                      <label className={`text-[11px] font-semibold ${showBillableWeight ? 'text-amber-700' : 'text-slate-600'}`}>
                        {showBillableWeight ? 'Billable Wt (kg) *' : 'Row Remarks'}
                      </label>
                    </div>
                    {showBillableWeight ? (
                      <input
                        type="number"
                        step="0.01"
                        value={line.billableWeightKg || ''}
                        disabled={isRowDisabled}
                        readOnly={isRowDisabled}
                        title={isLineInvoiced ? 'Billable weight cannot be changed: line has already been invoiced.' : undefined}
                        onChange={(e) =>
                          handleLineChange(
                            idx,
                            'billableWeightKg',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.keyCode === 38 || e.keyCode === 40) {
                            e.preventDefault();
                          }
                        }}
                        className={`w-full h-9 bg-white border border-amber-300 rounded-lg px-2 text-xs font-medium text-amber-900 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden ${
                          isRowDisabled ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : ''
                        }`}
                        required
                      />
                    ) : (
                      <input
                        type="text"
                        value={line.notes || line.remarks || ''}
                        disabled={isRowDisabled}
                        readOnly={isRowDisabled}
                        title={isLineInvoiced ? 'Remarks cannot be changed: line has already been invoiced.' : undefined}
                        onChange={(e) =>
                          handleLineChange(idx, 'notes', e.target.value)
                        }
                        className={`w-full h-9 bg-white border border-slate-200 rounded-lg px-2 text-xs font-medium text-slate-700 ${
                          isRowDisabled ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : ''
                        }`}
                      />
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
            icon={isPoFullyLocked || (hasInward && !isUserAdmin) ? <Lock className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            onClick={() => handleSubmit(initialPO.status || 'draft')}
            loading={isSaving}
            loadingText="Saving Changes..."
            disabled={isSaving || isPoFullyLocked || (hasInward && !isUserAdmin)}
            title={
              isPoFullyLocked
                ? 'All colour lines have been moved to invoice generation. PO entry cannot be edited.'
                : hasInward && !isUserAdmin
                ? 'Inward has been entered. Only Admin can edit this PO.'
                : undefined
            }
            className={
              isPoFullyLocked || (hasInward && !isUserAdmin)
                ? 'opacity-60 cursor-not-allowed bg-slate-600 hover:bg-slate-600'
                : 'bg-black hover:bg-neutral-800 text-white border-black cursor-pointer'
            }
          >
            {isPoFullyLocked ? 'PO Entry Locked' : hasInward && !isUserAdmin ? 'Admin Edit Only' : 'Save Changes'}
          </Button>
        ) : isUserAdmin ? (
          <Button
            variant="primary"
            icon={<CheckCircle2 className="w-4 h-4" />}
            onClick={() => handleSubmit('approved')}
            loading={isSaving}
            loadingText="Approving & Saving..."
            className="bg-black hover:bg-neutral-800 text-white border-black cursor-pointer"
          >
            Approve & Save PO
          </Button>
        ) : (
          <Button
            variant="primary"
            icon={<Save className="w-4 h-4" />}
            onClick={() => handleSubmit('draft')}
            loading={isSaving}
            loadingText="Saving PO..."
            className="bg-black hover:bg-neutral-800 text-white border-black cursor-pointer"
          >
            Save PO
          </Button>
        )}
      </div>

      <LoadingOverlay
        isOpen={isSaving}
        title={initialPO ? 'Updating Purchase Order...' : 'Creating Purchase Order...'}
        message="Saving colour lines, calculating order totals, and securing purchase order records..."
      />

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

      {/* Add New HSN Code to General Settings > HSN Master Modal */}
      {isOtherHsnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-[#1F4E79] rounded-lg">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Add New HSN Code
                  </h3>
                  <p className="text-xs text-slate-500">
                    Save into General Settings &gt; HSN Master
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOtherHsnModalOpen(false);
                  setNewHsnNo('');
                  setNewHsnDescription('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  HSN No. <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={newHsnNo}
                  onChange={(e) => setNewHsnNo(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={newHsnDescription}
                  onChange={(e) => setNewHsnDescription(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#1F4E79] transition-colors"
                />
              </div>

              <p className="text-[11px] text-slate-400">
                This HSN code will be saved to HSN Master and automatically selected for Row #{targetHsnLineIndex !== null ? targetHsnLineIndex + 1 : 1}.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsOtherHsnModalOpen(false);
                  setNewHsnNo('');
                  setNewHsnDescription('');
                }}
                disabled={isAddingHsn}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveNewHsn}
                loading={isAddingHsn}
                loadingText="Saving to Master..."
                disabled={!newHsnNo.trim() || !newHsnDescription.trim()}
              >
                Save & Select HSN
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
