import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RotateCcw,
  X,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Calendar,
  FileText,
  Printer
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Vendor } from '../../types/vendor';
import { SamplePoInward, SamplePoOutward } from '../../types/samplePo';
import {
  SampleInvoice,
  SampleInvoiceItem,
  SampleInvoiceGstMode
} from '../../types/sampleInvoice';
import { CompanyInvoiceSettings } from '../../types/invoice';
import { SamplePoService } from '../../services/samplePoService';
import { SampleInvoiceService } from '../../services/sampleInvoiceService';
import { SampleInvoicePdfService } from '../../services/sampleInvoicePdfService';
import { InvoiceSettingsService, DEFAULT_INVOICE_SETTINGS } from '../../services/invoiceSettingsService';
import { convertNumberToIndianWords } from '../../utils/taxCalculations';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import {
  TableMaximizeWrapper,
  TableTotalsFooter
} from '../../components/ui/TableMaximizeWrapper';

interface SampleInvoicePageProps {
  vendors?: Vendor[];
}

interface EligibleSampleOutwardLine {
  key: string; // `${outwardId}__${itemId}`
  outwardId: string;
  outwardEntryNumber: string;
  inwardId: string;
  inwardEntryNumber: string;
  inwardItemId: string;
  vendorId: string;
  vendorName: string;
  vendorAddress: string;
  vendorPhone: string;
  vendorGst: string;
  custDcDate: string;
  custDcNo: string;
  styleNo: string;
  itemName: string;
  washType: string;
  inwQty: number;
  unit: string;
  outDcDate: string;
  outDcNo: string;
  qty: number;
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '—';
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
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

function formatMoney(val: number): string {
  return (Number(val) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export const SampleInvoicePage: React.FC<SampleInvoicePageProps> = ({ vendors = [] }) => {
  const { user, isDemoMode } = useAuth();

  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');
  const [samplePos, setSamplePos] = useState<SamplePoInward[]>(() => SamplePoService.getCache());
  const [sampleOutwards, setSampleOutwards] = useState<SamplePoOutward[]>(() =>
    SamplePoService.getOutwardCache()
  );
  const [sampleInvoices, setSampleInvoices] = useState<SampleInvoice[]>(() =>
    SampleInvoiceService.getCache()
  );
  const [invoiceSettings, setInvoiceSettings] = useState<CompanyInvoiceSettings>(
    DEFAULT_INVOICE_SETTINGS
  );
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Generation Tab Filters
  const [selectedVendorId, setSelectedVendorId] = useState<string>('all');
  const [selectedPoId, setSelectedPoId] = useState<string>('all');
  const [genStartDate, setGenStartDate] = useState<string>('');
  const [genEndDate, setGenEndDate] = useState<string>('');
  const [genSearch, setGenSearch] = useState<string>('');

  // Selection & Rate State
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [lineRates, setLineRates] = useState<Record<string, number>>({});

  // Invoice Preview / Generation Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [draftInvoiceNo, setDraftInvoiceNo] = useState<string>('');
  const [draftInvoiceDate, setDraftInvoiceDate] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  );
  const [draftHsnSac, setDraftHsnSac] = useState<string>('998821');
  const [draftGstMode, setDraftGstMode] = useState<SampleInvoiceGstMode>('cgst_sgst');
  const [draftCgstRate, setDraftCgstRate] = useState<number>(2.5);
  const [draftSgstRate, setDraftSgstRate] = useState<number>(2.5);
  const [draftIgstRate, setDraftIgstRate] = useState<number>(5.0);
  const [draftDiscount, setDraftDiscount] = useState<number>(0);
  const [draftForwarding, setDraftForwarding] = useState<number>(0);
  const [savingInvoice, setSavingInvoice] = useState<boolean>(false);

  // History Tab Controls
  const [histSearchQuery, setHistSearchQuery] = useState<string>('');
  const [histSearchCol, setHistSearchCol] = useState<string>('ALL');
  const [histStartDate, setHistStartDate] = useState<string>('');
  const [histEndDate, setHistEndDate] = useState<string>('');
  const [showHistColFilters, setShowHistColFilters] = useState<boolean>(false);
  const [histColFilters, setHistColFilters] = useState<Record<string, string>>({
    invoiceNo: '',
    vendorName: '',
    status: ''
  });
  const [histSortField, setHistSortField] = useState<
    'invoiceNo' | 'invoiceDate' | 'vendorName' | 'totalOutQty' | 'totalAmount' | 'status' | null
  >(null);
  const [histSortDir, setHistSortDir] = useState<'asc' | 'desc' | 'normal'>('normal');

  // View & Cancel Modals
  const [viewInvoice, setViewInvoice] = useState<SampleInvoice | null>(null);
  const [cancelInvoiceTarget, setCancelInvoiceTarget] = useState<SampleInvoice | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);

  // Subscriptions
  useEffect(() => {
    const unsubPo = SamplePoService.subscribeSamplePos(setSamplePos);
    const unsubOut = SamplePoService.subscribeSampleOutwards(setSampleOutwards);
    const unsubInv = SampleInvoiceService.subscribeSampleInvoices(setSampleInvoices);
    const applySettings = (s: CompanyInvoiceSettings) => {
      setInvoiceSettings(s);
      setDraftCgstRate(s.defaultCgstRate ?? 2.5);
      setDraftSgstRate(s.defaultSgstRate ?? 2.5);
      setDraftIgstRate(s.defaultIgstRate ?? 5.0);
      setDraftHsnSac(s.defaultHsnSacCode || '998821');
    };

    const unsubSettings = isDemoMode
      ? () => {}
      : InvoiceSettingsService.subscribeSettings(applySettings, () => {
          InvoiceSettingsService.getSettings(isDemoMode).then(applySettings);
        });

    if (isDemoMode) {
      InvoiceSettingsService.getSettings(true).then(applySettings);
    }

    return () => {
      unsubPo();
      unsubOut();
      unsubInv();
      unsubSettings();
    };
  }, [isDemoMode]);

  // Track already billed outward item keys from active sample invoices
  const billedLineKeys = useMemo(() => {
    const set = new Set<string>();
    sampleInvoices.forEach((inv) => {
      if ((inv.status || '').toLowerCase() === 'cancelled') return;
      (inv.items || []).forEach((it) => {
        if (it.outwardId && it.id) {
          set.add(`${it.outwardId}__${it.id}`);
        }
      });
    });
    return set;
  }, [sampleInvoices]);

  // Build eligible unbilled outward lines reconciled with Sample Inwards
  const allEligibleLines = useMemo<EligibleSampleOutwardLine[]>(() => {
    const inwardMap = new Map<string, SamplePoInward>();
    samplePos.forEach((p) => inwardMap.set(p.id, p));

    const vendorMap = new Map<string, Vendor>();
    vendors.forEach((v) => {
      const id = v.vendorId || v.id;
      if (id) vendorMap.set(id, v);
    });

    const lines: EligibleSampleOutwardLine[] = [];
    sampleOutwards.forEach((out) => {
      if ((out.status || '').toLowerCase() === 'cancelled') return;
      const linkedInward = inwardMap.get(out.inwardId);
      const matchedVendor = vendorMap.get(out.vendorId);

      const vendorAddr =
        out.vendorAddress ||
        linkedInward?.vendorAddress ||
        (matchedVendor?.address
          ? typeof matchedVendor.address === 'string'
            ? matchedVendor.address
            : [
                matchedVendor.address.addressLine1,
                matchedVendor.address.addressLine2,
                matchedVendor.address.city,
                matchedVendor.address.state,
                matchedVendor.address.pinCode
              ]
                .filter(Boolean)
                .join(', ')
          : '');
      const vendorGst =
        out.vendorGst ||
        linkedInward?.vendorGst ||
        matchedVendor?.taxDetails?.gstin ||
        (matchedVendor as any)?.gstin ||
        '';
      const vendorPhone =
        matchedVendor?.primaryContactPhone ||
        matchedVendor?.phone ||
        matchedVendor?.contacts?.find((c) => c.isPrimary)?.contactNumber ||
        matchedVendor?.contacts?.[0]?.contactNumber ||
        '';

      (out.items || []).forEach((it) => {
        const key = `${out.id}__${it.id}`;
        if (billedLineKeys.has(key)) return;

        const matchingInwardItem = linkedInward?.items?.find(
          (inwIt) =>
            (it.inwardItemId && inwIt.id === it.inwardItemId) ||
            (inwIt.styleNo === it.styleNo && inwIt.washType === it.washType)
        );

        lines.push({
          key,
          outwardId: out.id,
          outwardEntryNumber: out.entryNumber,
          inwardId: out.inwardId,
          inwardEntryNumber: out.inwardEntryNumber,
          inwardItemId: it.inwardItemId || '',
          vendorId: out.vendorId,
          vendorName: out.vendorName,
          vendorAddress: vendorAddr,
          vendorPhone,
          vendorGst,
          custDcDate: it.customerDcDate || out.customerDcDate || '',
          custDcNo: it.customerDcNumber || out.customerDcNumber || '—',
          styleNo: it.styleNo || '—',
          itemName: it.itemName || '—',
          washType: it.washType || '—',
          inwQty: Number(matchingInwardItem?.quantity ?? it.quantity ?? 0),
          unit: it.unit || 'PCS',
          outDcDate: it.outwardDcDate || out.outwardDcDate || '',
          outDcNo: it.outwardDcNumber || out.outwardDcNumber || '—',
          qty: Number(it.quantity || 0)
        });
      });
    });

    return lines;
  }, [sampleOutwards, samplePos, vendors, billedLineKeys]);

  // Unique Companies & POs in eligible lines
  const eligibleCompanies = useMemo(() => {
    const map = new Map<string, string>();
    allEligibleLines.forEach((l) => {
      if (l.vendorId && l.vendorName) map.set(l.vendorId, l.vendorName);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allEligibleLines]);

  const eligiblePos = useMemo(() => {
    const map = new Map<string, string>();
    allEligibleLines
      .filter((l) => selectedVendorId === 'all' || l.vendorId === selectedVendorId)
      .forEach((l) => {
        if (l.inwardId && l.inwardEntryNumber) map.set(l.inwardId, l.inwardEntryNumber);
      });
    return Array.from(map.entries()).map(([id, entryNo]) => ({ id, entryNo }));
  }, [allEligibleLines, selectedVendorId]);

  // Filtered Eligible Lines
  const filteredEligibleLines = useMemo(() => {
    return allEligibleLines.filter((l) => {
      if (selectedVendorId !== 'all' && l.vendorId !== selectedVendorId) return false;
      if (selectedPoId !== 'all' && l.inwardId !== selectedPoId) return false;
      if (genStartDate && l.outDcDate < genStartDate) return false;
      if (genEndDate && l.outDcDate > genEndDate) return false;
      if (genSearch.trim()) {
        const q = genSearch.trim().toLowerCase();
        const match =
          l.inwardEntryNumber.toLowerCase().includes(q) ||
          l.outwardEntryNumber.toLowerCase().includes(q) ||
          l.vendorName.toLowerCase().includes(q) ||
          l.custDcNo.toLowerCase().includes(q) ||
          l.outDcNo.toLowerCase().includes(q) ||
          l.styleNo.toLowerCase().includes(q) ||
          l.itemName.toLowerCase().includes(q) ||
          l.washType.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [allEligibleLines, selectedVendorId, selectedPoId, genStartDate, genEndDate, genSearch]);

  // Group filtered eligible lines PO-wise (matching Invoice Generation table)
  const groupedEligiblePOs = useMemo(() => {
    const map = new Map<
      string,
      {
        poKey: string;
        inwardId: string;
        inwardEntryNumber: string;
        vendorId: string;
        vendorName: string;
        lines: EligibleSampleOutwardLine[];
        totalInwQty: number;
        totalOutQty: number;
      }
    >();

    filteredEligibleLines.forEach((line) => {
      const poKey = line.inwardId || line.inwardEntryNumber || 'unknown';
      const existing = map.get(poKey);
      if (existing) {
        existing.lines.push(line);
        existing.totalInwQty += line.inwQty;
        existing.totalOutQty += line.qty;
      } else {
        map.set(poKey, {
          poKey,
          inwardId: line.inwardId,
          inwardEntryNumber: line.inwardEntryNumber,
          vendorId: line.vendorId,
          vendorName: line.vendorName,
          lines: [line],
          totalInwQty: line.inwQty,
          totalOutQty: line.qty
        });
      }
    });

    return Array.from(map.values());
  }, [filteredEligibleLines]);

  // Selected Lines array
  const selectedLines = useMemo(() => {
    return filteredEligibleLines.filter((l) => selectedKeys.has(l.key));
  }, [filteredEligibleLines, selectedKeys]);

  const activeSelectionVendorId = useMemo(() => {
    return selectedLines.length > 0 ? selectedLines[0].vendorId : null;
  }, [selectedLines]);

  const toggleSelectPoGroup = (group: {
    vendorId: string;
    lines: EligibleSampleOutwardLine[];
  }) => {
    const allSelected = group.lines.every((l) => selectedKeys.has(l.key));
    if (!allSelected && activeSelectionVendorId && group.vendorId !== activeSelectionVendorId) {
      setNotice({
        type: 'error',
        text: 'You can only combine outward lines from the same customer into one Sample Invoice.'
      });
      return;
    }
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        group.lines.forEach((l) => next.delete(l.key));
      } else {
        group.lines.forEach((l) => next.add(l.key));
      }
      return next;
    });
  };

  const toggleSelectLine = (line: EligibleSampleOutwardLine) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(line.key)) {
        next.delete(line.key);
        return next;
      }
      // Enforce single customer per invoice
      if (activeSelectionVendorId && line.vendorId !== activeSelectionVendorId) {
        setNotice({
          type: 'error',
          text: 'You can only combine outward lines from the same customer into one Sample Invoice.'
        });
        return prev;
      }
      next.add(line.key);
      return next;
    });
  };

