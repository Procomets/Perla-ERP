import React, { useState, useEffect, useMemo } from 'react';
import { PurchaseOrder } from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { InwardEntry } from '../../../types/inward';
import { OutwardEntry, OutwardBalancesResponse } from '../../../types/outward';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { formatDate } from '../../../utils/formatters';
import { OutwardService } from '../../../services/outwardService';
import { VehicleService } from '../../../services/vehicleService';
import { VehicleRecord } from '../../../types/vehicle';
import { SearchableSelect, SelectOption, SelectOptionGroup } from '../../inward/components/SearchableSelect';
import { ValidationToast } from '../../../components/ui/ValidationToast';
import { LoadingOverlay } from '../../../components/ui/LoadingOverlay';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Info,
  Truck,
  Building,
  Layers,
  Calendar,
  FileText
} from 'lucide-react';

interface OutwardFormProps {
  pos: PurchaseOrder[];
  vendors: Vendor[];
  inwards?: InwardEntry[];
  outwards?: OutwardEntry[];
  initialOutward?: OutwardEntry | null;
  initialPoId?: string | null;
  onSaveDraft?: (data: any) => Promise<void>;
  onPostOutward: (data: any) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export const OutwardForm: React.FC<OutwardFormProps> = ({
  pos,
  vendors,
  inwards = [],
  outwards = [],
  initialOutward,
  initialPoId,
  onSaveDraft,
  onPostOutward,
  onCancel,
  isSaving
}) => {
  // Active posted outwards list (passed via prop or loaded dynamically)
  const [activeOutwards, setActiveOutwards] = useState<OutwardEntry[]>(outwards);

  useEffect(() => {
    if (outwards && outwards.length > 0) {
      setActiveOutwards(outwards);
    } else {
      OutwardService.getAllPostedOutwards()
        .then((list) => {
          if (list && list.length > 0) setActiveOutwards(list);
        })
        .catch((e) => console.warn('Could not load posted outwards:', e));
    }
  }, [outwards]);

  // Combined list of POs: includes all POs from props plus any POs referenced in posted inward receipts
  const allPosWithInwardSources = useMemo(() => {
    const list = [...pos];
    const seenIds = new Set(list.map((p) => p.id).concat(list.map((p) => p.poId || '')));
    const seenNums = new Set(list.map((p) => p.poNumber?.trim().toLowerCase()).filter(Boolean));

    for (const inw of inwards || []) {
      // Must be posted inward
      if (inw.status !== 'posted') continue;
      const poNumKey = (inw.poNumber || inw.poNumberSnapshot || '').trim().toLowerCase();
      const poIdKey = inw.poId;
      if (poIdKey && !seenIds.has(poIdKey) && (!poNumKey || !seenNums.has(poNumKey))) {
        list.push({
          id: inw.poId,
          poId: inw.poId,
          poNumber: inw.poNumber || inw.poNumberSnapshot || 'PO-RECORD',
          customerId: inw.customerId || inw.customerVendorId || 'cust-default',
          customerVendorId: inw.customerVendorId || inw.customerId || 'cust-default',
          customerName: inw.customerName || inw.customerCompanyNameSnapshot || 'Customer Company',
          customerCompanyNameSnapshot: inw.customerCompanyNameSnapshot || inw.customerName || 'Customer Company',
          styleNo: inw.styleNo || inw.styleNoSnapshot || 'N/A',
          itemName: inw.itemName || inw.itemNameSnapshot || 'Garments',
          processCategory: inw.processCategory || inw.processCategorySnapshot || 'washing',
          status: 'partially_received',
          orderDate: inw.customerDate || inw.inwardDate,
          totalQuantity: inw.totalQuantity || 0,
          totalQtyByUnit: inw.totalQtyByUnit || { piece: inw.totalQuantity || 0, kg: 0 },
          lines: [],
          colourLines: [],
          schemaVersion: 1
        } as unknown as PurchaseOrder);
        seenIds.add(poIdKey);
        if (poNumKey) seenNums.add(poNumKey);
      }
    }
    return list;
  }, [pos, inwards]);

  // Comprehensive inward and outward balance calculation for every candidate PO
  const poBalanceMap = useMemo(() => {
    const map: Record<
      string,
      {
        hasPostedInward: boolean;
        totalInwardQty: number;
        totalOutwardQty: number;
        availableQty: number;
        isAvailable: boolean;
        primaryUnit: string;
      }
    > = {};

    for (const p of allPosWithInwardSources) {
      const pPoNum = (p.poNumber || '').trim().toLowerCase();
      const pId = p.id;
      const pPoId = p.poId;

      // 1. Matching posted inwards for this PO
      const matchingInwards = (inwards || []).filter((inw) => {
        if (inw.status !== 'posted') return false;
        const inwPoNum = (inw.poNumber || inw.poNumberSnapshot || '').trim().toLowerCase();
        return (
          (pId && inw.poId === pId) ||
          (pPoId && inw.poId === pPoId) ||
          (pPoNum && inwPoNum === pPoNum)
        );
      });

      // 2. Matching posted outwards for this PO (excluding current outward being edited)
      const matchingOutwards = (activeOutwards || []).filter((outw) => {
        if (outw.status !== 'posted') return false;
        if (
          initialOutward &&
          (outw.id === initialOutward.id ||
            outw.outwardId === initialOutward.id ||
            outw.id === initialOutward.outwardId ||
            outw.outwardId === initialOutward.outwardId)
        ) {
          return false;
        }
        const outwPoNum = (outw.poNumber || outw.poNumberSnapshot || '').trim().toLowerCase();
        return (
          (pId && outw.poId === pId) ||
          (pPoId && outw.poId === pPoId) ||
          (pPoNum && outwPoNum === pPoNum)
        );
      });

      // Compute line maps and total inward/outward quantities
      const inwLineMap: Record<string, number> = {};
      let totalInward = 0;
      let primaryUnit = 'piece';

      for (const inw of matchingInwards) {
        if (inw.lines && inw.lines.length > 0) {
          for (const l of inw.lines) {
            const q = Number(l.receivedQty) || 0;
            if (l.poLineId) {
              inwLineMap[l.poLineId] = (inwLineMap[l.poLineId] || 0) + q;
            }
            if (l.unit) primaryUnit = l.unit;
          }
        }
        let inwTotal = Number(inw.totalQuantity) || 0;
        if (inwTotal === 0 && inw.lines && inw.lines.length > 0) {
          inwTotal = inw.lines.reduce((sum, l) => sum + (Number(l.receivedQty) || 0), 0);
        }
        totalInward += inwTotal;
      }

      const outwLineMap: Record<string, number> = {};
      let totalOutward = 0;

      for (const outw of matchingOutwards) {
        if (outw.lines && outw.lines.length > 0) {
          for (const l of outw.lines) {
            const q = Number(l.dispatchQty) || 0;
            if (l.poLineId) {
              outwLineMap[l.poLineId] = (outwLineMap[l.poLineId] || 0) + q;
            }
          }
        }
        let outwTotal = Number(outw.totalQuantity) || 0;
        if (outwTotal === 0 && outw.lines && outw.lines.length > 0) {
          outwTotal = outw.lines.reduce((sum, l) => sum + (Number(l.dispatchQty) || 0), 0);
        }
        totalOutward += outwTotal;
      }

      const poLines = (p.lines && p.lines.length > 0) ? p.lines : (p.colourLines || []);
      let hasAvailableLine = false;
      let lineBasedAvailableTotal = 0;

      if (poLines.length > 0) {
        for (const pl of poLines) {
          const lineId = pl.lineId || (pl as any).id;
          if (pl.unit) primaryUnit = pl.unit;
          const lineIn = inwLineMap[lineId] || 0;
          const lineOut = outwLineMap[lineId] || 0;
          const avail = Math.max(0, lineIn - lineOut);
          lineBasedAvailableTotal += avail;
          if (avail > 0) {
            hasAvailableLine = true;
          }
        }
      }

      const hasPostedInward = matchingInwards.length > 0 && totalInward > 0;
      const totalInwardMinusOutward = Math.max(0, totalInward - totalOutward);

      // Condition:
      // 1. Must have posted inward
      // 2. Not all inward has been outwarded (available inward balance > 0)
      const hasLineBreakdown = poLines.length > 0 && Object.keys(inwLineMap).length > 0;
      const isAvailable = hasPostedInward && (
        hasLineBreakdown
          ? (hasAvailableLine && totalInwardMinusOutward > 0)
          : (totalInwardMinusOutward > 0)
      );

      const availableQty = hasLineBreakdown ? lineBasedAvailableTotal : totalInwardMinusOutward;

      const balanceData = {
        hasPostedInward,
        totalInwardQty: totalInward,
        totalOutwardQty: totalOutward,
        availableQty,
        isAvailable,
        primaryUnit
      };

      if (p.id) map[p.id] = balanceData;
      if (p.poId) map[p.poId] = balanceData;
      if (p.poNumber) map[p.poNumber.trim().toLowerCase()] = balanceData;
    }

    return map;
  }, [allPosWithInwardSources, inwards, activeOutwards, initialOutward]);

  // Target preselected PO if provided from Quick Outward
  const targetInitialPo = useMemo(() => {
    if (!initialPoId) return null;
    return (
      allPosWithInwardSources.find((p) => p.id === initialPoId || p.poId === initialPoId) ||
      pos.find((p) => p.id === initialPoId || p.poId === initialPoId) ||
      null
    );
  }, [initialPoId, allPosWithInwardSources, pos]);

  // Filter eligible POs:
  // ONLY show if inward is available for this particular PO!
  // If there is NO inward entry for PO OR all the inward is outwarded, DO NOT SHOW!
  const eligiblePos = useMemo(() => {
    return allPosWithInwardSources.filter((p) => {
      const s = String(p.status || '').toLowerCase();
      if (s === 'cancelled' || s === 'rejected') return false;

      // Allow current PO if editing an existing outward dispatch
      const isCurrentEditingPo = Boolean(
        initialOutward && (p.id === initialOutward.poId || p.poId === initialOutward.poId)
      );
      if (isCurrentEditingPo) return true;

      // Allow preselected PO if redirected from Quick Outward
      if (initialPoId && (p.id === initialPoId || p.poId === initialPoId)) {
        return true;
      }

      const bal =
        poBalanceMap[p.id] ||
        poBalanceMap[p.poId || ''] ||
        (p.poNumber ? poBalanceMap[p.poNumber.trim().toLowerCase()] : null);

      if (!bal) return false;

      // Rule 1: If there is no inward entry for PO, do NOT show
      if (!bal.hasPostedInward) return false;

      // Rule 2: If all the inward is outwarded, do NOT show
      if (!bal.isAvailable || bal.availableQty <= 0) return false;

      // Rule 3: Only if inward is available (> 0), show!
      return true;
    });
  }, [allPosWithInwardSources, poBalanceMap, initialOutward, initialPoId]);

  // All Customer companies: ONLY show companies that have at least one PO with available inward balance!
  const eligibleCustomers = useMemo(() => {
    const customerMap = new Map<string, Vendor>();

    // 1. Add vendors from master vendors list that match an eligible PO or targetInitialPo
    for (const v of vendors) {
      const hasEligiblePO = eligiblePos.some(
        (p) =>
          p.customerId === v.id ||
          p.customerId === v.vendorId ||
          p.customerVendorId === v.id ||
          p.customerVendorId === v.vendorId ||
          (p.customerName && p.customerName.trim().toLowerCase() === v.companyName.trim().toLowerCase()) ||
          (p.customerCompanyNameSnapshot && p.customerCompanyNameSnapshot.trim().toLowerCase() === v.companyName.trim().toLowerCase())
      );

      const isInitialOutwardCust = Boolean(
        initialOutward && (
          v.id === initialOutward.customerVendorId ||
          v.id === initialOutward.customerId ||
          v.vendorId === initialOutward.customerVendorId ||
          v.vendorId === initialOutward.customerId
        )
      );

      const isTargetPoCust = Boolean(
        targetInitialPo && (
          v.id === targetInitialPo.customerId ||
          v.id === targetInitialPo.customerVendorId ||
          v.vendorId === targetInitialPo.customerId ||
          v.vendorId === targetInitialPo.customerVendorId ||
          (v.companyName && targetInitialPo.customerName && v.companyName.trim().toLowerCase() === targetInitialPo.customerName.trim().toLowerCase()) ||
          (v.companyName && targetInitialPo.customerCompanyNameSnapshot && v.companyName.trim().toLowerCase() === targetInitialPo.customerCompanyNameSnapshot.trim().toLowerCase())
        )
      );

      if (hasEligiblePO || isInitialOutwardCust || isTargetPoCust) {
        const key = v.id || v.vendorId || v.companyName;
        customerMap.set(key, v);
      }
    }

    // 2. Ensure EVERY company name present on any eligible PO or targetInitialPo is included
    const allRelevantPos = [...eligiblePos];
    if (targetInitialPo && !allRelevantPos.some((p) => p.id === targetInitialPo.id || p.poId === targetInitialPo.poId)) {
      allRelevantPos.push(targetInitialPo);
    }

    for (const p of allRelevantPos) {
      const custName = p.customerName || p.customerCompanyNameSnapshot;
      if (!custName) continue;

      const alreadyExists = Array.from(customerMap.values()).some(
        (v) =>
          v.id === p.customerId ||
          v.vendorId === p.customerId ||
          v.id === p.customerVendorId ||
          v.vendorId === p.customerVendorId ||
          v.companyName.trim().toLowerCase() === custName.trim().toLowerCase()
      );

      if (!alreadyExists) {
        const custId = p.customerId || p.customerVendorId || `cust_${custName.replace(/\s+/g, '_')}`;
        customerMap.set(custId, {
          id: custId,
          vendorId: custId,
          vendorCode: p.customerCode || 'CUSTOMER',
          companyName: custName,
          vendorType: 'customer',
          vendorCategory: 'main_company',
          status: 'active'
        } as Vendor);
      }
    }

    return Array.from(customerMap.values()).sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [vendors, eligiblePos, initialOutward, targetInitialPo]);

  // Helper to resolve the matching customer option ID for a given PO
  const getCustomerForPo = (po: PurchaseOrder | null | undefined): string => {
    if (!po) return '';
    const matched = eligibleCustomers.find(
      (c) =>
        (po.customerId && (c.id === po.customerId || c.vendorId === po.customerId)) ||
        (po.customerVendorId && (c.id === po.customerVendorId || c.vendorId === po.customerVendorId)) ||
        (c.companyName && po.customerName && c.companyName.trim().toLowerCase() === po.customerName.trim().toLowerCase()) ||
        (c.companyName && po.customerCompanyNameSnapshot && c.companyName.trim().toLowerCase() === po.customerCompanyNameSnapshot.trim().toLowerCase())
    );
    if (matched) return matched.id || matched.vendorId || '';

    const v = vendors.find(
      (v) =>
        (po.customerId && (v.id === po.customerId || v.vendorId === po.customerId)) ||
        (po.customerVendorId && (v.id === po.customerVendorId || v.vendorId === po.customerVendorId)) ||
        (v.companyName && po.customerName && v.companyName.trim().toLowerCase() === po.customerName.trim().toLowerCase()) ||
        (v.companyName && po.customerCompanyNameSnapshot && v.companyName.trim().toLowerCase() === po.customerCompanyNameSnapshot.trim().toLowerCase())
    );
    if (v) return v.id || v.vendorId || '';

    return po.customerId || po.customerVendorId || '';
  };

  // Active Customer selection: auto-populated from editing outward OR redirected Quick Outward PO
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(() => {
    if (initialOutward?.customerVendorId || initialOutward?.customerId) {
      return initialOutward.customerVendorId || initialOutward.customerId || '';
    }
    if (targetInitialPo) {
      return getCustomerForPo(targetInitialPo);
    }
    return '';
  });

  // Active PO selection: auto-populated from editing outward OR redirected Quick Outward PO
  const [selectedPoId, setSelectedPoId] = useState<string>(() => {
    if (initialOutward?.poId) {
      return initialOutward.poId;
    }
    if (targetInitialPo) {
      return targetInitialPo.id || targetInitialPo.poId || '';
    }
    return initialPoId || '';
  });

  // Synchronize customer and PO when redirected from Quick Outward (or initialPoId / targetInitialPo updates)
  useEffect(() => {
    if (!initialOutward && targetInitialPo) {
      const resolvedPoId = targetInitialPo.id || targetInitialPo.poId;
      if (resolvedPoId && selectedPoId !== resolvedPoId) {
        setSelectedPoId(resolvedPoId);
      }
      const resolvedCustId = getCustomerForPo(targetInitialPo);
      if (resolvedCustId && selectedCustomerId !== resolvedCustId) {
        setSelectedCustomerId(resolvedCustId);
      }
    }
  }, [targetInitialPo, eligibleCustomers, initialOutward]);

  // Active Subcontractor selection
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>(
    initialOutward?.subcontractorVendorId || initialOutward?.subContractorId || ''
  );

  // Dispatch Details
  const [outwardDate, setOutwardDate] = useState<string>(
    initialOutward?.outwardDate || ''
  );
  const [ourDcNo, setOurDcNo] = useState<string>(
    initialOutward?.ourDcNo || ''
  );
  // Registered company vehicles from Vehicle Master
  const [vehiclesList, setVehiclesList] = useState<VehicleRecord[]>(() => {
    return VehicleService.getCache();
  });

  useEffect(() => {
    let isMounted = true;
    VehicleService.getVehicles()
      .then((res) => {
        if (isMounted && res) {
          setVehiclesList(res);
        }
      })
      .catch((err) => console.warn('Could not load vehicles in OutwardForm:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  const initialVeh = (initialOutward?.vehicleNumber || initialOutward?.vehicleNo || '').trim();
  const [selectedVehicleOption, setSelectedVehicleOption] = useState<string>('');
  const [customVehicleNumber, setCustomVehicleNumber] = useState<string>('');

  useEffect(() => {
    if (initialVeh) {
      const matched = vehiclesList.find(
        (v) => v.vehicleNo.replace(/\s+/g, '').toUpperCase() === initialVeh.replace(/\s+/g, '').toUpperCase()
      );
      if (matched) {
        setSelectedVehicleOption(matched.vehicleNo);
        setCustomVehicleNumber('');
      } else if (vehiclesList.length > 0) {
        setSelectedVehicleOption('others');
        setCustomVehicleNumber(initialVeh);
      }
    }
  }, [vehiclesList, initialVeh]);

  const effectiveVehicleNumber =
    selectedVehicleOption === 'others'
      ? customVehicleNumber.trim()
      : selectedVehicleOption.trim();

  const handleVehicleOptionChange = (value: string) => {
    setSelectedVehicleOption(value);
    if (value !== 'others') {
      setCustomVehicleNumber('');
      const selectedVeh = vehiclesList.find((v) => v.vehicleNo === value);
      if (selectedVeh?.driverName && !driverName.trim()) {
        setDriverName(selectedVeh.driverName);
      }
    }
  };
  const [driverName, setDriverName] = useState<string>(
    initialOutward?.driverName || ''
  );
  const [transporterVendorId, setTransporterVendorId] = useState<string>(() => {
    if (initialOutward?.transporterVendorId) return initialOutward.transporterVendorId;
    if (initialOutward && !initialOutward.transporterVendorId && initialOutward.transporterNameSnapshot) return 'in_house';
    return '';
  });
  const [destination, setDestination] = useState<string>(
    initialOutward?.destination || ''
  );
  const [remarks, setRemarks] = useState<string>(initialOutward?.remarks || '');

  // Dispatch quantity map: { [poLineId]: number }
  const [dispatchQtyMap, setDispatchQtyMap] = useState<Record<string, number>>({});

  // Balances response
  const [balances, setBalances] = useState<OutwardBalancesResponse | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [toastErrors, setToastErrors] = useState<string[]>([]);
  const [showToast, setShowToast] = useState<boolean>(false);

  // Active transporters
  const eligibleTransporters = useMemo(() => {
    return vendors.filter(
      (v) =>
        (v as any).vendorCategory === 'transport' ||
        v.vendorType === 'supplier' ||
        v.companyName.toLowerCase().includes('transport') ||
        v.companyName.toLowerCase().includes('logistics')
    );
  }, [vendors]);

  // Find currently selected PO
  const activePo = useMemo(() => {
    return eligiblePos.find((p) => p.id === selectedPoId || p.poId === selectedPoId) ||
           allPosWithInwardSources.find((p) => p.id === selectedPoId || p.poId === selectedPoId) ||
           pos.find((p) => p.id === selectedPoId || p.poId === selectedPoId);
  }, [eligiblePos, allPosWithInwardSources, pos, selectedPoId]);

  // Find eligible subcontractors: ONLY show the selected parent's subcompany/subcontractor!
  const eligibleSubcontractors = useMemo(() => {
    if (!selectedCustomerId) return [];
    return vendors.filter(
      (v) => v.parentVendorId === selectedCustomerId
    );
  }, [vendors, selectedCustomerId]);

  // Removed auto-generating useEffect so Our DC Number starts completely empty without predefined data

  // Load balances when active PO changes
  useEffect(() => {
    if (!selectedPoId) {
      setBalances(null);
      return;
    }

    let isMounted = true;
    setIsLoadingBalances(true);

    OutwardService.getOutwardBalances(selectedPoId, initialOutward?.id)
      .then((res) => {
        if (!isMounted) return;
        setBalances(res);

        // Prepopulate dispatch quantity from initial outward lines if editing
        if (initialOutward?.lines && initialOutward.lines.length > 0) {
          const map: Record<string, number> = {};
          for (const l of initialOutward.lines) {
            map[l.poLineId] = Number(l.dispatchQty) || 0;
          }
          setDispatchQtyMap(map);
        }
      })
      .catch((err) => {
        console.error('Failed to load outward balances:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingBalances(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPoId, initialOutward]);

  // Customer dropdown groups
  const customerOptionGroups: SelectOptionGroup[] = useMemo(() => {
    const list: SelectOption[] = eligibleCustomers.map((c) => ({
      id: c.id || c.vendorId || '',
      primaryText: c.companyName,
      secondaryText: c.vendorCode ? `Code: ${c.vendorCode}` : undefined,
      badge: c.vendorType === 'both' ? 'Customer & Supplier' : 'Customer',
      badgeVariant: 'blue',
      meta: c
    }));

    return [{ options: list }];
  }, [eligibleCustomers]);

  // Currently selected customer object (if any)
  const selectedCustomer = useMemo(() => {
    return eligibleCustomers.find(
      (c) => c.id === selectedCustomerId || c.vendorId === selectedCustomerId
    );
  }, [eligibleCustomers, selectedCustomerId]);

  // Clear selected PO if it is no longer in eligiblePos
  useEffect(() => {
    if (selectedPoId && !initialOutward) {
      // Do not clear if it matches the preselected targetInitialPo or initialPoId
      if (
        initialPoId &&
        (selectedPoId === initialPoId ||
         (targetInitialPo && (targetInitialPo.id === selectedPoId || targetInitialPo.poId === selectedPoId)))
      ) {
        return;
      }
      const isEligible = eligiblePos.some((p) => p.id === selectedPoId || p.poId === selectedPoId);
      if (!isEligible) {
        setSelectedPoId('');
        setDispatchQtyMap({});
      }
    }
  }, [eligiblePos, selectedPoId, initialOutward, initialPoId, targetInitialPo]);

  // PO dropdown groups with cross-company discovery
  const poOptionGroups: SelectOptionGroup[] = useMemo(() => {
    const matchingCurrentCustomer: SelectOption[] = [];
    const otherCustomers: SelectOption[] = [];

    for (const p of eligiblePos) {
      const isCurrentCustomer =
        Boolean(selectedCustomerId) &&
        (p.customerId === selectedCustomerId ||
         p.customerVendorId === selectedCustomerId ||
         (selectedCustomer && (
           (selectedCustomer.id && (p.customerId === selectedCustomer.id || p.customerVendorId === selectedCustomer.id)) ||
           (selectedCustomer.vendorId && (p.customerId === selectedCustomer.vendorId || p.customerVendorId === selectedCustomer.vendorId)) ||
           (p.customerName && p.customerName.trim().toLowerCase() === selectedCustomer.companyName.trim().toLowerCase()) ||
           (p.customerCompanyNameSnapshot && p.customerCompanyNameSnapshot.trim().toLowerCase() === selectedCustomer.companyName.trim().toLowerCase())
         )));

      const bal =
        poBalanceMap[p.id] ||
        poBalanceMap[p.poId || ''] ||
        (p.poNumber ? poBalanceMap[p.poNumber.trim().toLowerCase()] : null);
      const availText =
        bal && bal.availableQty > 0
          ? `Available Inward: ${bal.availableQty} ${bal.primaryUnit}`
          : 'Available Inward';

      const optionId = p.id || p.poId || '';
      const option: SelectOption = {
        id: optionId,
        primaryText: `Style: ${p.styleNo || 'N/A'} — ${p.poNumber}`,
        primaryNode: (
          <span className="flex items-center gap-1.5 truncate">
            <span className="text-xs text-slate-900 truncate">
              Style: <strong className="font-extrabold text-slate-950">{p.styleNo || 'N/A'}</strong>
            </span>
            <span className="text-slate-300 font-light">—</span>
            <span className="text-[11px] text-slate-500 font-normal shrink-0">{p.poNumber}</span>
          </span>
        ),
        secondaryText: `${availText} • ${p.customerName || 'Customer'}`,
        badge: isCurrentCustomer ? (selectedCustomer?.companyName || 'Selected Company') : (p.customerName || 'Other Company'),
        badgeVariant: isCurrentCustomer ? 'emerald' : 'slate',
        meta: p
      };

      if (isCurrentCustomer) {
        matchingCurrentCustomer.push(option);
      } else {
        otherCustomers.push(option);
      }
    }

    const groups: SelectOptionGroup[] = [];
    if (selectedCustomerId) {
      if (matchingCurrentCustomer.length > 0) {
        groups.push({
          title: selectedCustomer
            ? `Purchase Orders for ${selectedCustomer.companyName} (Available Stock)`
            : 'Purchase Orders For Selected Company (Available Stock)',
          isHighlighted: true,
          options: matchingCurrentCustomer
        });
      }
      if (otherCustomers.length > 0) {
        groups.push({
          title: 'Other Available Purchase Orders',
          options: otherCustomers
        });
      }
    } else {
      if (matchingCurrentCustomer.length > 0 || otherCustomers.length > 0) {
        groups.push({
          title: `All Available Style Numbers / Purchase Orders (${eligiblePos.length})`,
          options: [...matchingCurrentCustomer, ...otherCustomers]
        });
      }
    }

    return groups;
  }, [eligiblePos, selectedCustomerId, selectedCustomer, poBalanceMap]);

  const handleSelectCustomer = (opt: SelectOption) => {
    setSelectedCustomerId(opt.id);
    setSelectedSubcontractorId('');
    // Check if currently selected PO belongs to this customer
    const isPoForCustomer = activePo && (
      activePo.customerId === opt.id ||
      activePo.customerVendorId === opt.id ||
      (activePo.customerName && activePo.customerName.trim().toLowerCase() === opt.primaryText.trim().toLowerCase()) ||
      (activePo.customerCompanyNameSnapshot && activePo.customerCompanyNameSnapshot.trim().toLowerCase() === opt.primaryText.trim().toLowerCase())
    );
    if (!isPoForCustomer) {
      setSelectedPoId('');
      setDispatchQtyMap({});
    }
    setValidationError(null);
  };

  const handleSelectPO = (opt: SelectOption) => {
    const po = opt.meta as PurchaseOrder;
    if (po) {
      setSelectedPoId(po.id);
      // Automatically select customer matching this PO
      const matchingCust = eligibleCustomers.find(
        (c) =>
          c.id === po.customerId ||
          c.vendorId === po.customerId ||
          c.id === po.customerVendorId ||
          c.vendorId === po.customerVendorId ||
          (c.companyName && (
            c.companyName.trim().toLowerCase() === (po.customerName || '').trim().toLowerCase() ||
            c.companyName.trim().toLowerCase() === (po.customerCompanyNameSnapshot || '').trim().toLowerCase()
          ))
      );
      if (matchingCust) {
        setSelectedCustomerId(matchingCust.id || matchingCust.vendorId || '');
      } else if (po.customerId || po.customerVendorId) {
        setSelectedCustomerId(po.customerId || po.customerVendorId || '');
      }
      setSelectedSubcontractorId('');
      setDispatchQtyMap({});
      setValidationError(null);
    }
  };

  const handleDispatchQtyChange = (poLineId: string, value: string) => {
    const numericValue = value === '' ? 0 : Number(value);
    if (isNaN(numericValue) || numericValue < 0) return;

    setDispatchQtyMap((prev) => ({
      ...prev,
      [poLineId]: numericValue
    }));
    setValidationError(null);
  };

  // Calculate live totals grouped strictly by Unit
  const liveTotals = useMemo(() => {
    let pieceDispatched = 0;
    let kgDispatched = 0;
    let totalAvailablePieces = 0;
    let totalAvailableKg = 0;

    if (activePo && balances) {
      for (const poLine of activePo.lines || []) {
        const lineId = poLine.lineId;
        const lineBal = balances.lines[lineId];
        const disp = Number(dispatchQtyMap[lineId]) || 0;
        const avail = lineBal ? lineBal.availableForDispatch : 0;

        if (poLine.unit === 'kg') {
          kgDispatched += disp;
          totalAvailableKg += avail;
        } else {
          pieceDispatched += disp;
          totalAvailablePieces += avail;
        }
      }
    }

    return {
      pieceDispatched,
      kgDispatched: Math.round(kgDispatched * 100) / 100,
      totalAvailablePieces,
      totalAvailableKg: Math.round(totalAvailableKg * 100) / 100
    };
  }, [activePo, balances, dispatchQtyMap]);

  // Prepare payload & validation
  const validateForm = () => {
    const errors: string[] = [];

    if (!selectedCustomerId) {
      errors.push('Customer / Company selection is required.');
    }
    if (!selectedPoId || !activePo) {
      errors.push('Purchase Order selection is required.');
    }
    if (!outwardDate) {
      errors.push('Outward Dispatch Date is required.');
    }
    if (!ourDcNo || !ourDcNo.trim()) {
      errors.push('Our Delivery Challan (DC) Number is required.');
    }
    if (!effectiveVehicleNumber) {
      errors.push(
        selectedVehicleOption === 'others'
          ? 'Vehicle Number is required (custom vehicle).'
          : 'Vehicle Number selection is required.'
      );
    }
    if (!driverName || !driverName.trim()) {
      errors.push('Driver Name is required.');
    }
    if (!transporterVendorId) {
      errors.push('Transporter / Logistics Vendor selection is required.');
    }
    if (!destination || !destination.trim()) {
      errors.push('Dispatch Destination is required.');
    }

    if (activePo) {
      const hasPositive = (activePo.lines || []).some((l) => (Number(dispatchQtyMap[l.lineId]) || 0) > 0);
      if (!hasPositive) {
        errors.push('At least one colour line must have a dispatch quantity greater than 0 before posting.');
      }

      // Rule: Cannot exceed available inward balance
      if (balances) {
        for (const poLine of activePo.lines || []) {
          const lineBal = balances.lines[poLine.lineId];
          const cumInw = lineBal ? lineBal.cumulativeInwardQty : 0;
          const prevOut = lineBal ? lineBal.cumulativeOutwardQty : 0;
          const avail = Math.max(0, cumInw - prevOut);
          const disp = Number(dispatchQtyMap[poLine.lineId]) || 0;
          if (disp > avail) {
            errors.push(
              `Cannot dispatch ${disp} ${poLine.unit || 'piece'} for "${poLine.colourName}". Available received balance is only ${avail} ${poLine.unit || 'piece'}.`
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      setToastErrors(errors);
      setShowToast(true);
      setValidationError(errors[0]);
      return false;
    }

    setToastErrors([]);
    setShowToast(false);
    setValidationError(null);
    return true;
  };

  const preparePayload = () => {
    const poLines = (activePo?.colourLines || activePo?.lines || []);
    const lines = poLines.map((poLine) => {
      const lineId = poLine.lineId || (poLine as any).id;
      const lineBal = balances?.lines[lineId];
      const cumInw = lineBal ? lineBal.cumulativeInwardQty : 0;
      const prevOut = lineBal ? lineBal.cumulativeOutwardQty : 0;
      const avail = Math.max(0, cumInw - prevOut);
      const disp = Number(dispatchQtyMap[lineId]) || 0;
      const rem = Math.max(0, avail - disp);

      return {
        poLineId: lineId,
        colourNameSnapshot: poLine.colourName,
        colourCodeSnapshot: poLine.colourCode || null,
        itemNameSnapshot: activePo!.itemName || 'Garments',
        washTypeSnapshot: poLine.processType || 'Standard Wash',
        orderedQtySnapshot: Number(poLine.quantity) || 0,
        unit: poLine.unit || 'piece',
        cumulativeInwardQtySnapshot: cumInw,
        previouslyDispatchedQtySnapshot: prevOut,
        availableForDispatchSnapshot: avail,
        dispatchQty: disp,
        remainingAfterDispatchSnapshot: rem
      };
    });

    return {
      customerVendorId: selectedCustomerId,
      subcontractorVendorId: selectedSubcontractorId || null,
      poId: selectedPoId,
      outwardDate,
      ourDcNo: ourDcNo.trim(),
      vehicleNumber: effectiveVehicleNumber,
      driverName: driverName.trim(),
      transporterVendorId: transporterVendorId === 'in_house' ? null : transporterVendorId,
      destination: destination.trim(),
      remarks: remarks.trim() || undefined,
      lines
    };
  };

  const handlePostClick = async () => {
    if (!validateForm()) return;
    try {
      setValidationError(null);
      const data = preparePayload();
      await onPostOutward(data);
    } catch (err: any) {
      const msg = err.message || 'Failed to post outward entry.';
      setToastErrors([msg]);
      setShowToast(true);
      setValidationError(msg);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification for Unfilled / Compulsory Missing Fields */}
      <ValidationToast
        isOpen={showToast}
        onClose={() => setShowToast(false)}
        title="Cannot Post Outward Dispatch"
        subtitle="Please fill all compulsory fields to submit:"
        errors={toastErrors}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            data-back-button="true"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Back to Outward Dispatches (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#1F4E79]">
              {initialOutward ? `Edit Outward Dispatch (${initialOutward.outwardNo})` : 'New Outward Dispatch Entry'}
            </h2>
            <p className="text-xs text-slate-500">
              Record colour-wise dispatches validated against posted received inward balance
            </p>
          </div>
        </div>
      </div>

      {/* Validation Alert */}
      {validationError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Validation Error</p>
            <p className="mt-0.5 text-rose-700">{validationError}</p>
          </div>
        </div>
      )}

      {/* Section 1: Customer & Purchase Order Selection (Relative container to allow dropdown popups) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-6 relative z-30">
        <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
          <Building className="w-4 h-4 text-[#1F4E79]" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            1. Customer & Purchase Order Selection
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Company / Customer */}
          <SearchableSelect
            label="Customer / Company"
            required
            value={selectedCustomerId}
            placeholder=""
            searchPlaceholder=""
            groups={customerOptionGroups}
            onSelect={handleSelectCustomer}
            helperText="Shows companies with available inward stock ready for outward dispatch"
          />

          {/* Subcontractor / Subcompany */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
               Subcontractor / Subcompany (Optional)
            </label>
            <select
              value={selectedSubcontractorId}
              onChange={(e) => setSelectedSubcontractorId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value=""></option>
              <option value="direct">Direct Dispatch to Customer</option>
              {eligibleSubcontractors.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.companyName} {sub.vendorCategory ? `(${sub.vendorCategory})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {eligibleSubcontractors.length > 0
                ? `Only showing subcompanies of selected customer (${eligibleSubcontractors.length} found)`
                : 'No subcompany registered under selected customer'}
            </p>
          </div>

          {/* Purchase Order Selection */}
          <SearchableSelect
            label="Purchase Order"
            required
            value={selectedPoId}
            placeholder=""
            searchPlaceholder=""
            groups={poOptionGroups}
            onSelect={handleSelectPO}
            formatTriggerLabel={(opt) => {
              const p = opt.meta as any;
              if (p) {
                const sNo = p.styleNo || p.styleNumber || '—';
                return (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-xs text-slate-900 font-bold">Style: {sNo}</span>
                    <span className="text-slate-300 font-light">—</span>
                    <span className="text-xs text-slate-600 font-mono font-medium">{p.poNumber}</span>
                  </span>
                );
              }
              return <span className="whitespace-nowrap">{opt.primaryText}</span>;
            }}
            helperText={
              selectedCustomerId
                ? "Shows PO numbers with available inward stock for the selected company"
                : "Shows all PO numbers with available inward stock ready for dispatch"
            }
          />
        </div>

        {/* PO Read-Only Snapshot Banner */}
        {activePo && (
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Style Number</p>
              <p className="font-bold text-slate-900 mt-0.5">{activePo.styleNo || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Item Name</p>
              <p className="font-semibold text-slate-900 mt-0.5">{activePo.itemName || 'Garments'}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Process Category</p>
              <p className="font-semibold uppercase text-slate-900 mt-0.5">
                {activePo.processCategory || 'washing'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Order Date</p>
              <p className="font-semibold text-slate-900 mt-0.5">{formatDate(activePo.orderDate)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Delivery Challan & Logistics Information */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-6">
        <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#1F4E79]" />
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            2. Delivery Challan & Logistics Details
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Outward Dispatch Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Outward Dispatch Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={outwardDate}
              onChange={(e) => setOutwardDate(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
            <p className="text-[11px] text-slate-400 mt-1">Date when garments leave factory</p>
          </div>

          {/* Our DC Number */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Our DC Number <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={async () => {
                  const dc = await OutwardService.generateOurDcNumber(outwardDate);
                  setOurDcNo(dc);
                }}
                className="text-[10px] font-semibold text-[#1F4E79] hover:underline cursor-pointer"
              >
                Auto-generate DC #
              </button>
            </div>
            <input
              type="text"
              placeholder=""
              value={ourDcNo}
              onChange={(e) => setOurDcNo(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
            <p className="text-[11px] text-slate-400 mt-1">Internal Delivery Challan Reference</p>
          </div>

          {/* Vehicle Number Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vehicle Number <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={selectedVehicleOption}
              onChange={(e) => handleVehicleOptionChange(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value=""></option>
              {vehiclesList.map((v) => (
                <option key={v.id || v.vehicleNo} value={v.vehicleNo}>
                  {v.vehicleNo} {v.typeOfVehicle ? `(${v.typeOfVehicle})` : ''} {v.modelMake ? `— ${v.modelMake}` : ''}
                </option>
              ))}
              <option value="others">Others</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">Vehicle used for transport</p>
          </div>

          {/* If Others is selected: Custom Vehicle Number Input */}
          {selectedVehicleOption === 'others' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Enter Vehicle Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder=""
                value={customVehicleNumber}
                onChange={(e) => setCustomVehicleNumber(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79] font-medium text-slate-900"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Custom vehicle for this dispatch (not added to Vehicle Master)
              </p>
            </div>
          )}

          {/* Driver Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Driver Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder=""
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>

          {/* Transporter / Vendor */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transporter / Vendor <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={transporterVendorId}
              onChange={(e) => setTransporterVendorId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            >
              <option value=""></option>
              <option value="in_house">In-House / Customer Logistics</option>
              {eligibleTransporters.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.companyName}
                </option>
              ))}
            </select>
          </div>

          {/* Dispatch Destination */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dispatch Destination <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder=""
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Dispatch Remarks / Quality Notes (Optional)
          </label>
          <textarea
            rows={2}
            placeholder=""
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
          />
        </div>
      </div>

      {/* Section 3: Colour-Wise Outward Quantity Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#1F4E79]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              3. Colour-Wise Outward Quantity Breakdown
            </h3>
          </div>

          {/* Summary Badges */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-slate-100 rounded-lg font-medium text-slate-700">
              Total Dispatch:{' '}
              <strong className="text-slate-900">
                {liveTotals.pieceDispatched.toLocaleString()} pcs
              </strong>
              {liveTotals.kgDispatched > 0 && (
                <strong className="text-amber-800 ml-1.5">
                  / {liveTotals.kgDispatched.toLocaleString()} kg
                </strong>
              )}
            </span>
          </div>
        </div>

        {!activePo ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            Please select a Purchase Order above to load its colour lines and available inward quantities.
          </div>
        ) : isLoadingBalances ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading inward & outward balances...</div>
        ) : !((activePo.colourLines && activePo.colourLines.length > 0) || (activePo.lines && activePo.lines.length > 0)) ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No colour lines found on Purchase Order {activePo.poNumber}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="p-2.5 border border-slate-200 text-center w-12">S.No.</th>
                  <th className="p-2.5 border border-slate-200 min-w-[150px]">Colour</th>
                  <th className="p-2.5 border border-slate-200">Process</th>
                  <th className="p-2.5 border border-slate-200 text-right">Ordered Qty</th>
                  <th className="p-2.5 border border-slate-200 text-center w-16">Unit</th>
                  <th className="p-2.5 border border-slate-200 text-right">Total Inward</th>
                  <th className="p-2.5 border border-slate-200 text-right">Prev Dispatched</th>
                  <th className="p-2.5 border border-slate-200 text-right bg-emerald-50/50 text-emerald-900 font-bold">Available Qty</th>
                  <th className="p-2.5 border border-slate-200 text-right bg-blue-50/60 text-blue-900 font-bold w-36">Current Dispatch</th>
                  <th className="p-2.5 border border-slate-200 text-right w-28">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(activePo.colourLines || activePo.lines || []).map((poLine, idx) => {
                  const lineId = poLine.lineId || (poLine as any).id;
                  const lineBal = balances?.lines[lineId];
                  const orderedQty = Number(poLine.quantity) || 0;
                  const cumInward = lineBal ? lineBal.cumulativeInwardQty : 0;
                  const prevOutward = lineBal ? lineBal.cumulativeOutwardQty : 0;
                  const available = Math.max(0, cumInward - prevOutward);

                  const dispatchQty = Number(dispatchQtyMap[lineId]) || 0;
                  const remaining = Math.max(0, available - dispatchQty);
                  const isOverDispatch = dispatchQty > available;

                  return (
                    <tr
                      key={lineId}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isOverDispatch ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      {/* S.No */}
                      <td className="p-2.5 border border-slate-200 text-center text-slate-500 font-medium">
                        {idx + 1}
                      </td>

                      {/* Colour */}
                      <td className="p-2.5 border border-slate-200 font-semibold text-slate-900">
                        {poLine.colourName}
                        {poLine.colourCode && (
                          <span className="block text-[11px] text-slate-400 font-normal">
                            Code: {poLine.colourCode}
                          </span>
                        )}
                      </td>

                      {/* Process */}
                      <td className="p-2.5 border border-slate-200 text-slate-600">
                        {poLine.processType || 'Standard Wash'}
                      </td>

                      {/* Ordered Qty */}
                      <td className="p-2.5 border border-slate-200 text-right font-medium text-slate-700">
                        {orderedQty.toLocaleString()}
                      </td>

                      {/* Unit */}
                      <td className="p-2.5 border border-slate-200 text-center text-slate-500 font-medium uppercase text-[10px]">
                        {poLine.unit}
                      </td>

                      {/* Total Inward */}
                      <td className="p-2.5 border border-slate-200 text-right font-medium text-slate-700">
                        {cumInward.toLocaleString()}
                      </td>

                      {/* Previously Dispatched */}
                      <td className="p-2.5 border border-slate-200 text-right text-slate-500">
                        {prevOutward.toLocaleString()}
                      </td>

                      {/* Available Qty */}
                      <td className="p-2.5 border border-slate-200 text-right font-bold text-emerald-700 bg-emerald-50/30">
                        {available.toLocaleString()}
                      </td>

                      {/* Current Dispatch Input */}
                      <td className="p-2 border border-slate-200 bg-blue-50/30">
                        <input
                          type="number"
                          min="0"
                          max={available}
                          step={poLine.unit === 'kg' ? '0.01' : '1'}
                          placeholder=""
                          value={
                            dispatchQtyMap[lineId] === 0
                              ? ''
                              : (dispatchQtyMap[lineId] ?? '')
                          }
                          onChange={(e) => handleDispatchQtyChange(lineId, e.target.value)}
                          disabled={available <= 0}
                          className={`w-full text-right p-1.5 rounded-lg border text-xs font-bold focus:outline-none focus:ring-1 ${
                            isOverDispatch
                              ? 'border-rose-400 text-rose-700 bg-rose-50 focus:ring-rose-500'
                              : available <= 0
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                              : 'border-slate-300 text-slate-900 bg-white focus:ring-[#1F4E79]'
                          }`}
                        />
                        {isOverDispatch && (
                          <span className="block text-[10px] text-rose-600 font-semibold text-right mt-0.5">
                            Exceeds available!
                          </span>
                        )}
                      </td>

                      {/* Remaining After Dispatch */}
                      <td
                        className={`p-2.5 border border-slate-200 text-right font-semibold ${
                          remaining === 0 && available > 0
                            ? 'text-emerald-700'
                            : 'text-[#1F4E79]'
                        }`}
                      >
                        {remaining.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Action Buttons */}
      <div className="flex justify-end items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving} className="text-xs">
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handlePostClick}
          icon={<CheckCircle2 className="w-4 h-4" />}
          loading={isSaving}
          loadingText="Posting Dispatch..."
          className="bg-black hover:bg-slate-900 text-white border-black text-xs font-semibold shadow-xs cursor-pointer"
        >
          Post Outward Dispatch
        </Button>
      </div>

      <LoadingOverlay
        isOpen={isSaving}
        title="Posting Outward Dispatch..."
        message="Generating Delivery Challan, validating quantities, and updating dispatch balances..."
      />
    </div>
  );
};
