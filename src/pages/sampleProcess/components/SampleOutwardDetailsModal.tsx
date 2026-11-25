import React from 'react';
import {
  FileText,
  Truck,
  Building2,
  Calendar,
  Layers,
  Shirt,
  X,
  Printer
} from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { SamplePoOutward } from '../../../types/samplePo';

interface SampleOutwardDetailsModalProps {
  outward: SamplePoOutward | null;
  onClose: () => void;
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr || dateStr === '-') return '—';
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

export const SampleOutwardDetailsModal: React.FC<SampleOutwardDetailsModalProps> = ({
  outward,
  onClose
}) => {
  if (!outward) return null;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Sample Outward: ${outward.entryNumber}`}
      maxWidth="4xl"
    >
      <div className="space-y-4 max-h-[78vh] overflow-y-auto pr-1 text-xs">
        {/* Outward & Inward Meta Summary */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Outward Entry No</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{outward.entryNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Outward DC No &amp; Date</span>
              <span className="font-semibold text-slate-900">
                {outward.outwardDcNumber}
                <span className="text-slate-500 font-normal ml-1">
                  ({formatDisplayDate(outward.outwardDcDate)})
                </span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Linked Sample Inward</span>
              <span className="font-mono font-bold text-[#1F4E79]">{outward.inwardEntryNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer DC No &amp; Date</span>
              <span className="font-semibold text-slate-900">
                {outward.customerDcNumber || '—'}
                {outward.customerDcDate && (
                  <span className="text-slate-500 font-normal ml-1">
                    ({formatDisplayDate(outward.customerDcDate)})
                  </span>
                )}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Customer / Company</span>
              <span className="font-bold text-slate-900">{outward.vendorName}</span>
              {outward.vendorGst && (
                <span className="text-[11px] text-slate-500 block">GST: {outward.vendorGst}</span>
              )}
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Dispatched</span>
              <span className="font-mono font-extrabold text-blue-700 text-sm">
                {outward.totalQuantity} PCS
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                {outward.status}
              </span>
            </div>
          </div>

          {outward.remarks && (
            <div className="mt-3 pt-3 border-t border-slate-200/80 text-xs">
              <span className="font-bold text-slate-600">Remarks: </span>
              <span className="text-slate-800">{outward.remarks}</span>
            </div>
          )}
        </div>

        {/* Dispatched Line Items Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Shirt className="w-3.5 h-3.5 text-[#1F4E79]" />
              <span>Dispatched Line Items ({outward.items?.length || 0})</span>
            </h4>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#EEF5FB] text-[#1F4E79] font-bold uppercase text-[10px] border-b border-blue-100">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Style No</th>
                  <th className="py-2.5 px-3">Wash Type</th>
                  <th className="py-2.5 px-3">Customer DC</th>
                  <th className="py-2.5 px-3 text-right">Dispatched Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {(outward.items || []).map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-center">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{item.itemName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 font-semibold">{item.styleNo}</td>
                    <td className="py-2.5 px-3 text-slate-600">{item.washType}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.customerDcNumber}{' '}
                      <span className="text-[10px] text-slate-400 block">
                        {formatDisplayDate(item.customerDcDate)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                      {item.quantity} {item.unit || 'PCS'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={5} className="py-2 px-3 text-right text-slate-600 uppercase text-[10px]">
                    Total Quantity
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-extrabold text-[#1F4E79]">
                    {outward.totalQuantity} PCS
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <div>
            Created By: <strong className="text-slate-600">{outward.createdByName || 'System'}</strong> on{' '}
            {formatDisplayDate(outward.createdAt)}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
