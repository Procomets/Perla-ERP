import React, { useState, useEffect } from 'react';
import { OutwardEntry } from '../../../types/outward';
import { InwardEntry } from '../../../types/inward';
import { Vendor } from '../../../types/vendor';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import {
  ArrowLeft,
  Download,
  Edit3,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import { formatDate } from '../../../utils/formatters';
import { DeliveryChallanPdfService, DeliveryChallanData } from '../../../services/deliveryChallanPdfService';
import { InvoiceSettingsService } from '../../../services/invoiceSettingsService';

function toDateInputValue(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  const dmyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const dd = dmyMatch[1].padStart(2, '0');
    const mm = dmyMatch[2].padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
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

function parseQuantityAndUnit(quantityStr?: string): { value: string; unit: 'kg' | 'ps' } {
  if (!quantityStr) return { value: '', unit: 'ps' };
  const str = quantityStr.trim();
  const isKg = /kg/i.test(str);
  const match = str.replace(/,/g, '').match(/([0-9]+(?:\.[0-9]+)?)/);
  const value = match ? match[1] : str.replace(/(kg|ps|pcs|pieces)/gi, '').trim();
  return { value, unit: isKg ? 'kg' : 'ps' };
}

interface OutwardPrintViewProps {
  outward: OutwardEntry;
  inwards?: InwardEntry[];
  vendors?: Vendor[];
  onBack: () => void;
}

const SLIPS = [1, 2, 3];

interface ChallanSlipProps {
  challanData: DeliveryChallanData;
  isResolving: boolean;
}

const ChallanSlip: React.FC<ChallanSlipProps> = ({ challanData, isResolving }) => {
  return (
    <div className="print-slip bg-white p-2.5 sm:p-3 border-2 border-black rounded text-black font-sans box-border flex flex-col justify-between">
      {/* 1. Header Section */}
      <div>
        {/* Top Header Row: GSTIN (Left) & DELIVERY CHALLAN in right top corner */}
        <div className="flex justify-between items-center text-[10px] font-bold text-black border-b border-black pb-0.5 mb-1">
          <span>GSTIN / UIN : {challanData.companyGstin || '33AMMPK2032Q1ZU'}</span>
          <span className="font-extrabold text-xs sm:text-sm tracking-wider uppercase">
            DELIVERY CHALLAN
          </span>
        </div>

        {/* Company Header Row */}
        <div className="text-center pb-1 border-b border-black">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-black">
              Cell : {challanData.companyPhone || '87545 96316'}
            </span>
            <h1 className="text-base sm:text-lg font-black tracking-wide text-black uppercase -ml-16">
              PERLA TEXTILES PROCESSOR
            </h1>
            <span className="w-16"></span>
          </div>
          <p className="text-[9.5px] font-bold text-black mt-0.5">
            NO. 107, Industrial Estate, Thirumudivakkam, SIDCO, Chennai - 600 044.
          </p>
        </div>

        {/* 2. Metadata Section */}
        <div className="py-1 border-b border-black text-[11px] font-semibold space-y-0.5">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-black">No.</span>
              <span className="font-black text-xs text-black px-1 border-b border-dotted border-black">
                {challanData.dcNumber}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="font-bold text-black">Party D.C. No. :</span>
              <span className="font-black text-black border-b border-dotted border-black px-1.5 min-w-[60px] text-center">
                {challanData.partyDcNumber !== '-' ? challanData.partyDcNumber : isResolving ? '...' : '-'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-black">Date :</span>
              <span className="border-b border-dotted border-black px-1 text-black">
                {challanData.dcDate}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="font-bold text-black">Date :</span>
              <span className="border-b border-dotted border-black px-1 text-black min-w-[60px] text-center">
                {challanData.partyDcDate !== '-' ? challanData.partyDcDate : isResolving ? '...' : '-'}
              </span>
            </div>
          </div>

          {/* Customer Company Name and Full Address */}
          <div className="flex items-start gap-1 pt-0.5">
            <span className="font-bold text-black shrink-0">To :</span>
            <div className="border-b border-dotted border-black flex-1 font-bold text-black pb-0.5 leading-tight">
              <span>{challanData.customerName}</span>
              {(challanData.customerAddress || challanData.destination) && (
                <span className="font-normal text-slate-800 ml-1.5 text-[10px]">
                  , {challanData.customerAddress || challanData.destination}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Dispatched Lines Table */}
        <div className="my-1">
          <table className="w-full text-left text-[10.5px] border border-black border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-black font-black uppercase text-[10px]">
                <th className="py-1 px-1.5 border-r border-black text-center w-10">S.No.</th>
                <th className="py-1 px-2 border-r border-black">Particulars</th>
                <th className="py-1 px-2 text-right w-24">Qty.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {challanData.items.slice(0, 3).map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="py-1 px-1.5 border-r border-black text-center font-bold text-black align-top">
                    {String(item.sNo).padStart(2, '0')}
                  </td>
                  <td className="py-1 px-2 border-r border-black font-semibold text-black truncate max-w-[280px]">
                    {item.description}
                  </td>
                  <td className="py-1 px-2 text-right font-black text-black whitespace-nowrap align-top">
                    {item.quantity}
                  </td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 2 - challanData.items.length) }).map((_, idx) => (
                <tr key={`empty-${idx}`}>
                  <td className="py-1 border-r border-black">&nbsp;</td>
                  <td className="py-1 border-r border-black">&nbsp;</td>
                  <td className="py-1">&nbsp;</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-black bg-slate-100 font-black">
                <td className="py-0.5 px-1.5 border-r border-black"></td>
                <td className="py-0.5 px-2 border-r border-black text-right uppercase text-[9.5px] tracking-wider text-black">
                  TOTAL QUANTITY:
                </td>
                <td className="py-0.5 px-2 text-right text-black font-black text-xs">
                  {challanData.totalQuantityStr || DeliveryChallanPdfService.calculateTotalQuantity(challanData.items)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. Bottom Section: Vehicle Box & Signatures */}
      <div className="pt-1 grid grid-cols-12 gap-2 items-end">
        {/* Left: Vehicle Box */}
        <div className="col-span-5 border border-black rounded divide-y divide-black text-[9.5px] font-semibold bg-white">
          <div className="px-1.5 py-0.5 flex justify-between">
            <span className="font-bold text-black">Vehicle No. :</span>
            <span className="font-mono text-black font-bold">{challanData.vehicleNumber || '—'}</span>
          </div>
          <div className="px-1.5 py-0.5 flex justify-between">
            <span className="font-bold text-black">Driver Name :</span>
            <span className="text-black font-bold truncate max-w-[100px]">{challanData.driverName || '—'}</span>
          </div>
          <div className="px-1.5 py-0.5 flex justify-between">
            <span className="font-bold text-black">Time Out :</span>
            <span className="font-mono text-black font-bold">{challanData.timeOut || '—'}</span>
          </div>
        </div>

        {/* Center: Receiver Signature */}
        <div className="col-span-3 text-center pb-0.5">
          <div className="border-t border-black mx-auto w-24 pt-0.5 text-[9px] font-bold text-black">
            Receiver's Signature
          </div>
        </div>

        {/* Right: Perla Signature */}
        <div className="col-span-4 text-right pb-0.5">
          <div className="text-[9.5px] font-bold text-black mb-4">
            For PERLA TEXTILES PROCESSOR
          </div>
          <div className="border-t border-black inline-block pt-0.5 text-[9px] font-semibold text-black px-2">
            Authorized Signature
          </div>
        </div>
      </div>
    </div>
  );
};

export const OutwardPrintView: React.FC<OutwardPrintViewProps> = ({ outward, inwards, vendors, onBack }) => {
  const [challanData, setChallanData] = useState<DeliveryChallanData>(() =>
    DeliveryChallanPdfService.extractChallanData(outward, inwards, vendors)
  );
  const [isResolving, setIsResolving] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formState, setFormState] = useState<DeliveryChallanData>(challanData);

  useEffect(() => {
    let isMounted = true;
    setIsResolving(true);
    DeliveryChallanPdfService.extractChallanDataAsync(outward, inwards, vendors)
      .then((data) => {
        if (isMounted) {
          setChallanData(data);
          setFormState(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to resolve DC info:', err);
      })
      .finally(() => {
        if (isMounted) setIsResolving(false);
      });

    const unsubscribe = InvoiceSettingsService.subscribeSettings((settings) => {
      if (isMounted && settings) {
        setChallanData((prev) => ({
          ...prev,
          companyGstin: settings.gstin || prev.companyGstin,
          companyPhone: settings.dcPhone || settings.phone || prev.companyPhone
        }));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [outward, inwards, vendors]);

  // Open Edit Modal populated with current challanData
  const handleOpenEditModal = () => {
    setFormState(JSON.parse(JSON.stringify(challanData)));
    setIsEditModalOpen(true);
  };

  // Save changes from Edit Modal
  const handleSaveEditModal = () => {
    const computed = DeliveryChallanPdfService.calculateTotalQuantity(formState.items);
    setChallanData({
      ...formState,
      totalQuantityStr: formState.totalQuantityStr?.trim() || computed
    });
    setIsEditModalOpen(false);
  };

  // Direct download handler (using live challanData)
  const handleDownloadPdf = () => {
    DeliveryChallanPdfService.downloadPdfFromData(challanData);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={onBack} className="flex items-center gap-1.5 text-xs">
            <ArrowLeft className="w-4 h-4" />
            Back to Outward Details
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenEditModal}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 border-slate-300 hover:bg-slate-50"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
              Edit All DC Details
            </Button>

            {/* Black Download Button */}
            <button
              onClick={handleDownloadPdf}
              className="bg-black hover:bg-slate-800 active:bg-slate-900 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-white" />
              Download 3-Copy DC (PDF)
            </button>
          </div>
        </div>

        {/* Quick Fields: Checkout Date & Time Out (Reflects live in DC and download) */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-bold text-slate-800">Checkout Date:</span>
            <input
              type="date"
              value={toDateInputValue(challanData.dcDate)}
              onChange={(e) => {
                const val = e.target.value;
                setChallanData((prev) => ({ ...prev, dcDate: val ? formatDisplayDate(val) : '' }));
              }}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold text-slate-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            <span className="font-bold text-slate-800">Time Out:</span>
            <input
              type="time"
              value={toTimeInputValue(challanData.timeOut)}
              onChange={(e) => {
                const val = e.target.value;
                setChallanData((prev) => ({ ...prev, timeOut: val ? formatTimeDisplay(val) : '' }));
              }}
              className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold text-slate-900 cursor-pointer focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <span className="text-[11px] text-slate-500 font-medium ml-auto">
            Edits update the challan preview & PDF live.
          </span>
        </div>
      </div>

      {/* A4 Sheet Container: Houses all 3 slips with clean dotted lines */}
      <div className="print-page-a4 bg-white p-4 sm:p-6 border border-slate-300 rounded-lg max-w-4xl mx-auto shadow-md space-y-2">
        {SLIPS.map((slipNum, idx) => (
          <React.Fragment key={slipNum}>
            <ChallanSlip
              challanData={challanData}
              isResolving={isResolving}
            />

            {/* Clean dotted separation line between slips */}
            {idx < SLIPS.length - 1 && (
              <div className="my-1.5 w-full border-b-2 border-dotted border-slate-400"></div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Comprehensive Modal to Edit All Challan Details */}
      {isEditModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Delivery Challan Details"
          maxWidth="2xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
            {/* 1. DC Reference Numbers & Dates */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                Challan Numbers & Dates
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Our DC No.
                  </label>
                  <input
                    type="text"
                    value={formState.dcNumber}
                    onChange={(e) => setFormState({ ...formState, dcNumber: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Checkout Date
                  </label>
                  <input
                    type="date"
                    value={toDateInputValue(formState.dcDate)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormState({ ...formState, dcDate: val ? formatDisplayDate(val) : '' });
                    }}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Party D.C. No. (Customer DC)
                  </label>
                  <input
                    type="text"
                    value={formState.partyDcNumber}
                    onChange={(e) => setFormState({ ...formState, partyDcNumber: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Party D.C. Date
                  </label>
                  <input
                    type="text"
                    value={formState.partyDcDate}
                    onChange={(e) => setFormState({ ...formState, partyDcDate: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    GSTIN / UIN (From Tax Settings)
                  </label>
                  <input
                    type="text"
                    value={formState.companyGstin || ''}
                    onChange={(e) => setFormState({ ...formState, companyGstin: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold uppercase font-mono"
                    placeholder="e.g. 33AMMPK2032Q1ZU"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    DC Contact / Cell (From Tax Settings)
                  </label>
                  <input
                    type="text"
                    value={formState.companyPhone || ''}
                    onChange={(e) => setFormState({ ...formState, companyPhone: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                    placeholder="e.g. 87545 96316"
                  />
                </div>
              </div>
            </div>

            {/* 2. Customer & Full Address */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                Recipient Company & Full Address
              </h4>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Customer / Company Name
                </label>
                <input
                  type="text"
                  value={formState.customerName}
                  onChange={(e) => setFormState({ ...formState, customerName: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Full Delivery Address
                </label>
                <textarea
                  rows={2}
                  value={formState.customerAddress || formState.destination || ''}
                  onChange={(e) => setFormState({ ...formState, customerAddress: e.target.value, destination: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-medium"
                  placeholder="Door No, Street name, Area, City, State, PIN code"
                />
              </div>
            </div>

            {/* 3. Vehicle & Transit Details */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                Transit & Vehicle Details
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Vehicle No.
                  </label>
                  <input
                    type="text"
                    value={formState.vehicleNumber || ''}
                    onChange={(e) => setFormState({ ...formState, vehicleNumber: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-mono font-bold"
                    placeholder="e.g. TN22 AY 4512"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    value={formState.driverName || ''}
                    onChange={(e) => setFormState({ ...formState, driverName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold"
                    placeholder="e.g. Ramesh"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Time Out
                  </label>
                  <input
                    type="time"
                    value={toTimeInputValue(formState.timeOut)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormState({ ...formState, timeOut: val ? formatTimeDisplay(val) : '' });
                    }}
                    className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* 4. Dispatched Particulars Table Items */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">
                  Particulars & Quantities
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const nextItems = [
                      ...formState.items,
                      { sNo: formState.items.length + 1, description: 'Fabric / Garments', quantity: '01 ps' }
                    ];
                    const autoTotal = DeliveryChallanPdfService.calculateTotalQuantity(nextItems);
                    setFormState({ ...formState, items: nextItems, totalQuantityStr: autoTotal });
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Row
                </button>
              </div>

              <div className="space-y-2">
                {formState.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded">
                    <span className="w-6 text-center font-bold text-slate-700">{idx + 1}</span>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => {
                        const nextItems = [...formState.items];
                        nextItems[idx].description = e.target.value;
                        setFormState({ ...formState, items: nextItems });
                      }}
                      className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                      placeholder="Item Description / Colour / Process"
                    />
                    {(() => {
                      const { value: qVal, unit: qUnit } = parseQuantityAndUnit(item.quantity);
                      return (
                        <div className="flex items-center border border-slate-300 rounded overflow-hidden bg-white shrink-0 shadow-2xs">
                          <input
                            type="text"
                            value={qVal}
                            onChange={(e) => {
                              const newNum = e.target.value.trim();
                              const nextItems = [...formState.items];
                              nextItems[idx].quantity = newNum ? `${newNum} ${qUnit}` : '';
                              const autoTotal = DeliveryChallanPdfService.calculateTotalQuantity(nextItems);
                              setFormState({
                                ...formState,
                                items: nextItems,
                                totalQuantityStr: autoTotal
                              });
                            }}
                            className="w-16 px-2 py-1 text-xs font-bold text-right text-slate-900 focus:outline-none"
                            placeholder="0"
                          />
                          <select
                            value={qUnit}
                            onChange={(e) => {
                              const newUnit = e.target.value as 'kg' | 'ps';
                              const nextItems = [...formState.items];
                              nextItems[idx].quantity = qVal ? `${qVal} ${newUnit}` : `0 ${newUnit}`;
                              const autoTotal = DeliveryChallanPdfService.calculateTotalQuantity(nextItems);
                              setFormState({
                                ...formState,
                                items: nextItems,
                                totalQuantityStr: autoTotal
                              });
                            }}
                            className="bg-slate-100 border-l border-slate-300 px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none hover:bg-slate-200 transition-colors"
                          >
                            <option value="kg">kg</option>
                            <option value="ps">ps</option>
                          </select>
                        </div>
                      );
                    })()}
                    {formState.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextItems = formState.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sNo: i + 1 }));
                          const autoTotal = DeliveryChallanPdfService.calculateTotalQuantity(nextItems);
                          setFormState({ ...formState, items: nextItems, totalQuantityStr: autoTotal });
                        }}
                        className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-800">
                    Total Quantity Text
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const auto = DeliveryChallanPdfService.calculateTotalQuantity(formState.items);
                      setFormState({ ...formState, totalQuantityStr: auto });
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                  >
                    Recalculate from items
                  </button>
                </div>
                <input
                  type="text"
                  value={formState.totalQuantityStr}
                  onChange={(e) => setFormState({ ...formState, totalQuantityStr: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-xs font-bold"
                  placeholder="e.g. 50 ps / 201 kg"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleSaveEditModal}
                className="bg-black hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Apply Changes to Challan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