  const handleToggleSelectAllVisible = () => {
    if (filteredEligibleLines.length === 0) return;
    const firstVendor = filteredEligibleLines[0].vendorId;
    const sameVendorLines = filteredEligibleLines.filter((l) => l.vendorId === firstVendor);
    const allSelected = sameVendorLines.every((l) => selectedKeys.has(l.key));
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(sameVendorLines.map((l) => l.key)));
      if (sameVendorLines.length < filteredEligibleLines.length) {
        setNotice({
          type: 'success',
          text: `Selected all ${sameVendorLines.length} lines for ${filteredEligibleLines[0].vendorName}.`
        });
      }
    }
  };

  const handleOpenGenerateModal = async () => {
    if (selectedLines.length === 0) return;
    const nextNo = await SampleInvoiceService.generateNextInvoiceNo();
    setDraftInvoiceNo(nextNo);
    setDraftInvoiceDate(new Date().toISOString().split('T')[0]);
    setDraftDiscount(0);
    setDraftForwarding(0);
    setIsGenerateModalOpen(true);
  };

  // Draft Invoice Calculations
  const draftCalculations = useMemo(() => {
    const items: SampleInvoiceItem[] = selectedLines.map((l) => {
      const rate = Number(lineRates[l.key] || 0);
      const amount = Number((l.qty * rate).toFixed(2));
      return {
        id: l.key.split('__')[1] || l.key,
        outwardId: l.outwardId,
        outwardEntryNumber: l.outwardEntryNumber,
        inwardId: l.inwardId,
        inwardEntryNumber: l.inwardEntryNumber,
        inwardItemId: l.inwardItemId,
        custDcDate: l.custDcDate,
        custDcNo: l.custDcNo,
        styleNo: l.styleNo,
        itemName: l.itemName,
        washType: l.washType,
        inwQty: l.inwQty,
        unit: l.unit,
        outDcDate: l.outDcDate,
        outDcNo: l.outDcNo,
        qty: l.qty,
        rate,
        amount
      };
    });

    const totalInwQty = items.reduce((s, i) => s + i.inwQty, 0);
    const totalOutQty = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const taxableAfterDiscount = Math.max(0, subtotal - (Number(draftDiscount) || 0));

    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    if (draftGstMode === 'cgst_sgst') {
      cgstAmount = Number(((taxableAfterDiscount * draftCgstRate) / 100).toFixed(2));
      sgstAmount = Number(((taxableAfterDiscount * draftSgstRate) / 100).toFixed(2));
    } else if (draftGstMode === 'igst') {
      igstAmount = Number(((taxableAfterDiscount * draftIgstRate) / 100).toFixed(2));
    }

    const beforeRound =
      taxableAfterDiscount + cgstAmount + sgstAmount + igstAmount + (Number(draftForwarding) || 0);
    const roundOff = 0;
    const totalAmount = Number(beforeRound.toFixed(2));
    const amountInWords = convertNumberToIndianWords(totalAmount);

    return {
      items,
      totalInwQty,
      totalOutQty,
      subtotal,
      cgstAmount,
      sgstAmount,
      igstAmount,
      roundOff,
      totalAmount,
      amountInWords
    };
  }, [
    selectedLines,
    lineRates,
    draftDiscount,
    draftGstMode,
    draftCgstRate,
    draftSgstRate,
    draftIgstRate,
    draftForwarding
  ]);

  const handleConfirmGenerate = async (alsoDownloadPdf: boolean) => {
    if (selectedLines.length === 0) return;
    const first = selectedLines[0];
    try {
      setSavingInvoice(true);
      const created = await SampleInvoiceService.createSampleInvoice(
        {
          invoiceNo: draftInvoiceNo,
          invoiceDate: draftInvoiceDate,
          hsnSacCode: draftHsnSac || '998821',
          vendorId: first.vendorId,
          vendorName: first.vendorName,
          vendorAddress: first.vendorAddress,
          vendorPhone: first.vendorPhone,
          vendorGst: first.vendorGst,
          items: draftCalculations.items,
          totalInwQty: draftCalculations.totalInwQty,
          totalOutQty: draftCalculations.totalOutQty,
          subtotal: draftCalculations.subtotal,
          discount: Number(draftDiscount) || 0,
          gstMode: draftGstMode,
          cgstRate: draftGstMode === 'cgst_sgst' ? draftCgstRate : 0,
          sgstRate: draftGstMode === 'cgst_sgst' ? draftSgstRate : 0,
          igstRate: draftGstMode === 'igst' ? draftIgstRate : 0,
          cgstAmount: draftCalculations.cgstAmount,
          sgstAmount: draftCalculations.sgstAmount,
          igstAmount: draftCalculations.igstAmount,
          forwarding: Number(draftForwarding) || 0,
          roundOff: draftCalculations.roundOff,
          totalAmount: draftCalculations.totalAmount,
          amountInWords: draftCalculations.amountInWords,
          status: 'active'
        },
        user as any,
        isDemoMode
      );

      if (alsoDownloadPdf) {
        SampleInvoicePdfService.downloadPdf(created, invoiceSettings);
      }

      setNotice({
        type: 'success',
        text: `Sample Invoice ${created.invoiceNo} generated successfully.`
      });
      setIsGenerateModalOpen(false);
      setSelectedKeys(new Set());
      setActiveTab('history');
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to generate Sample Invoice.' });
    } finally {
      setSavingInvoice(false);
    }
  };

  // History Sorting & Filtering
  const handleHistSort = (
    field: 'invoiceNo' | 'invoiceDate' | 'vendorName' | 'totalOutQty' | 'totalAmount' | 'status'
  ) => {
    const isNumOrDate = field === 'totalOutQty' || field === 'totalAmount' || field === 'invoiceDate';
    const first = isNumOrDate ? 'desc' : 'asc';
    const second = isNumOrDate ? 'asc' : 'desc';
    if (histSortField !== field || histSortDir === 'normal') {
      setHistSortField(field);
      setHistSortDir(first);
    } else if (histSortDir === first) {
      setHistSortDir(second);
    } else {
      setHistSortField(null);
      setHistSortDir('normal');
    }
  };

  const renderHistSortIcon = (
    field: 'invoiceNo' | 'invoiceDate' | 'vendorName' | 'totalOutQty' | 'totalAmount' | 'status'
  ) => {
    if (histSortField !== field || histSortDir === 'normal') {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />;
    }
    return histSortDir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5 text-[#1F4E79]" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-[#1F4E79]" />
    );
  };

  const filteredAndSortedHistory = useMemo(() => {
    let result = [...sampleInvoices];
    if (histSearchQuery.trim()) {
      const q = histSearchQuery.trim().toLowerCase();
      result = result.filter((inv) => {
        if (histSearchCol === 'invoiceNo') return inv.invoiceNo.toLowerCase().includes(q);
        if (histSearchCol === 'vendorName') return inv.vendorName.toLowerCase().includes(q);
        if (histSearchCol === 'status') return inv.status.toLowerCase().includes(q);
        return (
          inv.invoiceNo.toLowerCase().includes(q) ||
          inv.vendorName.toLowerCase().includes(q) ||
          inv.status.toLowerCase().includes(q) ||
          (inv.items || []).some(
            (it) =>
              it.styleNo.toLowerCase().includes(q) ||
              it.itemName.toLowerCase().includes(q) ||
              it.custDcNo.toLowerCase().includes(q) ||
              it.outDcNo.toLowerCase().includes(q)
          )
        );
      });
    }
    if (histColFilters.invoiceNo.trim()) {
      const q = histColFilters.invoiceNo.trim().toLowerCase();
      result = result.filter((inv) => inv.invoiceNo.toLowerCase().includes(q));
    }
    if (histColFilters.vendorName.trim()) {
      const q = histColFilters.vendorName.trim().toLowerCase();
      result = result.filter((inv) => inv.vendorName.toLowerCase().includes(q));
    }
    if (histColFilters.status.trim()) {
      const q = histColFilters.status.trim().toLowerCase();
      result = result.filter((inv) => inv.status.toLowerCase().includes(q));
    }
    if (histStartDate) result = result.filter((inv) => inv.invoiceDate >= histStartDate);
    if (histEndDate) result = result.filter((inv) => inv.invoiceDate <= histEndDate);

    if (histSortField && histSortDir !== 'normal') {
      result.sort((a, b) => {
        let va: any = a[histSortField];
        let vb: any = b[histSortField];
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va === vb) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return histSortDir === 'asc' ? (va > vb ? 1 : -1) : va < vb ? 1 : -1;
      });
    }
    return result;
  }, [sampleInvoices, histSearchQuery, histSearchCol, histColFilters, histStartDate, histEndDate, histSortField, histSortDir]);

  const historyTotals = useMemo(() => {
    return filteredAndSortedHistory.reduce(
      (acc, inv) => ({
        inw: acc.inw + (inv.totalInwQty || 0),
        out: acc.out + (inv.totalOutQty || 0),
        amt: acc.amt + ((inv.status || '').toLowerCase() === 'cancelled' ? 0 : inv.totalAmount || 0)
      }),
      { inw: 0, out: 0, amt: 0 }
    );
  }, [filteredAndSortedHistory]);

  const handleConfirmCancel = async () => {
    if (!cancelInvoiceTarget) return;
    try {
      setCancelling(true);
      await SampleInvoiceService.cancelSampleInvoice(
        cancelInvoiceTarget.id,
        cancelReason.trim() || 'Cancelled by user',
        user as any,
        isDemoMode
      );
      setNotice({
        type: 'success',
        text: `Sample Invoice ${cancelInvoiceTarget.invoiceNo} cancelled. Dispatched lines returned to eligible list.`
      });
      setCancelInvoiceTarget(null);
      setCancelReason('');
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to cancel invoice.' });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sample Invoice</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Reconcile sample inward vs outward, generate sample tax invoices, and download invoice PDFs
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto border border-slate-200/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Reconciliation &amp; Generate</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold border border-slate-200">
              {allEligibleLines.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white text-[#1F4E79] shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Generated Invoices</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold border border-slate-200">
              {sampleInvoices.length}
            </span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs border ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeTab === 'generate' ? (
        <div className="space-y-5">
          {/* Statement / Eligibility Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
                  Company / Customer
                </label>
                <select
                  value={selectedVendorId}
                  onChange={(e) => {
                    setSelectedVendorId(e.target.value);
                    setSelectedPoId('all');
                  }}
                  className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="all">All Companies</option>
                  {eligibleCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
                  Sample PO No
                </label>
                <select
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value)}
                  className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="all">All Sample POs</option>
                  {eligiblePos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.entryNo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={genStartDate}
                  onChange={(e) => setGenStartDate(e.target.value)}
                  className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={genEndDate}
                  onChange={(e) => setGenEndDate(e.target.value)}
                  className="w-full h-9 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10.5px] font-bold uppercase text-slate-500 mb-1">
                  Search
                </label>
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="DC, Style, Item, Wash..."
                    value={genSearch}
                    onChange={(e) => setGenSearch(e.target.value)}
                    className="w-full h-9 pl-8 pr-7 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none"
                  />
                  {genSearch && (
                    <button
                      type="button"
                      onClick={() => setGenSearch('')}
                      className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {(selectedVendorId !== 'all' || selectedPoId !== 'all' || genStartDate || genEndDate || genSearch) && (
              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVendorId('all');
                    setSelectedPoId('all');
                    setGenStartDate('');
                    setGenEndDate('');
                    setGenSearch('');
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            )}
          </div>

          {/* Selection Action Bar */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              {selectedLines.length > 0 ? (
                <span>
                  <strong className="text-[#1F4E79]">{selectedLines.length}</strong> lines selected for{' '}
                  <strong className="text-slate-900">{selectedLines[0].vendorName}</strong> • Subtotal:{' '}
                  <strong className="font-mono text-slate-900">₹{formatMoney(draftCalculations.subtotal)}</strong>
                </span>
              ) : (
                <span>Select dispatched sample lines (same customer) and enter rates to generate an invoice.</span>
              )}
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={selectedLines.length === 0}
              onClick={handleOpenGenerateModal}
              icon={<FileText className="w-4 h-4" />}
              className="h-9 font-bold cursor-pointer"
            >
              Generate Sample Invoice ({selectedLines.length})
            </Button>
          </div>

          {/* Eligible Lines Table */}
          <TableMaximizeWrapper
            title="Eligible Sample Outward Lines for Invoicing"
            badge={
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
                {filteredEligibleLines.length} Eligible Lines
              </span>
            }
          >
            {(isMaximized) => (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
                <div
                  data-table-scroll="true"
                  className={`overflow-x-auto overflow-y-auto relative ${
                    isMaximized ? 'flex-1 max-h-none' : 'max-h-[600px]'
                  }`}
                >
                  <table className="w-full text-left text-xs border-collapse min-w-[1300px]">
                    <thead className="sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[10.5px] border-b-2 border-slate-300 select-none">
                      <tr>
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredEligibleLines.length > 0 &&
                              filteredEligibleLines
                                .filter((l) => l.vendorId === filteredEligibleLines[0].vendorId)
                                .every((l) => selectedKeys.has(l.key))
                            }
                            onChange={handleToggleSelectAllVisible}
                            className="cursor-pointer"
                            title="Select all lines for first visible customer"
                          />
                        </th>
                        <th className="py-3 px-2.5 text-center whitespace-nowrap">SN</th>
                        <th className="py-3 px-2.5 whitespace-nowrap">PO No</th>
                        <th className="py-3 px-2.5 whitespace-nowrap">Company Name</th>
                        <th className="py-3 px-2.5 whitespace-nowrap">Cust DC Date</th>
                        <th className="py-3 px-2.5 whitespace-nowrap">DC No</th>
                        <th className="py-3 px-2.5 whitespace-nowrap">Style No</th>
                        <th className="py-3 px-2.5 whitespace-nowrap">ItemName</th>
                        <th className="py-3 px-2.5 whitespace-nowrap">Type of Wash</th>
                        <th className="py-3 px-2.5 text-right whitespace-nowrap">Inw Qty</th>
                        <th className="py-3 px-2.5 text-center whitespace-nowrap">Unit</th>
                        <th className="py-3 px-2.5 whitespace-nowrap">Out DC Date</th>
                        <th className="py-3 px-2.5 whitespace-nowrap">Out DC No</th>
                        <th className="py-3 px-2.5 text-right whitespace-nowrap">Out Qty</th>
                        <th className="py-3 px-2.5 text-right whitespace-nowrap">Rate (₹)</th>
                        <th className="py-3 px-2.5 pr-12 text-right whitespace-nowrap">Amount (₹)</th>
                      </tr>
                    </thead>

                    <tbody className="bg-white">
                      {groupedEligiblePOs.length === 0 ? (
                        <tr>
                          <td colSpan={16} className="py-12 text-center text-slate-400">
                            No unbilled sample outward lines available.
                          </td>
                        </tr>
                      ) : (
                        (() => {
                          let runningSn = 0;
                          return groupedEligiblePOs.map((group) => {
                            const groupAllSelected = group.lines.every((l) =>
                              selectedKeys.has(l.key)
                            );
                            return (
                              <React.Fragment key={group.poKey}>
                                {/* PO Header Strip (matching Invoice Generation table) */}
                                <tr className="bg-[#EEF5FB]/70 border-t-2 border-b border-blue-200">
                                  <td colSpan={16} className="py-2 px-3 text-left">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={groupAllSelected}
                                          onChange={() => toggleSelectPoGroup(group)}
                                          className="cursor-pointer"
                                          title={`Select all lines for PO ${group.inwardEntryNumber}`}
                                        />
                                        <span className="font-bold text-[#1F4E79] font-mono text-xs">
                                          PO #{group.inwardEntryNumber}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#1F4E79] border border-blue-200">
                                          {group.vendorName}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#1F4E79]">
                                          {group.lines.length} Eligible Line
                                          {group.lines.length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-600 pr-2">
                                        <span>
                                          Inward:{' '}
                                          <strong className="font-mono text-slate-900">
                                            {group.totalInwQty}
                                          </strong>
                                        </span>
                                        <span>
                                          Outward:{' '}
                                          <strong className="font-mono text-[#1F4E79]">
                                            {group.totalOutQty}
                                          </strong>
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>

                                {group.lines.map((line, lineIdx) => {
                                  runningSn += 1;
                                  const isSelected = selectedKeys.has(line.key);
                                  const rate = lineRates[line.key] ?? 0;
                                  const amount = line.qty * rate;
                                  return (
                                    <tr
                                      key={line.key}
                                      className={`transition-colors ${
                                        isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/90'
                                      }`}
                                    >
                                      <td className="py-2.5 px-3 border border-slate-200 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleSelectLine(line)}
                                          className="cursor-pointer"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 text-center text-slate-400 font-mono">
                                        {runningSn}
                                      </td>
                                      {lineIdx === 0 && (
                                        <>
                                          <td
                                            rowSpan={group.lines.length}
                                            className="py-2.5 px-2.5 border border-slate-200 font-mono font-bold text-[#1F4E79] whitespace-nowrap align-middle bg-white"
                                          >
                                            {group.inwardEntryNumber}
                                          </td>
                                          <td
                                            rowSpan={group.lines.length}
                                            className="py-2.5 px-2.5 border border-slate-200 font-bold text-slate-900 whitespace-nowrap align-middle bg-white"
                                          >
                                            {group.vendorName}
                                          </td>
                                        </>
                                      )}
                                      <td className="py-2.5 px-2.5 border border-slate-200 text-slate-600 whitespace-nowrap">
                                        {formatDisplayDate(line.custDcDate)}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 font-mono font-bold text-slate-900 whitespace-nowrap">
                                        {line.custDcNo}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                                        {line.styleNo}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 font-semibold text-slate-800 whitespace-nowrap">
                                        {line.itemName}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 text-slate-700 whitespace-nowrap">
                                        {line.washType}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                                        {line.inwQty}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 text-center font-mono text-slate-500 whitespace-nowrap">
                                        {line.unit}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 text-slate-600 whitespace-nowrap">
                                        {formatDisplayDate(line.outDcDate)}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 font-mono font-bold text-slate-900 whitespace-nowrap">
                                        {line.outDcNo}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                                        {line.qty}
                                      </td>
                                      <td className="py-2.5 px-2.5 border border-slate-200 text-right">
                                        <input
                                          type="number"
                                          min={0}
                                          step="any"
                                          value={lineRates[line.key] ?? ''}
                                          onChange={(e) =>
                                            setLineRates((prev) => ({
                                              ...prev,
                                              [line.key]:
                                                e.target.value === '' ? 0 : Number(e.target.value)
                                            }))
                                          }
                                          className="w-20 text-right bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                                        />
                                      </td>
                                      <td className="py-2.5 px-2.5 pr-12 border border-slate-200 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                        ₹{formatMoney(amount)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </React.Fragment>
                            );
                          });
                        })()
                      )}
                    </tbody>

                    <TableTotalsFooter
                      cells={[
                        {
                          colSpan: 9,
                          label: `Total (${filteredEligibleLines.length} Eligible Lines)`,
                          isTotal: true
                        },
                        {
                          quantity: filteredEligibleLines.reduce((s, l) => s + l.inwQty, 0),
                          unit: 'piece',
                          isTotal: true
                        },
                        { content: '—', align: 'center' },
                        { content: '—', align: 'center' },
                        { content: '—', align: 'center' },
                        {
                          quantity: filteredEligibleLines.reduce((s, l) => s + l.qty, 0),
                          unit: 'piece',
                          isTotal: true
                        },
                        { content: '—', align: 'center' },
                        {
                          content: `₹${formatMoney(
                            filteredEligibleLines.reduce(
                              (s, l) => s + l.qty * (lineRates[l.key] || 0),
                              0
                            )
                          )}`,
                          align: 'right',
                          isTotal: true,
                          className: 'pr-12'
                        }
                      ]}
                    />
                  </table>
                </div>

                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                  <div>
                    Showing all <strong>{filteredEligibleLines.length}</strong> records in one stretch
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Perla ERP • Sample Invoice Reconciliation
                  </div>
                </div>
              </div>
            )}
          </TableMaximizeWrapper>
        </div>
      ) : (
        /* TAB 2: GENERATED SAMPLE INVOICES HISTORY */
        <div className="space-y-5">
          {/* Clean Typography KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Sample Invoices
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {sampleInvoices.length}
                </span>
                <span className="text-xs text-slate-500 font-medium">Invoices</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Active Invoices
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {sampleInvoices.filter((i) => (i.status || '').toLowerCase() !== 'cancelled').length}
                </span>
                <span className="text-xs text-emerald-600 font-semibold">Active</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Billed Qty
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {historyTotals.out.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-medium">Pieces</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Billed Value
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  ₹{formatMoney(historyTotals.amt)}
                </span>
              </div>
            </div>
          </div>

          <TableMaximizeWrapper
            title="Generated Sample Invoices"
            badge={
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
                {filteredAndSortedHistory.length} Invoices
              </span>
            }
          >
            {(isMaximized) => (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <select
                      value={histSearchCol}
                      onChange={(e) => setHistSearchCol(e.target.value)}
                      className="h-9 pl-3 pr-6 bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">All Columns</option>
                      <option value="invoiceNo">Invoice No</option>
                      <option value="vendorName">Company Name</option>
                      <option value="status">Status</option>
                    </select>
                    <div className="relative flex items-center min-w-[200px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search invoices..."
                        value={histSearchQuery}
                        onChange={(e) => setHistSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 text-xs text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowHistColFilters((p) => !p)}
                    className={`h-9 px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                      showHistColFilters
                        ? 'bg-blue-50 border-blue-300 text-[#1F4E79]'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Column Filters</span>
                  </button>

                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 h-9 text-xs shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Start Date:
                    </span>
                    <input
                      type="date"
                      value={histStartDate}
                      onChange={(e) => setHistStartDate(e.target.value)}
                      className="text-xs bg-transparent focus:outline-none text-slate-800 font-semibold"
                    />
                    <span className="text-slate-300">|</span>
                    <span className="text-[11px] font-bold text-slate-500 uppercase">End Date:</span>
                    <input
                      type="date"
                      value={histEndDate}
                      onChange={(e) => setHistEndDate(e.target.value)}
                      className="text-xs bg-transparent focus:outline-none text-slate-800 font-semibold"
                    />
                  </div>
                </div>

                <div
                  data-table-scroll="true"
                  className={`overflow-x-auto overflow-y-auto relative ${
                    isMaximized ? 'flex-1 max-h-none' : 'max-h-[600px]'
                  }`}
                >
                  <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
                    <thead className="sticky top-0 z-20 bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase tracking-wider text-[10.5px] border-b-2 border-slate-300 select-none">
                      <tr>
                        <th className="py-3 px-3 w-12 text-center whitespace-nowrap">S.No</th>
                        <th
                          onClick={() => handleHistSort('invoiceNo')}
                          className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] whitespace-nowrap"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>Invoice No</span>
                            {renderHistSortIcon('invoiceNo')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleHistSort('invoiceDate')}
                          className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] whitespace-nowrap"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>Invoice Date</span>
                            {renderHistSortIcon('invoiceDate')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleHistSort('vendorName')}
                          className="py-3 px-3 cursor-pointer hover:bg-[#DCE9F5] whitespace-nowrap"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span>Company Name</span>
                            {renderHistSortIcon('vendorName')}
                          </div>
                        </th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">Lines</th>
                        <th
                          onClick={() => handleHistSort('totalOutQty')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-[#DCE9F5] whitespace-nowrap"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Billed Qty</span>
                            {renderHistSortIcon('totalOutQty')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleHistSort('totalAmount')}
                          className="py-3 px-3 text-right cursor-pointer hover:bg-[#DCE9F5] whitespace-nowrap"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Total Amt (₹)</span>
                            {renderHistSortIcon('totalAmount')}
                          </div>
                        </th>
                        <th
                          onClick={() => handleHistSort('status')}
                          className="py-3 px-3 text-center cursor-pointer hover:bg-[#DCE9F5] whitespace-nowrap"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>Status</span>
                            {renderHistSortIcon('status')}
                          </div>
                        </th>
                        <th className="py-3 px-3 pr-12 text-center whitespace-nowrap">Actions</th>
                      </tr>

                      {showHistColFilters && (
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs">
                          <th className="p-1.5 text-center">#</th>
                          <th className="p-1.5">
                            <input
                              type="text"
                              placeholder="Invoice No..."
                              value={histColFilters.invoiceNo}
                              onChange={(e) =>
                                setHistColFilters((p) => ({ ...p, invoiceNo: e.target.value }))
                              }
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                            />
                          </th>
                          <th className="p-1.5"></th>
                          <th className="p-1.5">
                            <input
                              type="text"
                              placeholder="Company..."
                              value={histColFilters.vendorName}
                              onChange={(e) =>
                                setHistColFilters((p) => ({ ...p, vendorName: e.target.value }))
                              }
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal"
                            />
                          </th>
                          <th colSpan={3} className="p-1.5"></th>
                          <th className="p-1.5">
                            <input
                              type="text"
                              placeholder="Status..."
                              value={histColFilters.status}
                              onChange={(e) =>
                                setHistColFilters((p) => ({ ...p, status: e.target.value }))
                              }
                              className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-normal text-center"
                            />
                          </th>
                          <th className="p-1.5 pr-12 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setHistColFilters({ invoiceNo: '', vendorName: '', status: '' })
                              }
                              className="text-[11px] text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
                            >
                              Clear
                            </button>
                          </th>
                        </tr>
                      )}
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredAndSortedHistory.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            No sample invoices generated yet.
                          </td>
                        </tr>
                      ) : (
                        filteredAndSortedHistory.map((inv, idx) => {
                          const isCancelled = (inv.status || '').toLowerCase() === 'cancelled';
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50/90 transition-colors">
                              <td className="py-3 px-3 text-center text-slate-400 font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-3 font-mono font-bold text-[#1F4E79] whitespace-nowrap">
                                {inv.invoiceNo}
                              </td>
                              <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                                {formatDisplayDate(inv.invoiceDate)}
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                                {inv.vendorName}
                              </td>
                              <td className="py-3 px-3 text-center font-mono text-slate-700">
                                {inv.items?.length || 0}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                {inv.totalOutQty} PCS
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                                ₹{formatMoney(inv.totalAmount)}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    isCancelled
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {inv.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 pr-12 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewInvoice(inv)}
                                    className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs cursor-pointer"
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => SampleInvoicePdfService.downloadPdf(inv, invoiceSettings)}
                                    className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs cursor-pointer"
                                  >
                                    Download
                                  </button>
                                  {!isCancelled && (
                                    <button
                                      type="button"
                                      onClick={() => setCancelInvoiceTarget(inv)}
                                      className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>

                    <TableTotalsFooter
                      cells={[
                        {
                          colSpan: 5,
                          label: `Total (${filteredAndSortedHistory.length} Invoices)`,
                          isTotal: true
                        },
                        { quantity: historyTotals.out, unit: 'piece', isTotal: true },
                        {
                          content: `₹${formatMoney(historyTotals.amt)}`,
                          align: 'right',
                          isTotal: true
                        },
                        { content: '—', align: 'center' },
                        { content: '—', align: 'center', className: 'pr-12' }
                      ]}
                    />
                  </table>
                </div>

                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                  <div>
                    Showing all <strong>{filteredAndSortedHistory.length}</strong> records in one stretch
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Perla ERP • Sample Invoice History
                  </div>
                </div>
              </div>
            )}
          </TableMaximizeWrapper>
        </div>
      )}

      {/* MODAL 1: GENERATE & PREVIEW SAMPLE INVOICE */}
      {isGenerateModalOpen && selectedLines.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => setIsGenerateModalOpen(false)}
          title={`Generate Sample Invoice: ${selectedLines[0].vendorName}`}
          maxWidth="5xl"
        >
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1 text-xs">
            {/* Invoice Header Controls */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Invoice No <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={draftInvoiceNo}
                  onChange={(e) => setDraftInvoiceNo(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Invoice Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={draftInvoiceDate}
                  onChange={(e) => setDraftInvoiceDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  HSN / SAC
                </label>
                <input
                  type="text"
                  value={draftHsnSac}
                  onChange={(e) => setDraftHsnSac(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Tax Mode
                </label>
                <select
                  value={draftGstMode}
                  onChange={(e) => setDraftGstMode(e.target.value as SampleInvoiceGstMode)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                >
                  <option value="cgst_sgst">CGST + SGST (2.5% + 2.5%)</option>
                  <option value="igst">IGST (5.0%)</option>
                  <option value="without_gst">Without GST (0%)</option>
                </select>
              </div>
            </div>

            {/* Line Items Rate Review */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-2 text-center">SN</th>
                    <th className="py-2 px-2">Cust DC Date</th>
                    <th className="py-2 px-2">DC NO</th>
                    <th className="py-2 px-2">Style No</th>
                    <th className="py-2 px-2">ItemName</th>
                    <th className="py-2 px-2">Type of Wash</th>
                    <th className="py-2 px-2 text-right">Inw Qty</th>
                    <th className="py-2 px-2 text-center">Unit</th>
                    <th className="py-2 px-2">Out DC Date</th>
                    <th className="py-2 px-2">Out DC No</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {draftCalculations.items.map((it, idx) => (
                    <tr key={it.id + idx}>
                      <td className="py-2 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{formatDisplayDate(it.custDcDate)}</td>
                      <td className="py-2 px-2 font-mono font-bold">{it.custDcNo}</td>
                      <td className="py-2 px-2 font-mono">{it.styleNo}</td>
                      <td className="py-2 px-2 font-semibold">{it.itemName}</td>
                      <td className="py-2 px-2">{it.washType}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatMoney(it.inwQty)}</td>
                      <td className="py-2 px-2 text-center">{it.unit}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{formatDisplayDate(it.outDcDate)}</td>
                      <td className="py-2 px-2 font-mono font-bold">{it.outDcNo}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold">{formatMoney(it.qty)}</td>
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={lineRates[`${it.outwardId}__${it.id}`] ?? ''}
                          onChange={(e) =>
                            setLineRates((prev) => ({
                              ...prev,
                              [`${it.outwardId}__${it.id}`]:
                                e.target.value === '' ? 0 : Number(e.target.value)
                            }))
                          }
                          className="w-20 text-right border border-slate-300 rounded px-1.5 py-1 font-mono font-bold"
                        />
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold">
                        {formatMoney(it.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Discount, Forwarding & Tax Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={draftDiscount}
                      onChange={(e) => setDraftDiscount(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Forwarding (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={draftForwarding}
                      onChange={(e) => setDraftForwarding(Number(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-[11px]">
                  <span className="font-bold text-slate-500 block uppercase">Amount in Words:</span>
                  <span className="font-bold text-slate-900">{draftCalculations.amountInWords}</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">TOTAL</span>
                  <span className="font-mono font-bold">₹{formatMoney(draftCalculations.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Discount</span>
                  <span className="font-mono">₹{formatMoney(draftDiscount)}</span>
                </div>
                {draftGstMode === 'cgst_sgst' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-slate-600">CGST ({draftCgstRate.toFixed(2)}%)</span>
                      <span className="font-mono">₹{formatMoney(draftCalculations.cgstAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">SGST ({draftSgstRate.toFixed(2)}%)</span>
                      <span className="font-mono">₹{formatMoney(draftCalculations.sgstAmount)}</span>
                    </div>
                  </>
                )}
                {draftGstMode === 'igst' && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">IGST ({draftIgstRate.toFixed(2)}%)</span>
                    <span className="font-mono">₹{formatMoney(draftCalculations.igstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Forwarding</span>
                  <span className="font-mono">₹{formatMoney(draftForwarding)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-[#1F4E79]">
                  <span>Total Amt</span>
                  <span className="font-mono">₹{formatMoney(draftCalculations.totalAmount)}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsGenerateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={savingInvoice}
                onClick={() => handleConfirmGenerate(false)}
              >
                Save Invoice
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={savingInvoice}
                onClick={() => handleConfirmGenerate(true)}
                icon={<Printer className="w-4 h-4" />}
              >
                {savingInvoice ? 'Generating...' : 'Generate & Download PDF'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: VIEW SAMPLE INVOICE */}
      {viewInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setViewInvoice(null)}
          title={`Sample Invoice: ${viewInvoice.invoiceNo}`}
          maxWidth="5xl"
        >
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Invoice No</span>
                <span className="font-mono font-bold text-slate-900">{viewInvoice.invoiceNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Invoice Date</span>
                <span className="font-semibold text-slate-900">
                  {formatDisplayDate(viewInvoice.invoiceDate)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Main Customer</span>
                <span className="font-bold text-slate-900">{viewInvoice.vendorName}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Amount</span>
                <span className="font-mono font-black text-[#1F4E79] text-sm">
                  ₹{formatMoney(viewInvoice.totalAmount)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2 px-2 text-center">SN</th>
                    <th className="py-2 px-2">Cust DC Date</th>
                    <th className="py-2 px-2">DC NO</th>
                    <th className="py-2 px-2">Style No</th>
                    <th className="py-2 px-2">ItemName</th>
                    <th className="py-2 px-2">Type of Wash</th>
                    <th className="py-2 px-2 text-right">Inw Qty</th>
                    <th className="py-2 px-2 text-center">Unit</th>
                    <th className="py-2 px-2">Out DC Date</th>
                    <th className="py-2 px-2">Out DC No</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(viewInvoice.items || []).map((it, idx) => (
                    <tr key={it.id + idx}>
                      <td className="py-2 px-2 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{formatDisplayDate(it.custDcDate)}</td>
                      <td className="py-2 px-2 font-mono font-bold">{it.custDcNo}</td>
                      <td className="py-2 px-2 font-mono">{it.styleNo}</td>
                      <td className="py-2 px-2 font-semibold">{it.itemName}</td>
                      <td className="py-2 px-2">{it.washType}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatMoney(it.inwQty)}</td>
                      <td className="py-2 px-2 text-center">{it.unit}</td>
                      <td className="py-2 px-2 whitespace-nowrap">{formatDisplayDate(it.outDcDate)}</td>
                      <td className="py-2 px-2 font-mono font-bold">{it.outDcNo}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold">{formatMoney(it.qty)}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatMoney(it.rate)}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold">{formatMoney(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <div className="text-[11px] text-slate-500">
                Amount in Words: <strong className="text-slate-800">{viewInvoice.amountInWords}</strong>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => SampleInvoicePdfService.downloadPdf(viewInvoice, invoiceSettings)}
                  icon={<Printer className="w-4 h-4 text-rose-600" />}
                >
                  Download as PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => setViewInvoice(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: CANCEL SAMPLE INVOICE */}
      {cancelInvoiceTarget && (
        <Modal
          isOpen={true}
          onClose={() => setCancelInvoiceTarget(null)}
          title={`Cancel Sample Invoice: ${cancelInvoiceTarget.invoiceNo}`}
          maxWidth="sm"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Cancelling this invoice will return its {cancelInvoiceTarget.items?.length || 0} outward lines back to the eligible invoicing list.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Cancellation Reason
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded p-2 text-xs"
              />
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCancelInvoiceTarget(null)}>
                Keep Invoice
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={cancelling}
                onClick={handleConfirmCancel}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
