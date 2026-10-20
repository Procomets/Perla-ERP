import React, { useState, useEffect, useMemo } from 'react';
import { PurchaseOrder } from '../../../types/po';
import { Vendor } from '../../../types/vendor';
import { InwardEntry } from '../../../types/inward';
import { OutwardEntry, OutwardBalancesResponse } from '../../../types/outward';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { formatDate } from '../../../utils/formatters';
import { OutwardService } from '../../../services/outwardService';
import { SearchableSelect, SelectOption, SelectOptionGroup } from '../../inward/components/SearchableSelect';
import {
  ArrowLeft,
  CheckCircle2,
  FileClock,
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
  onSaveDraft: (data: any) => Promise<void>;
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
  }, [allPosWithInwardSources, poBalanceMap, initialOutward]);

  // All Customer companies: ONLY show companies that have at least one PO with available inward balance!
  const eligibleCustomers = useMemo(() => {
    const customerMap = new Map<string, Vendor>();

    // 1. Add vendors from master vendors list that match an eligible PO (which has available inward balance)
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

      if (hasEligiblePO || (initialOutward && (v.id === initialOutward.customerVendorId || v.id === initialOutward.customerId))) {
        const key = v.id || v.vendorId || v.companyName;
        customerMap.set(key, v);
      }
    }

    // 2. Ensure EVERY company name present on any eligible PO is included
    for (const p of eligiblePos) {
      const custName = p.customerName || p.customerCompanyNameSnapshot;
      if (!custName) continue;

      const alreadyExists = Array.from(customerMap.values()).some(
        (v) =>
          v.id === p.customerId ||
          v.vendorId === p.customerId ||
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
  }, [vendors, eligiblePos, initialOutward]);

  // Active Customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialOutward?.customerVendorId || initialOutward?.customerId || ''
  );

  // Active PO selection
  const [selectedPoId, setSelectedPoId] = useState<string>(
    initialOutward?.poId || ''
  );

  // Active Subcontractor selection
  const [selectedSubcontractorId, setSelectedSubcontractorId] = useState<string>(
    initialOutward?.subcontractorVendorId || initialOutward?.subContractorId || ''
  );

  // Dispatch Details
  const [outwardDate, setOutwardDate] = useState<string>(
    initialOutward?.outwardDate || new Date().toISOString().split('T')[0]
  );
  const [ourDcNo, setOurDcNo] = useState<string>(
    initialOutward?.ourDcNo || ''
  );
  const [vehicleNumber, setVehicleNumber] = useState<string>(
    initialOutward?.vehicleNumber || initialOutward?.vehicleNo || ''
  );
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

  // Generate default Our DC Number if empty
  useEffect(() => {
    if (!ourDcNo && !initialOutward) {
      OutwardService.generateOurDcNumber(outwardDate).then((dc) => {
        setOurDcNo(dc);
      });
    }
  }, [outwardDate, initialOutward]);

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
      const isEligible = eligiblePos.some((p) => p.id === selectedPoId || p.poId === selectedPoId);
      if (!isEligible) {
        setSelectedPoId('');
        setDispatchQtyMap({});
      }
    }
  }, [eligiblePos, selectedPoId, initialOutward]);

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

      const option: SelectOption = {
        id: p.id,
        primaryText: p.poNumber,
        secondaryText: `Style: ${p.styleNo || 'N/A'} • ${availText} • ${p.customerName || 'Customer'}`,
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
        title: selectedCustomerId
          ? 'Purchase Orders From Other Companies (Auto-Switches Company)'
          : 'All Available Purchase Orders (With Available Inward Stock)',
        options: otherCustomers
      });
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

  // Prepare payload
  const preparePayload = () => {
    if (!selectedCustomerId) {
      throw new Error('Please select a Customer / Company.');
    }
    if (!selectedPoId || !activePo) {
      throw new Error('Please select an eligible Purchase Order.');
    }
    if (!outwardDate) {
      throw new Error('Please enter the Outward Dispatch Date.');
    }
    if (!ourDcNo.trim()) {
      throw new Error('Please enter Our Delivery Challan Number.');
    }
    if (!vehicleNumber.trim()) {
      throw new Error('Please enter the Vehicle Number.');
    }
    if (!driverName.trim()) {
      throw new Error('Please enter the Driver Name.');
    }
    if (!transporterVendorId) {
      throw new Error('Please select a Transporter / Logistics Vendor.');
    }
    if (!destination.trim()) {
      throw new Error('Please enter the Dispatch Destination.');
    }

    const lines = (activePo.lines || []).map((poLine) => {
      const lineBal = balances?.lines[poLine.lineId];
      const cumInw = lineBal ? lineBal.cumulativeInwardQty : 0;
      const prevOut = lineBal ? lineBal.cumulativeOutwardQty : 0;
      const avail = Math.max(0, cumInw - prevOut);
      const disp = Number(dispatchQtyMap[poLine.lineId]) || 0;
      const rem = Math.max(0, avail - disp);

      return {
        poLineId: poLine.lineId,
        colourNameSnapshot: poLine.colourName,
        colourCodeSnapshot: poLine.colourCode || null,
        itemNameSnapshot: activePo.itemName || 'Garments',
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
      vehicleNumber: vehicleNumber.trim(),
      driverName: driverName.trim(),
      transporterVendorId: transporterVendorId === 'in_house' ? null : transporterVendorId,
      destination: destination.trim(),
      remarks: remarks.trim() || undefined,
      lines
    };
  };

  const handleSaveDraftClick = async () => {
    try {
      setValidationError(null);
      const data = preparePayload();
      await onSaveDraft(data);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save draft outward entry.');
    }
  };

  const handlePostClick = async () => {
    try {
      setValidationError(null);
      const data = preparePayload();

      // Rule 1: Positive dispatch check
      const hasPositive = data.lines.some((l) => l.dispatchQty > 0);
      if (!hasPositive) {
        throw new Error('At least one colour line must have a dispatch quantity greater than 0 before posting.');
      }

      // Rule 2: Cannot exceed available inward balance
      for (const line of data.lines) {
        if (line.dispatchQty > line.availableForDispatchSnapshot) {
          throw new Error(
            `Cannot dispatch ${line.dispatchQty} ${line.unit} for "${line.colourNameSnapshot}". Available received balance is only ${line.availableForDispatchSnapshot} ${line.unit}.`
          );
        }
      }

      await onPostOutward(data);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to post outward entry.');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {initialOutward ? `Edit Outward Dispatch (${initialOutward.outwardNo})` : 'New Outward Dispatch Entry'}
            </h2>
            <p className="text-xs text-slate-500">
              Record colour-wise dispatches validated against posted received inward balance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving} className="text-xs">
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraftClick}
            disabled={isSaving}
            className="text-xs flex items-center gap-1.5 border-slate-300"
          >
            <FileClock className="w-3.5 h-3.5" />
            Save Draft
          </Button>
          <Button
            size="sm"
            onClick={handlePostClick}
            disabled={isSaving}
            className="bg-black hover:bg-neutral-800 text-white border-black text-xs flex items-center gap-1.5 font-semibold"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSaving ? 'Posting...' : 'Post Outward Dispatch'}
          </Button>
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
            placeholder="Select customer company..."
            searchPlaceholder="Search customer by name or code..."
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
              <option value="">Direct Dispatch to Customer</option>
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
            placeholder="Select purchase order..."
            searchPlaceholder="Search by PO Number or Style No..."
            groups={poOptionGroups}
            onSelect={handleSelectPO}
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Our DC Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. DC-PERLA-1041"
              value={ourDcNo}
              onChange={(e) => setOurDcNo(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
            <p className="text-[11px] text-slate-400 mt-1">Internal Delivery Challan Reference</p>
          </div>

          {/* Vehicle Number */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Vehicle Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. TN-22-BA-4512"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
            />
            <p className="text-[11px] text-slate-400 mt-1">Vehicle used for transport</p>
          </div>

          {/* Driver Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Driver Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Murugan K."
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
              <option value="">Select Transporter / Vendor...</option>
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
              placeholder="e.g. Thirumudivakkam to Ambattur"
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
            placeholder="Add any specific delivery instructions, carton count, or inspection remarks..."
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
        ) : !activePo.lines || activePo.lines.length === 0 ? (
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
                {activePo.lines.map((poLine, idx) => {
                  const lineBal = balances?.lines[poLine.lineId];
                  const orderedQty = Number(poLine.quantity) || 0;
                  const cumInward = lineBal ? lineBal.cumulativeInwardQty : 0;
                  const prevOutward = lineBal ? lineBal.cumulativeOutwardQty : 0;
                  const available = Math.max(0, cumInward - prevOutward);

                  const dispatchQty = Number(dispatchQtyMap[poLine.lineId]) || 0;
                  const remaining = Math.max(0, available - dispatchQty);
                  const isOverDispatch = dispatchQty > available;

                  return (
                    <tr
                      key={poLine.lineId}
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
                          placeholder="0"
                          value={dispatchQtyMap[poLine.lineId] ?? ''}
                          onChange={(e) => handleDispatchQtyChange(poLine.lineId, e.target.value)}
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
      <div className="flex justify-end items-center gap-3 pt-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving} className="text-xs">
          Cancel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveDraftClick}
          disabled={isSaving}
          className="text-xs flex items-center gap-1.5 border-slate-300"
        >
          <FileClock className="w-3.5 h-3.5" />
          Save Draft
        </Button>
        <Button
          size="sm"
          onClick={handlePostClick}
          disabled={isSaving}
          className="bg-black hover:bg-neutral-800 text-white border-black text-xs flex items-center gap-1.5 font-semibold shadow-2xs"
        >
          <CheckCircle2 className="w-4 h-4" />
          {isSaving ? 'Posting...' : 'Post Outward Dispatch'}
        </Button>
      </div>
    </div>
  );
};
