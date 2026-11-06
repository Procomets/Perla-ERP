import React, { useState, useEffect, useMemo } from 'react';
import { OutwardEntry, OutwardLine } from '../../../types/outward';
import { InwardEntry } from '../../../types/inward';
import { Vendor } from '../../../types/vendor';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import {
  Download,
  Calendar,
  Clock,
  Truck,
  User,
  FileText,
  AlertCircle,
  Layers,
  MapPin,
  Check
} from 'lucide-react';
import { formatDate } from '../../../utils/formatters';
import {
  DeliveryChallanPdfService,
  DeliveryChallanData,
  DeliveryChallanItem
} from '../../../services/deliveryChallanPdfService';
import { InvoiceSettingsService } from '../../../services/invoiceSettingsService';

interface JoinedDcModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOutwards: OutwardEntry[];
  inwards: InwardEntry[];
  vendors: Vendor[];
}

function toTimeInputValue(timeStr?: string): string {
  if (!timeStr || timeStr === '—' || timeStr === '-') return '';
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  return '';
}

function formatTimeDisplay(time24?: string): string {
  if (!time24) return '';
  const match = time24.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
  return time24;
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '-';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const d = new Date(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  }
  return formatDate(dateStr);
}

export const JoinedDcModal: React.FC<JoinedDcModalProps> = ({
  isOpen,
  onClose,
  selectedOutwards,
  inwards,
  vendors
}) => {
  if (!isOpen || selectedOutwards.length === 0) return null;

  const primaryOutward = selectedOutwards[0];
  const poNumber = primaryOutward?.poNumberSnapshot || primaryOutward?.poNumber || '';
  const styleNo = primaryOutward?.styleNoSnapshot || primaryOutward?.styleNo || '';
  const customerName =
    primaryOutward?.customerCompanyNameSnapshot || primaryOutward?.customerName || 'Customer';

  // State for editable general details required for DC
  const [joinedDcNumber, setJoinedDcNumber] = useState<string>(() => {
    return primaryOutward?.ourDcNo || primaryOutward?.outwardNo || 'DC-PERLA-JOINED';
  });
  const [dcDate, setDcDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [vehicleNumber, setVehicleNumber] = useState<string>(() => primaryOutward?.vehicleNumber || '');
  const [driverName, setDriverName] = useState<string>(() => primaryOutward?.driverName || '');
  const [timeOut, setTimeOut] = useState<string>(() => {
    const raw = primaryOutward?.timeOut || (primaryOutward as any)?.outwardTime || '';
    return toTimeInputValue(raw);
  });
  const [partyDcNumber, setPartyDcNumber] = useState<string>('');
  const [partyDcDate, setPartyDcDate] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [destination, setDestination] = useState<string>(() => primaryOutward?.destination || '');
  const [notes, setNotes] = useState<string>(() => {
    return selectedOutwards
      .map((o) => (o.remarks || (o as any).notes || (o as any).note || '').trim())
      .filter(Boolean)
      .join('; ');
  });

  const [companyGstin, setCompanyGstin] = useState<string>('');
  const [companyPhone, setCompanyPhone] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Initialize async lookups for party DC, customer address & company settings
  useEffect(() => {
    let isMounted = true;

    // Resolve Party DC
    const syncParty = DeliveryChallanPdfService.resolvePartyDcInfo(primaryOutward, inwards);
    setPartyDcNumber(syncParty.partyDcNumber || '—');
    setPartyDcDate(syncParty.partyDcDate || '—');

    DeliveryChallanPdfService.resolvePartyDcInfoAsync(primaryOutward, inwards).then((asyncParty) => {
      if (isMounted && asyncParty) {
        if (asyncParty.partyDcNumber && asyncParty.partyDcNumber !== '—') {
          setPartyDcNumber(asyncParty.partyDcNumber);
        }
        if (asyncParty.partyDcDate && asyncParty.partyDcDate !== '—') {
          setPartyDcDate(asyncParty.partyDcDate);
        }
      }
    });

    // Resolve Customer Address
    const syncAddr = DeliveryChallanPdfService.resolveCustomerAddress(primaryOutward, vendors);
    setCustomerAddress(syncAddr);

    DeliveryChallanPdfService.resolveCustomerAddressAsync(primaryOutward, vendors).then((asyncAddr) => {
      if (isMounted && asyncAddr) {
        setCustomerAddress(asyncAddr);
      }
    });

    // Invoice Settings
    const unsubscribe = InvoiceSettingsService.subscribeSettings((settings) => {
      if (isMounted && settings) {
        setCompanyGstin(settings.gstin || '');
        setCompanyPhone(settings.dcPhone || settings.phone || '');
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [primaryOutward, inwards, vendors]);

  // Aggregate line items from all selected outward dispatches
  const combinedItems = useMemo(() => {
    const items: Array<{
      sNo: number;
      itemName: string;
      colour: string;
      process: string;
      description: string;
      quantity: string;
      sourceDc: string;
    }> = [];

    let counter = 1;
    selectedOutwards.forEach((outward) => {
      const lines = outward.lines || [];
      const sourceDc = outward.ourDcNo || outward.outwardNo || 'DC';

      lines.forEach((l: OutwardLine) => {
        const itemDesc = (l.itemNameSnapshot || outward.itemNameSnapshot || styleNo || 'Garments').trim();
        const col = (l.colour || l.colourNameSnapshot || '').trim();
        const proc = (l.process || l.processType || l.washTypeSnapshot || '').trim();

        let desc = itemDesc;
        if (col) desc += ` - Colour: ${col}`;
        if (proc) desc += ` - Process: ${proc}`;

        const qty = Number(l.dispatchQty) || 0;
        const unit = l.unit || 'ps';

        items.push({
          sNo: counter++,
          itemName: itemDesc,
          colour: col,
          process: proc,
          description: desc,
          quantity: `${qty.toLocaleString('en-IN')} ${unit}`,
          sourceDc
        });
      });
    });

    return items;
  }, [selectedOutwards, styleNo]);

  // Calculate total combined quantity string
  const totalQuantityStr = useMemo(() => {
    return DeliveryChallanPdfService.calculateTotalQuantity(combinedItems);
  }, [combinedItems]);

  // Handle Download Joined DC PDF
  const handleDownloadJoinedPdf = () => {
    // 1. Check-out time is strictly mandatory
    if (!timeOut || timeOut.trim() === '') {
      setValidationError('Checkout time (Time Out) is mandatory. Please enter the Time Out.');
      return;
    }
    setValidationError(null);

    try {
      setIsDownloading(true);

      const challanItems: DeliveryChallanItem[] = combinedItems.map((item, idx) => ({
        sNo: idx + 1,
        itemName: item.itemName,
        colour: item.colour,
        process: item.process,
        description: item.description,
        quantity: item.quantity
      }));

      const finalChallanData: DeliveryChallanData = {
        dcNumber: joinedDcNumber.trim() || 'DC-PERLA-JOINED',
        dcDate: formatDisplayDate(dcDate),
        partyDcNumber: partyDcNumber.trim() || '—',
        partyDcDate: partyDcDate.trim() || '—',
        customerName,
        customerAddress,
        destination,
        vehicleNumber: vehicleNumber.trim() || '—',
        driverName: driverName.trim() || '—',
        timeOut: formatTimeDisplay(timeOut),
        poNumber,
        styleNo,
        companyGstin,
        companyPhone,
        notes,
        items: challanItems,
        totalQuantityStr
      };

      DeliveryChallanPdfService.downloadPdfFromData(finalChallanData);
      onClose();
    } catch (err: any) {
      console.error('Failed to generate joined DC:', err);
      setValidationError(err.message || 'Failed to download joined delivery challan.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Joined Delivery Challan (Combined DC)"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Banner with Scope Details */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1F4E79]" />
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-slate-900">
                {customerName}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                PO: <strong className="text-slate-800">{poNumber}</strong> • Style:{' '}
                <strong className="text-slate-800">{styleNo}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-[#1F4E79] rounded-lg text-xs font-bold">
              {selectedOutwards.length} Dispatches Combined
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-black">
              Total: {totalQuantityStr}
            </span>
          </div>
        </div>

        {/* Validation Error Alert */}
        {validationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{validationError}</span>
          </div>
        )}

        {/* General Details Form Required for DC */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            General Details Required for Joined Delivery Challan
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Joined DC Number */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Joined DC Number *
              </label>
              <input
                type="text"
                value={joinedDcNumber}
                onChange={(e) => setJoinedDcNumber(e.target.value)}
                placeholder="e.g. DC-PERLA-13115"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            {/* 2. DC Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                DC Date *
              </label>
              <input
                type="date"
                value={dcDate}
                onChange={(e) => setDcDate(e.target.value)}
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
              />
            </div>

            {/* 3. Time Out (Mandatory) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Time Out <span className="text-red-500 font-black">*</span>
              </label>
              <input
                type="time"
                required
                value={timeOut}
                onChange={(e) => {
                  setTimeOut(e.target.value);
                  setValidationError(null);
                }}
                className={`w-full h-9 px-3 bg-white border rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 cursor-pointer ${
                  !timeOut ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-300 focus:ring-black'
                }`}
              />
            </div>

            {/* 4. Vehicle Number */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Vehicle Number
              </label>
              <input
                type="text"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="e.g. TN11BR0688"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            {/* 5. Driver Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Driver Name
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="e.g. SIVA"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            {/* 6. Party DC Number */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Party DC No.
              </label>
              <input
                type="text"
                value={partyDcNumber}
                onChange={(e) => setPartyDcNumber(e.target.value)}
                placeholder="Party DC No."
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            {/* 7. Party DC Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Party DC Date
              </label>
              <input
                type="text"
                value={partyDcDate}
                onChange={(e) => setPartyDcDate(e.target.value)}
                placeholder="e.g. 23 Oct 2026"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            {/* 8. Destination / Delivery Address */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Destination
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Tambaram, Chennai"
                className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          {/* Notes / Remarks Field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              DC Note / Remarks
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks or notes to print on the Delivery Challan"
              className="w-full h-9 px-3 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        </div>

        {/* Aggregated Particulars Table (All Entries Combined into One DC) */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-0">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Dispatched Particulars (Combined from {selectedOutwards.length} Outward Entries)
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              {combinedItems.length} line item(s)
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-center w-12">S.No</th>
                  <th className="py-2 px-3">Particulars &amp; Description</th>
                  <th className="py-2 px-3 text-center w-36">Source DC</th>
                  <th className="py-2 px-3 text-right w-28">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combinedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                      {String(item.sNo).padStart(2, '0')}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {item.description}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {item.sourceDc}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-800">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-300">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right uppercase text-[11px] tracking-wider text-slate-700">
                    Total Quantity:
                  </td>
                  <td className="py-2 px-3 text-right font-black text-slate-900 text-xs">
                    {totalQuantityStr}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={isDownloading}>
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={handleDownloadJoinedPdf}
            disabled={isDownloading}
            className="bg-[#1F4E79] hover:bg-[#163a5c] text-white border-[#1F4E79] flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isDownloading ? 'Generating Joined DC...' : 'Download Joined DC (PDF)'}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
