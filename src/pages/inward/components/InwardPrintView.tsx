import React from 'react';
import { InwardEntry } from '../../../types/inward';
import { Button } from '../../../components/ui/Button';
import { formatDate } from '../../../utils/formatters';
import { ArrowLeft, Printer } from 'lucide-react';

interface InwardPrintViewProps {
  inward: InwardEntry;
  onBack: () => void;
}

export const InwardPrintView: React.FC<InwardPrintViewProps> = ({ inward, onBack }) => {
  const handlePrint = () => {
    window.print();
  };

  const lines = inward.lines || [];

  return (
    <div className="space-y-6">
      {/* Top action bar (hidden during print) */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-2xs print:hidden">
        <Button variant="outline" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" size="sm" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>
          Print Inward Receipt Note
        </Button>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white p-8 sm:p-12 border border-slate-300 rounded-xl max-w-4xl mx-auto text-slate-900 font-sans shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Header with Perla Textiles Processor Branding */}
        <div className="text-center pb-4 border-b-2 border-slate-800">
          <h1 className="text-2xl font-black tracking-wider text-[#1F4E79] uppercase">
            PERLA TEXTILES PROCESSOR
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Specialists in Premium Garment Washing, Softening & Industrial Dyeing
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Factory: No. 48/2, SIDCO Industrial Estate, Thirumudivakkam, Chennai - 600044, Tamil Nadu
          </p>
          <p className="text-[11px] text-slate-500 font-mono">
            GSTIN: 33AAAAA0000A1Z5 | Email: contact@perlatextiles.com | Ph: 044-24781200
          </p>
        </div>

        {/* Document Title Banner */}
        <div className="my-4 py-1.5 bg-[#EEF5FB] border border-[#1F4E79] text-center rounded">
          <h2 className="text-sm font-black tracking-widest text-[#1F4E79] uppercase">
            MATERIAL INWARD RECEIPT (DC NOTE)
          </h2>
        </div>

        {/* Meta Grid */}
        <div className="grid grid-cols-2 gap-6 text-xs mb-6">
          {/* Left: Customer Info */}
          <div className="border border-slate-200 rounded p-3 space-y-1 bg-slate-50/50">
            <span className="font-bold text-[10px] uppercase text-slate-400 block tracking-wider">
              CUSTOMER / COMPANY DETAILS
            </span>
            <div className="font-bold text-sm text-[#1F4E79]">
              {inward.customerCompanyNameSnapshot || inward.customerName}
            </div>
            {inward.subcontractorNameSnapshot && (
              <div className="text-slate-600">
                <span className="font-semibold">Subcontractor:</span> {inward.subcontractorNameSnapshot}
              </div>
            )}
            <div className="text-slate-500">
              <span className="font-semibold">Customer ID:</span> {inward.customerVendorId || inward.customerId}
            </div>
          </div>

          {/* Right: Receipt & DC Info */}
          <div className="border border-slate-200 rounded p-3 space-y-1 bg-slate-50/50">
            <span className="font-bold text-[10px] uppercase text-slate-400 block tracking-wider">
              RECEIPT & CHALLAN METADATA
            </span>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Inward Receipt No:</span>
              <span className="font-bold font-mono text-[#1F4E79]">{inward.inwardNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Customer DC No:</span>
              <span className="font-mono font-bold text-slate-800">{inward.customerDcNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Customer DC Date:</span>
              <span>{formatDate(inward.customerDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Inward Receipt Date:</span>
              <span>{formatDate(inward.inwardDate)}</span>
            </div>
          </div>
        </div>

        {/* PO Reference strip */}
        <div className="bg-slate-100 p-3 rounded mb-4 grid grid-cols-4 gap-2 text-xs border border-slate-200">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Purchase Order No</span>
            <span className="font-bold text-[#1F4E79]">{inward.poNumberSnapshot || inward.poNumber}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Style Number</span>
            <span className="font-bold">{inward.styleNoSnapshot || inward.styleNo}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Item Description</span>
            <span className="font-medium text-slate-800">{inward.itemNameSnapshot || inward.itemName}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Process Category</span>
            <span className="font-bold uppercase text-[#1F4E79]">{inward.processCategorySnapshot || inward.processCategory}</span>
          </div>
        </div>

        {/* Colour-Wise Quantity Table */}
        <div className="mb-6">
          <table className="w-full text-left text-xs border border-slate-300">
            <thead className="bg-[#EEF5FB] text-[#1F4E79] font-bold border-b border-slate-300">
              <tr>
                <th className="p-2 border-r border-slate-300 text-center w-10">S.No</th>
                <th className="p-2 border-r border-slate-300">Colour Name</th>
                <th className="p-2 border-r border-slate-300">Wash Process</th>
                <th className="p-2 border-r border-slate-300 text-right">Ordered Qty</th>
                <th className="p-2 border-r border-slate-300 text-center">Unit</th>
                <th className="p-2 border-r border-slate-300 text-right">Prev Received</th>
                <th className="p-2 border-r border-slate-300 text-right font-bold text-[#1F4E79] bg-blue-50/50">
                  Received in This DC
                </th>
                <th className="p-2 border-r border-slate-300 text-right">Cumulative Qty</th>
                <th className="p-2 text-right">Balance Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lines.map((l, idx) => (
                <tr key={l.inwardLineId || l.lineId || idx}>
                  <td className="p-2 border-r border-slate-300 text-center text-slate-500">{idx + 1}</td>
                  <td className="p-2 border-r border-slate-300 font-semibold text-slate-900">
                    {l.colourNameSnapshot || l.colour}
                    {l.colourCodeSnapshot && (
                      <span className="text-[10px] text-slate-500 font-normal ml-1">({l.colourCodeSnapshot})</span>
                    )}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-slate-600">{l.washTypeSnapshot || l.processType}</td>
                  <td className="p-2 border-r border-slate-300 text-right">{l.orderedQtySnapshot?.toLocaleString()}</td>
                  <td className="p-2 border-r border-slate-300 text-center uppercase font-bold text-[10px]">{l.unit}</td>
                  <td className="p-2 border-r border-slate-300 text-right text-slate-500">{l.previouslyReceivedQtySnapshot?.toLocaleString()}</td>
                  <td className="p-2 border-r border-slate-300 text-right font-bold text-[#1F4E79] bg-blue-50/30">
                    {l.receivedQty?.toLocaleString()}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right text-slate-800">{l.cumulativeReceivedQtySnapshot?.toLocaleString()}</td>
                  <td className="p-2 text-right font-bold text-slate-700">{l.balanceAfterReceiptSnapshot?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Remarks */}
        <div className="grid grid-cols-2 gap-4 text-xs mb-10">
          <div className="border border-slate-200 rounded p-3 bg-slate-50/30">
            <span className="font-bold text-[10px] uppercase text-slate-400 block mb-1">REMARKS & VERIFICATION</span>
            <p className="text-slate-600 italic">
              {inward.remarks || 'Fabric materials received in good condition for washing/dyeing processing.'}
            </p>
          </div>

          <div className="border border-slate-200 rounded p-3 bg-slate-50/50 space-y-1">
            <span className="font-bold text-[10px] uppercase text-slate-400 block mb-1">TOTAL RECEIVED QUANTITIES</span>
            {inward.totalQtyByUnit?.piece !== undefined && (
              <div className="flex justify-between font-bold text-sm text-[#1F4E79]">
                <span>Total Pieces:</span>
                <span>{inward.totalQtyByUnit.piece.toLocaleString()} pcs</span>
              </div>
            )}
            {inward.totalQtyByUnit?.kg !== undefined && inward.totalQtyByUnit.kg > 0 && (
              <div className="flex justify-between font-bold text-sm text-indigo-700">
                <span>Total Kilograms:</span>
                <span>{inward.totalQtyByUnit.kg.toLocaleString()} kg</span>
              </div>
            )}
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-8 pt-8 border-t border-slate-300 text-center text-xs">
          <div>
            <div className="h-12 border-b border-dashed border-slate-400 mb-1"></div>
            <p className="font-bold text-slate-800">Delivered By</p>
            <p className="text-[10px] text-slate-500">Customer Driver / Transporter</p>
          </div>

          <div>
            <div className="h-12 border-b border-dashed border-slate-400 mb-1"></div>
            <p className="font-bold text-slate-800">Inspected & Verified By</p>
            <p className="text-[10px] text-slate-500">Perla QA / Processing Supervisor</p>
          </div>

          <div>
            <div className="h-12 border-b border-dashed border-slate-400 mb-1"></div>
            <p className="font-bold text-slate-800">Received By (Stores)</p>
            <p className="text-[10px] text-slate-500">Perla Textiles Processor Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};
