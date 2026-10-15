import React from 'react';
import { OutwardEntry } from '../../../types/outward';
import { Button } from '../../../components/ui/Button';
import { formatDate } from '../../../utils/formatters';
import { ArrowLeft, Printer } from 'lucide-react';

interface OutwardPrintViewProps {
  outward: OutwardEntry;
  onBack: () => void;
}

export const OutwardPrintView: React.FC<OutwardPrintViewProps> = ({ outward, onBack }) => {
  const handlePrint = () => {
    window.print();
  };

  const lines = outward.lines || [];

  return (
    <div className="space-y-6">
      {/* Top Action Bar (Hidden during print) */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-2xs print:hidden">
        <Button variant="outline" size="sm" onClick={onBack} className="flex items-center gap-1.5 text-xs">
          <ArrowLeft className="w-4 h-4" />
          Back to Outward Details
        </Button>
        <Button
          size="sm"
          onClick={handlePrint}
          className="bg-[#1F4E79] hover:bg-[#163858] text-white flex items-center gap-1.5 text-xs font-semibold"
        >
          <Printer className="w-4 h-4" />
          Print Delivery Challan
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
            DELIVERY CHALLAN / OUTWARD DISPATCH NOTE
          </h2>
        </div>

        {/* Meta Grid */}
        <div className="grid grid-cols-2 gap-6 text-xs mb-6">
          {/* Left: Customer Info */}
          <div className="border border-slate-200 rounded p-3 space-y-1 bg-slate-50/50">
            <span className="font-bold text-[10px] uppercase text-slate-400 block tracking-wider">
              DISPATCH DESTINATION / CUSTOMER
            </span>
            <div className="font-bold text-sm text-[#1F4E79]">
              {outward.customerCompanyNameSnapshot || outward.customerName}
            </div>
            {outward.subcontractorNameSnapshot && (
              <div className="text-slate-600">
                <span className="font-semibold">Subcontractor:</span> {outward.subcontractorNameSnapshot}
              </div>
            )}
            {outward.destination && (
              <div className="text-slate-700">
                <span className="font-semibold">Destination:</span> {outward.destination}
              </div>
            )}
            <div className="text-slate-500">
              <span className="font-semibold">Customer ID:</span> {outward.customerVendorId || outward.customerId}
            </div>
          </div>

          {/* Right: Challan & Transport Info */}
          <div className="border border-slate-200 rounded p-3 space-y-1 bg-slate-50/50">
            <span className="font-bold text-[10px] uppercase text-slate-400 block tracking-wider">
              DELIVERY CHALLAN METADATA
            </span>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Our DC No:</span>
              <span className="font-bold font-mono text-[#1F4E79]">{outward.ourDcNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Outward No:</span>
              <span className="font-mono font-bold text-slate-800">{outward.outwardNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Dispatch Date:</span>
              <span className="font-semibold">{formatDate(outward.outwardDate)}</span>
            </div>
            {outward.vehicleNumber && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Vehicle No:</span>
                <span className="font-mono">{outward.vehicleNumber}</span>
              </div>
            )}
            {outward.driverName && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Driver Name:</span>
                <span>{outward.driverName}</span>
              </div>
            )}
          </div>
        </div>

        {/* PO Reference Strip */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-6 grid grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">PO Number</span>
            <span className="font-bold text-[#1F4E79]">{outward.poNumberSnapshot || outward.poNumber}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Style Number</span>
            <span className="font-semibold text-slate-800">{outward.styleNoSnapshot || outward.styleNo}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Item Description</span>
            <span className="font-semibold text-slate-800">{outward.itemNameSnapshot || outward.itemName}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Process Category</span>
            <span className="font-semibold text-slate-800 uppercase">{outward.processCategorySnapshot || outward.processCategory}</span>
          </div>
        </div>

        {/* Dispatched Lines Table */}
        <div className="mb-6">
          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-300">
                <th className="p-2 border-r border-slate-300 text-center w-10">S.No</th>
                <th className="p-2 border-r border-slate-300">Colour Shade</th>
                <th className="p-2 border-r border-slate-300">Process Applied</th>
                <th className="p-2 border-r border-slate-300 text-right">Ordered Qty</th>
                <th className="p-2 border-r border-slate-300 text-center w-14">Unit</th>
                <th className="p-2 border-r border-slate-300 text-right">Received Inward</th>
                <th className="p-2 border-r border-slate-300 text-right bg-blue-50/50">Dispatched (This DC)</th>
                <th className="p-2 text-right">Balance Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {lines.map((l, idx) => {
                const ord = Number(l.orderedQtySnapshot) || 0;
                const inw = Number(l.cumulativeInwardQtySnapshot) || 0;
                const disp = Number(l.dispatchQty) || 0;
                const rem = Number(l.remainingAfterDispatchSnapshot) || 0;

                return (
                  <tr key={l.outwardLineId || idx}>
                    <td className="p-2 border-r border-slate-300 text-center font-medium">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-300 font-semibold">
                      {l.colourNameSnapshot || l.colour}
                      {l.colourCodeSnapshot && (
                        <span className="text-[10px] text-slate-500 font-normal ml-1">
                          ({l.colourCodeSnapshot})
                        </span>
                      )}
                    </td>
                    <td className="p-2 border-r border-slate-300 text-slate-600">
                      {l.washTypeSnapshot || l.processType || 'Standard Wash'}
                    </td>
                    <td className="p-2 border-r border-slate-300 text-right">{ord.toLocaleString()}</td>
                    <td className="p-2 border-r border-slate-300 text-center uppercase text-[10px]">{l.unit}</td>
                    <td className="p-2 border-r border-slate-300 text-right">{inw.toLocaleString()}</td>
                    <td className="p-2 border-r border-slate-300 text-right font-bold text-slate-900 bg-blue-50/30">
                      {disp.toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-medium text-slate-700">{rem.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                <td colSpan={6} className="p-2 text-right uppercase text-[10px] tracking-wider border-r border-slate-300">
                  Total Dispatched Quantity:
                </td>
                <td className="p-2 text-right font-black text-[#1F4E79] border-r border-slate-300">
                  {outward.totalQtyByUnit?.piece ? `${outward.totalQtyByUnit.piece.toLocaleString()} pcs` : ''}
                  {outward.totalQtyByUnit?.kg ? ` ${outward.totalQtyByUnit.kg.toLocaleString()} kg` : ''}
                </td>
                <td className="p-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks if any */}
        {outward.remarks && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs mb-8">
            <span className="font-bold text-slate-500 block uppercase text-[10px]">Dispatch Remarks:</span>
            <p className="text-slate-800 mt-0.5">{outward.remarks}</p>
          </div>
        )}

        {/* Terms & Declarations */}
        <div className="text-[10px] text-slate-500 border border-slate-200 p-2.5 rounded mb-8 space-y-1">
          <p className="font-semibold text-slate-700">Terms & Conditions:</p>
          <p>
            1. Goods once dispatched are verified for specified wet/dry processing quality standards.
          </p>
          <p>
            2. Any discrepancy in count or quality must be notified in writing within 24 hours of delivery.
          </p>
          <p>
            3. Subject to Chennai / Kanchipuram jurisdiction.
          </p>
        </div>

        {/* Signature Blocks */}
        <div className="grid grid-cols-4 gap-4 text-center text-xs pt-12 border-t border-slate-300">
          <div>
            <div className="border-t border-slate-400 mx-3 pt-1">
              <p className="font-bold text-slate-800">Prepared By</p>
              <p className="text-[10px] text-slate-400">Stores / Dispatch Clerk</p>
            </div>
          </div>
          <div>
            <div className="border-t border-slate-400 mx-3 pt-1">
              <p className="font-bold text-slate-800">Quality Checked</p>
              <p className="text-[10px] text-slate-400">QC Supervisor</p>
            </div>
          </div>
          <div>
            <div className="border-t border-slate-400 mx-3 pt-1">
              <p className="font-bold text-slate-800">Carrier / Driver</p>
              <p className="text-[10px] text-slate-400">Vehicle Carrier Signature</p>
            </div>
          </div>
          <div>
            <div className="border-t border-slate-400 mx-3 pt-1">
              <p className="font-bold text-slate-800">Customer Receiver</p>
              <p className="text-[10px] text-slate-400">Authorized Seal & Sign</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
